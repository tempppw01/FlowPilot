(function attachMultiPageGrokWorkflow(root, factory) {
  root.MultiPageGrokWorkflow = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createMultiPageGrokWorkflow() {
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
        key: 'grok-open-signup-page',
        title: '打开 Grok 注册页',
        sourceId: 'grok-register-page',
        driverId: 'flows/grok/background/register-runner',
        command: 'grok-open-signup-page',
        flowId: 'grok',
      },
      {
        id: 2,
        order: 20,
        key: 'grok-submit-email',
        title: '获取邮箱并继续',
        sourceId: 'grok-register-page',
        driverId: 'flows/grok/background/register-runner',
        command: 'grok-submit-email',
        flowId: 'grok',
      },
      {
        id: 3,
        order: 30,
        key: 'grok-submit-verification-code',
        title: '获取验证码并继续',
        sourceId: 'grok-register-page',
        driverId: 'flows/grok/background/register-runner',
        command: 'grok-submit-verification-code',
        mailRuleId: 'grok-submit-verification-code',
        flowId: 'grok',
      },
      {
        id: 4,
        order: 40,
        key: 'grok-submit-profile',
        title: '填写资料并继续',
        sourceId: 'grok-register-page',
        driverId: 'flows/grok/background/register-runner',
        command: 'grok-submit-profile',
        flowId: 'grok',
      },
      {
        id: 5,
        order: 50,
        key: 'grok-extract-sso-cookie',
        title: '提取 SSO Cookie',
        sourceId: 'grok-register-page',
        driverId: 'flows/grok/background/register-runner',
        command: 'grok-extract-sso-cookie',
        flowId: 'grok',
      },
      {
        id: 6,
        order: 60,
        key: 'grok-upload-sso-to-webchat2api',
        title: '上传 SSO 到 webchat2api',
        sourceId: 'grok-webchat2api',
        driverId: 'flows/grok/background/publisher-webchat2api',
        command: 'grok-upload-sso-to-webchat2api',
        flowId: 'grok',
      },
    ],
    'grok2api-web-sso-import': [
      {
        id: 1,
        order: 10,
        key: 'grok-open-signup-page',
        title: '打开 Grok 注册页',
        sourceId: 'grok-register-page',
        driverId: 'flows/grok/background/register-runner',
        command: 'grok-open-signup-page',
        flowId: 'grok',
      },
      {
        id: 2,
        order: 20,
        key: 'grok-submit-email',
        title: '获取邮箱并继续',
        sourceId: 'grok-register-page',
        driverId: 'flows/grok/background/register-runner',
        command: 'grok-submit-email',
        flowId: 'grok',
      },
      {
        id: 3,
        order: 30,
        key: 'grok-submit-verification-code',
        title: '获取验证码并继续',
        sourceId: 'grok-register-page',
        driverId: 'flows/grok/background/register-runner',
        command: 'grok-submit-verification-code',
        mailRuleId: 'grok-submit-verification-code',
        flowId: 'grok',
      },
      {
        id: 4,
        order: 40,
        key: 'grok-submit-profile',
        title: '填写资料并继续',
        sourceId: 'grok-register-page',
        driverId: 'flows/grok/background/register-runner',
        command: 'grok-submit-profile',
        flowId: 'grok',
      },
      {
        id: 5,
        order: 50,
        key: 'grok-extract-sso-cookie',
        title: '提取 SSO Cookie',
        sourceId: 'grok-register-page',
        driverId: 'flows/grok/background/register-runner',
        command: 'grok-extract-sso-cookie',
        flowId: 'grok',
      },
      {
        id: 6,
        order: 60,
        key: 'grok-upload-sso-to-grok2api',
        title: '上传 SSO 到 grok2api Web',
        sourceId: 'grok2api',
        driverId: 'flows/grok/background/publisher-grok2api',
        command: 'grok-upload-sso-to-grok2api',
        flowId: 'grok',
      },
    ],
    'grok2api-build-device-oauth': [
      {
        id: 1,
        order: 10,
        key: 'grok-start-grok2api-device-auth',
        title: '获取并打开 Grok Build 授权链接',
        sourceId: 'grok2api-device-oauth',
        driverId: 'flows/grok/background/publisher-grok2api',
        command: 'grok-start-grok2api-device-auth',
        flowId: 'grok',
      },
      {
        id: 2,
        order: 20,
        key: 'grok-continue-device-login',
        title: '点击页面“继续”',
        sourceId: 'grok-register-page',
        driverId: 'flows/grok/background/register-runner',
        command: 'grok-continue-device-login',
        flowId: 'grok',
      },
      {
        id: 3,
        order: 30,
        key: 'grok-open-email-signup',
        title: '点击注册并使用邮箱注册',
        sourceId: 'grok-register-page',
        driverId: 'flows/grok/background/register-runner',
        command: 'grok-open-email-signup',
        flowId: 'grok',
      },
      {
        id: 4,
        order: 40,
        key: 'grok-submit-email',
        title: '输入邮箱并继续',
        sourceId: 'grok-register-page',
        driverId: 'flows/grok/background/register-runner',
        command: 'grok-submit-email',
        flowId: 'grok',
      },
      {
        id: 5,
        order: 50,
        key: 'grok-submit-verification-code',
        title: '获取验证码并继续',
        sourceId: 'grok-register-page',
        driverId: 'flows/grok/background/register-runner',
        command: 'grok-submit-verification-code',
        mailRuleId: 'grok-submit-verification-code',
        flowId: 'grok',
      },
      {
        id: 6,
        order: 60,
        key: 'grok-submit-profile',
        title: '填写资料并继续',
        sourceId: 'grok-register-page',
        driverId: 'flows/grok/background/register-runner',
        command: 'grok-submit-profile',
        flowId: 'grok',
      },
      {
        id: 7,
        order: 70,
        key: 'grok-approve-device-authorization',
        title: '继续并允许 Grok Build 设备授权',
        sourceId: 'grok-register-page',
        driverId: 'flows/grok/background/register-runner',
        command: 'grok-approve-device-authorization',
        flowId: 'grok',
      },
      {
        id: 8,
        order: 80,
        key: 'grok-complete-grok2api-device-auth',
        title: '完成设备授权并接入 grok2api',
        sourceId: 'grok2api-device-oauth',
        driverId: 'flows/grok/background/publisher-grok2api',
        command: 'grok-complete-grok2api-device-auth',
        flowId: 'grok',
      },
    ],
  });

  function getVariantStepDefinitions(variantKey = 'default') {
    return Array.isArray(STEP_VARIANTS[variantKey]) ? STEP_VARIANTS[variantKey] : STEP_VARIANTS.default;
  }

  function getModeStepDefinitions(options = {}) {
    const targetId = String(options?.targetId || options?.settingsState?.flows?.grok?.selectedTargetId || '').trim().toLowerCase();
    if (targetId !== 'grok2api') {
      return getVariantStepDefinitions('default');
    }
    const uploadMethod = String(
      options?.grok2ApiUploadMethod
      || options?.settingsState?.flows?.grok?.targets?.grok2api?.uploadMethod
      || 'web-sso-import'
    ).trim().toLowerCase();
    return getVariantStepDefinitions(
      uploadMethod === 'build-device-oauth' ? 'grok2api-build-device-oauth' : 'grok2api-web-sso-import'
    );
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
    flowId: 'grok',
    getAllSteps,
    getModeStepDefinitions,
    getPlusPaymentStepTitle,
    getVariantStepDefinitions,
    resolveStepTitle,
  };
});
