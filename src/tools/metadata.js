"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorkflowsTool = exports.getFieldsTool = exports.getStatusesTool = exports.getPrioritiesTool = exports.getIssueTypesTool = void 0;
const zod_1 = require("zod");
const auth_1 = require("../utils/auth");
const api_1 = require("../config/api");
exports.getIssueTypesTool = {
    name: api_1.TOOLS_CONFIG.metadata.issueTypes.name,
    description: api_1.TOOLS_CONFIG.metadata.issueTypes.description,
    parameters: {
        projectId: zod_1.z.string().describe("Project numeric id to get issue types for (e.g.,123)"),
        cloudId: zod_1.z.string().optional().describe("valid jira cloud id. get it using jira_get_cloud_id tool")
    },
    handler: async ({ projectId, cloudId }) => {
        try {
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            const issueTypes = await jiraApi.getIssueTypes(projectId, cloudId);
            return {
                content: [{
                        type: "text",
                        text: `Issue Types for ${projectId}:\n\n${JSON.stringify(issueTypes, null, 2)}`
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error fetching issue types: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
            };
        }
    }
};
exports.getPrioritiesTool = {
    name: api_1.TOOLS_CONFIG.metadata.priorities.name,
    description: api_1.TOOLS_CONFIG.metadata.priorities.description,
    parameters: {
        cloudId: zod_1.z.string().optional().describe("Cloud ID if different from default")
    },
    handler: async ({ cloudId }) => {
        try {
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            const priorities = await jiraApi.getPriorities(cloudId);
            return {
                content: [{
                        type: "text",
                        text: `JIRA Priorities:\n\n${JSON.stringify(priorities, null, 2)}`
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error fetching priorities: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
            };
        }
    }
};
exports.getStatusesTool = {
    name: api_1.TOOLS_CONFIG.metadata.statuses.name,
    description: api_1.TOOLS_CONFIG.metadata.statuses.description,
    parameters: {
        cloudId: zod_1.z.string().optional().describe("Cloud ID if different from default")
    },
    handler: async ({ cloudId }) => {
        try {
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            const statuses = await jiraApi.getStatuses(cloudId);
            return {
                content: [{
                        type: "text",
                        text: `JIRA Statuses:\n\n${JSON.stringify(statuses, null, 2)}`
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error fetching statuses: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
            };
        }
    }
};
exports.getFieldsTool = {
    name: api_1.TOOLS_CONFIG.metadata.fields.name,
    description: api_1.TOOLS_CONFIG.metadata.fields.description,
    parameters: {},
    handler: async () => {
        try {
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            const fields = await jiraApi.getFields();
            return {
                content: [{
                        type: "text",
                        text: `JIRA Fields (${fields.length} total):\n\n${JSON.stringify(fields, null, 2)}`
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error fetching fields: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
            };
        }
    }
};
exports.getWorkflowsTool = {
    name: api_1.TOOLS_CONFIG.metadata.workflows.name,
    description: api_1.TOOLS_CONFIG.metadata.workflows.description,
    parameters: {
        projectKey: zod_1.z.string().describe("Project key to get workflow statuses for (e.g., 'TEST')")
    },
    handler: async ({ projectKey }) => {
        try {
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            const workflows = await jiraApi.getWorkflows(projectKey);
            return {
                content: [{
                        type: "text",
                        text: `Workflow statuses for project ${projectKey}:\n\n${JSON.stringify(workflows, null, 2)}`
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error fetching workflows for ${projectKey}: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
            };
        }
    }
};
