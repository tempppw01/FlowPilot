(function attachTokenHarborMailRules(root, factory) {
  root.MultiPageTokenHarborMailRules = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createTokenHarborMailRulesModule() {
  function createTokenHarborMailRules() {
    const nodeId = 'tokenharbor-fetch-verification-link';
    return {
      getRuleDefinitionForNode(requestedNodeId, state = {}) {
        if (String(requestedNodeId || nodeId) !== nodeId) throw new Error(`Token Harbor 邮件规则不支持节点：${requestedNodeId}`);
        const email = String(state.tokenHarborEmail || state.email || '').trim().toLowerCase();
        return { flowId: 'tokenharbor', ruleId: nodeId, nodeId, step: 3, artifactType: 'link', codePatterns: [], requiredKeywords: ['token harbor', 'verify', 'email'], senderFilters: ['tokenharbor'], subjectFilters: ['verify', 'token harbor'], targetEmail: email, targetEmailHints: email ? [email] : [], maxAttempts: 30, intervalMs: 5000 };
      },
      getRuleDefinition: (_input, state = {}) => createTokenHarborMailRules().getRuleDefinitionForNode(nodeId, state),
      buildVerificationPollPayloadForNode: (requestedNodeId, state = {}, overrides = {}) => ({ ...createTokenHarborMailRules().getRuleDefinitionForNode(requestedNodeId, state), ...overrides }),
      buildVerificationPollPayload: (_input, state = {}, overrides = {}) => ({ ...createTokenHarborMailRules().getRuleDefinitionForNode(nodeId, state), ...overrides }),
    };
  }
  return { createTokenHarborMailRules };
});
