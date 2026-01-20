"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JiraProjectsService = void 0;
exports.createProjectsService = createProjectsService;
const api_1 = require("../config/api");
const index_1 = require("../config/index");
class JiraProjectsService {
    baseUrl;
    headers;
    requestTimeout = 30000;
    constructor(baseUrl, token, isOauth = false) {
        this.baseUrl = baseUrl;
        this.headers = (0, api_1.createJiraApiHeaders)(token, isOauth);
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
    async getProjects(cloudId, maxResults = 50) {
        let url;
        if (index_1.config.jira.type === 'server') {
            // Jira Server uses /rest/api/2/project endpoint
            url = (0, api_1.getJiraApiUrl)(this.baseUrl, 'project');
        } else {
            // Jira Cloud uses external API with cloudId
            url = (0, api_1.getJiraExternalApiUrl)(cloudId, `project/search?maxResults=${maxResults}`);
        }
        console.log('url', url);
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
    async getComponents(projectKey) {
        const url = (0, api_1.getJiraApiUrl)(this.baseUrl, `project/${projectKey}/components`);
        const components = await this.fetchJson(url);
        return components.map((comp) => ({
            id: comp.id,
            name: comp.name,
            description: comp.description,
            lead: comp.lead ? {
                displayName: comp.lead.displayName,
                accountId: comp.lead.accountId || comp.lead.key || comp.lead.name,
            } : undefined,
            assigneeType: comp.assigneeType || "PROJECT_DEFAULT",
            isAssigneeTypeValid: comp.isAssigneeTypeValid !== false,
        }));
    }
    async getVersions(projectKey) {
        const url = (0, api_1.getJiraApiUrl)(this.baseUrl, `project/${projectKey}/versions`);
        const versions = await this.fetchJson(url);
        return versions.map((version) => ({
            id: version.id,
            name: version.name,
            description: version.description,
            archived: version.archived || false,
            released: version.released || false,
            startDate: version.startDate,
            releaseDate: version.releaseDate,
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
