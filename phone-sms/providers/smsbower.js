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
  const DEFAULT_PROVIDER_IDS = '3170';
  const DEFAULT_MAX_PRICE = '0.134';
  const DEFAULT_REQUEST_TIMEOUT_MS = 20000;
  const DEFAULT_ACQUIRE_RETRY_ROUNDS = 3;
  const DEFAULT_ACQUIRE_RETRY_DELAY_MS = 2000;
  const DEFAULT_POLL_TIMEOUT_MS = 180000;
  const DEFAULT_POLL_INTERVAL_MS = 5000;
  const PHONE_CODE_TIMEOUT_ERROR_PREFIX = 'PHONE_CODE_TIMEOUT::';
  const DEFAULT_COUNTRY_CANDIDATES = Object.freeze([
    { id: 3267, label: 'Indonesia' },
    { id: 3243, label: 'Colombia' },
    { id: 2649, label: 'South Africa' },
    { id: 3234, label: 'Chile' },
    { id: 2920, label: 'Vietnam' },
    { id: 3160, label: 'Vietnam' },
    { id: 2974, label: 'Chile' },
    { id: 3316, label: 'Brazil' },
    { id: 2266, label: 'Nigeria' },
    { id: 3237, label: 'Thailand' },
    { id: 3398, label: 'Brazil' },
    { id: 2377, label: 'Saudi Arabia' },
    { id: 187, label: 'USA' },
  ]);
  const DEFAULT_COUNTRY_LABELS_BY_ID = new Map(DEFAULT_COUNTRY_CANDIDATES.map((entry) => [entry.id, entry.label]));
  const COUNTRY_BY_PHONE_PREFIX = Object.freeze([
    { prefix: '1', id: 187, iso: 'US', label: 'USA' },
    { prefix: '66', id: 52, iso: 'TH', label: 'Thailand' },
    { prefix: '84', id: 10, iso: 'VN', label: 'Vietnam' },
    { prefix: '62', id: 6, iso: 'ID', label: 'Indonesia' },
    { prefix: '44', id: 16, iso: 'GB', label: 'United Kingdom' },
    { prefix: '81', id: 151, iso: 'JP', label: 'Japan' },
    { prefix: '49', id: 43, iso: 'DE', label: 'Germany' },
    { prefix: '33', id: 73, iso: 'FR', label: 'France' },
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
    return DEFAULT_COUNTRY_ID;
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
        id = normalizeOptionalSmsBowerCountryId(entry.id ?? entry.countryId ?? entry.country);
        label = String((entry.label ?? entry.countryLabel) || '').trim();
      } else {
        const text = String(entry || '').trim();
        const structured = text.match(/^(\d+)\s*(?:[:|/-]\s*(.+))?$/);
        id = normalizeOptionalSmsBowerCountryId(structured?.[1] || text);
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
    return {
      apiKey: String(state?.smsbowerApiKey || '').trim(),
      baseUrl: state?.smsbowerBaseUrl || DEFAULT_BASE_URL,
      serviceCode: normalizeSmsBowerServiceCode(state?.smsbowerServiceCode, DEFAULT_SERVICE_CODE),
      providerIds: normalizeSmsBowerProviderIds(state?.smsbowerProviderIds, DEFAULT_PROVIDER_IDS),
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

  function resolveCountryCandidates(state = {}) {
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
    return DEFAULT_COUNTRY_CANDIDATES.map((entry) => ({
      id: normalizeSmsBowerCountryId(entry.id, DEFAULT_COUNTRY_ID),
      label: normalizeSmsBowerCountryLabel(entry.label, DEFAULT_COUNTRY_LABEL),
    }));
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
    const maxPriceText = normalizeSmsBowerPrice(state?.smsbowerMaxPrice || DEFAULT_MAX_PRICE);
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
      const countryId = normalizeSmsBowerCountryId(
        entry && typeof entry === 'object' && !Array.isArray(entry)
          ? (entry.id ?? entry.countryId ?? entry.country)
          : entry,
        0
      );
      if (!countryId) {
        return;
      }
      const providerId = normalizeSmsBowerProviderIds(
        countryId === DEFAULT_COUNTRY_ID ? DEFAULT_PROVIDER_IDS : String(countryId),
        ''
      );
      if (!providerId || seen.has(providerId)) {
        return;
      }
      seen.add(providerId);
      providerIds.push(providerId);
    });
    return providerIds.join(',');
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

  async function fetchBalance(state = {}, deps = {}) {
    const config = resolveConfig(state, deps);
    const payload = await fetchPayload(config, { action: 'getBalance' }, 'SMSBower getBalance');
    const balance = Number(String(describePayload(payload)).replace(/^ACCESS_BALANCE:/i, '').trim());
    return { balance, raw: payload };
  }

  async function fetchPrices(state = {}, countryConfig = resolveCountryCandidates(state)[0], deps = {}) {
    const config = resolveConfig(state, deps);
    return fetchPayload(config, {
      action: 'getPrices',
      service: config.serviceCode,
      country: normalizeSmsBowerCountryId(countryConfig?.id, DEFAULT_COUNTRY_ID),
    }, 'SMSBower getPrices');
  }

  async function requestActivation(state = {}, options = {}, deps = {}) {
    const config = resolveConfig(state, deps);
    const allCountryCandidates = resolveCountryCandidates(state);
    if (!allCountryCandidates.length) {
      throw new Error('步骤 9：SMSBower 未选择国家，请先在接码设置中至少选择 1 个国家。');
    }
    const blockedCountryIds = new Set(
      (Array.isArray(options?.blockedCountryIds) ? options.blockedCountryIds : [])
        .map((value) => normalizeSmsBowerCountryId(value, 0))
        .filter((id) => id > 0)
    );
    let countryCandidates = allCountryCandidates.filter(
      (entry) => !blockedCountryIds.has(normalizeSmsBowerCountryId(entry.id, 0))
    );
    if (!countryCandidates.length) {
      countryCandidates = allCountryCandidates;
      if (blockedCountryIds.size && typeof deps.addLog === 'function') {
        await deps.addLog('步骤 9：SMSBower 已选国家均达到临时失败跳过阈值，本轮解除跳过并重新尝试。', 'warn');
      }
    }
    const priceRange = resolvePriceRange(state);
    if (priceRange.invalidRange) {
      throw new Error(`SMSBower 价格区间无效：最低购买价 ${priceRange.minPriceLimit} 高于价格上限 ${priceRange.maxPriceLimit}。`);
    }
    const resolvedProviderIds = (
      config.providerIds && config.providerIds !== DEFAULT_PROVIDER_IDS
        ? config.providerIds
        : getProviderIdsForCountryOrder(countryCandidates) || config.providerIds
    );
    const maxAcquireRounds = Math.max(1, Math.min(10, Math.floor(Number(state?.smsbowerActivationRetryRounds) || DEFAULT_ACQUIRE_RETRY_ROUNDS)));
    const retryDelayMs = Math.max(500, Math.min(30000, Math.floor(Number(state?.smsbowerActivationRetryDelayMs) || DEFAULT_ACQUIRE_RETRY_DELAY_MS)));
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
        const countryAttempt = (payloadOrError) => formatSmsBowerAcquireFailure(countryLabel, countryId, resolvedProviderIds, payloadOrError);
        try {
          const query = {
            action: 'getNumber',
            service: config.serviceCode,
            country: countryId,
          };
          if (resolvedProviderIds) {
            query.providerIds = resolvedProviderIds;
          }
          const maxPrice = normalizeSmsBowerPrice(state?.smsbowerMaxPrice || DEFAULT_MAX_PRICE);
          if (maxPrice) {
            query.maxPrice = maxPrice;
          }
          const payload = await fetchPayload(config, query, 'SMSBower getNumber');
          const activation = parseActivationPayload(payload, {
            countryId,
            countryLabel,
            serviceCode: config.serviceCode,
            selectedPrice: maxPrice,
            providerIds: resolvedProviderIds,
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
          finalLastError.providerIds = resolvedProviderIds;
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
          finalLastError.providerIds = resolvedProviderIds;
          finalLastError.failureReason = failure.failure.reason;
          if (typeof deps.addLog === 'function') {
            await deps.addLog(`步骤 9：${failure.message}`, 'warn');
          }
          if (failure.failure.isTerminal) {
            throw finalLastError;
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
    normalizeSmsBowerPrice,
    normalizeActivation,
    resolveActivationCountry,
  };
});
