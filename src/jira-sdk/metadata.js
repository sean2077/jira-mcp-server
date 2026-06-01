"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JiraMetadataService = void 0;
exports.createMetadataService = createMetadataService;
const api_1 = require("../config/api");
const http_1 = require("./http");
const index_1 = require("../config/index");
class JiraMetadataService {
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
    async getIssueTypes(projectKey, cloudId) {
        let url;
        if (index_1.config.jira.type === 'server') {
            // Jira Server uses /rest/api/2/issuetype or project-specific endpoint
            url = (0, api_1.getJiraApiUrl)(this.baseUrl, 'issuetype');
        } else {
            // Jira Cloud uses external API with cloudId
            url = (0, api_1.getJiraExternalApiUrl)(cloudId, `issuetype?projectId=${projectKey}`);
        }
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
