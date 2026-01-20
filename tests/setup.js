import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';

// Load test environment variables
loadEnv({ path: resolve(process.cwd(), 'tests/.env.test') });

// Force Jira Server mode
process.env.JIRA_TYPE = 'server';

export function getTestConfig() {
  const baseUrl = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_USER_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;

  return {
    baseUrl,
    email,
    apiToken,
    isConfigured: !!(baseUrl && email && apiToken),
    testProjectKey: process.env.TEST_PROJECT_KEY,
    testIssueKey: process.env.TEST_ISSUE_KEY,
  };
}

export function skipIfNotConfigured() {
  const cfg = getTestConfig();
  if (!cfg.isConfigured) {
    console.log('跳过测试: 请在 tests/.env.test 中配置 Jira 凭据');
    return true;
  }
  return false;
}
