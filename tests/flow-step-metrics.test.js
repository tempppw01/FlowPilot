const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const backgroundSource = fs.readFileSync('background.js', 'utf8');

function extractFunction(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => backgroundSource.indexOf(marker))
    .find((index) => index >= 0);
  if (start < 0) {
    throw new Error(`missing function ${name}`);
  }
  let parenDepth = 0;
  let signatureEnded = false;
  let braceStart = -1;
  for (let i = start; i < backgroundSource.length; i += 1) {
    const ch = backgroundSource[i];
    if (ch === '(') {
      parenDepth += 1;
    } else if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        signatureEnded = true;
      }
    } else if (ch === '{' && signatureEnded) {
      braceStart = i;
      break;
    }
  }
  if (braceStart < 0) {
    throw new Error(`missing body for function ${name}`);
  }
  let depth = 0;
  let end = braceStart;
  for (; end < backgroundSource.length; end += 1) {
    const ch = backgroundSource[end];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }
  return backgroundSource.slice(start, end);
}

function loadMetricApi() {
  return new Function(`
    ${extractFunction('normalizeFlowStepMetricStatus')}
    ${extractFunction('normalizeFlowStepMetricEntry')}
    ${extractFunction('buildNextFlowStepMetricEntry')}
    return {
      normalizeFlowStepMetricStatus,
      normalizeFlowStepMetricEntry,
      buildNextFlowStepMetricEntry,
    };
  `)();
}

test('flow step metrics count terminal outcomes and average successful durations', () => {
  const api = loadMetricApi();
  let entry = api.buildNextFlowStepMetricEntry({}, 'completed', {
    startedAt: 1000,
    finishedAt: 11000,
  });
  entry = api.buildNextFlowStepMetricEntry(entry, 'failed', {
    startedAt: 20000,
    finishedAt: 26000,
  });
  entry = api.buildNextFlowStepMetricEntry(entry, 'stopped', {
    startedAt: 30000,
    finishedAt: 36000,
  });
  entry = api.buildNextFlowStepMetricEntry(entry, 'skipped', {
    finishedAt: 40000,
  });

  assert.equal(entry.successCount, 1);
  assert.equal(entry.failureCount, 1);
  assert.equal(entry.stoppedCount, 1);
  assert.equal(entry.skippedCount, 1);
  assert.equal(entry.total, 3);
  assert.equal(entry.successRate, 33);
  assert.equal(entry.durationSampleCount, 1);
  assert.equal(entry.totalSuccessDurationMs, 10000);
  assert.equal(entry.avgSuccessDurationMs, 10000);
});

test('flow step metrics ignore skipped steps in success-rate denominator', () => {
  const api = loadMetricApi();
  const entry = api.buildNextFlowStepMetricEntry({}, 'manual_completed', {
    finishedAt: 5000,
  });

  assert.equal(entry.skippedCount, 1);
  assert.equal(entry.total, undefined);
  assert.equal(entry.successRate, undefined);
  assert.equal(entry.durationSampleCount, 0);
});

test('flow step metrics accept normalized success status', () => {
  const api = loadMetricApi();
  const entry = api.buildNextFlowStepMetricEntry({}, 'success', {
    startedAt: 1000,
    finishedAt: 4000,
  });

  assert.equal(entry.successCount, 1);
  assert.equal(entry.successRate, 100);
  assert.equal(entry.durationSampleCount, 1);
  assert.equal(entry.avgSuccessDurationMs, 3000);
});
