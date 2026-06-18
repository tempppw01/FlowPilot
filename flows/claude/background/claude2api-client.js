(function attachBackgroundClaude2ApiClient(root, factory) {
  root.MultiPageBackgroundClaude2ApiClient = factory(root);
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundClaude2ApiClientModule(root) {
  function normalizeClaude2ApiBaseUrl(value = '') {
    const raw = String(value || '').trim();
    if (!raw) {
      throw new Error('请先填写 Claude2API 地址。');
    }
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    let parsed;
    try {
      parsed = new URL(withProtocol);
    } catch {
      throw new Error('Claude2API 地址格式无效，请检查后重试。');
    }
    let pathname = String(parsed.pathname || '').replace(/\/+$/, '');
    const adminApiIndex = pathname.toLowerCase().indexOf('/admin-api');
    if (adminApiIndex >= 0) {
      pathname = pathname.slice(0, adminApiIndex);
    }
    parsed.pathname = pathname || '/';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '');
  }

  function readClaude2ApiResponseMessage(payload, fallback = '') {
    const candidates = [
      payload?.message,
      payload?.detail,
      payload?.error,
      payload?.reason,
      fallback,
    ];
    return candidates.map((value) => String(value || '').trim()).find(Boolean) || '';
  }

  async function readJsonResponse(response) {
    const text = await response.text().catch(() => '');
    if (!text) {
      return null;
    }
    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  }

  async function testClaude2ApiConnection(baseUrl, adminPassword, fetchImpl) {
    const normalizedBaseUrl = normalizeClaude2ApiBaseUrl(baseUrl);
    const password = String(adminPassword || '');
    if (!password.trim()) {
      throw new Error('请先填写 Claude2API 管理员密码。');
    }
    const activeFetch = typeof fetchImpl === 'function'
      ? fetchImpl
      : (typeof fetch === 'function' ? fetch.bind(root || globalThis) : null);
    if (typeof activeFetch !== 'function') {
      throw new Error('当前环境不支持网络请求，无法测试 Claude2API。');
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 15000) : null;
    try {
      const response = await activeFetch(`${normalizedBaseUrl}/admin-api/login`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
        credentials: 'include',
        signal: controller?.signal,
      });
      const payload = await readJsonResponse(response);
      if (response.ok) {
        return {
          ok: true,
          status: response.status,
          message: 'Claude2API 连接测试成功，管理员密钥有效。',
        };
      }
      const detail = readClaude2ApiResponseMessage(payload, response.statusText);
      return {
        ok: false,
        status: response.status,
        message: `Claude2API 连接测试失败（HTTP ${response.status}）${detail ? `：${detail}` : ''}`,
      };
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error('Claude2API 连接测试超时，请检查地址是否可访问。');
      }
      throw error;
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  return {
    normalizeClaude2ApiBaseUrl,
    testClaude2ApiConnection,
  };
});
