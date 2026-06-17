const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('flows/openai/background/steps/oauth-login.js', 'utf8');
const globalScope = {};
const api = new Function('self', `${source}; return self.MultiPageBackgroundStep7;`)(globalScope);

test('step 7 restarts the current attempt when SMSBower login reaches email verification', async () => {
  const calls = {
    completions: [],
    logs: [],
    sentMessages: [],
  };

  const executor = api.createStep7Executor({
    addLog: async (message, level, options) => {
      calls.logs.push({ message, level: level || 'info', options });
    },
    completeNodeFromBackground: async (step, payload) => {
      calls.completions.push({ step, payload });
    },
    getErrorMessage: (error) => error?.message || String(error || ''),
    getLoginAuthStateLabel: (state) => {
      if (state === 'verification_page') return '登录验证码页';
      if (state === 'oauth_consent_page') return 'OAuth 授权页';
      return state || '未知页面';
    },
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => defaultTimeoutMs,
    getState: async () => ({
      email: 'smsbower@example.com',
      password: 'secret',
      mailProvider: 'smsbower-mail',
    }),
    getTabId: async () => 1,
    isStep6RecoverableResult: () => false,
    isStep6SuccessResult: (result) => result?.step6Outcome === 'success',
    refreshOAuthUrlBeforeStep6: async () => 'https://oauth.example/latest',
    reuseOrCreateTab: async () => 1,
    sendToContentScriptResilient: async (_source, message) => {
      calls.sentMessages.push(message);
      return {
        step6Outcome: 'success',
        state: 'verification_page',
        via: 'submitted_login',
        url: 'https://auth.openai.com/email-verification',
      };
    },
    startOAuthFlowTimeoutWindow: async () => {},
    STEP6_MAX_ATTEMPTS: 2,
    throwIfStopped: () => {},
  });

  await assert.rejects(
    () => executor.executeStep7({
      email: 'smsbower@example.com',
      password: 'secret',
      mailProvider: 'smsbower-mail',
      nodeId: 'oauth-login',
    }),
    /RESTART_CURRENT_ATTEMPT::.*SMSBower TempMail.*20 分钟.*步骤 1/
  );

  assert.equal(calls.sentMessages.length, 1);
  assert.deepStrictEqual(calls.completions, []);
  assert.equal(
    calls.logs.some((entry) => /不会进入步骤 8 获取旧验证码/.test(entry.message)),
    true
  );
});

