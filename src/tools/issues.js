"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchSearchIssuesTool = exports.manageWatchersTool = exports.getWatchersTool = exports.addWorklogTool = exports.deleteIssueLinkTool = exports.createIssueLinkTool = exports.getIssueLinkTypesTool = exports.transitionIssueTool = exports.getTransitionsTool = exports.addCommentTool = exports.assignIssueTool = exports.deleteIssueTool = exports.updateIssueTool = exports.createIssueTool = exports.getIssueTool = exports.searchIssuesTool = void 0;
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
                        text: `JIRA Search Results for query: "${searchString}"\n\n${JSON.stringify(issues)}`
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
                        text: `JIRA Issue Details for ${issueKey}:\n\n${JSON.stringify(issue)}`
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
                        text: `JIRA Issue created successfully:\n\n${JSON.stringify(issue)}`
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
                        text: `JIRA Issue ${issueKey} updated successfully:\n\n${JSON.stringify(result)}`
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
                        text: `JIRA Issue ${issueKey} assigned successfully:\n\n${JSON.stringify(result)}`
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
                        text: `Comment added to JIRA Issue ${issueKey} successfully:\n\n${JSON.stringify(result)}`
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
exports.getTransitionsTool = {
    name: api_1.TOOLS_CONFIG.issues.getTransitions.name,
    description: api_1.TOOLS_CONFIG.issues.getTransitions.description,
    parameters: {
        issueKey: zod_1.z.string().describe("JIRA issue key (e.g., 'TEST-123')")
    },
    handler: async ({ issueKey }) => {
        try {
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            const transitions = await jiraApi.getTransitions(issueKey);
            return {
                content: [{
                        type: "text",
                        text: `Available transitions for ${issueKey}:\n\n${JSON.stringify(transitions)}`
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error fetching transitions for ${issueKey}: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
            };
        }
    }
};
exports.transitionIssueTool = {
    name: api_1.TOOLS_CONFIG.issues.transition.name,
    description: api_1.TOOLS_CONFIG.issues.transition.description,
    parameters: {
        issueKey: zod_1.z.string().describe("JIRA issue key to transition (e.g., 'TEST-123')"),
        transitionId: zod_1.z.string().describe("Transition ID to apply (get available transitions using jira_get_transitions)"),
        comment: zod_1.z.string().optional().describe("Optional comment to add with the transition")
    },
    handler: async ({ issueKey, transitionId, comment }) => {
        try {
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            await jiraApi.transitionIssue(issueKey, transitionId, comment);
            return {
                content: [{
                        type: "text",
                        text: `Issue ${issueKey} transitioned successfully with transition ID ${transitionId}`
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error transitioning issue ${issueKey}: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
            };
        }
    }
};
exports.getIssueLinkTypesTool = {
    name: api_1.TOOLS_CONFIG.issues.getLinkTypes.name,
    description: api_1.TOOLS_CONFIG.issues.getLinkTypes.description,
    parameters: {},
    handler: async () => {
        try {
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            const linkTypes = await jiraApi.getIssueLinkTypes();
            return {
                content: [{
                        type: "text",
                        text: `Available issue link types:\n\n${JSON.stringify(linkTypes)}`
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error fetching issue link types: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
            };
        }
    }
};
exports.createIssueLinkTool = {
    name: api_1.TOOLS_CONFIG.issues.createLink.name,
    description: api_1.TOOLS_CONFIG.issues.createLink.description,
    parameters: {
        linkType: zod_1.z.string().describe("Link type name (e.g., 'Blocks', 'Relates', 'Duplicate') - get from jira_get_issue_link_types"),
        inwardIssueKey: zod_1.z.string().describe("Issue key for the inward side of the link (e.g., 'TEST-1' is blocked by 'TEST-2')"),
        outwardIssueKey: zod_1.z.string().describe("Issue key for the outward side of the link (e.g., 'TEST-2' blocks 'TEST-1')"),
        comment: zod_1.z.string().optional().describe("Optional comment to add with the link")
    },
    handler: async ({ linkType, inwardIssueKey, outwardIssueKey, comment }) => {
        try {
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            await jiraApi.createIssueLink(linkType, inwardIssueKey, outwardIssueKey, comment);
            return {
                content: [{
                        type: "text",
                        text: `Issue link created: ${inwardIssueKey} <-- ${linkType} --> ${outwardIssueKey}`
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error creating issue link: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
            };
        }
    }
};
exports.deleteIssueLinkTool = {
    name: api_1.TOOLS_CONFIG.issues.deleteLink.name,
    description: api_1.TOOLS_CONFIG.issues.deleteLink.description,
    parameters: {
        linkId: zod_1.z.string().describe("ID of the issue link to delete (visible in issue details)")
    },
    handler: async ({ linkId }) => {
        try {
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            await jiraApi.deleteIssueLink(linkId);
            return {
                content: [{
                        type: "text",
                        text: `Issue link ${linkId} deleted successfully`
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error deleting issue link: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
            };
        }
    }
};
exports.addWorklogTool = {
    name: api_1.TOOLS_CONFIG.issues.addWorklog.name,
    description: api_1.TOOLS_CONFIG.issues.addWorklog.description,
    parameters: {
        issueKey: zod_1.z.string().describe("JIRA issue key (e.g., 'TEST-123')"),
        timeSpent: zod_1.z.string().describe("Time spent in Jira format (e.g., '2h 30m', '1d', '3h')"),
        comment: zod_1.z.string().optional().describe("Optional description of work performed"),
        started: zod_1.z.string().optional().describe("When the work started in ISO 8601 format (e.g., '2024-01-15T10:00:00.000+0000'). Defaults to now.")
    },
    handler: async ({ issueKey, timeSpent, comment, started }) => {
        try {
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            const result = await jiraApi.addWorklog(issueKey, timeSpent, comment, started);
            return {
                content: [{
                        type: "text",
                        text: `Worklog added to ${issueKey}: ${timeSpent}\n\n${JSON.stringify(result)}`
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error adding worklog: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
            };
        }
    }
};
exports.getWatchersTool = {
    name: api_1.TOOLS_CONFIG.issues.getWatchers.name,
    description: api_1.TOOLS_CONFIG.issues.getWatchers.description,
    parameters: {
        issueKey: zod_1.z.string().describe("JIRA issue key (e.g., 'TEST-123')")
    },
    handler: async ({ issueKey }) => {
        try {
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            const watchers = await jiraApi.getWatchers(issueKey);
            return {
                content: [{
                        type: "text",
                        text: `Watchers for ${issueKey}:\n\n${JSON.stringify(watchers)}`
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error fetching watchers: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
            };
        }
    }
};
exports.manageWatchersTool = {
    name: api_1.TOOLS_CONFIG.issues.manageWatchers.name,
    description: api_1.TOOLS_CONFIG.issues.manageWatchers.description,
    parameters: {
        issueKey: zod_1.z.string().describe("JIRA issue key (e.g., 'TEST-123')"),
        action: zod_1.z.enum(["add", "remove"]).describe("Whether to add or remove the watcher"),
        username: zod_1.z.string().describe("Username (Jira Server) or account ID (Jira Cloud) of the watcher")
    },
    handler: async ({ issueKey, action, username }) => {
        try {
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            if (action === "add") {
                await jiraApi.addWatcher(issueKey, username);
            } else {
                await jiraApi.removeWatcher(issueKey, username);
            }
            return {
                content: [{
                        type: "text",
                        text: `Watcher ${username} ${action === "add" ? "added to" : "removed from"} ${issueKey} successfully`
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error ${action}ing watcher: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
            };
        }
    }
};
exports.batchSearchIssuesTool = {
    name: api_1.TOOLS_CONFIG.issues.batchSearch.name,
    description: api_1.TOOLS_CONFIG.issues.batchSearch.description,
    parameters: {
        queries: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string().describe("Unique identifier for this query, used to match results"),
            jql: zod_1.z.string().describe("JQL query string"),
            pageSize: zod_1.z.number().optional().default(20).describe("Number of results per query"),
            minimalFields: zod_1.z.boolean().optional().default(true).describe("Use minimal fields for better performance"),
            startAt: zod_1.z.number().optional().default(0).describe("Pagination offset")
        })).describe("Array of JQL queries to execute in parallel")
    },
    handler: async ({ queries }) => {
        try {
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            const results = await Promise.all(queries.map(async (q) => {
                try {
                    const data = await jiraApi.searchIssues(q.jql, q.pageSize, q.minimalFields, q.startAt);
                    return { id: q.id, ...data };
                }
                catch (error) {
                    return { id: q.id, error: error instanceof Error ? error.message : 'Unknown error', issues: [], total: 0 };
                }
            }));
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify(results)
                    }],
            };
        }
        catch (error) {
            const errorMessage = (0, auth_1.extractErrorMessage)(error);
            return {
                content: [{
                        type: "text",
                        text: `Error in batch search: ${errorMessage}`
                    }],
            };
        }
    }
};
