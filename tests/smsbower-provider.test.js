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
  const defaultCountryOrder = [48, 78, 6, 33, 16, 151, 31, 73, 52, 95, 85, 19, 10, 269, 160, 5560, 1099, 708, 976, 2058, 3118, 18397, 43, 53, 54, 39, 46, 215, 187];
  assert.deepStrictEqual(provider.resolveCountryCandidates({}).map((entry) => entry.id), defaultCountryOrder);
  assert.equal(parsedUrl.hostname, 'smsbower.page');
  assert.equal(parsedUrl.searchParams.get('action'), 'getNumber');
  assert.equal(parsedUrl.searchParams.get('api_key'), 'key-1');
  assert.equal(parsedUrl.searchParams.get('service'), 'dr');
  assert.equal(parsedUrl.searchParams.get('country'), '48');
  assert.equal(parsedUrl.searchParams.get('providerIds'), '2442');
  assert.equal(parsedUrl.searchParams.get('maxPrice'), '0.12');
  assert.deepStrictEqual(activation, {
    activationId: '176292',
    phoneNumber: '+628123456789',
    provider: 'smsbower',
    serviceCode: 'dr',
    countryId: 48,
    countryLabel: 'Netherlands',
    selectedPrice: '0.12',
    providerIds: '2442',
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
  assert.equal(requests[0].searchParams.get('providerIds'), '3416');
  assert.equal(requests[1].searchParams.get('providerIds'), '3415');
  assert.equal(requests[2].searchParams.get('providerIds'), '3413');
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
      && /providerIds=3416/.test(entry.message)
    )),
    true
  );
});

test('SMSBower provider migrates legacy Thailand provider id to country code before using current line priority', async () => {
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
  assert.equal(requests[0].searchParams.get('providerIds'), '2266');
  assert.equal(activation.countryId, 52);
  assert.equal(activation.countryLabel, 'Thailand');
  assert.equal(activation.providerIds, '2266');
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

test('SMSBower provider prefers the low-price Silver Thailand lines before unknown fallbacks', async () => {
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
  assert.equal(requests[0].searchParams.get('providerIds'), '2266');
  assert.equal(requests[0].searchParams.get('maxPrice'), '0.12');
  assert.equal(activation.countryId, 52);
  assert.equal(activation.countryLabel, 'Thailand');
  assert.equal(activation.providerIds, '2266');
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
    smsbowerProviderIds: '2266,3193,3237',
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
    smsbowerProviderIds: '2266,3193,3237,3408',
  });

  assert.equal(requests[0].searchParams.get('country'), '52');
  assert.equal(requests[0].searchParams.get('providerIds'), '2266');
  assert.equal(requests[1].searchParams.get('country'), '52');
  assert.equal(requests[1].searchParams.get('providerIds'), '3193');
  assert.equal(requests[2].searchParams.get('country'), '52');
  assert.equal(requests[2].searchParams.get('providerIds'), '3237');
  assert.equal(requests[3].searchParams.get('country'), '6');
  assert.equal(requests[3].searchParams.get('providerIds'), '3237');
  assert.equal(activation.countryId, 6);
  assert.equal(activation.countryLabel, 'Indonesia');
  assert.equal(activation.providerIds, '3237');
});

test('SMSBower random mode uses the full non-USA default pool instead of the saved country subset', async () => {
  const requests = [];
  const module = loadModule();
  const provider = module.createProvider({
    randomFn: () => 0,
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const country = parsedUrl.searchParams.get('country');
      return {
        ok: true,
        status: 200,
        async text() {
          return `ACCESS_NUMBER:176299:+${country}8123456780`;
        },
      };
    },
  });

  const state = {
    smsbowerApiKey: 'key-1',
    smsbowerCountryOrder: [52, 187],
    smsbowerProviderIds: '3170',
    smsbowerRandomMode: true,
  };

  const activation = await provider.requestActivation(state);

  assert.equal(requests[0].searchParams.get('country'), '48');
  assert.equal(requests[0].searchParams.get('providerIds'), '2442');
  assert.notEqual(requests[0].searchParams.get('country'), '187');
  assert.notEqual(requests[0].searchParams.get('country'), '52');
  assert.equal(activation.countryId, 48);
  assert.equal(activation.countryLabel, 'Netherlands');
});

test('SMSBower random mode keeps Gold provider IDs before Silver and unknown lines', async () => {
  const requests = [];
  const randomValues = [0.11, ...Array(27).fill(0), 0];
  const module = loadModule();
  const provider = module.createProvider({
    randomFn: () => randomValues.shift() ?? 0.999999,
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
    smsbowerProviderIds: '3243,3253,3288,3160',
    smsbowerRandomMode: true,
  });

  assert.equal(requests[0].searchParams.get('country'), '33');
  assert.match(requests[0].searchParams.get('providerIds'), /^(3243|3253)$/);
  assert.notEqual(requests[0].searchParams.get('providerIds'), '3288');
  assert.equal(activation.countryId, 33);
  assert.match(activation.providerIds, /^(3243|3253)$/);
});

test('SMSBower random mode weights countries and provider IDs with recent successful code records', async () => {
  const requests = [];
  const randomValues = [0.3, ...Array(27).fill(0), 0.3];
  const module = loadModule();
  const provider = module.createProvider({
    randomFn: () => randomValues.shift() ?? 0,
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      return {
        ok: true,
        status: 200,
        async text() {
          return 'ACCESS_NUMBER:176302:+573001234569';
        },
      };
    },
  });

  const activation = await provider.requestActivation({
    smsbowerApiKey: 'key-1',
    smsbowerCountryOrder: [52, 187],
    smsbowerProviderIds: '3170',
    smsbowerRandomMode: true,
    smsbowerSuccessWeightsByCountry: {
      33: {
        3253: { successCount: 6, lastSuccessAt: Date.now() },
      },
    },
  });

  assert.equal(requests[0].searchParams.get('country'), '33');
  assert.equal(requests[0].searchParams.get('providerIds'), '3253');
  assert.equal(activation.countryId, 33);
  assert.equal(activation.countryLabel, 'Colombia');
  assert.equal(activation.providerIds, '3253');
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
          return providerIds === '3253'
            ? 'ACCESS_NUMBER:176295:+573001234567'
            : 'NO_NUMBERS';
        },
      };
    },
  });

  const activation = await provider.requestActivation({
    smsbowerApiKey: 'key-1',
    smsbowerCountryOrder: [33],
    smsbowerProviderIds: '3243,3253,3288,3160',
    smsbowerMaxPrice: '0.2',
  });

  assert.equal(requests.length, 2);
  assert.equal(requests[0].searchParams.get('country'), '33');
  assert.equal(requests[0].searchParams.get('providerIds'), '3243');
  assert.equal(requests[0].searchParams.get('maxPrice'), '0.12');
  assert.equal(requests[1].searchParams.get('country'), '33');
  assert.equal(requests[1].searchParams.get('providerIds'), '3253');
  assert.equal(requests[1].searchParams.get('maxPrice'), '0.12');
  assert.equal(activation.countryId, 33);
  assert.equal(activation.countryLabel, 'Colombia');
  assert.equal(activation.providerIds, '3253');
  assert.equal(activation.selectedPrice, '0.12');
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

test('SMSBower provider parses balance and V3 provider price tiers', async () => {
  const requests = [];
  const module = loadModule();
  const provider = module.createProvider({
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      return {
        ok: true,
        status: 200,
        async text() {
          if (action === 'getBalance') {
            return 'ACCESS_BALANCE:12.3456';
          }
          return JSON.stringify({
            187: {
              dr: {
                3170: { count: 8123, price: 0.12, provider_id: 3170 },
                2495: { count: 8924, price: 0.118, provider_id: 2495 },
              },
            },
          });
        },
      };
    },
  });

  const balance = await provider.fetchBalance({ smsbowerApiKey: 'key-1' });
  const prices = await provider.fetchPrices(
    { smsbowerApiKey: 'key-1' },
    { id: 187, label: 'USA' }
  );
  const range = await provider.fetchPriceRange(
    { smsbowerApiKey: 'key-1' },
    { id: 187, label: 'USA' }
  );

  assert.equal(balance.balance, 12.3456);
  assert.equal(requests[1].searchParams.get('action'), 'getPricesV3');
  assert.equal(requests[1].searchParams.get('service'), 'dr');
  assert.equal(requests[1].searchParams.get('country'), '187');
  assert.deepStrictEqual(prices.entries.map((entry) => ({
    providerId: entry.providerId,
    price: entry.price,
    count: entry.count,
  })), [
    { providerId: '2495', price: 0.118, count: 8924 },
    { providerId: '3170', price: 0.12, count: 8123 },
  ]);
  assert.deepStrictEqual(range.prices, [0.118, 0.12]);
  assert.equal(range.minPrice, 0.118);
  assert.equal(range.maxPrice, 0.12);
});
