console.log('[MultiPage:claude-register-page] Content script loaded on', location.href);

const CLAUDE_REGISTER_PAGE_LISTENER_SENTINEL = 'data-multipage-claude-register-page-listener';
const CLAUDE_OFFICIAL_URL = 'https://claude.ai/';
const CLAUDE_EMAIL_ENTRY_TEXT_PATTERN = /continue\s+with\s+email|sign\s+up\s+with\s+email|log\s+in\s+with\s+email|email/i;
const CLAUDE_CONTINUE_TEXT_PATTERN = /continue|next|submit|log\s*in|sign\s*up|\u7ee7\u7eed|\u4e0b\u4e00\u6b65|\u767b\u5f55|\u6ce8\u518c/i;
const CLAUDE_SENT_LINK_TEXT_PATTERN = /check\s+your\s+email|sent\s+(?:you\s+)?(?:a\s+)?(?:link|email)|magic\s+link|verify\s+your\s+email/i;
const CLAUDE_CREATE_ACCOUNT_TEXT_PATTERN = /create\s+account/i;
const CLAUDE_FREE_PLAN_TEXT_PATTERN = /use\s+claude\s+for\s+free|free\s+plan|get\s+started\s+for\s+free/i;
const CLAUDE_SKIP_TEXT_PATTERN = /\bskip\b|skip\s+for\s+now|not\s+now|do\s+this\s+later/i;
const CLAUDE_SETUP_LATER_TEXT_PATTERN = /set\s+up\s+later|setup\s+later|do\s+this\s+later|not\s+now/i;
const CLAUDE_FIRST_CHAT_TEXT_PATTERN = /before\s+your\s+first\s+chat|help\s+improve\s+our\s+ai\s+models|ad-free\s+chats|built\s+to\s+help/i;
const CLAUDE_NAME_ENTRY_TEXT_PATTERN = /what\s+should\s+we\s+call\s+you|your\s+name|enter\s+your\s+name/i;

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

function findClaudeVisibleTextInput() {
  return Array.from(document.querySelectorAll([
    'input:not([type])',
    'input[type="text"]',
    'input[name*="name" i]',
    'input[autocomplete*="name" i]',
    'input[placeholder*="name" i]',
    'input[aria-label*="name" i]',
    'textarea',
  ].join(', '))).find((element) => {
    if (!isVisibleClaudeElement(element)) return false;
    const type = String(element.getAttribute('type') || '').trim().toLowerCase();
    return !['hidden', 'email', 'password', 'checkbox', 'radio', 'submit', 'button'].includes(type);
  }) || null;
}

function findClaudeNameInput() {
  return Array.from(document.querySelectorAll([
    'input:not([type])',
    'input[type="text"]',
    'input[name*="name" i]',
    'input[autocomplete*="name" i]',
    'input[placeholder*="name" i]',
    'input[aria-label*="name" i]',
    'textarea[name*="name" i]',
    'textarea[placeholder*="name" i]',
    'textarea[aria-label*="name" i]',
  ].join(', '))).find((element) => {
    if (!isVisibleClaudeElement(element)) return false;
    const type = String(element.getAttribute('type') || '').trim().toLowerCase();
    if (['hidden', 'email', 'password', 'checkbox', 'radio', 'submit', 'button'].includes(type)) {
      return false;
    }
    const hints = [
      element.getAttribute?.('name'),
      element.getAttribute?.('autocomplete'),
      element.getAttribute?.('placeholder'),
      element.getAttribute?.('aria-label'),
    ].join(' ');
    return /name/i.test(hints);
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

function findClaudeTermsCheckbox() {
  const visibleCheckbox = Array.from(document.querySelectorAll('input[type="checkbox"], [role="checkbox"]'))
    .find(isVisibleClaudeElement);
  if (visibleCheckbox) return visibleCheckbox;

  const labels = Array.from(document.querySelectorAll('label, [role="checkbox"], button, div, span'))
    .filter(isVisibleClaudeElement);
  return labels.find((element) => /agree|terms|acceptable\s+use|at\s+least\s+18/i.test(getClaudeElementText(element))) || null;
}

function buildClaudeAlreadyAdvancedResult(state = null) {
  const snapshot = state || getClaudePageState();
  return {
    submitted: false,
    alreadyAdvanced: true,
    ...snapshot,
  };
}

function isClaudePastCreateAccountState(state = '') {
  return [
    'plan_selection',
    'first_chat_intro',
    'onboarding',
    'name_entry',
    'setup_later',
    'claude_page',
  ].includes(String(state || '').trim());
}

function isClaudePastPlanSelectionState(state = '') {
  return [
    'first_chat_intro',
    'onboarding',
    'name_entry',
    'setup_later',
    'claude_page',
  ].includes(String(state || '').trim());
}

async function clickClaudeByText(pattern, description, options = {}) {
  const element = await waitForClaude(() => findClaudeClickableByText(pattern), {
    timeoutMs: options.timeoutMs || 45000,
    intervalMs: options.intervalMs || 300,
  });
  if (!element) {
    throw new Error(`${description} button was not found.`);
  }
  simulateClaudeClick(element);
  await sleep(Number(options.afterClickMs) || 1200);
  return {
    submitted: true,
    ...getClaudePageState(),
  };
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
  if (/let'?s\s+create\s+your\s+account|create\s+account|acceptable\s+use\s+policy/i.test(pageText)) {
    return {
      state: 'create_account',
      url: location.href,
    };
  }
  if (/plans\s+that\s+grow\s+with\s+you|use\s+claude\s+for\s+free|get\s+pro\s+plan|get\s+max\s+plan/i.test(pageText)) {
    return {
      state: 'plan_selection',
      url: location.href,
    };
  }
  if (isClaudeHost() && /chat|new|recents|projects|claude/i.test(location.pathname)) {
    return {
      state: 'claude_page',
      url: location.href,
    };
  }
  if (CLAUDE_NAME_ENTRY_TEXT_PATTERN.test(pageText) || findClaudeNameInput()) {
    return {
      state: 'name_entry',
      url: location.href,
    };
  }
  if (CLAUDE_SETUP_LATER_TEXT_PATTERN.test(pageText)) {
    return {
      state: 'setup_later',
      url: location.href,
    };
  }
  if (CLAUDE_FIRST_CHAT_TEXT_PATTERN.test(pageText)) {
    return {
      state: 'first_chat_intro',
      url: location.href,
    };
  }
  if (/set\s+up\s+later|skip|continue|what\s+should\s+we\s+call\s+you|your\s+name/i.test(pageText)) {
    return {
      state: 'onboarding',
      url: location.href,
    };
  }
  if (CLAUDE_SENT_LINK_TEXT_PATTERN.test(pageText)) {
    return {
      state: 'login_link_sent',
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

async function waitClaudeOfficialPageLoaded() {
  const readyState = await waitForClaude(() => {
    const state = getClaudePageState();
    if (state.state !== 'loading') return state;
    return findClaudeEmailInput() || findClaudeClickableByText(CLAUDE_EMAIL_ENTRY_TEXT_PATTERN) ? state : null;
  }, { timeoutMs: 90000, intervalMs: 500 });
  if (!readyState) {
    throw new Error('Claude page did not finish loading into a usable state.');
  }
  return {
    submitted: true,
    state: readyState.state || getClaudePageState().state,
    url: readyState.url || location.href,
  };
}

async function fillClaudeEmail(payload = {}) {
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
  return {
    submitted: true,
    state: 'email_filled',
    url: location.href,
    email,
  };
}

async function submitClaudeEmail(payload = {}) {
  const email = String(payload.email || '').trim();
  const input = findClaudeEmailInput();
  if (email && input && String(input.value || '').trim().toLowerCase() !== email.toLowerCase()) {
    fillInput(input, email);
    await sleep(200);
  }
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

async function createClaudeAccount() {
  const currentState = getClaudePageState();
  if (isClaudePastCreateAccountState(currentState.state)) {
    return buildClaudeAlreadyAdvancedResult(currentState);
  }
  const checkbox = await waitForClaude(findClaudeTermsCheckbox, { timeoutMs: 45000, intervalMs: 300 });
  if (!checkbox) {
    throw new Error('Claude account terms checkbox was not found.');
  }
  const checked = checkbox.matches?.('input[type="checkbox"]') ? checkbox.checked : checkbox.getAttribute?.('aria-checked') === 'true';
  if (!checked) {
    simulateClaudeClick(checkbox);
    await sleep(300);
  }
  const button = await waitForClaude(() => findClaudeClickableByText(CLAUDE_CREATE_ACCOUNT_TEXT_PATTERN), {
    timeoutMs: 45000,
    intervalMs: 300,
  });
  if (!button) {
    throw new Error('Claude create account button was not found.');
  }

  setTimeout(() => {
    try {
      simulateClaudeClick(button);
    } catch (error) {
      console.warn('[MultiPage:claude-register-page] delayed create account click failed', error);
    }
  }, 50);

  return {
    submitted: true,
    navigationScheduled: true,
    state: 'create_account_submitted',
    url: location.href,
  };
}

async function selectClaudeFreePlan() {
  const decision = await waitForClaude(() => {
    const state = getClaudePageState();
    if (isClaudePastPlanSelectionState(state.state)) {
      return { action: 'already_advanced', state };
    }
    const button = findClaudeClickableByText(CLAUDE_FREE_PLAN_TEXT_PATTERN);
    if (button) {
      return { action: 'click', button };
    }
    return null;
  }, { timeoutMs: 45000, intervalMs: 300 });

  if (!decision) {
    throw new Error('Claude free plan button was not found.');
  }
  if (decision.action === 'already_advanced') {
    return buildClaudeAlreadyAdvancedResult(decision.state);
  }
  simulateClaudeClick(decision.button);
  await sleep(2000);
  return {
    submitted: true,
    ...getClaudePageState(),
  };
}

async function skipClaudeOnboarding() {
  const decision = await waitForClaude(() => {
    const skipButton = findClaudeClickableByText(CLAUDE_SKIP_TEXT_PATTERN);
    if (skipButton) {
      return { action: 'click', button: skipButton };
    }
    const state = getClaudePageState();
    if ([
      'first_chat_intro',
      'name_entry',
      'setup_later',
      'claude_page',
    ].includes(state.state)) {
      return { action: 'already_advanced', state };
    }
    if (state.state === 'onboarding' && findClaudeClickableByText(CLAUDE_CONTINUE_TEXT_PATTERN)) {
      return { action: 'already_advanced', state };
    }
    return null;
  }, { timeoutMs: 45000, intervalMs: 300 });

  if (!decision) {
    throw new Error('Claude skip button was not found.');
  }
  if (decision.action === 'already_advanced') {
    return buildClaudeAlreadyAdvancedResult(decision.state);
  }
  simulateClaudeClick(decision.button);
  await sleep(1200);
  return {
    submitted: true,
    ...getClaudePageState(),
  };
}

async function continueClaudeOnboarding() {
  const decision = await waitForClaude(() => {
    const state = getClaudePageState();
    if (['name_entry', 'setup_later', 'claude_page'].includes(state.state)) {
      return { action: 'already_advanced', state };
    }
    if (['first_chat_intro', 'onboarding'].includes(state.state)) {
      const button = findClaudeClickableByText(CLAUDE_CONTINUE_TEXT_PATTERN);
      if (button) {
        return { action: 'click', button };
      }
    }
    return null;
  }, { timeoutMs: 45000, intervalMs: 300 });

  if (!decision) {
    throw new Error('Claude continue button was not found.');
  }
  if (decision.action === 'already_advanced') {
    return buildClaudeAlreadyAdvancedResult(decision.state);
  }
  simulateClaudeClick(decision.button);
  await sleep(1200);
  return {
    submitted: true,
    ...getClaudePageState(),
  };
}

async function submitClaudeRandomName(payload = {}) {
  const fullName = String(payload.fullName || payload.name || '').trim();
  if (!fullName) {
    throw new Error('Claude random name is empty.');
  }
  const decision = await waitForClaude(() => {
    const state = getClaudePageState();
    if (['setup_later', 'claude_page'].includes(state.state)) {
      return { action: 'already_advanced', state };
    }
    const input = findClaudeVisibleTextInput();
    if (input) {
      return { action: 'fill', input };
    }
    return null;
  }, { timeoutMs: 45000, intervalMs: 300 });
  if (!decision) {
    throw new Error('Claude name input was not found.');
  }
  if (decision.action === 'already_advanced') {
    return {
      ...buildClaudeAlreadyAdvancedResult(decision.state),
      fullName,
    };
  }
  fillInput(decision.input, fullName);
  await sleep(200);
  const button = findClaudeClickableByText(CLAUDE_CONTINUE_TEXT_PATTERN);
  if (!button) {
    throw new Error('Claude name continue button was not found.');
  }
  simulateClaudeClick(button);
  await sleep(1200);
  return {
    submitted: true,
    ...getClaudePageState(),
    fullName,
  };
}

async function setUpClaudeLater() {
  const decision = await waitForClaude(() => {
    const state = getClaudePageState();
    if (state.state === 'claude_page') {
      return { action: 'already_advanced', state };
    }
    const button = findClaudeClickableByText(CLAUDE_SETUP_LATER_TEXT_PATTERN);
    if (button) {
      return { action: 'click', button };
    }
    return null;
  }, { timeoutMs: 45000, intervalMs: 300 });

  if (!decision) {
    throw new Error('Claude set up later button was not found.');
  }
  if (decision.action === 'already_advanced') {
    return buildClaudeAlreadyAdvancedResult(decision.state);
  }
  simulateClaudeClick(decision.button);
  await sleep(2000);
  return {
    submitted: true,
    ...getClaudePageState(),
  };
}

async function executeClaudeCommand(command, payload = {}) {
  switch (command) {
    case 'claude-open-official-page':
      return openClaudeOfficialPage(payload);
    case 'claude-wait-official-page':
      return waitClaudeOfficialPageLoaded(payload);
    case 'claude-fill-email':
      return fillClaudeEmail(payload);
    case 'claude-submit-email':
    case 'claude-submit-email-and-fetch-link':
      return submitClaudeEmail(payload);
    case 'claude-create-account':
      return createClaudeAccount(payload);
    case 'claude-select-free-plan':
      return selectClaudeFreePlan(payload);
    case 'claude-skip-onboarding':
      return skipClaudeOnboarding(payload);
    case 'claude-continue-onboarding':
      return continueClaudeOnboarding(payload);
    case 'claude-submit-random-name':
      return submitClaudeRandomName(payload);
    case 'claude-set-up-later':
      return setUpClaudeLater(payload);
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
