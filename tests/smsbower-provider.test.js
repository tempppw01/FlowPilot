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
          return 'ACCESS_NUMBER:176292:+14075045913';
        },
      };
    },
  });

  const activation = await provider.requestActivation({
    smsbowerApiKey: 'key-1',
  });

  const parsedUrl = new URL(requests[0].url);
  const defaultCountryOrder = [3267, 3243, 2649, 3234, 2920, 3160, 2974, 3316, 2266, 3237, 3398, 2377, 187];
  const expectedProviderIds = defaultCountryOrder.map((countryId) => (countryId === 187 ? '3170' : String(countryId))).join(',');
  assert.equal(parsedUrl.hostname, 'smsbower.page');
  assert.equal(parsedUrl.searchParams.get('action'), 'getNumber');
  assert.equal(parsedUrl.searchParams.get('api_key'), 'key-1');
  assert.equal(parsedUrl.searchParams.get('service'), 'dr');
  assert.equal(parsedUrl.searchParams.get('country'), '3267');
  assert.equal(parsedUrl.searchParams.get('providerIds'), expectedProviderIds);
  assert.equal(parsedUrl.searchParams.get('maxPrice'), '0.134');
  assert.deepStrictEqual(activation, {
    activationId: '176292',
    phoneNumber: '+14075045913',
    provider: 'smsbower',
    serviceCode: 'dr',
    countryId: 3267,
    countryLabel: 'Indonesia',
    selectedPrice: '0.134',
    providerIds: expectedProviderIds,
    successfulUses: 0,
    maxUses: 1,
  });
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
    smsbowerCountryOrder: [3243, 187],
    smsbowerProviderIds: '3170',
  });

  const parsedUrl = requests[0];
  assert.equal(parsedUrl.searchParams.get('country'), '3243');
  assert.equal(parsedUrl.searchParams.get('providerIds'), '3243,3170');
  assert.equal(activation.countryId, 3243);
  assert.equal(activation.countryLabel, 'Colombia');
  assert.equal(activation.providerIds, '3243,3170');
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
