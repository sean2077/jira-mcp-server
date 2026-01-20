"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JiraBoardsService = void 0;
exports.createBoardsService = createBoardsService;
const api_1 = require("../config/api");
class JiraBoardsService {
    baseUrl;
    headers;
    requestTimeout = 30000;
    constructor(baseUrl, token, isOauth = false) {
        this.baseUrl = baseUrl;
        this.headers = (0, api_1.createJiraApiHeaders)(token, true);
    }
    async handleFetchError(response) {
        if (!response.ok) {
            let message = response.statusText;
            let errorData = {};
            try {
                errorData = await response.json();
                if (Array.isArray(errorData.errorMessages) && errorData.errorMessages.length > 0) {
                    message = errorData.errorMessages.join("; ");
                }
                else if (errorData.message) {
                    message = errorData.message;
                }
                else if (errorData.errorMessage) {
                    message = errorData.errorMessage;
                }
            }
            catch (e) {
                console.warn("Could not parse JIRA error response body as JSON.");
            }
            const details = JSON.stringify(errorData, null, 2);
            console.error("JIRA API Error Details:", details);
            const errorMessage = message ? `: ${message}` : "";
            throw new Error(`JIRA API Error${errorMessage} (Status: ${response.status})`);
        }
        throw new Error("Unknown error occurred during fetch operation.");
    }
    async fetchJson(url, init) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);
        try {
            const response = await fetch(url, {
                ...init,
                headers: {
                    ...Object.fromEntries(this.headers.entries()),
                    ...(init?.headers || {}),
                },
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                await this.handleFetchError(response);
            }
            return await response.json();
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`Request timeout after ${this.requestTimeout}ms`);
            }
            throw error;
        }
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
    async getBoardConfiguration(boardId) {
        // Note: Using agile API endpoint for board configuration
        const url = (0, api_1.getJiraAgileApiUrl)(this.baseUrl, `board/${boardId}/configuration`);
        const response = await this.fetchJson(url);
        return {
            id: response.id,
            name: response.name,
            type: response.type || 'simple',
            filter: response.filter ? {
                id: response.filter.id,
                name: response.filter.name,
                query: response.filter.query,
            } : undefined,
            columnConfig: response.columnConfig ? {
                columns: response.columnConfig.columns?.map((col) => ({
                    name: col.name,
                    statuses: col.statuses?.map((status) => ({
                        id: status.id,
                        name: status.name,
                    })) || [],
                })) || [],
            } : undefined,
        };
    }
    async getSprintIssues(sprintId, maxResults = 100) {
        const searchParams = new URLSearchParams();
        searchParams.append('maxResults', maxResults.toString());
        // Note: Using agile API endpoint for sprint issues
        const url = (0, api_1.getJiraAgileApiUrl)(this.baseUrl, `sprint/${sprintId}/issue?${searchParams.toString()}`);
        const response = await this.fetchJson(url);
        return response.issues?.map((issue) => ({
            id: issue.id,
            key: issue.key,
            summary: issue.fields?.summary || '',
            status: issue.fields?.status?.name || '',
            assignee: issue.fields?.assignee?.displayName,
            issueType: issue.fields?.issuetype?.name || '',
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
