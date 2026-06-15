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

  function decodeSmsBowerMailText(value = '') {
    return String(value || '')
      .replace(/\\\//g, '/')
      .replace(/&amp;/gi, '&')
      .replace(/&#x3D;/gi, '=')
      .replace(/&#61;/g, '=')
      .replace(/&quot;/gi, '"')
      .replace(/&#34;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  function collectSmsBowerMailPayloadStrings(value, output = [], seen = new Set()) {
    if (value === null || value === undefined) return output;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      const text = decodeSmsBowerMailText(value);
      if (text) output.push(text);
      return output;
    }
    if (typeof value !== 'object' || seen.has(value)) return output;
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((entry) => collectSmsBowerMailPayloadStrings(entry, output, seen));
      return output;
    }
    const priorityKeys = [
      'link',
      'url',
      'loginLink',
      'login_link',
      'magicLink',
      'magic_link',
      'activationLink',
      'activation_link',
      'verificationLink',
      'verification_link',
      'code',
      'message',
      'msg',
      'text',
      'body',
      'html',
      'content',
      'data',
      'mail',
      'email',
    ];
    priorityKeys.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        collectSmsBowerMailPayloadStrings(value[key], output, seen);
      }
    });
    Object.entries(value).forEach(([key, entryValue]) => {
      if (!priorityKeys.includes(key)) {
        collectSmsBowerMailPayloadStrings(entryValue, output, seen);
      }
    });
    return output;
  }

  function normalizeSmsBowerMailLinkCandidate(rawValue = '') {
    const candidate = decodeSmsBowerMailText(rawValue)
      .replace(/[)\].,;!?]+$/g, '')
      .trim();
    if (!candidate) return '';
    try {
      return new URL(candidate).toString();
    } catch {
      return '';
    }
  }

  function extractSmsBowerMailLinks(payload = {}) {
    const strings = collectSmsBowerMailPayloadStrings(payload);
    const links = [];
    const seen = new Set();
    strings.forEach((text) => {
      const matches = decodeSmsBowerMailText(text).match(/https?:\/\/[^\s"'<>]+/gi) || [];
      matches.forEach((match) => {
        const link = normalizeSmsBowerMailLinkCandidate(match);
        const key = link.toLowerCase();
        if (link && !seen.has(key)) {
          seen.add(key);
          links.push(link);
        }
      });
    });
    return links;
  }

  function extractSmsBowerMailLink(payload = {}, options = {}) {
    const links = extractSmsBowerMailLinks(payload);
    const hostFilters = Array.isArray(options.hostFilters)
      ? options.hostFilters.map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean)
      : [];
    if (!hostFilters.length) {
      return links[0] || '';
    }
    return links.find((link) => {
      try {
        const hostname = new URL(link).hostname.toLowerCase();
        return hostFilters.some((filter) => hostname === filter || hostname.endsWith(`.${filter}`));
      } catch {
        return false;
      }
    }) || '';
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
    extractSmsBowerMailLink,
    extractSmsBowerMailLinks,
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
