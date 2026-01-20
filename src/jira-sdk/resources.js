"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JiraResourcesService = void 0;
exports.createResourcesService = createResourcesService;
const api_1 = require("../config/api");
const config_1 = require("../config");
class JiraResourcesService {
    headers;
    requestTimeout = 30000;
    constructor(token, isOauth = false) {
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
    async getCurrentUserInfo() {
        const url = config_1.config.jira.oauth.endpoints.userInfo;
        const userInfo = await this.fetchJson(url);
        return {
            account_id: userInfo.account_id,
            name: userInfo.name,
            email: userInfo.email,
            picture: userInfo.picture,
        };
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
