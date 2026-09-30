(function attachBackgroundDevinRegisterRunner(root, factory) {
  root.MultiPageBackgroundDevinRegisterRunner = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundDevinRegisterRunnerModule() {
  const DEVIN_ORIGIN = 'https://devin.ai';
  const DEVIN_SIGNUP_URL = 'https://app.devin.ai/auth/signup?redirect=/';
  const DEVIN_SOURCE_ID = 'devin-register-page';
  const DEVIN_COOKIE_DOMAIN = 'devin.ai';
  const DEVIN_COOKIE_URLS = ['https://devin.ai/', 'https://app.devin.ai/', 'https://auth.devin.ai/'];
  const DEVIN_STORAGE_ORIGINS = ['https://devin.ai', 'https://app.devin.ai', 'https://auth.devin.ai'];
  const DEVIN_REGISTRATION_NODE_IDS = [
    'devin-open-authorization',
    'devin-enter-email',
    'devin-enter-email-code',
    'devin-select-free-plan',
  ];

  function clean(value) { return String(value ?? '').trim(); }
  function errorText(error) { return error instanceof Error ? error.message : clean(error) || 'Unknown error'; }
  function isRegistrationStepSettled(status) {
    return ['completed', 'manual_completed', 'skipped'].includes(clean(status).toLowerCase());
  }

  function createDevinRegisterRunner(deps = {}) {
    const {
      addLog = async () => {}, chrome = globalThis.chrome, completeNodeFromBackground,
      ensureContentScriptReadyOnTab = null, getState = async () => ({}), getTabId = async () => null,
      isTabAlive = async () => false, pollFlowVerificationCode = null,
      registerTab = async () => {}, resolveSignupEmailForFlow = null,
      reuseOrCreateTab = async () => null, sendToContentScriptResilient = null,
      setState = async () => {}, sleepWithStop = async (ms) => new Promise((r) => setTimeout(r, ms)),
      throwIfStopped = () => {}, waitForTabStableComplete = null,
      startDevinOAuth = null, submitDevinOAuthCallback = null, DEVIN_REGISTER_INJECT_FILES = [],
    } = deps;

    async function log(message, level = 'info', nodeId = '') {
      await addLog(message, level, nodeId ? { nodeId } : {});
    }
    async function complete(nodeId, patch = {}) {
      await setState(patch);
      await completeNodeFromBackground(nodeId, patch);
    }
    async function alive(tabId) {
      if (!Number.isInteger(tabId) || tabId <= 0) return false;
      if (chrome?.tabs?.get) return Boolean((await chrome.tabs.get(tabId).catch(() => null))?.id === tabId);
      return Number(await getTabId(DEVIN_SOURCE_ID) || 0) === tabId && await isTabAlive(DEVIN_SOURCE_ID);
    }
    async function ensureTab(state = {}, openIfMissing = false) {
      const saved = Number(state.devinRegisterTabId || state.tabRegistry?.[DEVIN_SOURCE_ID]?.tabId || 0);
      const registered = Number(await getTabId(DEVIN_SOURCE_ID) || 0);
      const tabId = await alive(saved) ? saved : (await alive(registered) ? registered : 0);
      if (tabId) return tabId;
      if (!openIfMissing) throw new Error('找不到 Devin 注册标签页，请重新执行步骤 1。');
      const opened = await reuseOrCreateTab(DEVIN_SOURCE_ID, DEVIN_ORIGIN, {
        inject: DEVIN_REGISTER_INJECT_FILES, injectSource: DEVIN_SOURCE_ID,
      });
      if (!Number.isInteger(opened)) throw new Error('无法打开 Devin 注册页面。');
      await registerTab(DEVIN_SOURCE_ID, opened);
      await setState({ devinRegisterTabId: opened });
      return opened;
    }
    async function ready(tabId) {
      if (typeof waitForTabStableComplete === 'function') {
        await waitForTabStableComplete(tabId, { timeoutMs: 90000, retryDelayMs: 350, stableMs: 800 });
      }
      if (typeof ensureContentScriptReadyOnTab === 'function') {
        await ensureContentScriptReadyOnTab(DEVIN_SOURCE_ID, tabId, {
          inject: DEVIN_REGISTER_INJECT_FILES, injectSource: DEVIN_SOURCE_ID,
          timeoutMs: 30000, retryDelayMs: 500,
        });
      }
    }
    async function command(nodeId, action, payload = {}) {
      if (typeof sendToContentScriptResilient !== 'function') throw new Error('Devin 页面通信能力不可用。');
      const result = await sendToContentScriptResilient(DEVIN_SOURCE_ID, {
        type: 'DEVIN_EXECUTE_NODE', nodeId, action, payload, source: 'background',
      }, { timeoutMs: 45000, retryDelayMs: 700 });
      if (result?.error) throw new Error(result.error);
      if (result?.needsHuman) throw new Error('Devin 页面要求人工验证，请完成页面验证后重新执行当前步骤。');
      return result || {};
    }
    async function clearDevinCookies(nodeId = 'devin-open-authorization') {
      const cookies = chrome?.cookies;
      if (cookies?.getAll && cookies?.remove) {
        const stores = cookies.getAllCookieStores ? await cookies.getAllCookieStores().catch(() => []) : [];
        const storeIds = stores.length ? stores.map((store) => store.id).filter(Boolean) : [null];
        const queries = storeIds.flatMap((storeId) => DEVIN_COOKIE_URLS.map((url) => ({
          ...(storeId ? { storeId } : {}), url,
        })));
        await log('步骤 1：正在读取 Devin 域名 cookies...', 'info', nodeId);
        const cookieLists = await Promise.all(queries.map((query) => cookies.getAll(query).catch(() => [])));
        const uniqueCookies = new Map();
        for (const cookie of cookieLists.flat()) {
          const domain = clean(cookie.domain).replace(/^\.+/, '').toLowerCase();
          if (!(domain === DEVIN_COOKIE_DOMAIN || domain.endsWith(`.${DEVIN_COOKIE_DOMAIN}`))) continue;
          const key = `${cookie.storeId || ''}|${domain}|${cookie.path}|${cookie.name}|${JSON.stringify(cookie.partitionKey || {})}`;
          if (!uniqueCookies.has(key)) uniqueCookies.set(key, { ...cookie, normalizedDomain: domain });
        }
        const targets = Array.from(uniqueCookies.values());
        await log(`步骤 1：找到 ${targets.length} 个 Devin cookies，正在清理...`, 'info', nodeId);
        let removed = 0;
        const batchSize = 20;
        for (let index = 0; index < targets.length; index += batchSize) {
          throwIfStopped();
          const batch = targets.slice(index, index + batchSize);
          const results = await Promise.allSettled(batch.map((cookie) => {
            const details = {
              url: `https://${cookie.normalizedDomain}${cookie.path || '/'}`,
              name: cookie.name,
            };
            if (cookie.storeId) details.storeId = cookie.storeId;
            else if (stores.length) details.storeId = targets[index]?.storeId || stores[0].id;
            if (cookie.partitionKey) details.partitionKey = cookie.partitionKey;
            return cookies.remove(details);
          }));
          removed += results.filter((result) => result.status === 'fulfilled' && result.value).length;
          const failed = results.filter((result) => result.status === 'rejected').length;
          await log(`步骤 1：Devin cookies 清理进度 ${Math.min(index + batch.length, targets.length)}/${targets.length}（已删除 ${removed}${failed ? `，${failed} 个请求失败` : ''}）。`, failed ? 'warn' : 'info', nodeId);
        }
        const remainingLists = await Promise.all(queries.map((query) => cookies.getAll(query).catch(() => [])));
        const remaining = new Set(remainingLists.flat().map((cookie) =>
          `${cookie.storeId || ''}|${clean(cookie.domain).replace(/^\.+/, '').toLowerCase()}|${cookie.path}|${cookie.name}|${JSON.stringify(cookie.partitionKey || {})}`
        ));
        const remainingTargets = targets.filter((cookie) => remaining.has(
          `${cookie.storeId || ''}|${cookie.normalizedDomain}|${cookie.path}|${cookie.name}|${JSON.stringify(cookie.partitionKey || {})}`
        ));
        if (remainingTargets.length) {
          throw new Error(`仍有 ${remainingTargets.length} 个 Devin cookies 未能删除，已停止打开注册页面。`);
        }
      }
      const browsingData = chrome?.browsingData;
      if (browsingData?.remove) {
        await log('步骤 1：正在清理 Devin 登录存储（不清理缓存）...', 'info', nodeId);
        await browsingData.remove({ origins: DEVIN_STORAGE_ORIGINS }, {
          localStorage: true,
          indexedDB: true,
        });
      }
      throwIfStopped();
      await log('步骤 1：Devin cookies 与登录存储清理完成（未清理站点缓存）。', 'info', nodeId);
    }
    async function waitForCallback(tabId, state = {}) {
      const deadline = Date.now() + 5 * 60 * 1000;
      let lastProgressAt = Date.now();
      while (Date.now() < deadline) {
        throwIfStopped();
        const tabs = chrome?.tabs?.query ? await chrome.tabs.query({}).catch(() => []) : [];
        const candidates = tabs.filter((tab) => tab.id === tabId || /127\.0\.0\.1|localhost/i.test(clean(tab.url)));
        const expectedState = clean(state.devinOAuthState);
        const found = candidates.map((tab) => clean(tab.url)).find((url) => {
          if (!/^(https?:\/\/)(localhost|127\.0\.0\.1)(:\d+)?\//i.test(url) || !/[?&](code|error)=/i.test(url)) return false;
          try {
            const parsed = new URL(url);
            const callbackState = parsed.searchParams.get('state') || '';
            return Boolean(callbackState) && (!expectedState || callbackState === expectedState);
          } catch { return false; }
        });
        if (found) return found;
        if (Date.now() - lastProgressAt >= 25000) {
          lastProgressAt = Date.now();
          await log('步骤 6：等待 Devin 返回本地 OAuth 回调地址...', 'info', 'devin-submit-callback');
        }
        await sleepWithStop(1000);
      }
      const fallback = clean(state.devinOAuthCallbackUrl);
      if (fallback) return fallback;
      throw new Error('等待 Devin OAuth 回调超时；请确认授权已完成后重试本步骤。');
    }
    async function execute(state = {}) {
      const nodeId = clean(state.nodeId);
      throwIfStopped();
      const liveState = await getState();
      const current = { ...liveState, ...state };
      try {
        if (nodeId === 'devin-open-authorization') {
          await log('步骤 1：正在清理 devin.ai cookies...', 'info', nodeId);
          await clearDevinCookies(nodeId);
          const tabId = await reuseOrCreateTab(DEVIN_SOURCE_ID, DEVIN_SIGNUP_URL, {
            inject: DEVIN_REGISTER_INJECT_FILES, injectSource: DEVIN_SOURCE_ID,
          });
          if (!Number.isInteger(tabId)) throw new Error('无法打开 Devin 注册网站。');
          await registerTab(DEVIN_SOURCE_ID, tabId);
          const patch = {
            devinRegisterTabId: tabId,
            devinRegistrationCompleted: false,
            devinOAuthState: null,
            devinOAuthUrl: null,
            devinOAuthStatus: 'idle',
            devinOAuthError: null,
            devinOAuthCallbackUrl: null,
          };
          await setState(patch);
          await log('步骤 1：已打开 Devin 注册网站。', 'ok', nodeId);
          await complete(nodeId, patch);
          return;
        }
        if (nodeId === 'devin-start-cpa-oauth') {
          const registrationStepsSettled = DEVIN_REGISTRATION_NODE_IDS.every((registrationNodeId) =>
            isRegistrationStepSettled(current.nodeStatuses?.[registrationNodeId])
          );
          if (!current.devinRegistrationCompleted && !registrationStepsSettled) {
            throw new Error('请先完成或手动跳过 Devin 注册步骤，再获取 CPA 登录链接。');
          }
          if (typeof startDevinOAuth !== 'function') throw new Error('CPA Devin OAuth 能力尚未接入。');
          await log('步骤 5：Devin 注册已完成，正在向 CPA 获取登录链接...', 'info', nodeId);
          const auth = await startDevinOAuth(current);
          const url = clean(auth?.oauthUrl);
          if (!url) throw new Error('CPA 未返回 Devin 登录链接。');
          const tabId = await reuseOrCreateTab(DEVIN_SOURCE_ID, url, {
            inject: DEVIN_REGISTER_INJECT_FILES, injectSource: DEVIN_SOURCE_ID,
          });
          if (!Number.isInteger(tabId)) throw new Error('无法打开 CPA 返回的 Devin 登录链接。');
          await registerTab(DEVIN_SOURCE_ID, tabId);
          const patch = {
            devinRegisterTabId: tabId,
            devinOAuthState: auth.oauthState,
            devinOAuthUrl: url,
            devinOAuthStatus: 'wait',
            devinOAuthError: null,
          };
          await setState(patch);
          await log('步骤 5：已从 CPA 获取并打开 Devin 登录链接。', 'ok', nodeId);
          await complete(nodeId, patch);
          return;
        }
        if (nodeId === 'devin-submit-callback') {
          const tabId = Number(current.devinRegisterTabId || await getTabId(DEVIN_SOURCE_ID) || 0);
          const callbackUrl = await waitForCallback(tabId, current);
          if (typeof submitDevinOAuthCallback !== 'function') throw new Error('CPA Devin OAuth 回调能力尚未接入。');
          await submitDevinOAuthCallback(current, callbackUrl);
          await setState({ devinOAuthStatus: 'wait', devinOAuthError: null, devinOAuthCallbackUrl: callbackUrl });
          await log('步骤 6：已自动提交 Devin OAuth 回调地址。', 'ok', nodeId);
          await complete(nodeId);
          return;
        }
        const tabId = await ensureTab(current);
        if (chrome?.tabs?.update) await chrome.tabs.update(tabId, { active: true }).catch(() => {});
        await ready(tabId);
        if (nodeId === 'devin-enter-email') {
          const email = clean(await resolveSignupEmailForFlow?.({ ...current, activeFlowId: 'devin', flowId: 'devin' }));
          if (!email) throw new Error('未能从当前邮箱配置获取 Devin 注册邮箱。');
          const requestedAt = Date.now();
          const result = await command(nodeId, 'submit-email', { email });
          await setState({ email, devinEmail: email, devinVerificationRequestedAt: requestedAt, devinPageUrl: result.url || '' });
        } else if (nodeId === 'devin-enter-email-code') {
          if (typeof pollFlowVerificationCode !== 'function') throw new Error('Devin 验证码步骤缺少共享邮件轮询能力。');
          const email = clean(current.devinEmail || current.email);
          const polled = await pollFlowVerificationCode({
            actionLabel: 'Devin 邮箱验证码', filterAfterTimestamp: Number(current.devinVerificationRequestedAt) || Date.now(),
            flowId: 'devin', logStep: 3, logStepKey: nodeId, nodeId, step: 3,
            state: { ...current, activeFlowId: 'devin', flowId: 'devin', email, devinEmail: email },
            notFoundMessage: '未能获取 Devin 邮箱验证码。',
          });
          const code = clean(polled?.code).replace(/\s/g, '');
          if (!code) throw new Error('邮件中没有可用的 Devin 验证码。');
          await command(nodeId, 'submit-code', { code });
          await setState({ devinVerificationCode: code, devinVerificationMessageId: polled.messageId || polled.mailId || '' });
        } else if (nodeId === 'devin-select-free-plan') {
          await command(nodeId, 'select-free-plan');
          await setState({ devinRegistrationCompleted: true });
        } else {
          throw new Error(`未知 Devin 注册节点：${nodeId || '(empty)'}`);
        }
        await log('Devin 页面操作已完成。', 'ok', nodeId);
        await complete(nodeId);
      } catch (error) {
        const message = errorText(error);
        await log(`Devin 注册步骤失败：${message}`, 'error', nodeId);
        throw error;
      }
    }
    return { execute, clearDevinCookies, waitForCallback };
  }
  return { createDevinRegisterRunner };
});
