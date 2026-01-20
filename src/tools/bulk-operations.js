"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkProjectProductivityTool = exports.bulkUserProductivityTool = void 0;
exports.debugLog = debugLog;
const zod_1 = require("zod");
const auth_1 = require("../utils/auth");
// Debug logging (only in local development)
// Add file and push logs 
function debugLog(message, data) {
    const timestamp = new Date().toISOString();
    try {
        // // Ensure the directory exists
        // if (!fs.existsSync(logDir)) {
        //   fs.mkdirSync(logDir, { recursive: true });
        // }
        // // Write to file
        // if (data) {
        //   fs.appendFileSync(logFile, `[CLOCKIFY-MCP-DEBUG] [${timestamp}] ${message} ${JSON.stringify(data, null, 2)}\n`);
        // } else {
        //   fs.appendFileSync(logFile, `[CLOCKIFY-MCP-DEBUG] [${timestamp}] ${message}\n`);
        // }
    }
    catch (error) {
        // Fallback to console if file writing fails
        console.log(`[CLOCKIFY-MCP-DEBUG] [${timestamp}] ${message}`, data || '');
        console.error('Failed to write to log file:', error);
    }
}
// Cache for bulk operations
const bulkCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes - increased for better performance
function getCacheKey(prefix, params) {
    // Create normalized cache key for better consistency
    const normalizedParams = {
        users: Array.isArray(params.users) ? params.users.sort() : params.users,
        startDate: params.startDate,
        endDate: params.endDate,
        projectKeys: Array.isArray(params.projectKeys) ? params.projectKeys.sort() : params.projectKeys,
        aggregateBy: params.aggregateBy || 'user',
        includeCorrelation: Boolean(params.includeCorrelation),
        cloudId: params.cloudId
    };
    return `${prefix}_${JSON.stringify(normalizedParams)}`;
}
function isValidCache(key) {
    const cached = bulkCache.get(key);
    const isValid = cached !== undefined && (Date.now() - cached.timestamp) < CACHE_DURATION;
    if (cached && !isValid) {
        // Clean up expired cache entries
        bulkCache.delete(key);
    }
    return isValid;
}
function setCache(key, data) {
    // Implement cache size limit to prevent memory issues
    if (bulkCache.size > 100) {
        // Remove oldest entries
        const oldestKey = bulkCache.keys().next().value;
        if (oldestKey) {
            bulkCache.delete(oldestKey);
        }
    }
    bulkCache.set(key, { data, timestamp: Date.now() });
}
function getCache(key) {
    return bulkCache.get(key)?.data;
}
// Bulk user productivity analysis
exports.bulkUserProductivityTool = {
    name: "jira_bulk_user_analytics",
    description: "Get comprehensive productivity analytics for multiple users  by accountId  in one call. Ideal for team performance analysis, ranking, and cross-platform correlation.",
    parameters: {
        users: zod_1.z.array(zod_1.z.string()).describe("Array of user IDs"),
        startDate: zod_1.z.string().describe("Start date in YYYY-MM-DD format"),
        endDate: zod_1.z.string().describe("End date in YYYY-MM-DD format"),
        includeCorrelation: zod_1.z.boolean().optional().default(true).describe("Include correlation data for cross-platform analysis"),
        aggregateBy: zod_1.z.enum(['user', 'project', 'sprint']).optional().default('user').describe("How to aggregate the results"),
        cloudId: zod_1.z.string().describe("valid jira cloud id."),
    },
    handler: async (params) => {
        try {
            const cacheKey = getCacheKey('bulk_user_productivity', params);
            if (isValidCache(cacheKey)) {
                const cachedResult = getCache(cacheKey);
                // Mark as cached result
                cachedResult.metadata.cached = true;
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify(cachedResult, null, 2)
                        }],
                };
            }
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            // Build JQL query for all users
            const userList = params.users.map(id => `"${id}"`).join(',');
            let jql = `assignee IN (${userList}) AND created >= "${params.startDate}" AND created <= "${params.endDate}"`;
            if (params.projectKeys && params.projectKeys.length > 0) {
                jql += ` AND project IN (${params.projectKeys.join(',')})`;
            }
            debugLog('JQL Query:', jql);
            debugLog('Cloud ID:', params.cloudId);
            debugLog('Users to search:', params.users);
            const issues = await jiraApi.searchIssues(jql, 1000, false, 0);
            debugLog(`Total issues found: ${issues?.total || 0}`);
            // Process data for each user - optimized for performance
            const userAnalytics = params.users.map(userId => {
                const userIssues = issues?.issues?.filter((issue) => {
                    const assignee = issue.fields?.assignee;
                    if (!assignee)
                        return false;
                    return assignee.accountId === userId ||
                        assignee.displayName === userId ||
                        assignee.emailAddress === userId;
                }) || [];
                //skip the user from listing if not found in the issues
                if (userIssues.length === 0) {
                    return null;
                }
                const completedIssues = userIssues.filter((i) => i.fields?.status?.statusCategory?.key === 'done');
                const inProgressIssues = userIssues.filter((i) => i.fields?.status?.statusCategory?.key === 'indeterminate');
                const storyPointsCompleted = completedIssues.reduce((sum, issue) => sum + (issue.fields?.customfield_10016 || 0), 0);
                // Calculate essential metrics only
                const completionRate = userIssues.length > 0 ? (completedIssues.length / userIssues.length * 100) : 0;
                const avgResolutionTime = calculateAvgResolutionTime(completedIssues);
                // Ignore the userInfo if not found 
                const userInfo = userIssues[0]?.fields?.assignee;
                return {
                    userId,
                    userInfo: {
                        accountId: userInfo.accountId,
                        displayName: userInfo.displayName,
                        email: userInfo.emailAddress || null
                    },
                    metrics: {
                        totalIssues: userIssues.length,
                        completedIssues: completedIssues.length,
                        inProgressIssues: inProgressIssues.length,
                        completionRate: Math.round(completionRate * 100) / 100,
                        storyPointsCompleted,
                        avgResolutionTime
                    },
                    correlationData: params.includeCorrelation ? {
                        jiraAccountId: userInfo.accountId,
                        jiraDisplayName: userInfo.displayName,
                        jiraEmail: userInfo.emailAddress || null,
                        projectKeys: [...new Set(userIssues.map((i) => i.fields?.project?.key).filter(Boolean))]
                    } : null
                };
            });
            // Generate essential team summary
            const teamSummary = {
                totalUsers: userAnalytics.length,
                totalIssues: userAnalytics.reduce((sum, user) => sum + (user?.metrics?.totalIssues || 0), 0),
                totalCompleted: userAnalytics.reduce((sum, user) => sum + (user?.metrics?.completedIssues || 0), 0),
                totalStoryPoints: userAnalytics.reduce((sum, user) => sum + (user?.metrics?.storyPointsCompleted || 0), 0),
                avgCompletionRate: userAnalytics.length > 0 ? userAnalytics.reduce((sum, user) => sum + (user?.metrics?.completionRate || 0), 0) / userAnalytics.length : 0,
            };
            const result = {
                summary: teamSummary,
                users: userAnalytics,
                metadata: {
                    cached: false,
                    generatedAt: new Date().toISOString(),
                    totalIssuesFound: issues?.total || 0,
                    usersAnalyzed: params.users.length
                }
            };
            setCache(cacheKey, result);
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify(result, null, 2)
                    }],
            };
        }
        catch (error) {
            const errorMessage = (0, auth_1.extractErrorMessage)(error);
            return {
                content: [{
                        type: "text",
                        text: `Error in bulk user productivity analysis: ${errorMessage}`
                    }],
            };
        }
    }
};
exports.bulkProjectProductivityTool = {
    name: "jira_bulk_project_analytics",
    description: "Get comprehensive productivity analytics for  multiple projects by projectKey in one call. Ideal for team performance analysis, ranking, and cross-platform correlation.",
    parameters: {
        startDate: zod_1.z.string().describe("Start date in YYYY-MM-DD format"),
        endDate: zod_1.z.string().describe("End date in YYYY-MM-DD format"),
        includeCorrelation: zod_1.z.boolean().optional().default(true).describe("Include correlation data for cross-platform analysis"),
        projectKeys: zod_1.z.array(zod_1.z.string()).describe("array of project keys to filter by"),
        aggregateBy: zod_1.z.enum(['user', 'project', 'sprint']).optional().default('project').describe("How to aggregate the results"),
        cloudId: zod_1.z.string().describe("valid jira cloud id."),
    },
    handler: async (params) => {
        try {
            const cacheKey = getCacheKey('bulk_project_productivity', params);
            if (isValidCache(cacheKey)) {
                const cachedResult = getCache(cacheKey);
                // Mark as cached result
                cachedResult.metadata.cached = true;
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify(cachedResult, null, 2)
                        }],
                };
            }
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            // Build JQL query for all users
            let jql = `created >= "${params.startDate}" AND created <= "${params.endDate}"`;
            if (params.projectKeys && params.projectKeys.length > 0) {
                jql += ` AND project IN (${params.projectKeys.join(',')})`;
            }
            debugLog('JQL Query:', jql);
            debugLog('Cloud ID:', params.cloudId);
            debugLog('Users to search:', params.users);
            const issues = await jiraApi.searchIssues(jql, 1000, true, 0);
            debugLog(`Total issues found: ${issues?.total || 0}`);
            debugLog("issues", issues?.issues);
            // Filter the issues by projectKeys
            // Filter the issues by projectKeys and return the issue counts and assignee information 
            const projectAnalytics = params.projectKeys?.map((projectKey) => {
                const projectIssues = issues?.issues?.filter((issue) => issue.fields?.project?.key === projectKey);
                // skip the project if not found in the issues
                if (projectIssues.length === 0) {
                    return null;
                }
                // remove 
                // Extract only essential issue information
                const essentialIssues = projectIssues.map((issue) => ({
                    id: issue.id,
                    key: issue.key,
                    summary: issue.fields?.summary,
                    status: issue.fields?.status?.name,
                    assignee: issue.fields?.assignee?.displayName || 'Unassigned',
                    created: issue.fields?.created,
                    updated: issue.fields?.updated
                }));
                return {
                    projectKey,
                    projectName: projectIssues[0]?.fields?.project?.name,
                    issueCount: projectIssues?.length || 0,
                    issues: essentialIssues
                };
            });
            debugLog("projectAnalytics", projectAnalytics);
            setCache(cacheKey, projectAnalytics);
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify(projectAnalytics, null, 2)
                    }],
            };
        }
        catch (error) {
            const errorMessage = (0, auth_1.extractErrorMessage)(error);
            return {
                content: [{
                        type: "text",
                        text: `Error in bulk user productivity analysis: ${errorMessage}`
                    }],
            };
        }
    }
};
// // Team performance with correlation
// export const teamPerformanceCorrelationTool = {
//     name: "jira_team_performance_correlation",
//     description: "OPTIMIZED: Enhanced team productivity analysis with cross-platform correlation data. Best for complex team analytics and performance comparisons.",
//     parameters: {
//         teamMembers: z.array(z.string()).describe("Array of team member usernames, account IDs, or email addresses"),
//         startDate: z.string().describe("Start date in YYYY-MM-DD format"),
//         endDate: z.string().describe("End date in YYYY-MM-DD format"),
//         projectKeys: z.array(z.string()).optional().describe("Optional array of project keys to filter by"),
//         includeVelocity: z.boolean().optional().default(true).describe("Include velocity calculations"),
//         includeQuality: z.boolean().optional().default(true).describe("Include quality metrics")
//     },
//     handler: async (params: {
//         teamMembers: string[];
//         startDate: string;
//         endDate: string;
//         projectKeys?: string[];
//         includeVelocity?: boolean;
//         includeQuality?: boolean;
//     }) => {
//         try {
//             const cacheKey = getCacheKey('team_performance_correlation', params);
//             if (isValidCache(cacheKey)) {
//                 return {
//                     content: [{
//                         type: "text" as const,
//                         text: JSON.stringify(getCache(cacheKey), null, 2)
//                     }],
//                 };
//             }
//             const jiraApi = await createAuthenticatedJiraService();
//             // Build comprehensive JQL query
//             const memberList = params.teamMembers.map(m => `"${m}"`).join(',');
//             let jql = `assignee IN (${memberList}) AND created >= "${params.startDate}" AND created <= "${params.endDate}"`;
//             if (params.projectKeys && params.projectKeys.length > 0) {
//                 jql += ` AND project IN (${params.projectKeys.join(',')})`;
//             }
//             const issues = await jiraApi.searchIssues(jql, 1000, false, 0);
//             // Team-level analytics
//             const teamMetrics = {
//                 totalIssues: issues.total,
//                 completedIssues: issues.issues.filter((i: any) => i.fields?.status?.statusCategory?.key === 'done').length,
//                 inProgressIssues: issues.issues.filter((i: any) => i.fields?.status?.statusCategory?.key === 'indeterminate').length,
//                 totalStoryPoints: issues.issues.reduce((sum: any, issue: any) => sum + (issue.fields?.customfield_10016 || 0), 0),
//                 completedStoryPoints: issues.issues
//                     .filter((i: any) => i.fields?.status?.statusCategory?.key === 'done')
//                     .reduce((sum: any, issue: any) => sum + (issue.fields?.customfield_10016 || 0), 0),
//                 avgResolutionTime: calculateAvgResolutionTime(issues.issues.filter((i: any) => i.fields?.status?.statusCategory?.key === 'done')),
//                 issuesByStatus: groupByStatus(issues.issues),
//                 issuesByPriority: groupByPriority(issues.issues),
//                 issuesByType: groupByType(issues.issues)
//             };
//             // Individual member analytics
//             const memberAnalytics = params.teamMembers.map(member => {
//                 const memberIssues = issues.issues.filter((issue: any) => 
//                     issue.assignee?.accountId === member || 
//                     issue.assignee?.displayName === member ||
//                     issue.assignee?.emailAddress === member
//                 );
//                 const memberCompleted = memberIssues.filter((i: any) => i.fields?.status?.statusCategory?.key === 'done');
//                 const memberInfo = memberIssues[0]?.assignee || { accountId: member, displayName: member };
//                 return {
//                     member,
//                     memberInfo: {
//                         accountId: memberInfo.accountId,
//                         displayName: memberInfo.displayName,
//                         email: memberInfo.emailAddress || null
//                     },
//                     metrics: {
//                         totalIssues: memberIssues.length,
//                         completedIssues: memberCompleted.length,
//                         completionRate: memberIssues.length > 0 ? (memberCompleted.length / memberIssues.length * 100) : 0,
//                         storyPointsCompleted: memberCompleted.reduce((sum: any, issue: any) => sum + (issue.fields?.customfield_10016 || 0), 0),
//                         avgResolutionTime: calculateAvgResolutionTime(memberCompleted),
//                         productivityScore: calculateProductivityScore(memberIssues)
//                     },
//                     correlationData: {
//                         jiraAccountId: memberInfo.accountId,
//                         jiraDisplayName: memberInfo.displayName,
//                         jiraEmail: memberInfo.emailAddress || null,
//                         clockifyCorrelationKey: (memberInfo.emailAddress || memberInfo.displayName || member).toLowerCase().replace(/\s+/g, '.'),
//                         projectKeys: [...new Set(memberIssues.map((i: any) => i.fields?.project?.key).filter(Boolean))]
//                     }
//                 };
//             });
//             // Project mappings for correlation
//             const projectMappings:any = {};
//             issues.issues.forEach((issue: any) => {
//                 const project = issue.fields?.project;
//                 if (project) {
//                     projectMappings[project.key] = projectMappings[project.key] || {
//                         jiraProjectKey: project.key,
//                         jiraProjectId: project.id,
//                         jiraProjectName: project.name,
//                         clockifyProjectId: null, // To be populated by external correlation
//                         clockifyCorrelationKey: project.name.toLowerCase().replace(/\s+/g, '_')
//                     };
//                 }
//             });
//             // User mappings for correlation
//             const userMappings:any = {};
//             memberAnalytics.forEach(member => {
//                 if (member.memberInfo.accountId) {
//                     userMappings[member.memberInfo.accountId as string] = {
//                         jiraAccountId: member.memberInfo.accountId,
//                         displayName: member.memberInfo.displayName,
//                         email: member.memberInfo.email,
//                         clockifyUserId: null, // To be populated by external correlation
//                         clockifyCorrelationKey: member.correlationData.clockifyCorrelationKey,
//                         confidence: member.memberInfo.email ? 1.0 : 0.7
//                     };
//                 }
//             });
//             // Performance ranking
//             const performanceRanking = memberAnalytics
//                 .sort((a, b) => b.metrics.productivityScore - a.metrics.productivityScore)
//                 .map((member, index) => ({
//                     rank: index + 1,
//                     member: member.member,
//                     displayName: member.memberInfo.displayName,
//                     email: member.memberInfo.email,
//                     productivityScore: member.metrics.productivityScore,
//                     completionRate: member.metrics.completionRate,
//                     storyPointsCompleted: member.metrics.storyPointsCompleted
//                 }));
//             // Generate insights
//             const insights = generateTeamInsights(teamMetrics, memberAnalytics);
//             const result = {
//                 teamMetrics,
//                 memberAnalytics,
//                 performanceRanking,
//                 correlation: {
//                     userMappings,
//                     projectMappings,
//                     crossPlatformKeys: {
//                         users: Object.values(userMappings).map((u: any) => u.clockifyCorrelationKey),
//                         projects: Object.values(projectMappings).map((p: any) => p.clockifyCorrelationKey)
//                     }
//                 },
//                 insights,
//                 metadata: {
//                     teamSize: params.teamMembers.length,
//                     timeframe: { startDate: params.startDate, endDate: params.endDate },
//                     projectsAnalyzed: params.projectKeys || 'all',
//                     totalIssuesAnalyzed: issues.total,
//                     generatedAt: new Date().toISOString()
//                 }
//             };
//             setCache(cacheKey, result);
//             return {
//                 content: [{
//                     type: "text" as const,
//                     text: JSON.stringify(result, null, 2)
//                 }],
//             };
//         } catch (error) {
//             const errorMessage = extractErrorMessage(error);
//             return {
//                 content: [{
//                     type: "text" as const,
//                     text: `Error in team performance correlation analysis: ${errorMessage}`
//                 }],
//             };
//         }
//     }
// };
// // Multi-user workload analysis
// export const multiUserWorkloadTool = {
//     name: "jira_multi_user_workload",
//     description: "OPTIMIZED: Analyze workload distribution across multiple users simultaneously with comparative metrics and capacity planning insights.",
//     parameters: {
//         userIds: z.array(z.string()).describe("Array of user IDs, usernames, or email addresses"),
//         startDate: z.string().describe("Start date in YYYY-MM-DD format"),
//         endDate: z.string().describe("End date in YYYY-MM-DD format"),
//         includeCapacity: z.boolean().optional().default(true).describe("Include capacity planning metrics"),
//         workloadThreshold: z.number().optional().default(10).describe("Threshold for identifying overloaded users")
//     },
//     handler: async (params: {
//         userIds: string[];
//         startDate: string;
//         endDate: string;
//         includeCapacity?: boolean;
//         workloadThreshold?: number;
//     }) => {
//         try {
//             const cacheKey = getCacheKey('multi_user_workload', params);
//             if (isValidCache(cacheKey)) {
//                 return {
//                     content: [{
//                         type: "text" as const,
//                         text: JSON.stringify(getCache(cacheKey), null, 2)
//                     }],
//                 };
//             }
//             const jiraApi = await createAuthenticatedJiraService();
//             const userList = params.userIds.map(id => `"${id}"`).join(',');
//             const jql = `assignee IN (${userList}) AND created >= "${params.startDate}" AND created <= "${params.endDate}"`;
//             const issues = await jiraApi.searchIssues(jql, 1000, false, 0);
//             const userWorkloads = params.userIds.map(userId => {
//                 const userIssues = issues.issues.filter((issue: any) => 
//                     issue.assignee?.accountId === userId || 
//                     issue.assignee?.displayName === userId ||
//                     issue.assignee?.emailAddress === userId
//                 );
//                 const userInfo = userIssues[0]?.fields?.assignee || { accountId: userId, displayName: userId };
//                 const completed = userIssues.filter((i: any) => i.fields?.status?.statusCategory?.key === 'done');
//                 const inProgress = userIssues.filter((i: any) => i.fields?.status?.statusCategory?.key === 'indeterminate');
//                 const open = userIssues.filter((i: any) => i.fields?.status?.statusCategory?.key === 'new');
//                 // Calculate workload metrics
//                 const workloadScore = calculateWorkloadScore(userIssues);
//                 const isOverloaded = userIssues.length > (params.workloadThreshold || 10);
//                 return {
//                     userId,
//                     userInfo: {
//                         accountId: userInfo.accountId,
//                         displayName: userInfo.displayName,
//                         email: userInfo.emailAddress || null
//                     },
//                     workload: {
//                         totalAssigned: userIssues.length,
//                         completed: completed.length,
//                         inProgress: inProgress.length,
//                         open: open.length,
//                         workloadScore,
//                         isOverloaded,
//                         capacityUtilization: Math.min(100, (userIssues.length / (params.workloadThreshold || 10)) * 100)
//                     },
//                     performance: {
//                         completionRate: userIssues.length > 0 ? (completed.length / userIssues.length * 100) : 0,
//                         avgResolutionTime: calculateAvgResolutionTime(completed),
//                         storyPointsCompleted: completed.reduce((sum: any, issue: any) => sum + (issue.fields?.customfield_10016 || 0), 0),
//                         priorityDistribution: groupByPriority(userIssues)
//                     },
//                     riskFactors: identifyRiskFactors(userIssues)
//                 };
//             });
//             // Team workload summary
//             const teamWorkloadSummary = {
//                 totalUsers: userWorkloads.length,
//                 totalIssues: userWorkloads.reduce((sum, user) => sum + user.workload.totalAssigned, 0),
//                 overloadedUsers: userWorkloads.filter(user => user.workload.isOverloaded).length,
//                 avgWorkloadScore: userWorkloads.reduce((sum, user) => sum + user.workload.workloadScore, 0) / userWorkloads.length,
//                 capacityDistribution: {
//                     underutilized: userWorkloads.filter(user => user.workload.capacityUtilization < 50).length,
//                     optimal: userWorkloads.filter(user => user.workload.capacityUtilization >= 50 && user.workload.capacityUtilization <= 80).length,
//                     overutilized: userWorkloads.filter(user => user.workload.capacityUtilization > 80).length
//                 },
//                 recommendations: generateWorkloadRecommendations(userWorkloads)
//             };
//             // Sort by workload score (highest first)
//             const sortedWorkloads = userWorkloads.sort((a, b) => b.workload.workloadScore - a.workload.workloadScore);
//             const result = {
//                 teamWorkloadSummary,
//                 userWorkloads: sortedWorkloads,
//                 capacityPlanning: params.includeCapacity ? {
//                     workloadDistribution: calculateWorkloadDistribution(userWorkloads),
//                     rebalancingOpportunities: identifyRebalancingOpportunities(userWorkloads),
//                     capacityGaps: identifyCapacityGaps(userWorkloads)
//                 } : null,
//                 metadata: {
//                     analysisDate: new Date().toISOString(),
//                     timeframe: { startDate: params.startDate, endDate: params.endDate },
//                     workloadThreshold: params.workloadThreshold,
//                     totalIssuesAnalyzed: issues.total
//                 }
//             };
//             setCache(cacheKey, result);
//             return {
//                 content: [{
//                     type: "text" as const,
//                     text: JSON.stringify(result, null, 2)
//                 }],
//             };
//         } catch (error) {
//             const errorMessage = extractErrorMessage(error);
//             return {
//                 content: [{
//                     type: "text" as const,
//                     text: `Error in multi-user workload analysis: ${errorMessage}`
//                 }],
//             };
//         }
//     }
// };
// // Project user contributions analysis
// export const projectUserContributionsTool = {
//     name: "jira_project_user_contributions",
//     description: "OPTIMIZED: Analyze user contributions within specific projects with detailed breakdown of work types, completion rates, and project health metrics.",
//     parameters: {
//         projectKey: z.string().describe("Project key to analyze"),
//         startDate: z.string().describe("Start date in YYYY-MM-DD format"),
//         endDate: z.string().describe("End date in YYYY-MM-DD format"),
//         includeHealthMetrics: z.boolean().optional().default(true).describe("Include project health metrics"),
//         minContributions: z.number().optional().default(1).describe("Minimum number of contributions to include user")
//     },
//     handler: async (params: {
//         projectKey: string;
//         startDate: string;
//         endDate: string;
//         includeHealthMetrics?: boolean;
//         minContributions?: number;
//     }) => {
//         try {
//             const cacheKey = getCacheKey('project_user_contributions', params);
//             if (isValidCache(cacheKey)) {
//                 return {
//                     content: [{
//                         type: "text" as const,
//                         text: JSON.stringify(getCache(cacheKey), null, 2)
//                     }],
//                 };
//             }
//             const jiraApi = await createAuthenticatedJiraService();
//             const jql = `project = "${params.projectKey}" AND created >= "${params.startDate}" AND created <= "${params.endDate}"`;
//             const issues = await jiraApi.searchIssues(jql, 1000, false, 0);
//             // Group issues by assignee
//             const contributorMap = new Map();
//             issues.issues.forEach((issue: any) => {
//                 const assignee = issue.assignee;
//                 if (assignee) {
//                     const key = assignee.accountId || assignee.displayName;
//                     if (!contributorMap.has(key)) {
//                         contributorMap.set(key, {
//                             userInfo: assignee,
//                             issues: []
//                         });
//                     }
//                     contributorMap.get(key).issues.push(issue);
//                 }
//             });
//             // Analyze contributions for each user
//             const userContributions = Array.from(contributorMap.entries())
//                 .filter(([_, data]) => data.issues.length >= (params.minContributions || 1))
//                 .map(([userId, data]) => {
//                     const userIssues = data.issues;
//                     const completed = userIssues.filter((i: any) => i.fields?.status?.statusCategory?.key === 'done');
//                     return {
//                         userId,
//                         userInfo: {
//                             accountId: data.userInfo.accountId,
//                             displayName: data.userInfo.displayName,
//                             email: data.userInfo.emailAddress || null
//                         },
//                         contributions: {
//                             totalIssues: userIssues.length,
//                             completedIssues: completed.length,
//                             completionRate: userIssues.length > 0 ? (completed.length / userIssues.length * 100) : 0,
//                             storyPointsTotal: userIssues.reduce((sum: any, issue: any) => sum + (issue.fields?.customfield_10016 || 0), 0),
//                             storyPointsCompleted: completed.reduce((sum: any, issue: any) => sum + (issue.fields?.customfield_10016 || 0), 0),
//                             issueTypes: groupByType(userIssues),
//                             priorities: groupByPriority(userIssues),
//                             avgResolutionTime: calculateAvgResolutionTime(completed)
//                         },
//                         impact: {
//                             projectContributionPercentage: (userIssues.length / issues.total * 100).toFixed(2),
//                             qualityScore: calculateQualityScore(userIssues),
//                             velocityScore: calculateVelocityScore(userIssues, params.startDate, params.endDate)
//                         }
//                     };
//                 });
//             // Project-level metrics
//             const projectMetrics = {
//                 projectKey: params.projectKey,
//                 totalIssues: issues.total,
//                 totalContributors: userContributions.length,
//                 completionRate: issues.total > 0 ? (issues.issues.filter((i: any) => i.fields?.status?.statusCategory?.key === 'done').length / issues.total * 100) : 0,
//                 totalStoryPoints: issues.issues.reduce((sum: any, issue: any) => sum + (issue.fields?.customfield_10016 || 0), 0),
//                 avgResolutionTime: calculateAvgResolutionTime(issues.issues.filter((i: any) => i.fields?.status?.statusCategory?.key === 'done')),
//                 issueDistribution: {
//                     byType: groupByType(issues.issues),
//                     byPriority: groupByPriority(issues.issues),
//                     byStatus: groupByStatus(issues.issues)
//                 }
//             };
//             // Health metrics
//             const healthMetrics = params.includeHealthMetrics ? {
//                 projectHealth: calculateProjectHealth(issues.issues),
//                 riskFactors: identifyProjectRiskFactors(issues.issues),
//                 contributorBalance: calculateContributorBalance(userContributions),
//                 recommendations: generateProjectRecommendations(userContributions, projectMetrics)
//             } : null;
//             // Sort contributors by impact
//             const sortedContributors = userContributions.sort((a, b) => 
//                 b.impact.velocityScore - a.impact.velocityScore
//             );
//             const result = {
//                 projectMetrics,
//                 userContributions: sortedContributors,
//                 healthMetrics,
//                 topContributors: sortedContributors.slice(0, 5),
//                 contributionSummary: {
//                     mostActive: sortedContributors[0],
//                     mostEfficient: userContributions.reduce((best, current) => 
//                         current.contributions.completionRate > best.contributions.completionRate ? current : best
//                     ),
//                     totalUniqueContributors: userContributions.length,
//                     avgContributionsPerUser: userContributions.reduce((sum, user) => sum + user.contributions.totalIssues, 0) / userContributions.length
//                 },
//                 metadata: {
//                     projectKey: params.projectKey,
//                     timeframe: { startDate: params.startDate, endDate: params.endDate },
//                     minContributions: params.minContributions,
//                     analysisDate: new Date().toISOString()
//                 }
//             };
//             setCache(cacheKey, result);
//             return {
//                 content: [{
//                     type: "text" as const,
//                     text: JSON.stringify(result, null, 2)
//                 }],
//             };
//         } catch (error) {
//             const errorMessage = extractErrorMessage(error);
//             return {
//                 content: [{
//                     type: "text" as const,
//                     text: `Error in project user contributions analysis: ${errorMessage}`
//                 }],
//             };
//         }
//     }
// };
// // Project-level comprehensive analytics
// export const projectLevelAnalyticsTool = {
//     name: "jira_project_level_analytics",
//     description: "OPTIMIZED: Get comprehensive project-level analytics including completion rates, team performance, velocity, health metrics, and risk analysis. Perfect for project management and strategic planning.",
//     parameters: {
//         projectKeys: z.array(z.string()).describe("Array of project keys to analyze"),
//         startDate: z.string().describe("Start date in YYYY-MM-DD format"),
//         endDate: z.string().describe("End date in YYYY-MM-DD format"),
//         includeTeamBreakdown: z.boolean().optional().default(true).describe("Include team performance breakdown per project"),
//         includeVelocityTrends: z.boolean().optional().default(true).describe("Include velocity trends and sprint analytics"),
//         includeHealthMetrics: z.boolean().optional().default(true).describe("Include project health and risk assessments"),
//         includeCorrelation: z.boolean().optional().default(true).describe("Include correlation data for cross-platform analysis")
//     },
//     handler: async (params: {
//         projectKeys: string[];
//         startDate: string;
//         endDate: string;
//         includeTeamBreakdown?: boolean;
//         includeVelocityTrends?: boolean;
//         includeHealthMetrics?: boolean;
//         includeCorrelation?: boolean;
//     }) => {
//         try {
//             const cacheKey = getCacheKey('project_level_analytics', params);
//             if (isValidCache(cacheKey)) {
//                 return {
//                     success: true,
//                     data: getCache(cacheKey),
//                     source: 'cache'
//                 };
//             }
//             const jiraService = await createAuthenticatedJiraService();
//             const projectAnalytics: any = {};
//             const overallSummary: any = {};
//             // Process each project
//             for (const projectKey of params.projectKeys) {
//                 try {
//                     // Get project details
//                     const projectInfo = await jiraService.getProject({ projectIdOrKey: projectKey });
//                     // Get project issues with comprehensive data
//                     const issuesResponse = await jiraService.searchIssues({
//                         jql: `project = ${projectKey} AND (created >= "${params.startDate}" OR updated >= "${params.startDate}") AND (created <= "${params.endDate}" OR updated <= "${params.endDate}")`,
//                         maxResults: 10000,
//                         fields: [
//                             'summary', 'status', 'priority', 'assignee', 'reporter',
//                             'created', 'updated', 'resolved', 'resolutiondate',
//                             'timetracking', 'worklog', 'components', 'labels',
//                             'issuetype', 'customfield_10016', 'customfield_10020',
//                             'customfield_10021', 'customfield_10026', 'fixVersions',
//                             'versions', 'progress', 'aggregateprogress', 'duedate'
//                         ]
//                     });
//                     const issues = issuesResponse.issues || [];
//                     // Calculate project metrics
//                     const projectMetrics = {
//                         projectKey,
//                         projectName: projectInfo.name || projectKey,
//                         projectLead: projectInfo.lead?.displayName || 'Unknown',
//                         totalIssues: issues.length,
//                         completionRate: calculateProjectCompletionRate(issues),
//                         avgResolutionTime: calculateAvgResolutionTime(issues),
//                         velocityScore: calculateVelocityScore(issues, params.startDate, params.endDate),
//                         healthScore: calculateProjectHealth(issues),
//                         riskFactors: identifyProjectRiskFactors(issues),
//                         issueBreakdown: {
//                             byStatus: groupByStatus(issues),
//                             byPriority: groupByPriority(issues),
//                             byType: groupByType(issues),
//                             byAssignee: groupByAssignee(issues)
//                         }
//                     };
//                     // // Team performance breakdown
//                     // if (params.includeTeamBreakdown) {
//                     //     projectMetrics.teamPerformance = await calculateTeamPerformanceForProject(issues, jiraService);
//                     // }
//                     // // Velocity trends
//                     // if (params.includeVelocityTrends) {
//                     //     // projectMetrics.velocityTrends = calculateVelocityTrends(issues, params.startDate, params.endDate);
//                     //     // projectMetrics.velocityTrends = calculateVelocityTrends(issues, params.startDate, params.endDate);
//                     // }
//                     // // Health metrics
//                     // if (params.includeHealthMetrics) {
//                     //     // projectMetrics.healthMetrics = calculateDetailedHealthMetrics(issues);
//                     // }
//                     // // Correlation data
//                     // if (params.includeCorrelation) {
//                     //     // projectMetrics.correlationData = {
//                     //         projectKey,
//                     //         projectName: projectInfo.name || projectKey,
//                     //         teamMembers: [...new Set(issues.map((issue: any) => issue.fields.assignee?.emailAddress || issue.fields.assignee?.displayName).filter(Boolean))],
//                     //         estimatedEffort: calculateEstimatedEffort(issues),
//                     //         actualEffort: calculateActualEffort(issues),
//                     //         components: [...new Set(issues.flatMap((issue: any) => issue.fields.components?.map((c: any) => c.name) || []))],
//                     //         labels: [...new Set(issues.flatMap((issue: any)      => issue.fields.labels || []))]
//                     //     // };
//                     // }
//                     projectAnalytics[projectKey] = projectMetrics;
//                 } catch (error) {
//                     console.error(`Error processing project ${projectKey}:`, error);
//                     projectAnalytics[projectKey] = {
//                         projectKey,
//                         error: extractErrorMessage(error),
//                         status: 'failed'
//                     };
//                 }
//             }
//             // Calculate overall summary
//             const validProjects = Object.values(projectAnalytics).filter((p: any) => !p.error);
//             overallSummary.totalProjects = params.projectKeys.length;
//             overallSummary.successfulProjects = validProjects.length;
//             overallSummary.avgCompletionRate = validProjects.reduce((sum: number, p: any) => sum + p.completionRate, 0) / validProjects.length;
//             overallSummary.avgHealthScore = validProjects.reduce((sum: number, p: any) => sum + p.healthScore, 0) / validProjects.length;
//             overallSummary.topPerformingProject = validProjects.reduce((best: any, current: any) => 
//                 (!best || current.healthScore > best.healthScore) ? current : best, null);
//             overallSummary.insights = generateProjectPortfolioInsights(validProjects);
//             overallSummary.recommendations = generateProjectPortfolioRecommendations(validProjects);
//             const result = {
//                 summary: overallSummary,
//                 projectAnalytics,
//                 metadata: {
//                     analysisDate: new Date().toISOString(),
//                     dateRange: { start: params.startDate, end: params.endDate },
//                     projectCount: params.projectKeys.length,
//                     cacheStatus: 'fresh'
//                 }
//             };
//             setCache(cacheKey, result);
//             return {
//                 success: true,
//                 data: result
//             };
//         } catch (error) {
//             console.error('Error in project level analytics:', error);
//             return {
//                 success: false,
//                 error: extractErrorMessage(error)
//             };
//         }
//     }
// };
// Utility functions
function calculateAvgResolutionTime(issues) {
    const resolvedIssues = issues.filter(i => i.fields?.resolutiondate);
    if (resolvedIssues.length === 0)
        return 0;
    const totalTime = resolvedIssues.reduce((sum, issue) => {
        const created = new Date(issue.fields.created);
        const resolved = new Date(issue.fields.resolutiondate);
        return sum + (resolved.getTime() - created.getTime());
    }, 0);
    return Math.round(totalTime / resolvedIssues.length / (1000 * 60 * 60 * 24)); // Days
}
function calculateWorkloadScore(issues) {
    const inProgress = issues.filter(i => i.fields?.status?.statusCategory?.key === 'indeterminate');
    const open = issues.filter(i => i.fields?.status?.statusCategory?.key === 'new');
    const highPriority = issues.filter(i => i.fields?.priority?.name?.toLowerCase().includes('high') ||
        i.fields?.priority?.name?.toLowerCase().includes('critical'));
    return inProgress.length * 2 + open.length + highPriority.length * 1.5;
}
function identifyRiskFactors(issues) {
    const risks = [];
    const overdue = issues.filter(i => {
        const dueDate = i.fields?.duedate;
        return dueDate && new Date(dueDate) < new Date() && i.fields?.status?.statusCategory?.key !== 'done';
    });
    const highPriorityOpen = issues.filter(i => (i.fields?.priority?.name?.toLowerCase().includes('high') ||
        i.fields?.priority?.name?.toLowerCase().includes('critical')) &&
        i.fields?.status?.statusCategory?.key !== 'done');
    const longRunning = issues.filter(i => {
        const created = new Date(i.fields?.created);
        const now = new Date();
        const days = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        return days > 30 && i.fields?.status?.statusCategory?.key !== 'done';
    });
    if (overdue.length > 0)
        risks.push(`${overdue.length} overdue issues`);
    if (highPriorityOpen.length > 0)
        risks.push(`${highPriorityOpen.length} high priority issues open`);
    if (longRunning.length > 0)
        risks.push(`${longRunning.length} issues running longer than 30 days`);
    return risks;
}
function generateTeamInsights(teamMetrics, memberAnalytics) {
    const insights = [];
    const avgCompletionRate = memberAnalytics.reduce((sum, member) => sum + member.metrics.completionRate, 0) / memberAnalytics.length;
    const topPerformer = memberAnalytics.reduce((best, current) => current.metrics.completionRate > best.metrics.completionRate ? current : best);
    insights.push(`Team average completion rate: ${avgCompletionRate.toFixed(1)}%`);
    insights.push(`Top performer: ${topPerformer.memberInfo.displayName} (${topPerformer.metrics.completionRate} completion rate)`);
    if (teamMetrics.completedStoryPoints > 0) {
        insights.push(`Team completed ${teamMetrics.completedStoryPoints} story points`);
    }
    const lowPerformers = memberAnalytics.filter(member => member.metrics.completionRate < avgCompletionRate * 0.7);
    if (lowPerformers.length > 0) {
        insights.push(`${lowPerformers.length} team members below 70% of average completion rate`);
    }
    return insights;
}
function generateWorkloadRecommendations(userWorkloads) {
    const recommendations = [];
    const overloaded = userWorkloads.filter(user => user.workload.isOverloaded);
    const underutilized = userWorkloads.filter(user => user.workload.capacityUtilization < 50);
    if (overloaded.length > 0) {
        recommendations.push(`Consider redistributing work from ${overloaded.length} overloaded team members`);
    }
    if (underutilized.length > 0) {
        recommendations.push(`${underutilized.length} team members have capacity for additional work`);
    }
    if (overloaded.length > 0 && underutilized.length > 0) {
        recommendations.push('Balance workload by moving tasks from overloaded to underutilized team members');
    }
    return recommendations;
}
function calculateWorkloadDistribution(userWorkloads) {
    const distribution = {
        light: userWorkloads.filter(user => user.workload.capacityUtilization < 50).length,
        moderate: userWorkloads.filter(user => user.workload.capacityUtilization >= 50 && user.workload.capacityUtilization <= 80).length,
        heavy: userWorkloads.filter(user => user.workload.capacityUtilization > 80).length
    };
    return {
        ...distribution,
        total: userWorkloads.length,
        percentages: {
            light: (distribution.light / userWorkloads.length * 100).toFixed(1),
            moderate: (distribution.moderate / userWorkloads.length * 100).toFixed(1),
            heavy: (distribution.heavy / userWorkloads.length * 100).toFixed(1)
        }
    };
}
function identifyRebalancingOpportunities(userWorkloads) {
    const overloaded = userWorkloads.filter(user => user.workload.isOverloaded);
    const underutilized = userWorkloads.filter(user => user.workload.capacityUtilization < 50);
    return overloaded.map(overUser => {
        const bestTarget = underutilized.reduce((best, current) => current.workload.capacityUtilization < best.workload.capacityUtilization ? current : best);
        return {
            from: overUser.userInfo.displayName,
            to: bestTarget?.userInfo.displayName,
            suggestedTransfer: Math.min(3, overUser.workload.open), // Suggest transferring up to 3 open issues
            reason: `${overUser.userInfo.displayName} is ${overUser.workload.capacityUtilization.toFixed(0)}% utilized, ${bestTarget?.userInfo.displayName} is ${bestTarget?.workload.capacityUtilization.toFixed(0)}% utilized`
        };
    });
}
function identifyCapacityGaps(userWorkloads) {
    const totalCapacity = userWorkloads.length * 10; // Assuming 10 is the ideal workload per user
    const currentLoad = userWorkloads.reduce((sum, user) => sum + user.workload.totalAssigned, 0);
    return {
        totalCapacity,
        currentLoad,
        utilizationRate: (currentLoad / totalCapacity * 100).toFixed(1),
        availableCapacity: totalCapacity - currentLoad,
        recommendation: currentLoad > totalCapacity * 0.8 ? 'Consider adding team members' : 'Current capacity is sufficient'
    };
}
function calculateProjectHealth(issues) {
    const completed = issues.filter(i => i.fields?.status?.statusCategory?.key === 'done');
    const overdue = issues.filter(i => {
        const dueDate = i.fields?.duedate;
        return dueDate && new Date(dueDate) < new Date() && i.fields?.status?.statusCategory?.key !== 'done';
    });
    const completionRate = issues.length > 0 ? completed.length / issues.length : 0;
    const overdueRate = issues.length > 0 ? overdue.length / issues.length : 0;
    return Math.round(Math.max(0, (completionRate * 100 - overdueRate * 50)) * 100) / 100;
}
function identifyProjectRiskFactors(issues) {
    const risks = [];
    const overdue = issues.filter(i => {
        const dueDate = i.fields?.duedate;
        return dueDate && new Date(dueDate) < new Date() && i.fields?.status?.statusCategory?.key !== 'done';
    });
    const highPriorityOpen = issues.filter(i => (i.fields?.priority?.name?.toLowerCase().includes('high') ||
        i.fields?.priority?.name?.toLowerCase().includes('critical')) &&
        i.fields?.status?.statusCategory?.key !== 'done');
    const unassigned = issues.filter(i => !i.assignee);
    if (overdue.length > 0)
        risks.push(`${overdue.length} overdue issues`);
    if (highPriorityOpen.length > 0)
        risks.push(`${highPriorityOpen.length} high priority issues open`);
    if (unassigned.length > 0)
        risks.push(`${unassigned.length} unassigned issues`);
    return risks;
}
function calculateContributorBalance(userContributions) {
    const contributions = userContributions.map(user => user.contributions.totalIssues);
    const max = Math.max(...contributions);
    const min = Math.min(...contributions);
    const avg = contributions.reduce((sum, val) => sum + val, 0) / contributions.length;
    return {
        max,
        min,
        avg: Math.round(avg * 100) / 100,
        balance: max > 0 ? (min / max * 100).toFixed(1) : 100,
        isBalanced: (max - min) <= avg * 0.5
    };
}
function generateProjectRecommendations(userContributions, projectMetrics) {
    const recommendations = [];
    const topContributor = userContributions.reduce((best, current) => current.contributions.totalIssues > best.contributions.totalIssues ? current : best);
    const lowContributors = userContributions.filter(user => user.contributions.totalIssues < projectMetrics.totalIssues / userContributions.length * 0.5);
    recommendations.push(`${topContributor.userInfo.displayName} is the top contributor with ${topContributor.contributions.totalIssues} issues`);
    if (lowContributors.length > 0) {
        recommendations.push(`${lowContributors.length} contributors have below-average contribution levels`);
    }
    if (projectMetrics.completionRate < 70) {
        recommendations.push('Project completion rate is below 70% - consider reviewing blockers');
    }
    return recommendations;
}
// Helper functions for project analytics
function calculateProjectCompletionRate(issues) {
    if (issues.length === 0)
        return 0;
    const completedIssues = issues.filter(issue => issue.fields.status?.statusCategory?.key === 'done' ||
        issue.fields.resolution);
    return Math.round((completedIssues.length / issues.length) * 100);
}
function groupByAssignee(issues) {
    const assigneeGroups = {};
    issues.forEach(issue => {
        const assignee = issue.fields.assignee?.displayName || 'Unassigned';
        assigneeGroups[assignee] = (assigneeGroups[assignee] || 0) + 1;
    });
    return assigneeGroups;
}
async function calculateTeamPerformanceForProject(issues, jiraService) {
    const assigneeMetrics = {};
    for (const issue of issues) {
        const assignee = issue.fields.assignee?.displayName || 'Unassigned';
        if (!assigneeMetrics[assignee]) {
            assigneeMetrics[assignee] = {
                assigneeName: assignee,
                assigneeEmail: issue.fields.assignee?.emailAddress || null,
                totalIssues: 0,
                completedIssues: 0,
                avgResolutionTime: 0,
                storyPoints: 0,
                issueTypes: {}
            };
        }
        const metrics = assigneeMetrics[assignee];
        metrics.totalIssues++;
        if (issue.fields.status?.statusCategory?.key === 'done') {
            metrics.completedIssues++;
        }
        // Story points
        const storyPoints = issue.fields.customfield_10016 || issue.fields.customfield_10020 || 0;
        metrics.storyPoints += storyPoints;
        // Issue types
        const issueType = issue.fields.issuetype?.name || 'Unknown';
        metrics.issueTypes[issueType] = (metrics.issueTypes[issueType] || 0) + 1;
    }
    // Calculate completion rates and productivity scores
    Object.values(assigneeMetrics).forEach((metrics) => {
        metrics.completionRate = Math.round((metrics.completedIssues / metrics.totalIssues) * 100);
    });
    return assigneeMetrics;
}
function calculateVelocityTrends(issues, startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const weeklyData = {};
    // Group issues by week
    issues.forEach(issue => {
        const resolvedDate = issue.fields.resolutiondate || issue.fields.updated;
        if (!resolvedDate)
            return;
        const resolved = new Date(resolvedDate);
        if (resolved < start || resolved > end)
            return;
        const weekKey = getWeekKey(resolved);
        if (!weeklyData[weekKey]) {
            weeklyData[weekKey] = {
                week: weekKey,
                issuesCompleted: 0,
                storyPoints: 0,
                avgResolutionTime: 0
            };
        }
        weeklyData[weekKey].issuesCompleted++;
        const storyPoints = issue.fields.customfield_10016 || issue.fields.customfield_10020 || 0;
        weeklyData[weekKey].storyPoints += storyPoints;
    });
    const weeks = Object.values(weeklyData);
    const avgVelocity = weeks.reduce((sum, week) => sum + week.issuesCompleted, 0) / weeks.length;
    return {
        weeklyBreakdown: weeks,
        avgVelocity: Math.round(avgVelocity),
        trend: calculateTrend(weeks.map((w) => w.issuesCompleted)),
        consistency: calculateConsistency(weeks.map((w) => w.issuesCompleted))
    };
}
function calculateDetailedHealthMetrics(issues) {
    const now = new Date();
    const overdueTasks = issues.filter(issue => {
        const dueDate = issue.fields.duedate ? new Date(issue.fields.duedate) : null;
        return dueDate && dueDate < now && issue.fields.status?.statusCategory?.key !== 'done';
    });
    const blockedTasks = issues.filter(issue => issue.fields.status?.name?.toLowerCase().includes('blocked') ||
        issue.fields.labels?.some((label) => label.toLowerCase().includes('blocked')));
    const highPriorityOpen = issues.filter(issue => issue.fields.priority?.name === 'High' &&
        issue.fields.status?.statusCategory?.key !== 'done');
    return {
        overdueTasks: overdueTasks.length,
        blockedTasks: blockedTasks.length,
        highPriorityOpen: highPriorityOpen.length,
        overduePercentage: Math.round((overdueTasks.length / issues.length) * 100),
        blockedPercentage: Math.round((blockedTasks.length / issues.length) * 100),
        criticalIssues: overdueTasks.length + blockedTasks.length + highPriorityOpen.length,
        healthIndicators: {
            onTrack: issues.length - overdueTasks.length - blockedTasks.length,
            needsAttention: blockedTasks.length,
            critical: overdueTasks.length + highPriorityOpen.length
        }
    };
}
function calculateEstimatedEffort(issues) {
    return issues.reduce((total, issue) => {
        const estimate = issue.fields.customfield_10016 || issue.fields.customfield_10020 || 0;
        return total + estimate;
    }, 0);
}
function calculateActualEffort(issues) {
    return issues.reduce((total, issue) => {
        const timeSpent = issue.fields.timetracking?.timeSpentSeconds || 0;
        return total + (timeSpent / 3600); // Convert to hours
    }, 0);
}
function getWeekKey(date) {
    const year = date.getFullYear();
    const week = Math.ceil((date.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
    return `${year}-W${week.toString().padStart(2, '0')}`;
}
function calculateTrend(values) {
    if (values.length < 2)
        return 'stable';
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    const changePercentage = ((secondAvg - firstAvg) / firstAvg) * 100;
    if (changePercentage > 10)
        return 'increasing';
    if (changePercentage < -10)
        return 'decreasing';
    return 'stable';
}
function calculateConsistency(values) {
    if (values.length === 0)
        return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    // Consistency score (0-100, higher is more consistent)
    return Math.max(0, 100 - (stdDev / mean) * 100);
}
function generateProjectPortfolioInsights(projects) {
    const insights = [];
    if (projects.length === 0)
        return insights;
    // Performance insights
    const avgCompletion = projects.reduce((sum, p) => sum + p.completionRate, 0) / projects.length;
    const avgHealth = projects.reduce((sum, p) => sum + p.healthScore, 0) / projects.length;
    insights.push(`Portfolio has ${avgCompletion.toFixed(1)}% average completion rate across ${projects.length} projects`);
    insights.push(`Average project health score is ${avgHealth.toFixed(1)}/100`);
    // Risk insights
    const riskProjects = projects.filter(p => p.healthScore < 60);
    if (riskProjects.length > 0) {
        insights.push(`${riskProjects.length} projects need immediate attention (health score < 60)`);
    }
    // Top performers
    const topProject = projects.reduce((best, current) => current.healthScore > best.healthScore ? current : best);
    insights.push(`Top performing project: ${topProject.projectName} (${topProject.healthScore.toFixed(1)} health score)`);
    return insights;
}
function generateProjectPortfolioRecommendations(projects) {
    const recommendations = [];
    if (projects.length === 0)
        return recommendations;
    // Health-based recommendations
    const unhealthyProjects = projects.filter(p => p.healthScore < 60);
    if (unhealthyProjects.length > 0) {
        recommendations.push(`Focus on improving ${unhealthyProjects.length} underperforming projects`);
        unhealthyProjects.forEach(p => {
            recommendations.push(`- ${p.projectName}: Address ${p.riskFactors.join(', ')}`);
        });
    }
    // Completion rate recommendations
    const lowCompletionProjects = projects.filter(p => p.completionRate < 70);
    if (lowCompletionProjects.length > 0) {
        recommendations.push(`Review resource allocation for ${lowCompletionProjects.length} projects with low completion rates`);
    }
    // Velocity recommendations
    const slowProjects = projects.filter(p => p.velocityScore < 60);
    if (slowProjects.length > 0) {
        recommendations.push(`Consider process improvements for ${slowProjects.length} projects with low velocity`);
    }
    return recommendations;
}
