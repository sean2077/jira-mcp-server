# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Jira MCP (Model Context Protocol) Server forked from @aot-tech/jira-mcp-server. The key differentiator is **support for legacy Jira Server 8.x versions** (tested on 8.1), whereas alternatives like mcp-atlassian require Jira Server 8.14+.

## Commands

```bash
npm install          # Install dependencies
npm start            # Start MCP server (equivalent to: node src/index.js)
npm test             # Run integration tests
npm run test:watch   # Run tests in watch mode
```

No build step required - source files are JavaScript.

## Testing

Tests use Vitest with real Jira Server integration. Configure credentials in `tests/.env.test`:

```env
JIRA_BASE_URL=http://jira.example.com:8080
JIRA_USER_EMAIL=username
JIRA_API_TOKEN=password
TEST_PROJECT_KEY=D1        # Optional: for create/update tests
TEST_ISSUE_KEY=D1-1        # Optional: for update/comment tests
```

Test files: `tests/integration/*.test.js`

## Architecture

**Three-layer architecture:**

```
src/config/     → Configuration, API client setup, auth config
       ↓
src/jira-sdk/   → Jira API abstraction layer (service classes)
       ↓
src/tools/      → MCP tool definitions and handlers (Zod validation)
```

**Entry point:** `src/index.js` - Initializes MCP server, registers 19 tools

**Key patterns:**
- `createAuthenticatedJiraService()` in `src/utils/auth.js` - Factory creating all service instances per request
- Each tool in `src/tools/` exports: name, description, Zod schema, handler function
- Services in `src/jira-sdk/` handle raw Jira REST API calls with error extraction

## Environment Configuration

Required:
```env
JIRA_TYPE=server|cloud           # Affects API version (v2 for Server, v3 for Cloud)
JIRA_BASE_URL=http://jira:8080   # Jira instance URL
JIRA_USER_EMAIL=username         # For Server: username; For Cloud: email
JIRA_API_TOKEN=password          # For Server: password; For Cloud: API token
```

## API Version Handling

The codebase auto-selects REST API version based on `JIRA_TYPE`:
- **Server (8.x):** Uses `/rest/api/2/` with Basic Auth
- **Cloud:** Uses `/rest/api/3/` with OAuth Bearer Token

Key file: `src/config/api.js` - `getJiraApiUrl()` function handles URL construction.

## Tool Categories

| Category | Files | Tools |
|----------|-------|-------|
| Issues | `jira-sdk/issues.js`, `tools/issues.js` | search, get, create, update, assign, comment, delete |
| Projects | `jira-sdk/projects.js`, `tools/projects.js` | list, details, users |
| Users | `jira-sdk/users.js`, `tools/users.js` | profile, lookup, offboard |
| Metadata | `jira-sdk/metadata.js`, `tools/metadata.js` | issue types, priorities, statuses |
| Boards | `jira-sdk/boards.js`, `tools/boards.js` | boards, sprints |
| Bulk Ops | `tools/bulk-operations.js` | user/project analytics with caching |

## Adding New Tools

1. Add service method in appropriate `src/jira-sdk/*.js` file
2. Create tool definition in `src/tools/*.js` with Zod schema
3. Register tool in `src/index.js` via the tools array

## Error Handling

Error extraction logic is in `src/utils/auth.js` - `extractJiraErrorMessage()`. HTTP status codes map to user-friendly messages. Jira-specific error response formats are parsed for detailed feedback.
