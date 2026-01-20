"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOLS_CONFIG = exports.SERVER_CONFIG = void 0;
exports.createJiraApiHeaders = createJiraApiHeaders;
exports.getJiraApiUrl = getJiraApiUrl;
exports.getJiraAgileApiUrl = getJiraAgileApiUrl;
exports.getJiraExternalApiUrl = getJiraExternalApiUrl;
const index_1 = require("./index");
// Server configuration for MCP
exports.SERVER_CONFIG = {
    name: index_1.config.constants.mcpServerName,
    version: index_1.config.constants.mcpServerVersion,
    description: "A service that integrates with Jira API to manage issues, projects, and users (stateless with user-specific tokens)",
    capabilities: {
        tools: {
        // listChanged: true,
        },
    },
};
// Tools configuration
exports.TOOLS_CONFIG = {
    issues: {
        search: {
            name: "jira_search_issues",
            description: `Search for Jira issues or tasks or tickets using JQL query string.
     
   `
        },
        get: {
            name: "jira_get_issue_info",
            description: "Get detailed information about a specific Jira issue or task or ticket by key or ID"
        },
        create: {
            name: "jira_create_issue",
            description: "Create a new Jira issue in a specified project"
        },
        update: {
            name: "jira_update_issue",
            description: "Update an existing Jira issue with new field values"
        },
        delete: {
            name: "jira_delete_issue",
            description: "Delete a Jira issue (if permissions allow)"
        },
        assign: {
            name: "jira_assign_issue",
            description: "Assign a Jira issue to a user"
        },
        comment: {
            name: "jira_add_comment_to_issue",
            description: "Add a comment to a Jira issue"
        }
    },
    projects: {
        list: {
            name: "jira_get_all_projects",
            description: "Get all accessible Jira projects or teams. returns always a list of projects"
        },
        details: {
            name: "jira_get_project_details",
            description: "Get detailed information about a specific Jira project or team"
        },
        users: {
            name: "jira_get_project_users",
            description: "Get users who have access to a specific Jira project or team"
        }
    },
    users: {
        current: {
            name: "jira_get_current_user",
            description: "Get current user  information"
        },
        profile: {
            name: "jira_get_user_profile",
            description: "Get user profile information by account ID"
        },
        lookup: {
            name: "jira_lookup_account_id",
            description: "Look up Jira account ID by email or display name "
        },
        offboard: {
            name: "jira_offboard_employee",
            description: "Process employee offboarding in JIRA - removes user access, reassigns issues, and generates final reports"
        }
    },
    metadata: {
        issueTypes: {
            name: "jira_get_issue_types",
            description: "  Get available issue types for a project"
        },
        priorities: {
            name: "jira_get_priorities",
            description: "Get JIRA available issue priorities"
        },
        statuses: {
            name: "jira_get_statuses",
            description: "Get JIRA available issue statuses"
        }
    },
    boards: {
        list: {
            name: "jira_get_boards",
            description: "Get JIRA boards (Scrum/Kanban)"
        },
        sprints: {
            name: "jira_get_sprints",
            description: "Get sprints for a specific board in JIRA"
        }
    },
    resources: {
        list: {
            name: "jira_get_cloud_id",
            description: "Get JIRA cloud id"
        }
    }
};
// API client will be dynamically created with user tokens
// This matches Clockify's pattern but for Jira
function createJiraApiHeaders(token, isOauth = false) {
    if (isOauth) {
        return new Headers({
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
        });
    }
    else {
        // For basic auth with email:token
        const [email, apiToken] = token.split(':');
        if (!email || !apiToken) {
            throw new Error('Token must be in format email:api_token for basic auth');
        }
        const basicAuth = btoa(`${email}:${apiToken}`);
        return new Headers({
            Authorization: `Basic ${basicAuth}`,
            Accept: "application/json",
            "Content-Type": "application/json",
        });
    }
}
// Base URL construction
function getJiraApiUrl(baseUrl, endpoint) {
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    const cleanEndpoint = endpoint.replace(/^\//, '');
    // Use API v2 for Jira Server, v3 for Jira Cloud
    const apiVersion = index_1.config.jira.type === 'server' ? '2' : '3';
    return `${cleanBaseUrl}/rest/api/${apiVersion}/${cleanEndpoint}`;
}
function getJiraAgileApiUrl(baseUrl, endpoint) {
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    const cleanEndpoint = endpoint.replace(/^\//, '');
    return `${cleanBaseUrl}/rest/agile/1.0/${cleanEndpoint}`;
}
function getJiraExternalApiUrl(cloudId, endpoint) {
    const cleanEndpoint = endpoint.replace(/^\//, '');
    return `${index_1.config.constants.jiraExternalBaseUrl}${cloudId}/rest/api/3/${cleanEndpoint}`;
}
