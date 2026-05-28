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
        projectKeyOrId: zod_1.z.string().optional().describe("Optional project key or ID to filter boards"),
        type: zod_1.z.enum(["scrum", "kanban"]).optional().describe("Optional board type filter"),
        maxResults: zod_1.z.number().optional().default(50).describe("Maximum number of boards to return")
    },
    handler: async ({ projectKeyOrId, type, maxResults = 50 }) => {
        try {
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            const boards = await jiraApi.getBoards(projectKeyOrId, type, maxResults);
            return {
                content: [{
                        type: "text",
                        text: `JIRA Boards:\n\n${JSON.stringify(boards)}`
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
        maxResults: zod_1.z.number().optional().default(50).describe("Maximum number of sprints to return")
    },
    handler: async ({ boardId, state, maxResults = 50 }) => {
        try {
            const jiraApi = await (0, auth_1.createAuthenticatedJiraService)();
            const sprints = await jiraApi.getSprints(boardId, state, maxResults);
            return {
                content: [{
                        type: "text",
                        text: `Sprints for Board ${boardId}:\n\n${JSON.stringify(sprints)}`
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
