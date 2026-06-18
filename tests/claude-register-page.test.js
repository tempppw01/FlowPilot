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
