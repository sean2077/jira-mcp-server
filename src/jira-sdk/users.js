"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JiraUsersService = void 0;
exports.createUsersService = createUsersService;
const api_1 = require("../config/api");
class JiraUsersService {
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
                if (Array.isArray(errorData.errorMessages) &&
                    errorData.errorMessages.length > 0) {
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
            if (error instanceof Error && error.name === "AbortError") {
                throw new Error(`Request timeout after ${this.requestTimeout}ms`);
            }
            throw error;
        }
    }
    async lookupJiraAccountId(cloudId, searchString, maxResults = 10) {
        const searchParams = new URLSearchParams();
        if (searchString.includes("@")) {
            // Search by email
            searchParams.append("query", searchString);
        }
        else {
            // Search by display name
            searchParams.append("query", searchString);
        }
        searchParams.append("maxResults", maxResults.toString());
        const url = (0, api_1.getJiraExternalApiUrl)(cloudId, `user/search?${searchParams.toString()}`);
        const users = await this.fetchJson(url);
        return users.map((user) => ({
            accountId: user.accountId,
            displayName: user.displayName,
            emailAddress: user.emailAddress,
            accountType: user.accountType || "atlassian",
            active: user.active !== false,
        }));
    }
    async getUserProfile(accountId) {
        const url = (0, api_1.getJiraApiUrl)(this.baseUrl, `user?accountId=${accountId}`);
        const user = await this.fetchJson(url);
        return {
            accountId: user.accountId,
            displayName: user.displayName,
            emailAddress: user.emailAddress,
            active: user.active !== false,
            timeZone: user.timeZone,
            locale: user.locale,
        };
    }
    async getCurrentUser(cloudId) {
        const url = (0, api_1.getJiraExternalApiUrl)(cloudId, "myself");
        const user = await this.fetchJson(url);
        return {
            accountId: user.accountId,
            displayName: user.displayName,
            emailAddress: user.emailAddress,
            active: user.active !== false,
            timeZone: user.timeZone,
            locale: user.locale,
        };
    }
    async searchUsers(query, maxResults = 50) {
        const url = (0, api_1.getJiraApiUrl)(this.baseUrl, `user/search?query=${encodeURIComponent(query)}&maxResults=${maxResults}`);
        const users = await this.fetchJson(url);
        return users.map((user) => ({
            accountId: user.accountId,
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
exports.JiraUsersService = JiraUsersService;
// Factory function to create service instance
function createUsersService(baseUrl, token, isOauth = false) {
    return new JiraUsersService(baseUrl, token, isOauth);
}
