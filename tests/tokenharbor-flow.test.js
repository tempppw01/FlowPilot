const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { readStepDefinitionsBundle, readFlowRegistryBundle } = require('./helpers/script-bundles.js');

const runnerSource = fs.readFileSync('flows/tokenharbor/background/register-runner.js', 'utf8');
function createRunner(deps = {}) {
  const scope = {};
  const api = new Function('self', `${runnerSource}; return self.MultiPageBackgroundTokenHarborRegisterRunner;`)(scope);
  return api.createTokenHarborRegisterRunner(deps);
}

test('Token Harbor registers a four-step email/password verification workflow', () => {
  const scope = {};
  const steps = new Function('self', `${readStepDefinitionsBundle()}; return self.MultiPageStepDefinitions;`)(scope);
  const actual = steps.getSteps({ activeFlowId: 'tokenharbor' });
  assert.deepEqual(actual.map((step) => step.key), [
    'tokenharbor-open-signup', 'tokenharbor-submit-signup',
    'tokenharbor-fetch-verification-link', 'tokenharbor-open-verification-link',
  ]);
  assert.ok(actual.every((step) => step.flowId === 'tokenharbor'));
  assert.equal(actual.length, 4);
  const registryScope = {};
  const registry = new Function('self', `${readFlowRegistryBundle()}; return self.MultiPageFlowRegistry;`)(registryScope);
  assert.equal(registry.getFlowLabel('tokenharbor'), 'Token Harbor');
  assert.equal(registry.getFlowCapabilities('tokenharbor').supportsAutomaticRun, true);
});

test('Token Harbor step 1 clears only Token Harbor cookies before opening signup', async () => {
  const calls = [];
  const runner = createRunner({
    chrome: { browsingData: { remove: async (...args) => calls.push(['remove', ...args]) } },
    completeNodeFromBackground: async (nodeId, patch) => calls.push(['complete', nodeId, patch]),
    registerTab: async (...args) => calls.push(['register', ...args]),
    reuseOrCreateTab: async (...args) => { calls.push(['open', ...args]); return 12; },
    setState: async () => {},
  });
  await runner.execute({ nodeId: 'tokenharbor-open-signup' });
  assert.deepEqual(calls.find(([kind]) => kind === 'remove').slice(1), [
    { origins: ['https://tokenharbor.ai', 'https://www.tokenharbor.ai'] },
    { cookies: true },
  ]);
  assert.ok(calls.findIndex(([kind]) => kind === 'remove') < calls.findIndex(([kind]) => kind === 'open'));
});

test('Token Harbor signup creates an SMSBower mailbox and submits a compliant password', async () => {
  const calls = [];
  let state = { tokenHarborRegisterTabId: 12, customPassword: '' };
  const runner = createRunner({
    chrome: { tabs: { get: async (id) => ({ id }), update: async () => {} } },
    completeNodeFromBackground: async (nodeId, patch) => calls.push(['complete', nodeId, patch]),
    ensureContentScriptReadyOnTab: async () => {},
    fetchGeneratedEmail: async (_state, options) => { calls.push(['email', options]); state.currentSmsBowerMailActivation = { id: 'mail-1', address: 'test@example.com' }; return 'test@example.com'; },
    generatePassword: () => 'LongEnoughPassword42!',
    getState: async () => state, getTabId: async () => 12,
    sendToContentScriptResilient: async (_source, message) => { calls.push(['page', message]); return { url: 'https://tokenharbor.ai/login?mode=signup' }; },
    setPasswordState: async (password) => { state.password = password; },
    setState: async (patch) => { state = { ...state, ...patch }; },
    waitForTabStableComplete: async () => {},
    SMSBOWER_MAIL_PROVIDER: 'smsbower-mail', SMSBOWER_MAIL_SERVICE_CODE: 'acz',
  });
  await runner.execute({ nodeId: 'tokenharbor-submit-signup' });
  assert.equal(calls.find((item) => item[0] === 'email')[1].mailProvider, 'smsbower-mail');
  assert.equal(calls.find((item) => item[0] === 'email')[1].smsbowerMailServiceCode, 'acz');
  const page = calls.find((item) => item[0] === 'page')[1];
  assert.deepEqual(page.payload, { email: 'test@example.com', password: 'LongEnoughPassword42!' });
  assert.equal(state.tokenHarborEmail, 'test@example.com');
  assert.equal(state.password, 'LongEnoughPassword42!');
  assert.equal(state.tokenHarborRegistrationStatus, 'verification_pending');
});

test('Token Harbor fetches the verification link only from a matching SMSBower activation', async () => {
  const calls = [];
  let state = { tokenHarborEmail: 'test@example.com', currentSmsBowerMailActivation: { id: 'mail-1' } };
  const runner = createRunner({
    completeNodeFromBackground: async (nodeId, patch) => calls.push(['complete', nodeId, patch]),
    getState: async () => state,
    pollSmsBowerMailLink: async (step, pollState, options) => { calls.push(['poll', step, pollState, options]); return { link: 'https://tokenharbor.ai/verify-email?token=abc', mailId: 'mail-1' }; },
    setState: async (patch) => { state = { ...state, ...patch }; },
  });
  await runner.execute({ nodeId: 'tokenharbor-fetch-verification-link', mailProvider: 'smsbower-mail' });
  const poll = calls.find((item) => item[0] === 'poll');
  assert.equal(poll[1], 3);
  assert.deepEqual(poll[3].hostFilters, ['tokenharbor.ai']);
  assert.equal(poll[3].targetEmail, 'test@example.com');
  assert.equal(state.tokenHarborVerificationLink, 'https://tokenharbor.ai/verify-email?token=abc');
  assert.equal(state.tokenHarborVerificationMessageId, 'mail-1');
});

test('Token Harbor rejects unrelated links and opens a trusted verification link', async () => {
  const calls = [];
  let state = { tokenHarborRegisterTabId: 12, tokenHarborVerificationLink: 'https://evil.example/verify-email?token=x' };
  let tabUrl = '';
  const runner = createRunner({
    chrome: { tabs: { get: async (id) => ({ id, url: tabUrl }), update: async (id, patch) => calls.push(['tab', id, patch]) } },
    completeNodeFromBackground: async (nodeId) => calls.push(['complete', nodeId]),
    getState: async () => state, getTabId: async () => 12,
    registerTab: async () => {}, setState: async (patch) => { state = { ...state, ...patch }; },
    sleepWithStop: async () => {}, waitForTabStableComplete: async () => {},
  });
  await assert.rejects(runner.execute({ nodeId: 'tokenharbor-open-verification-link' }), /无效或不受信任/);
  assert.equal(calls.some((item) => item[0] === 'tab'), false);
  state.tokenHarborVerificationLink = 'https://tokenharbor.ai/verify-email?token=abc';
  tabUrl = 'https://tokenharbor.ai/dashboard?verify=success';
  await runner.execute({ nodeId: 'tokenharbor-open-verification-link' });
  assert.deepEqual(calls.find((item) => item[0] === 'tab')[2], { url: state.tokenHarborVerificationLink, active: true });
  assert.equal(state.tokenHarborRegistrationStatus, 'verified');
});

test('Token Harbor does not mark verification successful when the success URL is absent', async () => {
  let state = { tokenHarborRegisterTabId: 12, tokenHarborVerificationLink: 'https://tokenharbor.ai/verify-email?token=abc' };
  const runner = createRunner({
    chrome: { tabs: { get: async (id) => ({ id, url: 'https://tokenharbor.ai/login?mode=signup' }), update: async () => {} } },
    completeNodeFromBackground: async () => {}, getState: async () => state, getTabId: async () => 12,
    registerTab: async () => {}, setState: async (patch) => { state = { ...state, ...patch }; },
    sleepWithStop: async () => {}, waitForTabStableComplete: async () => {},
  });
  await assert.rejects(runner.execute({ nodeId: 'tokenharbor-open-verification-link' }), /尚未确认邮箱验证成功/);
  assert.notEqual(state.tokenHarborRegistrationStatus, 'verified');
});
