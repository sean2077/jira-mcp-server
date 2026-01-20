"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProjectUsersTool = exports.getProjectDetailsTool = exports.getProjectsTool = void 0;
const zod_1 = require("zod");
const auth_1 = require("../utils/auth");
const api_1 = require("../config/api");
exports.getProjectsTool = {
    name: api_1.TOOLS_CONFIG.projects.list.name,
    description: api_1.TOOLS_CONFIG.projects.list.description,
    parameters: {
        cloudId: zod_1.z.string().optional().describe("valid jira cloud id.")
    },
    handler: async ({ cloudId }) => {
        try {
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            const projects = await jiraApi.getProjects(cloudId, 100);
            return {
                content: [{
                        type: "text",
                        text: `JIRA Projects:\n\n${JSON.stringify(projects, null, 2)}`
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error fetching JIRA projects: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
            };
        }
    }
};
exports.getProjectDetailsTool = {
    name: api_1.TOOLS_CONFIG.projects.details.name,
    description: api_1.TOOLS_CONFIG.projects.details.description,
    parameters: {
        projectKey: zod_1.z.string().describe("Project key (e.g., 'COS')"),
        cloudId: zod_1.z.string().describe("valid jira cloud id.")
    },
    handler: async ({ projectKey, cloudId }) => {
        try {
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            const project = await jiraApi.getProjectDetails(projectKey, cloudId);
            return {
                content: [{
                        type: "text",
                        text: `JIRA Project Details for ${projectKey}:\n\n${JSON.stringify(project, null, 2)}`
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error fetching project details for ${projectKey}: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
            };
        }
    }
};
exports.getProjectUsersTool = {
    name: api_1.TOOLS_CONFIG.projects.users.name,
    description: api_1.TOOLS_CONFIG.projects.users.description,
    parameters: {
        projectKey: zod_1.z.string().describe("comma separated list of project keys to get users for"),
        maxResults: zod_1.z.number().optional().default(50).describe("Maximum number of results to return (default: 50, max: 100)"),
        cloudId: zod_1.z.string().describe("valid jira cloud id")
    },
    handler: async ({ projectKey, maxResults, cloudId }) => {
        try {
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            const users = await jiraApi.getProjectUsers(cloudId, projectKey, maxResults);
            console.log("users", users);
            return {
                content: [{
                        type: "text",
                        text: `Users with access to ${projectKey}:\n\n${JSON.stringify(users, null, 2)}`
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error fetching project users: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
            };
        }
    }
};
