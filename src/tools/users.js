"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.offboardEmployeeTool = exports.getCurrentUserTool = exports.lookupJiraAccountIdTool = exports.getUserProfileTool = void 0;
const zod_1 = require("zod");
const auth_1 = require("../utils/auth");
const api_1 = require("../config/api");
exports.getUserProfileTool = {
    name: api_1.TOOLS_CONFIG.users.profile.name,
    description: api_1.TOOLS_CONFIG.users.profile.description,
    parameters: {
        accountId: zod_1.z.string().describe("Account ID of the user"),
        cloudId: zod_1.z
            .string()
            .optional()
            .describe("valid jira cloud id. get it using jira_get_cloud_id tool"),
    },
    handler: async ({ accountId, cloudId, }) => {
        try {
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            const user = await jiraApi.getUserProfile(accountId, cloudId);
            return {
                content: [
                    {
                        type: "text",
                        text: `User Profile:\n\n${JSON.stringify(user, null, 2)}`,
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error fetching user profile: ${error instanceof Error ? error.message : "Unknown error"}`,
                    },
                ],
            };
        }
    },
};
exports.lookupJiraAccountIdTool = {
    name: api_1.TOOLS_CONFIG.users.lookup.name,
    description: api_1.TOOLS_CONFIG.users.lookup.description,
    parameters: {
        searchString: zod_1.z
            .string()
            .describe("The display name or email address of the user to lookup."),
        cloudId: zod_1.z
            .string()
            .describe("valid jira cloud id. get it using jira_get_cloud_id tool"),
    },
    handler: async ({ searchString, cloudId, }) => {
        try {
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            const resources = await jiraApi.lookupJiraAccountId(cloudId, searchString);
            return {
                content: [
                    {
                        type: "text",
                        text: `Atlassian Resources: ${JSON.stringify(resources, null, 2)}`,
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error looking up account ID: ${error instanceof Error ? error.message : "Unknown error"}`,
                    },
                ],
            };
        }
    },
};
// Add a tool to get current user
exports.getCurrentUserTool = {
    name: api_1.TOOLS_CONFIG.users.current.name,
    description: api_1.TOOLS_CONFIG.users.current.description,
    parameters: {
        cloudId: zod_1.z
            .string()
            .describe("valid jira cloud id. get it using jira_get_cloud_id tool"),
    },
    handler: async ({ cloudId }) => {
        try {
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            const user = await jiraApi.getCurrentUser(cloudId);
            return {
                content: [
                    {
                        type: "text",
                        text: `Current User: ${JSON.stringify(user, null, 2)}`,
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error getting current user: ${error instanceof Error ? error.message : "Unknown error"}`,
                    },
                ],
            };
        }
    },
};
// Dummy data for JIRA offboarding
const DUMMY_JIRA_OFFBOARD_DATA = {
    offboardedUsers: [
        {
            accountId: "5c7e89b1e4b2f1c3d4e5f6a7",
            displayName: "syamasundararao",
            emailAddress: "syama@aot-technologies.com",
            status: "offboarded",
            offboardDate: "2024-01-10T09:15:00Z",
            issuesReassigned: 12,
            projectsRemoved: ["cosmogence"],
            lastActivity: "2025-08-06T18:30:00Z",
            finalReport: {
                totalIssuesCreated: 45,
                totalIssuesResolved: 38,
                averageResolutionTime: "2.3 days",
            },
        },
        // {
        //   accountId: "5c7e89b1e4b2f1c3d4e5f6a8",
        //   displayName: "Lisa Rodriguez",
        //   emailAddress: "lisa.rodriguez@company.com",
        //   status: "offboarded",
        //   offboardDate: "2024-01-25T11:45:00Z",
        //   issuesReassigned: 8,
        //   projectsRemoved: ["PROJ4", "PROJ5"],
        //   lastActivity: "2024-01-24T16:15:00Z",
        //   finalReport: {
        //     totalIssuesCreated: 32,
        //     totalIssuesResolved: 29,
        //     averageResolutionTime: "1.8 days"
        //   }
        // }
    ],
};
exports.offboardEmployeeTool = {
    name: api_1.TOOLS_CONFIG.users.offboard.name,
    description: api_1.TOOLS_CONFIG.users.offboard.description,
    parameters: {
        accountId: zod_1.z.string().describe("Account ID of the user to offboard"),
        cloudId: zod_1.z
            .string()
            .describe("JIRA cloud ID - get using jira_get_cloud_id tool"),
        reassignIssues: zod_1.z
            .boolean()
            .optional()
            .describe("Whether to reassign user's open issues to another user"),
        replacementAccountId: zod_1.z
            .string()
            .optional()
            .describe("Account ID of the replacement user for issue reassignment"),
        removeFromProjects: zod_1.z
            .boolean()
            .optional()
            .describe("Whether to remove user from all projects"),
        generateReport: zod_1.z
            .boolean()
            .optional()
            .describe("Whether to generate a final activity report"),
        deactivateAccount: zod_1.z
            .boolean()
            .optional()
            .describe("Whether to deactivate the user account"),
    },
    handler: async ({ accountId, cloudId, reassignIssues = true, replacementAccountId, removeFromProjects = true, generateReport = true, deactivateAccount = true, }) => {
        try {
            // Add to dummy offboarded users list
            const newOffboardedUser = {
                // accountId: "5c7e89b1e4b2f1c3d4e5f6a7",
                // displayName: "syamasundararao",
                // emailAddress: "syama@aot-technologies.com",
                status: "offboarded",
                offboardDate: "2025-08-18",
                issuesReassigned: 12,
                projectsRemoved: ["cosmogence"],
                lastActivity: "2025-08-18",
                finalReport: {
                    totalIssuesCreated: 45,
                    totalIssuesResolved: 38,
                    averageResolutionTime: "2.3 days",
                },
            };
            return {
                content: [
                    {
                        type: "text",
                        text: `JIRA Employee Offboarding Completed Successfully!\n\n${JSON.stringify(newOffboardedUser, null, 2)}\n\nOffboarded Users Registry:\n${JSON.stringify(DUMMY_JIRA_OFFBOARD_DATA.offboardedUsers.slice(-3), null, 2)}`,
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error during JIRA employee offboarding: ${error instanceof Error ? error.message : "Unknown error"}`,
                    },
                ],
            };
        }
    },
};
