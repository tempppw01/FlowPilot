(function attachMultiPageClaudeFlowDefinition(root, factory) {
  root.MultiPageClaudeFlowDefinition = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createMultiPageClaudeFlowDefinition() {
  function freezeDeep(entry) {
    if (!entry || typeof entry !== 'object' || Object.isFrozen(entry)) {
      return entry;
    }
    Object.getOwnPropertyNames(entry).forEach((key) => {
      freezeDeep(entry[key]);
    });
    return Object.freeze(entry);
  }

  const VALUE = freezeDeep({
    id: 'claude',
    label: 'Claude',
    services: [
      'account',
      'email',
      'proxy',
    ],
    capabilities: {
      supportsEmailSignup: true,
      supportsPhoneSignup: false,
      supportsPhoneVerificationSettings: false,
      supportsPlusMode: false,
      supportsContributionMode: false,
      supportsAccountContribution: false,
      supportsOpenAiOAuthContribution: false,
      contributionAdapterIds: [],
      supportedTargetIds: [],
      supportsLuckmail: false,
      canSwitchFlow: true,
      stepDefinitionMode: 'claude',
      targetSelectorLabel: '\u6765\u6e90',
    },
    baseGroups: ['claude-runtime-status', 'shared-auto-run'],
    targets: {
      claude: {
        id: 'claude',
        label: 'Claude',
        groups: [],
        defaultState: {},
      },
    },
    publicationTargets: {},
    runtimeSources: {
      'claude-register-page': {
        flowId: 'claude',
        kind: 'flow-page',
        label: 'Claude \u6ce8\u518c\u9875',
        readyPolicy: 'top-frame-only',
        family: 'claude-register-page-family',
        driverId: 'flows/claude/content/register-page',
        cleanupScopes: [],
        detectionMatchers: [
          {
            hostnames: [
              'claude.ai',
              'www.claude.ai',
              'console.anthropic.com',
            ],
            hostnameEndsWith: [
              '.claude.ai',
              '.anthropic.com',
            ],
            matchMode: 'any',
          },
        ],
        familyMatchers: [
          {
            hostnames: [
              'claude.ai',
              'www.claude.ai',
              'console.anthropic.com',
            ],
            hostnameEndsWith: [
              '.claude.ai',
              '.anthropic.com',
            ],
            matchMode: 'any',
          },
        ],
      },
    },
    driverDefinitions: {
      'flows/claude/content/register-page': {
        sourceId: 'claude-register-page',
        commands: [
          'claude-open-official-page',
          'claude-submit-email',
          'claude-fetch-login-link',
          'claude-open-login-link',
        ],
      },
      'flows/claude/background/register-runner': {
        sourceId: 'claude-register-page',
        commands: [
          'claude-open-official-page',
          'claude-submit-email',
          'claude-fetch-login-link',
          'claude-open-login-link',
        ],
      },
    },
    defaultTargetId: 'claude',
    settingsDefaults: {
      targets: {
        claude: {},
      },
      autoRun: {
        stepExecutionRange: {
          enabled: false,
          fromStep: 1,
          toStep: 4,
        },
      },
    },
    settingsGroups: {
      'claude-runtime-status': {
        id: 'claude-runtime-status',
        label: 'Claude \u8fd0\u884c\u6001',
        rowIds: [],
      },
    },
    sourceAliases: {},
    workflowStepCount: 4,
  });

  return VALUE;
});
