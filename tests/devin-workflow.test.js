const test = require('node:test');
const assert = require('node:assert/strict');
const { readStepDefinitionsBundle } = require('./helpers/script-bundles.js');

const scope = {};
new Function('self', `${readStepDefinitionsBundle()}; return self.MultiPageStepDefinitions;`)(scope);

test('Devin has its own ordered, executable registration flow', () => {
  const steps = scope.MultiPageStepDefinitions.getSteps({ activeFlowId: 'devin' });
  assert.deepEqual(steps.map(({ title }) => title), [
    '清理 Cookies 并打开注册网站', '输入邮箱', '输入邮箱验证码', '选择免费方案',
    '注册完成后获取 CPA 登录链接', '提交回调地址',
  ]);
  assert.deepEqual(steps.map(({ kind }) => kind), [
    'action', 'action', 'action', 'action', 'action', 'action',
  ]);
  assert.ok(steps.every((step) => step.flowId === 'devin'));
});

test('Devin flow advertises email and automatic-run capabilities', () => {
  const { readFlowRegistryBundle } = require('./helpers/script-bundles.js');
  const scope = {};
  const registry = new Function('self', `${readFlowRegistryBundle()}; return self.MultiPageFlowRegistry;`)(scope);
  const flow = registry.getFlowDefinition('devin');
  assert.equal(flow.capabilities.supportsEmailSignup, true);
  assert.equal(flow.capabilities.supportsAutomaticRun, true);
});
