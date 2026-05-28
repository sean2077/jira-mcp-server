"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.debugLog = debugLog;

function debugLog(message, data) {
    if (process.env.JIRA_DEBUG !== "true") {
        return;
    }
    const suffix = data === undefined ? "" : ` ${JSON.stringify(data)}`;
    console.error(`[JIRA-MCP-DEBUG] ${message}${suffix}`);
}
