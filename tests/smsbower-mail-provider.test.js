const test = require('node:test');
const assert = require('node:assert/strict');

const utils = require('../smsbower-mail-utils.js');
require('../background/smsbower-mail-provider.js');

function createProviderApi(options = {}) {
  const {
    state = {
      smsbowerMailApiKey: 'api-key',
      smsbowerMailBaseUrl: 'https://smsbower.page/api/mail',
      smsbowerMailServiceCode: 'dr',
      smsbowerMailDomain: 'gmail.com',
      smsbowerMailMaxPrice: '0.134',
      currentSmsBowerMailActivation: null,
      email: '',
    },
    fetchImpl,
  } = options;
  let currentState = { ...state };
  const calls = [];
  const logs = [];
  const persistCalls = [];
  const stateUpdates = [];

  const api = globalThis.MultiPageBackgroundSmsBowerMailProvider.createSmsBowerMailProvider({
    addLog: async (message, level) => logs.push({ message, level }),
    DEFAULT_SMSBOWER_MAIL_BASE_URL: utils.DEFAULT_SMSBOWER_MAIL_BASE_URL,
    DEFAULT_SMSBOWER_MAIL_DOMAIN: utils.DEFAULT_SMSBOWER_MAIL_DOMAIN,
    DEFAULT_SMSBOWER_MAIL_MAX_PRICE: utils.DEFAULT_SMSBOWER_MAIL_MAX_PRICE,
    DEFAULT_SMSBOWER_MAIL_SERVICE_CODE: utils.DEFAULT_SMSBOWER_MAIL_SERVICE_CODE,
    describeSmsBowerMailPayload: utils.describeSmsBowerMailPayload,
    extractSmsBowerMailCode: utils.extractSmsBowerMailCode,
    fetchImpl: fetchImpl || (async (url) => {
      calls.push({ url: String(url) });
      if (String(url).includes('/getActivation')) {
        return {
          ok: true,
          text: async () => JSON.stringify({
            status: 1,
            mail: 'fresh@gmail.com',
            mailId: 42,
          }),
        };
      }
      if (String(url).includes('/getCode')) {
        return {
          ok: true,
          text: async () => JSON.stringify({
            status: 1,
            code: '987654',
          }),
        };
      }
      if (String(url).includes('/setStatus')) {
        return {
          ok: true,
          text: async () => JSON.stringify({ status: 1, message: 'Success' }),
        };
      }
      throw new Error(`unexpected URL ${url}`);
    }),
    getState: async () => currentState,
    isSmsBowerMailPendingCode: utils.isSmsBowerMailPendingCode,
    isSmsBowerMailSuccess: utils.isSmsBowerMailSuccess,
    joinSmsBowerMailUrl: utils.joinSmsBowerMailUrl,
    normalizeSmsBowerMailActivation: utils.normalizeSmsBowerMailActivation,
    normalizeSmsBowerMailAddress: utils.normalizeSmsBowerMailAddress,
    normalizeSmsBowerMailAlias: utils.normalizeSmsBowerMailAlias,
    normalizeSmsBowerMailApiKey: utils.normalizeSmsBowerMailApiKey,
    normalizeSmsBowerMailBaseUrl: utils.normalizeSmsBowerMailBaseUrl,
    normalizeSmsBowerMailCurrentActivation: utils.normalizeSmsBowerMailCurrentActivation,
    normalizeSmsBowerMailDomain: utils.normalizeSmsBowerMailDomain,
    normalizeSmsBowerMailMaxPrice: utils.normalizeSmsBowerMailMaxPrice,
    normalizeSmsBowerMailServiceCode: utils.normalizeSmsBowerMailServiceCode,
    parseSmsBowerMailPayload: utils.parseSmsBowerMailPayload,
    persistRegistrationEmailState: async (callState, email, persistOptions) => {
      persistCalls.push({ state: callState, email, options: persistOptions });
      currentState = { ...currentState, email };
    },
    setEmailState: async () => {},
    setState: async (updates) => {
      stateUpdates.push(updates);
      currentState = { ...currentState, ...updates };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    SMSBOWER_MAIL_PROVIDER: utils.SMSBOWER_MAIL_PROVIDER,
  });

  return {
    ...api,
    snapshot() {
      return { calls, currentState, logs, persistCalls, stateUpdates };
    },
  };
}

test('fetchSmsBowerMailAddress buys OpenAI Gmail temp mail and stores activation', async () => {
  const api = createProviderApi();
  const email = await api.fetchSmsBowerMailAddress(null);
  const snapshot = api.snapshot();

  assert.equal(email, 'fresh@gmail.com');
  assert.match(snapshot.calls[0].url, /\/getActivation\?/);
  assert.match(snapshot.calls[0].url, /api_key=api-key/);
  assert.match(snapshot.calls[0].url, /service=dr/);
  assert.match(snapshot.calls[0].url, /domain=gmail\.com/);
  assert.match(snapshot.calls[0].url, /maxPrice=0\.134/);
  assert.equal(snapshot.currentState.currentSmsBowerMailActivation.id, '42');
  assert.equal(snapshot.currentState.currentSmsBowerMailActivation.address, 'fresh@gmail.com');
  assert.equal(snapshot.persistCalls[0].email, 'fresh@gmail.com');
});

test('pollSmsBowerMailVerificationCode reads code and closes activation', async () => {
  const api = createProviderApi({
    state: {
      smsbowerMailApiKey: 'api-key',
      smsbowerMailBaseUrl: 'https://smsbower.page/api/mail',
      smsbowerMailServiceCode: 'dr',
      smsbowerMailDomain: 'gmail.com',
      smsbowerMailMaxPrice: '0.134',
      currentSmsBowerMailActivation: {
        id: '42',
        address: 'fresh@gmail.com',
      },
      email: 'fresh@gmail.com',
    },
  });

  const result = await api.pollSmsBowerMailVerificationCode(4, null, {
    maxAttempts: 1,
    intervalMs: 1,
  });
  const snapshot = api.snapshot();

  assert.equal(result.code, '987654');
  assert.ok(snapshot.calls.some((call) => call.url.includes('/getCode?') && call.url.includes('mailId=42')));
  assert.ok(snapshot.calls.some((call) => call.url.includes('/setStatus?') && call.url.includes('status=3')));
});

test('cancelSmsBowerMailActivationForRetry closes activation and clears runtime email', async () => {
  const api = createProviderApi({
    state: {
      smsbowerMailApiKey: 'api-key',
      smsbowerMailBaseUrl: 'https://smsbower.page/api/mail',
      currentSmsBowerMailActivation: {
        id: '42',
        address: 'fresh@gmail.com',
      },
      email: 'fresh@gmail.com',
    },
  });

  const result = await api.cancelSmsBowerMailActivationForRetry(null, {
    logPrefix: '步骤 2：SMSBower TempMail fresh@gmail.com',
  });
  const snapshot = api.snapshot();

  assert.equal(result.cancelled, true);
  assert.ok(snapshot.calls.some((call) => call.url.includes('/setStatus?') && call.url.includes('id=42') && call.url.includes('status=3')));
  assert.equal(snapshot.currentState.currentSmsBowerMailActivation, null);
  assert.equal(snapshot.currentState.email, null);
  assert.equal(snapshot.logs.some((entry) => /已取消邮箱 fresh@gmail.com/.test(entry.message)), true);
});

test('pollSmsBowerMailVerificationCode waits through pending code responses', async () => {
  let codeAttempts = 0;
  const api = createProviderApi({
    state: {
      smsbowerMailApiKey: 'api-key',
      currentSmsBowerMailActivation: {
        id: '42',
        address: 'fresh@gmail.com',
      },
      email: 'fresh@gmail.com',
    },
    fetchImpl: async (url) => {
      if (String(url).includes('/getCode')) {
        codeAttempts += 1;
        return {
          ok: true,
          text: async () => JSON.stringify(codeAttempts === 1
            ? { status: 0, error: 'Code has not been received yet, please try again later' }
            : { status: 1, code: '123456' }),
        };
      }
      return {
        ok: true,
        text: async () => JSON.stringify({ status: 1, message: 'Success' }),
      };
    },
  });

  const result = await api.pollSmsBowerMailVerificationCode(4, null, {
    maxAttempts: 2,
    intervalMs: 1,
  });

  assert.equal(result.code, '123456');
  assert.equal(codeAttempts, 2);
});
