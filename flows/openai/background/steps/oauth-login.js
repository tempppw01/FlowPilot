(function attachBackgroundStep7(root, factory) {
  root.MultiPageBackgroundStep7 = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundStep7Module() {
  const RESTART_CURRENT_ATTEMPT_ERROR_PREFIX = 'RESTART_CURRENT_ATTEMPT::';
  const SMSBOWER_MAIL_PROVIDER = 'smsbower-mail';

  function createStep7Executor(deps = {}) {
    const {
      addLog,
      completeNodeFromBackground,
      getErrorMessage,
      getLoginAuthStateLabel,
      getOAuthFlowStepTimeoutMs,
      getState,
      isAddPhoneAuthFailure = (error) => {
        const message = String(typeof error === 'string' ? error : error?.message || '');
        if (/\u624b\u673a\u53f7\u8f93\u5165\u6a21\u5f0f|phone\s+entry/i.test(message)) {
          return false;
        }
        return /https:\/\/auth\.openai\.com\/add-phone(?:[/?#]|$)|\badd-phone\b|\u6dfb\u52a0\u624b\u673a\u53f7|\u624b\u673a\u53f7\u7801|\u8fdb\u5165\u624b\u673a\u53f7\u9875\u9762|\u624b\u673a\u53f7\u9875|\u624b\u673a\u53f7\u9875\u9762|phone\s+number|telephone/i.test(message);
      },
      isStep6RecoverableResult,
      isStep6SuccessResult,
      getTabId,
      refreshOAuthUrlBeforeStep6,
      reuseOrCreateTab,
      sendToContentScriptResilient,
      startOAuthFlowTimeoutWindow,
      STEP6_MAX_ATTEMPTS,
      throwIfStopped,
    } = deps;

    function isManagementSecretConfigError(error) {
      const message = String(typeof error === 'string' ? error : error?.message || '').trim();
      if (!message) {
        return false;
      }

      const mentionsSecret = /管理密钥|Admin Secret|X-Admin-Key|CPA Key/i.test(message);
      if (!mentionsSecret) {
        return false;
      }

      return /缺少|未配置|请输入|无效|错误|失败|401|认证失败|未授权|unauthorized|invalid/i.test(message);
    }

    function normalizeStep7IdentifierType(value = '') {
      const normalized = String(value || '').trim().toLowerCase();
      return normalized === 'phone' || normalized === 'email' ? normalized : '';
    }

    function normalizeStep7SignupMethod(value = '') {
      return String(value || '').trim().toLowerCase() === 'phone' ? 'phone' : 'email';
    }

    function isStep7BoundEmailReloginContext(state = {}) {
      const nodeId = String(
        state?.nodeId
        || state?.stepKey
        || state?.nodeDefinition?.key
        || state?.stepDefinition?.key
        || ''
      ).trim();
      const phase = String(state?.authLoginPhase || '').trim();
      return nodeId === 'relogin-bound-email' || phase === 'bound-email-relogin';
    }

    function resolveForcedStep7IdentifierType(state = {}) {
      const forcedIdentifierType = normalizeStep7IdentifierType(state?.forceLoginIdentifierType);
      if (forcedIdentifierType === 'phone') {
        return 'phone';
      }
      if (isStep7BoundEmailReloginContext(state)) {
        if (forcedIdentifierType === 'email' || Boolean(state?.forceEmailLogin)) {
          return 'email';
        }
      }
      return '';
    }

    function shouldForceStep7EmailLogin(state = {}) {
      return resolveForcedStep7IdentifierType(state) === 'email';
    }

    function isPhoneSignupMethodForStep7(state = {}) {
      return normalizeStep7SignupMethod(state?.signupMethod) === 'phone'
        || normalizeStep7SignupMethod(state?.resolvedSignupMethod) === 'phone';
    }

    function canUseConfiguredPhoneSignup(state = {}) {
      return isPhoneSignupMethodForStep7(state)
        && Boolean(state?.phoneVerificationEnabled)
        && !Boolean(state?.plusModeEnabled)
        && !Boolean(state?.accountContributionEnabled);
    }

    function hasStep7PhoneSignupIdentity(state = {}) {
      return Boolean(
        String(state?.signupPhoneNumber || '').trim()
        || String(state?.signupPhoneCompletedActivation?.phoneNumber || '').trim()
        || String(state?.signupPhoneActivation?.phoneNumber || '').trim()
        || (
          normalizeStep7IdentifierType(state?.accountIdentifierType) === 'phone'
          && String(state?.accountIdentifier || '').trim()
        )
      );
    }

    function shouldPreferStep7PhoneSignupIdentity(state = {}) {
      return canUseConfiguredPhoneSignup(state)
        && hasStep7PhoneSignupIdentity(state);
    }

    function resolveStep7LoginIdentifierType(state = {}, fallbackType = '') {
      const forcedIdentifierType = resolveForcedStep7IdentifierType(state);
      if (forcedIdentifierType) {
        return forcedIdentifierType;
      }

      if (shouldPreferStep7PhoneSignupIdentity(state)) {
        return 'phone';
      }

      const explicitIdentifierType = normalizeStep7IdentifierType(state?.accountIdentifierType);
      if (explicitIdentifierType) {
        return explicitIdentifierType;
      }

      const frozenSignupMethod = normalizeStep7IdentifierType(state?.resolvedSignupMethod);
      if (frozenSignupMethod) {
        return frozenSignupMethod;
      }

      if (canUseConfiguredPhoneSignup(state)) {
        return 'phone';
      }

      return normalizeStep7IdentifierType(fallbackType) || 'email';
    }

    function extractAddPhoneUrl(error) {
      const message = String(typeof error === 'string' ? error : error?.message || '');
      const match = message.match(/https:\/\/auth\.openai\.com\/add-phone(?:[^\s]*)?/i);
      return match ? match[0] : 'https://auth.openai.com/add-phone';
    }

    function getStep7ResultState(result = {}) {
      return String(result?.state || '').trim();
    }

    function isStep7OauthConsentResult(result = {}) {
      return Boolean(result?.directOAuthConsentPage)
        || getStep7ResultState(result) === 'oauth_consent_page';
    }

    function isStep7AddEmailResult(result = {}) {
      return Boolean(result?.addEmailPage) || getStep7ResultState(result) === 'add_email_page';
    }

    function isStep7AddPhoneResult(result = {}) {
      return Boolean(result?.addPhonePage) || getStep7ResultState(result) === 'add_phone_page';
    }

    function isStep7PhoneVerificationResult(result = {}) {
      return Boolean(result?.phoneVerificationPage) || getStep7ResultState(result) === 'phone_verification_page';
    }

    function isStep7PlainVerificationResult(result = {}) {
      return getStep7ResultState(result) === 'verification_page' && !isStep7PhoneVerificationResult(result);
    }

    function isStep7AlreadyOnVerificationResult(result = {}) {
      const via = String(result?.via || '').trim();
      return (
        via === 'already_on_verification_page'
        || via === 'already_on_phone_verification_page'
      ) && (
        isStep7PlainVerificationResult(result)
        || isStep7PhoneVerificationResult(result)
      );
    }

    function isSmsBowerMailProviderForStep7(state = {}) {
      const candidates = [
        state?.mailProvider,
        state?.emailGenerator,
        state?.mailConfig?.provider,
      ].map((value) => String(value || '').trim().toLowerCase());
      return candidates.includes(SMSBOWER_MAIL_PROVIDER);
    }

    function buildStep7AlreadyOnVerificationRestartError(result = {}, completionStep = 7) {
      const stateLabel = getLoginAuthStateLabel(result?.state);
      const url = String(result?.url || '').trim();
      const urlPart = url ? `URL: ${url}` : '';
      return new Error(
        `${RESTART_CURRENT_ATTEMPT_ERROR_PREFIX}步骤 ${completionStep}：进入 OAuth 登录时认证页已经停留在${stateLabel}，通常是上一轮注册/登录验证码页残留；当前账号登录不可继续，已要求回到步骤 1 重新开始注册。${urlPart}`.trim()
      );
    }

    function buildStep7SmsBowerVerificationRestartError(result = {}, completionStep = 7) {
      const stateLabel = getLoginAuthStateLabel(result?.state);
      const url = String(result?.url || '').trim();
      const urlPart = url ? `URL: ${url}` : '';
      return new Error(
        `${RESTART_CURRENT_ATTEMPT_ERROR_PREFIX}步骤 ${completionStep}：SMSBower TempMail 登录阶段未检测到可复用的已登录账号，认证页进入${stateLabel}；由于 SMSBower 只保留最近 20 分钟验证码，当前账号登录不可继续，已要求回到步骤 1 重新注册新号。${urlPart}`.trim()
      );
    }

    function isRestartCurrentAttemptError(error) {
      return String(error?.message || error || '').startsWith(RESTART_CURRENT_ATTEMPT_ERROR_PREFIX);
    }

    async function readStep7AuthState(completionStep, logMessage = '') {
      const result = await sendToContentScriptResilient(
        'openai-auth',
        {
          type: 'GET_LOGIN_AUTH_STATE',
          source: 'background',
          payload: {},
        },
        {
          timeoutMs: 15000,
          responseTimeoutMs: 15000,
          retryDelayMs: 600,
          logMessage: logMessage || '认证页正在切换，等待页面重新就绪后检查登录态...',
          logStep: completionStep,
          logStepKey: 'oauth-login',
        }
      );
      if (result?.error) {
        throw new Error(result.error);
      }
      return result || {};
    }

    async function recoverSmsBowerAlreadyOnVerificationPage(currentState = {}, oauthUrl = '', result = {}, completionStep = 7) {
      if (!isSmsBowerMailProviderForStep7(currentState)) {
        return null;
      }
      if (!oauthUrl) {
        return null;
      }

      await addLog(
        `步骤 ${completionStep}：SMSBower TempMail 登录阶段检测到认证页已停留在${getLoginAuthStateLabel(result.state)}，将尝试使用当前 ChatGPT 已登录态重新进入 OAuth，避免继续获取 SMSBower 重发验证码。`,
        'warn',
        { step: completionStep, stepKey: 'oauth-login' }
      );

      try {
        await reuseOrCreateTab('openai-auth', 'https://chatgpt.com/', { forceNew: true });
        const chatgptState = await readStep7AuthState(
          completionStep,
          `步骤 ${completionStep}：正在打开 ChatGPT 主页确认当前账号是否已有登录态...`
        );
        await addLog(
          `步骤 ${completionStep}：ChatGPT 登录态探测结果：${getLoginAuthStateLabel(chatgptState.state)}。`,
          'info',
          { step: completionStep, stepKey: 'oauth-login' }
        );

        await reuseOrCreateTab('openai-auth', oauthUrl, { forceNew: false });
        const oauthState = await readStep7AuthState(
          completionStep,
          `步骤 ${completionStep}：正在用已登录态重新打开 OAuth 链接...`
        );

        if (
          isStep7OauthConsentResult(oauthState)
          || isStep7AddPhoneResult(oauthState)
          || isStep7PhoneVerificationResult(oauthState)
        ) {
          await addLog(
            `步骤 ${completionStep}：已通过现有登录态跳过 SMSBower 登录验证码，当前页面：${getLoginAuthStateLabel(oauthState.state)}。`,
            'ok',
            { step: completionStep, stepKey: 'oauth-login' }
          );
          return buildStep7CompletionPayload(
            {
              ...oauthState,
              skipLoginVerificationStep: true,
              directOAuthConsentPage: isStep7OauthConsentResult(oauthState),
            },
            currentState,
            resolveStep7LoginIdentifierType(currentState),
            String(currentState?.signupPhoneNumber || '').trim()
          );
        }

        await addLog(
          `步骤 ${completionStep}：重新打开 OAuth 后仍未进入可跳过验证码的页面（当前：${getLoginAuthStateLabel(oauthState.state)}），将放弃当前账号并回到步骤 1 重新注册新号。`,
          'warn',
          { step: completionStep, stepKey: 'oauth-login' }
        );
        return null;
      } catch (error) {
        await addLog(
          `步骤 ${completionStep}：尝试使用已登录态跳过 SMSBower 登录验证码失败：${error.message}`,
          'warn',
          { step: completionStep, stepKey: 'oauth-login' }
        );
        return null;
      }
    }

    function buildStep7CompletionPayload(result = {}, currentState = {}, currentIdentifierType = '', currentPhoneNumber = '') {
      const phoneSignupMode = currentIdentifierType === 'phone';
      const payload = {
        loginVerificationRequestedAt: result.loginVerificationRequestedAt || null,
      };

      if (currentIdentifierType === 'phone') {
        payload.accountIdentifierType = 'phone';
        payload.accountIdentifier = currentPhoneNumber;
        payload.signupPhoneNumber = currentPhoneNumber;
        payload.signupPhoneCompletedActivation = currentState?.signupPhoneCompletedActivation || null;
        payload.signupPhoneActivation = currentState?.signupPhoneActivation || null;
      }

      if (isStep7OauthConsentResult(result)) {
        payload.skipLoginVerificationStep = true;
        payload.directOAuthConsentPage = true;
        return payload;
      }

      if (phoneSignupMode) {
        if (isStep7AddPhoneResult(result)) {
          throw new Error(`步骤 ${completionStepForState(currentState)}：手机号注册模式 OAuth 登录不应进入添加手机号页。URL: ${result?.url || ''}`.trim());
        }
        if (isStep7AddEmailResult(result)) {
          payload.skipLoginVerificationStep = true;
          payload.addEmailPage = true;
          return payload;
        }
        if (isStep7PhoneVerificationResult(result)) {
          return payload;
        }
        if (isStep7PlainVerificationResult(result)) {
          throw new Error(`步骤 ${completionStepForState(currentState)}：手机号注册模式 OAuth 登录进入了普通邮箱登录验证码页，当前流程不会回落到邮箱验证码。URL: ${result?.url || ''}`.trim());
        }
        throw new Error(`步骤 ${completionStepForState(currentState)}：手机号注册模式 OAuth 登录进入了不允许的页面：${getLoginAuthStateLabel(result.state)}。URL: ${result?.url || ''}`.trim());
      }

      if (isStep7AddEmailResult(result)) {
        throw new Error(`步骤 ${completionStepForState(currentState)}：邮箱注册模式 OAuth 登录不应进入添加邮箱页。URL: ${result?.url || ''}`.trim());
      }
      if (isStep7AddPhoneResult(result) || isStep7PhoneVerificationResult(result)) {
        payload.skipLoginVerificationStep = true;
        payload.addPhonePage = isStep7AddPhoneResult(result);
        payload.phoneVerificationPage = isStep7PhoneVerificationResult(result);
        return payload;
      }
      if (isStep7PlainVerificationResult(result)) {
        return payload;
      }

      throw new Error(`步骤 ${completionStepForState(currentState)}：邮箱注册模式 OAuth 登录进入了不允许的页面：${getLoginAuthStateLabel(result.state)}。URL: ${result?.url || ''}`.trim());
    }

    function completionStepForState(state = {}) {
      const visibleStep = Math.floor(Number(state?.visibleStep) || 0);
      return visibleStep > 0 ? visibleStep : 7;
    }

    async function completeStep7PostLoginPhoneHandoff(state = {}, err, completionStep) {
      if (normalizeStep7SignupMethod(state?.resolvedSignupMethod || state?.signupMethod) === 'phone') {
        throw new Error(
          `步骤 ${completionStep}：手机号注册模式 OAuth 登录进入了添加手机号页，当前流程不允许在手机号注册模式补手机号。URL: ${extractAddPhoneUrl(err)}`
        );
      }
      await completeNodeFromBackground(state?.nodeId || 'oauth-login', {
        loginVerificationRequestedAt: null,
        skipLoginVerificationStep: true,
        addPhonePage: true,
        directOAuthConsentPage: false,
      });
    }

    async function executeStep7(state) {
      const visibleStep = Math.floor(Number(state?.visibleStep) || 0);
      const completionStep = visibleStep > 0 ? visibleStep : 7;
      const resolvedIdentifierType = resolveStep7LoginIdentifierType(state);
      const phoneNumber = resolvedIdentifierType === 'phone'
        ? String(
          state?.signupPhoneNumber
          || (normalizeStep7IdentifierType(state?.accountIdentifierType) === 'phone' ? state?.accountIdentifier : '')
          || state?.signupPhoneCompletedActivation?.phoneNumber
          || state?.signupPhoneActivation?.phoneNumber
          || ''
        ).trim()
        : '';
      const email = resolvedIdentifierType === 'email'
        ? String(
          state?.email
          || (normalizeStep7IdentifierType(state?.accountIdentifierType) === 'email' ? state?.accountIdentifier : '')
          || ''
        ).trim()
        : '';
      if (
        (resolvedIdentifierType === 'phone' && !phoneNumber)
        || (resolvedIdentifierType !== 'phone' && !email)
      ) {
        throw new Error('缺少登录账号：请先完成步骤 2，或在侧栏“注册邮箱/注册手机号”中手动填写账号后再执行当前步骤。');
      }

      const forceEmailLoginForThisRun = shouldForceStep7EmailLogin(state);

      let attempt = 0;
      let lastError = null;

      while (attempt < STEP6_MAX_ATTEMPTS) {
        throwIfStopped();
        attempt += 1;
        try {
          const rawCurrentState = {
            ...(attempt === 1 ? state : await getState()),
            visibleStep: completionStep,
            ...(resolvedIdentifierType === 'phone' ? {
              forceLoginIdentifierType: 'phone',
              forceEmailLogin: false,
              accountIdentifierType: 'phone',
              accountIdentifier: phoneNumber,
              signupPhoneNumber: phoneNumber,
            } : {}),
          };
          const currentState = forceEmailLoginForThisRun
            ? {
              ...rawCurrentState,
              forceLoginIdentifierType: 'email',
              forceEmailLogin: true,
              signupMethod: 'email',
              resolvedSignupMethod: 'email',
              accountIdentifierType: 'email',
              accountIdentifier: email,
              email,
            }
            : rawCurrentState;
          const password = currentState.password || currentState.customPassword || '';
          const currentIdentifierType = resolveStep7LoginIdentifierType(currentState, resolvedIdentifierType);
          const currentPhoneNumber = currentIdentifierType === 'phone'
            ? String(
              currentState?.signupPhoneNumber
              || (normalizeStep7IdentifierType(currentState?.accountIdentifierType) === 'phone' ? currentState?.accountIdentifier : '')
              || currentState?.signupPhoneCompletedActivation?.phoneNumber
              || currentState?.signupPhoneActivation?.phoneNumber
              || phoneNumber
            ).trim()
            : '';
          const currentEmail = currentIdentifierType === 'email'
            ? String(
              currentState?.email
              || (normalizeStep7IdentifierType(currentState?.accountIdentifierType) === 'email' ? currentState?.accountIdentifier : '')
              || email
            ).trim()
            : '';
          const accountIdentifier = currentIdentifierType === 'phone'
            ? currentPhoneNumber
            : currentEmail;
          const oauthUrl = await refreshOAuthUrlBeforeStep6(currentState);
          if (typeof startOAuthFlowTimeoutWindow === 'function') {
            await startOAuthFlowTimeoutWindow({ step: completionStep, oauthUrl });
          }
          const loginTimeoutMs = typeof getOAuthFlowStepTimeoutMs === 'function'
            ? await getOAuthFlowStepTimeoutMs(180000, {
              step: completionStep,
              actionLabel: 'OAuth 登录并进入验证码页',
              oauthUrl,
            })
            : 180000;

          if (attempt === 1) {
            await addLog('正在打开最新 OAuth 链接并登录...', 'info', {
              step: completionStep,
              stepKey: 'oauth-login',
            });
          } else {
            await addLog(`上一轮失败后，正在进行第 ${attempt} 次尝试（最多 ${STEP6_MAX_ATTEMPTS} 次）...`, 'warn', {
              step: completionStep,
              stepKey: 'oauth-login',
            });
          }

          await reuseOrCreateTab('openai-auth', oauthUrl, { forceNew: true });

          const result = await sendToContentScriptResilient(
            'openai-auth',
            {
              type: 'EXECUTE_NODE',
              nodeId: state?.nodeId || 'oauth-login',
              step: 7,
              source: 'background',
              payload: {
                email: currentEmail,
                phoneNumber: currentPhoneNumber,
                countryId: currentState?.signupPhoneCompletedActivation?.countryId
                  ?? currentState?.signupPhoneActivation?.countryId
                  ?? null,
                countryLabel: String(
                  currentState?.signupPhoneCompletedActivation?.countryLabel
                  || currentState?.signupPhoneActivation?.countryLabel
                  || ''
                ).trim(),
                accountIdentifier,
                loginIdentifierType: currentIdentifierType,
                password,
                visibleStep: completionStep,
              },
            },
            {
              timeoutMs: loginTimeoutMs,
              responseTimeoutMs: loginTimeoutMs,
              retryDelayMs: 700,
              logMessage: '认证页正在切换，等待页面重新就绪后继续登录...',
              logStep: completionStep,
              logStepKey: 'oauth-login',
            }
          );

          if (result?.error) {
            throw new Error(result.error);
          }

          if (isStep6SuccessResult(result)) {
            if (isStep7AlreadyOnVerificationResult(result)) {
              const recoveredPayload = await recoverSmsBowerAlreadyOnVerificationPage(
                currentState,
                oauthUrl,
                result,
                completionStep
              );
              if (recoveredPayload) {
                await completeNodeFromBackground(state?.nodeId || 'oauth-login', recoveredPayload);
                return;
              }
              if (isSmsBowerMailProviderForStep7(currentState)) {
                throw buildStep7AlreadyOnVerificationRestartError(result, completionStep);
              }
            }

            if (isSmsBowerMailProviderForStep7(currentState) && isStep7PlainVerificationResult(result)) {
              await addLog(
                `步骤 ${completionStep}：SMSBower TempMail 未检测到可复用的已登录账号，认证页进入登录验证码页；不会进入步骤 ${completionStep + 1} 获取旧验证码，准备回到步骤 1 注册新号。`,
                'warn',
                { step: completionStep, stepKey: 'oauth-login' }
              );
              throw buildStep7SmsBowerVerificationRestartError(result, completionStep);
            }

            const completionPayload = buildStep7CompletionPayload(
              result,
              { ...(currentState || {}), visibleStep: completionStep },
              currentIdentifierType,
              currentPhoneNumber
            );

            await completeNodeFromBackground(state?.nodeId || 'oauth-login', completionPayload);
            return;
          }

          if (isStep6RecoverableResult(result)) {
            if (isStep7AddPhoneResult(result) || isStep7PhoneVerificationResult(result)) {
              const completionPayload = buildStep7CompletionPayload(
                result,
                { ...(currentState || {}), visibleStep: completionStep },
                currentIdentifierType,
                currentPhoneNumber
              );

              await completeNodeFromBackground(state?.nodeId || 'oauth-login', completionPayload);
              return;
            }

            const reasonMessage = result.message
              || `当前停留在${getLoginAuthStateLabel(result.state)}，准备重新执行步骤 ${completionStep}。`;
            throw new Error(reasonMessage);
          }

          throw new Error(`步骤 ${completionStep}：认证页未返回可识别的登录结果。`);
        } catch (err) {
          throwIfStopped(err);
          if (isRestartCurrentAttemptError(err)) {
            throw err;
          }
          if (isAddPhoneAuthFailure(err)) {
            const latestAddPhoneState = typeof getState === 'function'
              ? await getState().catch(() => state)
              : state;
            await completeStep7PostLoginPhoneHandoff(
              { ...(state || {}), ...(latestAddPhoneState || {}) },
              err,
              completionStep
            );
            return;
          }
          if (isManagementSecretConfigError(err)) {
            await addLog(
              `检测到来源后台管理密钥缺失或错误，不再重试，当前流程停止。原因：${getErrorMessage(err)}`,
              'error',
              { step: completionStep, stepKey: 'oauth-login' }
            );
            throw err;
          }
          lastError = err;
          if (attempt >= STEP6_MAX_ATTEMPTS) {
            break;
          }

          await addLog(`第 ${attempt} 次尝试失败，原因：${getErrorMessage(err)}；准备重试...`, 'warn', {
            step: completionStep,
            stepKey: 'oauth-login',
          });
        }
      }

      throw new Error(`步骤 ${completionStep}：判断失败后已重试 ${STEP6_MAX_ATTEMPTS - 1} 次，仍未成功。最后原因：${getErrorMessage(lastError)}`);
    }

    return { executeStep7 };
  }

  return { createStep7Executor };
});
