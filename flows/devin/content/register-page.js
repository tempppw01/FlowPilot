(function attachDevinRegisterPage(root) {
  const COMMAND = 'DEVIN_EXECUTE_NODE';
  const SOURCE_ID = 'devin-register-page';
  const LISTENER_SENTINEL = '__multipageDevinRegisterPageListener__';
  const CAPTCHA_PATTERN = /captcha|recaptcha|hcaptcha|verify you are human|security challenge|人机验证|安全验证/i;
  const CONTINUE_PATTERN = /^(continue|next|submit|sign\s*up|register|continue with email|继续|下一步|提交|确认)$/i;
  function textOf(el) { return String(el?.innerText || el?.textContent || el?.getAttribute?.('aria-label') || el?.value || '').replace(/\s+/g, ' ').trim(); }
  function visible(el) {
    if (!(el instanceof HTMLElement)) return false;
    const style = getComputedStyle(el); const rect = el.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
  }
  function needsHuman() {
    return Boolean(document.querySelector('iframe[src*="captcha" i], iframe[src*="recaptcha" i], [class*="captcha" i], [id*="captcha" i]'))
      || CAPTCHA_PATTERN.test(document.body?.innerText || '');
  }
  function actionable() { return [...document.querySelectorAll('button, a, [role="button"], input[type="submit"]')].filter((el) => visible(el) && !el.disabled); }
  function choose(pattern, exclude = /google|apple|github|microsoft|sso|登录|sign\s*in|log\s*in/i) { return actionable().find((el) => pattern.test(textOf(el)) && !exclude.test(textOf(el))); }
  function findTermsCheckbox() {
    const candidates = [...document.querySelectorAll('input[type="checkbox"], [role="checkbox"]')].filter(visible);
    if (!candidates.length) return null;
    const termsPattern = /agree|terms|privacy|policy|同意|条款|隐私/i;
    return candidates.find((el) => {
      const label = el.labels?.[0];
      const container = el.closest?.('label, [role="group"]') || el.parentElement;
      const nearbyText = [textOf(el), textOf(label), textOf(container)].join(' ');
      return termsPattern.test(nearbyText);
    }) || candidates[0];
  }
  function isCheckboxChecked(checkbox) {
    return checkbox?.checked === true || checkbox?.getAttribute?.('aria-checked') === 'true';
  }
  function ensureTermsAccepted() {
    const checkbox = findTermsCheckbox();
    if (!checkbox) throw new Error('当前页面未找到 Devin 服务条款同意复选框。');
    if (!isCheckboxChecked(checkbox)) click(checkbox);
    if (!isCheckboxChecked(checkbox)) throw new Error('无法勾选 Devin 服务条款与隐私政策，请手动勾选后重试。');
    return true;
  }
  function click(el) { if (!el) return false; el.scrollIntoView({ block: 'center', inline: 'center' }); el.click(); return true; }
  function setValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function response(extra = {}) { return { ok: true, url: location.href, ...extra }; }
  async function execute(action, payload = {}) {
    if (needsHuman()) return { needsHuman: true, reason: 'captcha_or_human_check', url: location.href };
    if (action === 'submit-email') {
      const email = String(payload.email || '').trim(); if (!email) throw new Error('缺少注册邮箱。');
      const input = [...document.querySelectorAll('input[type="email"], input[autocomplete="email"], input[name*="email" i]')].find(visible);
      if (!input) throw new Error('当前页面未找到邮箱输入框。');
      input.focus(); setValue(input, email);
      ensureTermsAccepted();
      const button = choose(CONTINUE_PATTERN); if (button) click(button); else input.form?.requestSubmit?.();
      return response({ emailSubmitted: true, termsAccepted: true });
    }
    if (action === 'submit-code') {
      const code = String(payload.code || '').replace(/\s/g, ''); if (!code) throw new Error('缺少邮箱验证码。');
      const fields = [...document.querySelectorAll('input[autocomplete="one-time-code"], input[name*="code" i], input[aria-label*="code" i], input[type="text"]')].filter(visible);
      if (!fields.length) throw new Error('当前页面未找到验证码输入框。');
      if (fields.length > 1 && fields.every((field) => Number(field.maxLength) === 1)) [...code].slice(0, fields.length).forEach((digit, index) => setValue(fields[index], digit));
      else setValue(fields[0], code);
      const button = choose(CONTINUE_PATTERN); if (button) click(button); else fields[0].form?.requestSubmit?.();
      return response({ codeSubmitted: true });
    }
    throw new Error(`不支持的 Devin 页面操作：${action}`);
  }
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage && !window[LISTENER_SENTINEL]) {
    window[LISTENER_SENTINEL] = true;
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === 'PING') {
        sendResponse({ ok: true, source: SOURCE_ID });
        return false;
      }
      if (message?.type !== COMMAND) return false;
      execute(String(message.action || ''), message.payload || {}).then(sendResponse)
        .catch((error) => sendResponse({ error: error instanceof Error ? error.message : String(error) }));
      return true;
    });
  }
  root.MultiPageDevinRegisterPage = { execute };
})(typeof self !== 'undefined' ? self : globalThis);
