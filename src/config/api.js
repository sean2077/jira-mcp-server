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
        },
        getTransitions: {
            name: "jira_get_transitions",
            description: "Get available workflow transitions for a Jira issue (shows what status changes are possible)"
        },
        transition: {
            name: "jira_transition_issue",
            description: "Transition a Jira issue to a new status (e.g., To Do -> In Progress -> Done)"
        },
        getLinkTypes: {
            name: "jira_get_issue_link_types",
            description: "Get available issue link types (e.g., Blocks, Relates to, Duplicates)"
        },
        createLink: {
            name: "jira_create_issue_link",
            description: "Create a link between two Jira issues (e.g., blocks, relates to, duplicates)"
        },
        deleteLink: {
            name: "jira_delete_issue_link",
            description: "Delete a link between two Jira issues by link ID"
        },
        addWorklog: {
            name: "jira_add_worklog",
            description: "Log time spent on a Jira issue (worklog)"
        },
        getWatchers: {
            name: "jira_get_watchers",
            description: "Get watchers of a Jira issue"
        },
        manageWatchers: {
            name: "jira_manage_watchers",
            description: "Add or remove a watcher on a Jira issue"
        },
        batchSearch: {
            name: "jira_batch_search",
            description: "Execute multiple JQL queries in parallel and return all results at once. Use this instead of multiple jira_search_issues calls when you need to run 2+ independent queries."
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
        },
        fields: {
            name: "jira_get_fields",
            description: "Get all available Jira fields including custom fields"
        },
        workflows: {
            name: "jira_get_workflows",
            description: "Get workflow statuses for each issue type in a Jira project"
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
