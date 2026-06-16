const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('background imports node registry and wires the rebuilt Kiro executors', () => {
  const source = fs.readFileSync('background.js', 'utf8');
  assert.match(source, /core\/flow-kernel\/step-registry\.js/);
  assert.match(source, /data\/step-definitions\.js/);
  assert.match(source, /core\/flow-kernel\/workflow-engine\.js/);
  assert.match(source, /MultiPageStepDefinitions\?\.getNodes/);
  assert.match(source, /buildNodeRegistry\(definitions/);
  assert.match(source, /const stepRegistryCache = new Map\(\);/);
  assert.match(source, /const definitions = getNodeDefinitionsForState\(state\);/);
  assert.match(source, /stepRegistryCache\.set\(cacheKey, buildStepRegistry\(definitions\)\)/);

  assert.match(source, /flows\/kiro\/background\/register-runner\.js/);
  assert.match(source, /flows\/kiro\/background\/desktop-client\.js/);
  assert.match(source, /flows\/kiro\/background\/desktop-authorize-runner\.js/);
  assert.match(source, /flows\/kiro\/background\/publisher-kiro-rs\.js/);
  assert.match(source, /flows\/grok\/background\/state\.js/);
  assert.match(source, /flows\/grok\/background\/register-runner\.js/);
  assert.match(source, /flows\/grok\/background\/publisher-webchat2api\.js/);
  assert.match(source, /flows\/claude\/background\/register-runner\.js/);
  assert.match(source, /flows\/openai\/background\/session-reader\.js/);
  assert.match(source, /flows\/openai\/background\/publisher-webchat\.js/);
  assert.doesNotMatch(source, /background\/steps\/kiro-device-auth\.js/);
  assert.match(source, /extractSmsBowerMailCode,[\s\S]*extractSmsBowerMailLink,[\s\S]*isSmsBowerMailPendingCode/);

  assert.match(source, /const kiroRegisterRunner = self\.MultiPageBackgroundKiroRegisterRunner\?\.createKiroRegisterRunner\(/);
  assert.match(source, /const kiroDesktopAuthorizeRunner = self\.MultiPageBackgroundKiroDesktopAuthorizeRunner\?\.createKiroDesktopAuthorizeRunner\(/);
  assert.match(source, /const kiroPublisher = self\.MultiPageBackgroundKiroPublisherKiroRs\?\.createKiroRsPublisher\(/);
  assert.match(source, /const grokRegisterRunner = self\.MultiPageBackgroundGrokRegisterRunner\?\.createGrokRegisterRunner\(/);
  assert.match(source, /const claudeRegisterRunner = self\.MultiPageBackgroundClaudeRegisterRunner\?\.createClaudeRegisterRunner\(/);
  assert.match(source, /const grokWebchat2ApiPublisher = self\.MultiPageBackgroundGrokPublisherWebchat2Api\?\.createGrokWebchat2ApiPublisher\(/);
  assert.match(source, /const openAiWebchatPublisher = self\.MultiPageBackgroundOpenAiPublisherWebchat\?\.createOpenAiWebchatPublisher\(/);

  assert.match(source, /'kiro-open-register-page': \(state\) => kiroRegisterRunner\.executeKiroOpenRegisterPage\(state\)/);
  assert.match(source, /'kiro-submit-email': \(state\) => kiroRegisterRunner\.executeKiroSubmitEmail\(state\)/);
  assert.match(source, /'kiro-submit-name': \(state\) => kiroRegisterRunner\.executeKiroSubmitName\(state\)/);
  assert.match(source, /'kiro-submit-verification-code': \(state\) => kiroRegisterRunner\.executeKiroSubmitVerificationCode\(state\)/);
  assert.match(source, /'kiro-submit-password': \(state\) => kiroRegisterRunner\.executeKiroSubmitPassword\(state\)/);
  assert.match(source, /'kiro-complete-register-consent': \(state\) => kiroRegisterRunner\.executeKiroCompleteRegisterConsent\(state\)/);
  assert.match(source, /'kiro-start-desktop-authorize': \(state\) => kiroDesktopAuthorizeRunner\.executeKiroStartDesktopAuthorize\(state\)/);
  assert.match(source, /'kiro-complete-desktop-authorize': \(state\) => kiroDesktopAuthorizeRunner\.executeKiroCompleteDesktopAuthorize\(state\)/);
  assert.match(source, /'kiro-upload-credential': \(state\) => kiroPublisher\.executeKiroUploadCredential\(state\)/);
  assert.match(source, /'grok-open-signup-page': \(state\) => grokRegisterRunner\.executeGrokOpenSignupPage\(state\)/);
  assert.match(source, /'grok-submit-email': \(state\) => grokRegisterRunner\.executeGrokSubmitEmail\(state\)/);
  assert.match(source, /'grok-submit-verification-code': \(state\) => grokRegisterRunner\.executeGrokSubmitVerificationCode\(state\)/);
  assert.match(source, /'grok-submit-profile': \(state\) => grokRegisterRunner\.executeGrokSubmitProfile\(state\)/);
  assert.match(source, /'grok-extract-sso-cookie': \(state\) => grokRegisterRunner\.executeGrokExtractSsoCookie\(state\)/);
  assert.match(source, /'grok-upload-sso-to-webchat2api': \(state\) => grokWebchat2ApiPublisher\.executeGrokUploadSsoToWebchat2Api\(state\)/);
  assert.match(source, /'claude-open-official-page': \(state\) => claudeRegisterRunner\.executeClaudeOpenOfficialPage\(state\)/);
  assert.match(source, /'claude-wait-official-page': \(state\) => claudeRegisterRunner\.executeClaudeWaitOfficialPageLoaded\(state\)/);
  assert.match(source, /'claude-fill-email': \(state\) => claudeRegisterRunner\.executeClaudeFillEmail\(state\)/);
  assert.match(source, /'claude-submit-email-and-fetch-link': \(state\) => claudeRegisterRunner\.executeClaudeSubmitEmailAndFetchLink\(state\)/);
  assert.match(source, /'claude-open-login-link': \(state\) => claudeRegisterRunner\.executeClaudeOpenLoginLink\(state\)/);
  assert.match(source, /'claude-create-account': \(state\) => claudeRegisterRunner\.executeClaudeCreateAccount\(state\)/);
  assert.match(source, /'claude-select-free-plan': \(state\) => claudeRegisterRunner\.executeClaudeSelectFreePlan\(state\)/);
  assert.match(source, /'claude-skip-onboarding': \(state\) => claudeRegisterRunner\.executeClaudeSkipOnboarding\(state\)/);
  assert.match(source, /'claude-continue-onboarding': \(state\) => claudeRegisterRunner\.executeClaudeContinueOnboarding\(state\)/);
  assert.match(source, /'claude-submit-random-name': \(state\) => claudeRegisterRunner\.executeClaudeSubmitRandomName\(state\)/);
  assert.match(source, /'claude-set-up-later': \(state\) => claudeRegisterRunner\.executeClaudeSetUpLater\(state\)/);
  assert.match(source, /'claude-extract-session-key': \(state\) => claudeRegisterRunner\.executeClaudeExtractSessionKey\(state\)/);
  assert.match(source, /'openai-upload-session-to-webchat': \(state\) => openAiWebchatPublisher\.executeOpenAiUploadSessionToWebchat\(state\)/);

  assert.match(
    source,
    /'kiro-open-register-page',[\s\S]*'kiro-submit-email',[\s\S]*'kiro-submit-name',[\s\S]*'kiro-submit-verification-code',[\s\S]*'kiro-submit-password',[\s\S]*'kiro-complete-register-consent',[\s\S]*'kiro-start-desktop-authorize',[\s\S]*'kiro-complete-desktop-authorize',[\s\S]*'kiro-upload-credential'/
  );
  assert.match(
    source,
    /'grok-open-signup-page',[\s\S]*'grok-submit-email',[\s\S]*'grok-submit-verification-code',[\s\S]*'grok-submit-profile',[\s\S]*'grok-extract-sso-cookie',[\s\S]*'grok-upload-sso-to-webchat2api'/
  );
  assert.match(
    source,
    /'claude-open-official-page',[\s\S]*'claude-wait-official-page',[\s\S]*'claude-fill-email',[\s\S]*'claude-submit-email-and-fetch-link',[\s\S]*'claude-open-login-link',[\s\S]*'claude-create-account',[\s\S]*'claude-select-free-plan',[\s\S]*'claude-skip-onboarding',[\s\S]*'claude-continue-onboarding',[\s\S]*'claude-submit-random-name',[\s\S]*'claude-set-up-later',[\s\S]*'claude-extract-session-key'/
  );
  assert.match(source, /'openai-upload-session-to-webchat'/);
});

test('background no longer wires removed payment executors or OTP helpers', () => {
  const source = fs.readFileSync('background.js', 'utf8');
  assert.doesNotMatch(source, /create[A-Z][A-Za-z]+ApproveExecutor\(\{[\s\S]*request[A-Z][A-Za-z]+OtpInput/);
  assert.doesNotMatch(source, /REQUEST_[A-Z]+_OTP_INPUT/);
});
