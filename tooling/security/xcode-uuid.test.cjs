const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const test = require('node:test');
const xcode = require('xcode');
const requireFromXcode = createRequire(require.resolve('xcode'));
const uuid = requireFromXcode('uuid');

test('Xcode generates unique project identifiers through its CommonJS UUID dependency', () => {
  const project = xcode.project('synthetic.pbxproj');
  project.hash = { project: { objects: { PBXGroup: {} } } };
  const identifiers = new Set();
  for (let index = 0; index < 100; index += 1) {
    const identifier = project.generateUuid();
    assert.match(identifier, /^[0-9A-F]{24}$/);
    assert.equal(identifiers.has(identifier), false);
    identifiers.add(identifier);
    project.hash.project.objects.PBXGroup[identifier] = {};
  }
});

test('the UUID dependency used by Xcode rejects undersized name-based output buffers', () => {
  for (const generate of [uuid.v3, uuid.v5]) {
    const buffer = new Uint8Array(8).fill(0x7f);
    assert.throws(() => generate('synthetic', generate.DNS, buffer));
    assert.deepEqual(buffer, new Uint8Array(8).fill(0x7f));
  }
});
