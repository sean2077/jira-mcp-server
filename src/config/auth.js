"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractBearerToken = extractBearerToken;
exports.setBearerToken = setBearerToken;
exports.getBearerToken = getBearerToken;
exports.parseCredentials = parseCredentials;
exports.validateAuthentication = validateAuthentication;
exports.initializeAuth = initializeAuth;
const index_1 = require("../config/index");
// Bearer token storage
let BEARER_TOKEN = null;
/**
 * Extract bearer token from request headers
 */
function extractBearerToken(headers = {}) {
    // Check Authorization header
    const authHeader = headers['authorization'] || headers['Authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith(index_1.config.constants.authHeaderPrefix)) {
        return authHeader.substring(index_1.config.constants.authHeaderPrefix.length); // Remove 'Bearer ' prefix
    }
    // Check X-Gmail-Token header as alternative
    const gmailTokenHeader = headers[index_1.config.constants.jiraTokenHeader.toLowerCase()] ||
        headers[index_1.config.constants.jiraTokenHeader];
    if (typeof gmailTokenHeader === 'string') {
        return gmailTokenHeader;
    }
    // Check if token is in environment as fallback
    const envConfig = (0, index_1.getEnvironmentConfig)();
    if (envConfig.bearerToken) {
        return envConfig.bearerToken;
    }
    return null;
}
/**
 * Set the current bearer token
 */
function setBearerToken(token) {
    BEARER_TOKEN = token;
}
/**
 * Get the current bearer token
 */
function getBearerToken() {
    return BEARER_TOKEN;
}
/**
 * Parse credentials from bearer token
 */
function parseCredentials(token) {
    // Token format: email:app_password or just app_password
    const parts = token.split(':');
    if (parts.length === 2) {
        return {
            email: parts[0],
            token: parts[1],
        };
    }
    return {
        token: token,
    };
}
/**
 * Validate that authentication is available
 */
function validateAuthentication() {
    if (!BEARER_TOKEN) {
        throw new Error('No bearer token available. Please provide Authorization header with Bearer token or X-Gmail-Token header.');
    }
}
/**
 * Initialize authentication from headers
 */
function initializeAuth(headers = {}) {
    const token = extractBearerToken(headers);
    setBearerToken(token);
}
