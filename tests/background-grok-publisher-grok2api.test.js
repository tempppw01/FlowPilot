const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function loadPublisherApi() {
  const stateSource = fs.readFileSync('flows/grok/background/state.js', 'utf8');
  const publisherSource = fs.readFileSync('flows/grok/background/publisher-grok2api.js', 'utf8');
  const globalScope = {};
  new Function('self', `${stateSource}; ${publisherSource}; return self;`)(globalScope);
  return globalScope.MultiPageBackgroundGrokPublisherGrok2Api;
}

function createJsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
    text: async () => JSON.stringify(payload),
  };
}

function createTextResponse(text, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
    text: async () => text,
  };
}

function mergeState(current, updates) {
  return {
    ...current,
    ...updates,
    runtimeState: {
      ...(current.runtimeState || {}),
      ...(updates.runtimeState || {}),
      flowState: {
        ...(current.runtimeState?.flowState || {}),
        ...(updates.runtimeState?.flowState || {}),
      },
    },
  };
}

test('grok2api publisher uses the documented admin device OAuth endpoints', async () => {
  const api = loadPublisherApi();
  const requests = [];

  assert.equal(
    api.buildGrok2ApiEndpoint('https://grok.example.com/api/admin/v1/', '/accounts/device/start'),
    'https://grok.example.com/api/admin/v1/accounts/device/start'
  );

  const login = await api.loginGrok2Api('https://grok.example.com', 'admin', 'secret', async (url, options) => {
    requests.push({ url, options });
    return createJsonResponse({ data: { tokens: { accessToken: 'access-token' } } });
  });
  assert.equal(login.accessToken, 'access-token');
  assert.equal(requests[0].url, 'https://grok.example.com/api/admin/v1/auth/login');
  assert.deepEqual(JSON.parse(requests[0].options.body), { username: 'admin', password: 'secret' });

  const started = await api.startGrok2ApiDeviceAuthorization('https://grok.example.com', login.accessToken, async (url, options) => {
    requests.push({ url, options });
    return createJsonResponse({
      data: {
        sessionId: 'device-session', userCode: 'WGMG-QDFE',
        verificationUriComplete: 'https://accounts.x.ai/oauth2/device?user_code=WGMG-QDFE',
        intervalSeconds: 3, expiresAt: '2030-01-01T00:00:00Z',
      },
    }, 201);
  });
  assert.equal(started.userCode, 'WGMG-QDFE');
  assert.equal(requests[1].options.headers.Authorization, 'Bearer access-token');

  const pending = await api.pollGrok2ApiDeviceAuthorization('https://grok.example.com', login.accessToken, 'device-session', async () => createJsonResponse({ data: { status: 'pending' } }, 202));
  assert.equal(pending.status, 'pending');

  const expiredAdminSession = await api.pollGrok2ApiDeviceAuthorization('https://grok.example.com', login.accessToken, 'device-session', async () => (
    createJsonResponse({ error: { code: 'adminUnauthorized', message: 'token expired' } }, 401)
  ));
  assert.equal(expiredAdminSession.status, 'admin_unauthorized');
});

test('grok2api connection test validates administrator login without exposing its token', async () => {
  const api = loadPublisherApi();
  const requests = [];
  const success = await api.testGrok2ApiConnection('https://grok.example.com', 'admin', 'secret', async (url, options) => {
    requests.push({ url, options });
    return createJsonResponse({ data: { tokens: { accessToken: 'short-lived-access-token' } } });
  });
  assert.deepEqual(success, { ok: true, status: 200, message: 'grok2api 连接正常（HTTP 200）' });
  assert.equal(requests[0].url, 'https://grok.example.com/api/admin/v1/auth/login');
  assert.equal(success.message.includes('short-lived-access-token'), false);

  const rejected = await api.testGrok2ApiConnection('https://grok.example.com', 'admin', 'wrong', async () => (
    createJsonResponse({ error: { message: 'invalid credentials' } }, 401)
  ));
  assert.equal(rejected.ok, false);
  assert.equal(rejected.status, 401);
  assert.match(rejected.message, /账号或密码被拒绝/);
});

test('grok2api publisher imports an extracted SSO as a Web credential file', async () => {
  const api = loadPublisherApi();
  const requests = [];
  const result = await api.uploadGrokSsoToGrok2ApiWeb(
    'https://grok.example.com',
    'access-token',
    'sso-cookie-value',
    async (url, options) => {
      requests.push({ url, options });
      return createJsonResponse({ data: { created: 1, updated: 0, skipped: 0, synced: 1, syncFailed: 0 } }, 201);
    }
  );

  assert.equal(requests[0].url, 'https://grok.example.com/api/admin/v1/accounts/web/import');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer access-token');
  assert.equal(requests[0].options.headers['Content-Type'], undefined);
  const uploadedFile = requests[0].options.body.get('files');
  assert.equal(uploadedFile.name, 'grok-web-sso-tokens.txt');
  assert.equal(await uploadedFile.text(), 'sso-cookie-value');
  assert.match(result.message, /创建 1/);
});

test('grok2api Web SSO importer accepts the SSE task response used by current grok2api', async () => {
  const api = loadPublisherApi();
  const result = await api.uploadGrokSsoToGrok2ApiWeb(
    'https://grok.example.com',
    'access-token',
    'sso-cookie-value',
    async (_url, options) => {
      assert.equal(options.headers.Accept, 'text/event-stream, application/json');
      return createTextResponse([
        ': connected',
        '',
        'event: progress',
        'data: {"completed":1,"total":1,"phase":"importing"}',
        '',
        'event: complete',
        'data: {"created":1,"updated":0,"synced":1,"syncFailed":0}',
        '',
      ].join('\n'));
    }
  );

  assert.match(result.message, /创建 1/);
  assert.match(result.message, /同步成功 1/);
});

test('grok2api Web SSO importer surfaces an SSE task error', async () => {
  const api = loadPublisherApi();

  await assert.rejects(
    () => api.uploadGrokSsoToGrok2ApiWeb(
      'https://grok.example.com',
      'access-token',
      'sso-cookie-value',
      async () => createTextResponse('event: error\ndata: {"code":"authImportFailed","message":"导入账号失败"}\n\n')
    ),
    /grok2api Web SSO 上传失败：导入账号失败/
  );
});

test('grok2api Web SSO executor completes with its own upload runtime state', async () => {
  const api = loadPublisherApi();
  const completed = [];
  let requestIndex = 0;
  let liveState = {
    settingsState: {
      flows: {
        grok: {
          targets: {
            grok2api: {
              baseUrl: 'https://grok.example.com', adminUsername: 'admin', adminPassword: 'admin-secret',
            },
          },
        },
      },
    },
    runtimeState: { flowState: { grok: { sso: { currentCookie: 'sso-cookie-value' } } } },
  };
  const publisher = api.createGrok2ApiPublisher({
    completeNodeFromBackground: async (nodeId, payload) => completed.push({ nodeId, payload }),
    fetchImpl: async () => {
      requestIndex += 1;
      if (requestIndex === 1) return createJsonResponse({ data: { tokens: { accessToken: 'short-lived-access-token' } } });
      return createJsonResponse({ data: { created: 1, updated: 0, skipped: 0, synced: 1, syncFailed: 0 } }, 201);
    },
    getState: async () => liveState,
    setState: async (updates) => { liveState = mergeState(liveState, updates); },
  });

  await publisher.executeGrokUploadSsoToGrok2Api({ nodeId: 'grok-upload-sso-to-grok2api' });

  assert.equal(completed.length, 1);
  assert.equal(completed[0].nodeId, 'grok-upload-sso-to-grok2api');
  assert.equal(completed[0].payload.runtimeState.flowState.grok.grok2ApiUpload.status, 'uploaded');
});

test('grok2api device authorization opens the xAI link before registration and completes later', async () => {
  const api = loadPublisherApi();
  const logs = [];
  const openedTabs = [];
  const completed = [];
  const cookieClearCalls = [];
  let requestIndex = 0;
  let liveState = {
    settingsState: {
      flows: {
        grok: {
          targets: {
            grok2api: {
              baseUrl: 'https://grok.example.com', adminUsername: 'admin', adminPassword: 'admin-secret',
            },
          },
        },
      },
    },
  };
  const publisher = api.createGrok2ApiPublisher({
    addLog: async (message) => logs.push(message),
    clearGrokCookies: async (options) => cookieClearCalls.push(options),
    reuseOrCreateTab: async (_source, url, options) => {
      openedTabs.push({ url, options });
      return 42;
    },
    registerTab: async (source, tabId) => openedTabs.push({ source, tabId }),
    completeNodeFromBackground: async (nodeId, payload) => completed.push({ nodeId, payload }),
    fetchImpl: async () => {
      requestIndex += 1;
      if (requestIndex === 1) return createJsonResponse({ data: { tokens: { accessToken: 'short-lived-access-token' } } });
      if (requestIndex === 2) return createJsonResponse({
        data: {
          sessionId: 'session-1', userCode: 'WGMG-QDFE',
          verificationUriComplete: 'https://accounts.x.ai/oauth2/device?user_code=WGMG-QDFE',
          intervalSeconds: 1, expiresAt: '2030-01-01T00:00:00Z',
        },
      }, 201);
      throw new Error('轮询不应在启动设备授权时执行');
    },
    getState: async () => liveState,
    setState: async (updates) => { liveState = mergeState(liveState, updates); },
    sleepWithStop: async () => {},
  });

  await publisher.executeGrokStartGrok2ApiDeviceAuth({ nodeId: 'grok-start-grok2api-device-auth' });

  assert.deepEqual(cookieClearCalls, [{ nodeId: 'grok-start-grok2api-device-auth', label: '步骤 1' }]);
  assert.deepEqual(openedTabs, [
    {
      url: 'https://accounts.x.ai/oauth2/device?user_code=WGMG-QDFE',
      options: { inject: null, injectSource: 'grok-register-page' },
    },
    { source: 'grok-register-page', tabId: 42 },
  ]);
  assert.equal(completed.length, 1);
  assert.equal(completed[0].nodeId, 'grok-start-grok2api-device-auth');
  assert.equal(completed[0].payload.runtimeState.flowState.grok.deviceAuth.status, 'awaiting_authorization');
  assert.equal(completed[0].payload.runtimeState.flowState.grok.deviceAuth.sessionId, 'session-1');
  assert.equal(completed[0].payload.runtimeState.flowState.grok.session.registerTabId, 42);
  assert.equal(logs.some((message) => message.includes('admin-secret') || message.includes('short-lived-access-token')), false);
});

test('grok2api device authorization completion reauthenticates and clears the device session', async () => {
  const api = loadPublisherApi();
  const completed = [];
  let requestIndex = 0;
  let liveState = {
    settingsState: {
      flows: {
        grok: {
          targets: {
            grok2api: {
              baseUrl: 'https://grok.example.com', adminUsername: 'admin', adminPassword: 'admin-secret',
            },
          },
        },
      },
    },
    runtimeState: {
      flowState: {
        grok: {
          deviceAuth: {
            status: 'awaiting_authorization', sessionId: 'session-1', userCode: 'WGMG-QDFE',
            verificationUri: 'https://accounts.x.ai/oauth2/device?user_code=WGMG-QDFE',
            expiresAt: Date.parse('2030-01-01T00:00:00Z'), intervalSeconds: 1,
          },
        },
      },
    },
  };
  const publisher = api.createGrok2ApiPublisher({
    completeNodeFromBackground: async (nodeId, payload) => completed.push({ nodeId, payload }),
    fetchImpl: async () => {
      requestIndex += 1;
      if (requestIndex === 1) return createJsonResponse({ data: { tokens: { accessToken: 'short-lived-access-token' } } });
      return createJsonResponse({ data: { status: 'succeeded', account: { credential: { name: 'test@example.com' } } } });
    },
    getState: async () => liveState,
    setState: async (updates) => { liveState = mergeState(liveState, updates); },
  });

  await publisher.executeGrokCompleteGrok2ApiDeviceAuth({ nodeId: 'grok-complete-grok2api-device-auth' });

  assert.equal(completed.length, 1);
  assert.equal(completed[0].nodeId, 'grok-complete-grok2api-device-auth');
  assert.equal(completed[0].payload.runtimeState.flowState.grok.deviceAuth.status, 'authorized');
  assert.equal(completed[0].payload.runtimeState.flowState.grok.deviceAuth.sessionId, '');
});

test('grok2api device authorization completion refreshes an expired admin token while polling', async () => {
  const api = loadPublisherApi();
  const completed = [];
  let requestIndex = 0;
  let liveState = {
    settingsState: {
      flows: {
        grok: {
          targets: {
            grok2api: {
              baseUrl: 'https://grok.example.com', adminUsername: 'admin', adminPassword: 'admin-secret',
            },
          },
        },
      },
    },
    runtimeState: {
      flowState: {
        grok: {
          deviceAuth: {
            status: 'awaiting_authorization', sessionId: 'session-1', userCode: 'WGMG-QDFE',
            verificationUri: 'https://accounts.x.ai/oauth2/device?user_code=WGMG-QDFE',
            expiresAt: Date.parse('2030-01-01T00:00:00Z'), intervalSeconds: 1,
          },
        },
      },
    },
  };
  const publisher = api.createGrok2ApiPublisher({
    completeNodeFromBackground: async (nodeId, payload) => completed.push({ nodeId, payload }),
    fetchImpl: async () => {
      requestIndex += 1;
      if (requestIndex === 1) return createJsonResponse({ data: { tokens: { accessToken: 'expired-token' } } });
      if (requestIndex === 2) return createJsonResponse({ error: { code: 'adminUnauthorized', message: 'token expired' } }, 401);
      if (requestIndex === 3) return createJsonResponse({ data: { tokens: { accessToken: 'fresh-token' } } });
      return createJsonResponse({ data: { status: 'succeeded', account: { credential: { name: 'test@example.com' } } } });
    },
    getState: async () => liveState,
    setState: async (updates) => { liveState = mergeState(liveState, updates); },
  });

  await publisher.executeGrokCompleteGrok2ApiDeviceAuth({ nodeId: 'grok-complete-grok2api-device-auth' });

  assert.equal(requestIndex, 4);
  assert.equal(completed.length, 1);
  assert.equal(completed[0].payload.runtimeState.flowState.grok.deviceAuth.status, 'authorized');
});
