import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Loads the Academy exercise data and engine in a sandbox and checks content integrity and scoring.
const dir = 'public/academy/';
const files = ['exercises-data-core-a.js', 'exercises-data-core-b.js', 'exercises-data-core-c.js', 'exercises-data-assurance.js', 'assets/exercises.js'];
const context = {
  window: {},
  localStorage: { getItem: () => null, setItem: () => {} },
  document: { readyState: 'complete', getElementById: () => null, body: {} },
  MutationObserver: class { observe() {} },
};
context.window.window = context.window;
vm.createContext(context);
for (const f of files) vm.runInContext(fs.readFileSync(dir + f, 'utf8').replace(/\bwindow\./g, 'globalThis.window.'), context);
const X = context.window.pvExercises;
const S = context.window.pvExerciseScoring;

// Item counts follow the guide: 20 annotated mentions (M2), 15 worksheets (M4), 20 routing examples (M6),
// five packets (M7), 20 calibration mentions (M9), 20 client examples (M10), and so on.
const minItems = { 1: 8, 2: 20, 3: 8, 4: 15, 5: 10, 6: 20, 7: 5, 8: 8, 9: 20, 10: 20, 11: 7, 12: 10, 13: 5, 14: 5, 15: 5, 16: 5, 17: 5, 18: 5, 19: 5 };
let parts = 0, items = 0;
for (let m = 1; m <= 19; m++) {
  const ex = X[m];
  assert.ok(ex, `module ${m} has an exercise`);
  assert.ok(ex.title && ex.intro, `module ${m} has title and intro`);
  assert.ok(ex.items.length >= minItems[m], `module ${m} has at least ${minItems[m]} items (has ${ex.items.length})`);
  items += ex.items.length;
  ex.items.forEach((it, i) => {
    const where = `module ${m} item ${i + 1}`;
    assert.ok(it.parts.length >= 1, `${where} has parts`);
    it.parts.forEach((p, j) => {
      parts++;
      const at = `${where} part ${j + 1}`;
      assert.ok(p.prompt, `${at} has a prompt`);
      switch (p.type) {
        case 'choice': {
          const acc = Array.isArray(p.answer) ? p.answer : [p.answer];
          assert.ok(acc.length && acc.every(a => Number.isInteger(a) && a >= 0 && a < p.options.length), `${at} answer index valid`);
          if (p.peer != null) assert.ok(p.peer >= 0 && p.peer < p.options.length, `${at} peer index valid`);
          assert.equal(S.scorePart(p, { v: acc[0], checked: true }), 1, `${at} key scores correct`);
          const wrong = p.options.findIndex((_, k) => !acc.includes(k));
          if (wrong >= 0) assert.equal(S.scorePart(p, { v: wrong, checked: true }), 0, `${at} wrong option scores 0`);
          break;
        }
        case 'multi':
          assert.ok(p.answers.length && p.answers.every(a => a >= 0 && a < p.options.length), `${at} answers valid`);
          assert.equal(S.scorePart(p, { v: [...p.answers].reverse(), checked: true }), 1, `${at} key scores correct in any order`);
          break;
        case 'tag': {
          assert.ok(p.cats.length, `${at} has categories`);
          for (const c of p.cats) for (const phrase of p.keys[c] || []) {
            assert.ok(S.phraseIdx(p.text, [phrase]).length > 0, `${at}: key phrase "${phrase}" is found in the text`);
          }
          const v = {};
          for (const c of p.cats) for (const i2 of S.phraseIdx(p.text, p.keys[c] || [])) v[i2] = c;
          assert.equal(S.scorePart(p, { v, checked: true }), 1, `${at} tagging exactly the key scores correct`);
          break;
        }
        case 'order':
          assert.ok(p.steps.length >= 3, `${at} has at least 3 steps`);
          assert.equal(S.scorePart(p, { v: p.steps.map((_, k) => k), checked: true }), 1, `${at} key order scores correct`);
          break;
        case 'rubric':
          assert.ok(p.model.length > 80, `${at} has a model answer`);
          assert.ok(p.checks.length >= 3, `${at} has at least 3 checklist points`);
          assert.equal(S.scorePart(p, { marks: p.checks.map(() => true), checked: true }), 1, `${at} full checklist scores correct`);
          assert.equal(S.scorePart(p, { marks: p.checks.map(() => false), checked: true }), 0, `${at} empty checklist scores 0`);
          break;
        default:
          assert.fail(`${at} has unknown type ${p.type}`);
      }
    });
  });
}
// Status and summary helpers
const first = X[1].items[1];
assert.equal(S.itemStatus(first, {}), 'open');
assert.equal(S.itemStatus(first, { 0: { v: first.parts[0].answer, checked: true } }), 'correct');
assert.equal(S.summary(X[1], { r: { 1: { 0: { v: first.parts[0].answer, checked: true } } } }).correct, 1);
console.log(`Academy exercises OK: 19 modules, ${items} items, ${parts} scored parts.`);
