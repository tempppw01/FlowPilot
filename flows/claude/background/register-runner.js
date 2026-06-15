(function attachBackgroundClaudeRegisterRunner(root, factory) {
  root.MultiPageBackgroundClaudeRegisterRunner = factory(root);
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundClaudeRegisterRunnerModule() {
  const CLAUDE_OFFICIAL_URL = 'https://claude.ai/';
  const CLAUDE_REGISTER_PAGE_SOURCE_ID = 'claude-register-page';
  const DEFAULT_CLAUDE_PAGE_TIMEOUT_MS = 90 * 1000;
  const DEFAULT_CLAUDE_LINK_MAX_ATTEMPTS = 12;
  const DEFAULT_CLAUDE_LINK_INTERVAL_MS = 5000;

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

    async function executeClaudeOpenOfficialPage(state = {}) {
      const nodeId = cleanString(state?.nodeId) || 'claude-open-official-page';
      const currentState = await getExecutionState(state);
      try {
        const tabId = await ensureClaudeRegisterTab(currentState, { openIfMissing: true });
        await activateTab(tabId);
        await persistState({
          claudeRegisterTabId: tabId,
          claudePageUrl: CLAUDE_OFFICIAL_URL,
          ...buildClaudeRuntimePatch({
            session: {
              registerTabId: tabId,
              startedAt: Date.now(),
              pageUrl: CLAUDE_OFFICIAL_URL,
              lastError: '',
            },
          }),
        });
        await ensureContentReady(tabId);
        const result = await sendClaudeCommand(nodeId, {}, {
          step: 1,
          timeoutMs: DEFAULT_CLAUDE_PAGE_TIMEOUT_MS,
          logMessage: '\u6b65\u9aa4 1\uff1a\u6b63\u5728\u6253\u5f00 Claude \u5b98\u7f51...',
        });
        await log('\u6b65\u9aa4 1\uff1a\u5df2\u6253\u5f00 Claude \u5b98\u7f51\u3002', 'ok', nodeId);
        await completeNode(nodeId, {
          claudeRegisterTabId: tabId,
          claudePageState: result.state || 'claude_page',
          claudePageUrl: result.url || CLAUDE_OFFICIAL_URL,
          ...buildClaudeRuntimePatch({
            session: {
              registerTabId: tabId,
              startedAt: Date.now(),
              pageState: result.state || 'claude_page',
              pageUrl: result.url || CLAUDE_OFFICIAL_URL,
              lastError: '',
            },
            register: {
              status: 'official_page_opened',
            },
          }),
        });
      } catch (error) {
        const message = getErrorMessage(error);
        await persistState(buildClaudeRuntimePatch({
          session: { lastError: message },
          register: { status: 'error' },
        }));
        await log(`\u6b65\u9aa4 1\uff1a${message}`, 'error', nodeId);
        throw error;
      }
    }

    async function executeClaudeSubmitEmail(state = {}) {
      const nodeId = cleanString(state?.nodeId) || 'claude-submit-email';
      const currentState = await getExecutionState(state);
      try {
        if (typeof fetchSmsBowerMailAddress !== 'function') {
          throw new Error('Claude \u90ae\u7bb1\u6ce8\u518c\u7f3a\u5c11 SMSBower TempMail \u83b7\u53d6\u80fd\u529b\u3002');
        }
        const tabId = await ensureClaudeRegisterTab(currentState, { openIfMissing: false });
        await activateTab(tabId);
        await ensureContentReady(tabId);
        const smsBowerState = {
          ...currentState,
          mailProvider: SMSBOWER_MAIL_PROVIDER,
        };
        const email = cleanString(await fetchSmsBowerMailAddress(smsBowerState, {
          generateNew: true,
          preserveAccountIdentity: true,
        })).toLowerCase();
        if (!email) {
          throw new Error('SMSBower TempMail \u672a\u8fd4\u56de\u53ef\u7528\u90ae\u7bb1\u3002');
        }
        const requestedAt = Date.now();
        await persistState({
          claudeEmail: email,
          claudeLoginLinkRequestedAt: requestedAt,
          mailProvider: SMSBOWER_MAIL_PROVIDER,
          email,
          accountIdentifierType: 'email',
          accountIdentifier: email,
          ...buildClaudeRuntimePatch({
            register: {
              email,
              loginLinkRequestedAt: requestedAt,
              status: 'email_submitting',
            },
          }),
        });
        const result = await sendClaudeCommand(nodeId, { email }, {
          step: 2,
          timeoutMs: DEFAULT_CLAUDE_PAGE_TIMEOUT_MS,
          logMessage: '\u6b65\u9aa4 2\uff1a\u6b63\u5728\u586b\u5199 Claude \u6ce8\u518c\u90ae\u7bb1...',
        });
        await log(`\u6b65\u9aa4 2\uff1a\u5df2\u63d0\u4ea4 Claude \u90ae\u7bb1 ${email}\u3002`, 'ok', nodeId);
        await completeNode(nodeId, {
          claudeEmail: email,
          claudeLoginLinkRequestedAt: requestedAt,
          claudePageState: result.state || '',
          claudePageUrl: result.url || '',
          mailProvider: SMSBOWER_MAIL_PROVIDER,
          email,
          accountIdentifierType: 'email',
          accountIdentifier: email,
          ...buildClaudeRuntimePatch({
            session: {
              pageState: result.state || '',
              pageUrl: result.url || '',
              lastError: '',
            },
            register: {
              email,
              loginLinkRequestedAt: requestedAt,
              status: 'login_link_requested',
            },
          }),
        });
      } catch (error) {
        const message = getErrorMessage(error);
        await persistState(buildClaudeRuntimePatch({
          session: { lastError: message },
          register: { status: 'error' },
        }));
        await log(`\u6b65\u9aa4 2\uff1a${message}`, 'error', nodeId);
        throw error;
      }
    }

    async function executeClaudeFetchLoginLink(state = {}) {
      const nodeId = cleanString(state?.nodeId) || 'claude-fetch-login-link';
      const currentState = await getExecutionState(state);
      try {
        if (typeof pollSmsBowerMailLink !== 'function') {
          throw new Error('Claude \u90ae\u7bb1\u767b\u5f55\u94fe\u63a5\u7f3a\u5c11 SMSBower TempMail \u8f6e\u8be2\u80fd\u529b\u3002');
        }
        const runtimeState = readClaudeRuntime(currentState);
        const email = cleanString(currentState.claudeEmail || runtimeState.register?.email || currentState.email).toLowerCase();
        if (!email) {
          throw new Error('\u7f3a\u5c11 Claude \u6ce8\u518c\u90ae\u7bb1\uff0c\u8bf7\u5148\u6267\u884c\u6b65\u9aa4 2\u3002');
        }
        const pollResult = await pollSmsBowerMailLink(3, {
          ...currentState,
          mailProvider: SMSBOWER_MAIL_PROVIDER,
          activeFlowId: 'claude',
          flowId: 'claude',
          visibleStep: 3,
          claudeEmail: email,
          email,
        }, {
          actionLabel: 'Claude \u90ae\u7bb1\u767b\u5f55\u94fe\u63a5',
          hostFilters: ['claude.ai', 'anthropic.com'],
          intervalMs: DEFAULT_CLAUDE_LINK_INTERVAL_MS,
          maxAttempts: DEFAULT_CLAUDE_LINK_MAX_ATTEMPTS,
          targetEmail: email,
        });
        const loginLink = cleanString(pollResult?.link || pollResult?.url);
        if (!loginLink) {
          throw new Error('\u672a\u80fd\u83b7\u53d6\u5230 Claude \u90ae\u7bb1\u767b\u5f55\u94fe\u63a5\u3002');
        }
        await log('\u6b65\u9aa4 3\uff1a\u5df2\u83b7\u53d6 Claude \u90ae\u7bb1\u767b\u5f55\u94fe\u63a5\u3002', 'ok', nodeId);
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
        await log(`\u6b65\u9aa4 3\uff1a${message}`, 'error', nodeId);
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
          throw new Error('\u7f3a\u5c11 Claude \u90ae\u7bb1\u767b\u5f55\u94fe\u63a5\uff0c\u8bf7\u5148\u6267\u884c\u6b65\u9aa4 3\u3002');
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
        await log('\u6b65\u9aa4 4\uff1a\u5df2\u6253\u5f00 Claude \u90ae\u7bb1\u767b\u5f55\u94fe\u63a5\u3002', 'ok', nodeId);
        await completeNode(nodeId, {
          claudeRegisterTabId: tabId,
          claudeLoginLink: loginLink,
          claudePageUrl: loginLink,
          claudeCompletedAt: Date.now(),
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
              completedAt: Date.now(),
            },
          }),
        });
      } catch (error) {
        const message = getErrorMessage(error);
        await persistState(buildClaudeRuntimePatch({
          session: { lastError: message },
          register: { status: 'error' },
        }));
        await log(`\u6b65\u9aa4 4\uff1a${message}`, 'error', nodeId);
        throw error;
      }
    }

    return {
      executeClaudeFetchLoginLink,
      executeClaudeOpenLoginLink,
      executeClaudeOpenOfficialPage,
      executeClaudeSubmitEmail,
    };
  }

  return {
    CLAUDE_OFFICIAL_URL,
    CLAUDE_REGISTER_PAGE_SOURCE_ID,
    DEFAULT_CLAUDE_LINK_INTERVAL_MS,
    DEFAULT_CLAUDE_LINK_MAX_ATTEMPTS,
    DEFAULT_CLAUDE_PAGE_TIMEOUT_MS,
    createClaudeRegisterRunner,
  };
});
