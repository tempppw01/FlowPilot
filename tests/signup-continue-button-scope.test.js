/*
 * @Description: Verify the signup "continue" button is anchored to the signup modal scope.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('flows/openai/content/openai-auth.js', 'utf8');

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

function extractFunction(name) {
  const signature = source.indexOf(`function ${name}(`);
  if (signature < 0) {
    throw new Error(`missing function ${name}`);
  }

  // 保留 `async` 前缀，否则提取出的函数体里的 await 会变成语法错误。
  const isAsync = source.slice(0, signature).endsWith('async ');
  const start = isAsync ? signature - 'async '.length : signature;

  let parenDepth = 0;
  let signatureEnded = false;
  let braceStart = -1;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') {
      parenDepth += 1;
    } else if (char === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        signatureEnded = true;
      }
    } else if (char === '{' && signatureEnded) {
      braceStart = index;
      break;
    }
  }

  if (braceStart < 0) {
    throw new Error(`missing body for function ${name}`);
  }

  let depth = 0;
  let end = braceStart;
  for (; end < source.length; end += 1) {
    if (source[end] === '{') depth += 1;
    if (source[end] === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }

  return source.slice(start, end);
}

function extractConst(name) {
  const marker = `const ${name} = `;
  const start = source.indexOf(marker);
  if (start < 0) {
    throw new Error(`missing const ${name}`);
  }

  const tail = "].join('|'), 'i');";
  const tailIndex = source.indexOf(tail, start);
  if (tailIndex < 0) {
    throw new Error(`missing terminator for ${name}`);
  }
  return source.slice(start, tailIndex + tail.length);
}

function matchesSelectorPart(el, part) {
  const matched = /^([a-z0-9]+)?((?:\[[^\]]*\])*)$/i.exec(part.trim());
  if (!matched) return false;

  const [, tag, attrPart] = matched;
  if (tag && el.tag !== tag.toLowerCase()) return false;

  const attrPattern = /\[([^\]=]+)(?:=["']?([^\]"']*)["']?)?\]/g;
  let attrMatch = attrPattern.exec(attrPart || '');
  while (attrMatch) {
    const name = attrMatch[1].trim();
    const value = attrMatch[2];
    if (value === undefined) {
      if (!(name in el.attrs)) return false;
    } else if (String(el.attrs[name] ?? '') !== value) {
      return false;
    }
    attrMatch = attrPattern.exec(attrPart || '');
  }

  return true;
}

function matchesSelector(el, selector) {
  return selector
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .some((part) => matchesSelectorPart(el, part));
}

function createElement({
  tag = 'button',
  text = '',
  attrs = {},
  visible = true,
  enabled = true,
  connected = true,
  form = null,
  children = [],
  parent = null,
} = {}) {
  const el = {
    tag: tag.toLowerCase(),
    textContent: text,
    value: '',
    disabled: !enabled,
    isConnected: connected,
    visible,
    form,
    parent,
    children,
    attrs,
    getAttribute(name) {
      if (name in this.attrs) return this.attrs[name];
      return null;
    },
    getBoundingClientRect() {
      return this.visible ? { width: 20, height: 20 } : { width: 0, height: 0 };
    },
    closest(selector) {
      let current = this;
      while (current) {
        if (matchesSelector(current, selector)) return current;
        current = current.parent;
      }
      return null;
    },
    contains(node) {
      if (node === this) return true;
      return this.children.some((child) => child.contains(node));
    },
    querySelectorAll(selector) {
      const found = [];
      const visit = (node) => {
        for (const child of node.children) {
          if (matchesSelector(child, selector)) found.push(child);
          visit(child);
        }
      };
      visit(this);
      return found;
    },
  };

  for (const child of children) {
    child.parent = el;
  }
  return el;
}

const STUBS = `
const document = deps.document;
const window = { getComputedStyle: () => ({ display: 'block', visibility: 'visible' }) };

${extractConst('SIGNUP_SWITCH_TO_EMAIL_PATTERN')}
${extractConst('SIGNUP_SWITCH_TO_PHONE_PATTERN')}

function getSignupEmailInput() { return deps.emailInput; }
function getSignupPhoneInput() { return deps.phoneInput; }
function isVisibleElement(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}
function isActionEnabled(el) {
  return Boolean(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true';
}
function getActionText(el) {
  return [el?.textContent, el?.value, el?.getAttribute?.('aria-label'), el?.getAttribute?.('title')]
    .filter(Boolean)
    .join(' ')
    .replace(/\\s+/g, ' ')
    .trim();
}
`;

function buildPicker({ root, emailInput = null, phoneInput = null }) {
  const factory = new Function('deps', `
${STUBS}
${extractFunction('getSignupEmailContinueButton')}

return { pick: getSignupEmailContinueButton };
`);

  return factory({
    document: { querySelectorAll: (selector) => root.querySelectorAll(selector) },
    emailInput,
    phoneInput,
  });
}

function buildWaiter({ root, emailInput = null, phoneInput = null }) {
  const factory = new AsyncFunction('deps', `
${STUBS}
let clock = 0;
const Date = { now: () => clock };
function throwIfStopped() {}
function sleep(ms) { clock += ms; return Promise.resolve(); }

${extractFunction('getSignupEmailContinueButton')}
${extractFunction('waitForSignupEmailContinueButton')}

deps.result = { wait: waitForSignupEmailContinueButton };
`);

  const deps = {
    document: { querySelectorAll: (selector) => root.querySelectorAll(selector) },
    emailInput,
    phoneInput,
    result: null,
  };
  factory(deps);
  return deps.result;
}

test('signup continue button prefers the button inside the signup modal', () => {
  const backgroundButton = createElement({ text: '继续' });
  const emailInput = createElement({ tag: 'input', attrs: { type: 'email' } });
  const modalButton = createElement({ text: '继续' });
  const dialog = createElement({ tag: 'div', attrs: { role: 'dialog' }, children: [emailInput, modalButton] });
  const root = createElement({ tag: 'div', children: [backgroundButton, dialog] });

  const { pick } = buildPicker({ root, emailInput });
  const picked = pick({ allowDisabled: true });

  assert.equal(picked, modalButton);
  assert.notEqual(picked, backgroundButton);
});

test('signup continue button falls back to the document when the modal has no button', () => {
  const backgroundButton = createElement({ text: '继续' });
  const emailInput = createElement({ tag: 'input', attrs: { type: 'email' } });
  const dialog = createElement({ tag: 'div', attrs: { role: 'dialog' }, children: [emailInput] });
  const root = createElement({ tag: 'div', children: [backgroundButton, dialog] });

  const { pick } = buildPicker({ root, emailInput });

  assert.equal(pick({ allowDisabled: true }), backgroundButton);
});

test('signup continue button still resolves page-level buttons without a modal scope', () => {
  const pageButton = createElement({ text: '继续' });
  const emailInput = createElement({ tag: 'input', attrs: { type: 'email' } });
  const root = createElement({ tag: 'div', children: [emailInput, pageButton] });

  const { pick } = buildPicker({ root, emailInput });

  assert.equal(pick({ allowDisabled: true }), pageButton);
});

test('phone signup anchors on the phone input instead of a lingering email input', () => {
  const emailButton = createElement({ text: '继续' });
  const emailInput = createElement({ tag: 'input', attrs: { type: 'email' } });
  const emailDialog = createElement({ tag: 'div', attrs: { role: 'dialog' }, children: [emailInput, emailButton] });

  const phoneButton = createElement({ text: '继续' });
  const phoneInput = createElement({ tag: 'input', attrs: { type: 'tel' } });
  const phoneDialog = createElement({ tag: 'div', attrs: { role: 'dialog' }, children: [phoneInput, phoneButton] });

  const root = createElement({ tag: 'div', children: [emailDialog, phoneDialog] });

  const { pick } = buildPicker({ root, emailInput, phoneInput });

  assert.equal(pick({ allowDisabled: true, input: phoneInput }), phoneButton);
  assert.equal(pick({ allowDisabled: true, input: emailInput }), emailButton);
});

test('waiting for the continue button re-resolves a replaced input node', async () => {
  const backgroundButton = createElement({ text: '继续' });
  const staleInput = createElement({ tag: 'input', attrs: { type: 'email' }, connected: false });
  const freshButton = createElement({ text: '继续' });
  const freshInput = createElement({ tag: 'input', attrs: { type: 'email' } });
  const dialog = createElement({ tag: 'div', attrs: { role: 'dialog' }, children: [freshInput, freshButton] });
  const root = createElement({ tag: 'div', children: [backgroundButton, dialog] });

  const { wait } = buildWaiter({ root, emailInput: freshInput });

  const button = await wait({ timeout: 200, interval: 50, input: staleInput });

  assert.equal(button, freshButton);
});

test('signup call sites pass the matching input anchor to the continue button lookup', () => {
  assert.match(source, /waitForSignupEmailContinueButton\(\{\s*input:\s*snapshot\.emailInput\s*\}\)/);
  assert.match(source, /waitForSignupEmailContinueButton\(\{\s*input:\s*snapshot\.phoneInput\s*\}\)/);
  assert.match(source, /getSignupEmailContinueButton\(\{\s*allowDisabled:\s*true,\s*input:\s*emailInput\s*\}\)/);
});
