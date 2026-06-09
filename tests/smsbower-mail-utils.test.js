const test = require('node:test');
const assert = require('node:assert/strict');

const utils = require('../smsbower-mail-utils.js');

test('normalizeSmsBowerMailBaseUrl defaults to the mail API path', () => {
  assert.equal(utils.normalizeSmsBowerMailBaseUrl(''), 'https://smsbower.page/api/mail');
  assert.equal(utils.normalizeSmsBowerMailBaseUrl('smsbower.page'), 'https://smsbower.page/api/mail');
  assert.equal(utils.normalizeSmsBowerMailBaseUrl('https://smsbower.page/'), 'https://smsbower.page/api/mail');
  assert.equal(utils.normalizeSmsBowerMailBaseUrl('https://smsbower.page/api/mail/'), 'https://smsbower.page/api/mail');
});

test('joinSmsBowerMailUrl appends endpoint and query params', () => {
  const url = utils.joinSmsBowerMailUrl('https://smsbower.page', '/getActivation', {
    api_key: 'key',
    service: 'dr',
    domain: 'gmail.com',
  });
  assert.equal(url, 'https://smsbower.page/api/mail/getActivation?api_key=key&service=dr&domain=gmail.com');
});

test('normalizeSmsBowerMailActivation extracts mail id and address', () => {
  const activation = utils.normalizeSmsBowerMailActivation({
    status: 1,
    mail: 'Fresh@Gmail.Com',
    mailId: 42,
  });
  assert.equal(activation.id, '42');
  assert.equal(activation.address, 'fresh@gmail.com');
});
