const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vendorRoot = path.resolve(__dirname, '../vendor');
const workspaceRequire = require('node:module').createRequire(path.resolve(__dirname, '../../frontend/package.json'));
const records = JSON.parse(readFileSync(path.join(vendorRoot, 'provenance.json'), 'utf8'));

test('local archives reproduce exactly from reviewed sources and authentic upstream archives', () => {
  const result = spawnSync('python3', [path.join(vendorRoot, 'build.py'), '--check'], { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

for (const record of records) {
  test(`${record.name}: installed package matches reviewed archive contents`, () => {
    let directory = path.dirname(workspaceRequire.resolve(record.name));
    while (true) {
      const manifest = path.join(directory, 'package.json');
      if (existsSync(manifest) && JSON.parse(readFileSync(manifest, 'utf8')).name === record.name) break;
      const parent = path.dirname(directory);
      assert.notEqual(parent, directory, 'Unable to locate installed package root');
      directory = parent;
    }
    for (const [file, expected] of Object.entries(record.files)) {
      const actual = createHash('sha256').update(readFileSync(path.join(directory, file))).digest('hex');
      assert.equal(actual, expected, `${record.name}/${file} differs from reviewed source`);
    }
  });
}
