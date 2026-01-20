#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const dotenv_1 = __importDefault(require("dotenv"));
// Import configuration
const api_1 = require("./config/api");
// Import auth utilities
const auth_1 = require("./utils/auth");
// Import all existing tools
const issues_1 = require("./tools/issues");
const projects_1 = require("./tools/projects");
const users_1 = require("./tools/users");
const metadata_1 = require("./tools/metadata");
const boards_1 = require("./tools/boards");
// Import new bulk operations tools
const bulk_operations_1 = require("./tools/bulk-operations");
// Load environment variables
dotenv_1.default.config();
// Create MCP server instance
const server = new mcp_js_1.McpServer(api_1.SERVER_CONFIG);
// Helper function to create authenticated tool handler
function createAuthenticatedHandler(toolHandler) {
    return async (params, context) => {
        // Initialize authentication from request context/headers
        (0, auth_1.initializeAuth)();
        try {
            return await toolHandler(params);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error: ${errorMessage}`,
                    },
                ],
                isError: true,
            };
        }
    };
}
// Register existing Issues tools
server.tool(issues_1.searchIssuesTool.name, issues_1.searchIssuesTool.description, issues_1.searchIssuesTool.parameters, createAuthenticatedHandler(issues_1.searchIssuesTool.handler));
server.tool(users_1.getCurrentUserTool.name, users_1.getCurrentUserTool.description, users_1.getCurrentUserTool.parameters, createAuthenticatedHandler(users_1.getCurrentUserTool.handler));
server.tool(issues_1.getIssueTool.name, issues_1.getIssueTool.description, issues_1.getIssueTool.parameters, createAuthenticatedHandler(issues_1.getIssueTool.handler));
server.tool(issues_1.createIssueTool.name, issues_1.createIssueTool.description, issues_1.createIssueTool.parameters, createAuthenticatedHandler(issues_1.createIssueTool.handler));
server.tool(issues_1.updateIssueTool.name, issues_1.updateIssueTool.description, issues_1.updateIssueTool.parameters, createAuthenticatedHandler(issues_1.updateIssueTool.handler));
server.tool(issues_1.addCommentTool.name, issues_1.addCommentTool.description, issues_1.addCommentTool.parameters, createAuthenticatedHandler(issues_1.addCommentTool.handler));
// Register Projects tools
server.tool(projects_1.getProjectsTool.name, projects_1.getProjectsTool.description, projects_1.getProjectsTool.parameters, createAuthenticatedHandler(projects_1.getProjectsTool.handler));
server.tool(projects_1.getProjectDetailsTool.name, projects_1.getProjectDetailsTool.description, projects_1.getProjectDetailsTool.parameters, createAuthenticatedHandler(projects_1.getProjectDetailsTool.handler));
server.tool(projects_1.getProjectUsersTool.name, projects_1.getProjectUsersTool.description, projects_1.getProjectUsersTool.parameters, createAuthenticatedHandler(projects_1.getProjectUsersTool.handler));
// Register Users tools
server.tool(users_1.getUserProfileTool.name, users_1.getUserProfileTool.description, users_1.getUserProfileTool.parameters, createAuthenticatedHandler(users_1.getUserProfileTool.handler));
server.tool(users_1.lookupJiraAccountIdTool.name, users_1.lookupJiraAccountIdTool.description, users_1.lookupJiraAccountIdTool.parameters, createAuthenticatedHandler(users_1.lookupJiraAccountIdTool.handler));
// Register Metadata tools
server.tool(metadata_1.getIssueTypesTool.name, metadata_1.getIssueTypesTool.description, metadata_1.getIssueTypesTool.parameters, createAuthenticatedHandler(metadata_1.getIssueTypesTool.handler));
server.tool(metadata_1.getPrioritiesTool.name, metadata_1.getPrioritiesTool.description, metadata_1.getPrioritiesTool.parameters, createAuthenticatedHandler(metadata_1.getPrioritiesTool.handler));
server.tool(metadata_1.getStatusesTool.name, metadata_1.getStatusesTool.description, metadata_1.getStatusesTool.parameters, createAuthenticatedHandler(metadata_1.getStatusesTool.handler));
// Register Boards tools
server.tool(boards_1.getBoardsTool.name, boards_1.getBoardsTool.description, boards_1.getBoardsTool.parameters, createAuthenticatedHandler(boards_1.getBoardsTool.handler));
server.tool(boards_1.getSprintsTool.name, boards_1.getSprintsTool.description, boards_1.getSprintsTool.parameters, createAuthenticatedHandler(boards_1.getSprintsTool.handler));
// Register Resources tools
// server.tool(
//     getAtlassianResourcesTool.name,
//     getAtlassianResourcesTool.description,
//     getAtlassianResourcesTool.parameters,
//     createAuthenticatedHandler(getAtlassianResourcesTool.handler)
// );
// Register NEW BULK OPERATIONS TOOLS
server.tool(bulk_operations_1.bulkUserProductivityTool.name, bulk_operations_1.bulkUserProductivityTool.description, bulk_operations_1.bulkUserProductivityTool.parameters, createAuthenticatedHandler(bulk_operations_1.bulkUserProductivityTool.handler));
server.tool(bulk_operations_1.bulkProjectProductivityTool.name, bulk_operations_1.bulkProjectProductivityTool.description, bulk_operations_1.bulkProjectProductivityTool.parameters, createAuthenticatedHandler(bulk_operations_1.bulkProjectProductivityTool.handler));
server.tool(users_1.offboardEmployeeTool.name, users_1.offboardEmployeeTool.description, users_1.offboardEmployeeTool.parameters, createAuthenticatedHandler(users_1.offboardEmployeeTool.handler));
// server.tool(
//     teamPerformanceCorrelationTool.name,
//     teamPerformanceCorrelationTool.description,
//     teamPerformanceCorrelationTool.parameters,
//     createAuthenticatedHandler(teamPerformanceCorrelationTool.handler)
// );
// server.tool(
//     multiUserWorkloadTool.name,
//     multiUserWorkloadTool.description,
//     multiUserWorkloadTool.parameters,
//     createAuthenticatedHandler(multiUserWorkloadTool.handler)
// );
// server.tool(
//     projectUserContributionsTool.name,
//     projectUserContributionsTool.description,
//     projectUserContributionsTool.parameters,
//     createAuthenticatedHandler(projectUserContributionsTool.handler)
// );
// Stateless request handlers
async function main() {
    try {
        const transport = new stdio_js_1.StdioServerTransport();
        // console.log("🔌 Connecting Enhanced JIRA MCP server to stdio transport...");
        // Connect server to transport
        await server.connect(transport);
        // console.log("✅ Enhanced JIRA MCP server connected successfully!");
        // console.log("🚀 New bulk operations tools available:");
        // console.log("   - jira_bulk_user_productivity");
        // console.log("   - jira_team_performance_correlation");
        // console.log("   - jira_multi_user_workload");
        // console.log("   - jira_project_user_contributions");
        // console.log("🎯 Transport: STDIO (Compatible with Claude Desktop)");
        // console.log("💡 These tools are optimized for complex team analytics queries");
    }
    catch (error) {
        console.error("❌ Failed to start Enhanced JIRA MCP server:", error);
        process.exit(1);
    }
}
main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
