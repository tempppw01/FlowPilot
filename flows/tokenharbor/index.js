(function attachMultiPageTokenHarborFlowDefinition(root, factory) {
  root.MultiPageTokenHarborFlowDefinition = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createMultiPageTokenHarborFlowDefinition() {
  return Object.freeze({
    id: 'tokenharbor',
    label: 'Token Harbor',
    services: ['account', 'email', 'proxy'],
    capabilities: {
      supportsEmailSignup: true,
      supportsPhoneSignup: false,
      supportsPhoneVerificationSettings: false,
      supportsPlusMode: false,
      supportsContributionMode: false,
      supportsAccountContribution: false,
      supportsOpenAiOAuthContribution: false,
      contributionAdapterIds: [],
      supportedTargetIds: ['tokenharbor'],
      supportsLuckmail: false,
      canSwitchFlow: true,
      stepDefinitionMode: 'tokenharbor',
      targetSelectorLabel: '注册',
      supportsAutomaticRun: true,
    },
    baseGroups: ['tokenharbor-registration', 'shared-auto-run'],
    targets: { tokenharbor: { id: 'tokenharbor', label: 'Token Harbor', groups: [], defaultState: {} } },
    publicationTargets: {},
    runtimeSources: {
      'tokenharbor-register-page': {
        flowId: 'tokenharbor', kind: 'flow-page', label: 'Token Harbor 注册页',
        readyPolicy: 'top-frame-only', family: 'tokenharbor-register-page-family',
        driverId: 'flows/tokenharbor/content/register-page', cleanupScopes: [],
        detectionMatchers: [{ hostnames: ['tokenharbor.ai', 'www.tokenharbor.ai'] }],
        familyMatchers: [{ hostnames: ['tokenharbor.ai', 'www.tokenharbor.ai'] }],
      },
    },
    driverDefinitions: {
      'flows/tokenharbor/content/register-page': {
        sourceId: 'tokenharbor-register-page',
        commands: ['tokenharbor-open-signup', 'tokenharbor-submit-signup'],
      },
      'flows/tokenharbor/background/register-runner': {
        sourceId: 'tokenharbor-register-page',
        commands: ['tokenharbor-fetch-verification-link', 'tokenharbor-open-verification-link'],
      },
    },
    defaultTargetId: 'tokenharbor',
    settingsDefaults: {
      targets: { tokenharbor: {} },
      autoRun: { stepExecutionRange: { enabled: false, fromStep: 1, toStep: 4 } },
    },
    settingsGroups: {
      'tokenharbor-registration': { id: 'tokenharbor-registration', label: 'Token Harbor 注册', rowIds: [] },
    },
    sourceAliases: {},
  });
});
