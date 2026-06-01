import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { jiraFetchJson, jiraFetchVoid } = require('../../src/jira-sdk/http.js');

const HEADERS = new Headers({ Authorization: 'Basic test', Accept: 'application/json' });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('jira-sdk http helper', () => {
  it('jiraFetchJson returns parsed JSON on 200', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ hello: 'world' }),
    })));
    const data = await jiraFetchJson('http://x/rest/api/2/myself', HEADERS, undefined, 1000);
    expect(data).toEqual({ hello: 'world' });
  });

  it('jiraFetchJson throws a Jira error with joined errorMessages on failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ errorMessages: ['Issue does not exist', 'or no permission'] }),
    })));
    await expect(jiraFetchJson('http://x', HEADERS, undefined, 1000))
      .rejects.toThrow(/Issue does not exist; or no permission \(Status: 404\)/);
  });

  it('jiraFetchVoid resolves on 204 without parsing a body', async () => {
    const json = vi.fn(async () => {
      throw new Error('json() must not be called for void requests');
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 204, json })));
    await expect(jiraFetchVoid('http://x', HEADERS, { method: 'DELETE' }, 1000)).resolves.toBeUndefined();
    expect(json).not.toHaveBeenCalled();
  });

  it('converts an aborted (timed-out) request into a timeout error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    }));
    await expect(jiraFetchJson('http://x', HEADERS, undefined, 1234))
      .rejects.toThrow('Request timeout after 1234ms');
  });

  it('merges per-call headers over the service default headers', async () => {
    let seen;
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      seen = init.headers;
      return { ok: true, status: 200, json: async () => ({}) };
    }));
    await jiraFetchJson('http://x', HEADERS, { headers: { 'X-Extra': '1' } }, 1000);
    // Headers.entries() normalises names to lower-case; per-call headers are spread as-is.
    expect(seen.authorization).toBe('Basic test');
    expect(seen['X-Extra']).toBe('1');
  });
});
