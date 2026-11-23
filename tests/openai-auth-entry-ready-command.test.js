const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('flows/openai/content/openai-auth.js', 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`async function ${name}(`);
  if (start < 0) throw new Error(`missing function ${name}`);

  let parenDepth = 0;
  let signatureEnded = false;
  let braceStart = -1;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') parenDepth += 1;
    if (char === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) signatureEnded = true;
    }
    if (char === '{' && signatureEnded) {
      braceStart = index;
      break;
    }
  }

  let depth = 0;
  for (let end = braceStart; end < source.length; end += 1) {
    if (source[end] === '{') depth += 1;
    if (source[end] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, end + 1);
    }
  }
  throw new Error(`missing end of function ${name}`);
}

test('openai-auth accepts and dispatches the step 1 signup-entry probe', async () => {
  assert.match(source, /if \(!globalThis\[OPENAI_AUTH_LISTENER_SENTINEL\]\)/);
  assert.doesNotMatch(source, /document\.documentElement\.getAttribute\(OPENAI_AUTH_LISTENER_SENTINEL\)/);
  assert.match(source, /message\.type === 'ENSURE_SIGNUP_ENTRY_READY'/);
  assert.match(source, /case 'ENSURE_SIGNUP_ENTRY_READY':\s*return await ensureSignupEntryReadyForStep1\(\);/);

  const pageLocation = { href: 'https://chatgpt.com/' };
  const handler = new Function(
    'waitForSignupEntryState',
    'getSignupEntryDiagnostics',
    'location',
    `${extractFunction('ensureSignupEntryReadyForStep1')}\n${extractFunction('handleCommand')}\nreturn handleCommand;`
  )(async () => ({ state: 'entry_home', url: pageLocation.href }), () => ({}), pageLocation);
  const result = await handler({ type: 'ENSURE_SIGNUP_ENTRY_READY' });

  assert.deepStrictEqual(result, {
    ready: true,
    state: 'entry_home',
    url: 'https://chatgpt.com/',
  });
});

test('step 1 entry probe waits without clicking and returns diagnostics for unknown pages', async () => {
  const waits = [];
  const diagnostics = { url: 'https://chatgpt.com/', readyState: 'complete' };
  const pageLocation = { href: 'https://chatgpt.com/' };
  const helper = new Function(
    'waitForSignupEntryState',
    'getSignupEntryDiagnostics',
    'location',
    `${extractFunction('ensureSignupEntryReadyForStep1')}\nreturn ensureSignupEntryReadyForStep1;`
  )(
    async (options) => {
      waits.push(options);
      return { state: 'unknown', url: pageLocation.href };
    },
    () => diagnostics,
    pageLocation
  );

  const result = await helper();

  assert.deepStrictEqual(waits, [{
    timeout: 10000,
    autoOpenEntry: false,
    step: 1,
    logDiagnostics: true,
  }]);
  assert.deepStrictEqual(result, {
    ready: false,
    state: 'unknown',
    url: 'https://chatgpt.com/',
    diagnostics,
  });
});
