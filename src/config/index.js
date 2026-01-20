"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PORT = exports.JIRA_TYPE = exports.JIRA_BASE_URL = exports.getEnvironmentConfig = exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const environment = (process.env.NODE_ENV || "development");
// Default port for Elastic Beanstalk is 8081 in production
const defaultPort = environment === "production" ? 8081 : 3001;
exports.config = {
    server: {
        port: parseInt(process.env.PORT || defaultPort.toString(), 10),
        name: process.env.MCP_SERVER_NAME || "jira-mcp",
        version: process.env.MCP_SERVER_VERSION || "0.4.0",
        environment,
    },
    jira: {
        baseUrl: process.env.JIRA_BASE_URL || 'https://api.atlassian.com',
        type: process.env.JIRA_TYPE === "server" ? "server" : "cloud",
        oauth: {
            endpoints: {
                userInfo: "https://api.atlassian.com/me",
                accessibleResources: "https://api.atlassian.com/oauth/token/accessible-resources",
            },
        },
    },
    api: {
        endpoints: {
            mcp: "/mcp",
            health: "/health",
        },
    },
    errorCodes: {
        authenticationError: -32001,
        internalServerError: -32002,
        mcpPostError: -32002,
        mcpGetError: -32003,
    },
    session: {
        tokenExpiryBuffer: 5 * 60 * 1000, // 5 minutes in milliseconds
        cleanupInterval: 60 * 60 * 1000, // 1 hour in milliseconds
    },
    constants: {
        mcpServerName: "jira-mcp",
        mcpServerVersion: "0.4.0",
        healthServiceName: "jira-mcp-server",
        authHeaderPrefix: "Bearer ",
        jiraTokenHeader: 'X-JIRA-Token',
        jiraExternalBaseUrl: "https://api.atlassian.com/ex/jira/",
    },
};
const getEnvironmentConfig = () => {
    // Support both JIRA_BEARER_TOKEN and JIRA_USER_EMAIL:JIRA_API_TOKEN formats
    let bearerToken = process.env.JIRA_BEARER_TOKEN || null;
    if (!bearerToken && process.env.JIRA_USER_EMAIL && process.env.JIRA_API_TOKEN) {
        // Combine email and token for Basic Auth
        bearerToken = `${process.env.JIRA_USER_EMAIL}:${process.env.JIRA_API_TOKEN}`;
    }
    return {
        bearerToken,
        port: exports.config.server.port,
        environment: exports.config.server.environment,
        jiraBaseUrl: exports.config.jira.baseUrl,
        jiraType: exports.config.jira.type,
    };
};
exports.getEnvironmentConfig = getEnvironmentConfig;
// Export constants for easy access
_a = {
    JIRA_BASE_URL: exports.config.jira.baseUrl,
    JIRA_TYPE: exports.config.jira.type,
    PORT: exports.config.server.port
}, exports.JIRA_BASE_URL = _a.JIRA_BASE_URL, exports.JIRA_TYPE = _a.JIRA_TYPE, exports.PORT = _a.PORT;
