(function smsbowerMailProviderModule(root, factory) {
  root.MultiPageBackgroundSmsBowerMailProvider = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createSmsBowerMailProviderModule() {
  function createSmsBowerMailProvider(deps = {}) {
    const {
      addLog = async () => {},
      DEFAULT_SMSBOWER_MAIL_BASE_URL = 'https://smsbower.page/api/mail',
      DEFAULT_SMSBOWER_MAIL_DOMAIN = 'gmail.com',
      DEFAULT_SMSBOWER_MAIL_MAX_PRICE = '0.134',
      DEFAULT_SMSBOWER_MAIL_SERVICE_CODE = 'dr',
      describeSmsBowerMailPayload,
      extractSmsBowerMailCode,
      extractSmsBowerMailLink,
      fetchImpl = typeof fetch === 'function' ? fetch.bind(globalThis) : null,
      getState = async () => ({}),
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
      persistRegistrationEmailState = null,
      setEmailState = async () => {},
      setState = async () => {},
      sleepWithStop = async () => {},
      throwIfStopped = () => {},
      SMSBOWER_MAIL_PROVIDER = 'smsbower-mail',
    } = deps;

    async function persistResolvedEmailState(state = null, email, options = {}) {
      if (typeof persistRegistrationEmailState === 'function') {
        await persistRegistrationEmailState(state, email, options);
        return;
      }
      await setEmailState(email, options);
    }

    function getSmsBowerMailConfig(state = {}) {
      return {
        apiKey: normalizeSmsBowerMailApiKey(state.smsbowerMailApiKey),
        baseUrl: normalizeSmsBowerMailBaseUrl(state.smsbowerMailBaseUrl || DEFAULT_SMSBOWER_MAIL_BASE_URL),
        service: normalizeSmsBowerMailServiceCode(state.smsbowerMailServiceCode, DEFAULT_SMSBOWER_MAIL_SERVICE_CODE),
        domain: normalizeSmsBowerMailDomain(state.smsbowerMailDomain || DEFAULT_SMSBOWER_MAIL_DOMAIN),
        maxPrice: normalizeSmsBowerMailMaxPrice(state.smsbowerMailMaxPrice || DEFAULT_SMSBOWER_MAIL_MAX_PRICE),
        alias: normalizeSmsBowerMailAlias(state.smsbowerMailAlias),
        currentActivation: normalizeSmsBowerMailCurrentActivation(state.currentSmsBowerMailActivation),
      };
    }

    function ensureSmsBowerMailConfig(state = {}, options = {}) {
      const { requireApiKey = false, requireActivation = false } = options;
      const config = getSmsBowerMailConfig(state);
      if (!config.baseUrl) {
        throw new Error('SMSBower TempMail API 地址为空或格式无效。');
      }
      if (requireApiKey && !config.apiKey) {
        throw new Error('SMSBower TempMail API Key 为空，请先在侧边栏填写。');
      }
      if (requireActivation && !config.currentActivation?.id) {
        throw new Error('SMSBower TempMail 当前没有可用邮箱，请先获取邮箱。');
      }
      return config;
    }

    async function requestSmsBowerMailJson(config, path, options = {}) {
      if (!fetchImpl) {
        throw new Error('SMSBower TempMail 当前运行环境不支持 fetch。');
      }
      const {
        params = {},
        timeoutMs = 20000,
      } = options;
      const url = joinSmsBowerMailUrl(config.baseUrl, path, {
        api_key: config.apiKey,
        ...params,
      });
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
      let response;
      try {
        response = await fetchImpl(url, {
          method: 'GET',
          signal: controller.signal,
        });
      } catch (err) {
        const errorMessage = err?.name === 'AbortError'
          ? `SMSBower TempMail 请求超时（>${Math.round(timeoutMs / 1000)} 秒）`
          : `SMSBower TempMail 请求失败：${err.message}`;
        throw new Error(errorMessage);
      } finally {
        clearTimeout(timeoutId);
      }

      const text = await response.text();
      const payload = parseSmsBowerMailPayload(text);
      if (!response.ok) {
        throw new Error(`SMSBower TempMail 请求失败：${describeSmsBowerMailPayload(payload) || `HTTP ${response.status}`}`);
      }
      return payload;
    }

    async function fetchSmsBowerMailAddress(state, options = {}) {
      throwIfStopped();
      const latestState = state || await getState();
      const config = ensureSmsBowerMailConfig(latestState, { requireApiKey: true });
      const payload = await requestSmsBowerMailJson(config, '/getActivation', {
        params: {
          service: config.service,
          domain: config.domain,
          maxPrice: config.maxPrice,
          alias: config.alias,
          ref: options.ref || latestState.smsbowerMailRef || '',
        },
      });
      if (!isSmsBowerMailSuccess(payload)) {
        throw new Error(`SMSBower TempMail 获取邮箱失败：${describeSmsBowerMailPayload(payload) || 'unknown_error'}`);
      }
      const activation = normalizeSmsBowerMailActivation({
        ...payload,
        service: config.service,
        domain: config.domain,
      });
      if (!activation.id || !activation.address) {
        throw new Error('SMSBower TempMail 获取邮箱成功，但未返回可用 mail/mailId。');
      }
      await setState({ currentSmsBowerMailActivation: activation });
      await persistResolvedEmailState(latestState, activation.address, {
        source: `generated:${SMSBOWER_MAIL_PROVIDER}`,
        preserveAccountIdentity: Boolean(options?.preserveAccountIdentity),
      });
      await addLog(`SMSBower TempMail：已获取邮箱 ${activation.address}（mailId=${activation.id}）`, 'ok');
      return activation.address;
    }

    function resolveSmsBowerMailActivation(state = {}) {
      const config = getSmsBowerMailConfig(state);
      if (config.currentActivation?.id) {
        return config.currentActivation;
      }
      return null;
    }

    function resolveSmsBowerMailPollTargetEmail(state = {}, pollPayload = {}) {
      return normalizeSmsBowerMailAddress(pollPayload.targetEmail)
        || resolveSmsBowerMailActivation(state)?.address
        || normalizeSmsBowerMailAddress(state.email);
    }

    async function setSmsBowerMailActivationStatus(state, status = 3) {
      const latestState = state || await getState();
      const config = ensureSmsBowerMailConfig(latestState, { requireApiKey: true, requireActivation: true });
      return requestSmsBowerMailJson(config, '/setStatus', {
        params: {
          id: config.currentActivation.id,
          status,
        },
      });
    }

    async function requestSmsBowerMailNextCode(state, options = {}) {
      try {
        return await setSmsBowerMailActivationStatus(state, 3);
      } catch (err) {
        await addLog(
          `${options.logPrefix || 'SMSBower TempMail'}：请求下一条验证码失败：${err.message}`,
          options.level || 'warn'
        );
        throw err;
      }
    }

    async function cancelSmsBowerMailActivationForRetry(state = null, options = {}) {
      const latestState = state || await getState();
      const config = getSmsBowerMailConfig(latestState);
      const activation = config.currentActivation;
      if (!activation?.id) {
        await clearSmsBowerMailRuntimeState({ clearEmail: true });
        return { cancelled: false, reason: 'missing_activation' };
      }

      try {
        const ensuredConfig = ensureSmsBowerMailConfig(latestState, { requireApiKey: true, requireActivation: true });
        await requestSmsBowerMailJson(ensuredConfig, '/setStatus', {
          params: {
            id: activation.id,
            status: 3,
          },
        });
        await addLog(
          `${options.logPrefix || 'SMSBower TempMail'}：已取消邮箱 ${activation.address || activation.id}（mailId=${activation.id}），准备重新获取。`,
          options.level || 'warn'
        );
      } catch (err) {
        await addLog(
          `${options.logPrefix || 'SMSBower TempMail'}：取消邮箱 ${activation.address || activation.id} 失败，仍会清空本地状态并重新获取：${err.message}`,
          'warn'
        );
      }

      await clearSmsBowerMailRuntimeState({ clearEmail: true });
      return {
        cancelled: true,
        activation,
      };
    }

    async function pollSmsBowerMailVerificationCode(step, state, pollPayload = {}) {
      const latestState = state || await getState();
      const config = ensureSmsBowerMailConfig(latestState, { requireApiKey: true, requireActivation: true });
      const activation = config.currentActivation;
      const targetEmail = resolveSmsBowerMailPollTargetEmail(latestState, pollPayload);
      if (!targetEmail) {
        throw new Error('SMSBower TempMail 轮询前缺少目标邮箱地址，请先获取邮箱。');
      }

      await addLog(`步骤 ${step}：正在轮询 SMSBower TempMail 邮件（${targetEmail}，mailId=${activation.id}）...`, 'info');
      const maxAttempts = Number(pollPayload.maxAttempts) || 8;
      const intervalMs = Number(pollPayload.intervalMs) || 3000;
      const excludeCodes = new Set((pollPayload.excludeCodes || []).map((code) => String(code || '').trim()).filter(Boolean));
      let lastError = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        throwIfStopped();
        try {
          const payload = await requestSmsBowerMailJson(config, '/getCode', {
            params: { mailId: activation.id },
          });
          if (isSmsBowerMailSuccess(payload)) {
            const code = String(extractSmsBowerMailCode(payload) || '').trim();
            if (code && !excludeCodes.has(code)) {
              try {
                await requestSmsBowerMailNextCode(latestState, {
                  logPrefix: 'SMSBower TempMail',
                });
              } catch (err) {
                await addLog(`步骤 ${step}：SMSBower TempMail 关闭激活失败：${err.message}`, 'warn');
              }
              return {
                ok: true,
                code,
                emailTimestamp: Date.now(),
                mailId: activation.id,
              };
            }
            if (code) {
              try {
                await requestSmsBowerMailNextCode(latestState, {
                  logPrefix: 'SMSBower TempMail',
                });
              } catch (err) {
                await addLog(`姝ラ ${step}锛歋MSBower TempMail 宸叉嫆缁濋獙璇佺爜 ${code}，但请求下一条验证码失败：${err.message}`, 'warn');
              }
            }
            lastError = new Error(code
              ? `步骤 ${step}：SMSBower TempMail 返回验证码 ${code} 已在排除列表中（${attempt}/${maxAttempts}）。`
              : `步骤 ${step}：SMSBower TempMail 未返回验证码内容（${attempt}/${maxAttempts}）。`);
          } else if (isSmsBowerMailPendingCode(payload)) {
            lastError = new Error(`步骤 ${step}：SMSBower TempMail 验证码尚未到达（${attempt}/${maxAttempts}）。`);
          } else {
            lastError = new Error(`步骤 ${step}：SMSBower TempMail 轮询失败：${describeSmsBowerMailPayload(payload) || 'unknown_error'}`);
          }
          await addLog(lastError.message, attempt === maxAttempts ? 'warn' : 'info');
        } catch (err) {
          lastError = err;
          await addLog(`步骤 ${step}：SMSBower TempMail 轮询失败：${err.message}`, 'warn');
        }
        if (attempt < maxAttempts) {
          await sleepWithStop(intervalMs);
        }
      }

      throw lastError || new Error(`步骤 ${step}：未在 SMSBower TempMail 中找到新的匹配验证码。`);
    }

    async function pollSmsBowerMailLink(step, state, pollPayload = {}) {
      const latestState = state || await getState();
      const config = ensureSmsBowerMailConfig(latestState, { requireApiKey: true, requireActivation: true });
      const activation = config.currentActivation;
      const targetEmail = resolveSmsBowerMailPollTargetEmail(latestState, pollPayload);
      const actionLabel = String(pollPayload.actionLabel || 'SMSBower TempMail email link').trim();
      if (!targetEmail) {
        throw new Error('SMSBower TempMail link polling requires a target email. Get an email first.');
      }
      if (typeof extractSmsBowerMailLink !== 'function') {
        throw new Error('SMSBower TempMail link extractor is not available.');
      }

      await addLog(`步骤 ${step}：正在轮询 ${actionLabel}：${targetEmail}（mailId=${activation.id}）...`, 'info');
      const maxAttempts = Number(pollPayload.maxAttempts) || 8;
      const intervalMs = Number(pollPayload.intervalMs) || 3000;
      let lastError = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        throwIfStopped();
        try {
          const payload = await requestSmsBowerMailJson(config, '/getCode', {
            params: { mailId: activation.id },
          });
          if (isSmsBowerMailSuccess(payload)) {
            const link = String(extractSmsBowerMailLink(payload, {
              hostFilters: pollPayload.hostFilters || [],
            }) || '').trim();
            if (link) {
              try {
                await requestSmsBowerMailNextCode(latestState, {
                  logPrefix: 'SMSBower TempMail',
                });
              } catch (err) {
                await addLog(`步骤 ${step}：SMSBower TempMail 关闭激活失败：${err.message}`, 'warn');
              }
              return {
                ok: true,
                link,
                url: link,
                emailTimestamp: Date.now(),
                mailId: activation.id,
              };
            }
            lastError = new Error(`步骤 ${step}：SMSBower TempMail 已返回邮件，但未解析到匹配链接（${attempt}/${maxAttempts}）。`);
          } else if (isSmsBowerMailPendingCode(payload)) {
            lastError = new Error(`步骤 ${step}：SMSBower TempMail 邮件尚未到达（${attempt}/${maxAttempts}）。`);
          } else {
            lastError = new Error(`步骤 ${step}：SMSBower TempMail 轮询失败：${describeSmsBowerMailPayload(payload) || 'unknown_error'}`);
          }
          await addLog(lastError.message, attempt === maxAttempts ? 'warn' : 'info');
        } catch (err) {
          lastError = err;
          await addLog(`步骤 ${step}：SMSBower TempMail 轮询失败：${err.message}`, 'warn');
        }
        if (attempt < maxAttempts) {
          await sleepWithStop(intervalMs);
        }
      }

      throw lastError || new Error(`步骤 ${step}：未在 SMSBower TempMail 中找到邮件链接。`);
    }

    async function clearSmsBowerMailRuntimeState(options = {}) {
      await setState({
        currentSmsBowerMailActivation: null,
        ...(options.clearEmail ? { email: null } : {}),
      });
    }

    return {
      cancelSmsBowerMailActivationForRetry,
      clearSmsBowerMailRuntimeState,
      ensureSmsBowerMailConfig,
      fetchSmsBowerMailAddress,
      getSmsBowerMailConfig,
      pollSmsBowerMailLink,
      pollSmsBowerMailVerificationCode,
      requestSmsBowerMailJson,
      resolveSmsBowerMailPollTargetEmail,
      setSmsBowerMailActivationStatus,
    };
  }

  return {
    createSmsBowerMailProvider,
  };
});
