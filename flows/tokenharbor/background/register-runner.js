(function attachBackgroundTokenHarborRegisterRunner(root, factory) {
  root.MultiPageBackgroundTokenHarborRegisterRunner = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundTokenHarborRegisterRunnerModule() {
  const SOURCE_ID = 'tokenharbor-register-page';
  const SIGNUP_URL = 'https://tokenharbor.ai/login?mode=signup';
  const INJECT_FILES = ['flows/openai/index.js', 'flows/kiro/index.js', 'flows/grok/index.js', 'flows/claude/index.js', 'flows/devin/index.js', 'flows/tokenharbor/index.js', 'flows/index.js', 'core/flow-kernel/flow-registry.js', 'core/flow-kernel/source-registry.js', 'flows/tokenharbor/content/register-page.js'];
  const LINK_MAX_ATTEMPTS = 30;
  const LINK_INTERVAL_MS = 5000;
  const TOKENHARBOR_COOKIE_DOMAIN = 'tokenharbor.ai';
  const TOKENHARBOR_COOKIE_URLS = Object.freeze([
    'https://tokenharbor.ai/',
    'https://www.tokenharbor.ai/',
  ]);
  function clean(value) { return String(value ?? '').trim(); }
  function errorText(error) { return error instanceof Error ? error.message : clean(error) || 'Unknown error'; }
  function createTokenHarborRegisterRunner(deps = {}) {
    const { addLog = async () => {}, chrome = globalThis.chrome, completeNodeFromBackground, ensureContentScriptReadyOnTab = null, fetchGeneratedEmail = null, generatePassword = null, getState = async () => ({}), getTabId = async () => null, isTabAlive = async () => false, markCurrentRegistrationAccountUsed = null, pollSmsBowerMailLink = null, registerTab = async () => {}, resolveSignupEmailForFlow = null, reuseOrCreateTab = async () => null, sendToContentScriptResilient = null, setState = async () => {}, sleepWithStop = async (ms) => new Promise((resolve) => setTimeout(resolve, ms)), throwIfStopped = () => {}, waitForTabStableComplete = null, setPasswordState = async () => {}, SMSBOWER_MAIL_PROVIDER = 'smsbower-mail', SMSBOWER_MAIL_SERVICE_CODE = 'acz', TOKENHARBOR_REGISTER_INJECT_FILES = INJECT_FILES } = deps;
    async function log(message, level = 'info', nodeId = '') { await addLog(message, level, nodeId ? { nodeId } : {}); }
    async function complete(nodeId, patch = {}) { await setState(patch); await completeNodeFromBackground(nodeId, patch); }
    async function getTab(state = {}, openIfMissing = false) {
      let tabId = Number(state.tokenHarborRegisterTabId || state.tabRegistry?.[SOURCE_ID]?.tabId || 0);
      if (tabId > 0 && chrome?.tabs?.get && (await chrome.tabs.get(tabId).catch(() => null))?.id !== tabId) tabId = 0;
      if (!tabId) tabId = Number(await getTabId(SOURCE_ID) || 0);
      if (tabId > 0) return tabId;
      if (!openIfMissing) throw new Error('找不到 Token Harbor 注册标签页，请重新执行步骤 1。');
      tabId = await reuseOrCreateTab(SOURCE_ID, SIGNUP_URL, { inject: TOKENHARBOR_REGISTER_INJECT_FILES, injectSource: SOURCE_ID });
      if (!Number.isInteger(tabId)) throw new Error('无法打开 Token Harbor 注册页。');
      await registerTab(SOURCE_ID, tabId); return tabId;
    }
    async function ready(tabId) {
      if (typeof waitForTabStableComplete === 'function') await waitForTabStableComplete(tabId, { timeoutMs: 90000, retryDelayMs: 350, stableMs: 800 });
      if (typeof ensureContentScriptReadyOnTab === 'function') await ensureContentScriptReadyOnTab(SOURCE_ID, tabId, { inject: INJECT_FILES, injectSource: SOURCE_ID, timeoutMs: 30000, retryDelayMs: 500 });
    }
    async function command(nodeId, action, payload = {}) {
      if (typeof sendToContentScriptResilient !== 'function') throw new Error('Token Harbor 页面通信能力不可用。');
      const result = await sendToContentScriptResilient(SOURCE_ID, { type: 'TOKENHARBOR_EXECUTE_NODE', nodeId, action, payload, source: 'background' }, { timeoutMs: 45000, retryDelayMs: 700 });
      if (result?.error) throw new Error(result.error);
      if (result?.needsHuman) throw new Error('Token Harbor 页面要求完成人机验证，请在注册页完成验证后重试当前步骤。');
      return result || {};
    }
    async function clearTokenHarborCookies(nodeId) {
      const cookies = chrome?.cookies;
      if (cookies?.getAll && cookies?.remove) {
        const stores = cookies.getAllCookieStores ? await cookies.getAllCookieStores().catch(() => []) : [];
        const storeIds = stores.length ? stores.map((store) => store.id).filter(Boolean) : [null];
        const queries = storeIds.flatMap((storeId) => TOKENHARBOR_COOKIE_URLS.map((url) => ({ ...(storeId ? { storeId } : {}), url })));
        const lists = await Promise.all(queries.map((query) => cookies.getAll(query).catch(() => [])));
        const unique = new Map();
        for (const cookie of lists.flat()) {
          const domain = clean(cookie.domain).replace(/^\.+/, '').toLowerCase();
          if (domain !== TOKENHARBOR_COOKIE_DOMAIN && !domain.endsWith(`.${TOKENHARBOR_COOKIE_DOMAIN}`)) continue;
          const key = `${cookie.storeId || ''}|${domain}|${cookie.path}|${cookie.name}|${JSON.stringify(cookie.partitionKey || {})}`;
          if (!unique.has(key)) unique.set(key, { ...cookie, normalizedDomain: domain });
        }
        const targets = [...unique.values()];
        await log(`步骤 1：找到 ${targets.length} 个 Token Harbor cookies，正在清理...`, 'info', nodeId);
        const results = await Promise.allSettled(targets.map((cookie) => {
          const details = { url: `https://${cookie.normalizedDomain}${cookie.path || '/'}`, name: cookie.name };
          if (cookie.storeId) details.storeId = cookie.storeId;
          else if (stores.length) details.storeId = stores[0].id;
          if (cookie.partitionKey) details.partitionKey = cookie.partitionKey;
          return cookies.remove(details);
        }));
        const rejected = results.filter((result) => result.status === 'rejected').length;
        const remainingLists = await Promise.all(queries.map((query) => cookies.getAll(query).catch(() => [])));
        const remaining = remainingLists.flat().filter((cookie) => {
          const domain = clean(cookie.domain).replace(/^\.+/, '').toLowerCase();
          return domain === TOKENHARBOR_COOKIE_DOMAIN || domain.endsWith(`.${TOKENHARBOR_COOKIE_DOMAIN}`);
        });
        if (remaining.length) throw new Error(`仍有 ${remaining.length} 个 Token Harbor cookies 未能删除${rejected ? `（${rejected} 个删除请求失败）` : ''}，已停止打开注册页面。`);
        await log(`步骤 1：Token Harbor cookies 清理完成（共处理 ${targets.length} 个）。`, 'info', nodeId);
        return;
      }
      if (chrome?.browsingData?.remove) {
        await chrome.browsingData.remove({ origins: ['https://tokenharbor.ai', 'https://www.tokenharbor.ai'] }, { cookies: true });
      }
    }
    async function execute(state = {}) {
      const nodeId = clean(state.nodeId); throwIfStopped();
      const current = { ...(await getState()), ...state };
      try {
        if (nodeId === 'tokenharbor-open-signup') {
          current.mailProvider = SMSBOWER_MAIL_PROVIDER; current.smsbowerMailServiceCode = SMSBOWER_MAIL_SERVICE_CODE;
          await clearTokenHarborCookies(nodeId);
          const tabId = await reuseOrCreateTab(SOURCE_ID, SIGNUP_URL, { inject: TOKENHARBOR_REGISTER_INJECT_FILES, injectSource: SOURCE_ID });
          if (!Number.isInteger(tabId)) throw new Error('无法打开 Token Harbor 注册页。');
          await registerTab(SOURCE_ID, tabId);
          const patch = { tokenHarborRegisterTabId: tabId, tokenHarborEmail: null, tokenHarborVerificationLink: null, tokenHarborRegistrationStatus: 'started' };
          await log('步骤 1：已打开 Token Harbor 注册页。', 'ok', nodeId); await complete(nodeId, patch); return;
        }
        if (nodeId === 'tokenharbor-submit-signup') {
          const tabId = await getTab(current); if (chrome?.tabs?.update) await chrome.tabs.update(tabId, { active: true }).catch(() => {}); await ready(tabId);
          if (typeof fetchGeneratedEmail !== 'function') throw new Error('Token Harbor 注册缺少共享邮箱生成能力。');
          const configuredEmail = clean(current.email).toLowerCase();
          const emailState = { ...current, mailProvider: SMSBOWER_MAIL_PROVIDER, smsbowerMailServiceCode: SMSBOWER_MAIL_SERVICE_CODE };
          const email = clean(await fetchGeneratedEmail(emailState, { generateNew: !configuredEmail, preserveAccountIdentity: true, mailProvider: SMSBOWER_MAIL_PROVIDER, generator: SMSBOWER_MAIL_PROVIDER, smsbowerMailServiceCode: SMSBOWER_MAIL_SERVICE_CODE })).toLowerCase();
          if (!email) throw new Error('未能从邮箱配置获取 Token Harbor 注册邮箱。');
          let password = clean(current.password || current.customPassword);
          if (password.length < 12 || new TextEncoder().encode(password).length > 72) password = clean(typeof generatePassword === 'function' ? generatePassword() : '');
          if (!password || password.length < 12 || new TextEncoder().encode(password).length > 72) throw new Error('无法生成符合 Token Harbor 要求的密码（至少 12 个字符且不超过 72 字节）。');
          await setState({ mailProvider: SMSBOWER_MAIL_PROVIDER, smsbowerMailServiceCode: SMSBOWER_MAIL_SERVICE_CODE, email, accountIdentifierType: 'email', accountIdentifier: email });
          const result = await command(nodeId, 'submit-signup', { email, password }); const requestedAt = Date.now(); await setPasswordState(password);
          await setState({ mailProvider: SMSBOWER_MAIL_PROVIDER, smsbowerMailServiceCode: SMSBOWER_MAIL_SERVICE_CODE, email, accountIdentifierType: 'email', accountIdentifier: email });
          const patch = { email, tokenHarborEmail: email, mailProvider: SMSBOWER_MAIL_PROVIDER, smsbowerMailServiceCode: SMSBOWER_MAIL_SERVICE_CODE, accountIdentifierType: 'email', accountIdentifier: email, tokenHarborVerificationRequestedAt: requestedAt, tokenHarborRegistrationStatus: 'verification_pending', tokenHarborPageUrl: result.url || '' };
          await log(`步骤 2：已提交 Token Harbor 注册信息（${email}），邀请码留空。`, 'ok', nodeId); await complete(nodeId, patch); return;
        }
        if (nodeId === 'tokenharbor-fetch-verification-link') {
          if (typeof pollSmsBowerMailLink !== 'function') throw new Error('Token Harbor 邮箱链接验证需要 SMSBower TempMail 能力。');
          const email = clean(current.tokenHarborEmail || current.email).toLowerCase(); if (!email) throw new Error('缺少 Token Harbor 注册邮箱，请先执行步骤 2。');
          if (!current.currentSmsBowerMailActivation?.id) throw new Error('未找到 SMSBower TempMail 邮箱激活记录；请重新执行步骤 2。');
          const polled = await pollSmsBowerMailLink(3, { ...current, mailProvider: SMSBOWER_MAIL_PROVIDER, activeFlowId: 'tokenharbor', flowId: 'tokenharbor', email, tokenHarborEmail: email }, { actionLabel: 'Token Harbor 邮箱验证链接', hostFilters: ['tokenharbor.ai'], targetEmail: email, intervalMs: LINK_INTERVAL_MS, maxAttempts: LINK_MAX_ATTEMPTS });
          const link = clean(polled?.link || polled?.url); if (!link) throw new Error('未能从邮件中获取 Token Harbor 验证链接。');
          const parsed = new URL(link); if (parsed.protocol !== 'https:' || !['tokenharbor.ai', 'www.tokenharbor.ai'].includes(parsed.hostname) || !/^\/verify-email\/?$/.test(parsed.pathname)) throw new Error('邮件中的链接不是受信任的 Token Harbor 邮箱验证链接。');
          const patch = { tokenHarborVerificationLink: link, tokenHarborVerificationMessageId: clean(polled?.messageId || polled?.mailId), tokenHarborRegistrationStatus: 'verification_link_received' };
          await log('步骤 3：已获取 Token Harbor 邮箱验证链接。', 'ok', nodeId); await complete(nodeId, patch); return;
        }
        if (nodeId === 'tokenharbor-open-verification-link') {
          const link = clean(current.tokenHarborVerificationLink); if (!link) throw new Error('缺少 Token Harbor 验证链接，请先执行步骤 3。');
          const parsed = new URL(link); if (parsed.protocol !== 'https:' || !['tokenharbor.ai', 'www.tokenharbor.ai'].includes(parsed.hostname) || !/^\/verify-email\/?$/.test(parsed.pathname)) throw new Error('Token Harbor 验证链接无效或不受信任。');
          const tabId = await getTab(current, true); await registerTab(SOURCE_ID, tabId);
          if (chrome?.tabs?.update) await chrome.tabs.update(tabId, { url: link, active: true }); else await reuseOrCreateTab(SOURCE_ID, link, { inject: TOKENHARBOR_REGISTER_INJECT_FILES, injectSource: SOURCE_ID });
          if (typeof waitForTabStableComplete === 'function') await waitForTabStableComplete(tabId, { timeoutMs: 90000, retryDelayMs: 350, stableMs: 800 }); await sleepWithStop(1500);
          const verifiedTab = chrome?.tabs?.get ? await chrome.tabs.get(tabId).catch(() => null) : null;
          const resultUrl = clean(verifiedTab?.url);
          let verificationSucceeded = false;
          try {
            const result = new URL(resultUrl);
            verificationSucceeded = ['tokenharbor.ai', 'www.tokenharbor.ai'].includes(result.hostname)
              && result.pathname.replace(/\/$/, '') === '/dashboard'
              && result.searchParams.get('verify') === 'success';
          } catch {}
          if (!verificationSucceeded) throw new Error(`尚未确认邮箱验证成功（当前页面：${resultUrl || '未知'}）；请检查验证结果后重试。`);
          const patch = { tokenHarborRegistrationStatus: 'verified', tokenHarborVerifiedAt: Date.now() };
          if (typeof markCurrentRegistrationAccountUsed === 'function') await markCurrentRegistrationAccountUsed({ ...current, ...patch }, { logPrefix: 'Token Harbor 注册成功', level: 'ok' });
          await log('步骤 4：已打开 Token Harbor 验证链接。', 'ok', nodeId); await complete(nodeId, patch); return;
        }
        throw new Error(`未知 Token Harbor 注册节点：${nodeId || '(empty)'}`);
      } catch (error) { await log(`Token Harbor 注册步骤失败：${errorText(error)}`, 'error', nodeId); throw error; }
    }
    return { execute };
  }
  return { createTokenHarborRegisterRunner, SIGNUP_URL };
});
