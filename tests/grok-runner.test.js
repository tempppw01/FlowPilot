const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function loadGrokRunnerApi() {
  const source = fs.readFileSync('flows/grok/background/register-runner.js', 'utf8');
  const globalScope = {};
  return new Function('self', `${source}; return self.MultiPageBackgroundGrokRegisterRunner;`)(globalScope);
}

function getGrokRuntime(state = {}) {
  return state?.runtimeState?.flowState?.grok || {};
}

test('grok runner delegates verification polling to the shared flow mail service', () => {
  const source = fs.readFileSync('flows/grok/background/register-runner.js', 'utf8');
  assert.match(source, /pollFlowVerificationCode/);
  assert.doesNotMatch(source, /buildGrokVerificationPollPayload/);
  assert.doesNotMatch(source, /pollHotmailVerificationCode/);
  assert.doesNotMatch(source, /pollLuckmailVerificationCode/);
  assert.doesNotMatch(source, /pollCloudflareTempEmailVerificationCode/);
  assert.doesNotMatch(source, /pollCloudMailVerificationCode/);
  assert.doesNotMatch(source, /pollYydsMailVerificationCode/);
  assert.doesNotMatch(source, /sendToMailContentScriptResilient/);
});

test('grok content script does not patch global MouseEvent prototypes', () => {
  const source = fs.readFileSync('flows/grok/content/register-page.js', 'utf8');
  assert.doesNotMatch(source, /MouseEvent\.prototype/);
  assert.doesNotMatch(source, /Object\.defineProperty\(MouseEvent/);
  assert.match(source, /screenX:/);
  assert.match(source, /screenY:/);
});

test('grok content listener can rebind after the extension reloads', () => {
  const source = fs.readFileSync('flows/grok/content/register-page.js', 'utf8');

  assert.match(source, /globalThis\[GROK_REGISTER_PAGE_LISTENER_SENTINEL\]/);
  assert.doesNotMatch(source, /document\.documentElement\.hasAttribute\(GROK_REGISTER_PAGE_LISTENER_SENTINEL\)/);
  assert.doesNotMatch(source, /document\.documentElement\.setAttribute\(GROK_REGISTER_PAGE_LISTENER_SENTINEL/);
});

test('grok device approval continues the prefilled device page before allowing access', () => {
  const source = fs.readFileSync('flows/grok/content/register-page.js', 'utf8');
  const approvalIndex = source.indexOf('async function approveGrokDeviceAuthorization');
  const devicePageIndex = source.indexOf('if (isGrokDeviceCodePage())', approvalIndex);
  const continueIndex = source.indexOf('findGrokClickableByText(GROK_DEVICE_CONTINUE_TEXT_PATTERN)', approvalIndex);
  const allowIndex = source.indexOf('findGrokClickableByText(GROK_DEVICE_ALLOW_TEXT_PATTERN)', approvalIndex);

  assert.notEqual(approvalIndex, -1);
  assert.ok(devicePageIndex > approvalIndex);
  assert.ok(continueIndex > devicePageIndex);
  assert.ok(allowIndex > continueIndex);
  assert.match(source, /state: 'device_authorization_submitted'/);
  assert.match(source, /clickedAllow: true/);
});

test('grok device approval finds and confirms allow controls rendered by xAI components', () => {
  const source = fs.readFileSync('flows/grok/content/register-page.js', 'utf8');

  assert.match(source, /function getGrokElements\(selector, root = document, elements = \[\]\)/);
  assert.match(source, /host\.shadowRoot/);
  assert.match(source, /scrollIntoView\?\./);
  assert.match(source, /PointerEvent/);
  assert.match(source, /getGrokClickableDiagnostics\(\)/);
  assert.match(source, /!authorizationPage\.allowButton\.isConnected/);
  assert.match(source, /timeoutMs: 12000/);
  assert.match(source, /允许并继续/);
});

test('grok device authorization runner reports that it clicked allow', () => {
  const source = fs.readFileSync('flows/grok/background/register-runner.js', 'utf8');
  const approvalIndex = source.indexOf('async function executeGrokApproveDeviceAuthorization');
  const nextFunctionIndex = source.indexOf('async function executeGrokSubmitVerificationCode', approvalIndex);
  const block = source.slice(approvalIndex, nextFunctionIndex);

  assert.match(block, /result\.clickedAllow/);
  assert.match(block, /已点击“允许”/);
});

test('grok device login recognizes localized login pages and clears cookie consent before continuing', () => {
  const source = fs.readFileSync('flows/grok/content/register-page.js', 'utf8');
  const continueIndex = source.indexOf('async function continueGrokDeviceLogin');
  const nextFunctionIndex = source.indexOf('async function openGrokEmailSignup', continueIndex);
  const block = source.slice(continueIndex, nextFunctionIndex);

  assert.notEqual(continueIndex, -1);
  assert.match(block, /dismissGrokCookieConsent\(\)/);
  assert.match(block, /GROK_LOGIN_ENTRY_TEXT_PATTERN/);
  assert.match(block, /GROK_LOGIN_ENTRY_PATH_PATTERN/);
  assert.match(block, /findGrokEmailInput\(\)/);
  assert.match(block, /\['email_entry', 'verification_code_entry', 'profile_entry', 'signed_in'\]/);
  assert.match(source, /#onetrust-reject-all-handler/);
});

test('grok email submission recognizes the localized verification page even before OTP controls are readable', () => {
  const source = fs.readFileSync('flows/grok/content/register-page.js', 'utf8');

  assert.match(source, /GROK_VERIFICATION_PAGE_TEXT_PATTERN/);
  assert.ok(source.includes('验证您(?:的)?邮箱'));
  assert.match(source, /function isGrokVerificationPage\(\)/);
  assert.match(source, /if \(isGrokVerificationPage\(\)\) return 'verification_code_entry';/);
});

test('grok email submission returns before the xAI document is replaced', () => {
  const source = fs.readFileSync('flows/grok/content/register-page.js', 'utf8');
  const start = source.indexOf('async function submitGrokEmail');
  const end = source.indexOf('function getGrokVerificationErrorText', start);
  const block = source.slice(start, end);

  assert.match(block, /state: 'email_submitted'/);
  assert.doesNotMatch(block, /await waitForGrokVerificationPageAfterEmailSubmit/);
  assert.doesNotMatch(block, /await sleep\(1200\)/);
});

test('grok profile submission waits for human verification success before clicking complete', () => {
  const source = fs.readFileSync('flows/grok/content/register-page.js', 'utf8');
  const profileIndex = source.indexOf('async function submitGrokProfile');
  const waitIndex = source.indexOf('await waitForGrokHumanVerificationSuccess()', profileIndex);
  const buttonIndex = source.indexOf('const button = findGrokSubmitButton()', profileIndex);
  const clickIndex = source.indexOf('simulateGrokClick(button)', profileIndex);

  assert.notEqual(profileIndex, -1);
  assert.notEqual(waitIndex, -1);
  assert.notEqual(buttonIndex, -1);
  assert.notEqual(clickIndex, -1);
  assert.ok(waitIndex < buttonIndex);
  assert.ok(buttonIndex < clickIndex);
  assert.match(source, /input\[name="cf-turnstile-response"\]/);
  assert.match(source, /GROK_HUMAN_VERIFICATION_SUCCESS_TIMEOUT_MS = 120 \* 1000/);
});

test('grok profile runner allows the content script to wait for human verification', async () => {
  const api = loadGrokRunnerApi();
  const sendCalls = [];
  let currentState = {
    activeFlowId: 'grok',
    grokRegisterTabId: 303,
    runtimeState: {
      flowState: {
        grok: {
          session: {
            registerTabId: 303,
          },
        },
      },
    },
  };
  const runner = api.createGrokRegisterRunner({
    addLog: async () => {},
    chrome: {
      tabs: {
        get: async (tabId) => ({ id: tabId }),
        update: async () => {},
      },
    },
    completeNodeFromBackground: async () => {},
    ensureContentScriptReadyOnTab: async () => {},
    generatePassword: () => 'StrongPassword123!',
    generateRandomName: () => ({ firstName: 'Alex', lastName: 'Morgan' }),
    getState: async () => currentState,
    getTabId: async () => 303,
    isTabAlive: async () => true,
    registerTab: async () => {},
    sendToContentScriptResilient: async (_sourceId, message, options = {}) => {
      sendCalls.push({ message, options });
      return {
        submitted: true,
        state: 'profile_submitted',
        humanVerification: 'turnstile_response',
        url: 'https://accounts.x.ai/sign-up',
      };
    },
    setPasswordState: async () => {},
    setState: async (patch) => {
      currentState = { ...currentState, ...patch };
    },
    sleepWithStop: async () => {},
    waitForTabStableComplete: async () => {},
  });

  await runner.executeGrokSubmitProfile({ nodeId: 'grok-submit-profile', ...currentState });

  const profileSubmitCall = sendCalls.find(({ message }) => message.nodeId === 'grok-submit-profile');
  assert.equal(profileSubmitCall.options.timeoutMs, api.GROK_PROFILE_SUBMIT_COMMAND_TIMEOUT_MS);
  assert.equal(profileSubmitCall.options.timeoutMs, 150 * 1000);
  assert.match(profileSubmitCall.options.logMessage, /等待人机验证成功/);
});

test('grok profile runner advances immediately after the content script submits the verified form', () => {
  const source = fs.readFileSync('flows/grok/background/register-runner.js', 'utf8');
  const profileIndex = source.indexOf('async function executeGrokSubmitProfile');
  const nextFunctionIndex = source.indexOf('async function executeGrokExtractSsoCookie', profileIndex);
  const block = source.slice(profileIndex, nextFunctionIndex);

  assert.notEqual(profileIndex, -1);
  assert.doesNotMatch(block, /sleepWithStop\(/);
  assert.doesNotMatch(block, /GROK_POST_PROFILE_CF_WAIT_MS/);
  assert.match(block, /继续设备授权/);
});

test('grok email runner resumes from an already-open verification page without resubmitting the email', async () => {
  const api = loadGrokRunnerApi();
  const sendCalls = [];
  const completed = [];
  const currentState = {
    activeFlowId: 'grok',
    grokRegisterTabId: 404,
    grokEmail: 'resume@example.com',
    runtimeState: {
      flowState: {
        grok: {
          session: { registerTabId: 404 },
          register: {
            email: 'resume@example.com',
            verificationRequestedAt: 123456,
          },
        },
      },
    },
  };
  const runner = api.createGrokRegisterRunner({
    addLog: async () => {},
    chrome: {
      tabs: {
        get: async (tabId) => ({ id: tabId }),
        update: async () => {},
      },
    },
    completeNodeFromBackground: async (nodeId, payload) => completed.push({ nodeId, payload }),
    ensureContentScriptReadyOnTab: async () => {},
    getState: async () => currentState,
    getTabId: async () => 404,
    isTabAlive: async () => true,
    registerTab: async () => {},
    resolveSignupEmailForFlow: async () => {
      throw new Error('验证码页恢复不应重新解析或生成邮箱。');
    },
    sendToContentScriptResilient: async (_sourceId, message) => {
      sendCalls.push(message);
      if (message.nodeId === 'GET_PAGE_STATE') {
        return { state: 'verification_code_entry', url: 'https://accounts.x.ai/sign-up' };
      }
      throw new Error(`验证码页恢复不应执行 ${message.nodeId}。`);
    },
    setState: async () => {},
    waitForTabStableComplete: async () => {},
  });

  await runner.executeGrokSubmitEmail({ nodeId: 'grok-submit-email', ...currentState });

  assert.deepEqual(sendCalls.map((message) => message.nodeId), ['GET_PAGE_STATE']);
  assert.equal(completed.length, 1);
  assert.equal(completed[0].nodeId, 'grok-submit-email');
  assert.equal(completed[0].payload.grokEmail, 'resume@example.com');
  assert.equal(getGrokRuntime(completed[0].payload).register.status, 'verification_requested');
});

test('grok email runner reconnects after xAI navigates to the verification page', async () => {
  const api = loadGrokRunnerApi();
  const calls = [];
  const completed = [];
  let pageStateChecks = 0;
  const currentState = {
    activeFlowId: 'grok',
    grokRegisterTabId: 405,
    runtimeState: { flowState: { grok: { session: { registerTabId: 405 } } } },
  };
  const runner = api.createGrokRegisterRunner({
    addLog: async () => {},
    chrome: { tabs: { get: async (id) => ({ id }), update: async () => {} } },
    completeNodeFromBackground: async (nodeId, payload) => completed.push({ nodeId, payload }),
    ensureContentScriptReadyOnTab: async () => {},
    getState: async () => currentState,
    getTabId: async () => 405,
    isTabAlive: async () => true,
    registerTab: async () => {},
    resolveSignupEmailForFlow: async () => 'reconnect@example.com',
    sendToContentScriptResilient: async (_sourceId, message) => {
      calls.push(message.nodeId);
      if (message.nodeId === 'GET_PAGE_STATE') {
        pageStateChecks += 1;
        return {
          state: pageStateChecks === 1 ? 'email_entry' : 'verification_code_entry',
          url: 'https://accounts.x.ai/sign-up',
        };
      }
      if (message.nodeId === 'grok-submit-email') {
        return { submitted: true, state: 'email_submitted', url: 'https://accounts.x.ai/sign-up' };
      }
      throw new Error(`不应执行 ${message.nodeId}`);
    },
    setState: async () => {},
    sleepWithStop: async () => {},
    waitForTabStableComplete: async () => {},
  });

  await runner.executeGrokSubmitEmail({ nodeId: 'grok-submit-email', ...currentState });

  assert.deepEqual(calls, ['GET_PAGE_STATE', 'grok-submit-email', 'GET_PAGE_STATE']);
  assert.equal(completed.length, 1);
  assert.equal(completed[0].payload.grokPageState, 'verification_code_entry');
  assert.equal(completed[0].payload.grokEmail, 'reconnect@example.com');
});

test('grok verification runner polls by flow node and submits normalized code', async () => {
  const api = loadGrokRunnerApi();
  const calls = [];
  let completedPayload = null;
  let currentState = {
    activeFlowId: 'grok',
    mailProvider: '2925',
    grokRegisterTabId: 101,
    grokEmail: 'grok-user@example.com',
    grokVerificationRequestedAt: 1000000,
    runtimeState: {
      flowState: {
        grok: {
          session: {
            registerTabId: 101,
          },
          register: {
            email: 'grok-user@example.com',
            verificationRequestedAt: 1000000,
          },
        },
      },
    },
  };
  const runner = api.createGrokRegisterRunner({
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
    getTabId: async () => 101,
    isTabAlive: async () => true,
    pollFlowVerificationCode: async (options) => {
      calls.push({ type: 'poll', options });
      return { code: 'ABC-123', messageId: 'mail-001' };
    },
    registerTab: async () => {},
    sendToContentScriptResilient: async (sourceId, message) => {
      calls.push({ type: 'send', sourceId, message });
      if (message.nodeId === 'GET_PAGE_STATE') {
        return { submitted: true, state: 'verification_code_entry', url: 'https://accounts.x.ai/verify' };
      }
      return { submitted: true, state: 'profile_entry', url: 'https://accounts.x.ai/profile' };
    },
    setState: async (patch) => {
      currentState = { ...currentState, ...patch };
    },
    waitForTabStableComplete: async () => {},
  });

  await runner.executeGrokSubmitVerificationCode({ nodeId: 'grok-submit-verification-code', ...currentState });

  const pollCall = calls.find((entry) => entry.type === 'poll');
  assert.equal(pollCall.options.flowId, 'grok');
  assert.equal(pollCall.options.nodeId, 'grok-submit-verification-code');
  assert.equal(pollCall.options.step, 3);
  assert.equal(pollCall.options.logStep, 3);
  assert.equal(pollCall.options.filterAfterTimestamp, 400000);
  assert.equal(pollCall.options.state.activeFlowId, 'grok');
  assert.equal(pollCall.options.state.visibleStep, 3);

  const sendCall = calls.find((entry) => (
    entry.type === 'send' && entry.message.nodeId === 'grok-submit-verification-code'
  ));
  assert.equal(sendCall.sourceId, 'grok-register-page');
  assert.equal(sendCall.message.type, 'EXECUTE_NODE');
  assert.equal(sendCall.message.nodeId, 'grok-submit-verification-code');
  assert.deepEqual(sendCall.message.payload, { code: 'ABC123' });

  assert.equal(completedPayload.grokVerificationCode, 'ABC123');
  assert.equal(completedPayload.grokVerificationRawCode, 'ABC-123');
  assert.equal(completedPayload.grokVerificationMessageId, 'mail-001');
  assert.equal(getGrokRuntime(completedPayload).register.verificationCode, 'ABC123');
  assert.equal(getGrokRuntime(completedPayload).register.status, 'verified');
});

test('grok verification runner waits for verification page before polling mail', async () => {
  const api = loadGrokRunnerApi();
  let pollCalled = false;
  let currentState = {
    activeFlowId: 'grok',
    grokRegisterTabId: 102,
    grokEmail: 'grok-user@example.com',
    grokVerificationRequestedAt: 1000000,
    runtimeState: {
      flowState: {
        grok: {
          session: {
            registerTabId: 102,
          },
          register: {
            email: 'grok-user@example.com',
            verificationRequestedAt: 1000000,
          },
        },
      },
    },
  };
  const originalDateNow = Date.now;
  let fakeNow = 1000000;
  const runner = api.createGrokRegisterRunner({
    addLog: async () => {},
    chrome: {
      tabs: {
        get: async (tabId) => ({ id: tabId }),
        update: async () => {},
      },
    },
    completeNodeFromBackground: async () => {},
    ensureContentScriptReadyOnTab: async () => {},
    getState: async () => currentState,
    getTabId: async () => 102,
    isTabAlive: async () => true,
    pollFlowVerificationCode: async () => {
      pollCalled = true;
      return { code: 'ABC-123', messageId: 'mail-001' };
    },
    registerTab: async () => {},
    sendToContentScriptResilient: async (_sourceId, message) => {
      if (message.nodeId === 'GET_PAGE_STATE') {
        return { submitted: true, state: 'email_entry', url: 'https://accounts.x.ai/sign-up' };
      }
      return { submitted: true, state: 'profile_entry', url: 'https://accounts.x.ai/profile' };
    },
    setState: async (patch) => {
      currentState = { ...currentState, ...patch };
    },
    sleepWithStop: async (ms = 0) => {
      fakeNow += Number(ms) || 1000;
    },
    waitForTabStableComplete: async () => {},
  });

  Date.now = () => fakeNow;
  try {
    await assert.rejects(
      () => runner.executeGrokSubmitVerificationCode({ nodeId: 'grok-submit-verification-code', ...currentState }),
      /尚未进入验证码页面/
    );
  } finally {
    Date.now = originalDateNow;
  }
  assert.equal(pollCalled, false);
});

test('grok SSO extraction stores only the current cookie without logging the secret value', async () => {
  const api = loadGrokRunnerApi();
  const logs = [];
  let completedPayload = null;
  let markUsedPayload = null;
  let currentState = {
    activeFlowId: 'grok',
    grokRegisterTabId: 202,
    grokSsoCookies: ['old-cookie'],
    runtimeState: {
      flowState: {
        grok: {
          session: {
            registerTabId: 202,
          },
          sso: {
            cookies: ['old-cookie'],
          },
          upload: {
            status: 'uploaded',
            uploadedAt: 1000,
            message: 'old upload',
            targetUrl: 'https://old.example.com/api/remote-account/inject',
          },
        },
      },
    },
  };
  const runner = api.createGrokRegisterRunner({
    addLog: async (message, level) => {
      logs.push({ message, level });
    },
    chrome: {
      cookies: {
        get: async () => ({ value: 'new-cookie' }),
      },
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
    getTabId: async () => 202,
    isTabAlive: async () => true,
    markCurrentRegistrationAccountUsed: async (state) => {
      markUsedPayload = state;
    },
    registerTab: async () => {},
    sendToContentScriptResilient: async () => {
      throw new Error('content fallback should not be used when chrome.cookies finds sso');
    },
    setState: async (patch) => {
      currentState = { ...currentState, ...patch };
    },
    sleepWithStop: async () => {},
    waitForTabStableComplete: async () => {},
  });

  await runner.executeGrokExtractSsoCookie({ nodeId: 'grok-extract-sso-cookie', ...currentState });

  assert.equal(completedPayload.grokSsoCookie, 'new-cookie');
  assert.deepEqual(completedPayload.grokSsoCookies, ['new-cookie']);
  assert.equal(completedPayload.grokWebchat2ApiUploadStatus, '');
  assert.equal(getGrokRuntime(completedPayload).sso.currentCookie, 'new-cookie');
  assert.deepEqual(getGrokRuntime(completedPayload).sso.cookies, ['new-cookie']);
  assert.equal(getGrokRuntime(completedPayload).upload.status, '');
  assert.equal(getGrokRuntime(completedPayload).upload.targetUrl, '');
  assert.equal(markUsedPayload.grokSsoCookie, 'new-cookie');
  assert.equal(logs.some(({ message }) => message.includes('new-cookie')), false);
});

test('grok register runner requires background node completion dependency', () => {
  const api = loadGrokRunnerApi();
  assert.throws(
    () => api.createGrokRegisterRunner({}),
    /requires completeNodeFromBackground/
  );
});
