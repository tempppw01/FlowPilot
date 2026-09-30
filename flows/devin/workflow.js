(function attachMultiPageDevinWorkflow(root, factory) {
  root.MultiPageDevinWorkflow = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createMultiPageDevinWorkflow() {
  const steps = Object.freeze([
    { id: 1, order: 10, key: 'devin-open-authorization', title: '清理 Cookies 并打开注册网站', kind: 'action' },
    { id: 2, order: 20, key: 'devin-enter-email', title: '输入邮箱', kind: 'action' },
    { id: 3, order: 30, key: 'devin-enter-email-code', title: '输入邮箱验证码', kind: 'action' },
    { id: 4, order: 40, key: 'devin-select-free-plan', title: '选择免费方案', kind: 'action' },
    { id: 5, order: 50, key: 'devin-start-cpa-oauth', title: '注册完成后获取 CPA 登录链接', kind: 'action', action: 'start-oauth' },
    { id: 6, order: 60, key: 'devin-submit-callback', title: '提交回调地址', kind: 'action', action: 'submit-callback' },
  ].map((step) => Object.freeze({ ...step, flowId: 'devin' })));
  return {
    flowId: 'devin',
    getAllSteps: () => steps,
    getModeStepDefinitions: () => steps,
    getVariantStepDefinitions: () => steps,
    resolveStepTitle: (step = {}) => step.title || '',
  };
});
