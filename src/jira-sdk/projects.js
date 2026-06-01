"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JiraProjectsService = void 0;
exports.createProjectsService = createProjectsService;
const api_1 = require("../config/api");
const http_1 = require("./http");
const index_1 = require("../config/index");
class JiraProjectsService {
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
    async getProjects(cloudId, maxResults = 50) {
        let url;
        if (index_1.config.jira.type === 'server') {
            // Jira Server uses /rest/api/2/project endpoint
            url = (0, api_1.getJiraApiUrl)(this.baseUrl, 'project');
        } else {
            // Jira Cloud uses external API with cloudId
            url = (0, api_1.getJiraExternalApiUrl)(cloudId, `project/search?maxResults=${maxResults}`);
        }
        const response = await this.fetchJson(url);
        // Server returns array directly, Cloud returns { values: [...] }
        const projects = Array.isArray(response) ? response : (response.values || []);
        return projects.map((project) => ({
            id: project.id,
            key: project.key,
            name: project.name,
            projectTypeKey: project.projectTypeKey,
            simplified: project.simplified || false,
            style: project.style || "classic",
            isPrivate: project.isPrivate || false,
        }));
    }
    async getProjectDetails(projectKey) {
        const url = (0, api_1.getJiraApiUrl)(this.baseUrl, `project/${projectKey}?expand=description,lead,issueTypes,versions,components`);
        const project = await this.fetchJson(url);
        return {
            id: project.id,
            key: project.key,
            name: project.name,
            description: project.description,
            lead: project.lead ? {
                displayName: project.lead.displayName,
                accountId: project.lead.accountId || project.lead.key || project.lead.name,
            } : undefined,
            components: project.components?.map((comp) => ({
                id: comp.id,
                name: comp.name,
            })) || [],
            versions: project.versions?.map((version) => ({
                id: version.id,
                name: version.name,
                released: version.released || false,
            })) || [],
            issueTypes: project.issueTypes?.map((type) => ({
                id: type.id,
                name: type.name,
                subtask: type.subtask || false,
            })) || [],
        };
    }
    async getProjectUsers(cloudId, projectKey, maxResults = 100) {
        let url;
        if (index_1.config.jira.type === 'server') {
            // Jira Server uses assignable/search endpoint
            const params = new URLSearchParams({
                project: projectKey,
                maxResults: Math.min(maxResults, 100).toString()
            });
            url = (0, api_1.getJiraApiUrl)(this.baseUrl, `user/assignable/search?${params}`);
        } else {
            // Jira Cloud uses external API with cloudId
            const params = new URLSearchParams({
                query: `is assignee of (${projectKey})`,
                maxResults: Math.min(maxResults, 100).toString()
            });
            url = (0, api_1.getJiraExternalApiUrl)(cloudId, `user/search/query?${params}`);
        }
        const response = await this.fetchJson(url);
        // Server returns array directly, Cloud returns { values: [...] }
        const users = Array.isArray(response) ? response : (response?.values || []);
        return users.map((user) => ({
            accountId: user.accountId || user.key || user.name,
            displayName: user.displayName,
            emailAddress: user.emailAddress,
            active: user.active !== false,
        }));
    }
    setRequestTimeout(timeout) {
        this.requestTimeout = timeout;
    }
    getRequestTimeout() {
        return this.requestTimeout;
    }
}
exports.JiraProjectsService = JiraProjectsService;
// Factory function to create service instance
function createProjectsService(baseUrl, token, isOauth = false) {
    return new JiraProjectsService(baseUrl, token, isOauth);
}
