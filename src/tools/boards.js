"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSprintsTool = exports.getBoardsTool = void 0;
const zod_1 = require("zod");
const auth_1 = require("../utils/auth");
const api_1 = require("../config/api");
exports.getBoardsTool = {
    name: api_1.TOOLS_CONFIG.boards.list.name,
    description: api_1.TOOLS_CONFIG.boards.list.description,
    parameters: {
        cloudId: zod_1.z.string().optional().describe("Cloud ID if different from default")
    },
    handler: async ({ cloudId }) => {
        try {
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            const boards = await jiraApi.getBoards(cloudId);
            return {
                content: [{
                        type: "text",
                        text: `JIRA Boards:\n\n${JSON.stringify(boards, null, 2)}`
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error fetching boards: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
            };
        }
    }
};
exports.getSprintsTool = {
    name: api_1.TOOLS_CONFIG.boards.sprints.name,
    description: api_1.TOOLS_CONFIG.boards.sprints.description,
    parameters: {
        boardId: zod_1.z.number().describe("Board ID to get sprints for"),
        state: zod_1.z.enum(["active", "closed", "future"]).optional().describe("Filter sprints by state"),
        cloudId: zod_1.z.string().optional().describe("valid jira cloud id. get it using jira_get_cloud_id tool")
    },
    handler: async ({ boardId, state, cloudId }) => {
        try {
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            const sprints = await jiraApi.getSprints(boardId, state, cloudId);
            return {
                content: [{
                        type: "text",
                        text: `Sprints for Board ${boardId}:\n\n${JSON.stringify(sprints, null, 2)}`
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: "text",
                        text: `Error fetching sprints: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }],
            };
        }
    }
};
