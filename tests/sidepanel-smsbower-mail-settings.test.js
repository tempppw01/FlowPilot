const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('SMSBower TempMail settings can collapse independently', () => {
  const html = fs.readFileSync('sidepanel/sidepanel.html', 'utf8');
  const source = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');
  const css = fs.readFileSync('sidepanel/sidepanel.css', 'utf8');

  assert.match(html, /id="btn-toggle-smsbower-mail-section"/);
  assert.match(html, /aria-controls="smsbower-mail-settings-body"/);
  assert.match(html, /id="smsbower-mail-settings-body"/);
  assert.match(html, /id="input-smsbower-mail-api-key"/);
  assert.match(html, /id="input-smsbower-mail-max-price"/);

  assert.match(source, /const btnToggleSmsBowerMailSection = document\.getElementById\('btn-toggle-smsbower-mail-section'\)/);
  assert.match(source, /const smsbowerMailSettingsBody = document\.getElementById\('smsbower-mail-settings-body'\)/);
  assert.match(source, /SMSBOWER_MAIL_SECTION_EXPANDED_STORAGE_KEY/);
  assert.match(source, /function updateSmsBowerMailSectionCollapseUI\(\)/);
  assert.match(source, /smsbowerMailSettingsBody\.hidden = !expanded/);
  assert.match(source, /btnToggleSmsBowerMailSection\.textContent = expanded \? '收起设置' : '展开设置'/);
  assert.match(source, /btnToggleSmsBowerMailSection\?\.addEventListener\('click', \(\) => \{\s*toggleSmsBowerMailSectionExpanded\(\);\s*\}\);/);
  assert.match(source, /initSmsBowerMailSectionExpandedState\(\)/);
  assert.match(source, /updateSmsBowerMailSectionCollapseUI\(\);/);

  assert.match(css, /\.smsbower-mail-settings-body\s*\{[\s\S]*flex-direction:\s*column;[\s\S]*gap:\s*8px;/);
});
