const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('background imports auto-run controller module', () => {
  const source = fs.readFileSync('background.js', 'utf8');
  assert.match(source, /background\/auto-run-controller\.js/);
  assert.match(source, /buildFreshAutoRunKeepState/);
});

test('manifest grants Chrome notification permission', () => {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  assert.equal(
    Array.isArray(manifest.permissions) && manifest.permissions.includes('notifications'),
    true
  );
});

test('auto-run controller module exposes a factory', () => {
  const source = fs.readFileSync('background/auto-run-controller.js', 'utf8');
  const globalScope = {};

  const api = new Function('self', `${source}; return self.MultiPageBackgroundAutoRunController;`)(globalScope);

  assert.equal(typeof api?.createAutoRunController, 'function');
});

test('auto-run account record status preserves the real failed node instead of parsing guidance text', () => {
  const source = fs.readFileSync('background/auto-run-controller.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundAutoRunController;`)(globalScope);
  const controller = api.createAutoRunController({});

  const state = {
    currentNodeId: 'fetch-login-code',
    nodeStatuses: {
      'submit-signup-email': 'completed',
      'oauth-login': 'completed',
      'fetch-login-code': 'failed',
    },
  };
  const error = new Error('缺少登录账号：请先完成步骤 2，或在侧栏填写账号后再执行当前步骤。');

  assert.equal(
    controller.resolveAutoRunAccountRecordStatus('failed', state, error),
    'node:fetch-login-code:failed'
  );

  error.failedNodeId = 'platform-verify';
  assert.equal(
    controller.resolveAutoRunAccountRecordStatus('failed', state, error),
    'node:platform-verify:failed'
  );
});

test('auto-run controller notifies on unhandled crash', async () => {
  const source = fs.readFileSync('background/auto-run-controller.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundAutoRunController;`)(globalScope);
  const events = {
    logs: [],
    notifications: [],
    statuses: [],
  };
  const runtimeState = {
    autoRunActive: true,
    autoRunCurrentRun: 2,
    autoRunTotalRuns: 5,
    autoRunAttemptRun: 1,
    autoRunSessionId: 99,
  };
  const controller = api.createAutoRunController({
    addLog: async (message, level = 'info') => events.logs.push({ message, level }),
    broadcastAutoRunStatus: async (phase, payload, patch) => events.statuses.push({ phase, payload, patch }),
    clearStopRequest: () => {},
    getAutoRunStatusPayload: (phase, payload) => ({ phase, ...payload }),
    getErrorMessage: (error) => error?.message || String(error || ''),
    isStopError: () => false,
    notifyChromeNotification: async (payload) => {
      events.notifications.push(payload);
      return true;
    },
    runtime: {
      get: () => ({ ...runtimeState }),
      set: (updates) => Object.assign(runtimeState, updates),
    },
  });

  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    await controller.handleAutoRunLoopUnhandledError(new Error('boom'));
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(events.logs.some(({ message, level }) => level === 'error' && /boom/.test(message)), true);
  assert.deepStrictEqual(events.notifications, [
    {
      title: 'FlowPilot 自动运行异常终止',
      message: 'boom',
      priority: 2,
      requireInteraction: true,
    },
  ]);
  assert.equal(events.statuses[0].phase, 'stopped');
  assert.equal(runtimeState.autoRunActive, false);
});

test('auto-run controller notifies after all rounds finish', async () => {
  const source = fs.readFileSync('background/auto-run-controller.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundAutoRunController;`)(globalScope);
  const events = {
    logs: [],
    notifications: [],
    statuses: [],
  };
  const runtimeState = {
    autoRunActive: false,
    autoRunCurrentRun: 0,
    autoRunTotalRuns: 0,
    autoRunAttemptRun: 0,
    autoRunSessionId: 0,
  };
  let state = {
    nodeStatuses: {},
  };
  const controller = api.createAutoRunController({
    addLog: async (message, level = 'info') => events.logs.push({ message, level }),
    broadcastAutoRunStatus: async (phase, payload) => events.statuses.push({ phase, payload }),
    buildFreshAutoRunKeepState: () => ({}),
    clearStopRequest: () => {},
    createAutoRunSessionId: () => 101,
    getAutoRunStatusPayload: (phase, payload) => ({ autoRunPhase: phase, ...payload }),
    getErrorMessage: (error) => error?.message || String(error || ''),
    getFirstUnfinishedNodeId: () => 'only-node',
    getNodeIdsForState: () => ['only-node'],
    getPendingAutoRunTimerPlan: () => null,
    getRunningNodeIds: () => [],
    getState: async () => state,
    getStopRequested: () => false,
    hasSavedNodeProgress: () => false,
    isStopError: () => false,
    normalizeAutoRunFallbackThreadIntervalMinutes: () => 0,
    notifyChromeNotification: async (payload) => {
      events.notifications.push(payload);
      return true;
    },
    resetState: async () => {
      state = { nodeStatuses: {} };
    },
    runAutoSequenceFromNode: async () => {
      state.nodeStatuses = { 'only-node': 'completed' };
    },
    runtime: {
      get: () => ({ ...runtimeState }),
      set: (updates) => Object.assign(runtimeState, updates),
    },
    setState: async (patch) => {
      state = { ...state, ...patch };
    },
    sleepWithStop: async () => {},
    throwIfAutoRunSessionStopped: () => {},
    waitForRunningNodesToFinish: async () => state,
    chrome: {
      runtime: {
        sendMessage: () => Promise.resolve(),
      },
    },
  });

  await controller.autoRunLoop(1);

  assert.deepStrictEqual(events.notifications, [
    {
      title: 'FlowPilot 自动运行完成',
      message: '全部 1 轮已完成。',
      priority: 1,
      requireInteraction: false,
    },
  ]);
  assert.equal(events.statuses.some(({ phase }) => phase === 'complete'), true);
});
