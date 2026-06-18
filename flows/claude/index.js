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
    baseGroups: ['claude-runtime-status', 'shared-auto-run', 'claude-target-claude2api'],
    targets: {
      claude: {
        id: 'claude',
        label: 'Claude',
        groups: [],
        defaultState: {
          claude2apiUrl: '',
          claude2apiPassword: '',
        },
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
          'claude-wait-official-page',
          'claude-fill-email',
          'claude-submit-email',
          'claude-submit-email-and-fetch-link',
          'claude-open-login-link',
          'claude-create-account',
          'claude-select-free-plan',
          'claude-skip-onboarding',
          'claude-continue-onboarding',
          'claude-submit-random-name',
          'claude-set-up-later',
          'claude-extract-session-key',
        ],
      },
      'flows/claude/background/register-runner': {
        sourceId: 'claude-register-page',
        commands: [
          'claude-open-official-page',
          'claude-fill-email',
          'claude-submit-email-and-fetch-link',
          'claude-open-login-link',
          'claude-create-account',
          'claude-select-free-plan',
          'claude-skip-onboarding',
          'claude-continue-onboarding',
          'claude-submit-random-name',
          'claude-set-up-later',
          'claude-extract-session-key',
        ],
      },
    },
    defaultTargetId: 'claude',
    settingsDefaults: {
      targets: {
        claude: {
          claude2apiUrl: '',
          claude2apiPassword: '',
        },
      },
      autoRun: {
        stepExecutionRange: {
          enabled: false,
          fromStep: 1,
          toStep: 11,
        },
      },
    },
    settingsGroups: {
      'claude-runtime-status': {
        id: 'claude-runtime-status',
        label: 'Claude \u8fd0\u884c\u6001',
        rowIds: [],
      },
      'claude-target-claude2api': {
        id: 'claude-target-claude2api',
        label: 'Claude2API \u63a5\u5165',
        rowIds: [
          'row-claude2api-url',
          'row-claude2api-password',
          'row-claude2api-test-status',
        ],
      },
    },
    sourceAliases: {},
    workflowStepCount: 11,
  });

  return VALUE;
});
