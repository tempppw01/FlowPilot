(function attachMultiPageDevinFlowDefinition(root, factory) {
  root.MultiPageDevinFlowDefinition = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createMultiPageDevinFlowDefinition() {
  return Object.freeze({
    id: 'devin',
    label: 'Devin',
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
      supportedTargetIds: ['devin'],
      supportsLuckmail: false,
      canSwitchFlow: true,
      stepDefinitionMode: 'devin',
      targetSelectorLabel: '注册',
      supportsAutomaticRun: true,
    },
    baseGroups: ['devin-registration'],
    targets: { devin: { id: 'devin', label: 'Devin', groups: [], defaultState: {} } },
    publicationTargets: {},
    runtimeSources: {},
    driverDefinitions: {},
    defaultTargetId: 'devin',
    settingsDefaults: {
      targets: { devin: {} },
      autoRun: { stepExecutionRange: { enabled: false, fromStep: 1, toStep: 7 } },
    },
    settingsGroups: {
      'devin-registration': {
        id: 'devin-registration',
        label: 'Devin 注册',
        rowIds: ['row-vps-url', 'row-vps-password', 'row-cpa-test-status'],
      },
    },
    sourceAliases: {},
  });
});
