"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JiraResourcesService = void 0;
exports.createResourcesService = createResourcesService;
const api_1 = require("../config/api");
const http_1 = require("./http");
const config_1 = require("../config");
class JiraResourcesService {
    headers;
    requestTimeout = 30000;
    constructor(token, isOauth = false) {
        // Cloud-only resource discovery: the sole authenticated call here is the OAuth
        // accessible-resources endpoint, so Bearer auth is forced. Jira Server short-circuits in
        // getAccessibleAtlassianResources() with a placeholder and never uses these headers, so
        // jira_get_cloud_id is OAuth/Cloud-only by design (the isOauth arg is intentionally ignored).
        this.headers = (0, api_1.createJiraApiHeaders)(token, true);
    }
    async fetchJson(url, init) {
        return (0, http_1.jiraFetchJson)(url, this.headers, init, this.requestTimeout);
    }
    async getAccessibleAtlassianResources() {
        // For Jira Server, cloudId is not needed - return a placeholder
        if (config_1.config.jira.type === 'server') {
            return [{
                id: 'server',
                name: 'Jira Server',
                url: config_1.config.jira.baseUrl,
                scopes: [],
                avatarUrl: '',
                note: 'Jira Server does not use cloudId. You can skip the cloudId parameter for other API calls.',
            }];
        }
        const url = config_1.config.jira.oauth.endpoints.accessibleResources;
        const resources = await this.fetchJson(url);
        return resources.map((resource) => ({
            id: resource.id,
            name: resource.name,
            url: resource.url,
            scopes: resource.scopes || [],
            avatarUrl: resource.avatarUrl || '',
        }));
    }
    setRequestTimeout(timeout) {
        this.requestTimeout = timeout;
    }
    getRequestTimeout() {
        return this.requestTimeout;
    }
}
exports.JiraResourcesService = JiraResourcesService;
// Factory function to create service instance
function createResourcesService(token, isOauth = false) {
    return new JiraResourcesService(token, isOauth);
}
