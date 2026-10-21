/*
 * @Description: Pin the fork-specific signup behaviours that intentionally diverge
 *               from upstream FlowPilot 3.2 (see upstream commit 56ffca6).
 *               Upstream dropped the step 5 profile page and the registration
 *               success page from the step 2/step 3 state handling; this fork keeps
 *               them, so the upstream patches must not be applied blindly.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const signupFlowSource = fs.readFileSync('background/signup-flow-helpers.js', 'utf8');
const signupFlowGlobalScope = {};
const signupFlowApi = new Function('self', `${signupFlowSource}; return self.MultiPageSignupFlowHelpers;`)(signupFlowGlobalScope);

const authSource = fs.readFileSync('flows/openai/content/openai-auth.js', 'utf8');

function extractFunction(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => authSource.indexOf(marker))
    .find((index) => index >= 0);
  if (start < 0) {
    throw new Error(`missing function ${name}`);
  }

  let parenDepth = 0;
  let signatureEnded = false;
  let braceStart = -1;
  for (let index = start; index < authSource.length; index += 1) {
    const char = authSource[index];
    if (char === '(') {
      parenDepth += 1;
    } else if (char === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        signatureEnded = true;
      }
    } else if (char === '{' && signatureEnded) {
      braceStart = index;
      break;
    }
  }
  if (braceStart < 0) {
    throw new Error(`missing body for function ${name}`);
  }

  let depth = 0;
  let end = braceStart;
  for (; end < authSource.length; end += 1) {
    if (authSource[end] === '{') depth += 1;
    if (authSource[end] === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }

  return authSource.slice(start, end);
}

function createEntryStateInspector(postVerificationState) {
  return new Function(`
const location = { href: 'https://auth.openai.com/create-account/profile' };

function isPhoneVerificationPageReady() { return false; }
function isVerificationPageStillVisible() { return false; }
function getSignupPasswordInput() { return null; }
function isSignupPasswordPage() { return false; }
function getSignupEmailInput() { return null; }
function getSignupPhoneInput() { return null; }
function findSignupEntryTrigger() { return null; }
function getStep4PostVerificationState() { return ${JSON.stringify(postVerificationState)}; }

${extractFunction('inspectSignupEntryState')}

return { inspect: inspectSignupEntryState };
`)();
}

function createStep3Runner(snapshot) {
  return new Function(`
const logs = [];
const completions = [];

function inspectSignupEntryState() { return ${JSON.stringify(snapshot)}; }
function log(message, level = 'info') { logs.push({ message, level }); }
function reportComplete(step, payload) { completions.push({ step, payload }); }

${extractFunction('step3_fillEmailPassword')}

return {
  async run(payload) {
    const result = await step3_fillEmailPassword(payload);
    return { result, completions, logs };
  },
};
`)();
}

test('signup flow helper keeps the step 5 profile page as a valid step 2 landing state', async () => {
  let ensureCalls = 0;

  const helpers = signupFlowApi.createSignupFlowHelpers({
    buildGeneratedAliasEmail: () => '',
    chrome: {
      tabs: {
        get: async () => ({
          id: 24,
          url: 'https://auth.openai.com/create-account/profile',
        }),
      },
    },
    ensureContentScriptReadyOnTab: async () => {
      ensureCalls += 1;
    },
    ensureHotmailAccountForFlow: async () => ({}),
    ensureLuckmailPurchaseForFlow: async () => ({}),
    isGeneratedAliasProvider: () => false,
    isHotmailProvider: () => false,
    isLuckmailProvider: () => false,
    isSignupEmailVerificationPageUrl: () => false,
    isSignupPasswordPageUrl: () => false,
    isSignupPhoneVerificationPageUrl: () => false,
    reuseOrCreateTab: async () => 24,
    sendToContentScriptResilient: async () => ({}),
    setEmailState: async () => {},
    SIGNUP_ENTRY_URL: 'https://chatgpt.com/',
    OPENAI_AUTH_INJECT_FILES: [],
    waitForTabUrlMatch: async (_tabId, predicate) => (
      predicate('https://auth.openai.com/create-account/profile')
        ? { id: 24, url: 'https://auth.openai.com/create-account/profile' }
        : null
    ),
  });

  const result = await helpers.ensureSignupPostEmailPageReadyInTab(24, 2);

  assert.deepStrictEqual(result, {
    ready: true,
    state: 'profile_page',
    url: 'https://auth.openai.com/create-account/profile',
  });
  assert.equal(ensureCalls, 1);
});

test('signup entry state still reports the step 5 profile page', () => {
  const api = createEntryStateInspector({
    state: 'step5',
    url: 'https://auth.openai.com/create-account/profile',
  });

  assert.deepStrictEqual(api.inspect(), {
    state: 'profile_page',
    url: 'https://auth.openai.com/create-account/profile',
  });
});

test('step 3 treats an already finished registration as a skipped password step', async () => {
  const api = createStep3Runner({
    state: 'registration_success_page',
    skipProfileStep: true,
    skipProfileStepReason: 'registration_success_page',
    url: 'https://chatgpt.com/',
  });

  const { result, completions, logs } = await api.run({
    email: 'user@example.com',
    password: 'Secret123!',
  });

  assert.equal(completions.length, 1);
  assert.equal(completions[0].step, 3);
  assert.equal(result.skippedPasswordPage, true);
  assert.equal(result.skipProfileStep, true);
  assert.equal(result.skipProfileStepReason, 'registration_success_page');
  assert.equal(result.signupVerificationRequestedAt, null);
  assert.equal(
    logs.some((entry) => /密码页按已跳过处理/.test(entry.message)),
    true
  );
});

test('step 3 treats the logged in home page as a skipped password step', async () => {
  const api = createStep3Runner({
    state: 'logged_in_home',
    skipProfileStep: true,
    skipRegistrationWaitStep: true,
    url: 'https://chatgpt.com/',
  });

  const { result, completions } = await api.run({
    email: 'user@example.com',
    password: 'Secret123!',
  });

  assert.equal(completions.length, 1);
  assert.equal(result.skippedPasswordPage, true);
  assert.equal(result.skipProfileStep, true);
  assert.equal(result.skipRegistrationWaitStep, true);
});
