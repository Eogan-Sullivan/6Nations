'use strict';

// Follow only child edges: parser ASTs legitimately contain parent/prev links.
// A path-local set rejects cycles while allowing shared subtrees (DAGs).
const MAX_DEPTH = 128;
const validate = ast => {
  const ancestors = new Set();
  const stack = [{ node: ast, depth: 0, exit: false, root: true }];
  while (stack.length) {
    const frame = stack.pop();
    const node = frame.node;
    if (!node || typeof node !== 'object') continue;
    if (frame.exit) { ancestors.delete(node); continue; }
    if (ancestors.has(node)) throw new TypeError('cyclic braces AST');
    const children = node.nodes;
    const depth = frame.depth + (children && !frame.root ? 1 : 0);
    if (depth > MAX_DEPTH) throw new RangeError('braces nesting depth exceeds 128');
    if (!children) continue;
    ancestors.add(node);
    stack.push({ node, depth, exit: true });
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push({ node: children[i], depth, exit: false });
    }
  }
};

module.exports = { MAX_DEPTH, validate };
