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
                        text: `User Profile:\n\n${JSON.stringify(user)}`,
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
            .optional()
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
                        text: `Atlassian Resources: ${JSON.stringify(resources)}`,
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
            .optional()
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
                        text: `Current User: ${JSON.stringify(user)}`,
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
exports.offboardEmployeeTool = {
    name: api_1.TOOLS_CONFIG.users.offboard.name,
    description: api_1.TOOLS_CONFIG.users.offboard.description,
    parameters: {
        accountId: zod_1.z.string().describe("Account ID of the user to offboard"),
        cloudId: zod_1.z
            .string()
            .optional()
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
    handler: async () => {
        return {
            content: [
                {
                    type: "text",
                    text: "jira_offboard_employee is not implemented and is not registered by default. Use explicit Jira administration workflows for account deactivation, project access removal, and issue reassignment.",
                },
            ],
            isError: true,
        };
    },
};
