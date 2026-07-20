(function attachBackgroundGrokPublisherGrok2Api(root, factory) {
  root.MultiPageBackgroundGrokPublisherGrok2Api = factory(root);
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundGrokPublisherGrok2ApiModule(root) {
  const grokStateApi = root?.MultiPageBackgroundGrokState || null;

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function cleanString(value = '') {
    return String(value ?? '').trim();
  }

  function getErrorMessage(error) {
    return error instanceof Error ? error.message : String(error ?? '未知错误');
  }

  function normalizeGrok2ApiBaseUrl(value = '') {
    const rawValue = cleanString(value).replace(/\/+$/, '');
    if (!rawValue) {
      throw new Error('缺少 grok2api 地址。');
    }
    let parsed;
    try {
      parsed = new URL(rawValue);
    } catch {
      throw new Error('grok2api 地址无效。');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('grok2api 地址必须使用 HTTP 或 HTTPS。');
    }
    parsed.hash = '';
    parsed.search = '';
    parsed.pathname = parsed.pathname.replace(/\/+$/, '').replace(/\/api\/admin\/v1$/, '');
    return `${parsed.origin}${parsed.pathname === '/' ? '' : parsed.pathname}`;
  }

  function buildGrok2ApiEndpoint(baseUrl = '', path = '') {
    const normalizedBaseUrl = normalizeGrok2ApiBaseUrl(baseUrl);
    return `${normalizedBaseUrl}/api/admin/v1${String(path || '').startsWith('/') ? path : `/${path}`}`;
  }

  async function readResponse(response) {
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (_error) {
      json = null;
    }
    return { text, json };
  }

  function readResponseMessage(body = {}, fallback = '') {
    return cleanString(
      body?.json?.error?.message
      || body?.json?.message
      || body?.json?.error?.code
      || body?.text
      || fallback
    );
  }

  function readDataEnvelope(body = {}, label = 'grok2api') {
    if (!isPlainObject(body?.json) || !isPlainObject(body.json.data)) {
      throw new Error(`${label} 返回格式无效。`);
    }
    return body.json.data;
  }

  async function loginGrok2Api(baseUrl, username, password, fetchImpl) {
    const normalizedUsername = cleanString(username);
    const normalizedPassword = String(password ?? '');
    if (!normalizedUsername || !normalizedPassword) {
      throw new Error('缺少 grok2api 管理员账号或密码。');
    }
    const endpointUrl = buildGrok2ApiEndpoint(baseUrl, '/auth/login');
    const response = await fetchImpl(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ username: normalizedUsername, password: normalizedPassword }),
    });
    const body = await readResponse(response);
    if (!response.ok) {
      throw new Error(`grok2api 管理员登录失败：${readResponseMessage(body, `HTTP ${response.status}`)}`);
    }
    const data = readDataEnvelope(body, 'grok2api 管理员登录');
    const accessToken = cleanString(data?.tokens?.accessToken);
    if (!accessToken) {
      throw new Error('grok2api 管理员登录未返回 accessToken。');
    }
    return { accessToken, endpointUrl };
  }

  async function testGrok2ApiConnection(baseUrl, username, password, fetchImpl) {
    const normalizedUsername = cleanString(username);
    const normalizedPassword = String(password ?? '');
    if (!normalizedUsername || !normalizedPassword) {
      return { ok: false, status: 0, message: '请先填写 grok2api 管理员账号和密码。' };
    }
    let endpointUrl = '';
    try {
      endpointUrl = buildGrok2ApiEndpoint(baseUrl, '/auth/login');
    } catch (error) {
      return { ok: false, status: 0, message: getErrorMessage(error) };
    }
    try {
      const response = await fetchImpl(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ username: normalizedUsername, password: normalizedPassword }),
      });
      const body = await readResponse(response);
      if (response.ok) {
        const accessToken = cleanString(body?.json?.data?.tokens?.accessToken);
        if (accessToken) {
          return { ok: true, status: response.status, message: `grok2api 连接正常（HTTP ${response.status}）` };
        }
        return { ok: false, status: response.status, message: 'grok2api 管理员登录未返回 accessToken。' };
      }
      const detail = readResponseMessage(body, response.statusText || `HTTP ${response.status}`);
      if (response.status === 401 || response.status === 403) {
        return { ok: false, status: response.status, message: `grok2api 管理员账号或密码被拒绝（HTTP ${response.status}${detail ? `：${detail}` : ''}）` };
      }
      if (response.status === 404) {
        return { ok: false, status: response.status, message: `未找到 grok2api 管理接口（HTTP 404${detail ? `：${detail}` : ''}）` };
      }
      return { ok: false, status: response.status, message: detail || `grok2api 连接失败（HTTP ${response.status}）` };
    } catch (error) {
      return { ok: false, status: 0, message: `grok2api 连接失败：${getErrorMessage(error)}` };
    }
  }

  function buildAdminHeaders(accessToken = '') {
    const normalizedToken = cleanString(accessToken);
    if (!normalizedToken) {
      throw new Error('缺少 grok2api 管理员 accessToken。');
    }
    return {
      Authorization: `Bearer ${normalizedToken}`,
      Accept: 'application/json',
    };
  }

  function resolveGrokSsoCookie(state = {}) {
    const runtimeState = readGrokRuntime(state);
    return cleanString(runtimeState?.sso?.currentCookie || state?.grokSsoCookie);
  }

  function buildGrok2ApiWebSsoImportBody(ssoCookie = '') {
    const normalizedCookie = cleanString(ssoCookie);
    if (!normalizedCookie) {
      throw new Error('缺少 Grok SSO Cookie，请先完成 SSO 提取步骤。');
    }
    if (typeof FormData !== 'function' || typeof Blob !== 'function') {
      throw new Error('当前浏览器不支持 grok2api Web SSO 导入。');
    }
    const body = new FormData();
    body.append('files', new Blob([normalizedCookie], { type: 'text/plain' }), 'grok-web-sso-tokens.txt');
    return body;
  }

  async function uploadGrokSsoToGrok2ApiWeb(baseUrl, accessToken, ssoCookie, fetchImpl) {
    const endpointUrl = buildGrok2ApiEndpoint(baseUrl, '/accounts/web/import');
    const response = await fetchImpl(endpointUrl, {
      method: 'POST',
      headers: buildAdminHeaders(accessToken),
      body: buildGrok2ApiWebSsoImportBody(ssoCookie),
    });
    const body = await readResponse(response);
    if (!response.ok) {
      throw new Error(`grok2api Web SSO 上传失败：${readResponseMessage(body, `HTTP ${response.status}`)}`);
    }
    const data = readDataEnvelope(body, 'grok2api Web SSO 上传');
    const created = Math.max(0, Math.floor(Number(data.created) || 0));
    const updated = Math.max(0, Math.floor(Number(data.updated) || 0));
    const skipped = Math.max(0, Math.floor(Number(data.skipped) || 0));
    const synced = Math.max(0, Math.floor(Number(data.synced) || 0));
    const syncFailed = Math.max(0, Math.floor(Number(data.syncFailed) || 0));
    return {
      endpointUrl,
      message: `创建 ${created}，更新 ${updated}，跳过 ${skipped}，同步成功 ${synced}${syncFailed ? `，同步失败 ${syncFailed}` : ''}`,
      data,
    };
  }

  async function startGrok2ApiDeviceAuthorization(baseUrl, accessToken, fetchImpl) {
    const endpointUrl = buildGrok2ApiEndpoint(baseUrl, '/accounts/device/start');
    const response = await fetchImpl(endpointUrl, {
      method: 'POST',
      headers: buildAdminHeaders(accessToken),
    });
    const body = await readResponse(response);
    if (!response.ok) {
      throw new Error(`grok2api 设备授权启动失败：${readResponseMessage(body, `HTTP ${response.status}`)}`);
    }
    const data = readDataEnvelope(body, 'grok2api 设备授权');
    const sessionId = cleanString(data.sessionId);
    const userCode = cleanString(data.userCode);
    const verificationUri = cleanString(data.verificationUriComplete || data.verificationUri);
    const intervalSeconds = Math.max(1, Math.floor(Number(data.intervalSeconds) || 5));
    const expiresAt = Date.parse(data.expiresAt || '');
    if (!sessionId || !userCode || !verificationUri || !Number.isFinite(expiresAt)) {
      throw new Error('grok2api 设备授权响应缺少必要字段。');
    }
    return { endpointUrl, sessionId, userCode, verificationUri, intervalSeconds, expiresAt };
  }

  async function pollGrok2ApiDeviceAuthorization(baseUrl, accessToken, sessionId, fetchImpl) {
    const endpointUrl = buildGrok2ApiEndpoint(baseUrl, `/accounts/device/${encodeURIComponent(cleanString(sessionId))}/poll`);
    const response = await fetchImpl(endpointUrl, {
      method: 'POST',
      headers: buildAdminHeaders(accessToken),
    });
    const body = await readResponse(response);
    if (response.status === 202) {
      return { status: 'pending', endpointUrl };
    }
    if (!response.ok) {
      const message = readResponseMessage(body, `HTTP ${response.status}`);
      const errorCode = cleanString(body?.json?.error?.code);
      if (response.status === 401 || response.status === 403 || errorCode === 'adminUnauthorized') {
        return { status: 'admin_unauthorized', endpointUrl, message };
      }
      if (response.status === 410 || errorCode === 'deviceLoginExpired') {
        return { status: 'expired', endpointUrl, message };
      }
      if (response.status === 429 || errorCode === 'devicePollTooFast') {
        return { status: 'slow_down', endpointUrl, message };
      }
      throw new Error(`grok2api 设备授权检查失败：${message}`);
    }
    const data = readDataEnvelope(body, 'grok2api 设备授权检查');
    return {
      status: cleanString(data.status) || 'succeeded',
      endpointUrl,
      accountName: cleanString(data?.account?.credential?.name || data?.account?.name),
    };
  }

  function readGrokRuntime(state = {}) {
    return grokStateApi?.ensureRuntimeState
      ? grokStateApi.ensureRuntimeState(state)
      : (isPlainObject(state?.runtimeState?.flowState?.grok) ? state.runtimeState.flowState.grok : {});
  }

  function buildRuntimePatch(currentState = {}, patch = {}) {
    if (typeof grokStateApi?.buildRuntimeStatePatch === 'function') {
      return grokStateApi.buildRuntimeStatePatch(currentState, patch);
    }
    return { runtimeState: { flowState: { grok: { ...readGrokRuntime(currentState), ...patch } } } };
  }

  function resolveGrok2ApiConfig(state = {}) {
    const nested = state?.settingsState?.flows?.grok?.targets?.grok2api || {};
    return {
      baseUrl: cleanString(nested.baseUrl || state?.grok2ApiUrl),
      adminUsername: cleanString(nested.adminUsername || state?.grok2ApiAdminUsername),
      adminPassword: String(nested.adminPassword ?? state?.grok2ApiAdminPassword ?? ''),
      uploadMethod: cleanString(nested.uploadMethod || state?.grok2ApiUploadMethod || 'web-sso-import'),
    };
  }

  function wait(milliseconds, sleepWithStop) {
    if (typeof sleepWithStop === 'function') {
      return sleepWithStop(milliseconds);
    }
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  function createGrok2ApiPublisher(deps = {}) {
    const {
      addLog = async () => {},
      chrome = null,
      clearGrokCookies = async () => {},
      completeNodeFromBackground,
      fetchImpl = typeof fetch === 'function' ? fetch.bind(globalThis) : null,
      getState = async () => ({}),
      registerTab = async () => {},
      reuseOrCreateTab = null,
      setState = async () => {},
      sleepWithStop = null,
      throwIfStopped = () => {},
      GROK_REGISTER_INJECT_FILES = null,
    } = deps;

    if (typeof completeNodeFromBackground !== 'function') {
      throw new Error('Grok grok2api publisher requires completeNodeFromBackground.');
    }
    if (typeof fetchImpl !== 'function') {
      throw new Error('Grok grok2api publisher requires fetch support.');
    }

    async function applyDeviceState(currentState, deviceAuth, runtimePatch = {}) {
      const patch = buildRuntimePatch(currentState, { ...runtimePatch, deviceAuth });
      await setState(patch);
      return patch;
    }

    async function applyGrok2ApiUploadState(currentState, grok2ApiUpload) {
      const patch = buildRuntimePatch(currentState, { grok2ApiUpload });
      await setState(patch);
      return patch;
    }

    async function executeGrokUploadSsoToGrok2Api(state = {}) {
      const nodeId = cleanString(state?.nodeId) || 'grok-upload-sso-to-grok2api';
      const currentState = await getState();
      let endpointUrl = '';
      try {
        const config = resolveGrok2ApiConfig(currentState);
        const ssoCookie = resolveGrokSsoCookie(currentState);
        endpointUrl = buildGrok2ApiEndpoint(config.baseUrl, '/accounts/web/import');
        await applyGrok2ApiUploadState(currentState, {
          status: 'logging_in', uploadedAt: 0, message: '', targetUrl: endpointUrl,
        });
        await addLog('步骤 6：正在登录 grok2api 管理接口。', 'info', { nodeId });
        const login = await loginGrok2Api(config.baseUrl, config.adminUsername, config.adminPassword, fetchImpl);
        await applyGrok2ApiUploadState(await getState(), {
          status: 'uploading', uploadedAt: 0, message: '', targetUrl: endpointUrl,
        });
        await addLog('步骤 6：正在上传 Grok SSO 到 grok2api Web...', 'info', { nodeId });
        const result = await uploadGrokSsoToGrok2ApiWeb(config.baseUrl, login.accessToken, ssoCookie, fetchImpl);
        const payload = await applyGrok2ApiUploadState(await getState(), {
          status: 'uploaded', uploadedAt: Date.now(), message: result.message, targetUrl: result.endpointUrl,
        });
        await addLog(`步骤 6：Grok SSO 已上传到 grok2api Web，${result.message}。`, 'ok', { nodeId });
        await completeNodeFromBackground(nodeId, payload);
      } catch (error) {
        const message = getErrorMessage(error);
        await applyGrok2ApiUploadState(await getState(), {
          status: 'error', uploadedAt: 0, message, targetUrl: endpointUrl,
        });
        await addLog(`步骤 6：${message}`, 'error', { nodeId });
        throw error;
      }
    }

    async function openDeviceAuthorizationTab(verificationUri) {
      if (typeof reuseOrCreateTab === 'function') {
        return reuseOrCreateTab('grok-register-page', verificationUri, {
          inject: Array.isArray(GROK_REGISTER_INJECT_FILES) ? GROK_REGISTER_INJECT_FILES : null,
          injectSource: 'grok-register-page',
        });
      }
      if (chrome?.tabs?.create) {
        const tab = await chrome.tabs.create({ url: verificationUri, active: true });
        return Number.isInteger(tab?.id) ? tab.id : null;
      }
      return null;
    }

    async function executeGrokStartGrok2ApiDeviceAuth(state = {}) {
      const nodeId = cleanString(state?.nodeId) || 'grok-start-grok2api-device-auth';
      const currentState = await getState();
      const config = resolveGrok2ApiConfig(currentState);
      try {
        // A fresh device session must not inherit the previous xAI login.
        await clearGrokCookies({ nodeId, label: '步骤 1' });
        await applyDeviceState(currentState, {
          status: 'logging_in', sessionId: '', userCode: '', verificationUri: '', expiresAt: 0,
          intervalSeconds: 0, completedAt: 0, message: '',
        });
        await addLog('正在登录 grok2api 管理接口并获取 Grok Build 授权链接。', 'info', { nodeId });
        const login = await loginGrok2Api(config.baseUrl, config.adminUsername, config.adminPassword, fetchImpl);
        await applyDeviceState(await getState(), {
          status: 'starting', sessionId: '', userCode: '', verificationUri: '', expiresAt: 0,
          intervalSeconds: 0, completedAt: 0, message: '',
        });
        const deviceAuthorization = await startGrok2ApiDeviceAuthorization(config.baseUrl, login.accessToken, fetchImpl);
        const tabId = await openDeviceAuthorizationTab(deviceAuthorization.verificationUri);
        if (Number.isInteger(tabId)) {
          await registerTab('grok-register-page', tabId);
        }
        const payload = await applyDeviceState(await getState(), {
          status: 'awaiting_authorization',
          sessionId: deviceAuthorization.sessionId,
          userCode: deviceAuthorization.userCode,
          verificationUri: deviceAuthorization.verificationUri,
          expiresAt: deviceAuthorization.expiresAt,
          intervalSeconds: deviceAuthorization.intervalSeconds,
          completedAt: 0,
          message: '',
        }, {
          session: {
            registerTabId: Number.isInteger(tabId) ? tabId : null,
            startedAt: Date.now(),
            pageUrl: deviceAuthorization.verificationUri,
            lastError: '',
          },
        });
        await addLog(`已获取设备代码 ${deviceAuthorization.userCode}，已打开 xAI 授权页面，请在该页面完成注册。`, 'ok', { nodeId });
        await completeNodeFromBackground(nodeId, payload);
      } catch (error) {
        const message = getErrorMessage(error);
        const latestState = await getState();
        await applyDeviceState(latestState, {
          ...(readGrokRuntime(latestState).deviceAuth || {}),
          status: 'error',
          message,
        });
        await addLog(`获取 Grok Build 授权链接失败：${message}`, 'error', { nodeId });
        throw error;
      }
    }

    async function executeGrokCompleteGrok2ApiDeviceAuth(state = {}) {
      const nodeId = cleanString(state?.nodeId) || 'grok-complete-grok2api-device-auth';
      let deviceAuthorization = null;
      try {
        const currentState = await getState();
        const config = resolveGrok2ApiConfig(currentState);
        deviceAuthorization = readGrokRuntime(currentState).deviceAuth || {};
        const sessionId = cleanString(deviceAuthorization.sessionId);
        const expiresAt = Number(deviceAuthorization.expiresAt) || 0;
        if (!sessionId || !expiresAt || Date.now() >= expiresAt) {
          throw new Error('设备授权会话不存在或已过期，请重新执行“获取并打开 Grok Build 授权链接”。');
        }

        await addLog('正在完成 Grok Build 授权并接入 grok2api。', 'info', { nodeId });
        let accessToken = (await loginGrok2Api(
          config.baseUrl,
          config.adminUsername,
          config.adminPassword,
          fetchImpl
        )).accessToken;
        let intervalSeconds = Math.max(1, Number(deviceAuthorization.intervalSeconds) || 5);
        while (Date.now() < expiresAt) {
          throwIfStopped();
          const result = await pollGrok2ApiDeviceAuthorization(
            config.baseUrl,
            accessToken,
            sessionId,
            fetchImpl
          );
          if (result.status === 'admin_unauthorized') {
            await addLog('grok2api 管理员会话已过期，正在重新登录后继续确认设备授权。', 'info', { nodeId });
            accessToken = (await loginGrok2Api(
              config.baseUrl,
              config.adminUsername,
              config.adminPassword,
              fetchImpl
            )).accessToken;
            continue;
          }
          if (result.status === 'pending') {
            await wait(intervalSeconds * 1000, sleepWithStop);
            continue;
          }
          if (result.status === 'slow_down') {
            intervalSeconds += 5;
            await wait(intervalSeconds * 1000, sleepWithStop);
            continue;
          }
          if (result.status === 'expired') {
            throw new Error('grok2api 设备授权已拒绝或过期，请重新执行步骤。');
          }
          if (result.status === 'succeeded' || result.status === 'syncFailed') {
            const completedAt = Date.now();
            const message = result.status === 'syncFailed'
              ? '账号已接入，但初始同步失败'
              : (result.accountName ? `已接入账号 ${result.accountName}` : '账号已接入');
            const payload = await applyDeviceState(await getState(), {
              status: 'authorized',
              sessionId: '',
              userCode: deviceAuthorization.userCode,
              verificationUri: deviceAuthorization.verificationUri,
              expiresAt,
              intervalSeconds,
              completedAt,
              message,
            });
            await addLog(`${message}。`, 'ok', { nodeId });
            await completeNodeFromBackground(nodeId, payload);
            return;
          }
          throw new Error(`grok2api 返回了未知设备授权状态：${result.status}`);
        }
        throw new Error('grok2api 设备授权已过期，请重新执行“获取并打开 Grok Build 授权链接”。');
      } catch (error) {
        const message = getErrorMessage(error);
        const latestState = await getState();
        await applyDeviceState(latestState, {
          ...(readGrokRuntime(latestState).deviceAuth || {}),
          status: /过期|expired/i.test(message) ? 'expired' : 'error',
          message,
        });
        await addLog(`完成 Grok Build 授权失败：${message}`, 'error', { nodeId });
        throw error;
      }
    }

    return {
      executeGrokCompleteGrok2ApiDeviceAuth,
      executeGrokStartGrok2ApiDeviceAuth,
      executeGrokUploadSsoToGrok2Api,
    };
  }

  return {
    buildGrok2ApiEndpoint,
    buildGrok2ApiWebSsoImportBody,
    createGrok2ApiPublisher,
    loginGrok2Api,
    normalizeGrok2ApiBaseUrl,
    pollGrok2ApiDeviceAuthorization,
    startGrok2ApiDeviceAuthorization,
    testGrok2ApiConnection,
    uploadGrokSsoToGrok2ApiWeb,
  };
});
