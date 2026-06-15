console.log('[MultiPage:claude-register-page] Content script loaded on', location.href);

const CLAUDE_REGISTER_PAGE_LISTENER_SENTINEL = 'data-multipage-claude-register-page-listener';
const CLAUDE_OFFICIAL_URL = 'https://claude.ai/';
const CLAUDE_EMAIL_ENTRY_TEXT_PATTERN = /continue\s+with\s+email|sign\s+up\s+with\s+email|log\s+in\s+with\s+email|email/i;
const CLAUDE_CONTINUE_TEXT_PATTERN = /continue|next|submit|log\s*in|sign\s*up|\u7ee7\u7eed|\u4e0b\u4e00\u6b65|\u767b\u5f55|\u6ce8\u518c/i;
const CLAUDE_SENT_LINK_TEXT_PATTERN = /check\s+your\s+email|sent\s+(?:you\s+)?(?:a\s+)?(?:link|email)|magic\s+link|verify\s+your\s+email/i;

function isVisibleClaudeElement(element) {
  if (!element || !(element instanceof Element)) return false;
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function getClaudeElementText(element) {
  if (!element) return '';
  return String(
    element.innerText
    || element.textContent
    || element.getAttribute?.('aria-label')
    || element.getAttribute?.('title')
    || element.value
    || ''
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function queryVisibleClaudeElement(selector) {
  return Array.from(document.querySelectorAll(selector)).find(isVisibleClaudeElement) || null;
}

function findClaudeClickableByText(pattern) {
  const selectors = 'button, a, [role="button"], input[type="button"], input[type="submit"]';
  return Array.from(document.querySelectorAll(selectors)).find((element) => {
    if (!isVisibleClaudeElement(element)) return false;
    return pattern.test(getClaudeElementText(element));
  }) || null;
}

function simulateClaudeClick(element) {
  throwIfStopped();
  if (!element) {
    throw new Error('Cannot click an empty Claude element.');
  }
  const rect = element.getBoundingClientRect();
  const clientX = Math.max(0, Math.floor(rect.left + Math.min(rect.width - 1, Math.max(1, rect.width / 2))));
  const clientY = Math.max(0, Math.floor(rect.top + Math.min(rect.height - 1, Math.max(1, rect.height / 2))));
  const eventOptions = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX,
    clientY,
    screenX: window.screenX + clientX,
    screenY: window.screenY + clientY,
  };
  element.dispatchEvent(new MouseEvent('mouseover', eventOptions));
  element.dispatchEvent(new MouseEvent('mousedown', eventOptions));
  element.dispatchEvent(new MouseEvent('mouseup', eventOptions));
  if (typeof element.click === 'function') {
    element.click();
    return;
  }
  element.dispatchEvent(new MouseEvent('click', eventOptions));
}

async function waitForClaude(predicate, options = {}) {
  const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 30000);
  const intervalMs = Math.max(100, Number(options.intervalMs) || 250);
  const deadline = Date.now() + timeoutMs;
  let lastValue = null;
  while (Date.now() <= deadline) {
    throwIfStopped();
    lastValue = predicate();
    if (lastValue) return lastValue;
    await sleep(intervalMs);
  }
  return lastValue;
}

function isClaudeHost(hostname = location.hostname) {
  const normalized = String(hostname || '').trim().toLowerCase();
  return normalized === 'claude.ai'
    || normalized === 'www.claude.ai'
    || normalized.endsWith('.claude.ai')
    || normalized === 'console.anthropic.com'
    || normalized.endsWith('.anthropic.com');
}

function findClaudeEmailInput() {
  return queryVisibleClaudeElement([
    'input[type="email"]',
    'input[name="email" i]',
    'input[autocomplete="email"]',
    'input[autocomplete="username"]',
    'input[placeholder*="email" i]',
    'input[inputmode="email"]',
    'input[aria-label*="email" i]',
  ].join(', '));
}

function findClaudeSubmitButton(emailInput = null) {
  const form = emailInput?.form || emailInput?.closest?.('form') || null;
  const candidates = Array.from(document.querySelectorAll('button:not([disabled]), [role="button"], input[type="submit"]:not([disabled])'))
    .filter(isVisibleClaudeElement);
  const formCandidates = form
    ? candidates.filter((element) => (element.form || element.closest?.('form') || null) === form)
    : [];
  return [...formCandidates, ...candidates].find((element) => CLAUDE_CONTINUE_TEXT_PATTERN.test(getClaudeElementText(element)))
    || formCandidates[0]
    || candidates.at(-1)
    || null;
}

function getClaudePageState() {
  const pageText = String(document.body?.innerText || '').replace(/\s+/g, ' ').trim();
  const emailInput = findClaudeEmailInput();
  if (emailInput) {
    return {
      state: 'email_entry',
      url: location.href,
      emailInput,
      continueButton: findClaudeSubmitButton(emailInput),
    };
  }
  if (CLAUDE_SENT_LINK_TEXT_PATTERN.test(pageText)) {
    return {
      state: 'login_link_sent',
      url: location.href,
    };
  }
  if (isClaudeHost() && /chat|new|recents|projects|claude/i.test(location.pathname)) {
    return {
      state: 'claude_page',
      url: location.href,
    };
  }
  return {
    state: 'loading',
    url: location.href,
  };
}

async function openClaudeOfficialPage() {
  if (!isClaudeHost()) {
    location.href = CLAUDE_OFFICIAL_URL;
    return { submitted: true, state: 'navigating', url: location.href };
  }
  const emailEntry = await waitForClaude(() => (
    findClaudeEmailInput() || findClaudeClickableByText(CLAUDE_EMAIL_ENTRY_TEXT_PATTERN)
  ), { timeoutMs: 30000, intervalMs: 300 });
  if (emailEntry && !(emailEntry instanceof HTMLInputElement) && emailEntry instanceof Element) {
    simulateClaudeClick(emailEntry);
    await sleep(500);
  }
  return {
    submitted: true,
    ...getClaudePageState(),
  };
}

async function submitClaudeEmail(payload = {}) {
  const email = String(payload.email || '').trim();
  if (!email) {
    throw new Error('Claude email is empty.');
  }
  const input = await waitForClaude(findClaudeEmailInput, { timeoutMs: 45000, intervalMs: 300 });
  if (!input) {
    throw new Error('Claude email input was not found.');
  }
  fillInput(input, email);
  await sleep(200);
  const button = findClaudeSubmitButton(input);
  if (!button) {
    throw new Error('Claude email submit button was not found.');
  }
  simulateClaudeClick(button);
  const settled = await waitForClaude(() => {
    const state = getClaudePageState();
    return state.state !== 'email_entry' && state.state !== 'loading' ? state : null;
  }, { timeoutMs: 30000, intervalMs: 500 });
  return {
    submitted: true,
    state: settled?.state || getClaudePageState().state,
    url: settled?.url || location.href,
  };
}

async function executeClaudeCommand(command, payload = {}) {
  switch (command) {
    case 'claude-open-official-page':
      return openClaudeOfficialPage(payload);
    case 'claude-submit-email':
      return submitClaudeEmail(payload);
    case 'GET_PAGE_STATE':
      return { state: getClaudePageState().state, url: location.href };
    default:
      throw new Error(`Unknown Claude register command: ${command}`);
  }
}

if (!document.documentElement.hasAttribute(CLAUDE_REGISTER_PAGE_LISTENER_SENTINEL)) {
  document.documentElement.setAttribute(CLAUDE_REGISTER_PAGE_LISTENER_SENTINEL, '1');
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'EXECUTE_NODE' && message?.type !== 'GET_PAGE_STATE') return false;
    resetStopState();
    const command = message.command || message.nodeId || message.type;
    executeClaudeCommand(command, message.payload || {})
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => {
        if (isStopError(error)) {
          sendResponse({ stopped: true, error: error.message });
          return;
        }
        sendResponse({ ok: false, error: error?.message || String(error) });
      });
    return true;
  });
}

window.__MULTIPAGE_CLAUDE_REGISTER_PAGE__ = {
  executeClaudeCommand,
  getClaudePageState,
};
