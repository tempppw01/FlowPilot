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
        title: '\u6e05\u7406 Cookie \u5e76\u6253\u5f00 Claude',
        sourceId: 'claude-register-page',
        driverId: 'flows/claude/background/register-runner',
        command: 'claude-open-official-page',
        flowId: 'claude',
      },
      {
        id: 2,
        order: 20,
        key: 'claude-wait-official-page',
        title: '\u7b49\u5f85 Claude \u52a0\u8f7d\u5b8c\u6210',
        sourceId: 'claude-register-page',
        driverId: 'flows/claude/background/register-runner',
        command: 'claude-wait-official-page',
        flowId: 'claude',
      },
      {
        id: 3,
        order: 30,
        key: 'claude-fill-email',
        title: '\u83b7\u53d6 acz \u90ae\u7bb1\u5e76\u586b\u5199',
        sourceId: 'claude-register-page',
        driverId: 'flows/claude/background/register-runner',
        command: 'claude-fill-email',
        flowId: 'claude',
      },
      {
        id: 4,
        order: 40,
        key: 'claude-submit-email-and-fetch-link',
        title: '\u63d0\u4ea4\u90ae\u7bb1\u5e76\u8f6e\u8be2\u767b\u5f55\u94fe\u63a5',
        sourceId: 'claude-register-page',
        driverId: 'flows/claude/background/register-runner',
        command: 'claude-submit-email-and-fetch-link',
        flowId: 'claude',
      },
      {
        id: 5,
        order: 50,
        key: 'claude-open-login-link',
        title: '\u6253\u5f00\u90ae\u7bb1\u9b54\u6cd5\u94fe\u63a5',
        sourceId: 'claude-register-page',
        driverId: 'flows/claude/background/register-runner',
        command: 'claude-open-login-link',
        flowId: 'claude',
      },
      {
        id: 6,
        order: 60,
        key: 'claude-create-account',
        title: '\u52fe\u9009\u540c\u610f\u5e76\u521b\u5efa\u8d26\u53f7',
        sourceId: 'claude-register-page',
        driverId: 'flows/claude/background/register-runner',
        command: 'claude-create-account',
        flowId: 'claude',
      },
      {
        id: 7,
        order: 70,
        key: 'claude-select-free-plan',
        title: '\u9009\u62e9\u514d\u8d39\u8d26\u53f7',
        sourceId: 'claude-register-page',
        driverId: 'flows/claude/background/register-runner',
        command: 'claude-select-free-plan',
        flowId: 'claude',
      },
      {
        id: 8,
        order: 80,
        key: 'claude-skip-onboarding',
        title: '\u70b9\u51fb Skip \u8df3\u8fc7',
        sourceId: 'claude-register-page',
        driverId: 'flows/claude/background/register-runner',
        command: 'claude-skip-onboarding',
        flowId: 'claude',
      },
      {
        id: 9,
        order: 90,
        key: 'claude-continue-onboarding',
        title: '\u7ee7\u7eed\u5f15\u5bfc',
        sourceId: 'claude-register-page',
        driverId: 'flows/claude/background/register-runner',
        command: 'claude-continue-onboarding',
        flowId: 'claude',
      },
      {
        id: 10,
        order: 100,
        key: 'claude-submit-random-name',
        title: '\u751f\u6210\u968f\u673a\u82f1\u6587\u540d\u5e76\u7ee7\u7eed',
        sourceId: 'claude-register-page',
        driverId: 'flows/claude/background/register-runner',
        command: 'claude-submit-random-name',
        flowId: 'claude',
      },
      {
        id: 11,
        order: 110,
        key: 'claude-set-up-later',
        title: '\u9009\u62e9 Set up later',
        sourceId: 'claude-register-page',
        driverId: 'flows/claude/background/register-runner',
        command: 'claude-set-up-later',
        flowId: 'claude',
      },
      {
        id: 12,
        order: 120,
        key: 'claude-extract-session-key',
        title: '\u83b7\u53d6 sessionKey',
        sourceId: 'claude-register-page',
        driverId: 'flows/claude/background/register-runner',
        command: 'claude-extract-session-key',
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
