const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('manual Grok email step syncs the panel email and forwards it to the node', () => {
  const source = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');
  const handlerStart = source.indexOf("if (nodeId === 'grok-submit-email')");
  const handlerEnd = source.indexOf("} else if (nodeId === 'fill-password')", handlerStart);
  const handler = source.slice(handlerStart, handlerEnd);

  assert.notEqual(handlerStart, -1);
  assert.notEqual(handlerEnd, -1);
  assert.match(handler, /fetchGeneratedEmail\(\{ showFailureToast: false \}\)/);
  assert.match(handler, /await setRuntimeEmailState\(email\)/);
  assert.match(handler, /payload: \{ nodeId, email \}/);
});

test('generated panel email synchronizes background state without waiting for a change event', () => {
  const source = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');
  const fetchStart = source.indexOf('async function fetchGeneratedEmail');
  const fetchEnd = source.indexOf('function syncToggleButtonLabel', fetchStart);
  const fetchGenerated = source.slice(fetchStart, fetchEnd);

  assert.match(fetchGenerated, /inputEmail\.value = response\.email;/);
  assert.match(fetchGenerated, /await setRuntimeEmailState\(response\.email\);/);
  assert.match(fetchGenerated, /syncLatestState\(\{ email: response\.email \}\)/);
});
