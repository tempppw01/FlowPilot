const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('flows/devin/background/register-runner.js', 'utf8');
function createRunner(deps) {
  const scope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundDevinRegisterRunner;`)(scope);
  return api.createDevinRegisterRunner(deps);
}

test('Devin step 1 clears Devin cookies and persistent login storage, preserves cache, then opens signup', async () => {
  const events = [];
  const logs = [];
  const cookieQueries = [];
  const removedCookieKeys = new Set();
  let state = {};
  const chrome = {
    cookies: {
      getAllCookieStores: async () => [{ id: 'store-1' }],
      getAll: async (query) => {
        cookieQueries.push(query);
        const all = [
          { storeId: 'store-1', domain: '.devin.ai', path: '/', name: 'session' },
          { storeId: 'store-1', domain: 'app.devin.ai', path: '/', name: 'app-session' },
          { storeId: 'store-1', domain: 'auth.devin.ai', path: '/', name: 'auth-session' },
          { storeId: 'store-1', domain: '.example.com', path: '/', name: 'keep' },
        ];
        return all.filter((cookie) => {
          if (cookie.domain === '.example.com') return false;
          const key = `${cookie.storeId}|${cookie.domain.replace(/^\.+/, '')}|${cookie.path}|${cookie.name}|{}`;
          if (removedCookieKeys.has(key)) return false;
          const queriedHost = new URL(query.url).hostname;
          return cookie.domain === '.devin.ai' || cookie.domain === queriedHost;
        });
      },
      remove: async (details) => {
        events.push(['remove-cookie', details]);
        const url = new URL(details.url);
        const domain = url.hostname;
        const key = `store-1|${domain}|${url.pathname}|${details.name}|{}`;
        removedCookieKeys.add(key);
        return { name: details.name };
      },
    },
    browsingData: { remove: async (origins, data) => events.push(['clear-data', origins, data]) },
    tabs: { get: async (id) => ({ id }) },
  };
  const runner = createRunner({
    chrome,
    addLog: async (message, level) => logs.push([message, level]),
    completeNodeFromBackground: async () => events.push(['complete']),
    getState: async () => state,
    isTabAlive: async () => false,
    registerTab: async () => events.push(['register-tab']),
    reuseOrCreateTab: async (_source, url) => { events.push(['open', url]); return 12; },
    setState: async (patch) => { state = { ...state, ...patch }; events.push(['state', patch]); },
    startDevinOAuth: async () => { events.push(['oauth']); return { oauthUrl: 'https://app.devin.ai/auth/cli/continue?state=x', oauthState: 'x' }; },
    DEVIN_REGISTER_INJECT_FILES: ['flows/devin/content/register-page.js'],
  });
  await runner.execute({ nodeId: 'devin-open-authorization' });
  assert.deepEqual(cookieQueries.slice(0, 3), [
    { storeId: 'store-1', url: 'https://devin.ai/' },
    { storeId: 'store-1', url: 'https://app.devin.ai/' },
    { storeId: 'store-1', url: 'https://auth.devin.ai/' },
  ]);
  assert.deepEqual(events.filter((event) => event[0] === 'remove-cookie').map((event) => event[1].name).sort(), ['app-session', 'auth-session', 'session']);
  assert.equal(events.filter((event) => event[0] === 'remove-cookie').some((event) => event[1].name === 'keep'), false);
  const storageCleanup = events.find((event) => event[0] === 'clear-data');
  assert.deepEqual(storageCleanup[1], { origins: ['https://devin.ai', 'https://app.devin.ai', 'https://auth.devin.ai'] });
  assert.deepEqual(storageCleanup[2], { localStorage: true, indexedDB: true });
  assert.ok(logs.some(([message]) => message.includes('正在读取 Devin 域名 cookies')));
  assert.ok(logs.some(([message]) => message.includes('清理进度 3/3')));
  assert.ok(logs.some(([message]) => message.includes('cookies 与登录存储清理完成')));
  assert.ok(logs.some(([message]) => message.includes('未清理站点缓存')));
  assert.deepEqual(events.find((event) => event[0] === 'open'), ['open', 'https://app.devin.ai/auth/signup?redirect=/']);
  assert.equal(events.some((event) => event[0] === 'oauth'), false);
  assert.equal(state.devinRegistrationCompleted, false);
  assert.equal(state.devinOAuthUrl, null);
});

test('CPA OAuth link cannot be fetched before the Devin free-plan registration step completes', async () => {
  const trace = [];
  const runner = createRunner({
    addLog: async () => {},
    completeNodeFromBackground: async () => {},
    getState: async () => ({ devinRegistrationCompleted: false }),
    startDevinOAuth: async () => { trace.push('oauth'); return { oauthUrl: 'https://app.devin.ai/auth', oauthState: 's' }; },
  });
  await assert.rejects(
    runner.execute({ nodeId: 'devin-start-cpa-oauth' }),
    /请先完成或手动跳过 Devin 注册步骤/
  );
  assert.deepEqual(trace, []);
});

test('manually skipping every Devin registration step still allows fetching the CPA OAuth link', async () => {
  const trace = [];
  const nodeStatuses = Object.fromEntries([
    'devin-open-authorization',
    'devin-enter-email',
    'devin-enter-email-code',
    'devin-select-free-plan',
  ].map((nodeId) => [nodeId, 'skipped']));
  const runner = createRunner({
    addLog: async () => {},
    chrome: { tabs: { get: async (id) => ({ id }) } },
    completeNodeFromBackground: async (nodeId) => trace.push(['complete', nodeId]),
    getState: async () => ({ devinRegistrationCompleted: false, nodeStatuses }),
    registerTab: async () => {},
    reuseOrCreateTab: async (_source, url) => { trace.push(['open', url]); return 32; },
    setState: async (patch) => trace.push(['state', patch]),
    startDevinOAuth: async () => {
      trace.push(['oauth']);
      return { oauthUrl: 'https://app.devin.ai/auth/cli/continue?state=manual-skip', oauthState: 'manual-skip' };
    },
  });

  await runner.execute({ nodeId: 'devin-start-cpa-oauth' });

  assert.ok(trace.some((event) => event[0] === 'oauth'));
  assert.deepEqual(trace.find((event) => event[0] === 'open'), [
    'open',
    'https://app.devin.ai/auth/cli/continue?state=manual-skip',
  ]);
  assert.ok(trace.some((event) => event[0] === 'complete' && event[1] === 'devin-start-cpa-oauth'));
});

test('selecting the free plan marks registration complete before CPA OAuth is fetched', async () => {
  const trace = [];
  let state = { devinRegisterTabId: 12, devinRegistrationCompleted: false };
  const runner = createRunner({
    addLog: async (message) => trace.push(['log', message]),
    chrome: { tabs: { get: async (id) => ({ id }), update: async () => {} } },
    completeNodeFromBackground: async (nodeId) => trace.push(['complete', nodeId]),
    getState: async () => state,
    getTabId: async () => 12,
    isTabAlive: async () => true,
    ready: async () => {},
    sendToContentScriptResilient: async (_source, message) => { trace.push(['page', message.action]); return { selectedPlan: 'Free' }; },
    setState: async (patch) => { state = { ...state, ...patch }; trace.push(['state', patch]); },
    registerTab: async () => {},
    reuseOrCreateTab: async (_source, url) => { trace.push(['open', url]); return 12; },
    startDevinOAuth: async () => {
      assert.equal(state.devinRegistrationCompleted, true);
      trace.push(['oauth']);
      return { oauthUrl: 'https://app.devin.ai/auth/cli/continue?state=x', oauthState: 'x' };
    },
    DEVIN_REGISTER_INJECT_FILES: [],
  });
  await runner.execute({ nodeId: 'devin-select-free-plan' });
  assert.equal(state.devinRegistrationCompleted, true);
  await runner.execute({ nodeId: 'devin-start-cpa-oauth' });
  assert.ok(trace.findIndex((event) => event[0] === 'complete' && event[1] === 'devin-select-free-plan')
    < trace.findIndex((event) => event[0] === 'oauth'));
  assert.deepEqual(trace.find((event) => event[0] === 'open'), ['open', 'https://app.devin.ai/auth/cli/continue?state=x']);
});

test('Devin register runner uses shared email resolver and verification poller', async () => {
  const trace = [];
  let state = { email: 'a@example.com' };
  const chrome = { tabs: { get: async (id) => ({ id }), update: async () => {} } };
  const runner = createRunner({
    chrome,
    addLog: async () => {}, completeNodeFromBackground: async (nodeId) => trace.push(['complete', nodeId]),
    ensureContentScriptReadyOnTab: async () => {}, getState: async () => state,
    getTabId: async () => 21, isTabAlive: async () => true,
    pollFlowVerificationCode: async (options) => { trace.push(['poll', options.flowId]); return { code: '123456' }; },
    registerTab: async () => {}, resolveSignupEmailForFlow: async (s) => { trace.push(['email', s.flowId]); return s.email; },
    sendToContentScriptResilient: async (_source, message) => { trace.push(['command', message.action, message.payload]); return { url: 'https://app.devin.ai/signup' }; },
    setState: async (patch) => { state = { ...state, ...patch }; },
    waitForTabStableComplete: async () => {},
  });
  await runner.execute({ nodeId: 'devin-enter-email' });
  await runner.execute({ nodeId: 'devin-enter-email-code' });
  assert.ok(trace.some((event) => event[0] === 'email' && event[1] === 'devin'));
  assert.ok(trace.some((event) => event[0] === 'poll' && event[1] === 'devin'));
  assert.ok(trace.some((event) => event[0] === 'command' && event[1] === 'submit-code' && event[2].code === '123456'));
});

test('Devin content handler answers readiness pings without duplicating listeners', async () => {
  const listeners = [];
  const window = {};
  const chrome = { runtime: { onMessage: { addListener: (listener) => listeners.push(listener) } } };
  const scope = { window, chrome, HTMLElement: class {}, HTMLInputElement: class {}, HTMLTextAreaElement: class {} };
  const api = new Function('self', 'window', 'chrome', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', `${require('node:fs').readFileSync('flows/devin/content/register-page.js', 'utf8')}; return self.MultiPageDevinRegisterPage;`)(scope, window, chrome, scope.HTMLElement, scope.HTMLInputElement, scope.HTMLTextAreaElement);
  new Function('self', 'window', 'chrome', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', require('node:fs').readFileSync('flows/devin/content/register-page.js', 'utf8'))(scope, window, chrome, scope.HTMLElement, scope.HTMLInputElement, scope.HTMLTextAreaElement);
  assert.equal(listeners.length, 1);
  let response;
  assert.equal(listeners[0]({ type: 'PING' }, {}, (value) => { response = value; }), false);
  assert.deepEqual(response, { ok: true, source: 'devin-register-page' });
  assert.equal(typeof api.execute, 'function');
});

test('Devin runner rejects a stale saved tab ID when the registered tab is different', async () => {
  const calls = [];
  let state = { devinRegisterTabId: 99 };
  const runner = createRunner({
    chrome: { tabs: { get: async (id) => id === 12 ? { id } : Promise.reject(new Error('No tab')) } },
    completeNodeFromBackground: async () => {},
    ensureContentScriptReadyOnTab: async (_source, tabId) => calls.push(['ready', tabId]),
    getState: async () => state,
    getTabId: async () => 12,
    isTabAlive: async () => true,
    sendToContentScriptResilient: async (_source, message) => { calls.push(['command', message.action]); return {}; },
    setState: async (patch) => { state = { ...state, ...patch }; },
  });
  await runner.execute({ nodeId: 'devin-select-free-plan' });
  assert.ok(calls.some(([kind, tabId]) => kind === 'ready' && tabId === 12));
});

test('Devin callback step submits the matching localhost callback and completes the final node', async () => {
  const calls = [];
  let state = { devinRegisterTabId: 12, devinRegistrationCompleted: true, devinOAuthState: 'state-123' };
  const callbackUrl = 'http://localhost:1455/callback?code=oauth-code&state=state-123';
  const runner = createRunner({
    chrome: { tabs: { query: async () => [{ id: 12, url: callbackUrl }] } },
    completeNodeFromBackground: async (nodeId) => calls.push(['complete', nodeId]),
    getState: async () => state,
    setState: async (patch) => { state = { ...state, ...patch }; calls.push(['state', patch]); },
    sleepWithStop: async () => {},
    submitDevinOAuthCallback: async (_state, url) => calls.push(['submit', url]),
  });
  await runner.execute({ nodeId: 'devin-submit-callback' });
  assert.ok(calls.some(([kind, url]) => kind === 'submit' && url === callbackUrl));
  assert.equal(state.devinOAuthCallbackUrl, callbackUrl);
  assert.ok(calls.some(([kind, nodeId]) => kind === 'complete' && nodeId === 'devin-submit-callback'));
});

test('Devin step 1 stops when a cookie remains after the removal request', async () => {
  const opens = [];
  const logs = [];
  const runner = createRunner({
    addLog: async (message) => logs.push(message),
    chrome: {
      cookies: {
        getAll: async () => [{ storeId: 'store-1', domain: 'auth.devin.ai', path: '/', name: 'session' }],
        remove: async () => null,
      },
      tabs: { get: async (id) => ({ id }) },
    },
    completeNodeFromBackground: async () => {},
    getState: async () => ({}),
    reuseOrCreateTab: async (_source, url) => { opens.push(url); return 12; },
    setState: async () => {},
  });

  await assert.rejects(
    runner.execute({ nodeId: 'devin-open-authorization' }),
    /仍有 1 个 Devin cookies 未能删除/
  );
  assert.deepEqual(opens, []);
  assert.ok(logs.some((message) => message.includes('仍有 1 个 Devin cookies 未能删除')));
});
