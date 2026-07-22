console.log('[MultiPage:grok-register-page] Content script loaded on', location.href);

const GROK_REGISTER_PAGE_LISTENER_SENTINEL = '__multipageGrokRegisterPageListener__';
const GROK_REGISTER_PAGE_LISTENER_KEY = '__multipageGrokRegisterPageV4Listener__';
const GROK_REGISTER_PAGE_COMMAND_TYPE = 'GROK_EXECUTE_NODE_V4';
const GROK_REGISTER_PAGE_HANDLER_VERSION = 4;
const GROK_SIGNUP_URL = 'https://accounts.x.ai/sign-up?redirect=grok-com';
const GROK_EMAIL_SIGNUP_TEXT_PATTERN = /使用邮箱注册|sign\s*up\s*with\s*email|continue\s*with\s*email|email/i;
const GROK_CONTINUE_TEXT_PATTERN = /continue|next|sign\s*up|submit|verify|继续|下一步|注册|提交|验证/i;
const GROK_DEVICE_CONTINUE_TEXT_PATTERN = /^(?:继续|continue|next)$/i;
const GROK_REGISTER_TEXT_PATTERN = /^(?:注册|sign\s*up|create\s+account)$/i;
const GROK_DEVICE_ALLOW_TEXT_PATTERN = /^(?:允许|允许访问|允许并继续|allow(?:\s+access)?|authorize(?:\s+device)?)$/i;
const GROK_COOKIE_CONSENT_TEXT_PATTERN = /^(?:全部拒绝|拒绝所有|接受所有(?:\s*cookie)?|accept\s+all(?:\s+cookies)?|reject\s+all(?:\s+cookies)?)$/i;
const GROK_LOGIN_ENTRY_TEXT_PATTERN = /登录(?:您的)?(?:账户|账号)|还没有(?:账户|账号)|login\s+to\s+your\s+account|sign\s+in\s+to\s+your\s+account|don'?t\s+have\s+an\s+account/i;
const GROK_LOGIN_ENTRY_PATH_PATTERN = /\/(?:sign-in|signin|login|sign-up|signup|register)(?:[/?#]|$)/i;
const GROK_PROFILE_TEXT_PATTERN = /given\s*name|family\s*name|first\s*name|last\s*name|password|名字|姓氏|密码/i;
const GROK_VERIFICATION_PAGE_TEXT_PATTERN = /验证您(?:的)?邮箱|verify\s+(?:your\s+)?email|check\s+your\s+email|一次性安全代码|one[-\s]*time\s+(?:security\s+)?code/i;
const GROK_VERIFICATION_PAGE_PATH_PATTERN = /\/(?:verify(?:-email)?|email[-_/]?verification|confirmation)(?:[/?#]|$)/i;
const GROK_VERIFICATION_SUBMIT_TEXT_PATTERN = /^(?:确认邮箱|确认|verify(?:\s+(?:email|code))?|confirm(?:\s+(?:email|code))?|continue)$/i;
const GROK_VERIFICATION_EMAIL_ACTION_TEXT_PATTERN = /^(?:确认邮箱|验证邮箱|verify\s+email|confirm\s+email)$/i;
const GROK_HUMAN_VERIFICATION_SUCCESS_TIMEOUT_MS = 120 * 1000;
const GROK_HUMAN_VERIFICATION_SUCCESS_TEXT_PATTERN = /成功|success|verified|verification\s*(?:complete|successful)|challenge\s*(?:complete|passed)/i;

function isVisibleGrokElement(element) {
  if (!element || !(element instanceof Element)) return false;
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function getGrokElementText(element) {
  if (!element) return '';
  return String(
    element.innerText
    || element.textContent
    || element.getAttribute?.('aria-label')
    || element.getAttribute?.('title')
    || ''
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function queryVisibleGrokElement(selector) {
  return getGrokElements(selector).find(isVisibleGrokElement) || null;
}

function getGrokElements(selector, root = document, elements = []) {
  if (!root?.querySelectorAll) return elements;
  for (const element of Array.from(root.querySelectorAll(selector))) {
    elements.push(element);
  }
  // xAI can render consent controls inside open web-component shadow roots.
  for (const host of Array.from(root.querySelectorAll('*'))) {
    if (host.shadowRoot) getGrokElements(selector, host.shadowRoot, elements);
  }
  return elements;
}

function getGrokPageText(root = document, segments = []) {
  if (!root?.querySelectorAll) return segments.join(' ');
  if (root === document) {
    segments.push(String(document.body?.innerText || document.body?.textContent || ''));
  }
  for (const host of Array.from(root.querySelectorAll('*'))) {
    if (!host.shadowRoot) continue;
    segments.push(String(host.shadowRoot.innerText || host.shadowRoot.textContent || ''));
    getGrokPageText(host.shadowRoot, segments);
  }
  return segments.join(' ').replace(/\s+/g, ' ').trim();
}

function findGrokClickableByText(pattern) {
  const selectors = 'button, a, [role="button"], input[type="button"], input[type="submit"]';
  return getGrokElements(selectors).find((element) => {
    if (!isVisibleGrokElement(element)) return false;
    const text = element instanceof HTMLInputElement ? element.value : getGrokElementText(element);
    return pattern.test(text);
  }) || null;
}

function getGrokClickableDiagnostics() {
  const selectors = 'button, a, [role="button"], input[type="button"], input[type="submit"]';
  return getGrokElements(selectors)
    .filter(isVisibleGrokElement)
    .map((element) => getGrokElementText(element))
    .filter(Boolean)
    .slice(0, 12)
    .join(' | ') || '无可见可点击元素';
}

function findGrokCookieConsentButton() {
  return findGrokClickableByText(GROK_COOKIE_CONSENT_TEXT_PATTERN)
    || queryVisibleGrokElement([
      '#onetrust-reject-all-handler',
      '#onetrust-accept-btn-handler',
      '[data-testid*="cookie" i] button',
      '[id*="cookie" i] button',
      '[class*="cookie" i] button',
    ].join(', '));
}

function dismissGrokCookieConsent() {
  const consentButton = findGrokCookieConsentButton();
  if (!consentButton) return false;
  simulateGrokClick(consentButton);
  return true;
}

function simulateGrokClick(element) {
  throwIfStopped();
  if (!element) {
    throw new Error('无法点击空元素。');
  }
  element.scrollIntoView?.({ block: 'center', inline: 'center' });
  element.focus?.({ preventScroll: true });
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
  if (typeof window.PointerEvent === 'function') {
    element.dispatchEvent(new PointerEvent('pointerover', { ...eventOptions, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
    element.dispatchEvent(new PointerEvent('pointerdown', { ...eventOptions, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
    element.dispatchEvent(new PointerEvent('pointerup', { ...eventOptions, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
  }
  element.dispatchEvent(new MouseEvent('mouseover', eventOptions));
  element.dispatchEvent(new MouseEvent('mousedown', eventOptions));
  element.dispatchEvent(new MouseEvent('mouseup', eventOptions));
  if (typeof element.click === 'function') {
    element.click();
    return;
  }
  element.dispatchEvent(new MouseEvent('click', eventOptions));
}

function submitGrokFormControl(control) {
  if (control?.form?.requestSubmit) {
    control.form.requestSubmit(control);
    return;
  }
  simulateGrokClick(control);
}

async function waitForGrok(predicate, options = {}) {
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

function findGrokEmailInput() {
  return queryVisibleGrokElement([
    'input[type="email"]',
    'input[name="email" i]',
    'input[autocomplete="email"]',
    'input[placeholder*="email" i]',
    'input[inputmode="email"]',
  ].join(', '));
}

function findGrokOtpInputs() {
  const inputs = getGrokElements([
    'input[autocomplete="one-time-code"]',
    'input[inputmode="numeric"]',
    'input[name*="otp" i]',
    'input[name*="code" i]',
    'input[aria-label*="code" i]',
    'input[placeholder*="code" i]',
    'input[maxlength="1"]',
  ].join(', ')).filter(isVisibleGrokElement);
  if (inputs.length) return inputs;
  const oneCharInputs = getGrokElements('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"])')
    .filter((input) => isVisibleGrokElement(input) && Number(input.maxLength || 0) === 1);
  return oneCharInputs.length >= 4 ? oneCharInputs : [];
}

function isGrokVerificationPage() {
  return findGrokOtpInputs().length > 0
    || GROK_VERIFICATION_PAGE_TEXT_PATTERN.test(getGrokPageText())
    || Boolean(findGrokClickableByText(GROK_VERIFICATION_EMAIL_ACTION_TEXT_PATTERN))
    || GROK_VERIFICATION_PAGE_PATH_PATTERN.test(String(location.pathname || ''));
}

function findGrokProfileInput(names) {
  const selectors = names.flatMap((name) => [
    `input[name="${name}" i]`,
    `input[id="${name}" i]`,
    `input[autocomplete="${name}" i]`,
    `input[placeholder*="${name}" i]`,
    `input[aria-label*="${name}" i]`,
  ]).join(', ');
  return queryVisibleGrokElement(selectors);
}

function findGrokPasswordInputs() {
  return Array.from(document.querySelectorAll([
    'input[type="password"]',
    'input[name*="password" i]',
    'input[autocomplete="new-password"]',
    'input[placeholder*="password" i]',
    'input[aria-label*="password" i]',
  ].join(', '))).filter(isVisibleGrokElement);
}

function findGrokSubmitButton(contextPattern = GROK_CONTINUE_TEXT_PATTERN) {
  return findGrokClickableByText(contextPattern)
    || Array.from(document.querySelectorAll('button:not([disabled]), [role="button"]')).filter(isVisibleGrokElement).at(-1)
    || null;
}

function findGrokVerificationSubmitButton() {
  return findGrokClickableByText(GROK_VERIFICATION_SUBMIT_TEXT_PATTERN)
    || findGrokSubmitButton(GROK_VERIFICATION_SUBMIT_TEXT_PATTERN);
}

function getGrokTurnstileResponseValue() {
  const fields = Array.from(document.querySelectorAll([
    'input[name="cf-turnstile-response"]',
    'textarea[name="cf-turnstile-response"]',
  ].join(', ')));
  const field = fields.find((element) => String(element.value || '').trim());
  return String(field?.value || '').trim();
}

function getGrokHumanVerificationContainers() {
  const selectors = [
    '.cf-turnstile',
    '[class*="turnstile" i]',
    '[id*="turnstile" i]',
    '[data-sitekey]',
    'iframe[src*="challenges.cloudflare.com"]',
    'iframe[src*="turnstile"]',
    'iframe[title*="cloudflare" i]',
    'iframe[title*="challenge" i]',
    'input[name="cf-turnstile-response"]',
    'textarea[name="cf-turnstile-response"]',
  ].join(', ');
  const containers = new Set();
  for (const element of Array.from(document.querySelectorAll(selectors))) {
    let current = element;
    for (let depth = 0; current && depth < 5; depth += 1) {
      if (current instanceof Element) containers.add(current);
      current = current.parentElement;
    }
  }
  return Array.from(containers);
}

function getGrokHumanVerificationSuccessEvidence() {
  const token = getGrokTurnstileResponseValue();
  if (token) {
    return { type: 'turnstile_response' };
  }

  for (const container of getGrokHumanVerificationContainers()) {
    const text = getGrokElementText(container);
    if (text && GROK_HUMAN_VERIFICATION_SUCCESS_TEXT_PATTERN.test(text)) {
      return { type: 'visible_success_text', text };
    }
  }

  return null;
}

async function waitForGrokHumanVerificationSuccess() {
  const result = await waitForGrok(
    getGrokHumanVerificationSuccessEvidence,
    {
      timeoutMs: GROK_HUMAN_VERIFICATION_SUCCESS_TIMEOUT_MS,
      intervalMs: 500,
    }
  );
  if (result) return result;
  throw new Error('x.ai 人机验证未显示成功，暂不点击完成注册。');
}

function getGrokPageState() {
  const pageText = document.body?.innerText || '';
  if (isGrokDeviceCodePage()) return 'device_code';
  // Visible page state must win over cookies. xAI can create a provisional SSO
  // cookie while the account is still waiting for email verification.
  if (isGrokVerificationPage()) return 'verification_code_entry';
  if (findGrokProfileInput(['givenName', 'firstName']) || findGrokPasswordInputs().length || GROK_PROFILE_TEXT_PATTERN.test(pageText)) return 'profile_entry';
  if (findGrokEmailInput()) return 'email_entry';
  if (isGrokLoginEntryPage()) return 'login_entry';
  if (/grok|xai|x\.ai/i.test(location.hostname) && /(?:^|;\s*)sso=/.test(document.cookie || '')) return 'signed_in';
  return 'unknown';
}

async function openGrokSignupPage() {
  if (!/accounts\.x\.ai$/i.test(location.hostname) || !/\/sign-up/i.test(location.pathname)) {
    location.href = GROK_SIGNUP_URL;
    return { submitted: true, state: 'navigating', url: location.href };
  }
  const emailButton = await waitForGrok(() => (
    findGrokClickableByText(GROK_EMAIL_SIGNUP_TEXT_PATTERN) || findGrokEmailInput()
  ), { timeoutMs: 30000 });
  if (!emailButton) throw new Error('未找到 x.ai 邮箱注册入口。');
  if (!(emailButton instanceof HTMLInputElement)) {
    simulateGrokClick(emailButton);
    await sleep(500);
  }
  return { submitted: true, state: getGrokPageState(), url: location.href };
}

async function continueGrokDeviceLogin() {
  const currentState = getGrokPageState();
  const readyStates = ['login_entry', 'email_entry', 'verification_code_entry', 'profile_entry', 'signed_in'];
  if (!isGrokDeviceCodePage() && readyStates.includes(currentState)) {
    return { submitted: true, state: currentState, url: location.href };
  }
  if (!isGrokDeviceCodePage()) {
    throw new Error(`当前页面不是 Grok Build 设备码页或登录页，状态：${currentState || 'unknown'}。`);
  }
  // The device authorization URL already displays the code from grok2api.
  const continueButton = await waitForGrok(
    () => findGrokClickableByText(GROK_DEVICE_CONTINUE_TEXT_PATTERN),
    { timeoutMs: 30000, intervalMs: 500 }
  );
  if (!continueButton) throw new Error('未找到 Grok Build 的“继续”按钮。');
  // The device-login action is a regular POST form. Prefer its native submit
  // path over synthetic pointer events, which xAI can ignore in an extension
  // content-script context.
  submitGrokFormControl(continueButton);
  // Return before the form navigation destroys this document and its message
  // response channel. The background reconnects to the new page and confirms
  // the login state separately.
  return { submitted: true, state: 'device_login_submitted', url: location.href };
}

async function openGrokEmailSignup() {
  if (isGrokDeviceCodePage()) {
    throw new Error('仍停留在 Grok Build 设备码页面，不能进入邮箱注册。请先完成第 2 步并确认页面已离开设备码页。');
  }
  const registerButton = await waitForGrok(
    () => {
      if (isGrokDeviceCodePage()) return null;
      return findGrokClickableByText(GROK_REGISTER_TEXT_PATTERN);
    },
    { timeoutMs: 30000 }
  );
  if (!registerButton) throw new Error('未找到 Grok 登录页的“注册”入口。');
  simulateGrokClick(registerButton);

  const emailButton = await waitForGrok(() => {
    if (isGrokDeviceCodePage()) return null;
    return findGrokClickableByText(GROK_EMAIL_SIGNUP_TEXT_PATTERN) || findGrokEmailInput();
  }, { timeoutMs: 30000, intervalMs: 500 });
  if (!emailButton) throw new Error('未找到 xAI 的“使用邮箱注册”入口。');
  if (!(emailButton instanceof HTMLInputElement)) {
    simulateGrokClick(emailButton);
  }
  const emailInput = await waitForGrok(() => (
    isGrokDeviceCodePage() ? null : findGrokEmailInput()
  ), { timeoutMs: 30000, intervalMs: 300 });
  if (!emailInput) throw new Error('选择“使用邮箱注册”后未出现邮箱输入框。');
  return { submitted: true, state: 'email_entry', url: location.href };
}

function isGrokDeviceAuthorizedPage() {
  const pageText = String(document.body?.innerText || '');
  return /设备已授权|device\s+(?:is\s+)?authorized|you\s+may\s+close\s+this\s+window/i.test(pageText);
}

function isGrokDeviceCodePage() {
  const pageText = String(document.body?.innerText || '');
  return /登录\s*Grok\s*Build|sign\s*in\s*to\s*Grok\s*Build|输入终端中显示的代码|enter\s+the\s+code\s+shown\s+in\s+your\s+terminal/i.test(pageText);
}

function isGrokLoginEntryPage() {
  if (isGrokDeviceCodePage()) return false;
  const pageText = String(document.body?.innerText || '');
  return GROK_LOGIN_ENTRY_TEXT_PATTERN.test(pageText)
    || GROK_LOGIN_ENTRY_PATH_PATTERN.test(location.pathname)
    || Boolean(findGrokClickableByText(GROK_REGISTER_TEXT_PATTERN))
    || Boolean(findGrokClickableByText(GROK_EMAIL_SIGNUP_TEXT_PATTERN));
}

function isGrokDisabledElement(element) {
  return Boolean(element?.matches?.('[disabled], [aria-disabled="true"]'));
}

async function approveGrokDeviceAuthorization() {
  if (isGrokDeviceAuthorizedPage()) {
    return { submitted: true, state: 'device_authorized', url: location.href };
  }
  if (isGrokDeviceCodePage()) {
    dismissGrokCookieConsent();
    const continueButton = await waitForGrok(
      () => {
        dismissGrokCookieConsent();
        return findGrokClickableByText(GROK_DEVICE_CONTINUE_TEXT_PATTERN);
      },
      { timeoutMs: 30000, intervalMs: 300 }
    );
    if (!continueButton) throw new Error('未找到 Grok Build 设备授权页的“继续”按钮。');
    submitGrokFormControl(continueButton);
  }
  const authorizationPage = await waitForGrok(
    () => {
      dismissGrokCookieConsent();
      if (isGrokDeviceAuthorizedPage()) {
        return { authorized: true };
      }
      const allowButton = findGrokClickableByText(GROK_DEVICE_ALLOW_TEXT_PATTERN);
      return allowButton ? { allowButton } : null;
    },
    { timeoutMs: 45000, intervalMs: 500 }
  );
  if (authorizationPage?.authorized) {
    return { submitted: true, state: 'device_authorized', url: location.href };
  }
  if (!authorizationPage?.allowButton) {
    throw new Error(`未找到 Grok Build 授权页的“允许”按钮。可见操作：${getGrokClickableDiagnostics()}`);
  }
  const readSubmittedState = () => {
    if (isGrokDeviceAuthorizedPage()) {
      return { state: 'device_authorized', url: location.href };
    }
    return !authorizationPage.allowButton.isConnected
      || !isVisibleGrokElement(authorizationPage.allowButton)
      || isGrokDisabledElement(authorizationPage.allowButton)
      || !findGrokClickableByText(GROK_DEVICE_ALLOW_TEXT_PATTERN)
      ? { state: 'device_authorization_submitted', url: location.href }
      : null;
  };

  let submitted = readSubmittedState();
  let clickedAllow = false;
  for (let attempt = 1; !submitted && attempt <= 3; attempt += 1) {
    submitGrokFormControl(authorizationPage.allowButton);
    clickedAllow = true;
    submitted = await waitForGrok(readSubmittedState, { timeoutMs: 4000, intervalMs: 250 });
  }
  if (!submitted) {
    throw new Error(`点击 Grok Build“允许”后按钮仍可用，授权未提交。可见操作：${getGrokClickableDiagnostics()}`);
  }
  // grok2api polling is the source of truth when xAI keeps its consent page open.
  return {
    submitted: true,
    clickedAllow,
    ...submitted,
  };
}

async function submitGrokEmail(payload = {}) {
  // The first submit response can be lost when xAI replaces the document.
  // If the background retries this command on the OTP page, treat the visible
  // verification state as proof that the email submission already succeeded.
  if (isGrokVerificationPage()) {
    return { submitted: true, state: 'verification_code_entry', url: location.href };
  }
  const email = String(payload.email || '').trim();
  if (!email) throw new Error('缺少 Grok 注册邮箱。');
  const input = await waitForGrok(findGrokEmailInput, { timeoutMs: 45000 });
  if (!input) throw new Error('未找到 x.ai 邮箱输入框。');
  fillInput(input, email);
  await sleep(200);
  const button = findGrokSubmitButton();
  if (!button) throw new Error('未找到 x.ai 邮箱提交按钮。');
  // requestSubmit() can synchronously replace the document before the content
  // script answers the background message. Defer it one task so the
  // email_submitted response is delivered first, then reconnect on the OTP UI.
  setTimeout(() => {
    try {
      submitGrokFormControl(button);
    } catch (error) {
      console.warn('[MultiPage:grok-register-page] Deferred email submit failed', error);
    }
  }, 0);
  return { submitted: true, state: 'email_submitted', url: location.href };
}

function getGrokVerificationErrorText() {
  const text = String(document.body?.innerText || '').trim();
  const patterns = [
    /(?:verification|confirmation)?\s*code\s*(?:is\s*)?(?:invalid|incorrect|expired)[^\n]*/i,
    /invalid\s*(?:verification|confirmation)?\s*code[^\n]*/i,
    /验证码[^\n]*(?:错误|无效|过期)[^\n]*/i,
    /代码[^\n]*(?:错误|无效|过期)[^\n]*/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[0]) return match[0].trim();
  }
  return '';
}

async function submitGrokVerificationCode(payload = {}) {
  const normalizedCode = String(payload.code || '').replace(/[^A-Za-z0-9]/g, '').trim();
  if (!normalizedCode) throw new Error('缺少 xAI 验证码。');
  const inputs = await waitForGrok(() => findGrokOtpInputs(), { timeoutMs: 45000 });
  if (!inputs?.length) throw new Error('未找到 xAI 验证码输入框。');
  if (inputs.length === 1) {
    fillInput(inputs[0], normalizedCode);
  } else {
    normalizedCode.split('').forEach((char, index) => {
      if (inputs[index]) fillInput(inputs[index], char);
    });
  }
  await sleep(200);
  const confirmButton = await waitForGrok(findGrokVerificationSubmitButton, {
    timeoutMs: 5000,
    intervalMs: 200,
  });
  if (!confirmButton) throw new Error('未找到 x.ai“确认邮箱”按钮。');
  submitGrokFormControl(confirmButton);
  const settledState = await waitForGrok(() => {
    const errorText = getGrokVerificationErrorText();
    if (errorText) return { state: 'verification_error', error: errorText };
    const state = getGrokPageState();
    return state && state !== 'verification_code_entry' ? { state } : null;
  }, { timeoutMs: 20000, intervalMs: 500 });
  const finalState = settledState?.state || getGrokPageState();
  if (settledState?.error) {
    throw new Error(settledState.error);
  }
  if (finalState === 'email_entry') {
    throw new Error('x.ai 验证码提交后回到邮箱注册页，可能是验证码无效、会话过期或注册风控重置。');
  }
  if (!['profile_entry', 'signed_in'].includes(finalState)) {
    throw new Error(`x.ai 验证码提交后进入未知页面状态：${finalState || 'unknown'}。`);
  }
  return { submitted: true, state: finalState, url: location.href };
}

async function submitGrokProfile(payload = {}) {
  const firstName = String(payload.firstName || '').trim();
  const lastName = String(payload.lastName || '').trim();
  const password = String(payload.password || '');
  if (!firstName || !lastName || !password) throw new Error('缺少 Grok 注册资料。');
  const ready = await waitForGrok(() => {
    const firstInput = findGrokProfileInput(['givenName', 'firstName', 'given-name']);
    const lastInput = findGrokProfileInput(['familyName', 'lastName', 'family-name']);
    const passwordInputs = findGrokPasswordInputs();
    return firstInput && lastInput && passwordInputs.length ? { firstInput, lastInput, passwordInputs } : null;
  }, { timeoutMs: 45000 });
  if (!ready) throw new Error('未找到 x.ai 资料或密码表单。');
  fillInput(ready.firstInput, firstName);
  fillInput(ready.lastInput, lastName);
  ready.passwordInputs.forEach((input) => fillInput(input, password));
  const humanVerification = await waitForGrokHumanVerificationSuccess();
  const button = findGrokSubmitButton();
  if (!button) throw new Error('未找到 x.ai 资料提交按钮。');
  submitGrokFormControl(button);
  return {
    submitted: true,
    state: 'profile_submitted',
    url: location.href,
    humanVerification: humanVerification?.type || '',
  };
}

async function extractGrokSsoCookie() {
  const match = String(document.cookie || '').match(/(?:^|;\s*)sso=([^;]+)/);
  return {
    submitted: true,
    state: match ? 'sso_cookie_found' : getGrokPageState(),
    ssoCookie: match ? decodeURIComponent(match[1]) : '',
    url: location.href,
  };
}

async function executeGrokCommand(command, payload = {}) {
  switch (command) {
    case 'grok-open-signup-page':
      return openGrokSignupPage(payload);
    case 'grok-continue-device-login':
      return continueGrokDeviceLogin(payload);
    case 'grok-open-email-signup':
      return openGrokEmailSignup(payload);
    case 'grok-approve-device-authorization':
      return approveGrokDeviceAuthorization(payload);
    case 'grok-submit-email':
      return submitGrokEmail(payload);
    case 'grok-submit-verification-code':
      return submitGrokVerificationCode(payload);
    case 'grok-submit-profile':
      return submitGrokProfile(payload);
    case 'grok-extract-sso-cookie':
      return extractGrokSsoCookie(payload);
    case 'GET_PAGE_STATE':
      return { state: getGrokPageState(), url: location.href };
    default:
      throw new Error(`未知 Grok 注册命令：${command}`);
  }
}

// Keep this guard in the extension's isolated world. A DOM attribute survives
// extension reloads and would otherwise prevent the fresh listener from binding.
if (!globalThis[GROK_REGISTER_PAGE_LISTENER_SENTINEL]) {
  globalThis[GROK_REGISTER_PAGE_LISTENER_SENTINEL] = true;
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'EXECUTE_NODE' && message?.type !== 'GET_PAGE_STATE') return false;
    resetStopState();
    const command = message.command || message.nodeId || message.type;
    executeGrokCommand(command, message.payload || {})
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

// Always replace the current protocol listener when this file is injected.
// This makes force-injection actually refresh the behavior in an already-open
// xAI SPA tab instead of leaving an older listener behind a boolean sentinel.
const previousVersionedListener = globalThis[GROK_REGISTER_PAGE_LISTENER_KEY];
if (typeof previousVersionedListener === 'function') {
  try {
    chrome.runtime.onMessage.removeListener(previousVersionedListener);
  } catch (_) {
    // An extension reload can invalidate the old listener context.
  }
}
const currentVersionedListener = (message, _sender, sendResponse) => {
  if (message?.type !== GROK_REGISTER_PAGE_COMMAND_TYPE) return false;
  resetStopState();
  const command = message.command || message.nodeId || message.type;
  executeGrokCommand(command, message.payload || {})
    .then((result) => sendResponse({
      ok: true,
      handlerVersion: GROK_REGISTER_PAGE_HANDLER_VERSION,
      command,
      ...result,
    }))
    .catch((error) => {
      if (isStopError(error)) {
        sendResponse({
          stopped: true,
          handlerVersion: GROK_REGISTER_PAGE_HANDLER_VERSION,
          command,
          error: error.message,
        });
        return;
      }
      sendResponse({
        ok: false,
        handlerVersion: GROK_REGISTER_PAGE_HANDLER_VERSION,
        command,
        error: error?.message || String(error),
      });
    });
  return true;
};
globalThis[GROK_REGISTER_PAGE_LISTENER_KEY] = currentVersionedListener;
chrome.runtime.onMessage.addListener(currentVersionedListener);

window.__MULTIPAGE_GROK_REGISTER_PAGE__ = {
  executeGrokCommand,
  getGrokPageState,
};
