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
  const defaultCountryOrder = [22, 52, 73, 48, 78, 6, 33, 16, 151, 31, 95, 85, 19, 10, 269, 160, 5560, 1099, 708, 976, 2058, 3118, 18397, 43, 53, 54, 39, 46, 215, 187];
  assert.deepStrictEqual(provider.resolveCountryCandidates({}).map((entry) => entry.id), defaultCountryOrder);
  assert.equal(parsedUrl.hostname, 'smsbower.page');
  assert.equal(parsedUrl.searchParams.get('action'), 'getNumber');
  assert.equal(parsedUrl.searchParams.get('api_key'), 'key-1');
  assert.equal(parsedUrl.searchParams.get('service'), 'dr');
  assert.equal(parsedUrl.searchParams.get('country'), '22');
  assert.equal(parsedUrl.searchParams.get('providerIds'), '2266');
  assert.equal(parsedUrl.searchParams.get('maxPrice'), '0.0999');
  assert.deepStrictEqual(activation, {
    activationId: '176292',
    phoneNumber: '+628123456789',
    provider: 'smsbower',
    serviceCode: 'dr',
    countryId: 22,
    countryLabel: 'India',
    selectedPrice: '0.0999',
    providerIds: '2266',
    successfulUses: 0,
    maxUses: 1,
  });
});

test('SMSBower keeps India purchases strictly below ten cents', async () => {
  const requests = [];
  const module = loadModule();
  const provider = module.createProvider({
    fetchImpl: async (url) => {
      requests.push(new URL(url));
      return {
        ok: true,
        status: 200,
        async text() {
          return 'ACCESS_NUMBER:176295:+919876543210';
        },
      };
    },
  });

  const activation = await provider.requestActivation({
    smsbowerApiKey: 'key-1',
    smsbowerCountryOrder: [22],
    smsbowerMaxPrice: '0.12',
  });

  assert.equal(requests[0].searchParams.get('country'), '22');
  assert.equal(requests[0].searchParams.get('providerIds'), '2266');
  assert.equal(requests[0].searchParams.get('maxPrice'), '0.0999');
  assert.equal(activation.countryId, 22);
  assert.equal(activation.providerIds, '2266');
});

test('SMSBower catalog excludes India and Chile lines priced at or above ten cents', async () => {
  const module = loadModule();
  const provider = module.createProvider({
    fetchImpl: async (url) => {
      const action = new URL(url).searchParams.get('action');
      const payload = action === 'getCountries'
        ? {
          22: { chn: '印度', eng: 'India' },
          151: { chn: '智利', eng: 'Chile' },
        }
        : {
          22: { dr: {
            2260: { count: 10, price: 0.316, provider_id: 2260 },
            3193: { count: 10, price: 0.067, provider_id: 3193 },
            2266: { count: 10, price: 0.054, provider_id: 2266 },
          } },
          151: { dr: {
            3350: { count: 10, price: 0.08, provider_id: 3350 },
            3419: { count: 10, price: 0.052, provider_id: 3419 },
            3001: { count: 10, price: 0.178, provider_id: 3001 },
          } },
        };
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify(payload);
        },
      };
    },
  });

  const catalog = await provider.fetchCountryCatalog({
    smsbowerApiKey: 'key-1',
    smsbowerServiceCode: 'dr',
  });

  assert.deepStrictEqual(catalog.countries, [
    { id: 151, label: '智利', providerIds: '3419,3350', price: 0.052, count: 20 },
    { id: 22, label: '印度', providerIds: '2266,3193', price: 0.054, count: 20 },
  ]);
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

  assert.equal(requests[0].searchParams.get('country'), '22');
  assert.equal(requests[0].searchParams.get('providerIds'), '2266');
  assert.notEqual(requests[0].searchParams.get('country'), '187');
  assert.notEqual(requests[0].searchParams.get('country'), '52');
  assert.equal(activation.countryId, 22);
  assert.equal(activation.countryLabel, 'India');
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

  assert.equal(requests[0].searchParams.get('country'), '48');
  assert.equal(requests[0].searchParams.get('providerIds'), '2442');
  assert.equal(activation.countryId, 48);
  assert.equal(activation.countryLabel, 'Netherlands');
  assert.equal(activation.providerIds, '2442');
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
  assert.match(requests[0].searchParams.get('providerIds'), /^(3243|3253)$/);
  assert.equal(activation.countryId, 33);
  assert.equal(activation.countryLabel, 'Colombia');
  assert.match(activation.providerIds, /^(3243|3253)$/);
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

test('SMSBower fixed country mode only requests the configured country id', async () => {
  const requests = [];
  const module = loadModule();
  const provider = module.createProvider({
    fetchImpl: async (url) => {
      requests.push(new URL(url));
      return {
        ok: true,
        status: 200,
        async text() {
          return 'ACCESS_NUMBER:fixed-1:+999123456789';
        },
      };
    },
  });

  const state = {
    smsbowerApiKey: 'key-1',
    smsbowerCountryOrder: [187, 52],
    smsbowerFixedCountryId: 999,
    smsbowerFixedCountryLabel: 'Fixed country',
    smsbowerProviderIds: '3170,2495',
  };
  assert.deepStrictEqual(provider.resolveCountryCandidates(state), [
    { id: 999, label: 'Fixed country' },
  ]);

  const activation = await provider.requestActivation(state);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].searchParams.get('country'), '999');
  assert.equal(requests[0].searchParams.has('providerIds'), false);
  assert.equal(activation.countryId, 999);
});

test('SMSBower fixed country mode rejects an empty country id instead of falling back', () => {
  const module = loadModule();
  const provider = module.createProvider();

  assert.throws(
    () => provider.resolveCountryCandidates({
      smsbowerCountryMode: 'fixed',
      smsbowerFixedCountryId: 0,
      smsbowerCountryOrder: [187, 52],
    }),
    /请先填写有效的固定国家 ID/
  );
});

test('SMSBower provider loads country names, provider ids and minimum prices from upstream', async () => {
  const requests = [];
  const module = loadModule();
  const provider = module.createProvider({
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      requests.push(parsedUrl);
      const action = parsedUrl.searchParams.get('action');
      const payload = action === 'getCountries'
        ? {
          187: { chn: '美国', eng: 'USA' },
          52: { chn: '泰国', eng: 'Thailand' },
        }
        : {
          187: { dr: {
            3170: { count: 3, price: 0.12, provider_id: 3170 },
            2495: { count: 4, price: 0.118, provider_id: 2495 },
          } },
          52: { dr: {
            2266: { count: 5, price: 0.054, provider_id: 2266 },
          } },
        };
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify(payload);
        },
      };
    },
  });

  const catalog = await provider.fetchCountryCatalog({
    smsbowerApiKey: 'key-1',
    smsbowerServiceCode: 'dr',
  });

  assert.deepStrictEqual(requests.map((request) => request.searchParams.get('action')), [
    'getCountries',
    'getPricesV3',
  ]);
  assert.deepStrictEqual(catalog.countries, [
    { id: 52, label: '泰国', providerIds: '2266', price: 0.054, count: 5 },
    { id: 187, label: '美国', providerIds: '2495,3170', price: 0.118, count: 7 },
  ]);
});
