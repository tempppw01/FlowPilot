(function attachMultiPageTokenHarborWorkflow(root, factory) {
  root.MultiPageTokenHarborWorkflow = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createMultiPageTokenHarborWorkflow() {
  const steps = Object.freeze([
    { id: 1, order: 10, key: 'tokenharbor-open-signup', title: '打开 Token Harbor 注册页', kind: 'action' },
    { id: 2, order: 20, key: 'tokenharbor-submit-signup', title: '填写邮箱和密码并创建账号', kind: 'action', sourceId: 'tokenharbor-register-page', driverId: 'flows/tokenharbor/content/register-page', command: 'tokenharbor-submit-signup' },
    { id: 3, order: 30, key: 'tokenharbor-fetch-verification-link', title: '从邮箱获取验证链接', kind: 'action', sourceId: 'tokenharbor-register-page', driverId: 'flows/tokenharbor/background/register-runner', command: 'tokenharbor-fetch-verification-link' },
    { id: 4, order: 40, key: 'tokenharbor-open-verification-link', title: '打开邮箱验证链接', kind: 'action', sourceId: 'tokenharbor-register-page', driverId: 'flows/tokenharbor/background/register-runner', command: 'tokenharbor-open-verification-link' },
  ].map((step) => Object.freeze({ ...step, flowId: 'tokenharbor' })));
  return {
    flowId: 'tokenharbor',
    getAllSteps: () => steps,
    getModeStepDefinitions: () => steps,
    getVariantStepDefinitions: () => steps,
    resolveStepTitle: (step = {}) => step.title || '',
  };
});
