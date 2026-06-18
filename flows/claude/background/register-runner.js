(function attachBackgroundClaudeRegisterRunner(root, factory) {
  root.MultiPageBackgroundClaudeRegisterRunner = factory(root);
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundClaudeRegisterRunnerModule() {
  const CLAUDE_OFFICIAL_URL = 'https://claude.ai/';
  const CLAUDE_REGISTER_PAGE_SOURCE_ID = 'claude-register-page';
  const DEFAULT_CLAUDE_PAGE_TIMEOUT_MS = 90 * 1000;
  const DEFAULT_CLAUDE_LINK_MAX_ATTEMPTS = 12;
  const DEFAULT_CLAUDE_LINK_INTERVAL_MS = 5000;
  const CLAUDE_SMSBOWER_MAIL_SERVICE_CODE = 'acz';
  const CLAUDE_COOKIE_CLEAR_DOMAINS = Object.freeze([
    'claude.ai',
    'anthropic.com',
  ]);

  function cleanString(value = '') {
    return String(value ?? '').trim();
  }

  function getErrorMessage(error) {
    return error instanceof Error ? error.message : cleanString(error) || 'Unknown error';
  }

  function buildClaudeRuntimePatch(patch = {}) {
    return {
      runtimeState: {
        flowState: {
          claude: patch,
        },
      },
    };
  }

  function readClaudeRuntime(state = {}) {
    return state?.runtimeState?.flowState?.claude || state?.flowState?.claude || {};
  }

  function createClaudeRegisterRunner(deps = {}) {
    const {
      addLog = async () => {},
      chrome = (typeof globalThis !== 'undefined' ? globalThis.chrome : null),
      completeNodeFromBackground,
      ensureContentScriptReadyOnTab = null,
      fetchSmsBowerMailAddress = null,
      generateRandomName = null,
      getState = async () => ({}),
      getTabId = async () => null,
      isTabAlive = async () => false,
      pollSmsBowerMailLink = null,
      registerTab = async () => {},
      reuseOrCreateTab = async () => null,
      sendToContentScriptResilient = null,
      setState = async () => {},
      sleepWithStop = async (ms) => {
        await new Promise((resolve) => setTimeout(resolve, ms));
      },
      SMSBOWER_MAIL_PROVIDER = 'smsbower-mail',
      throwIfStopped = () => {},
      waitForTabStableComplete = null,
      CLAUDE_REGISTER_INJECT_FILES = null,
      markCurrentRegistrationAccountUsed = null,
    } = deps;

    if (typeof completeNodeFromBackground !== 'function') {
      throw new Error('Claude register runner requires completeNodeFromBackground.');
    }

    async function log(message, level = 'info', nodeId = '') {
      await addLog(message, level, nodeId ? { nodeId } : {});
    }

    async function activateTab(tabId) {
      if (!Number.isInteger(tabId) || !chrome?.tabs?.update) {
        return;
      }
      await chrome.tabs.update(tabId, { active: true });
    }

    async function getExecutionState(state = {}) {
      if (state && typeof state === 'object' && !Array.isArray(state) && Object.keys(state).length) {
        return state;
      }
      return getState();
    }

    async function persistState(patch = {}) {
      await setState(patch);
      return patch;
    }

    async function completeNode(nodeId, patch = {}) {
      await persistState(patch);
      await completeNodeFromBackground(nodeId, patch);
      return patch;
    }

    async function isUsableTabId(tabId) {
      if (!Number.isInteger(tabId) || tabId <= 0) {
        return false;
      }
      if (typeof isTabAlive === 'function' && await isTabAlive(CLAUDE_REGISTER_PAGE_SOURCE_ID)) {
        return true;
      }
      if (chrome?.tabs?.get) {
        const tab = await chrome.tabs.get(tabId).catch(() => null);
        return Boolean(tab?.id === tabId);
      }
      return true;
    }

    async function ensureClaudeRegisterTab(state = {}, options = {}) {
      const runtimeState = readClaudeRuntime(state);
      const existingTabId = Number(
        state?.claudeRegisterTabId
        || runtimeState?.session?.registerTabId
        || state?.tabRegistry?.[CLAUDE_REGISTER_PAGE_SOURCE_ID]?.tabId
        || 0
      );
      if (Number.isInteger(existingTabId) && existingTabId > 0 && await isUsableTabId(existingTabId)) {
        await registerTab(CLAUDE_REGISTER_PAGE_SOURCE_ID, existingTabId);
        return existingTabId;
      }

      const registeredTabId = await getTabId(CLAUDE_REGISTER_PAGE_SOURCE_ID);
      if (Number.isInteger(registeredTabId) && await isUsableTabId(registeredTabId)) {
        await registerTab(CLAUDE_REGISTER_PAGE_SOURCE_ID, registeredTabId);
        return registeredTabId;
      }

      if (!options.openIfMissing) {
        throw new Error(options.missingMessage || '\u7f3a\u5c11 Claude \u5b98\u7f51\u6807\u7b7e\u9875\uff0c\u8bf7\u5148\u6267\u884c\u6b65\u9aa4 1\u3002');
      }

      const openedTabId = await reuseOrCreateTab(CLAUDE_REGISTER_PAGE_SOURCE_ID, options.url || CLAUDE_OFFICIAL_URL, {
        inject: Array.isArray(CLAUDE_REGISTER_INJECT_FILES) ? CLAUDE_REGISTER_INJECT_FILES : null,
        injectSource: CLAUDE_REGISTER_PAGE_SOURCE_ID,
      });
      if (!Number.isInteger(openedTabId)) {
        throw new Error('\u65e0\u6cd5\u6253\u5f00 Claude \u5b98\u7f51\u3002');
      }
      await registerTab(CLAUDE_REGISTER_PAGE_SOURCE_ID, openedTabId);
      return openedTabId;
    }

    async function ensureContentReady(tabId, options = {}) {
      if (!Number.isInteger(tabId)) {
        throw new Error('\u7f3a\u5c11 Claude \u6807\u7b7e\u9875\uff0c\u65e0\u6cd5\u8fde\u63a5\u5185\u5bb9\u811a\u672c\u3002');
      }
      if (typeof waitForTabStableComplete === 'function') {
        await waitForTabStableComplete(tabId, {
          timeoutMs: options.timeoutMs || DEFAULT_CLAUDE_PAGE_TIMEOUT_MS,
          retryDelayMs: 300,
          stableMs: Number(options.stableMs) || 1200,
          initialDelayMs: Number(options.initialDelayMs) || 120,
        });
      }
      if (typeof ensureContentScriptReadyOnTab === 'function') {
        await ensureContentScriptReadyOnTab(CLAUDE_REGISTER_PAGE_SOURCE_ID, tabId, {
          inject: Array.isArray(CLAUDE_REGISTER_INJECT_FILES) ? CLAUDE_REGISTER_INJECT_FILES : null,
          injectSource: CLAUDE_REGISTER_PAGE_SOURCE_ID,
          timeoutMs: options.timeoutMs || DEFAULT_CLAUDE_PAGE_TIMEOUT_MS,
          retryDelayMs: 700,
          logMessage: options.logMessage || 'Claude \u5b98\u7f51\u4ecd\u5728\u52a0\u8f7d\uff0c\u6b63\u5728\u7b49\u5f85\u9875\u9762\u6062\u590d...',
        });
      }
    }

    async function sendClaudeCommand(nodeId, payload = {}, options = {}) {
      if (typeof sendToContentScriptResilient !== 'function') {
        throw new Error('Claude \u9875\u9762\u901a\u4fe1\u80fd\u529b\u4e0d\u53ef\u7528\u3002');
      }
      const result = await sendToContentScriptResilient(CLAUDE_REGISTER_PAGE_SOURCE_ID, {
        type: 'EXECUTE_NODE',
        nodeId,
        step: options.step || 0,
        source: 'background',
        payload,
      }, {
        timeoutMs: options.timeoutMs || 45000,
        retryDelayMs: 700,
        logMessage: options.logMessage || '',
      });
      if (result?.error) {
        throw new Error(result.error);
      }
      return result || {};
    }

    function shouldClearClaudeCookie(cookie = {}) {
      const domain = cleanString(cookie.domain).replace(/^\.+/, '').toLowerCase();
      return CLAUDE_COOKIE_CLEAR_DOMAINS.some((target) => (
        domain === target || domain.endsWith(`.${target}`)
      ));
    }

    function buildCookieRemovalUrl(cookie = {}) {
      const host = cleanString(cookie.domain).replace(/^\.+/, '').toLowerCase();
      const path = cleanString(cookie.path) || '/';
      return `https://${host}${path.startsWith('/') ? path : `/${path}`}`;
    }

    async function clearClaudeCookiesBeforeStep1() {
      const nodeId = 'claude-open-official-page';
      if (!chrome?.cookies?.getAll || !chrome.cookies?.remove) {
        await log('步骤 1：当前浏览器不支持 cookies API，跳过 Claude Cookie 清理。', 'warn', nodeId);
        return;
      }

      const stores = chrome.cookies.getAllCookieStores
        ? await chrome.cookies.getAllCookieStores()
        : [{ id: undefined }];
      let removedCount = 0;
      const seen = new Set();

      for (const store of stores) {
        const storeId = store?.id;
        const cookies = await chrome.cookies.getAll(storeId ? { storeId } : {}).catch(() => []);
        for (const cookie of cookies || []) {
          if (!shouldClearClaudeCookie(cookie)) {
            continue;
          }
          const key = [
            cookie.storeId || storeId || '',
            cookie.domain || '',
            cookie.path || '',
            cookie.name || '',
            cookie.partitionKey ? JSON.stringify(cookie.partitionKey) : '',
          ].join('|');
          if (seen.has(key)) {
            continue;
          }
          seen.add(key);
          try {
            const details = {
              url: buildCookieRemovalUrl(cookie),
              name: cookie.name,
            };
            if (cookie.storeId) {
              details.storeId = cookie.storeId;
            }
            if (cookie.partitionKey) {
              details.partitionKey = cookie.partitionKey;
            }
            const removed = await chrome.cookies.remove(details);
            if (removed) {
              removedCount += 1;
            }
          } catch (error) {
            console.warn('[MultiPage:claude-register] remove cookie failed', {
              domain: cookie?.domain,
              name: cookie?.name,
              message: getErrorMessage(error),
            });
          }
        }
      }
      await log(`步骤 1：已清理 Claude/Anthropic Cookie ${removedCount} 个。`, removedCount ? 'ok' : 'info', nodeId);
    }

    async function readClaudeSessionKeyFromChrome() {
      if (!chrome?.cookies?.get && !chrome?.cookies?.getAll) {
        return '';
      }

      if (chrome?.cookies?.get) {
        const candidates = [
          { url: 'https://claude.ai/', name: 'sessionKey' },
          { url: 'https://www.claude.ai/', name: 'sessionKey' },
        ];
        for (const details of candidates) {
          const cookie = await chrome.cookies.get(details).catch(() => null);
          const value = cleanString(cookie?.value);
          if (value) {
            return value;
          }
        }
      }

      const cookies = chrome?.cookies?.getAll
        ? await chrome.cookies.getAll({}).catch(() => [])
        : [];
      const match = (cookies || []).find((cookie) => (
        cleanString(cookie?.name) === 'sessionKey'
        && cleanString(cookie?.value)
        && shouldClearClaudeCookie(cookie)
      ));
      return cleanString(match?.value);
    }

    function resolveClaudeFullName(currentState = {}) {
      const existing = cleanString(currentState.claudeFullName || currentState.fullName || currentState.name);
      if (existing) {
        return existing;
      }
      const generated = typeof generateRandomName === 'function' ? generateRandomName() : null;
      return cleanString(generated?.fullName || generated?.name)
        || [cleanString(generated?.firstName), cleanString(generated?.lastName)].filter(Boolean).join(' ')
        || 'Alex Morgan';
    }

    async function executeClaudeContentStep(state = {}, options = {}) {
      const nodeId = cleanString(state?.nodeId) || options.nodeId;
      const currentState = await getExecutionState(state);
      try {
        const tabId = await ensureClaudeRegisterTab(currentState, { openIfMissing: false });
        await activateTab(tabId);
        await ensureContentReady(tabId);
        const result = await sendClaudeCommand(options.command || nodeId, options.payload || {}, {
          step: options.step,
          timeoutMs: options.timeoutMs || DEFAULT_CLAUDE_PAGE_TIMEOUT_MS,
          logMessage: options.logMessage || '',
        });
        const patch = {
          claudePageState: result.state || '',
          claudePageUrl: result.url || '',
          ...buildClaudeRuntimePatch({
            session: {
              pageState: result.state || '',
              pageUrl: result.url || '',
              lastError: '',
            },
            register: {
              status: options.status || result.state || 'advanced',
              ...(options.registerPatch || {}),
            },
          }),
          ...(options.patch || {}),
        };
        await log(options.successMessage || `步骤 ${options.step}：Claude 页面步骤已完成。`, 'ok', nodeId);
        await completeNode(nodeId, patch);
      } catch (error) {
        const message = getErrorMessage(error);
        await persistState(buildClaudeRuntimePatch({
          session: { lastError: message },
          register: { status: 'error' },
        }));
        await log(`步骤 ${options.step}：${message}`, 'error', nodeId);
        throw error;
      }
    }

    async function executeClaudeOpenOfficialPage(state = {}) {
      const nodeId = cleanString(state?.nodeId) || 'claude-open-official-page';
      const currentState = await getExecutionState(state);
      try {
        await clearClaudeCookiesBeforeStep1();
        const tabId = await ensureClaudeRegisterTab(currentState, { openIfMissing: true });
        await activateTab(tabId);
        if (chrome?.tabs?.update) {
          await chrome.tabs.update(tabId, { url: CLAUDE_OFFICIAL_URL, active: true });
        }
        await ensureContentReady(tabId, {
          timeoutMs: DEFAULT_CLAUDE_PAGE_TIMEOUT_MS,
          stableMs: 1800,
          initialDelayMs: 800,
          logMessage: '步骤 1：正在等待 Claude 页面加载完成...',
        });
        const result = await sendClaudeCommand('claude-wait-official-page', {}, {
          step: 1,
          timeoutMs: DEFAULT_CLAUDE_PAGE_TIMEOUT_MS,
          logMessage: '步骤 1：正在确认 Claude 注册页可用...',
        });
        await log('步骤 1：已清理 Claude Cookie、打开 Claude 并等待页面加载完成。', 'ok', nodeId);
        await completeNode(nodeId, {
          claudeRegisterTabId: tabId,
          claudePageState: result.state || 'email_entry',
          claudePageUrl: result.url || CLAUDE_OFFICIAL_URL,
          ...buildClaudeRuntimePatch({
            session: {
              registerTabId: tabId,
              startedAt: Date.now(),
              pageState: result.state || 'email_entry',
              pageUrl: result.url || CLAUDE_OFFICIAL_URL,
              lastError: '',
            },
            register: {
              status: 'official_page_ready',
            },
          }),
        });
      } catch (error) {
        const message = getErrorMessage(error);
        await persistState(buildClaudeRuntimePatch({
          session: { lastError: message },
          register: { status: 'error' },
        }));
        await log(`步骤 1：${message}`, 'error', nodeId);
        throw error;
      }
    }

    async function executeClaudeWaitOfficialPageLoaded(state = {}) {
      const nodeId = cleanString(state?.nodeId) || 'claude-wait-official-page';
      const currentState = await getExecutionState(state);
      try {
        const tabId = await ensureClaudeRegisterTab(currentState, { openIfMissing: false });
        await activateTab(tabId);
        await ensureContentReady(tabId, {
          timeoutMs: DEFAULT_CLAUDE_PAGE_TIMEOUT_MS,
          stableMs: 1800,
          initialDelayMs: 800,
          logMessage: '步骤 2：正在等待 Claude 页面加载完成...',
        });
        const result = await sendClaudeCommand(nodeId, {}, {
          step: 2,
          timeoutMs: DEFAULT_CLAUDE_PAGE_TIMEOUT_MS,
          logMessage: '步骤 2：正在确认 Claude 注册页可用...',
        });
        await log('步骤 2：Claude 页面已加载完成。', 'ok', nodeId);
        await completeNode(nodeId, {
          claudeRegisterTabId: tabId,
          claudePageState: result.state || 'email_entry',
          claudePageUrl: result.url || CLAUDE_OFFICIAL_URL,
          ...buildClaudeRuntimePatch({
            session: {
              registerTabId: tabId,
              pageState: result.state || 'email_entry',
              pageUrl: result.url || CLAUDE_OFFICIAL_URL,
              lastError: '',
            },
            register: {
              status: 'official_page_ready',
            },
          }),
        });
      } catch (error) {
        const message = getErrorMessage(error);
        await persistState(buildClaudeRuntimePatch({
          session: { lastError: message },
          register: { status: 'error' },
        }));
        await log(`步骤 2：${message}`, 'error', nodeId);
        throw error;
      }
    }

    async function executeClaudeFillEmail(state = {}) {
      const nodeId = cleanString(state?.nodeId) || 'claude-fill-email';
      const currentState = await getExecutionState(state);
      try {
        if (typeof fetchSmsBowerMailAddress !== 'function') {
          throw new Error('Claude 邮箱注册缺少 SMSBower TempMail 获取能力。');
        }
        const tabId = await ensureClaudeRegisterTab(currentState, { openIfMissing: false });
        await activateTab(tabId);
        await ensureContentReady(tabId);
        const smsBowerState = {
          ...currentState,
          mailProvider: SMSBOWER_MAIL_PROVIDER,
          smsbowerMailServiceCode: CLAUDE_SMSBOWER_MAIL_SERVICE_CODE,
        };
        const email = cleanString(await fetchSmsBowerMailAddress(smsBowerState, {
          generateNew: true,
          preserveAccountIdentity: true,
        })).toLowerCase();
        if (!email) {
          throw new Error('SMSBower TempMail 未返回可用邮箱。');
        }
        const requestedAt = Date.now();
        await persistState({
          claudeEmail: email,
          claudeLoginLinkRequestedAt: requestedAt,
          mailProvider: SMSBOWER_MAIL_PROVIDER,
          smsbowerMailServiceCode: CLAUDE_SMSBOWER_MAIL_SERVICE_CODE,
          email,
          accountIdentifierType: 'email',
          accountIdentifier: email,
          ...buildClaudeRuntimePatch({
            register: {
              email,
              loginLinkRequestedAt: requestedAt,
              status: 'email_filling',
            },
          }),
        });
        const result = await sendClaudeCommand(nodeId, { email }, {
          step: 2,
          timeoutMs: DEFAULT_CLAUDE_PAGE_TIMEOUT_MS,
          logMessage: '步骤 2：正在填写 Claude 注册邮箱...',
        });
        await log(`步骤 2：已获取 acz 服务 Claude 邮箱并填写 ${email}。`, 'ok', nodeId);
        await completeNode(nodeId, {
          claudeEmail: email,
          claudeLoginLinkRequestedAt: requestedAt,
          claudePageState: result.state || 'email_filled',
          claudePageUrl: result.url || '',
          mailProvider: SMSBOWER_MAIL_PROVIDER,
          smsbowerMailServiceCode: CLAUDE_SMSBOWER_MAIL_SERVICE_CODE,
          email,
          accountIdentifierType: 'email',
          accountIdentifier: email,
          ...buildClaudeRuntimePatch({
            session: {
              pageState: result.state || 'email_filled',
              pageUrl: result.url || '',
              lastError: '',
            },
            register: {
              email,
              loginLinkRequestedAt: requestedAt,
              status: 'email_filled',
            },
          }),
        });
      } catch (error) {
        const message = getErrorMessage(error);
        await persistState(buildClaudeRuntimePatch({
          session: { lastError: message },
          register: { status: 'error' },
        }));
        await log(`步骤 2：${message}`, 'error', nodeId);
        throw error;
      }
    }

    async function executeClaudeSubmitEmailAndFetchLink(state = {}) {
      const nodeId = cleanString(state?.nodeId) || 'claude-submit-email-and-fetch-link';
      const currentState = await getExecutionState(state);
      try {
        if (typeof pollSmsBowerMailLink !== 'function') {
          throw new Error('Claude 邮箱登录链接缺少 SMSBower TempMail 轮询能力。');
        }
        const runtimeState = readClaudeRuntime(currentState);
        const email = cleanString(currentState.claudeEmail || runtimeState.register?.email || currentState.email).toLowerCase();
        if (!email) {
          throw new Error('缺少 Claude 注册邮箱，请先执行步骤 2。');
        }
        const tabId = await ensureClaudeRegisterTab(currentState, { openIfMissing: false });
        await activateTab(tabId);
        await ensureContentReady(tabId);
        await sendClaudeCommand('claude-submit-email', { email }, {
          step: 3,
          timeoutMs: DEFAULT_CLAUDE_PAGE_TIMEOUT_MS,
          logMessage: '步骤 3：正在提交 Claude 邮箱...',
        });
        const pollResult = await pollSmsBowerMailLink(3, {
          ...currentState,
          mailProvider: SMSBOWER_MAIL_PROVIDER,
          smsbowerMailServiceCode: CLAUDE_SMSBOWER_MAIL_SERVICE_CODE,
          activeFlowId: 'claude',
          flowId: 'claude',
          visibleStep: 3,
          claudeEmail: email,
          email,
        }, {
          actionLabel: 'Claude 邮箱登录链接',
          hostFilters: ['claude.ai', 'anthropic.com'],
          intervalMs: DEFAULT_CLAUDE_LINK_INTERVAL_MS,
          maxAttempts: DEFAULT_CLAUDE_LINK_MAX_ATTEMPTS,
          targetEmail: email,
        });
        const loginLink = cleanString(pollResult?.link || pollResult?.url);
        if (!loginLink) {
          throw new Error('未能获取到 Claude 邮箱登录链接。');
        }
        await log('步骤 3：已提交邮箱并获取 Claude 邮箱登录链接。', 'ok', nodeId);
        await completeNode(nodeId, {
          claudeEmail: email,
          claudeLoginLink: loginLink,
          claudeLoginLinkMessageId: cleanString(pollResult?.messageId || pollResult?.mailId),
          ...buildClaudeRuntimePatch({
            register: {
              email,
              loginLink,
              loginLinkMessageId: cleanString(pollResult?.messageId || pollResult?.mailId),
              status: 'login_link_received',
            },
            session: {
              lastError: '',
            },
          }),
        });
      } catch (error) {
        const message = getErrorMessage(error);
        await persistState(buildClaudeRuntimePatch({
          session: { lastError: message },
          register: { status: 'error' },
        }));
        await log(`步骤 3：${message}`, 'error', nodeId);
        throw error;
      }
    }

    async function executeClaudeOpenLoginLink(state = {}) {
      const nodeId = cleanString(state?.nodeId) || 'claude-open-login-link';
      const currentState = await getExecutionState(state);
      try {
        const runtimeState = readClaudeRuntime(currentState);
        const loginLink = cleanString(currentState.claudeLoginLink || runtimeState.register?.loginLink);
        if (!loginLink) {
          throw new Error('缺少 Claude 邮箱登录链接，请先执行步骤 3。');
        }
        let parsed = null;
        try {
          parsed = new URL(loginLink);
        } catch (_error) {
          throw new Error('Claude \u767b\u5f55\u94fe\u63a5\u683c\u5f0f\u65e0\u6548\u3002');
        }
        const hostname = parsed.hostname.toLowerCase();
        if (!hostname.endsWith('claude.ai') && !hostname.endsWith('anthropic.com')) {
          throw new Error(`Claude \u767b\u5f55\u94fe\u63a5\u57df\u540d\u4e0d\u5728\u5141\u8bb8\u8303\u56f4\uff1a${hostname}`);
        }

        const tabId = await ensureClaudeRegisterTab(currentState, {
          openIfMissing: true,
          url: loginLink,
        });
        await activateTab(tabId);
        if (chrome?.tabs?.update) {
          await chrome.tabs.update(tabId, { url: loginLink, active: true });
        } else {
          await reuseOrCreateTab(CLAUDE_REGISTER_PAGE_SOURCE_ID, loginLink, {
            inject: Array.isArray(CLAUDE_REGISTER_INJECT_FILES) ? CLAUDE_REGISTER_INJECT_FILES : null,
            injectSource: CLAUDE_REGISTER_PAGE_SOURCE_ID,
          });
        }
        if (typeof waitForTabStableComplete === 'function') {
          await waitForTabStableComplete(tabId, {
            timeoutMs: DEFAULT_CLAUDE_PAGE_TIMEOUT_MS,
            retryDelayMs: 300,
            stableMs: 1500,
            initialDelayMs: 300,
          });
        } else {
          await sleepWithStop(1500);
        }
        await log('步骤 4：已打开 Claude 邮箱魔法链接。', 'ok', nodeId);
        await completeNode(nodeId, {
          claudeRegisterTabId: tabId,
          claudeLoginLink: loginLink,
          claudePageUrl: loginLink,
          ...buildClaudeRuntimePatch({
            session: {
              registerTabId: tabId,
              pageUrl: loginLink,
              pageState: 'login_link_opened',
              lastError: '',
            },
            register: {
              loginLink,
              status: 'login_link_opened',
            },
          }),
        });
      } catch (error) {
        const message = getErrorMessage(error);
        await persistState(buildClaudeRuntimePatch({
          session: { lastError: message },
          register: { status: 'error' },
        }));
        await log(`步骤 4：${message}`, 'error', nodeId);
        throw error;
      }
    }

    async function executeClaudeCreateAccount(state = {}) {
      return executeClaudeContentStep(state, {
        nodeId: 'claude-create-account',
        step: 5,
        status: 'account_created',
        successMessage: '步骤 5：已勾选同意并确认新建 Claude 账号。',
      });
    }

    async function executeClaudeSelectFreePlan(state = {}) {
      return executeClaudeContentStep(state, {
        nodeId: 'claude-select-free-plan',
        step: 6,
        status: 'free_plan_selected',
        successMessage: '步骤 6：已选择 Claude 免费账号。',
      });
    }

    async function executeClaudeSkipOnboarding(state = {}) {
      return executeClaudeContentStep(state, {
        nodeId: 'claude-skip-onboarding',
        step: 7,
        status: 'onboarding_skipped',
        successMessage: '步骤 7：已点击 Skip 跳过。',
      });
    }

    async function executeClaudeContinueOnboarding(state = {}) {
      return executeClaudeContentStep(state, {
        nodeId: 'claude-continue-onboarding',
        step: 8,
        status: 'onboarding_continued',
        successMessage: '步骤 8：已继续 Claude 引导流程。',
      });
    }

    async function executeClaudeSubmitRandomName(state = {}) {
      const nodeId = cleanString(state?.nodeId) || 'claude-submit-random-name';
      const currentState = await getExecutionState(state);
      const fullName = resolveClaudeFullName(currentState);
      return executeClaudeContentStep(state, {
        nodeId,
        step: 9,
        payload: { fullName },
        patch: {
          claudeFullName: fullName,
        },
        registerPatch: { fullName },
        status: 'name_submitted',
        successMessage: `步骤 9：已填写随机英文名 ${fullName} 并继续。`,
      });
    }

    async function executeClaudeSetUpLater(state = {}) {
      return executeClaudeContentStep(state, {
        nodeId: 'claude-set-up-later',
        step: 10,
        status: 'setup_later_selected',
        successMessage: '步骤 10：已选择 Set up later。',
      });
    }

    async function executeClaudeExtractSessionKey(state = {}) {
      const nodeId = cleanString(state?.nodeId) || 'claude-extract-session-key';
      const currentState = await getExecutionState(state);

      try {
        const tabId = await ensureClaudeRegisterTab(currentState, { openIfMissing: false });
        await activateTab(tabId);
        await sleepWithStop(2000);
        let sessionKey = await readClaudeSessionKeyFromChrome();
        if (!sessionKey) {
          await ensureContentReady(tabId);
          sessionKey = await readClaudeSessionKeyFromChrome();
        }
        if (!sessionKey) {
          throw new Error('未找到 Claude sessionKey Cookie。');
        }
        const completedAt = Date.now();
        const completionPatch = {
          claudeSessionKey: sessionKey,
          claudeSessionKeys: [sessionKey],
          claudeSessionKeyExtractedAt: completedAt,
          claudeCompletedAt: completedAt,
          claudeRegisterStatus: 'completed',
          ...buildClaudeRuntimePatch({
            register: {
              status: 'completed',
              completedAt,
            },
            session: {
              currentSessionKey: sessionKey,
              sessionKeys: [sessionKey],
              extractedAt: completedAt,
              lastError: '',
            },
          }),
        };
        if (typeof markCurrentRegistrationAccountUsed === 'function') {
          await markCurrentRegistrationAccountUsed({
            ...currentState,
            ...completionPatch,
          }, {
            logPrefix: 'Claude 注册成功',
            level: 'ok',
          });
        }
        await log('步骤 11：已获取 Claude sessionKey。', 'ok', nodeId);

        // Submit session key to Claude2API if configured
        const claude2apiUrl = String(currentState?.claude2apiUrl || '').trim();
        const claude2apiPassword = String(currentState?.claude2apiPassword || '').trim();
        if (claude2apiUrl && claude2apiPassword) {
          try {
            const normalizedUrl = claude2apiUrl.replace(/\/+$/, '');
            const loginRes = await fetch(normalizedUrl + '/admin-api/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ password: claude2apiPassword }),
              credentials: 'include',
            });
            if (!loginRes.ok) {
              await log('提示：Claude2API 登录失败，HTTP ' + loginRes.status + '，但不影响注册成功。', 'warn', nodeId);
            } else {
              const sessionRes = await fetch(normalizedUrl + '/admin-api/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_key: sessionKey }),
                credentials: 'include',
              });
              const sessionResult = await sessionRes.json().catch(() => ({}));
              if (sessionRes.ok) {
                await log('已提交 sessionKey 到 Claude2API，当前总 session 数：' + (sessionResult.session_count ?? '?'), 'ok', nodeId);
              } else {
                await log('提示：Claude2API 提交 sessionKey 失败：' + (sessionResult.error || sessionRes.status) + '，但不影响注册成功。', 'warn', nodeId);
              }
            }
          } catch (apiError) {
            await log('提示：Claude2API 调用异常：' + getErrorMessage(apiError) + '，但不影响注册成功。', 'warn', nodeId);
          }
        } else {
          await log('提示：未配置 Claude2API，跳过提交 sessionKey。', 'info', nodeId);
        }

        await completeNode(nodeId, completionPatch);
      } catch (error) {
        const message = getErrorMessage(error);
        await persistState(buildClaudeRuntimePatch({
          session: { lastError: message },
          register: { status: 'error' },
        }));
        await log(`步骤 11：${message}`, 'error', nodeId);
        throw error;
      }
    }

    return {
      executeClaudeCreateAccount,
      executeClaudeExtractSessionKey,
      executeClaudeFillEmail,
      executeClaudeOpenLoginLink,
      executeClaudeOpenOfficialPage,
      executeClaudeSelectFreePlan,
      executeClaudeSetUpLater,
      executeClaudeSkipOnboarding,
      executeClaudeSubmitEmailAndFetchLink,
      executeClaudeSubmitRandomName,
      executeClaudeContinueOnboarding,
      executeClaudeWaitOfficialPageLoaded,
    };
  }

  return {
    CLAUDE_OFFICIAL_URL,
    CLAUDE_REGISTER_PAGE_SOURCE_ID,
    CLAUDE_SMSBOWER_MAIL_SERVICE_CODE,
    DEFAULT_CLAUDE_LINK_INTERVAL_MS,
    DEFAULT_CLAUDE_LINK_MAX_ATTEMPTS,
    DEFAULT_CLAUDE_PAGE_TIMEOUT_MS,
    createClaudeRegisterRunner,
  };
});
