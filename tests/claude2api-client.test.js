const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function loadClaude2ApiClient() {
  const source = fs.readFileSync('flows/claude/background/claude2api-client.js', 'utf8');
  const globalScope = { console, URL, AbortController, setTimeout, clearTimeout };
  return new Function('self', `${source}; return self.MultiPageBackgroundClaude2ApiClient;`)(globalScope);
}

test('Claude2API connection test logs in to admin API without submitting a session key', async () => {
  const api = loadClaude2ApiClient();
  const calls = [];
  const result = await api.testClaude2ApiConnection('claude2api.example/admin-api/session', 'admin-pass', async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true }),
    };
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.equal(result.message, 'Claude2API 连接测试成功，管理员密钥有效。');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://claude2api.example/admin-api/login');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.credentials, 'include');
  assert.deepEqual(JSON.parse(calls[0].options.body), { password: 'admin-pass' });
});

test('Claude2API connection test returns server error detail', async () => {
  const api = loadClaude2ApiClient();
  const result = await api.testClaude2ApiConnection('https://claude2api.example', 'bad-pass', async () => ({
    ok: false,
    status: 401,
    statusText: 'Unauthorized',
    text: async () => JSON.stringify({ error: 'Admin authentication required' }),
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
  assert.equal(result.message, 'Claude2API 连接测试失败（HTTP 401）：Admin authentication required');
});
