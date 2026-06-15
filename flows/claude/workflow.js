(function attachMultiPageClaudeWorkflow(root, factory) {
  root.MultiPageClaudeWorkflow = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createMultiPageClaudeWorkflow() {
  function freezeDeep(entry) {
    if (!entry || typeof entry !== 'object' || Object.isFrozen(entry)) {
      return entry;
    }
    Object.getOwnPropertyNames(entry).forEach((key) => {
      freezeDeep(entry[key]);
    });
    return Object.freeze(entry);
  }

  const STEP_VARIANTS = freezeDeep({
    default: [
      {
        id: 1,
        order: 10,
        key: 'claude-open-official-page',
        title: '\u6253\u5f00 Claude \u5b98\u7f51',
        sourceId: 'claude-register-page',
        driverId: 'flows/claude/background/register-runner',
        command: 'claude-open-official-page',
        flowId: 'claude',
      },
      {
        id: 2,
        order: 20,
        key: 'claude-submit-email',
        title: '\u83b7\u53d6\u90ae\u7bb1\u5e76\u586b\u5199',
        sourceId: 'claude-register-page',
        driverId: 'flows/claude/background/register-runner',
        command: 'claude-submit-email',
        flowId: 'claude',
      },
      {
        id: 3,
        order: 30,
        key: 'claude-fetch-login-link',
        title: '\u83b7\u53d6\u90ae\u7bb1\u767b\u5f55\u94fe\u63a5',
        sourceId: 'claude-register-page',
        driverId: 'flows/claude/background/register-runner',
        command: 'claude-fetch-login-link',
        flowId: 'claude',
      },
      {
        id: 4,
        order: 40,
        key: 'claude-open-login-link',
        title: '\u6253\u5f00\u767b\u5f55\u94fe\u63a5',
        sourceId: 'claude-register-page',
        driverId: 'flows/claude/background/register-runner',
        command: 'claude-open-login-link',
        flowId: 'claude',
      },
    ],
  });

  function getVariantStepDefinitions(variantKey = 'default') {
    return Array.isArray(STEP_VARIANTS[variantKey]) ? STEP_VARIANTS[variantKey] : STEP_VARIANTS.default;
  }

  function getModeStepDefinitions() {
    return getVariantStepDefinitions('default');
  }

  function getAllSteps() {
    return getVariantStepDefinitions('default');
  }

  function getPlusPaymentStepTitle() {
    return '';
  }

  function resolveStepTitle(step = {}) {
    return step?.title || '';
  }

  return {
    flowId: 'claude',
    getAllSteps,
    getModeStepDefinitions,
    getPlusPaymentStepTitle,
    getVariantStepDefinitions,
    resolveStepTitle,
  };
});
