const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
const test = require('node:test');
const workspaceRequire = createRequire(require('node:path').resolve(__dirname, '../../frontend/package.json'));
const queryString = workspaceRequire('query-string');
const requireFromConsumer = createRequire(workspaceRequire.resolve('query-string'));
const decoderPath = process.env.SECURITY_DECODER_PATH || requireFromConsumer.resolve('decode-uri-component');
const decode = require(decoderPath);

test('malformed percent-encoded runs finish within a bounded worker', () => {
  const result = spawnSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const decode = require(process.argv[1]);
    const input = '%C0'.repeat(100000);
    assert.equal(decode(input), input);
  `, decoderPath], { timeout: 5000, encoding: 'utf8' });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
});

test('decoder preserves valid Unicode and tolerates malformed escapes', () => {
  assert.equal(decode('st%C3%A5le%20%F0%9F%8F%89'), 'ståle 🏉');
  assert.equal(decode('%E2%82%AC%GG%C0%AF%'), '€%GG%C0%AF%');
  assert.equal(decode('%FE%FF'), '\uFFFD\uFFFD');
  assert.equal(decode('%C2'), '\uFFFD');
  assert.equal(decode('%'), '%');
  assert.throws(() => decode(42), TypeError);
});

test('query-string consumer handles Unicode, malformed parameters and round trips', () => {
  assert.deepEqual({ ...queryString.parse('name=st%C3%A5le&broken=%GG&tag=a&tag=b') }, {
    broken: '%GG', name: 'ståle', tag: ['a', 'b'],
  });
  const input = { name: 'Ireland 🏉', invite: 'a+b', empty: '' };
  assert.deepEqual({ ...queryString.parse(queryString.stringify(input)) }, input);
});

test('the CommonJS decoder is also the ESM default export', async () => {
  const { pathToFileURL } = require('node:url');
  const imported = await import(pathToFileURL(decoderPath).href);
  assert.equal(imported.default, decode);
});
