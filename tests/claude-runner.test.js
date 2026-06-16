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
  assert.equal(pollCall.step, 4);
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
