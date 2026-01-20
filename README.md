# jira-mcp-server

A Jira MCP (Model Context Protocol) Server for Claude Code integration with Jira Server instances.

## Why This Project?

The popular [sooperset/mcp-atlassian](https://github.com/sooperset/mcp-atlassian) requires **Jira Server 8.14+**, which may not be feasible for organizations running older Jira versions that cannot upgrade due to:

- Legacy system dependencies
- Compliance or security policies
- Cost constraints
- Plugin compatibility issues

This project provides an alternative MCP server that works with **Jira Server 8.x** (tested on 8.1), enabling AI-powered Jira integration for teams stuck on older versions.

## Fork Information

Based on [@aot-tech/jira-mcp-server](https://www.npmjs.com/package/@aot-tech/jira-mcp-server) v1.0.9.

**Key modifications:**
- Enabled issue operation tools that were commented out
- Fixed authentication bug: services now correctly use Basic Auth for Jira Server
- Fixed empty response handling for update/delete/assign operations (Jira Server returns 204)
- Added integration tests with Vitest

## Supported Tools

| Tool | Description |
|------|-------------|
| `jira_get_issue_info` | Get single issue details |
| `jira_search_issues` | Search issues via JQL |
| `jira_create_issue` | Create new issue |
| `jira_update_issue` | Update existing issue |
| `jira_assign_issue` | Assign issue to user |
| `jira_add_comment` | Add comment to issue |
| `jira_delete_issue` | Delete issue |
| `jira_get_all_projects` | List all projects |
| `jira_get_project_details` | Get project details |
| `jira_get_project_users` | Get project members |
| `jira_get_current_user` | Get current user |
| `jira_get_user_profile` | Get user profile |
| `jira_lookup_account_id` | Lookup user by name |
| `jira_get_issue_types` | Get issue types |
| `jira_get_priorities` | Get priorities |
| `jira_get_statuses` | Get statuses |
| `jira_get_boards` | Get boards |
| `jira_get_sprints` | Get sprints |
| `jira_bulk_user_analytics` | User analytics |
| `jira_bulk_project_analytics` | Project analytics |

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd jira-mcp-server

# Install dependencies
npm install

# (Optional) Install globally
npm install -g .
```

## Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `JIRA_TYPE` | Jira deployment type | `server` or `cloud` |
| `JIRA_BASE_URL` | Jira server URL | `http://jira.example.com:8080` |
| `JIRA_USER_EMAIL` | Username | `username` |
| `JIRA_API_TOKEN` | API token or password | `password` |

### Claude Code Configuration

Edit `~/.claude.json`:

```json
{
  "mcpServers": {
    "jira": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/jira-mcp-server/src/index.js"],
      "env": {
        "JIRA_TYPE": "server",
        "JIRA_BASE_URL": "http://jira.example.com:8080",
        "JIRA_USER_EMAIL": "your_username",
        "JIRA_API_TOKEN": "your_password"
      }
    }
  }
}
```

## Testing

```bash
# Configure test credentials
cp tests/.env.test.example tests/.env.test
# Edit tests/.env.test with your Jira credentials

# Run tests
npm test
```

Test configuration (`tests/.env.test`):
```env
JIRA_BASE_URL=http://jira.example.com:8080
JIRA_USER_EMAIL=username
JIRA_API_TOKEN=password
TEST_PROJECT_KEY=MYPROJECT    # Optional
TEST_ISSUE_KEY=MYPROJECT-1    # Optional
```

## Compatibility

| Platform | Version | Status |
|----------|---------|--------|
| Jira Server | 8.x+ | ✅ Tested on 8.1 |
| Jira Cloud | - | ✅ Supported |
| Node.js | 18.x+ | ✅ Required |

## Comparison with Alternatives

| Feature | This Project | mcp-atlassian |
|---------|--------------|---------------|
| Jira Server 8.1 | ✅ | ❌ Requires 8.14+ |
| Jira Cloud | ✅ | ✅ |
| Create Issue | ✅ | ✅ |
| Search (JQL) | ✅ | ✅ |
| Confluence | ❌ | ✅ |
| Language | JavaScript | Python |

## License

MIT (inherited from original project)
