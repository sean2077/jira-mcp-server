"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JiraUsersService = void 0;
exports.createUsersService = createUsersService;
const api_1 = require("../config/api");
const http_1 = require("./http");
const index_1 = require("../config/index");
class JiraUsersService {
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
    async lookupJiraAccountId(cloudId, searchString, maxResults = 10) {
        const searchParams = new URLSearchParams();
        let url;
        if (index_1.config.jira.type === 'server') {
            // Jira Server uses 'username' parameter
            searchParams.append("username", searchString);
            searchParams.append("maxResults", maxResults.toString());
            url = (0, api_1.getJiraApiUrl)(this.baseUrl, `user/search?${searchParams.toString()}`);
        } else {
            // Jira Cloud uses 'query' parameter
            searchParams.append("query", searchString);
            searchParams.append("maxResults", maxResults.toString());
            url = (0, api_1.getJiraExternalApiUrl)(cloudId, `user/search?${searchParams.toString()}`);
        }
        const users = await this.fetchJson(url);
        return users.map((user) => ({
            accountId: user.accountId || user.key || user.name,
            displayName: user.displayName,
            emailAddress: user.emailAddress,
            accountType: user.accountType || "atlassian",
            active: user.active !== false,
        }));
    }
    async getUserProfile(accountId) {
        let url;
        if (index_1.config.jira.type === 'server') {
            // Jira Server uses 'username' or 'key' parameter
            url = (0, api_1.getJiraApiUrl)(this.baseUrl, `user?username=${encodeURIComponent(accountId)}`);
        } else {
            // Jira Cloud uses 'accountId' parameter
            url = (0, api_1.getJiraApiUrl)(this.baseUrl, `user?accountId=${accountId}`);
        }
        const user = await this.fetchJson(url);
        return {
            accountId: user.accountId || user.key || user.name,
            displayName: user.displayName,
            emailAddress: user.emailAddress,
            active: user.active !== false,
            timeZone: user.timeZone,
            locale: user.locale,
        };
    }
    async getCurrentUser(cloudId) {
        let url;
        if (index_1.config.jira.type === 'server') {
            url = (0, api_1.getJiraApiUrl)(this.baseUrl, "myself");
        } else {
            url = (0, api_1.getJiraExternalApiUrl)(cloudId, "myself");
        }
        const user = await this.fetchJson(url);
        return {
            accountId: user.accountId || user.key || user.name,
            displayName: user.displayName,
            emailAddress: user.emailAddress,
            active: user.active !== false,
            timeZone: user.timeZone,
            locale: user.locale,
        };
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
