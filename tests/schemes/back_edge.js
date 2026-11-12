// A return without a note must start and end at the visible node edges.
const assert = require('assert');
const K = require('../../templates/deck-starter/components.js');
const els = K.stateMachine({ x: 1, y: 2, w: 11, h: 4 }, {
  states: [{ id: 'a', name: 'Первый' }, { id: 'b', name: 'Второй' }],
  transitions: [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }],
});
const nodes = els.filter(e => e.t === 'rect').sort((a, b) => a.x - b.x);
const [a, b] = nodes;
const close = (x, y) => Math.abs(x - y) < 1e-6;
assert(els.some(e => e.t === 'oval' && close(e.x + e.w / 2, b.x + b.w / 2) && close(e.y + e.h / 2, b.y + b.h)), 'return origin must touch source');
assert(els.some(e => e.t === 'tri' && close(e.y, a.y + a.h)), 'return arrow must touch target');
console.log('OK: return connects both nodes');
