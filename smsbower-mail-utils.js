(function smsbowerMailUtilsModule(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
    return;
  }

  root.SmsBowerMailUtils = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createSmsBowerMailUtils() {
  const SMSBOWER_MAIL_PROVIDER = 'smsbower-mail';
  const DEFAULT_SMSBOWER_MAIL_BASE_URL = 'https://smsbower.page/api/mail';
  const DEFAULT_SMSBOWER_MAIL_SERVICE_CODE = 'dr';
  const DEFAULT_SMSBOWER_MAIL_DOMAIN = 'gmail.com';
  const DEFAULT_SMSBOWER_MAIL_MAX_PRICE = '0.134';
  const SMSBOWER_MAIL_DOMAINS = Object.freeze([
    'gmail.com',
    'mailnestpro.com',
    'hihinail.com',
    'flytempbox.com',
    'mailburstx.com',
  ]);

  function firstNonEmptyString(values) {
    for (const value of values) {
      if (value === undefined || value === null) continue;
      const normalized = String(value).trim();
      if (normalized) return normalized;
    }
    return '';
  }

  function normalizeSmsBowerMailBaseUrl(value = '') {
    const raw = String(value || '').trim() || DEFAULT_SMSBOWER_MAIL_BASE_URL;
    const candidate = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(raw) ? raw : `https://${raw}`;
    try {
      const parsed = new URL(candidate);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return DEFAULT_SMSBOWER_MAIL_BASE_URL;
      }
      parsed.hash = '';
      parsed.search = '';
      parsed.pathname = (parsed.pathname === '/' ? '/api/mail' : parsed.pathname).replace(/\/+$/, '');
      return parsed.toString().replace(/\/$/, '');
    } catch {
      return DEFAULT_SMSBOWER_MAIL_BASE_URL;
    }
  }

  function normalizeSmsBowerMailApiKey(value = '') {
    return String(value || '').trim();
  }

  function normalizeSmsBowerMailAddress(value = '') {
    return String(value || '').trim().toLowerCase();
  }

  function normalizeSmsBowerMailServiceCode(value = '', fallback = DEFAULT_SMSBOWER_MAIL_SERVICE_CODE) {
    const normalized = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '');
    if (normalized) return normalized;
    return String(fallback || DEFAULT_SMSBOWER_MAIL_SERVICE_CODE)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '') || DEFAULT_SMSBOWER_MAIL_SERVICE_CODE;
  }

  function normalizeSmsBowerMailDomain(value = '') {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return DEFAULT_SMSBOWER_MAIL_DOMAIN;
    return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized) ? normalized : DEFAULT_SMSBOWER_MAIL_DOMAIN;
  }

  function normalizeSmsBowerMailMaxPrice(value = '') {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const numeric = Number(raw);
    if (!Number.isFinite(numeric) || numeric <= 0) return '';
    return String(Math.round(numeric * 10000) / 10000);
  }

  function normalizeSmsBowerMailAlias(value = '') {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized === '1' || normalized === 'true' || normalized === 'yes') return '1';
    if (normalized === '0' || normalized === 'false' || normalized === 'no') return '0';
    return '';
  }

  function joinSmsBowerMailUrl(baseUrl, path, params = {}) {
    const normalizedBase = normalizeSmsBowerMailBaseUrl(baseUrl);
    const normalizedPath = String(path || '').trim();
    const url = new URL(`${normalizedBase}${normalizedPath.startsWith('/') ? '' : '/'}${normalizedPath}`);
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      url.searchParams.set(key, String(value));
    });
    return url.toString();
  }

  function parseSmsBowerMailPayload(text = '') {
    const trimmed = String(text || '').trim();
    if (!trimmed) return {};
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }

  function describeSmsBowerMailPayload(payload) {
    if (typeof payload === 'string') return payload.trim();
    if (payload && typeof payload === 'object') {
      const direct = firstNonEmptyString([
        payload.error,
        payload.message,
        payload.msg,
        payload.statusText,
        payload.status,
      ]);
      if (direct) return direct;
      try {
        return JSON.stringify(payload);
      } catch {
        return String(payload);
      }
    }
    return String(payload || '').trim();
  }

  function normalizeSmsBowerMailActivation(payload = {}) {
    const safePayload = payload && typeof payload === 'object' ? payload : {};
    return {
      id: firstNonEmptyString([safePayload.mailId, safePayload.mail_id, safePayload.id]),
      address: normalizeSmsBowerMailAddress(firstNonEmptyString([
        safePayload.mail,
        safePayload.email,
        safePayload.address,
      ])),
      service: normalizeSmsBowerMailServiceCode(safePayload.service),
      domain: normalizeSmsBowerMailDomain(safePayload.domain),
      status: firstNonEmptyString([safePayload.status]),
      createdAt: firstNonEmptyString([safePayload.createdAt, safePayload.created_at]) || new Date().toISOString(),
      raw: safePayload,
    };
  }

  function normalizeSmsBowerMailCurrentActivation(value = null) {
    if (!value || typeof value !== 'object') return null;
    const activation = normalizeSmsBowerMailActivation(value);
    return activation.id && activation.address ? activation : null;
  }

  function extractSmsBowerMailCode(payload = {}) {
    if (!payload || typeof payload !== 'object') return '';
    return firstNonEmptyString([
      payload.code,
      payload.verificationCode,
      payload.verification_code,
    ]);
  }

  function isSmsBowerMailSuccess(payload = {}) {
    return Boolean(payload && typeof payload === 'object' && Number(payload.status) === 1);
  }

  function isSmsBowerMailPendingCode(payload = {}) {
    const text = describeSmsBowerMailPayload(payload);
    return /code has not been received|try again later|not received|wait/i.test(text);
  }

  return {
    DEFAULT_SMSBOWER_MAIL_BASE_URL,
    DEFAULT_SMSBOWER_MAIL_DOMAIN,
    DEFAULT_SMSBOWER_MAIL_MAX_PRICE,
    DEFAULT_SMSBOWER_MAIL_SERVICE_CODE,
    SMSBOWER_MAIL_DOMAINS,
    SMSBOWER_MAIL_PROVIDER,
    describeSmsBowerMailPayload,
    extractSmsBowerMailCode,
    isSmsBowerMailPendingCode,
    isSmsBowerMailSuccess,
    joinSmsBowerMailUrl,
    normalizeSmsBowerMailActivation,
    normalizeSmsBowerMailAddress,
    normalizeSmsBowerMailAlias,
    normalizeSmsBowerMailApiKey,
    normalizeSmsBowerMailBaseUrl,
    normalizeSmsBowerMailCurrentActivation,
    normalizeSmsBowerMailDomain,
    normalizeSmsBowerMailMaxPrice,
    normalizeSmsBowerMailServiceCode,
    parseSmsBowerMailPayload,
  };
});
