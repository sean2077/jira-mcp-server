import { describe, it, expect, beforeAll } from 'vitest';
import { getTestConfig, skipIfNotConfigured } from '../setup.js';
import { createMetadataService } from '../../src/jira-sdk/metadata.js';

describe('Metadata Service (Jira Server)', () => {
  let service;
  let testConfig;

  beforeAll(() => {
    testConfig = getTestConfig();
    if (!testConfig.isConfigured) return;

    const token = `${testConfig.email}:${testConfig.apiToken}`;
    service = createMetadataService(testConfig.baseUrl, token, false);
  });

  describe('getIssueTypes', () => {
    it('获取Issue类型', async () => {
      if (skipIfNotConfigured()) return;

      const issueTypes = await service.getIssueTypes(null, null);

      expect(Array.isArray(issueTypes)).toBe(true);
      expect(issueTypes.length).toBeGreaterThan(0);
      expect(issueTypes[0]).toHaveProperty('name');
      console.log(`Issue类型: ${issueTypes.map(t => t.name).join(', ')}`);
    });
  });

  describe('getPriorities', () => {
    it('获取优先级', async () => {
      if (skipIfNotConfigured()) return;

      const priorities = await service.getPriorities();

      expect(Array.isArray(priorities)).toBe(true);
      expect(priorities.length).toBeGreaterThan(0);
      expect(priorities[0]).toHaveProperty('name');
      console.log(`优先级: ${priorities.map(p => p.name).join(', ')}`);
    });
  });

  describe('getStatuses', () => {
    it('获取状态', async () => {
      if (skipIfNotConfigured()) return;

      const statuses = await service.getStatuses();

      expect(Array.isArray(statuses)).toBe(true);
      expect(statuses.length).toBeGreaterThan(0);
      expect(statuses[0]).toHaveProperty('name');
      console.log(`状态: ${statuses.map(s => s.name).join(', ')}`);
    });
  });

  describe('getFields', () => {
    it('获取字段', async () => {
      if (skipIfNotConfigured()) return;

      const fields = await service.getFields();

      expect(Array.isArray(fields)).toBe(true);
      expect(fields.length).toBeGreaterThan(0);
      console.log(`共 ${fields.length} 个字段`);
    });
  });
});
