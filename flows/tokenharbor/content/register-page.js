(function attachTokenHarborRegisterPage(root) {
  const COMMAND = 'TOKENHARBOR_EXECUTE_NODE';
  const SOURCE_ID = 'tokenharbor-register-page';
  const LISTENER_SENTINEL = '__multipageTokenHarborRegisterPageListener__';
  const CAPTCHA_PATTERN = /captcha|recaptcha|hcaptcha|turnstile|verify you are human|security challenge|人机验证|安全验证/i;
  const SUBMIT_PATTERN = /^(create account|create|sign up|continue|创建账号|创建帐户|注册)$/i;
  function textOf(el) { return String(el?.innerText || el?.textContent || el?.getAttribute?.('aria-label') || el?.value || '').replace(/\s+/g, ' ').trim(); }
  function visible(el) {
    if (!(el instanceof HTMLElement)) return false;
    const style = getComputedStyle(el); const rect = el.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
  }
  function needsHuman() {
    if (document.querySelector('iframe[src*="captcha" i], iframe[src*="turnstile" i], [class*="captcha" i], [id*="captcha" i], [class*="turnstile" i]')) return true;
    const bodyText = String(document.body?.innerText || '');
    return /(?:complete|solve|pass|finish|请完成|请通过|需要完成).{0,40}(?:captcha|recaptcha|hcaptcha|turnstile|human verification|security challenge|人机验证|安全验证)|(?:captcha|recaptcha|hcaptcha|turnstile|human verification|security challenge|人机验证|安全验证).{0,40}(?:required|is required|to continue|请完成|请通过)/i.test(bodyText);
  }
  function setValue(el, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function response(extra = {}) { return { ok: true, url: location.href, ...extra }; }
  async function execute(action, payload = {}) {
    if (needsHuman()) return { needsHuman: true, reason: 'captcha_or_human_check', url: location.href };
    if (action !== 'submit-signup') throw new Error('不支持的 Token Harbor 页面操作：' + action);
    const email = String(payload.email || '').trim();
    const password = String(payload.password || '');
    if (!email) throw new Error('缺少 Token Harbor 注册邮箱。');
    if (password.length < 12 || new TextEncoder().encode(password).length > 72) throw new Error('Token Harbor 密码需要至少 12 个字符且不能超过 72 字节。');
    const emailInput = [...document.querySelectorAll('input[type="email"], input[autocomplete="email"], input[name*="email" i]')].find(visible);
    const passwordInput = [...document.querySelectorAll('input[type="password"], input[autocomplete="new-password"]')].find(visible);
    if (!emailInput || !passwordInput) throw new Error('当前页面未找到 Token Harbor 邮箱或密码输入框。');
    emailInput.focus(); setValue(emailInput, email); passwordInput.focus(); setValue(passwordInput, password);
    const button = [...document.querySelectorAll('button, [role="button"], input[type="submit"]')].find((el) => visible(el) && !el.disabled && SUBMIT_PATTERN.test(textOf(el)));
    if (button) { button.scrollIntoView({ block: 'center' }); button.click(); }
    else if (emailInput.form && emailInput.form === passwordInput.form) emailInput.form.requestSubmit?.();
    else throw new Error('当前页面未找到 Create account 按钮。');
    return response({ signupSubmitted: true, email });
  }
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage && !window[LISTENER_SENTINEL]) {
    window[LISTENER_SENTINEL] = true;
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === 'PING') { sendResponse({ ok: true, source: SOURCE_ID }); return false; }
      if (message?.type !== COMMAND) return false;
      execute(String(message.action || ''), message.payload || {}).then(sendResponse).catch((error) => sendResponse({ error: error instanceof Error ? error.message : String(error) }));
      return true;
    });
  }
  root.MultiPageTokenHarborRegisterPage = { execute };
})(typeof self !== 'undefined' ? self : globalThis);
