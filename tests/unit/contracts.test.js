import { describe, it, expect, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createJiraApiHeaders, getJiraExternalApiUrl } from '../../src/config/api.js';
import { getBoardsTool, getSprintsTool } from '../../src/tools/boards.js';
import { getProjectDetailsTool, getProjectUsersTool } from '../../src/tools/projects.js';
import { getCurrentUserTool, lookupJiraAccountIdTool, offboardEmployeeTool } from '../../src/tools/users.js';
import { bulkUserProductivityTool, bulkProjectProductivityTool } from '../../src/tools/bulk-operations.js';
import { updateIssueTool, assignIssueTool } from '../../src/tools/issues.js';

const require = createRequire(import.meta.url);
const auth = require('../../src/utils/auth.js');
const { createAuthenticatedHandler } = require('../../src/index.js');

describe('MCP tool contracts', () => {
  it('does not require cloudId for Jira Server-facing tools', () => {
    expect(getProjectDetailsTool.parameters.cloudId.safeParse(undefined).success).toBe(true);
    expect(getProjectUsersTool.parameters.cloudId.safeParse(undefined).success).toBe(true);
    expect(getCurrentUserTool.parameters.cloudId.safeParse(undefined).success).toBe(true);
    expect(lookupJiraAccountIdTool.parameters.cloudId.safeParse(undefined).success).toBe(true);
    expect(bulkUserProductivityTool.parameters.cloudId.safeParse(undefined).success).toBe(true);
    expect(bulkProjectProductivityTool.parameters.cloudId.safeParse(undefined).success).toBe(true);
  });

  it('exposes board filters instead of cloudId on Agile tools', () => {
    expect(getBoardsTool.parameters.cloudId).toBeUndefined();
    expect(getBoardsTool.parameters.projectKeyOrId.safeParse('TEST').success).toBe(true);
    expect(getBoardsTool.parameters.type.safeParse('scrum').success).toBe(true);

    expect(getSprintsTool.parameters.cloudId).toBeUndefined();
    expect(getSprintsTool.parameters.maxResults.safeParse(25).success).toBe(true);
  });

  it('marks swallowed tool errors as MCP errors at the wrapper boundary', async () => {
    const wrapped = createAuthenticatedHandler(async () => ({
      content: [{ type: 'text', text: 'Error fetching JIRA projects: bad credentials' }],
    }));

    const result = await wrapped({}, {});

    expect(result.isError).toBe(true);
  });

  it('does not report fake offboarding success', async () => {
    const result = await offboardEmployeeTool.handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not implemented');
  });
});

describe('API helpers', () => {
  it('preserves colons in Basic Auth passwords', () => {
    const headers = createJiraApiHeaders('jira-user:p:a:ss', false);
    const encoded = headers.get('Authorization').replace('Basic ', '');

    expect(Buffer.from(encoded, 'base64').toString('utf8')).toBe('jira-user:p:a:ss');
  });

  it('fails fast when Cloud gateway URL is requested without cloudId', () => {
    expect(() => getJiraExternalApiUrl(undefined, 'myself')).toThrow(/cloudId is required/);
  });
});

describe('bulk analytics', () => {
  const originalCreateService = auth.createAuthenticatedJiraService;

  afterEach(() => {
    auth.createAuthenticatedJiraService = originalCreateService;
  });

  it('paginates by actual returned count and requests the analytics field set', async () => {
    const calls = [];
    const SERVER_CAP = 50; // instance caps effective maxResults below the requested 100
    const TOTAL = 120;
    auth.createAuthenticatedJiraService = async () => ({
      searchIssues: async (_jql, pageSize, _minimalFields, startAt, raw, fields) => {
        calls.push({ pageSize, startAt, raw, fields });
        const remaining = Math.max(0, TOTAL - startAt);
        const count = Math.min(SERVER_CAP, remaining);
        const issues = Array.from({ length: count }, (_, i) =>
          makeRawIssue(`BULK-${startAt + i}`, 'u1', 'P1'));
        return { issues, total: TOTAL, startAt, hasNextPage: startAt + count < TOTAL };
      },
    });

    const result = await bulkUserProductivityTool.handler({
      users: ['u1'],
      startDate: '2026-03-01',
      endDate: '2026-03-31',
      includeCorrelation: false,
    });
    const body = JSON.parse(result.content[0].text);

    // advances by the count actually returned (50), so no issues are skipped
    expect(calls.map((c) => c.startAt)).toEqual([0, 50, 100]);
    expect(calls.every((c) => c.raw === true)).toBe(true);
    // analytics field set must include the fields the old default omitted (the B1 fix)
    expect(calls[0].fields).toContain('customfield_10016');
    expect(calls[0].fields).toContain('resolutiondate');
    expect(body.users[0].metrics.totalIssues).toBe(TOTAL);
    expect(body.metadata.issuesAnalyzed).toBe(TOTAL);
  });

  it('escapes quotes in JQL params and rejects malformed dates', async () => {
    let capturedJql = null;
    let called = 0;
    auth.createAuthenticatedJiraService = async () => ({
      searchIssues: async (jql) => {
        called += 1;
        capturedJql = jql;
        return { issues: [], total: 0, hasNextPage: false };
      },
    });

    await bulkUserProductivityTool.handler({
      users: ['u1" OR created > "1970-01-01'],
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      includeCorrelation: false,
    });
    // the injected quote is escaped, so it cannot break out of the quoted JQL string
    expect(capturedJql).toContain('\\"');
    expect(capturedJql).not.toContain('u1" OR created');

    const badDate = await bulkUserProductivityTool.handler({
      users: ['u1'],
      startDate: 'not-a-date',
      endDate: '2026-04-30',
      includeCorrelation: false,
    });
    expect(badDate.content[0].text).toMatch(/date/i);
    expect(called).toBe(1); // the malformed-date call never reached the search API
  });

  it('returns cacheable metadata for project analytics', async () => {
    auth.createAuthenticatedJiraService = async () => ({
      searchIssues: async () => ({
        issues: [makeRawIssue('CACHE-1', 'u2', 'P2')],
        total: 1,
        hasNextPage: false,
      }),
    });

    const params = {
      projectKeys: ['P2'],
      startDate: '2026-02-01',
      endDate: '2026-02-28',
    };

    const first = JSON.parse((await bulkProjectProductivityTool.handler(params)).content[0].text);
    const second = JSON.parse((await bulkProjectProductivityTool.handler(params)).content[0].text);

    expect(first.projects[0].issueCount).toBe(1);
    expect(first.metadata.cached).toBe(false);
    expect(second.metadata.cached).toBe(true);
  });
});

describe('issue write tools', () => {
  const originalCreateService = auth.createAuthenticatedJiraService;

  afterEach(() => {
    auth.createAuthenticatedJiraService = originalCreateService;
  });

  it('update/assign success messages do not leak "undefined" for void SDK calls', async () => {
    auth.createAuthenticatedJiraService = async () => ({
      updateIssue: async () => undefined,
      assignIssue: async () => undefined,
    });

    const updated = await updateIssueTool.handler({ issueKey: 'ABC-1', fields: { summary: 'x' } });
    expect(updated.content[0].text).toContain('ABC-1 updated successfully');
    expect(updated.content[0].text).not.toContain('undefined');

    const assigned = await assignIssueTool.handler({ issueKey: 'ABC-1', accountId: 'u1' });
    expect(assigned.content[0].text).toContain('ABC-1 assigned successfully');
    expect(assigned.content[0].text).not.toContain('undefined');
  });
});

function makeRawIssue(key, assigneeId, projectKey) {
  return {
    id: key,
    key,
    fields: {
      summary: `${key} summary`,
      assignee: {
        accountId: assigneeId,
        displayName: assigneeId,
        emailAddress: `${assigneeId}@example.com`,
      },
      status: {
        name: 'Done',
        statusCategory: { key: 'done' },
      },
      project: {
        key: projectKey,
        name: `${projectKey} Project`,
      },
      created: '2026-01-01T00:00:00.000+0000',
      updated: '2026-01-02T00:00:00.000+0000',
      resolutiondate: '2026-01-03T00:00:00.000+0000',
      customfield_10016: 1,
    },
  };
}
