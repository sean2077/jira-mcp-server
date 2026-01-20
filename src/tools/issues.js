"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addCommentTool = exports.assignIssueTool = exports.deleteIssueTool = exports.updateIssueTool = exports.createIssueTool = exports.getIssueTool = exports.searchIssuesTool = void 0;
const zod_1 = require("zod");
const auth_1 = require("../utils/auth");
const api_1 = require("../config/api");
exports.searchIssuesTool = {
    name: api_1.TOOLS_CONFIG.issues.search.name,
    description: api_1.TOOLS_CONFIG.issues.search.description,
    parameters: {
        searchString: zod_1.z.string().describe(`JQL query string to search for issues or tickets or tasks and its statuses.
        while searching for issues, you can use the following fields:
        - assignee -jira user id (never use names or email here)
        - project -jira project key (if you want to search for a specific project with a specific name, use the jira-get-projects tool to get the project key , NEVER USE THE PROJECT NAME HERE)
        - status -jira status id
        - priority -jira priority id
        - issueType -jira issue type id
        - updated -jira updated date
        - created -jira created date
     
        `),
        cloudId: zod_1.z.string().optional().describe("valid jira cloud id. get it using jira_get_cloud_id tool"),
        minimalFields: zod_1.z.boolean().describe("Whether to use minimal fields for better performance based on the user's request. If the user asks for a specific issue, set this to true. If the user asks for a list of issues, set this to false."),
        startAt: zod_1.z.number().describe("The index of the first issue to return. This is used for pagination."),
        pageSize: zod_1.z.number().describe("The number of issues to return per page. This is used for pagination.")
    },
    handler: async ({ searchString, minimalFields, startAt, pageSize }) => {
        try {
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            const issues = await jiraApi.searchIssues(searchString, pageSize, minimalFields, startAt);
            return {
                content: [{
                        type: "text",
                        text: `JIRA Search Results for query: "${searchString}"\n\n${JSON.stringify(issues, null, 2)}`
                    }],
            };
        }
        catch (error) {
            const errorMessage = (0, auth_1.extractErrorMessage)(error);
            return {
                content: [{
                        type: "text",
                        text: `Error searching JIRA issues: ${errorMessage}`
                    }],
            };
        }
    }
};
exports.getIssueTool = {
    name: api_1.TOOLS_CONFIG.issues.get.name,
    description: api_1.TOOLS_CONFIG.issues.get.description,
    parameters: {
        issueKey: zod_1.z.string().describe("JIRA issue key (e.g., 'TEST-123')")
    },
    handler: async ({ issueKey }) => {
        try {
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            const issue = await jiraApi.getIssueWithComments(issueKey);
            return {
                content: [{
                        type: "text",
                        text: `JIRA Issue Details for ${issueKey}:\n\n${JSON.stringify(issue, null, 2)}`
                    }],
            };
        }
        catch (error) {
            console.error('Error fetching JIRA issue:', error);
            return {
                content: [{
                        type: "text",
                        text: `Error fetching JIRA issue ${issueKey}: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
            };
        }
    }
};
exports.createIssueTool = {
    name: api_1.TOOLS_CONFIG.issues.create.name,
    description: api_1.TOOLS_CONFIG.issues.create.description,
    parameters: {
        projectKey: zod_1.z.string().describe("Project key where the issue will be created"),
        summary: zod_1.z.string().describe("Issue summary/title"),
        description: zod_1.z.string().optional().describe("Issue description"),
        issueType: zod_1.z.string().describe("Issue type (e.g., 'Task', 'Bug', 'Story')"),
        priority: zod_1.z.string().optional().describe("Issue priority"),
        assigneeAccountId: zod_1.z.string().optional().describe("Account ID of the assignee"),
        cloudId: zod_1.z.string().optional().describe("valid jira cloud id. get it using jira_get_cloud_id tool")
    },
    handler: async ({ projectKey, summary, description, issueType, priority, assigneeAccountId }) => {
        try {
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            // Build params object for createIssue wrapper in auth.js
            const params = {
                projectKey,
                issueType,
                summary,
                description,
            };
            if (priority) {
                params.priority = { name: priority };
            }
            if (assigneeAccountId) {
                params.assignee = { name: assigneeAccountId };
            }
            const issue = await jiraApi.createIssue(params);
            return {
                content: [{
                        type: "text",
                        text: `JIRA Issue created successfully:\n\n${JSON.stringify(issue, null, 2)}`
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error creating JIRA issue: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
            };
        }
    }
};
exports.updateIssueTool = {
    name: api_1.TOOLS_CONFIG.issues.update.name,
    description: api_1.TOOLS_CONFIG.issues.update.description,
    parameters: {
        issueKey: zod_1.z.string().describe("JIRA issue key to update"),
        fields: zod_1.z.record(zod_1.z.any()).describe("Fields to update in the issue"),
        cloudId: zod_1.z.string().optional().describe("Cloud ID if different from default")
    },
    handler: async ({ issueKey, fields, cloudId }) => {
        try {
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            const result = await jiraApi.updateIssue(issueKey, fields, cloudId);
            return {
                content: [{
                        type: "text",
                        text: `JIRA Issue ${issueKey} updated successfully:\n\n${JSON.stringify(result, null, 2)}`
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error updating JIRA issue: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
            };
        }
    }
};
exports.deleteIssueTool = {
    name: api_1.TOOLS_CONFIG.issues.delete.name,
    description: api_1.TOOLS_CONFIG.issues.delete.description,
    parameters: {
        issueKey: zod_1.z.string().describe("JIRA issue key to delete"),
        cloudId: zod_1.z.string().optional().describe("Cloud ID if different from default")
    },
    handler: async ({ issueKey, cloudId }) => {
        try {
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            await jiraApi.deleteIssue(issueKey, cloudId);
            return {
                content: [{
                        type: "text",
                        text: `JIRA Issue ${issueKey} deleted successfully`
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error deleting JIRA issue: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
            };
        }
    }
};
exports.assignIssueTool = {
    name: api_1.TOOLS_CONFIG.issues.assign.name,
    description: api_1.TOOLS_CONFIG.issues.assign.description,
    parameters: {
        issueKey: zod_1.z.string().describe("JIRA issue key to assign"),
        accountId: zod_1.z.string().describe("Account ID of the user to assign the issue to"),
        cloudId: zod_1.z.string().optional().describe("Cloud ID if different from default")
    },
    handler: async ({ issueKey, accountId, cloudId }) => {
        try {
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            const result = await jiraApi.assignIssue(issueKey, accountId, cloudId);
            return {
                content: [{
                        type: "text",
                        text: `JIRA Issue ${issueKey} assigned successfully:\n\n${JSON.stringify(result, null, 2)}`
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error assigning JIRA issue: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
            };
        }
    }
};
exports.addCommentTool = {
    name: api_1.TOOLS_CONFIG.issues.comment.name,
    description: api_1.TOOLS_CONFIG.issues.comment.description,
    parameters: {
        issueKey: zod_1.z.string().describe("JIRA issue key to add comment to"),
        comment: zod_1.z.string().describe("Comment text to add"),
        cloudId: zod_1.z.string().optional().describe("Cloud ID if different from default")
    },
    handler: async ({ issueKey, comment, cloudId }) => {
        try {
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            const result = await jiraApi.addComment(issueKey, comment, cloudId);
            return {
                content: [{
                        type: "text",
                        text: `Comment added to JIRA Issue ${issueKey} successfully:\n\n${JSON.stringify(result, null, 2)}`
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error adding comment to JIRA issue: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
            };
        }
    }
};
