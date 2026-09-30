(function attachDevinMailRules(root, factory) {
  root.MultiPageDevinMailRules = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createDevinMailRulesModule() {
  const NODE_ID = 'devin-enter-email-code';
  const CODE_PATTERNS = Object.freeze([
    Object.freeze({ source: '(?:verification|security|login|one.time)?\\s*code[：:\\s]*(\\d{6})', flags: 'gi' }),
    Object.freeze({ source: '(?:验证码|校验码)[：:\\s]*(\\d{6})', flags: 'g' }),
    Object.freeze({ source: '^\\s*(\\d{6})\\s*$', flags: 'gm' }),
  ]);
  const KEYWORDS = Object.freeze(['devin', 'cognition', 'verification', 'code', '验证码']);
  const SENDERS = Object.freeze(['devin', 'cognition']);
  const SUBJECTS = Object.freeze(['devin', 'cognition', 'verification', 'code', '验证码']);
  function clean(value) { return String(value ?? '').trim(); }
  function createDevinMailRules(deps = {}) {
    const { LUCKMAIL_PROVIDER = 'luckmail-api', MAIL_2925_VERIFICATION_INTERVAL_MS = 15000, MAIL_2925_VERIFICATION_MAX_ATTEMPTS = 15 } = deps;
    function getRuleDefinitionForNode(nodeId, state = {}) {
      if (clean(nodeId) !== NODE_ID) throw new Error(`Devin 邮件规则不支持节点：${clean(nodeId)}`);
      const provider = clean(state.mailProvider).toLowerCase();
      const isLuckmail = provider === clean(LUCKMAIL_PROVIDER).toLowerCase();
      const is2925 = provider === '2925';
      const email = clean(state.devinEmail || state.email).toLowerCase();
      return {
        flowId: 'devin', ruleId: NODE_ID, nodeId: NODE_ID, step: 4, artifactType: 'code',
        codePatterns: CODE_PATTERNS, filterAfterTimestamp: 0, requiredKeywords: KEYWORDS,
        senderFilters: SENDERS, subjectFilters: SUBJECTS, targetEmail: email,
        targetEmailHints: email ? [email] : [],
        mail2925MatchTargetEmail: is2925 && clean(state.mail2925Mode).toLowerCase() === 'receive',
        maxAttempts: isLuckmail ? 3 : (is2925 ? MAIL_2925_VERIFICATION_MAX_ATTEMPTS : 5),
        intervalMs: isLuckmail ? 15000 : (is2925 ? MAIL_2925_VERIFICATION_INTERVAL_MS : 5000),
      };
    }
    return {
      getRuleDefinitionForNode,
      getRuleDefinition: (_input, state = {}) => getRuleDefinitionForNode(NODE_ID, state),
      buildVerificationPollPayloadForNode: (nodeId, state = {}, overrides = {}) => ({ ...getRuleDefinitionForNode(nodeId, state), ...overrides }),
      buildVerificationPollPayload: (input, state = {}, overrides = {}) => ({ ...getRuleDefinitionForNode(input?.nodeId || NODE_ID, state), ...overrides }),
    };
  }
  return { createDevinMailRules };
});
