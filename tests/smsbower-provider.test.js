const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('phone-sms/providers/smsbower.js', 'utf8');

function loadModule() {
  return new Function('self', `${source}; return self.PhoneSmsBowerProvider;`)({});
}

test('SMSBower provider requests the lowest-price country order by default', async () => {
  const requests = [];
  const module = loadModule();
  const provider = module.createProvider({
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, options });
      return {
        ok: true,
        status: 200,
        async text() {
          return 'ACCESS_NUMBER:176292:+628123456789';
        },
      };
    },
  });

  const activation = await provider.requestActivation({
    smsbowerApiKey: 'key-1',
  });

  const parsedUrl = new URL(requests[0].url);
  const defaultCountryOrder = [6, 33, 39, 31, 16, 151, 10, 73, 19, 52, 43, 53, 46, 187];
  assert.deepStrictEqual(provider.resolveCountryCandidates({}).map((entry) => entry.id), defaultCountryOrder);
  assert.equal(parsedUrl.hostname, 'smsbower.page');
  assert.equal(parsedUrl.searchParams.get('action'), 'getNumber');
  assert.equal(parsedUrl.searchParams.get('api_key'), 'key-1');
  assert.equal(parsedUrl.searchParams.get('service'), 'dr');
  assert.equal(parsedUrl.searchParams.get('country'), '6');
  assert.equal(parsedUrl.searchParams.get('providerIds'), '3267');
  assert.equal(parsedUrl.searchParams.get('maxPrice'), '0.1');
  assert.deepStrictEqual(activation, {
    activationId: '176292',
    phoneNumber: '+628123456789',
    provider: 'smsbower',
    serviceCode: 'dr',
    countryId: 6,
    countryLabel: 'Indonesia',
    selectedPrice: '0.1',
    providerIds: '3267',
    successfulUses: 0,
    maxUses: 1,
  });
});

test('SMSBower provider logs Brazil failures with country and providerId context before falling back to USA', async () => {
  const requests = [];
  const logs = [];
  const module = loadModule();
  const provider = module.createProvider({
    addLog: async (message, level) => {
      logs.push({ message, level });
    },
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const country = parsedUrl.searchParams.get('country');
      if (action !== 'getNumber') {
        throw new Error(`Unexpected SMSBower action: ${action}`);
      }
      if (country === '73') {
        throw new TypeError('Failed to fetch');
      }
      if (country === '187') {
        return {
          ok: true,
          status: 200,
          async text() {
            return 'ACCESS_NUMBER:176293:+12025550123';
          },
        };
      }
      throw new Error(`Unexpected SMSBower country: ${country}`);
    },
  });

  const activation = await provider.requestActivation({
    smsbowerApiKey: 'key-1',
    smsbowerCountryOrder: [73, 187],
  });

  assert.equal(requests[0].searchParams.get('country'), '73');
  assert.equal(requests[0].searchParams.get('providerIds'), '3237');
  assert.equal(requests[1].searchParams.get('providerIds'), '3365');
  assert.equal(requests[7].searchParams.get('country'), '187');
  assert.equal(requests[7].searchParams.get('providerIds'), '3170');
  assert.equal(activation.countryId, 187);
  assert.equal(activation.countryLabel, 'USA');
  assert.equal(activation.providerIds, '3170');
  assert.equal(
    logs.some((entry) => (
      entry.level === 'warn'
      && /Brazil/.test(entry.message)
      && /73/.test(entry.message)
      && /网络请求失败/.test(entry.message)
      && /Failed to fetch/.test(entry.message)
      && /providerIds=3237/.test(entry.message)
    )),
    true
  );
});

test('SMSBower provider migrates legacy Thailand provider id to country code before requesting', async () => {
  const requests = [];
  const module = loadModule();
  const provider = module.createProvider({
    fetchImpl: async (url) => {
      requests.push(new URL(url));
      return {
        ok: true,
        status: 200,
        async text() {
          return 'ACCESS_NUMBER:176294:+66812345678';
        },
      };
    },
  });

  const activation = await provider.requestActivation({
    smsbowerApiKey: 'key-1',
    smsbowerCountryOrder: [3237],
    smsbowerProviderIds: '3237',
  });

  assert.equal(requests[0].searchParams.get('country'), '52');
  assert.equal(requests[0].searchParams.get('providerIds'), '3237');
  assert.equal(activation.countryId, 52);
  assert.equal(activation.countryLabel, 'Thailand');
  assert.equal(activation.providerIds, '3237');
});

test('SMSBower provider polls STATUS_OK and completes activation', async () => {
  const requests = [];
  const module = loadModule();
  const provider = module.createProvider({
    fetchImpl: async (url) => {
      requests.push(new URL(url));
      const action = requests.at(-1).searchParams.get('action');
      return {
        ok: true,
        status: 200,
        async text() {
          if (action === 'getStatus') {
            return 'STATUS_OK:123456';
          }
          return 'ACCESS_ACTIVATION';
        },
      };
    },
  });

  const code = await provider.pollActivationCode(
    { smsbowerApiKey: 'key-1' },
    { activationId: '176292', phoneNumber: '+14075045913', countryId: 187 },
    { maxRounds: 1 }
  );
  const complete = await provider.finishActivation(
    { smsbowerApiKey: 'key-1' },
    { activationId: '176292', phoneNumber: '+14075045913', countryId: 187 }
  );

  assert.equal(code, '123456');
  assert.equal(complete, 'ACCESS_ACTIVATION');
  assert.equal(requests[0].searchParams.get('action'), 'getStatus');
  assert.equal(requests[1].searchParams.get('action'), 'setStatus');
  assert.equal(requests[1].searchParams.get('status'), '6');
});

test('SMSBower provider derives provider IDs from the selected country order when the saved value is still default', async () => {
  const requests = [];
  const module = loadModule();
  const provider = module.createProvider({
    fetchImpl: async (url) => {
      requests.push(new URL(url));
      return {
        ok: true,
        status: 200,
        async text() {
          return 'ACCESS_NUMBER:176292:+56999999999';
        },
      };
    },
  });

  const activation = await provider.requestActivation({
    smsbowerApiKey: 'key-1',
    smsbowerCountryOrder: [33, 187],
    smsbowerProviderIds: '3170',
  });

  const parsedUrl = requests[0];
  assert.equal(parsedUrl.searchParams.get('country'), '33');
  assert.equal(parsedUrl.searchParams.get('providerIds'), '3243');
  assert.equal(activation.countryId, 33);
  assert.equal(activation.countryLabel, 'Colombia');
  assert.equal(activation.providerIds, '3243');
});

test('SMSBower provider prefers the low-price Gold Thailand line before Silver fallbacks', async () => {
  const requests = [];
  const module = loadModule();
  const provider = module.createProvider({
    fetchImpl: async (url) => {
      requests.push(new URL(url));
      return {
        ok: true,
        status: 200,
        async text() {
          return 'ACCESS_NUMBER:176296:+66812345678';
        },
      };
    },
  });

  const activation = await provider.requestActivation({
    smsbowerApiKey: 'key-1',
    smsbowerCountryOrder: [52],
    smsbowerProviderIds: '3170',
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].searchParams.get('country'), '52');
  assert.equal(requests[0].searchParams.get('providerIds'), '3237');
  assert.equal(requests[0].searchParams.get('maxPrice'), '0.1');
  assert.equal(activation.countryId, 52);
  assert.equal(activation.countryLabel, 'Thailand');
  assert.equal(activation.providerIds, '3237');
});

test('SMSBower provider skips timed-out provider IDs within the same country', async () => {
  const requests = [];
  const module = loadModule();
  const provider = module.createProvider({
    fetchImpl: async (url) => {
      requests.push(new URL(url));
      return {
        ok: true,
        status: 200,
        async text() {
          return 'ACCESS_NUMBER:176297:+66812345679';
        },
      };
    },
  });

  const activation = await provider.requestActivation({
    smsbowerApiKey: 'key-1',
    smsbowerCountryOrder: [52],
    smsbowerProviderIds: '3237,2266,3193',
  }, {
    blockedProviderIds: ['52:3237'],
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].searchParams.get('country'), '52');
  assert.equal(requests[0].searchParams.get('providerIds'), '2266');
  assert.equal(activation.countryId, 52);
  assert.equal(activation.providerIds, '2266');
});

test('SMSBower provider continues through a randomized non-USA country queue when one country has no numbers', async () => {
  const requests = [];
  const module = loadModule();
  const provider = module.createProvider({
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const country = parsedUrl.searchParams.get('country');
      return {
        ok: true,
        status: 200,
        async text() {
          return country === '6'
            ? 'ACCESS_NUMBER:176298:+628123456789'
            : 'NO_NUMBERS';
        },
      };
    },
  });

  const activation = await provider.requestActivation({
    smsbowerApiKey: 'key-1',
    smsbowerCountryOrder: [52, 6],
    smsbowerProviderIds: '3237,2266,3193,3267',
  });

  assert.equal(requests[0].searchParams.get('country'), '52');
  assert.equal(requests[0].searchParams.get('providerIds'), '3237');
  assert.equal(requests[1].searchParams.get('country'), '52');
  assert.equal(requests[1].searchParams.get('providerIds'), '2266');
  assert.equal(requests[2].searchParams.get('country'), '52');
  assert.equal(requests[2].searchParams.get('providerIds'), '3193');
  assert.equal(requests[3].searchParams.get('country'), '6');
  assert.equal(requests[3].searchParams.get('providerIds'), '3267');
  assert.equal(activation.countryId, 6);
  assert.equal(activation.countryLabel, 'Indonesia');
  assert.equal(activation.providerIds, '3267');
});

test('SMSBower random mode reshuffles non-USA countries on every activation request', async () => {
  const requests = [];
  const randomValues = [0, 0.99];
  const module = loadModule();
  const provider = module.createProvider({
    randomFn: () => randomValues.shift() ?? 0,
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const country = parsedUrl.searchParams.get('country');
      return {
        ok: true,
        status: 200,
        async text() {
          return country === '6'
            ? 'ACCESS_NUMBER:176299:+628123456780'
            : 'ACCESS_NUMBER:176300:+66812345670';
        },
      };
    },
  });

  const state = {
    smsbowerApiKey: 'key-1',
    smsbowerCountryOrder: [52, 6, 187],
    smsbowerProviderIds: '3170',
    smsbowerRandomMode: true,
  };

  const firstActivation = await provider.requestActivation(state);
  const secondActivation = await provider.requestActivation(state);

  assert.equal(requests[0].searchParams.get('country'), '6');
  assert.equal(requests[1].searchParams.get('country'), '52');
  assert.notEqual(requests[0].searchParams.get('country'), '187');
  assert.notEqual(requests[1].searchParams.get('country'), '187');
  assert.equal(firstActivation.countryId, 6);
  assert.equal(secondActivation.countryId, 52);
});

test('SMSBower random mode reshuffles provider IDs inside the selected country', async () => {
  const requests = [];
  const module = loadModule();
  const provider = module.createProvider({
    randomFn: () => 0,
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      return {
        ok: true,
        status: 200,
        async text() {
          return 'ACCESS_NUMBER:176301:+573001234568';
        },
      };
    },
  });

  const activation = await provider.requestActivation({
    smsbowerApiKey: 'key-1',
    smsbowerCountryOrder: [33],
    smsbowerProviderIds: '3243,2236,3288,3406,3160,3335',
    smsbowerRandomMode: true,
  });

  assert.equal(requests[0].searchParams.get('country'), '33');
  assert.equal(requests[0].searchParams.get('providerIds'), '2236');
  assert.equal(activation.countryId, 33);
  assert.equal(activation.providerIds, '2236');
});

test('SMSBower provider tries the next provider ID in the same country when a line has no numbers', async () => {
  const requests = [];
  const module = loadModule();
  const provider = module.createProvider({
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const providerIds = parsedUrl.searchParams.get('providerIds');
      return {
        ok: true,
        status: 200,
        async text() {
          return providerIds === '2236'
            ? 'ACCESS_NUMBER:176295:+573001234567'
            : 'NO_NUMBERS';
        },
      };
    },
  });

  const activation = await provider.requestActivation({
    smsbowerApiKey: 'key-1',
    smsbowerCountryOrder: [33],
    smsbowerProviderIds: '3243,2236,3288,3406,3160,3335',
    smsbowerMaxPrice: '0.2',
  });

  assert.equal(requests.length, 2);
  assert.equal(requests[0].searchParams.get('country'), '33');
  assert.equal(requests[0].searchParams.get('providerIds'), '3243');
  assert.equal(requests[0].searchParams.get('maxPrice'), '0.1');
  assert.equal(requests[1].searchParams.get('country'), '33');
  assert.equal(requests[1].searchParams.get('providerIds'), '2236');
  assert.equal(requests[1].searchParams.get('maxPrice'), '0.1');
  assert.equal(activation.countryId, 33);
  assert.equal(activation.countryLabel, 'Colombia');
  assert.equal(activation.providerIds, '2236');
  assert.equal(activation.selectedPrice, '0.1');
});

test('SMSBower provider cancels activation with status 8', async () => {
  const requests = [];
  const module = loadModule();
  const provider = module.createProvider({
    fetchImpl: async (url) => {
      requests.push(new URL(url));
      return {
        ok: true,
        status: 200,
        async text() {
          return 'ACCESS_CANCEL';
        },
      };
    },
  });

  const result = await provider.cancelActivation(
    { smsbowerApiKey: 'key-1' },
    { activationId: '176292', phoneNumber: '+14075045913', countryId: 187 }
  );

  assert.equal(result, 'ACCESS_CANCEL');
  assert.equal(requests[0].searchParams.get('action'), 'setStatus');
  assert.equal(requests[0].searchParams.get('status'), '8');
});
