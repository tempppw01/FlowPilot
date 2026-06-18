const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function loadClaudeRunnerApi() {
  const source = fs.readFileSync('flows/claude/background/register-runner.js', 'utf8');
  const globalScope = {};
  return new Function('self', `${source}; return self.MultiPageBackgroundClaudeRegisterRunner;`)(globalScope);
}

function getClaudeRuntime(state = {}) {
  return state?.runtimeState?.flowState?.claude || {};
}

test('claude runner requires background node completion dependency', () => {
  const api = loadClaudeRunnerApi();
  assert.throws(
    () => api.createClaudeRegisterRunner({}),
    /requires completeNodeFromBackground/
  );
});

test('claude email step always obtains acz SMSBower TempMail address and fills it', async () => {
  const api = loadClaudeRunnerApi();
  const calls = [];
  let completedPayload = null;
  let currentState = {
    activeFlowId: 'claude',
    mailProvider: 'hotmail-api',
    email: 'old@example.com',
    claudeRegisterTabId: 401,
    runtimeState: {
      flowState: {
        claude: {
          session: { registerTabId: 401 },
        },
      },
    },
  };
  const runner = api.createClaudeRegisterRunner({
    addLog: async () => {},
    chrome: {
      tabs: {
        get: async (tabId) => ({ id: tabId }),
        update: async () => {},
      },
    },
    completeNodeFromBackground: async (_nodeId, payload) => {
      completedPayload = payload;
    },
    ensureContentScriptReadyOnTab: async () => {},
    fetchSmsBowerMailAddress: async (state, options) => {
      calls.push({ type: 'fetch-mail', state, options });
      return 'fresh@gmail.com';
    },
    getState: async () => currentState,
    getTabId: async () => 401,
    isTabAlive: async () => true,
    registerTab: async () => {},
    sendToContentScriptResilient: async (sourceId, message) => {
      calls.push({ type: 'send', sourceId, message });
      return { submitted: true, state: 'email_filled', url: 'https://claude.ai/' };
    },
    setState: async (patch) => {
      currentState = { ...currentState, ...patch };
    },
    waitForTabStableComplete: async () => {},
  });

  await runner.executeClaudeFillEmail({ nodeId: 'claude-fill-email', ...currentState });

  const fetchCall = calls.find((entry) => entry.type === 'fetch-mail');
  assert.equal(fetchCall.state.mailProvider, 'smsbower-mail');
  assert.equal(fetchCall.state.smsbowerMailServiceCode, 'acz');
  assert.equal(fetchCall.options.generateNew, true);
  assert.equal(fetchCall.options.preserveAccountIdentity, true);

  const sendCall = calls.find((entry) => entry.type === 'send');
  assert.equal(sendCall.sourceId, 'claude-register-page');
  assert.equal(sendCall.message.nodeId, 'claude-fill-email');
  assert.deepEqual(sendCall.message.payload, { email: 'fresh@gmail.com' });

  assert.equal(completedPayload.mailProvider, 'smsbower-mail');
  assert.equal(completedPayload.smsbowerMailServiceCode, 'acz');
  assert.equal(completedPayload.claudeEmail, 'fresh@gmail.com');
  assert.equal(getClaudeRuntime(completedPayload).register.status, 'email_filled');
});

test('claude submit email step clicks submit, polls SMSBower link, and stores it', async () => {
  const api = loadClaudeRunnerApi();
  const calls = [];
  let completedPayload = null;
  let currentState = {
    activeFlowId: 'claude',
    claudeEmail: 'fresh@gmail.com',
    currentSmsBowerMailActivation: {
      id: '42',
      address: 'fresh@gmail.com',
    },
  };
  const runner = api.createClaudeRegisterRunner({
    addLog: async () => {},
    chrome: {
      tabs: {
        get: async (tabId) => ({ id: tabId }),
        update: async () => {},
      },
    },
    completeNodeFromBackground: async (_nodeId, payload) => {
      completedPayload = payload;
    },
    ensureContentScriptReadyOnTab: async () => {},
    getState: async () => currentState,
    getTabId: async () => 401,
    isTabAlive: async () => true,
    pollSmsBowerMailLink: async (step, state, payload) => {
      calls.push({ type: 'poll', step, state, payload });
      return { link: 'https://claude.ai/login?token=abc', mailId: '42' };
    },
    registerTab: async () => {},
    sendToContentScriptResilient: async (sourceId, message) => {
      calls.push({ type: 'send', sourceId, message });
      return { submitted: true, state: 'login_link_sent', url: 'https://claude.ai/' };
    },
    setState: async (patch) => {
      currentState = { ...currentState, ...patch };
    },
    waitForTabStableComplete: async () => {},
  });

  await runner.executeClaudeSubmitEmailAndFetchLink({ nodeId: 'claude-submit-email-and-fetch-link', ...currentState });

  const sendCall = calls.find((entry) => entry.type === 'send');
  assert.equal(sendCall.message.nodeId, 'claude-submit-email');
  assert.deepEqual(sendCall.message.payload, { email: 'fresh@gmail.com' });
  const pollCall = calls.find((entry) => entry.type === 'poll');
  assert.equal(pollCall.step, 3);
  assert.equal(pollCall.state.mailProvider, 'smsbower-mail');
  assert.equal(pollCall.state.smsbowerMailServiceCode, 'acz');
  assert.equal(pollCall.state.flowId, 'claude');
  assert.deepEqual(pollCall.payload.hostFilters, ['claude.ai', 'anthropic.com']);
  assert.equal(pollCall.payload.intervalMs, 5000);
  assert.equal(completedPayload.claudeLoginLink, 'https://claude.ai/login?token=abc');
  assert.equal(getClaudeRuntime(completedPayload).register.status, 'login_link_received');
});

test('claude open login link validates host before navigating', async () => {
  const api = loadClaudeRunnerApi();
  const updatedTabs = [];
  let completedPayload = null;
  let currentState = {
    activeFlowId: 'claude',
    claudeRegisterTabId: 501,
    claudeLoginLink: 'https://claude.ai/login?token=abc',
  };
  const runner = api.createClaudeRegisterRunner({
    addLog: async () => {},
    chrome: {
      tabs: {
        get: async (tabId) => ({ id: tabId }),
        update: async (tabId, patch) => {
          updatedTabs.push({ tabId, patch });
        },
      },
    },
    completeNodeFromBackground: async (_nodeId, payload) => {
      completedPayload = payload;
    },
    getState: async () => currentState,
    getTabId: async () => 501,
    isTabAlive: async () => true,
    registerTab: async () => {},
    setState: async (patch) => {
      currentState = { ...currentState, ...patch };
    },
    waitForTabStableComplete: async () => {},
  });

  await runner.executeClaudeOpenLoginLink({ nodeId: 'claude-open-login-link', ...currentState });

  assert.deepEqual(updatedTabs.at(-1), {
    tabId: 501,
    patch: { url: 'https://claude.ai/login?token=abc', active: true },
  });
  assert.equal(completedPayload.claudePageUrl, 'https://claude.ai/login?token=abc');
  assert.equal(getClaudeRuntime(completedPayload).register.status, 'login_link_opened');
});

test('claude extract session key reads sessionKey cookie and marks completion', async () => {
  const api = loadClaudeRunnerApi();
  let completedPayload = null;
  let markedAccount = null;
  let currentState = {
    activeFlowId: 'claude',
    claudeRegisterTabId: 601,
    claudeEmail: 'fresh@gmail.com',
  };
  const runner = api.createClaudeRegisterRunner({
    addLog: async () => {},
    chrome: {
      cookies: {
        get: async ({ name }) => (name === 'sessionKey' ? { value: 'sk-ant-sid02-test--rQciwAA' } : null),
      },
      tabs: {
        get: async (tabId) => ({ id: tabId }),
        update: async () => {},
      },
    },
    completeNodeFromBackground: async (_nodeId, payload) => {
      completedPayload = payload;
    },
    getState: async () => currentState,
    getTabId: async () => 601,
    isTabAlive: async () => true,
    markCurrentRegistrationAccountUsed: async (state) => {
      markedAccount = state;
    },
    registerTab: async () => {},
    setState: async (patch) => {
      currentState = { ...currentState, ...patch };
    },
    sleepWithStop: async () => {},
  });

  await runner.executeClaudeExtractSessionKey({ nodeId: 'claude-extract-session-key', ...currentState });

  assert.equal(completedPayload.claudeSessionKey, 'sk-ant-sid02-test--rQciwAA');
  assert.deepEqual(completedPayload.claudeSessionKeys, ['sk-ant-sid02-test--rQciwAA']);
  assert.equal(getClaudeRuntime(completedPayload).register.status, 'completed');
  assert.equal(markedAccount.claudeSessionKey, 'sk-ant-sid02-test--rQciwAA');
});

test('claude extract session key submits to Claude2API when configured', async () => {
  const api = loadClaudeRunnerApi();
  const fetchCalls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    fetchCalls.push({ url, options });
    if (String(url).endsWith('/admin-api/login')) {
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }
    if (String(url).endsWith('/admin-api/session')) {
      return { ok: true, status: 200, json: async () => ({ status: 'added', session_count: 3 }) };
    }
    return { ok: false, status: 404, json: async () => ({ error: 'not found' }) };
  };

  let completedPayload = null;
  const currentState = {
    activeFlowId: 'claude',
    claudeRegisterTabId: 602,
    claude2apiUrl: 'https://claude2api.example/',
    claude2apiPassword: 'admin-pass',
  };
  const runner = api.createClaudeRegisterRunner({
    addLog: async () => {},
    chrome: {
      cookies: {
        get: async ({ name }) => (name === 'sessionKey' ? { value: 'sk-ant-sid02-submit-test' } : null),
      },
      tabs: {
        get: async (tabId) => ({ id: tabId }),
        update: async () => {},
      },
    },
    completeNodeFromBackground: async (_nodeId, payload) => {
      completedPayload = payload;
    },
    getState: async () => currentState,
    getTabId: async () => 602,
    isTabAlive: async () => true,
    registerTab: async () => {},
    setState: async () => {},
    sleepWithStop: async () => {},
  });

  try {
    await runner.executeClaudeExtractSessionKey({ nodeId: 'claude-extract-session-key', ...currentState });
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(fetchCalls.length, 2);
  assert.equal(fetchCalls[0].url, 'https://claude2api.example/admin-api/login');
  assert.equal(fetchCalls[0].options.credentials, 'include');
  assert.deepEqual(JSON.parse(fetchCalls[0].options.body), { password: 'admin-pass' });
  assert.equal(fetchCalls[1].url, 'https://claude2api.example/admin-api/session');
  assert.equal(fetchCalls[1].options.credentials, 'include');
  assert.deepEqual(JSON.parse(fetchCalls[1].options.body), { session_key: 'sk-ant-sid02-submit-test' });
  assert.equal(completedPayload.claudeSessionKey, 'sk-ant-sid02-submit-test');
});
