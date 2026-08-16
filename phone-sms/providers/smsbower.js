// phone-sms/providers/smsbower.js - SMSBower phone SMS provider adapter
(function attachSmsBowerProvider(root, factory) {
  root.PhoneSmsBowerProvider = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createSmsBowerProviderModule() {
  const PROVIDER_ID = 'smsbower';
  const DEFAULT_BASE_URL = 'https://smsbower.page/stubs/handler_api.php';
  const DEFAULT_SERVICE_CODE = 'dr';
  const DEFAULT_SERVICE_LABEL = 'OpenAI';
  const DEFAULT_COUNTRY_ID = 187;
  const DEFAULT_COUNTRY_LABEL = 'USA';
  const DEFAULT_PROVIDER_IDS = '3193';
  const LEGACY_DEFAULT_PROVIDER_IDS = '3170';
  const LEGACY_USA_DEFAULT_PROVIDER_IDS = '3170,2495';
  const DEFAULT_MAX_PRICE = '0.12';
  const COUNTRY_MODE_PRIORITY = 'priority';
  const COUNTRY_MODE_FIXED = 'fixed';
  const MAX_PRICE_CAP = 0.12;
  const DEFAULT_REQUEST_TIMEOUT_MS = 20000;
  const DEFAULT_ACQUIRE_RETRY_ROUNDS = 3;
  const DEFAULT_ACQUIRE_RETRY_DELAY_MS = 2000;
  const DEFAULT_POLL_TIMEOUT_MS = 180000;
  const DEFAULT_POLL_INTERVAL_MS = 5000;
  const PHONE_CODE_TIMEOUT_ERROR_PREFIX = 'PHONE_CODE_TIMEOUT::';
  const COUNTRY_MAX_PRICE_LIMITS = Object.freeze({
    22: 0.0999,
    151: 0.0999,
  });
  const DEFAULT_COUNTRY_CANDIDATES = Object.freeze([
    { id: 22, label: 'India', providerIds: '3193,2266', providerLines: [
      { id: '3193', rank: 'silver', price: 0.067 },
      { id: '2266', rank: 'gold', price: 0.054 },
    ] },
    { id: 52, label: 'Thailand', providerIds: '2266,3193,3237', providerLines: [
      { id: '2266', rank: 'silver', price: 0.054 },
      { id: '3193', rank: 'silver', price: 0.067 },
    ] },
    { id: 73, label: 'Brazil', providerIds: '3416,3415,3413,3365,3252,3215,2404', providerLines: [
      { id: '3416', rank: 'gold', price: 0.032 },
      { id: '3415', rank: 'gold', price: 0.046 },
      { id: '3413', rank: 'gold', price: 0.048 },
      { id: '3365', rank: 'gold', price: 0.051 },
      { id: '3252', rank: 'gold', price: 0.052 },
      { id: '3215', rank: 'gold', price: 0.054 },
      { id: '2404', rank: 'gold', price: 0.067 },
    ] },
    { id: 48, label: 'Netherlands', providerIds: '2442', providerLines: [{ id: '2442', rank: 'gold', price: 0.006 }] },
    { id: 78, label: 'France', providerIds: '3237', providerLines: [{ id: '3237', rank: 'gold', price: 0.014 }] },
    { id: 6, label: 'Indonesia', providerIds: '3237,3408,2266', providerLines: [
      { id: '3237', rank: 'gold', price: 0.008 },
      { id: '3408', rank: 'gold', price: 0.015 },
      { id: '2266', rank: 'gold', price: 0.054 },
    ] },
    { id: 33, label: 'Colombia', providerIds: '3243,3253,3288,3160', providerLines: [
      { id: '3243', rank: 'gold', price: 0.034 },
      { id: '3253', rank: 'gold', price: 0.039 },
      { id: '3288', rank: 'silver', price: 0.052 },
      { id: '3160', rank: 'bronze', price: 0.054 },
    ] },
    { id: 16, label: 'United Kingdom', providerIds: '3237' },
    { id: 151, label: 'Chile', providerIds: '3350,3109,3235,3419', providerLines: [
      { id: '3350', rank: 'bronze', price: 0.08 },
      { id: '3109', rank: 'gold', price: 0.07 },
      { id: '3235', rank: 'silver', price: 0.067 },
      { id: '3419', rank: 'gold', price: 0.052 },
    ] },
    { id: 31, label: 'South Africa', providerIds: '2812,2266,2217,2649', providerLines: [
      { id: '2812', rank: 'silver', price: 0.043 },
      { id: '2266', rank: 'silver', price: 0.054 },
      { id: '2217', rank: 'silver', price: 0.06 },
    ] },
    { id: 95, label: 'UAE', providerIds: '2266', providerLines: [{ id: '2266', rank: 'gold', price: 0.054 }] },
    { id: 85, label: 'Moldova', providerIds: '2266', providerLines: [{ id: '2266', rank: 'gold', price: 0.054 }] },
    { id: 19, label: 'Nigeria', providerIds: '2266,3193', providerLines: [
      { id: '2266', rank: 'silver', price: 0.054 },
      { id: '3193', rank: 'silver', price: 0.067 },
    ] },
    { id: 10, label: 'Vietnam', providerIds: '2266,2217,3160', providerLines: [
      { id: '2266', rank: 'silver', price: 0.054 },
      { id: '2217', rank: 'silver', price: 0.089 },
    ] },
    { id: 269, label: 'Iceland', providerIds: '2268', providerLines: [{ id: '2268', rank: 'bronze', price: 0.054 }] },
    { id: 160, label: 'Belize', providerIds: '2266', providerLines: [{ id: '2266', rank: 'bronze', price: 0.054 }] },
    { id: 5560, label: 'Tanzania', providerIds: '2268', providerLines: [{ id: '2268', rank: 'bronze', price: 0.054 }] },
    { id: 1099, label: 'Tajikistan', providerIds: '2266', providerLines: [{ id: '2266', rank: 'bronze', price: 0.054 }] },
    { id: 708, label: 'Burundi', providerIds: '2266', providerLines: [{ id: '2266', rank: 'bronze', price: 0.054 }] },
    { id: 976, label: 'Armenia', providerIds: '2266', providerLines: [{ id: '2266', rank: 'bronze', price: 0.054 }] },
    { id: 2058, label: 'Lithuania', providerIds: '2266', providerLines: [{ id: '2266', rank: 'bronze', price: 0.054 }] },
    { id: 3118, label: 'Hong Kong', providerIds: '2266', providerLines: [{ id: '2266', rank: 'bronze', price: 0.054 }] },
    { id: 18397, label: 'Greece', providerIds: '2266', providerLines: [{ id: '2266', rank: 'silver', price: 0.054 }] },
    { id: 43, label: 'Germany', providerIds: '3237' },
    { id: 53, label: 'Saudi Arabia', providerIds: '2377' },
    { id: 54, label: 'Mexico', providerIds: '3193', providerLines: [{ id: '3193', rank: 'gold', price: 0.067 }] },
    { id: 39, label: 'Argentina', providerIds: '2738,3237', providerLines: [{ id: '2738', rank: 'silver', price: 0.067 }] },
    { id: 46, label: 'Sweden', providerIds: '2738' },
    { id: 215, label: 'Kosovo', providerIds: '3370', providerLines: [{ id: '3370', rank: 'bronze', price: 0.084 }] },
    { id: 187, label: 'USA', providerIds: '3193', providerLines: [
      { id: '3193', rank: 'gold', price: 0.064 },
    ] },
  ]);
  const DEFAULT_COUNTRY_LABELS_BY_ID = new Map(DEFAULT_COUNTRY_CANDIDATES.map((entry) => [entry.id, entry.label]));
  const DEFAULT_PROVIDER_IDS_BY_COUNTRY_ID = new Map(DEFAULT_COUNTRY_CANDIDATES.map((entry) => [
    entry.id,
    normalizeSmsBowerProviderIds(entry.providerIds, ''),
  ]));
  const DEFAULT_PROVIDER_LINES_BY_COUNTRY_ID = new Map(DEFAULT_COUNTRY_CANDIDATES.map((entry) => [
    entry.id,
    Array.isArray(entry.providerLines) ? entry.providerLines : [],
  ]));
  const LEGACY_COUNTRY_ID_BY_PROVIDER_ID = new Map();
  DEFAULT_COUNTRY_CANDIDATES.forEach((entry) => {
    normalizeSmsBowerProviderIds(entry.providerIds, '')
      .split(',')
      .filter(Boolean)
      .forEach((providerId) => LEGACY_COUNTRY_ID_BY_PROVIDER_ID.set(providerId, entry.id));
  });
  LEGACY_COUNTRY_ID_BY_PROVIDER_ID.set('3237', 52);
  LEGACY_COUNTRY_ID_BY_PROVIDER_ID.set('2266', 52);
  LEGACY_COUNTRY_ID_BY_PROVIDER_ID.delete('2268');
  const PROVIDER_RANK_WEIGHT = Object.freeze({
    gold: 0,
    silver: 1,
    bronze: 2,
    standard: 3,
  });
  const SUCCESS_WEIGHT_MAX_BONUS = 12;
  const SUCCESS_WEIGHT_RECENT_BONUS = 3;
  const SUCCESS_WEIGHT_RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;
  const COUNTRY_BY_PHONE_PREFIX = Object.freeze([
    { prefix: '1', id: 187, iso: 'US', label: 'USA' },
    { prefix: '66', id: 52, iso: 'TH', label: 'Thailand' },
    { prefix: '84', id: 10, iso: 'VN', label: 'Vietnam' },
    { prefix: '62', id: 6, iso: 'ID', label: 'Indonesia' },
    { prefix: '966', id: 53, iso: 'SA', label: 'Saudi Arabia' },
    { prefix: '234', id: 19, iso: 'NG', label: 'Nigeria' },
    { prefix: '57', id: 33, iso: 'CO', label: 'Colombia' },
    { prefix: '56', id: 151, iso: 'CL', label: 'Chile' },
    { prefix: '55', id: 73, iso: 'BR', label: 'Brazil' },
    { prefix: '27', id: 31, iso: 'ZA', label: 'South Africa' },
    { prefix: '44', id: 16, iso: 'GB', label: 'United Kingdom' },
    { prefix: '54', id: 39, iso: 'AR', label: 'Argentina' },
    { prefix: '46', id: 46, iso: 'SE', label: 'Sweden' },
    { prefix: '49', id: 43, iso: 'DE', label: 'Germany' },
  ]);

  function normalizeSmsBowerCountryId(value, fallback = DEFAULT_COUNTRY_ID) {
    const parsed = Math.floor(Number(value));
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
    const fallbackParsed = Math.floor(Number(fallback));
    if (Number.isFinite(fallbackParsed) && fallbackParsed > 0) {
      return fallbackParsed;
    }
    if (fallbackParsed === 0) {
      return 0;
    }
    return DEFAULT_COUNTRY_ID;
  }

  function resolveFixedCountryId(state = {}) {
    const configuredId = normalizeOptionalSmsBowerCountryId(state?.smsbowerFixedCountryId);
    const rawMode = String(state?.smsbowerCountryMode || '').trim().toLowerCase();
    const mode = rawMode === COUNTRY_MODE_FIXED || rawMode === COUNTRY_MODE_PRIORITY
      ? rawMode
      : (configuredId ? COUNTRY_MODE_FIXED : COUNTRY_MODE_PRIORITY);
    return mode === COUNTRY_MODE_FIXED ? configuredId : 0;
  }

  function normalizeOptionalSmsBowerCountryId(value) {
    const parsed = Math.floor(Number(value));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  function normalizeSmsBowerCountryLabel(value = '', fallback = DEFAULT_COUNTRY_LABEL) {
    return String(value || '').trim() || fallback;
  }

  function normalizeCountryKey(value) {
    const countryId = normalizeSmsBowerCountryId(value, 0);
    return countryId > 0 ? String(countryId) : '';
  }

  function resolveSmsBowerCountryId(value, fallback = DEFAULT_COUNTRY_ID) {
    const countryId = normalizeSmsBowerCountryId(value, 0);
    if (countryId && DEFAULT_PROVIDER_IDS_BY_COUNTRY_ID.has(countryId)) {
      return countryId;
    }
    const legacyCountryId = LEGACY_COUNTRY_ID_BY_PROVIDER_ID.get(String(countryId || '').trim());
    if (legacyCountryId) {
      return legacyCountryId;
    }
    return normalizeSmsBowerCountryId(countryId || fallback, fallback);
  }

  function normalizeSmsBowerServiceCode(value = '', fallback = DEFAULT_SERVICE_CODE) {
    const normalized = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '');
    if (normalized) {
      return normalized;
    }
    const fallbackNormalized = String(fallback || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '');
    return fallbackNormalized || DEFAULT_SERVICE_CODE;
  }

  function normalizeSmsBowerProviderIds(value = '', fallback = DEFAULT_PROVIDER_IDS) {
    const normalized = String(value || '')
      .split(/[\s,，;；|]+/)
      .map((entry) => entry.trim())
      .filter((entry) => /^\d+$/.test(entry))
      .join(',');
    if (normalized) {
      return normalized;
    }
    return String(fallback || '').trim();
  }

  function normalizeSmsBowerPrice(value = '') {
    const rawValue = String(value ?? '').trim();
    if (!rawValue) {
      return '';
    }
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return '';
    }
    return String(Math.round(numeric * 10000) / 10000);
  }

  function getCappedSmsBowerMaxPrice(value = DEFAULT_MAX_PRICE) {
    const maxPriceText = normalizeSmsBowerPrice(value || DEFAULT_MAX_PRICE);
    const maxPrice = maxPriceText ? Number(maxPriceText) : MAX_PRICE_CAP;
    return normalizeSmsBowerPrice(Math.min(maxPrice, MAX_PRICE_CAP)) || DEFAULT_MAX_PRICE;
  }

  function getCountryMaxPriceLimit(countryId) {
    const normalizedCountryId = normalizeSmsBowerCountryId(countryId, 0);
    const limit = Number(COUNTRY_MAX_PRICE_LIMITS[normalizedCountryId]);
    return Number.isFinite(limit) && limit > 0 ? limit : null;
  }

  function getEffectiveMaxPrice(countryId, configuredMaxPrice = DEFAULT_MAX_PRICE) {
    const configured = Number(getCappedSmsBowerMaxPrice(configuredMaxPrice));
    const countryLimit = getCountryMaxPriceLimit(countryId);
    const effective = countryLimit === null ? configured : Math.min(configured, countryLimit);
    return normalizeSmsBowerPrice(effective) || DEFAULT_MAX_PRICE;
  }

  function normalizeSmsBowerCountryOrder(value = []) {
    const source = Array.isArray(value)
      ? value
      : String(value || '')
        .split(/[\r\n,，;；]+/)
        .map((entry) => String(entry || '').trim())
        .filter(Boolean);
    const normalized = [];
    const seen = new Set();
    source.forEach((entry) => {
      let id = 0;
      let label = '';
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        id = resolveSmsBowerCountryId(entry.id ?? entry.countryId ?? entry.country, 0);
        label = String((entry.label ?? entry.countryLabel) || '').trim();
      } else {
        const text = String(entry || '').trim();
        const structured = text.match(/^(\d+)\s*(?:[:|/-]\s*(.+))?$/);
        id = resolveSmsBowerCountryId(structured?.[1] || text, 0);
        label = String(structured?.[2] || '').trim();
      }
      if (!id || seen.has(id)) {
        return;
      }
      seen.add(id);
      normalized.push({ id, label: label || (id === DEFAULT_COUNTRY_ID ? DEFAULT_COUNTRY_LABEL : `Country #${id}`) });
    });
    return normalized.slice(0, 20);
  }

  function normalizeBaseUrl(value = '') {
    const trimmed = String(value || '').trim() || DEFAULT_BASE_URL;
    try {
      return new URL(trimmed).toString();
    } catch {
      return DEFAULT_BASE_URL;
    }
  }

  function buildUrl(config = {}, query = {}) {
    const url = new URL(normalizeBaseUrl(config.baseUrl));
    Object.entries(query || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      url.searchParams.set(key, String(value));
    });
    return url.toString();
  }

  function parsePayload(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) {
      return '';
    }
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }

  function describePayload(raw) {
    if (typeof raw === 'string') {
      return raw.trim();
    }
    if (raw && typeof raw === 'object') {
      const direct = String(raw.message || raw.msg || raw.error || raw.title || raw.status || '').trim();
      if (direct) {
        return direct;
      }
      try {
        return JSON.stringify(raw);
      } catch {
        return String(raw);
      }
    }
    return String(raw || '').trim();
  }

  function isTerminalError(payloadOrMessage) {
    const text = describePayload(payloadOrMessage);
    return /\bBAD_KEY\b|\bINVALID_KEY\b|\bWRONG_KEY\b|\bNO_BALANCE\b|\bNOT_ENOUGH_BALANCE\b|\bBANNED\b|\bBAD_SERVICE\b|\bBAD_ACTION\b/i.test(text);
  }

  function isNoNumbersPayload(payloadOrMessage) {
    const text = describePayload(payloadOrMessage);
    return /\bNO_NUMBERS\b|\bNO_BALANCE_FORWARD\b|\bNO_ACTIVATION\b|no\s+numbers|not\s+available/i.test(text);
  }

  function classifySmsBowerAcquireFailure(payloadOrError) {
    const payload = payloadOrError && typeof payloadOrError === 'object' && Object.prototype.hasOwnProperty.call(payloadOrError, 'payload')
      ? payloadOrError.payload
      : payloadOrError;
    const message = payloadOrError && typeof payloadOrError === 'object' && Object.prototype.hasOwnProperty.call(payloadOrError, 'message')
      ? payloadOrError.message
      : '';
    const payloadText = describePayload(payload);
    const messageText = describePayload(message);
    const combinedText = [payloadText, messageText].filter(Boolean).join(' ').trim();
    const detail = payloadText || messageText || '';

    if (isNoNumbersPayload(payload ?? payloadOrError)) {
      return { reason: '暂无可用号码', detail, isNoNumbers: true, isTerminal: false };
    }
    if (/\bBAD_KEY\b|\bINVALID_KEY\b|\bWRONG_KEY\b/i.test(combinedText)) {
      return { reason: 'API Key 无效', detail, isNoNumbers: false, isTerminal: true };
    }
    if (/\bNO_BALANCE\b|\bNOT_ENOUGH_BALANCE\b|余额不足|insufficient\s+balance|not\s+enough\s+balance/i.test(combinedText)) {
      return { reason: '余额不足', detail, isNoNumbers: false, isTerminal: true };
    }
    if (/timeout|超时|aborterror|etimedout|request\s+timed\s+out/i.test(combinedText)) {
      return { reason: '请求超时', detail, isNoNumbers: false, isTerminal: false };
    }
    if (/failed\s+to\s+fetch|networkerror|network\s+request\s+failed|fetch\s+failed|econnreset|enotfound|eai_again|socket\s+hang\s+up/i.test(combinedText)) {
      return { reason: '网络请求失败', detail, isNoNumbers: false, isTerminal: false };
    }
    if (isTerminalError(combinedText)) {
      return { reason: 'API 返回终止错误', detail, isNoNumbers: false, isTerminal: true };
    }
    return { reason: '获取失败', detail, isNoNumbers: false, isTerminal: false };
  }

  function formatSmsBowerAcquireFailure(countryLabel, countryId, providerIds, payloadOrError) {
    const failure = classifySmsBowerAcquireFailure(payloadOrError);
    const location = `${String(countryLabel || 'Unknown country').trim()}（${String(countryId || '').trim()}）`;
    const statusText = failure.isNoNumbers ? '暂无可用号码' : `获取号码失败：${failure.reason}`;
    const detailText = failure.detail ? `（${failure.detail}）` : '';
    const providerText = providerIds ? `；providerIds=${providerIds}` : '';
    return {
      failure,
      message: `SMSBower ${location}${statusText}${detailText}${providerText}`,
    };
  }

  function resolveConfig(state = {}, deps = {}) {
    const fixedCountryId = resolveFixedCountryId(state);
    const configuredProviderIds = normalizeSmsBowerProviderIds(state?.smsbowerProviderIds, DEFAULT_PROVIDER_IDS);
    const isFixedUsa = fixedCountryId === DEFAULT_COUNTRY_ID;
    return {
      apiKey: String(state?.smsbowerApiKey || '').trim(),
      baseUrl: state?.smsbowerBaseUrl || DEFAULT_BASE_URL,
      serviceCode: normalizeSmsBowerServiceCode(state?.smsbowerServiceCode, DEFAULT_SERVICE_CODE),
      // The legacy USA default must not constrain an unrelated fixed country.
      providerIds: isFixedUsa
        ? DEFAULT_PROVIDER_IDS
        : fixedCountryId
        && fixedCountryId !== DEFAULT_COUNTRY_ID
        && [DEFAULT_PROVIDER_IDS, LEGACY_USA_DEFAULT_PROVIDER_IDS].includes(configuredProviderIds)
        ? ''
        : configuredProviderIds,
      fetchImpl: deps.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null),
      requestTimeoutMs: deps.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS,
    };
  }

  function assertApiKey(config) {
    if (!config.apiKey) {
      throw new Error('SMSBower API Key 缺失，请先在侧边栏保存接码 API Key。');
    }
  }

  async function fetchPayload(config, query, actionLabel = 'SMSBower request') {
    assertApiKey(config);
    if (query.api_key === undefined && config.apiKey) {
      query = { api_key: config.apiKey, ...query };
    }
    if (!config.fetchImpl) {
      throw new Error('SMSBower 网络请求实现不可用。');
    }
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), Number(config.requestTimeoutMs) || DEFAULT_REQUEST_TIMEOUT_MS)
      : null;
    try {
      const response = await config.fetchImpl(buildUrl(config, query), {
        method: 'GET',
        signal: controller?.signal,
      });
      const text = await response.text();
      const payload = parsePayload(text);
      if (!response.ok) {
        const error = new Error(`${actionLabel}失败：${describePayload(payload) || response.status}`);
        error.payload = payload;
        error.status = response.status;
        throw error;
      }
      if (isTerminalError(payload)) {
        const error = new Error(`${actionLabel}失败：${describePayload(payload)}`);
        error.payload = payload;
        throw error;
      }
      return payload;
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error(`${actionLabel}超时。`);
      }
      throw error;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  function resolveDefaultCountryCandidates() {
    return DEFAULT_COUNTRY_CANDIDATES.map((entry) => ({
      id: normalizeSmsBowerCountryId(entry.id, DEFAULT_COUNTRY_ID),
      label: normalizeSmsBowerCountryLabel(entry.label, DEFAULT_COUNTRY_LABEL),
    }));
  }

  function resolveCountryCandidates(state = {}) {
    const fixedCountryId = resolveFixedCountryId(state);
    if (String(state?.smsbowerCountryMode || '').trim().toLowerCase() === COUNTRY_MODE_FIXED && !fixedCountryId) {
      throw new Error('SMSBower 已选择固定国家模式，请先填写有效的固定国家 ID。');
    }
    if (fixedCountryId) {
      return [{
        id: fixedCountryId,
        label: normalizeSmsBowerCountryLabel(state?.smsbowerFixedCountryLabel, `Country #${fixedCountryId}`),
      }];
    }
    const candidates = normalizeSmsBowerCountryOrder(state?.smsbowerCountryOrder);
    if (candidates.length) {
      return candidates.map((entry) => {
        const countryId = normalizeSmsBowerCountryId(
          entry && typeof entry === 'object' && !Array.isArray(entry)
            ? (entry.id ?? entry.countryId ?? entry.country)
            : entry,
          DEFAULT_COUNTRY_ID
        );
        const fallbackLabel = DEFAULT_COUNTRY_LABELS_BY_ID.get(countryId)
          || (countryId === DEFAULT_COUNTRY_ID ? DEFAULT_COUNTRY_LABEL : `Country #${countryId}`);
        const rawLabel = normalizeSmsBowerCountryLabel(
          entry && typeof entry === 'object' && !Array.isArray(entry)
            ? (entry.label ?? entry.countryLabel ?? '')
            : '',
          ''
        );
        return {
          id: countryId,
          label: rawLabel && !/^Country\s+#\d+$/i.test(rawLabel)
            ? rawLabel
            : fallbackLabel,
        };
      });
    }
    return resolveDefaultCountryCandidates();
  }

  function resolveCountryLabel(state = {}, countryId = DEFAULT_COUNTRY_ID) {
    const countryKey = normalizeCountryKey(countryId);
    const matched = resolveCountryCandidates(state)
      .find((entry) => normalizeCountryKey(entry.id) === countryKey);
    return matched?.label || (countryKey === String(DEFAULT_COUNTRY_ID) ? DEFAULT_COUNTRY_LABEL : `Country #${countryKey}`);
  }

  function inferCountryFromPhoneNumber(phoneNumber = '') {
    const digits = String(phoneNumber || '').replace(/\D+/g, '');
    if (!digits) {
      return null;
    }
    const match = COUNTRY_BY_PHONE_PREFIX.find((entry) => digits.startsWith(entry.prefix));
    if (!match) {
      return null;
    }
    return {
      id: normalizeSmsBowerCountryId(match.id, 0),
      iso: match.iso,
      label: normalizeSmsBowerCountryLabel(match.label, `Country #${match.id}`),
    };
  }

  function normalizeActivation(record, fallback = {}) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      return null;
    }
    const activationId = String(record.activationId ?? record.id ?? record.activation ?? '').trim();
    const phoneNumber = String(record.phoneNumber ?? record.number ?? record.phone ?? '').trim();
    if (!activationId || !phoneNumber) {
      return null;
    }
    return {
      activationId,
      phoneNumber,
      provider: PROVIDER_ID,
      serviceCode: normalizeSmsBowerServiceCode(record.serviceCode || fallback.serviceCode, DEFAULT_SERVICE_CODE),
      countryId: normalizeSmsBowerCountryId(record.countryId ?? record.country ?? fallback.countryId, DEFAULT_COUNTRY_ID),
      ...(record.countryLabel || fallback.countryLabel
        ? { countryLabel: normalizeSmsBowerCountryLabel(record.countryLabel, fallback.countryLabel || DEFAULT_COUNTRY_LABEL) }
        : {}),
      ...(record.selectedPrice ?? record.price ?? fallback.selectedPrice
        ? { selectedPrice: normalizeSmsBowerPrice(record.selectedPrice ?? record.price ?? fallback.selectedPrice) }
        : {}),
      ...(record.providerIds || fallback.providerIds
        ? { providerIds: normalizeSmsBowerProviderIds(record.providerIds || fallback.providerIds, '') }
        : {}),
      successfulUses: Math.max(0, Math.floor(Number(record.successfulUses ?? fallback.successfulUses) || 0)),
      maxUses: Math.max(1, Math.floor(Number(record.maxUses ?? fallback.maxUses) || 1)),
    };
  }

  function parseActivationPayload(payload, fallback = {}) {
    const direct = normalizeActivation(payload, fallback);
    if (direct) {
      return direct;
    }
    const text = describePayload(payload);
    const accessNumberMatch = text.match(/^ACCESS_NUMBER:([^:]+):(.+)$/i);
    if (accessNumberMatch) {
      return normalizeActivation({
        activationId: String(accessNumberMatch[1] || '').trim(),
        phoneNumber: String(accessNumberMatch[2] || '').trim(),
        provider: PROVIDER_ID,
      }, fallback);
    }
    return null;
  }

  function resolveActivationCountry(activation = {}, state = {}) {
    const normalizedActivation = normalizeActivation(activation)
      || (activation && typeof activation === 'object' ? activation : {});
    const inferred = inferCountryFromPhoneNumber(normalizedActivation.phoneNumber);
    const rawCountryId = normalizeSmsBowerCountryId(normalizedActivation.countryId, 0);
    const countryId = rawCountryId > 0
      ? rawCountryId
      : normalizeSmsBowerCountryId(inferred?.id, DEFAULT_COUNTRY_ID);
    const matched = resolveCountryCandidates(state)
      .find((entry) => normalizeSmsBowerCountryId(entry.id, 0) === countryId);
    return matched || {
      id: countryId,
      label: normalizeSmsBowerCountryLabel(
        normalizedActivation.countryLabel || inferred?.label,
        countryId === DEFAULT_COUNTRY_ID ? DEFAULT_COUNTRY_LABEL : `Country #${countryId}`
      ),
    };
  }

  function getActivationCountryKey(activation = {}) {
    return normalizeCountryKey(activation?.countryId ?? activation?.country);
  }

  function getActivationPrice(activation = {}) {
    const normalized = normalizeSmsBowerPrice(
      activation?.selectedPrice
      ?? activation?.price
      ?? activation?.maxPrice
    );
    return normalized ? Number(normalized) : null;
  }

  function resolvePriceRange(state = {}) {
    const minPriceText = normalizeSmsBowerPrice(state?.smsbowerMinPrice);
    const maxPriceText = getCappedSmsBowerMaxPrice(state?.smsbowerMaxPrice || DEFAULT_MAX_PRICE);
    const minPriceLimit = minPriceText ? Number(minPriceText) : null;
    const maxPriceLimit = maxPriceText ? Number(maxPriceText) : null;
    return {
      minPriceLimit,
      maxPriceLimit,
      hasMinPriceLimit: minPriceLimit !== null,
      hasMaxPriceLimit: maxPriceLimit !== null,
      invalidRange: minPriceLimit !== null && maxPriceLimit !== null && minPriceLimit > maxPriceLimit,
    };
  }

  function getProviderIdsForCountryOrder(countryOrder = []) {
    const normalizedCountryOrder = Array.isArray(countryOrder) ? countryOrder : [];
    const providerIds = [];
    const seen = new Set();
    normalizedCountryOrder.forEach((entry) => {
      const countryId = resolveSmsBowerCountryId(
        entry && typeof entry === 'object' && !Array.isArray(entry)
          ? (entry.id ?? entry.countryId ?? entry.country)
          : entry,
        0
      );
      if (!countryId) {
        return;
      }
      const providerId = normalizeSmsBowerProviderIds(
        getProviderIdsForCountryId(countryId),
        ''
      );
      if (!providerId || seen.has(providerId)) {
        return;
      }
      providerId.split(',').forEach((entryProviderId) => {
        if (!entryProviderId || seen.has(entryProviderId)) {
          return;
        }
        seen.add(entryProviderId);
        providerIds.push(entryProviderId);
      });
    });
    return providerIds.join(',');
  }

  function getProviderIdsForCountryId(countryId) {
    const normalizedCountryId = resolveSmsBowerCountryId(countryId, 0);
    return normalizeSmsBowerProviderIds(
      DEFAULT_PROVIDER_IDS_BY_COUNTRY_ID.get(normalizedCountryId) || (normalizedCountryId === DEFAULT_COUNTRY_ID ? DEFAULT_PROVIDER_IDS : ''),
      ''
    );
  }

  function hasOnlyAutoSmsBowerProviderIds(providerIds = '', autoProviderIds = '') {
    const configured = normalizeSmsBowerProviderIds(providerIds, '');
    if (!configured) {
      return true;
    }
    if ([DEFAULT_PROVIDER_IDS, LEGACY_DEFAULT_PROVIDER_IDS, LEGACY_USA_DEFAULT_PROVIDER_IDS].includes(configured)) {
      return true;
    }
    const autoSet = new Set(normalizeSmsBowerProviderIds(autoProviderIds, '').split(',').filter(Boolean));
    return configured.split(',').filter(Boolean).every((providerId) => autoSet.has(providerId));
  }

  function splitSmsBowerProviderIds(providerIds = '') {
    return normalizeSmsBowerProviderIds(providerIds, '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  function shuffleSmsBowerItems(items = [], randomFn = Math.random) {
    const next = Array.isArray(items) ? [...items] : [];
    const getRandom = typeof randomFn === 'function' ? randomFn : Math.random;
    for (let index = next.length - 1; index > 0; index -= 1) {
      const randomValue = Math.max(0, Math.min(0.999999, Number(getRandom()) || 0));
      const swapIndex = Math.floor(randomValue * (index + 1));
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }
    return next;
  }

  function normalizeSmsBowerSuccessWeights(value = {}) {
    const normalized = {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return normalized;
    }
    Object.entries(value).forEach(([countryId, providerStats]) => {
      const countryKey = String(countryId || '').trim();
      if (!/^\d+$/.test(countryKey) || !providerStats || typeof providerStats !== 'object' || Array.isArray(providerStats)) {
        return;
      }
      const countryStats = {};
      Object.entries(providerStats).forEach(([providerId, stats]) => {
        const providerKey = normalizeSmsBowerProviderIds(providerId, '');
        if (!providerKey) {
          return;
        }
        const successCount = Math.max(0, Math.floor(Number(
          stats && typeof stats === 'object' && !Array.isArray(stats)
            ? (stats.successCount ?? stats.success ?? stats.count)
            : stats
        ) || 0));
        const lastSuccessAt = Math.max(0, Math.floor(Number(
          stats && typeof stats === 'object' && !Array.isArray(stats)
            ? stats.lastSuccessAt
            : 0
        ) || 0));
        if (successCount > 0 || lastSuccessAt > 0) {
          countryStats[providerKey] = {
            successCount,
            ...(lastSuccessAt ? { lastSuccessAt } : {}),
          };
        }
      });
      if (Object.keys(countryStats).length) {
        normalized[countryKey] = countryStats;
      }
    });
    return normalized;
  }

  function getSmsBowerSuccessWeightBonus(successStats = null, now = Date.now()) {
    if (!successStats || typeof successStats !== 'object') {
      return 0;
    }
    const successCount = Math.max(0, Math.floor(Number(successStats.successCount ?? successStats.success ?? successStats.count) || 0));
    const lastSuccessAt = Math.max(0, Math.floor(Number(successStats.lastSuccessAt) || 0));
    const countBonus = Math.min(SUCCESS_WEIGHT_MAX_BONUS, successCount * 2);
    const recentBonus = lastSuccessAt > 0 && now - lastSuccessAt <= SUCCESS_WEIGHT_RECENT_WINDOW_MS
      ? SUCCESS_WEIGHT_RECENT_BONUS
      : 0;
    return countBonus + recentBonus;
  }

  function getSmsBowerProviderSuccessStats(successWeights = {}, countryId, providerId) {
    const countryKey = String(normalizeSmsBowerCountryId(countryId, 0) || '').trim();
    const providerKey = normalizeSmsBowerProviderIds(providerId, '');
    return countryKey && providerKey ? (successWeights?.[countryKey]?.[providerKey] || null) : null;
  }

  function getSmsBowerCountrySuccessWeightBonus(successWeights = {}, countryId, now = Date.now()) {
    const countryKey = String(normalizeSmsBowerCountryId(countryId, 0) || '').trim();
    const countryStats = countryKey ? successWeights?.[countryKey] : null;
    if (!countryStats || typeof countryStats !== 'object' || Array.isArray(countryStats)) {
      return 0;
    }
    return Object.values(countryStats).reduce((total, stats) => (
      total + getSmsBowerSuccessWeightBonus(stats, now)
    ), 0);
  }

  function weightedShuffleSmsBowerEntries(entries = [], getWeight = () => 1, randomFn = Math.random) {
    const remaining = Array.isArray(entries) ? [...entries] : [];
    const shuffled = [];
    const getRandom = typeof randomFn === 'function' ? randomFn : Math.random;
    while (remaining.length) {
      const weights = remaining.map((entry) => Math.max(1, Number(getWeight(entry)) || 1));
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
      let cursor = Math.max(0, Math.min(0.999999, Number(getRandom()) || 0)) * totalWeight;
      let selectedIndex = 0;
      for (let index = 0; index < weights.length; index += 1) {
        cursor -= weights[index];
        if (cursor < 0) {
          selectedIndex = index;
          break;
        }
      }
      shuffled.push(remaining.splice(selectedIndex, 1)[0]);
    }
    return shuffled;
  }

  function getSmsBowerProviderLineMetadata(countryId, providerId) {
    const normalizedCountryId = resolveSmsBowerCountryId(countryId, 0);
    const normalizedProviderId = normalizeSmsBowerProviderIds(providerId, '');
    const providerLines = DEFAULT_PROVIDER_LINES_BY_COUNTRY_ID.get(normalizedCountryId) || [];
    return providerLines.find((line) => String(line?.id || '').trim() === normalizedProviderId) || null;
  }

  function getSmsBowerProviderRankWeight(rank = '') {
    const normalizedRank = String(rank || '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(PROVIDER_RANK_WEIGHT, normalizedRank)
      ? PROVIDER_RANK_WEIGHT[normalizedRank]
      : 99;
  }

  function orderSmsBowerProviderIdAttempts(countryId, providerIds = [], options = {}) {
    const randomMode = Boolean(options?.randomMode);
    const randomFn = typeof options?.randomFn === 'function' ? options.randomFn : Math.random;
    const successWeights = normalizeSmsBowerSuccessWeights(options?.successWeights);
    const now = Math.max(0, Math.floor(Number(options?.now) || Date.now()));
    const entries = (Array.isArray(providerIds) ? providerIds : [])
      .map((providerId, index) => {
        const metadata = getSmsBowerProviderLineMetadata(countryId, providerId);
        const price = Number(metadata?.price);
        const successStats = getSmsBowerProviderSuccessStats(successWeights, countryId, providerId);
        return {
          providerId,
          index,
          rankWeight: getSmsBowerProviderRankWeight(metadata?.rank),
          price: Number.isFinite(price) ? price : Number.POSITIVE_INFINITY,
          successWeight: 1 + getSmsBowerSuccessWeightBonus(successStats, now),
        };
      });
    const rankWeights = [...new Set(entries.map((entry) => entry.rankWeight))].sort((left, right) => left - right);
    return rankWeights.flatMap((rankWeight) => {
      const rankedEntries = entries.filter((entry) => entry.rankWeight === rankWeight);
      if (randomMode && rankedEntries.length > 1) {
        return weightedShuffleSmsBowerEntries(
          rankedEntries,
          (entry) => entry.successWeight,
          randomFn
        ).map((entry) => entry.providerId);
      }
      return rankedEntries
        .sort((left, right) => {
          if (left.price !== right.price) {
            return left.price - right.price;
          }
          return left.index - right.index;
        })
        .map((entry) => entry.providerId);
    });
  }

  function shouldUseSmsBowerRandomMode(state = {}) {
    return Boolean(state?.smsbowerRandomMode);
  }

  function resolveSmsBowerRandomCountryCandidates(countryCandidates = [], randomFn = Math.random, successWeights = {}) {
    const candidates = countryCandidates.length ? countryCandidates : DEFAULT_COUNTRY_CANDIDATES;
    const normalizedSuccessWeights = normalizeSmsBowerSuccessWeights(successWeights);
    const now = Date.now();
    return weightedShuffleSmsBowerEntries(
      candidates,
      (entry) => 1 + getSmsBowerCountrySuccessWeightBonus(normalizedSuccessWeights, entry?.id, now),
      randomFn
    );
  }

  function normalizeBlockedProviderIds(value = []) {
    const source = Array.isArray(value) ? value : String(value || '').split(/[\r\n,]+/);
    const blocked = new Set();
    source.forEach((entry) => {
      const text = String(entry || '').trim();
      if (!text) {
        return;
      }
      const scopedMatch = text.match(/^(\d+)\s*:\s*(\d+)$/);
      if (scopedMatch) {
        blocked.add(`${Math.floor(Number(scopedMatch[1]) || 0)}:${scopedMatch[2]}`);
        return;
      }
      const providerId = normalizeSmsBowerProviderIds(text, '');
      if (providerId) {
        blocked.add(providerId);
      }
    });
    return blocked;
  }

  function isSmsBowerProviderIdBlocked(blockedProviderIds, countryId, providerId) {
    const normalizedProviderId = normalizeSmsBowerProviderIds(providerId, '');
    if (!normalizedProviderId) {
      return false;
    }
    return blockedProviderIds.has(normalizedProviderId)
      || blockedProviderIds.has(`${normalizeSmsBowerCountryId(countryId, 0)}:${normalizedProviderId}`);
  }

  function formatPriceRangeText(minPriceLimit = null, maxPriceLimit = null) {
    const minPrice = normalizeSmsBowerPrice(minPriceLimit);
    const maxPrice = normalizeSmsBowerPrice(maxPriceLimit);
    if (minPrice && maxPrice) {
      return `${minPrice}~${maxPrice}`;
    }
    if (minPrice) {
      return `${minPrice}~`;
    }
    if (maxPrice) {
      return `~${maxPrice}`;
    }
    return 'unbounded';
  }

  function normalizeSmsBowerPriceNumber(value) {
    const parsed = Number(String(value ?? '').trim().replace(/[$,\s]+/g, ''));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return Math.round(parsed * 10000) / 10000;
  }

  function normalizeSmsBowerCountNumber(value) {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const parsed = Math.floor(Number(value));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  function normalizeSmsBowerPriceEntry(value = {}, context = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    const price = normalizeSmsBowerPriceNumber(
      value.price ?? value.cost ?? value.rate ?? value.amount
    );
    if (!price) {
      return null;
    }
    const providerId = normalizeSmsBowerProviderIds(
      value.provider_id ?? value.providerId ?? value.provider ?? value.id ?? context.providerId ?? '',
      ''
    );
    return {
      countryId: normalizeSmsBowerCountryId(value.country ?? value.countryId ?? context.countryId, 0),
      serviceCode: normalizeSmsBowerServiceCode(value.service ?? value.serviceCode ?? context.serviceCode, DEFAULT_SERVICE_CODE),
      ...(providerId ? { providerId } : {}),
      price,
      count: normalizeSmsBowerCountNumber(value.count ?? value.quantity ?? value.qty ?? value.available),
      raw: value,
    };
  }

  function collectSmsBowerPriceEntries(payload, context = {}, entries = []) {
    if (Array.isArray(payload)) {
      payload.forEach((item) => collectSmsBowerPriceEntries(item, context, entries));
      return entries;
    }
    if (!payload || typeof payload !== 'object') {
      return entries;
    }

    const direct = normalizeSmsBowerPriceEntry(payload, context);
    if (direct) {
      entries.push(direct);
    }

    Object.entries(payload).forEach(([key, value]) => {
      const nextContext = { ...context };
      if (/^\d+$/.test(String(key))) {
        if (value && typeof value === 'object' && !Array.isArray(value)
          && (Object.prototype.hasOwnProperty.call(value, 'price') || Object.prototype.hasOwnProperty.call(value, 'cost'))) {
          nextContext.providerId = key;
        } else if (!nextContext.countryId) {
          nextContext.countryId = Math.floor(Number(key));
        } else {
          nextContext.providerId = key;
        }
      } else if (String(key || '').trim().toLowerCase() === String(context.serviceCode || DEFAULT_SERVICE_CODE).toLowerCase()) {
        nextContext.serviceCode = key;
      }
      collectSmsBowerPriceEntries(value, nextContext, entries);
    });
    return entries;
  }

  function dedupeSmsBowerPriceEntries(entries = []) {
    const deduped = new Map();
    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      const price = normalizeSmsBowerPriceNumber(entry?.price);
      if (!price) {
        return;
      }
      const providerId = normalizeSmsBowerProviderIds(entry?.providerId, '');
      const countryId = normalizeSmsBowerCountryId(entry?.countryId, 0);
      const serviceCode = normalizeSmsBowerServiceCode(entry?.serviceCode, DEFAULT_SERVICE_CODE);
      const key = `${countryId}:${serviceCode}:${providerId}:${price}`;
      const count = normalizeSmsBowerCountNumber(entry?.count);
      const previous = deduped.get(key);
      deduped.set(key, {
        countryId,
        serviceCode,
        ...(providerId ? { providerId } : {}),
        price,
        count: previous
          ? Math.max(Number(previous.count) || 0, Number(count) || 0)
          : count,
      });
    });
    return Array.from(deduped.values()).sort((left, right) => {
      if (left.price !== right.price) {
        return left.price - right.price;
      }
      return String(left.providerId || '').localeCompare(String(right.providerId || ''), 'en');
    });
  }

  function summarizeSmsBowerPriceRange(entries = []) {
    const prices = (Array.isArray(entries) ? entries : [])
      .map((entry) => normalizeSmsBowerPriceNumber(entry?.price))
      .filter((price) => Number.isFinite(price) && price > 0)
      .sort((left, right) => left - right);
    if (!prices.length) {
      return { minPrice: null, maxPrice: null, prices: [] };
    }
    return {
      minPrice: prices[0],
      maxPrice: prices[prices.length - 1],
      prices: Array.from(new Set(prices)),
    };
  }

  async function fetchBalance(state = {}, deps = {}) {
    const config = resolveConfig(state, deps);
    const payload = await fetchPayload(config, { action: 'getBalance' }, 'SMSBower getBalance');
    const balance = Number(String(describePayload(payload)).replace(/^ACCESS_BALANCE:/i, '').trim());
    return { balance, raw: payload };
  }

  async function fetchPricePayloadWithFallback(config, queryBase = {}, actions = []) {
    let lastError = null;
    for (const action of actions) {
      try {
        const payload = await fetchPayload(config, {
          ...queryBase,
          action,
        }, `SMSBower ${action}`);
        return { action, payload };
      } catch (error) {
        lastError = error;
        const text = describePayload(error?.payload || error?.message || error);
        if (/\bBAD_ACTION\b/i.test(text)) {
          continue;
        }
        throw error;
      }
    }
    if (lastError) {
      throw lastError;
    }
    throw new Error('SMSBower price lookup failed.');
  }

  async function fetchPrices(state = {}, countryConfig = resolveCountryCandidates(state)[0], deps = {}) {
    const config = resolveConfig(state, deps);
    const countryId = normalizeSmsBowerCountryId(countryConfig?.id, DEFAULT_COUNTRY_ID);
    const { action, payload } = await fetchPricePayloadWithFallback(config, {
      service: config.serviceCode,
      country: countryId,
    }, ['getPricesV3', 'getPricesV2', 'getPrices']);
    const entries = dedupeSmsBowerPriceEntries(collectSmsBowerPriceEntries(payload, {
      countryId,
      serviceCode: config.serviceCode,
    }));
    return {
      action,
      countryId,
      serviceCode: config.serviceCode,
      entries,
      priceRange: summarizeSmsBowerPriceRange(entries),
      raw: payload,
    };
  }

  async function fetchPriceRange(state = {}, countryConfig = resolveCountryCandidates(state)[0], deps = {}) {
    const prices = await fetchPrices(state, countryConfig, deps);
    return {
      countryId: prices.countryId,
      serviceCode: prices.serviceCode,
      ...prices.priceRange,
      entries: prices.entries,
      raw: prices.raw,
      action: prices.action,
    };
  }

  function collectSmsBowerCountryNames(payload, names = {}) {
    if (!payload || typeof payload !== 'object') {
      return names;
    }
    if (Array.isArray(payload)) {
      payload.forEach((value) => collectSmsBowerCountryNames(value, names));
      return names;
    }
    Object.entries(payload).forEach(([key, value]) => {
      const countryId = normalizeSmsBowerCountryId(
        value && typeof value === 'object'
          ? (value.id ?? value.countryId ?? value.country_id ?? key)
          : key,
        0
      );
      if (countryId) {
        const label = typeof value === 'string'
          ? value
          : String(value?.chn || value?.name || value?.title || value?.country || value?.eng || value?.rus || '').trim();
        if (label) {
          names[countryId] = label;
        }
      }
      if (value && typeof value === 'object') {
        collectSmsBowerCountryNames(value, names);
      }
    });
    return names;
  }

  async function fetchCountryCatalog(state = {}, deps = {}) {
    const config = resolveConfig(state, deps);
    let countryPayload = null;
    try {
      countryPayload = (await fetchPricePayloadWithFallback(config, {}, ['getCountries', 'getCountriesV2'])).payload;
    } catch {
      // Some upstreams do not expose a country endpoint; prices still carry usable IDs.
    }
    const { action, payload } = await fetchPricePayloadWithFallback(config, {
      service: config.serviceCode,
    }, ['getPricesV3', 'getPricesV2', 'getPrices']);
    const countryNames = collectSmsBowerCountryNames(countryPayload);
    const grouped = new Map();
    dedupeSmsBowerPriceEntries(collectSmsBowerPriceEntries(payload, {
      serviceCode: config.serviceCode,
    })).forEach((entry) => {
      const countryId = normalizeSmsBowerCountryId(entry.countryId, 0);
      if (!countryId) return;
      const countryMaxPrice = getCountryMaxPriceLimit(countryId);
      if (countryMaxPrice !== null && entry.price >= countryMaxPrice) return;
      const current = grouped.get(countryId) || {
        id: countryId,
        label: countryNames[countryId] || `Country #${countryId}`,
        providerIds: [],
        lines: [],
        price: null,
        count: 0,
      };
      if (entry.providerId && !current.providerIds.includes(entry.providerId)) current.providerIds.push(entry.providerId);
      if (entry.providerId) {
        const existingLine = current.lines.find((line) => line.providerId === entry.providerId);
        if (existingLine) {
          existingLine.price = Math.min(existingLine.price, entry.price);
          existingLine.count = Math.max(existingLine.count, Number(entry.count) || 0);
        } else {
          current.lines.push({
            providerId: entry.providerId,
            price: entry.price,
            count: Number.isFinite(entry.count) ? entry.count : 0,
          });
        }
      }
      if (current.price === null || entry.price < current.price) current.price = entry.price;
      if (Number.isFinite(entry.count)) current.count += entry.count;
      grouped.set(countryId, current);
    });
    return {
      action,
      countries: Array.from(grouped.values())
        .map((entry) => ({
          ...entry,
          providerIds: entry.providerIds.join(','),
          lines: entry.lines.sort((left, right) => (left.price - right.price) || left.providerId.localeCompare(right.providerId)),
        }))
        .sort((left, right) => (left.price ?? Number.MAX_SAFE_INTEGER) - (right.price ?? Number.MAX_SAFE_INTEGER)),
      raw: payload,
    };
  }

  async function requestActivation(state = {}, options = {}, deps = {}) {
    const config = resolveConfig(state, deps);
    const configuredCountryCandidates = resolveCountryCandidates(state);
    const randomMode = shouldUseSmsBowerRandomMode(state);
    const allCountryCandidates = randomMode
      ? resolveDefaultCountryCandidates()
      : configuredCountryCandidates;
    const randomFn = typeof deps.randomFn === 'function' ? deps.randomFn : Math.random;
    if (!allCountryCandidates.length) {
      throw new Error('步骤 9：SMSBower 未选择国家，请先在接码设置中至少选择 1 个国家。');
    }
    const blockedCountryIds = new Set(
      (Array.isArray(options?.blockedCountryIds) ? options.blockedCountryIds : [])
        .map((value) => normalizeSmsBowerCountryId(value, 0))
        .filter((id) => id > 0)
    );
    const blockedProviderIds = normalizeBlockedProviderIds(options?.blockedProviderIds);
    let countryCandidates = allCountryCandidates.filter(
      (entry) => !blockedCountryIds.has(normalizeSmsBowerCountryId(entry.id, 0))
    );
    if (!countryCandidates.length) {
      countryCandidates = allCountryCandidates;
      if (blockedCountryIds.size && typeof deps.addLog === 'function') {
        await deps.addLog('步骤 9：SMSBower 已选国家均达到临时失败跳过阈值，本轮解除跳过并重新尝试。', 'warn');
      }
    }
    if (randomMode) {
      countryCandidates = resolveSmsBowerRandomCountryCandidates(
        countryCandidates,
        randomFn,
        state?.smsbowerSuccessWeightsByCountry
      );
    }
    const priceRange = resolvePriceRange(state);
    if (priceRange.invalidRange) {
      throw new Error(`SMSBower 价格区间无效：最低购买价 ${priceRange.minPriceLimit} 高于价格上限 ${priceRange.maxPriceLimit}。`);
    }
    const fixedCountryId = resolveFixedCountryId(state);
    const autoProviderIds = getProviderIdsForCountryOrder(countryCandidates)
      || (fixedCountryId ? '' : DEFAULT_PROVIDER_IDS);
    const useManualProviderIds = Boolean(state?.smsbowerProviderIdsManual)
      || !hasOnlyAutoSmsBowerProviderIds(config.providerIds, autoProviderIds);
    const resolvedProviderIds = useManualProviderIds
      ? config.providerIds
      : autoProviderIds;
    const getCountryProviderIdAttempts = (countryConfig) => {
      const countryId = normalizeSmsBowerCountryId(countryConfig?.id, DEFAULT_COUNTRY_ID);
      const countryProviderIds = useManualProviderIds
        ? resolvedProviderIds
        : (getProviderIdsForCountryId(countryId) || resolvedProviderIds);
      return splitSmsBowerProviderIds(countryProviderIds);
    };
    const hasProviderIdCandidates = countryCandidates.some((countryConfig) => (
      getCountryProviderIdAttempts(countryConfig).length > 0
    ));
    const hasUnblockedProviderIdCandidates = countryCandidates.some((countryConfig) => {
      const countryId = normalizeSmsBowerCountryId(countryConfig?.id, DEFAULT_COUNTRY_ID);
      return getCountryProviderIdAttempts(countryConfig)
        .some((providerId) => !isSmsBowerProviderIdBlocked(blockedProviderIds, countryId, providerId));
    });
    const effectiveBlockedProviderIds = new Set(blockedProviderIds);
    if (hasProviderIdCandidates && !hasUnblockedProviderIdCandidates) {
      effectiveBlockedProviderIds.clear();
      if (blockedProviderIds.size && typeof deps.addLog === 'function') {
        await deps.addLog('步骤 9：SMSBower 所有候选线路均达到临时失败跳过阈值，本轮解除线路跳过并重新尝试。', 'warn');
      }
    }
    const maxAcquireRounds = Math.max(1, Math.min(10, Math.floor(Number(state?.smsbowerActivationRetryRounds) || DEFAULT_ACQUIRE_RETRY_ROUNDS)));
    const retryDelayMs = Math.max(500, Math.min(30000, Math.floor(Number(state?.smsbowerActivationRetryDelayMs) || DEFAULT_ACQUIRE_RETRY_DELAY_MS)));
    const configuredMaxPrice = getCappedSmsBowerMaxPrice(state?.smsbowerMaxPrice || DEFAULT_MAX_PRICE);
    let finalNoNumbersByCountry = [];
    let finalLastError = null;

    for (let round = 1; round <= maxAcquireRounds; round += 1) {
      if (maxAcquireRounds > 1 && typeof deps.addLog === 'function') {
        await deps.addLog(`步骤 9：SMSBower 正在获取手机号（第 ${round}/${maxAcquireRounds} 轮）...`, 'info');
      }
      const noNumbersByCountry = [];
      for (const countryConfig of countryCandidates) {
        deps.throwIfStopped?.();
        const countryId = normalizeSmsBowerCountryId(countryConfig?.id, DEFAULT_COUNTRY_ID);
        const countryLabel = normalizeSmsBowerCountryLabel(countryConfig?.label, `Country #${countryId}`);
        const providerIdAttempts = getCountryProviderIdAttempts(countryConfig);
        const lineAttempts = orderSmsBowerProviderIdAttempts(
          countryId,
          providerIdAttempts.filter((providerId) => !isSmsBowerProviderIdBlocked(effectiveBlockedProviderIds, countryId, providerId)),
          { randomMode, randomFn, successWeights: state?.smsbowerSuccessWeightsByCountry }
        );
        if (providerIdAttempts.length && !lineAttempts.length) {
          noNumbersByCountry.push(`${countryLabel} (${countryId}) all providerIds skipped after SMS timeouts: ${providerIdAttempts.join(',')}`);
          continue;
        }
        if (!providerIdAttempts.length) {
          lineAttempts.push('');
        }

        for (const providerIdAttempt of lineAttempts) {
          const countryAttempt = (payloadOrError) => formatSmsBowerAcquireFailure(countryLabel, countryId, providerIdAttempt, payloadOrError);
          try {
            const query = {
              action: 'getNumber',
              service: config.serviceCode,
              country: countryId,
            };
            if (providerIdAttempt) {
              query.providerIds = providerIdAttempt;
            }
            const maxPrice = getEffectiveMaxPrice(countryId, configuredMaxPrice);
            if (maxPrice) {
              query.maxPrice = maxPrice;
            }
            const payload = await fetchPayload(config, query, 'SMSBower getNumber');
            const activation = parseActivationPayload(payload, {
              countryId,
              countryLabel,
              serviceCode: config.serviceCode,
              selectedPrice: maxPrice,
              providerIds: providerIdAttempt,
            });
            if (activation) {
              return activation;
            }

            const failure = countryAttempt(payload);
            const failureSummary = failure.message.startsWith('SMSBower ')
              ? failure.message.slice(9)
              : failure.message;
            if (failure.failure.isNoNumbers) {
              noNumbersByCountry.push(failureSummary);
              if (typeof deps.addLog === 'function') {
                await deps.addLog(`步骤 9：${failure.message}`, 'warn');
              }
              continue;
            }

            finalLastError = new Error(failure.message);
            finalLastError.countryId = countryId;
            finalLastError.countryLabel = countryLabel;
            finalLastError.providerIds = providerIdAttempt;
            finalLastError.failureReason = failure.failure.reason;
            if (typeof deps.addLog === 'function') {
              await deps.addLog(`步骤 9：${failure.message}`, 'warn');
            }
          } catch (error) {
            const failure = countryAttempt(error);
            const failureSummary = failure.message.startsWith('SMSBower ')
              ? failure.message.slice(9)
              : failure.message;
            if (failure.failure.isNoNumbers || isNoNumbersPayload(error?.payload || error?.message)) {
              noNumbersByCountry.push(failureSummary);
              if (typeof deps.addLog === 'function') {
                await deps.addLog(`步骤 9：${failure.message}`, 'warn');
              }
              continue;
            }

            finalLastError = new Error(failure.message);
            finalLastError.cause = error;
            finalLastError.payload = error?.payload;
            finalLastError.status = error?.status;
            finalLastError.countryId = countryId;
            finalLastError.countryLabel = countryLabel;
            finalLastError.providerIds = providerIdAttempt;
            finalLastError.failureReason = failure.failure.reason;
            if (typeof deps.addLog === 'function') {
              await deps.addLog(`步骤 9：${failure.message}`, 'warn');
            }
            if (failure.failure.isTerminal) {
              throw finalLastError;
            }
          }
        }
      }
      finalNoNumbersByCountry = noNumbersByCountry;
      if (round < maxAcquireRounds && noNumbersByCountry.length) {
        if (typeof deps.addLog === 'function') {
          await deps.addLog(
            `步骤 9：SMSBower 暂无可用号码（第 ${round}/${maxAcquireRounds} 轮）；${Math.ceil(retryDelayMs / 1000)} 秒后重试。国家：${noNumbersByCountry.join(' | ')}。`,
            'warn'
          );
        }
        await deps.sleepWithStop?.(retryDelayMs);
        continue;
      }
      break;
    }

    if (finalNoNumbersByCountry.length) {
      throw new Error(`SMSBower 已尝试 ${countryCandidates.length} 个候选国家，均无可用号码：${finalNoNumbersByCountry.join(' | ')}。`);
    }
    if (finalLastError) {
      throw finalLastError;
    }
    throw new Error('SMSBower 获取手机号失败。');
  }
  function extractVerificationCode(value = '') {
    const text = String(value || '').trim().replace(/^STATUS_OK:\s*/i, '');
    if (!text) {
      return '';
    }
    return text.match(/\b(\d{4,8})\b/)?.[1] || '';
  }

  async function pollActivationCode(state = {}, activation, options = {}, deps = {}) {
    const normalizedActivation = normalizeActivation(activation);
    if (!normalizedActivation) {
      throw new Error('缺少手机号接码订单。');
    }
    const config = resolveConfig(state, deps);
    const timeoutMs = Math.max(1000, Number(options.timeoutMs) || DEFAULT_POLL_TIMEOUT_MS);
    const intervalMs = Math.max(1000, Number(options.intervalMs) || DEFAULT_POLL_INTERVAL_MS);
    const maxRoundsRaw = Math.floor(Number(options.maxRounds));
    const maxRounds = Number.isFinite(maxRoundsRaw) && maxRoundsRaw > 0 ? maxRoundsRaw : 0;
    const start = Date.now();
    let pollCount = 0;
    let lastStatus = '';

    const emitWaitingForCode = async (statusText) => {
      if (typeof options.onWaitingForCode === 'function') {
        await options.onWaitingForCode({
          activation: normalizedActivation,
          elapsedMs: Date.now() - start,
          pollCount,
          statusText,
          timeoutMs,
        });
      }
    };

    while (Date.now() - start < timeoutMs) {
      if (maxRounds > 0 && pollCount >= maxRounds) {
        break;
      }
      deps.throwIfStopped?.();
      const payload = await fetchPayload(config, {
        action: 'getStatus',
        id: normalizedActivation.activationId,
      }, 'SMSBower getStatus');
      const statusText = describePayload(payload);
      lastStatus = statusText;
      pollCount += 1;
      if (typeof options.onStatus === 'function') {
        await options.onStatus({
          activation: normalizedActivation,
          elapsedMs: Date.now() - start,
          pollCount,
          statusText: statusText || 'PENDING',
          timeoutMs,
        });
      }
      if (/^STATUS_OK:/i.test(statusText)) {
        const code = extractVerificationCode(statusText);
        if (code) {
          return code;
        }
      }
      if (/^STATUS_CANCEL$/i.test(statusText)) {
        throw new Error('SMSBower 订单已取消。');
      }
      await emitWaitingForCode(statusText || 'STATUS_WAIT_CODE');
      await deps.sleepWithStop?.(intervalMs);
    }
    throw new Error(`${PHONE_CODE_TIMEOUT_ERROR_PREFIX}等待手机验证码超时。${lastStatus ? ` SMSBower 最后状态：${lastStatus}` : ''}`);
  }

  async function setActivationStatus(state = {}, activation, status, deps = {}, actionLabel = 'SMSBower setStatus') {
    const normalizedActivation = normalizeActivation(activation);
    if (!normalizedActivation) {
      return '';
    }
    const config = resolveConfig(state, deps);
    const payload = await fetchPayload(config, {
      action: 'setStatus',
      id: normalizedActivation.activationId,
      status: Math.floor(Number(status) || 0),
    }, actionLabel);
    return describePayload(payload);
  }

  async function finishActivation(state = {}, activation, deps = {}) {
    return setActivationStatus(state, activation, 6, deps, 'SMSBower complete activation');
  }

  async function cancelActivation(state = {}, activation, deps = {}) {
    return setActivationStatus(state, activation, 8, deps, 'SMSBower cancel activation');
  }

  async function banActivation(state = {}, activation, deps = {}) {
    return setActivationStatus(state, activation, 8, deps, 'SMSBower ban activation');
  }

  async function requestAdditionalSms(state = {}, activation, deps = {}) {
    return setActivationStatus(state, activation, 3, deps, 'SMSBower request another sms');
  }

  async function reuseActivation() {
    throw new Error('SMSBower 当前流程不支持复用手机号订单。');
  }

  async function rotateActivation(state = {}, activation, options = {}, deps = {}) {
    const releaseAction = String(options?.releaseAction || '').trim().toLowerCase() === 'ban'
      ? 'ban'
      : 'cancel';
    if (releaseAction === 'ban') {
      await banActivation(state, activation, deps);
    } else {
      await cancelActivation(state, activation, deps);
    }
    return {
      currentTicketId: String(activation?.activationId || activation?.phoneNumber || ''),
      nextActivation: null,
    };
  }

  function createProvider(deps = {}) {
    const providerDeps = {
      fetchImpl: deps.fetchImpl,
      sleepWithStop: deps.sleepWithStop,
      throwIfStopped: deps.throwIfStopped,
      addLog: deps.addLog,
      randomFn: deps.randomFn,
      requestTimeoutMs: deps.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS,
    };
    const capabilities = Object.freeze({
      supportsReusableActivation: false,
      supportsAutomaticFreeReuse: false,
      supportsFreeReusePreservation: false,
      supportsPageResend: true,
      supportsPageResendProbe: true,
      requiresCountrySelection: true,
    });
    return {
      id: PROVIDER_ID,
      label: 'SMSBower',
      capabilities,
      defaultCountryId: DEFAULT_COUNTRY_ID,
      defaultCountryLabel: DEFAULT_COUNTRY_LABEL,
      defaultProduct: DEFAULT_SERVICE_LABEL,
      defaultServiceCode: DEFAULT_SERVICE_CODE,
      defaultProviderIds: DEFAULT_PROVIDER_IDS,
      defaultMaxPrice: DEFAULT_MAX_PRICE,
      normalizeCountryId: normalizeSmsBowerCountryId,
      normalizeCountryLabel: normalizeSmsBowerCountryLabel,
      normalizeCountryOrder: normalizeSmsBowerCountryOrder,
      normalizeCountryKey,
      normalizeServiceCode: normalizeSmsBowerServiceCode,
      normalizeProviderIds: normalizeSmsBowerProviderIds,
      normalizeMaxPrice: normalizeSmsBowerPrice,
      normalizeActivation,
      resolveCountryCandidates,
      resolveCountryLabel,
      resolveActivationCountry,
      getActivationCountryKey,
      getActivationPrice,
      requestActivation: (state, options) => requestActivation(state, options, providerDeps),
      reuseActivation: (state, activation) => reuseActivation(state, activation, providerDeps),
      finishActivation: (state, activation) => finishActivation(state, activation, providerDeps),
      cancelActivation: (state, activation) => cancelActivation(state, activation, providerDeps),
      banActivation: (state, activation) => banActivation(state, activation, providerDeps),
      requestAdditionalSms: (state, activation) => requestAdditionalSms(state, activation, providerDeps),
      rotateActivation: (state, activation, options) => rotateActivation(state, activation, options, providerDeps),
      pollActivationCode: (state, activation, options) => pollActivationCode(state, activation, options, providerDeps),
      prepareActivationForReuse: reuseActivation,
      canPersistReusableActivation: () => false,
      canPreserveActivationForFreeReuse: () => false,
      shouldUsePageResend: () => true,
      shouldProbePageResend: () => true,
      fetchBalance: (state) => fetchBalance(state, providerDeps),
      fetchPrices: (state, countryConfig) => fetchPrices(state, countryConfig, providerDeps),
      fetchPriceRange: (state, countryConfig) => fetchPriceRange(state, countryConfig, providerDeps),
      fetchCountryCatalog: (state) => fetchCountryCatalog(state, providerDeps),
      resolvePriceRange,
      formatPriceRangeText,
      describePayload,
    };
  }

  return {
    PROVIDER_ID,
    DEFAULT_BASE_URL,
    DEFAULT_COUNTRY_ID,
    DEFAULT_COUNTRY_LABEL,
    DEFAULT_SERVICE_CODE,
    DEFAULT_SERVICE_LABEL,
    DEFAULT_PROVIDER_IDS,
    DEFAULT_MAX_PRICE,
    createProvider,
    describePayload,
    normalizeSmsBowerCountryId,
    normalizeSmsBowerCountryLabel,
    normalizeSmsBowerCountryOrder,
    normalizeCountryKey,
    normalizeSmsBowerServiceCode,
    normalizeSmsBowerProviderIds,
    fetchCountryCatalog,
    normalizeSmsBowerPrice,
    normalizeActivation,
    resolveActivationCountry,
    collectSmsBowerPriceEntries,
    dedupeSmsBowerPriceEntries,
    summarizeSmsBowerPriceRange,
  };
});
