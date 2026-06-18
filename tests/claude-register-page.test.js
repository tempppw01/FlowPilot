const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('flows/claude/content/register-page.js', 'utf8');

function createHarness({ href = 'https://claude.ai/onboarding', hostname = 'claude.ai', bodyText = '' } = {}) {
  const context = {
    console: { log() {}, warn() {}, error() {}, info() {} },
    URL,
    setTimeout,
    clearTimeout,
    location: { href, hostname, pathname: new URL(href).pathname },
    Element: class Element {},
    HTMLInputElement: class HTMLInputElement {},
    MouseEvent: class MouseEvent {},
    window: null,
    chrome: {
      runtime: {
        onMessage: {
          addListener() {},
        },
      },
    },
    document: {
      body: {
        innerText: bodyText,
        textContent: bodyText,
      },
      documentElement: {
        hasAttribute() {
          return true;
        },
        setAttribute() {},
      },
      querySelectorAll() {
        return [];
      },
      querySelector() {
        return null;
      },
    },
    getComputedStyle() {
      return { display: 'block', visibility: 'visible', opacity: '1' };
    },
    sleep: async () => {},
    throwIfStopped() {},
    resetStopState() {},
    fillInput() {},
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.__MULTIPAGE_CLAUDE_REGISTER_PAGE__;
}

function createElement(context, options = {}) {
  const element = new context.Element();
  element.innerText = options.text || '';
  element.textContent = options.text || '';
  element.value = options.value || '';
  element.checked = Boolean(options.checked);
  element.clicks = 0;
  element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 120, height: 32 });
  element.dispatchEvent = () => true;
  element.click = () => {
    element.clicks += 1;
    if (typeof options.onClick === 'function') options.onClick(element);
  };
  element.matches = (selector = '') => {
    if (options.kind === 'checkbox' && selector === 'input[type="checkbox"]') return true;
    return false;
  };
  element.getAttribute = (name = '') => {
    if (name === 'aria-checked') return element.checked ? 'true' : 'false';
    if (name === 'aria-label') return options.ariaLabel || '';
    if (name === 'title') return options.title || '';
    if (name === 'type') return options.type || '';
    return '';
  };
  return element;
}

test('Claude create account step treats first chat onboarding as already advanced', async () => {
  const api = createHarness({
    bodyText: [
      'Before your first chat',
      'A few things to know, plus one setting to review',
      'Help improve our AI models',
      'Continue',
    ].join(' '),
  });

  const result = await api.executeClaudeCommand('claude-create-account');

  assert.equal(result.submitted, false);
  assert.equal(result.alreadyAdvanced, true);
  assert.equal(result.state, 'onboarding');
});

test('Claude create account step responds before delayed navigation click', async () => {
  const timers = [];
  const context = {
    console: { log() {}, warn() {}, error() {}, info() {} },
    URL,
    setTimeout(fn, ms) {
      timers.push({ fn, ms });
      return timers.length;
    },
    clearTimeout() {},
    location: { href: 'https://claude.ai/login', hostname: 'claude.ai', pathname: '/login' },
    Element: class Element {},
    HTMLInputElement: class HTMLInputElement {},
    MouseEvent: class MouseEvent {},
    window: null,
    chrome: {
      runtime: {
        onMessage: {
          addListener() {},
        },
      },
    },
    document: {
      body: {
        innerText: 'Let’s create your account Acceptable Use Policy Create account',
        textContent: 'Let’s create your account Acceptable Use Policy Create account',
      },
      documentElement: {
        hasAttribute() {
          return true;
        },
        setAttribute() {},
      },
      querySelectorAll() {
        return [];
      },
      querySelector() {
        return null;
      },
    },
    getComputedStyle() {
      return { display: 'block', visibility: 'visible', opacity: '1' };
    },
    sleep: async () => {},
    throwIfStopped() {},
    resetStopState() {},
    fillInput() {},
  };
  context.window = context;
  const checkbox = createElement(context, {
    kind: 'checkbox',
    checked: false,
    text: 'I agree to the terms',
    onClick(element) {
      element.checked = true;
    },
  });
  const button = createElement(context, { text: 'Create account' });
  context.document.querySelectorAll = (selector = '') => {
    if (selector.includes('input[type="checkbox"]')) return [checkbox];
    if (selector.includes('button')) return [button];
    return [];
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const api = context.window.__MULTIPAGE_CLAUDE_REGISTER_PAGE__;

  const result = await api.executeClaudeCommand('claude-create-account');

  assert.equal(result.submitted, true);
  assert.equal(result.navigationScheduled, true);
  assert.equal(result.state, 'create_account_submitted');
  assert.equal(button.clicks, 0);
  assert.equal(timers.length, 1);

  timers[0].fn();
  assert.equal(button.clicks, 1);
});
