import { describe, it, expect, beforeAll } from 'vitest';
import { getTestConfig, skipIfNotConfigured } from '../setup.js';
import { createIssuesService } from '../../src/jira-sdk/issues.js';

describe('Issues Service (Jira Server)', () => {
  let service;
  let testConfig;

  beforeAll(() => {
    testConfig = getTestConfig();
    if (!testConfig.isConfigured) return;

    const token = `${testConfig.email}:${testConfig.apiToken}`;
    service = createIssuesService(testConfig.baseUrl, token, false);
  });

  describe('searchIssues', () => {
    it('搜索Issue', async () => {
      if (skipIfNotConfigured()) return;

      const result = await service.searchIssues('order by created DESC', 10, false, 0);

      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.issues)).toBe(true);
      console.log(`找到 ${result.total} 个Issue`);
    });

    it('分页查询', async () => {
      if (skipIfNotConfigured()) return;

      const page1 = await service.searchIssues('order by created DESC', 5, false, 0);

      expect(page1.startAt).toBe(0);
      if (page1.total > 5) {
        const page2 = await service.searchIssues('order by created DESC', 5, false, 5);
        expect(page2.startAt).toBe(5);
      }
    });

    it('按项目搜索', async () => {
      if (skipIfNotConfigured()) return;
      if (!testConfig.testProjectKey) {
        console.log('跳过: 未配置 TEST_PROJECT_KEY');
        return;
      }

      const result = await service.searchIssues(
        `project = ${testConfig.testProjectKey}`,
        10, false, 0
      );

      expect(result.issues).toBeDefined();
      console.log(`项目 ${testConfig.testProjectKey} 中找到 ${result.total} 个Issue`);
    });
  });

  describe('getIssueWithComments', () => {
    it('获取Issue详情', async () => {
      if (skipIfNotConfigured()) return;
      if (!testConfig.testIssueKey) {
        console.log('跳过: 未配置 TEST_ISSUE_KEY');
        return;
      }

      const issue = await service.getIssueWithComments(testConfig.testIssueKey);

      expect(issue).toHaveProperty('key', testConfig.testIssueKey);
      expect(issue).toHaveProperty('summary');
      expect(issue).toHaveProperty('status');
      console.log(`Issue: ${issue.key} - ${issue.summary}`);
    });
  });

  describe('createIssue', () => {
    it('创建Issue', async () => {
      if (skipIfNotConfigured()) return;
      if (!testConfig.testProjectKey) {
        console.log('跳过: 未配置 TEST_PROJECT_KEY');
        return;
      }

      const summary = `测试Issue - ${new Date().toISOString()}`;
      const result = await service.createIssue(
        testConfig.testProjectKey,
        '任务',  // Jira Server 中文环境使用中文类型名
        summary,
        '这是自动化测试创建的Issue',
        { assignee: { name: testConfig.email } }  // 创建时指定经办人
      );

      expect(result).toHaveProperty('key');
      expect(result.key).toContain(testConfig.testProjectKey);
      console.log(`Issue已创建: ${result.key}`);

      // 清理：删除创建的测试Issue
      if (result.key) {
        try {
          await service.deleteIssue(result.key);
          console.log(`已清理测试Issue: ${result.key}`);
        } catch (e) {
          console.log(`注意: 无法删除测试Issue ${result.key}，请手动清理`);
        }
      }
    });
  });

  describe('updateIssue', () => {
    it('更新Issue摘要', async () => {
      if (skipIfNotConfigured()) return;
      if (!testConfig.testIssueKey) {
        console.log('跳过: 未配置 TEST_ISSUE_KEY');
        return;
      }

      // 先获取原始摘要
      const original = await service.getIssueWithComments(testConfig.testIssueKey);
      const newSummary = `[测试更新] ${original.summary}`;

      await service.updateIssue(testConfig.testIssueKey, {
        summary: newSummary,
      });

      const updated = await service.getIssueWithComments(testConfig.testIssueKey);
      expect(updated.summary).toBe(newSummary);
      console.log(`Issue已更新: ${updated.summary}`);

      // 恢复原始摘要
      await service.updateIssue(testConfig.testIssueKey, {
        summary: original.summary,
      });
      console.log(`已恢复原始摘要`);
    });

    it('更新Issue描述', async () => {
      if (skipIfNotConfigured()) return;
      if (!testConfig.testIssueKey) {
        console.log('跳过: 未配置 TEST_ISSUE_KEY');
        return;
      }

      // 先获取原始描述
      const original = await service.getIssueWithComments(testConfig.testIssueKey);
      const originalDescription = original.description || '';
      const newDescription = `测试描述更新 - ${new Date().toISOString()}\n\n原始描述：${originalDescription}`;

      await service.updateIssue(testConfig.testIssueKey, {
        description: newDescription,
      });

      const updated = await service.getIssueWithComments(testConfig.testIssueKey);
      expect(updated.description).toContain('测试描述更新');
      console.log(`描述已更新: ${updated.description?.substring(0, 50)}...`);

      // 恢复原始描述
      await service.updateIssue(testConfig.testIssueKey, {
        description: originalDescription,
      });
      console.log(`已恢复原始描述`);
    });
  });

  describe('assignIssue', () => {
    it('分配经办人', async () => {
      if (skipIfNotConfigured()) return;
      if (!testConfig.testIssueKey) {
        console.log('跳过: 未配置 TEST_ISSUE_KEY');
        return;
      }

      // 使用当前用户作为经办人
      const username = testConfig.email;
      await service.assignIssue(testConfig.testIssueKey, username);

      const issue = await service.getIssueWithComments(testConfig.testIssueKey);
      expect(issue.assignee).toBeDefined();
      console.log(`已分配经办人: ${issue.assignee}`);
    });
  });

  describe('addCommentToIssue', () => {
    it('添加评论', async () => {
      if (skipIfNotConfigured()) return;
      if (!testConfig.testIssueKey) {
        console.log('跳过: 未配置 TEST_ISSUE_KEY');
        return;
      }

      const comment = `测试评论 - ${new Date().toISOString()}`;
      const result = await service.addCommentToIssue(testConfig.testIssueKey, comment);

      expect(result).toHaveProperty('id');
      console.log(`评论已添加，ID: ${result.id}`);
    });
  });
});
