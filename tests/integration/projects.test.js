import { describe, it, expect, beforeAll } from 'vitest';
import { getTestConfig, skipIfNotConfigured } from '../setup.js';
import { createProjectsService } from '../../src/jira-sdk/projects.js';

describe('Projects Service (Jira Server)', () => {
  let service;
  let testConfig;

  beforeAll(() => {
    testConfig = getTestConfig();
    if (!testConfig.isConfigured) return;

    const token = `${testConfig.email}:${testConfig.apiToken}`;
    service = createProjectsService(testConfig.baseUrl, token, false);
  });

  describe('getProjects', () => {
    it('获取项目列表', async () => {
      if (skipIfNotConfigured()) return;

      const projects = await service.getProjects(null, 50);

      expect(Array.isArray(projects)).toBe(true);
      expect(projects.length).toBeGreaterThan(0);
      expect(projects[0]).toHaveProperty('key');
      expect(projects[0]).toHaveProperty('name');
      console.log(`找到 ${projects.length} 个项目`);
    });
  });

  describe('getProjectDetails', () => {
    it('获取项目详情', async () => {
      if (skipIfNotConfigured()) return;
      if (!testConfig.testProjectKey) {
        console.log('跳过: 未配置 TEST_PROJECT_KEY');
        return;
      }

      const project = await service.getProjectDetails(testConfig.testProjectKey);

      expect(project).toHaveProperty('key', testConfig.testProjectKey);
      expect(project).toHaveProperty('name');
      expect(project).toHaveProperty('issueTypes');
      console.log(`项目: ${project.key} - ${project.name}`);
    });
  });

  describe('getProjectUsers', () => {
    it('获取项目可分配用户', async () => {
      if (skipIfNotConfigured()) return;
      if (!testConfig.testProjectKey) {
        console.log('跳过: 未配置 TEST_PROJECT_KEY');
        return;
      }

      const users = await service.getProjectUsers(null, testConfig.testProjectKey, 10);

      expect(Array.isArray(users)).toBe(true);
      if (users.length > 0) {
        expect(users[0]).toHaveProperty('displayName');
        console.log(`找到 ${users.length} 个可分配用户`);
      }
    });
  });
});
