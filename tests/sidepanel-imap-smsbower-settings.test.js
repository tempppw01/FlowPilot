const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('side panel exposes IMAP helper settings and connection test', () => {
  const html = fs.readFileSync('sidepanel/sidepanel.html', 'utf8');
  const source = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');
  const helperSource = fs.readFileSync('scripts/custom_mail_helper.py', 'utf8');

  assert.match(html, /<option value="imap">IMAP 邮箱/);
  assert.match(html, /id="select-imap-preset"/);
  assert.match(html, /id="input-imap-host"/);
  assert.match(html, /id="input-imap-password"/);
  assert.match(html, /id="input-imap-code-wait-seconds"[^>]*min="60"/);
  assert.match(html, /id="input-imap-verification-resend-count"/);
  assert.match(html, /id="btn-test-imap-connection"/);
  assert.match(html, /id="btn-save-imap-settings"/);
  assert.match(html, /start-custom-mail-helper\.command/);
  assert.match(source, /imapHelperBaseUrl:/);
  assert.match(source, /imapPassword:/);
  assert.match(source, /imapCodeWaitSeconds:/);
  assert.match(source, /imapVerificationResendCount:/);
  assert.match(source, /btnTestImapConnection\?\.addEventListener\('click'/);
  assert.match(source, /btnSaveImapSettings\?\.addEventListener\('click'/);
  assert.match(source, /btnMailLogin\.style\.display = useImap \? 'none' : ''/);
  assert.match(source, /new URL\('\/test'/);
  assert.match(source, /无法连接本机 helper/);
  assert.match(helperSource, /send_netease_imap_client_id/);
  assert.match(helperSource, /无法打开 IMAP 邮箱夹/);
});

test('side panel exposes SMSBower random, priority, and fixed country modes', () => {
  const html = fs.readFileSync('sidepanel/sidepanel.html', 'utf8');
  const source = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');

  assert.match(html, /id="btn-smsbower-refresh-catalog"/);
  assert.match(html, /id="btn-smsbower-api-docs"/);
  assert.match(html, /id="btn-smsbower-fixed-country-menu"/);
  assert.match(html, /id="btn-smsbower-provider-menu"/);
  assert.match(html, /id="select-smsbower-country-mode"/);
  assert.match(html, /id="btn-smsbower-country-mode-random"/);
  assert.match(html, /id="btn-smsbower-country-mode-priority"/);
  assert.match(html, /id="btn-smsbower-country-mode-fixed"/);
  assert.match(html, /id="input-smsbower-fixed-country-id"/);
  assert.match(source, /async function refreshSmsBowerCountryCatalog\(\)/);
  assert.match(source, /provider\.fetchCountryCatalog/);
  assert.match(source, /smsbowerFixedCountryId:/);
  assert.match(source, /smsbowerCountryMode:/);
  assert.match(source, /normalizeSmsBowerCountryModeValue\(/);
  assert.match(source, /message\.payload\.smsbowerCountryMode/);
  assert.match(source, /function updateSmsBowerCountryModeUI\(\)/);
  assert.match(source, /function setSmsBowerCountryMode\(/);
  assert.match(source, /https:\/\/smsbower\.app\/cn\/api\?page=client/);
  assert.match(source, /function renderSmsBowerProviderMenu\(\)/);
  assert.match(source, /function countryCodeToFlag\(/);
  assert.match(html, /data-smsbower-country-mode="random"/);
  assert.match(html, /data-smsbower-country-mode="priority"/);
  assert.match(html, /data-smsbower-country-mode="fixed"/);
});
