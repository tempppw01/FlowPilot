(function attachMultiPageGrokFlowDefinition(root, factory) {
  root.MultiPageGrokFlowDefinition = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createMultiPageGrokFlowDefinition() {
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
    id: 'grok',
    label: 'Grok / xAI',
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
      supportedTargetIds: ['webchat2api', 'grok2api'],
      supportsLuckmail: false,
      canSwitchFlow: true,
      stepDefinitionMode: 'grok',
      targetSelectorLabel: '来源',
    },
    baseGroups: ['grok-runtime-status', 'shared-auto-run'],
    targets: {
      webchat2api: {
        id: 'webchat2api',
        label: 'webchat2api',
        groups: [
          'grok-target-webchat2api',
        ],
        defaultState: {
          baseUrl: '',
          apiKey: '',
        },
      },
      grok2api: {
        id: 'grok2api',
        label: 'grok2api',
        groups: [
          'grok-target-grok2api',
        ],
        defaultState: {
          baseUrl: '',
          adminUsername: '',
          adminPassword: '',
          uploadMethod: 'web-sso-import',
        },
      },
    },
    publicationTargets: {},
    runtimeSources: {
      'grok-register-page': {
        flowId: 'grok',
        kind: 'flow-page',
        label: 'Grok 注册页',
        readyPolicy: 'top-frame-only',
        family: 'grok-register-page-family',
        driverId: 'flows/grok/content/register-page',
        cleanupScopes: [],
        detectionMatchers: [
          {
            hostnames: [
              'accounts.x.ai',
              'x.ai',
              'grok.com',
            ],
            hostnameEndsWith: [
              '.x.ai',
              '.grok.com',
            ],
            matchMode: 'any',
          },
        ],
        familyMatchers: [
          {
            hostnames: [
              'accounts.x.ai',
              'x.ai',
              'grok.com',
            ],
            hostnameEndsWith: [
              '.x.ai',
              '.grok.com',
            ],
            matchMode: 'any',
          },
        ],
      },
    },
    driverDefinitions: {
      'flows/grok/content/register-page': {
        sourceId: 'grok-register-page',
        commands: [
          'grok-open-signup-page',
          'grok-continue-device-login',
          'grok-open-email-signup',
          'grok-approve-device-authorization',
          'grok-submit-email',
          'grok-submit-verification-code',
          'grok-submit-profile',
          'grok-extract-sso-cookie',
        ],
      },
      'flows/grok/background/register-runner': {
        sourceId: 'grok-register-page',
        commands: [
          'grok-open-signup-page',
          'grok-continue-device-login',
          'grok-open-email-signup',
          'grok-approve-device-authorization',
          'grok-submit-email',
          'grok-submit-verification-code',
          'grok-submit-profile',
          'grok-extract-sso-cookie',
        ],
      },
      'flows/grok/background/publisher-webchat2api': {
        sourceId: 'grok-webchat2api',
        commands: [
          'grok-upload-sso-to-webchat2api',
        ],
      },
      'flows/grok/background/publisher-grok2api': {
        sourceId: 'grok2api',
        commands: [
          'grok-upload-sso-to-grok2api',
          'grok-start-grok2api-device-auth',
          'grok-complete-grok2api-device-auth',
        ],
      },
    },
    defaultTargetId: 'webchat2api',
    settingsDefaults: {
      targets: {
        webchat2api: {
          baseUrl: '',
          apiKey: '',
        },
        grok2api: {
          baseUrl: '',
          adminUsername: '',
          adminPassword: '',
          uploadMethod: 'web-sso-import',
        },
      },
      autoRun: {
        stepExecutionRange: {
          enabled: false,
          fromStep: 1,
          toStep: 6,
        },
      },
    },
    settingsGroups: {
      'grok-target-webchat2api': {
        id: 'grok-target-webchat2api',
        label: 'webchat2api',
        rowIds: [
          'row-grok-webchat2api-url',
          'row-grok-webchat2api-key',
          'row-grok-sso-settings',
        ],
      },
      'grok-target-grok2api': {
        id: 'grok-target-grok2api',
        label: 'grok2api',
        rowIds: [
          'row-grok2api-url',
          'row-grok2api-admin-username',
          'row-grok2api-admin-password',
          'row-grok2api-test-status',
          'row-grok2api-upload-method',
          'row-grok-sso-settings',
          'row-grok2api-upload-status',
          'row-grok2api-device-status',
          'row-grok2api-device-auth',
        ],
      },
      'grok-runtime-status': {
        id: 'grok-runtime-status',
        label: 'Grok 运行态',
        rowIds: [
          'row-grok-register-status',
          'row-grok-sso-status',
          'row-grok-webchat2api-upload-status',
        ],
      },
    },
    sourceAliases: {},
  });

  return VALUE;
});
