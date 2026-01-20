import { describe, it, expect, beforeAll } from 'vitest';
import { getTestConfig, skipIfNotConfigured } from '../setup.js';
import { createUsersService } from '../../src/jira-sdk/users.js';

describe('Users Service (Jira Server)', () => {
  let service;
  let testConfig;

  beforeAll(() => {
    testConfig = getTestConfig();
    if (!testConfig.isConfigured) return;

    const token = `${testConfig.email}:${testConfig.apiToken}`;
    service = createUsersService(testConfig.baseUrl, token, false);
  });

  describe('getCurrentUser', () => {
    it('获取当前用户', async () => {
      if (skipIfNotConfigured()) return;

      const user = await service.getCurrentUser(null);

      expect(user).toHaveProperty('accountId');
      expect(user).toHaveProperty('displayName');
      console.log(`当前用户: ${user.displayName} (${user.accountId})`);
    });
  });

  describe('getUserProfile', () => {
    it('获取用户信息', async () => {
      if (skipIfNotConfigured()) return;

      // 使用配置的用户名查询
      const user = await service.getUserProfile(testConfig.email);

      expect(user).toHaveProperty('displayName');
      console.log(`用户: ${user.displayName}`);
    });
  });

  describe('lookupJiraAccountId', () => {
    it('搜索用户', async () => {
      if (skipIfNotConfigured()) return;

      const users = await service.lookupJiraAccountId(null, testConfig.email, 10);

      expect(Array.isArray(users)).toBe(true);
      if (users.length > 0) {
        console.log(`找到 ${users.length} 个匹配用户`);
      }
    });
  });
});
