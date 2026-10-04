'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { createRequire } = require('node:module');
const workspaceRequire = createRequire(path.resolve(__dirname, '../../frontend/package.json'));
const target = process.env.BRACES_TEST_TARGET || path.dirname(workspaceRequire.resolve('braces'));
const braces = require(target);
const nested = (n, open = '{', close = '}') => open.repeat(n) + 'a' + close.repeat(n);

test('normal patterns preserve expansion and regex compilation', () => {
  assert.deepEqual(braces.expand('src/{app,lib}/{a,b}.js'), ['src/app/a.js','src/app/b.js','src/lib/a.js','src/lib/b.js']);
  assert.equal(braces.compile('a/{b,c}/d'), 'a/(b|c)/d');
  assert.deepEqual(braces.expand('{1..3}'), ['1','2','3']);
  assert.throws(() => braces.expand('{1..1001}'), RangeError);
  assert.equal(braces.stringify(braces.parse('a/{b,c}/d')), 'a/{b,c}/d');
});

test('nesting limit applies to braces, parentheses and mixed blocks', () => {
  for (const [open,close] of [['{','}'], ['(',')'], ['{(',')}']]) {
    const atLimit = open.length === 2 ? 64 : 128;
    for (const method of ['parse','compile','expand','stringify']) {
      assert.doesNotThrow(() => braces[method](nested(atLimit, open, close)));
      assert.throws(() => braces[method](nested(atLimit + 1, open, close), { maxDepth: Infinity }), { name:'RangeError', message:/nesting depth/ });
    }
  }
  assert.throws(() => braces.parse('{'.repeat(129)), { name:'RangeError', message:/nesting depth/ });
});

test('literal delimiters do not count as structural nesting', () => {
  for (const input of ['\\{'.repeat(200), '"' + '{('.repeat(200) + '"', "'" + '{('.repeat(200) + "'", '`' + '{('.repeat(200) + '`', '[' + '{('.repeat(200) + ']']) {
    assert.doesNotThrow(() => braces.parse(input));
  }
  assert.doesNotThrow(() => braces.parse('{'.repeat(128)));
  assert.doesNotThrow(() => braces.parse('})))literal'));
});

test('direct internal and public AST consumers reject depth and cycles', () => {
  for (const method of ['compile','expand','stringify']) {
    for (const consume of [braces[method], require(path.join(target, 'lib', method))]) {
      let ast = { type:'root', nodes:[] }; let node = ast;
      for (let i=0; i<129; i++) { const child = {type:'paren',nodes:[]}; node.nodes.push(child); node = child; }
      assert.throws(() => consume(ast), { name:'RangeError', message:/nesting depth/ });
      ast = { type:'root', nodes:[] }; ast.nodes.push(ast);
      assert.throws(() => consume(ast), { name:'TypeError', message:/cyclic/ });
    }
  }
  let fakeRoot = {type:'root',nodes:[]}; let cursor = fakeRoot;
  for(let i=0;i<129;i++) { const child={type:'root',nodes:[]}; cursor.nodes.push(child); cursor=child; }
  assert.throws(() => braces.stringify(fakeRoot), {name:'RangeError',message:/nesting depth/});
  const badParent = { type:'paren', nodes:[] }; badParent.parent = badParent;
  assert.throws(() => braces.expand({type:'root',nodes:[badParent]}), {name:'TypeError',message:/cyclic/});
  const ast = braces.parse('{a,b}');
  assert.equal(braces.stringify(ast), '{a,b}'); // legitimate parent and prev references
  const child = {type:'text', value:'a'};
  assert.equal(braces.stringify({type:'root',nodes:[child,child]}), 'aa'); // DAG, not a cycle
});

test('hostile inputs terminate in isolated processes', () => {
  const script = `const b=require(${JSON.stringify(target)}); for(const input of ['{'.repeat(9000), '('.repeat(9000), '{('.repeat(4500)]) { try {b.compile(input); process.exit(2);} catch(e) {if(e.name!=='RangeError'|| !/nesting depth/.test(e.message)) process.exit(3);} }`;
  const result = spawnSync(process.execPath, ['-e',script], {timeout:3000,encoding:'utf8'});
  assert.equal(result.error, undefined);
  assert.equal(result.status,0,result.stderr);
});
