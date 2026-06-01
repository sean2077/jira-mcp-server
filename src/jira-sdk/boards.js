"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JiraBoardsService = void 0;
exports.createBoardsService = createBoardsService;
const api_1 = require("../config/api");
const http_1 = require("./http");
class JiraBoardsService {
    baseUrl;
    headers;
    requestTimeout = 30000;
    constructor(baseUrl, token, isOauth = false) {
        this.baseUrl = baseUrl;
        this.headers = (0, api_1.createJiraApiHeaders)(token, isOauth);
    }
    async fetchJson(url, init) {
        return (0, http_1.jiraFetchJson)(url, this.headers, init, this.requestTimeout);
    }
    async getBoards(projectKeyOrId, type, maxResults = 50) {
        const searchParams = new URLSearchParams();
        searchParams.append('maxResults', maxResults.toString());
        if (projectKeyOrId) {
            searchParams.append('projectKeyOrId', projectKeyOrId);
        }
        if (type) {
            searchParams.append('type', type);
        }
        // Note: Using agile API endpoint for boards
        const url = (0, api_1.getJiraAgileApiUrl)(this.baseUrl, `board?${searchParams.toString()}`);
        const response = await this.fetchJson(url);
        return response.values?.map((board) => ({
            id: board.id,
            name: board.name,
            type: board.type || 'simple',
            projectKey: board.location?.projectKey,
        })) || [];
    }
    async getSprints(boardId, state, maxResults = 50) {
        const searchParams = new URLSearchParams();
        searchParams.append('maxResults', maxResults.toString());
        if (state) {
            searchParams.append('state', state);
        }
        // Note: Using agile API endpoint for sprints
        const url = (0, api_1.getJiraAgileApiUrl)(this.baseUrl, `board/${boardId}/sprint?${searchParams.toString()}`);
        const response = await this.fetchJson(url);
        return response.values?.map((sprint) => ({
            id: sprint.id,
            name: sprint.name,
            state: sprint.state || 'active',
            startDate: sprint.startDate,
            endDate: sprint.endDate,
            goal: sprint.goal,
        })) || [];
    }
    setRequestTimeout(timeout) {
        this.requestTimeout = timeout;
    }
    getRequestTimeout() {
        return this.requestTimeout;
    }
}
exports.JiraBoardsService = JiraBoardsService;
// Factory function to create service instance
function createBoardsService(baseUrl, token, isOauth = false) {
    return new JiraBoardsService(baseUrl, token, isOauth);
}
