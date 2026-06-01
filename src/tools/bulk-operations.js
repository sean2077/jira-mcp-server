"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkProjectProductivityTool = exports.bulkUserProductivityTool = void 0;
const zod_1 = require("zod");
const auth_1 = require("../utils/auth");
const debug_log_1 = require("../utils/debug-log");
// Cache for bulk operations. Keyed only by query params, which is safe under the single-subject
// stdio contract (one credential per process). A multi-token transport would need the auth
// identity folded into the key (see the note in utils/auth.js).
const bulkCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes - increased for better performance
const BULK_PAGE_SIZE = 100;
const MAX_BULK_ISSUES = 10000;
// Story point field id varies per Jira instance; allow override (Server default is customfield_10016).
const STORY_POINTS_FIELD = process.env.JIRA_STORY_POINTS_FIELD || "customfield_10016";
// Analytics only needs these fields. Requesting them explicitly (a) shrinks the payload vs. the
// SDK's heavy default set, and (b) is required for correctness: customfield_10016 and
// resolutiondate are NOT in that default set, so story points / resolution time were always 0.
const ANALYTICS_FIELDS = [
    "assignee", "status", "project", "created", "updated",
    "resolutiondate", "priority", "duedate", "issuetype", "summary",
    STORY_POINTS_FIELD,
].join(",");
// Jira project keys: a letter followed by letters/digits/underscores.
const PROJECT_KEY_RE = /^[A-Za-z][A-Za-z0-9_]*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function assertValidDate(value, label) {
    if (typeof value !== "string" || !DATE_RE.test(value)) {
        throw new Error(`${label} must be in YYYY-MM-DD format`);
    }
}
function assertValidProjectKey(key) {
    if (typeof key !== "string" || !PROJECT_KEY_RE.test(key)) {
        throw new Error(`Invalid project key: ${JSON.stringify(key)} (expected a Jira key such as "ABC")`);
    }
}
// Escape a value for safe embedding inside a double-quoted JQL string literal.
function jqlQuote(value) {
    return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
function getCacheKey(prefix, params) {
    // Create normalized cache key for better consistency
    const normalizedParams = {
        users: Array.isArray(params.users) ? [...params.users].sort() : params.users,
        startDate: params.startDate,
        endDate: params.endDate,
        projectKeys: Array.isArray(params.projectKeys) ? [...params.projectKeys].sort() : params.projectKeys,
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
function markCachedResult(result) {
    if (result && typeof result === "object" && !Array.isArray(result)) {
        return {
            ...result,
            metadata: {
                ...(result.metadata || {}),
                cached: true,
            },
        };
    }
    return result;
}
async function searchAllIssues(jiraApi, jql) {
    let startAt = 0;
    let total = 0;
    let totalKnown = false;
    const allIssues = [];
    while (startAt < MAX_BULK_ISSUES) {
        // Request the analytics field set explicitly (correctness + payload size).
        const page = await jiraApi.searchIssues(jql, BULK_PAGE_SIZE, false, startAt, true, ANALYTICS_FIELDS);
        const pageIssues = page?.issues || [];
        allIssues.push(...pageIssues);
        if (typeof page?.total === "number") {
            total = page.total;
            totalKnown = true;
        }
        // Stop on an empty page so a server that keeps reporting "more" cannot loop forever.
        if (pageIssues.length === 0) {
            break;
        }
        // Advance by the count actually returned: a server-capped page size must not skip issues.
        startAt += pageIssues.length;
        if (totalKnown && allIssues.length >= total) {
            break;
        }
    }
    return {
        issues: allIssues,
        total: totalKnown ? total : allIssues.length,
        truncated: totalKnown && allIssues.length < total,
    };
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
        projectKeys: zod_1.z.array(zod_1.z.string()).optional().describe("Optional array of project keys to restrict the analysis to"),
        cloudId: zod_1.z.string().optional().describe("Cloud ID for OAuth Cloud mode; not used for Jira Server"),
    },
    handler: async (params) => {
        try {
            const cacheKey = getCacheKey('bulk_user_productivity', params);
            if (isValidCache(cacheKey)) {
                const cachedResult = markCachedResult(getCache(cacheKey));
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify(cachedResult)
                        }],
                };
            }
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            // Validate/escape inputs before composing JQL (prevents query-scope manipulation).
            assertValidDate(params.startDate, "startDate");
            assertValidDate(params.endDate, "endDate");
            const userList = params.users.map(id => jqlQuote(id)).join(',');
            let jql = `assignee IN (${userList}) AND created >= "${params.startDate}" AND created <= "${params.endDate}"`;
            if (params.projectKeys && params.projectKeys.length > 0) {
                params.projectKeys.forEach(assertValidProjectKey);
                jql += ` AND project IN (${params.projectKeys.join(',')})`;
            }
            (0, debug_log_1.debugLog)('JQL Query:', jql);
            (0, debug_log_1.debugLog)('Cloud ID:', params.cloudId);
            (0, debug_log_1.debugLog)('Users to search:', params.users);
            const issues = await searchAllIssues(jiraApi, jql);
            (0, debug_log_1.debugLog)(`Total issues found: ${issues?.total || 0}`);
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
                const storyPointsCompleted = completedIssues.reduce((sum, issue) => sum + (issue.fields?.[STORY_POINTS_FIELD] || 0), 0);
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
            }).filter(Boolean);
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
                    issuesAnalyzed: issues?.issues?.length || 0,
                    usersAnalyzed: params.users.length,
                    truncated: issues?.truncated || false
                }
            };
            setCache(cacheKey, result);
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify(result)
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
        cloudId: zod_1.z.string().optional().describe("Cloud ID for OAuth Cloud mode; not used for Jira Server"),
    },
    handler: async (params) => {
        try {
            const cacheKey = getCacheKey('bulk_project_productivity', params);
            if (isValidCache(cacheKey)) {
                const cachedResult = markCachedResult(getCache(cacheKey));
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify(cachedResult)
                        }],
                };
            }
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            // Validate inputs before composing JQL (prevents query-scope manipulation).
            assertValidDate(params.startDate, "startDate");
            assertValidDate(params.endDate, "endDate");
            params.projectKeys.forEach(assertValidProjectKey);
            let jql = `created >= "${params.startDate}" AND created <= "${params.endDate}"`;
            if (params.projectKeys && params.projectKeys.length > 0) {
                jql += ` AND project IN (${params.projectKeys.join(',')})`;
            }
            (0, debug_log_1.debugLog)('JQL Query:', jql);
            (0, debug_log_1.debugLog)('Cloud ID:', params.cloudId);
            const issues = await searchAllIssues(jiraApi, jql);
            (0, debug_log_1.debugLog)(`Total issues found: ${issues?.total || 0}`);
            (0, debug_log_1.debugLog)("issues", issues?.issues);
            // Filter the issues by projectKeys
            // Filter the issues by projectKeys and return the issue counts and assignee information 
            const projectAnalytics = params.projectKeys?.map((projectKey) => {
                const projectIssues = (issues?.issues || []).filter((issue) => issue.fields?.project?.key === projectKey);
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
            }).filter(Boolean);
            const result = {
                projects: projectAnalytics,
                metadata: {
                    cached: false,
                    generatedAt: new Date().toISOString(),
                    totalIssuesFound: issues?.total || 0,
                    issuesAnalyzed: issues?.issues?.length || 0,
                    projectsAnalyzed: params.projectKeys.length,
                    truncated: issues?.truncated || false
                }
            };
            (0, debug_log_1.debugLog)("projectAnalytics", result);
            setCache(cacheKey, result);
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify(result)
                    }],
            };
        }
        catch (error) {
            const errorMessage = (0, auth_1.extractErrorMessage)(error);
            return {
                content: [{
                        type: "text",
                        text: `Error in bulk project productivity analysis: ${errorMessage}`
                    }],
            };
        }
    }
};
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
