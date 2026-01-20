"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BEARER_TOKEN = exports.extractErrorMessage = void 0;
exports.setBearerToken = setBearerToken;
exports.getBearerToken = getBearerToken;
exports.extractBearerToken = extractBearerToken;
exports.parseCredentials = parseCredentials;
exports.initializeAuth = initializeAuth;
exports.getJiraBaseUrlFromSession = getJiraBaseUrlFromSession;
exports.createJiraServices = createJiraServices;
exports.createAuthenticatedJiraServices = createAuthenticatedJiraServices;
exports.createAuthenticatedJiraService = createAuthenticatedJiraService;
const issues_1 = require("../jira-sdk/issues");
const projects_1 = require("../jira-sdk/projects");
const users_1 = require("../jira-sdk/users");
const metadata_1 = require("../jira-sdk/metadata");
const boards_1 = require("../jira-sdk/boards");
const resources_1 = require("../jira-sdk/resources");
const config_1 = require("../config");
// Bearer token storage
let BEARER_TOKEN = null;
exports.BEARER_TOKEN = BEARER_TOKEN;
/**
 * Set the current bearer token
 */
function setBearerToken(token) {
    exports.BEARER_TOKEN = BEARER_TOKEN = token;
}
/**
 * Get the current bearer token
 */
function getBearerToken() {
    return BEARER_TOKEN;
}
/**
 * Extract bearer token from request headers
 */
function extractBearerToken(headers = {}) {
    // Check if token is in environment as fallback
    const envConfig = (0, config_1.getEnvironmentConfig)();
    if (envConfig.bearerToken) {
        return envConfig.bearerToken;
    }
    return null;
}
/**
 * Parse credentials from bearer token
 */
function parseCredentials(token) {
    // For Jira, we need to determine if it's OAuth or API token
    // OAuth tokens are typically longer and JWT-like
    // API tokens are shorter and base64-encoded email:token
    // Check if it looks like a JWT (OAuth token)
    const isJwtLike = token.includes('.') && token.split('.').length === 3;
    if (isJwtLike) {
        // OAuth token
        return {
            token: token,
            isOauth: true,
        };
    }
    // Try to decode as base64 for API token format (email:token)
    try {
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        const parts = decoded.split(':');
        if (parts.length === 2) {
            return {
                email: parts[0],
                token: token, // Keep the original base64 token
                isOauth: false,
            };
        }
    }
    catch (e) {
        // Not base64, treat as direct API token
    }
    // Default to treating as API token
    return {
        token: token,
        isOauth: false,
    };
}
/**
 * Initialize authentication from headers and set context
 */
function initializeAuth(headers = {}) {
    // console.log("headers **********", headers);
    const token = extractBearerToken(headers);
    if (token) {
        // Set the credentials in the async local storage context
        setBearerToken(token);
    }
}
// Helper function to get JIRA base URL from OAuth session
async function getJiraBaseUrlFromSession(accessToken) {
    const resourcesResponse = await fetch(config_1.config.jira.oauth.endpoints.accessibleResources, {
        headers: {
            Authorization: `${config_1.config.constants.authHeaderPrefix}${accessToken}`,
            Accept: "application/json",
        },
    });
    if (resourcesResponse) {
        const resources = await resourcesResponse.json();
        if (resources && resources.length > 0) {
            return config_1.config.constants.jiraExternalBaseUrl + resources[0].id;
        }
        return config_1.JIRA_BASE_URL;
    }
    else {
        return config_1.config.constants.jiraExternalBaseUrl;
    }
}
// Helper function to create JIRA services
async function createJiraServices(isOauth, token) {
    // For OAuth tokens from sessions, use them directly
    let jiraBaseUrl = "";
    if (isOauth) {
        jiraBaseUrl = await getJiraBaseUrlFromSession(token);
    }
    else {
        jiraBaseUrl = config_1.JIRA_BASE_URL;
    }
    return {
        issues: (0, issues_1.createIssuesService)(jiraBaseUrl, token, isOauth),
        projects: (0, projects_1.createProjectsService)(jiraBaseUrl, token, isOauth),
        users: (0, users_1.createUsersService)(jiraBaseUrl, token, isOauth),
        metadata: (0, metadata_1.createMetadataService)(jiraBaseUrl, token, isOauth),
        boards: (0, boards_1.createBoardsService)(jiraBaseUrl, token, isOauth),
        resources: (0, resources_1.createResourcesService)(token, isOauth)
    };
}
// Pure function to create authenticated JIRA services
async function createAuthenticatedJiraServices() {
    const token = getBearerToken();
    return await createJiraServices(true, token || '');
}
// Backward compatibility - create individual service
async function createAuthenticatedJiraService() {
    const services = await createAuthenticatedJiraServices();
    // Create a composite service that maintains the old interface
    return {
        // Issues methods
        searchIssues: (searchString, maxResults, minimalFields, startAt) => services.issues.searchIssues(searchString, maxResults, minimalFields, startAt),
        getIssueWithComments: (issueId, maxComments) => services.issues.getIssueWithComments(issueId, maxComments),
        createIssue: (params) => {
            const { projectKey, issueType, summary, description, ...fields } = params;
            return services.issues.createIssue(projectKey, issueType, summary, description, fields);
        },
        updateIssue: (issueKey, fields) => services.issues.updateIssue(issueKey, fields),
        deleteIssue: (issueKey) => services.issues.deleteIssue(issueKey),
        assignIssue: (issueKey, accountId) => services.issues.assignIssue(issueKey, accountId),
        addComment: (issueKey, comment) => services.issues.addCommentToIssue(issueKey, comment),
        // Projects methods
        getProjects: (cloudId, maxResults) => services.projects.getProjects(cloudId, maxResults),
        getProjectDetails: (projectKey) => services.projects.getProjectDetails(projectKey),
        getProjectUsers: (cloudId, projectKey, maxResults) => services.projects.getProjectUsers(cloudId, projectKey, maxResults),
        // Users methods
        getUserProfile: (accountId) => services.users.getUserProfile(accountId),
        lookupJiraAccountId: (cloudId, searchString, maxResults) => services.users.lookupJiraAccountId(cloudId, searchString, maxResults),
        // Metadata methods
        getIssueTypes: (projectKey, cloudId) => services.metadata.getIssueTypes(projectKey, cloudId),
        getPriorities: () => services.metadata.getPriorities(),
        getStatuses: () => services.metadata.getStatuses(),
        // Boards methods
        getBoards: (projectKeyOrId, type, maxResults) => services.boards.getBoards(projectKeyOrId, type, maxResults),
        getSprints: (boardId, state, maxResults) => services.boards.getSprints(boardId, state, maxResults),
        // Resources methods
        getAccessibleAtlassianResources: () => services.resources.getAccessibleAtlassianResources(),
        // Users methods
        getCurrentUser: (cloudId) => services.users.getCurrentUser(cloudId)
    };
}
// Helper function to extract meaningful error messages
const extractErrorMessage = (error) => {
    console.log('Error object:', {
        name: error.name,
        message: error.message,
        code: error.code,
        status: error.status,
        hasResponse: !!error.response,
        responseData: error.response?.data,
        responseStatus: error.response?.status
    });
    // Handle Axios errors specifically
    if (error.name === 'AxiosError' || error.isAxiosError) {
        // Check if we have a response with error details
        if (error.response?.data) {
            const { status, data } = error.response;
            // Extract the specific error message from API response
            if (data.message) {
                const errorCode = data.code ? ` (Code: ${data.code})` : '';
                return `${data.message}${errorCode}`;
            }
            if (data.error) {
                return data.error;
            }
            if (data.errors && Array.isArray(data.errors)) {
                return data.errors.join(', ');
            }
            // If no specific message, use status-based message
            switch (status) {
                case 401:
                    return 'Authentication failed. Please check your API credentials.';
                case 403:
                    return 'Access denied. Check your permissions for this resource.';
                case 404:
                    return 'Resource not found. Please verify the provided IDs.';
                case 429:
                    return 'Rate limit exceeded. Please try again later.';
                case 500:
                    return 'Internal server error. Please try again later.';
                default:
                    return `HTTP ${status}: ${JSON.stringify(data)}`;
            }
        }
        // Handle Axios errors without response data
        if (error.code) {
            switch (error.code) {
                case 'ERR_BAD_REQUEST':
                    return 'Bad request. Please check your request parameters.';
                case 'ECONNREFUSED':
                    return 'Connection refused. Please check if the service is running.';
                case 'ENOTFOUND':
                    return 'Network error. Please check your internet connection.';
                case 'ETIMEDOUT':
                    return 'Request timeout. Please try again.';
                default:
                    return `Network error: ${error.code}`;
            }
        }
    }
    // Fallback for non-Axios errors
    return error.message || 'An unexpected error occurred';
};
exports.extractErrorMessage = extractErrorMessage;
