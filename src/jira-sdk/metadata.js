"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JiraMetadataService = void 0;
exports.createMetadataService = createMetadataService;
const api_1 = require("../config/api");
const index_1 = require("../config/index");
class JiraMetadataService {
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
    async getIssueTypes(projectKey, cloudId) {
        let url;
        if (index_1.config.jira.type === 'server') {
            // Jira Server uses /rest/api/2/issuetype or project-specific endpoint
            url = (0, api_1.getJiraApiUrl)(this.baseUrl, 'issuetype');
        } else {
            // Jira Cloud uses external API with cloudId
            url = (0, api_1.getJiraExternalApiUrl)(cloudId, `issuetype?projectId=${projectKey}`);
        }
        console.log('url in issue types', url);
        const response = await this.fetchJson(url);
        return (response || []).map((issueType) => ({
            id: issueType.id,
            name: issueType.name,
            description: issueType.description || '',
            subtask: issueType.subtask || false,
            iconUrl: issueType.iconUrl || '',
        }));
    }
    async getPriorities() {
        const url = (0, api_1.getJiraApiUrl)(this.baseUrl, "priority");
        const priorities = await this.fetchJson(url);
        return priorities.map((priority) => ({
            id: priority.id,
            name: priority.name,
            description: priority.description,
            iconUrl: priority.iconUrl || '',
            statusColor: priority.statusColor || '#42526E',
        }));
    }
    async getStatuses() {
        const url = (0, api_1.getJiraApiUrl)(this.baseUrl, "status");
        const statuses = await this.fetchJson(url);
        return statuses.map((status) => ({
            id: status.id,
            name: status.name,
            description: status.description || '',
            statusCategory: {
                id: status.statusCategory?.id || 0,
                key: status.statusCategory?.key || 'new',
                colorName: status.statusCategory?.colorName || 'blue-gray',
                name: status.statusCategory?.name || 'To Do',
            },
        }));
    }
    async getFields() {
        const url = (0, api_1.getJiraApiUrl)(this.baseUrl, "field");
        const fields = await this.fetchJson(url);
        return fields.map((field) => ({
            id: field.id,
            name: field.name,
            custom: field.custom || false,
            orderable: field.orderable !== false,
            navigable: field.navigable !== false,
            searchable: field.searchable !== false,
            schema: field.schema ? {
                type: field.schema.type,
                system: field.schema.system,
            } : undefined,
        }));
    }
    async getWorkflows(projectKey) {
        const url = (0, api_1.getJiraApiUrl)(this.baseUrl, `project/${projectKey}/statuses`);
        const statusesData = await this.fetchJson(url);
        return statusesData.map((issueType) => ({
            id: issueType.id,
            name: issueType.name,
            description: issueType.description,
            statuses: issueType.statuses?.map((status) => ({
                id: status.id,
                name: status.name,
            })) || [],
        }));
    }
    setRequestTimeout(timeout) {
        this.requestTimeout = timeout;
    }
    getRequestTimeout() {
        return this.requestTimeout;
    }
}
exports.JiraMetadataService = JiraMetadataService;
// Factory function to create service instance
function createMetadataService(baseUrl, token, isOauth = false) {
    return new JiraMetadataService(baseUrl, token, isOauth);
}
