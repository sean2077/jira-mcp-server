"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAtlassianResourcesTool = void 0;
const auth_1 = require("../utils/auth");
const api_1 = require("../config/api");
exports.getAtlassianResourcesTool = {
    name: api_1.TOOLS_CONFIG.resources.list.name,
    description: api_1.TOOLS_CONFIG.resources.list.description,
    parameters: {},
    handler: async () => {
        try {
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            const resources = await jiraApi.getAccessibleAtlassianResources();
            return {
                content: [{
                        type: "text",
                        text: `Atlassian Cloud ID: ${JSON.stringify(resources, null, 2)}`
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error fetching Atlassian resources: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
            };
        }
    }
};
