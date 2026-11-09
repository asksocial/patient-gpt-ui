/*
 * AskSocial PV Academy — interactive module exercises.
 *
 * Mounts into <div id="pv-exercise-host" data-module="N"> inside the module view.
 * Exercise content lives in exercises-data-*.js (window.pvExercises[moduleNumber]).
 * Progress is browser-local practice, stored separately from the milestone tracker
 * under `pvAcademy.exercises.v1` so the tracker schema and its migration are untouched.
 *
 * Item part types:
 *   choice  single answer          { type, prompt, options[], answer, why }
 *   multi   select all that apply  { type, prompt, options[], answers[], why }
 *   tag     mark words in a text   { type, prompt, text, cats[], keys{cat:[phrase]}, why }
 *   order   put steps in sequence  { type, prompt, steps[] (correct order), why }
 *   rubric  written answer, then compare with a model answer and self-mark a checklist
 *           { type, prompt, model, checks[] }
 */
(function () {
  'use strict';
  var LS_KEY = 'pvAcademy.exercises.v1';
  var MIN_WRITE = 40;          // characters required before the model answer can be revealed
  var TAG_PASS = 0.8;          // average F1 across categories for a tag part to count as correct
  var RUBRIC_PASS = 0.75;      // share of checklist items self-marked as met
  var CAT_LABEL = { product: 'Product', event: 'Event / observation', subject: 'Who experienced it', words: 'Supporting words', time: 'Timing' };

  // ---------- storage
  function load() {
    try { var v = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
    catch (_) { return {}; }
  }
  function save(all) { try { localStorage.setItem(LS_KEY, JSON.stringify(all)); } catch (_) {} }
  function modState(all, m) {
    var s = all[m];
    if (!s || typeof s !== 'object') s = all[m] = {};
    if (!s.r || typeof s.r !== 'object') s.r = {};
    if (!Number.isInteger(s.i)) s.i = 0;
    return s;
  }

  // ---------- helpers
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] === true) n.setAttribute(k, '');
      else if (attrs[k] !== false && attrs[k] != null) n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c != null) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function norm(w) { return w.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ''); }
  function tokenize(text) { return text.split(/(\s+)/).filter(function (t) { return t.length; }); }
  function wordIdx(tokens) { var out = []; tokens.forEach(function (t, i) { if (/\S/.test(t)) out.push(i); }); return out; }
  // Map key phrases to token indexes (consecutive normalized-word match).
  function phraseIdx(text, phrases) {
    var tokens = tokenize(text), words = wordIdx(tokens), normed = words.map(function (i) { return norm(tokens[i]); });
    var found = {};
    (phrases || []).forEach(function (p) {
      var pw = p.split(/\s+/).map(norm).filter(Boolean);
      for (var s = 0; s + pw.length <= normed.length; s++) {
        var ok = true;
        for (var j = 0; j < pw.length; j++) if (normed[s + j] !== pw[j]) { ok = false; break; }
        if (ok) { for (var j2 = 0; j2 < pw.length; j2++) found[words[s + j2]] = true; break; }
      }
    });
    return Object.keys(found).map(Number);
  }
  function accepted(part) { return Array.isArray(part.answer) ? part.answer : [part.answer]; }
  function f1(sel, key) {
    if (!key.length && !sel.length) return 1;
    var hit = sel.filter(function (x) { return key.indexOf(x) >= 0; }).length;
    if (!hit) return 0;
    var p = hit / sel.length, r = hit / key.length;
    return 2 * p * r / (p + r);
  }
  function shuffledOrder(n, seed) {
    var a = []; for (var i = 0; i < n; i++) a.push(i);
    var x = seed * 9301 + 49297;
    for (var k = n - 1; k > 0; k--) { x = (x * 9301 + 49297) % 233280; var j = Math.floor(x / 233280 * (k + 1)); var t = a[k]; a[k] = a[j]; a[j] = t; }
    // never start already solved
    var solved = a.every(function (v, idx) { return v === idx; });
    if (solved && n > 1) { var t2 = a[0]; a[0] = a[1]; a[1] = t2; }
    return a;
  }

  // ---------- scoring
  function scorePart(part, resp) {
    if (!resp || !resp.checked) return null;
    switch (part.type) {
      case 'choice': return accepted(part).indexOf(resp.v) >= 0 ? 1 : 0;
      case 'multi': {
        var sel = (resp.v || []).slice().sort(), key = part.answers.slice().sort();
        return sel.length === key.length && sel.every(function (v, i) { return v === key[i]; }) ? 1 : 0;
      }
      case 'tag': {
        var cats = part.cats, total = 0;
        cats.forEach(function (c) {
          var key = phraseIdx(part.text, part.keys[c] || []);
          var sel = Object.keys(resp.v || {}).filter(function (i) { return resp.v[i] === c; }).map(Number);
          total += f1(sel, key);
        });
        return total / cats.length >= TAG_PASS ? 1 : 0;
      }
      case 'order': return (resp.v || []).every(function (v, i) { return v === i; }) ? 1 : 0;
      case 'rubric': {
        var met = (resp.marks || []).filter(Boolean).length;
        return met / part.checks.length >= RUBRIC_PASS ? 1 : 0;
      }
    }
    return null;
  }
  function itemStatus(item, r) {
    r = r || {};
    var scores = item.parts.map(function (p, j) { return scorePart(p, r[j]); });
    if (scores.some(function (s) { return s == null; })) return scores.some(function (s) { return s != null; }) ? 'partial' : 'open';
    return scores.every(function (s) { return s === 1; }) ? 'correct' : 'review';
  }
  function summary(ex, s) {
    var done = 0, correct = 0;
    ex.items.forEach(function (it, i) { var st = itemStatus(it, s.r[i]); if (st === 'correct' || st === 'review') done++; if (st === 'correct') correct++; });
    return { done: done, correct: correct, total: ex.items.length };
  }
  window.pvExerciseScoring = { scorePart: scorePart, itemStatus: itemStatus, summary: summary, phraseIdx: phraseIdx, tokenize: tokenize };

  // ---------- rendering
  var current = { host: null, mod: null };

  function render(host, m) {
    var ex = (window.pvExercises || {})[m];
    host.textContent = '';
    if (!ex) return;
    var all = load(), s = modState(all, m);
    if (s.i >= ex.items.length) s.i = 0;
    var persist = function () { save(all); };
    var rerender = function () { persist(); render(host, m); };

    var sum = summary(ex, s);
    var wrap = el('section', { class: 'pvx', 'aria-label': 'Interactive exercise' });
    host.appendChild(wrap);

    // header
    wrap.appendChild(el('div', { class: 'pvx-head' }, [
      el('div', {}, [
        el('h6', { class: 'pvx-eyebrow', text: 'Interactive exercise · ' + ex.items.length + ' items' }),
        el('h3', { class: 'pvx-title', text: ex.title }),
        el('p', { class: 'pvx-intro', text: ex.intro })
      ]),
      el('div', { class: 'pvx-score' }, [
        el('div', { class: 'pvx-score-n', text: sum.done + '/' + sum.total }),
        el('div', { class: 'pvx-score-l', text: 'answered · ' + sum.correct + ' matched the key' })
      ])
    ]));
    if (ex.reference) {
      var ref = el('details', { class: 'pvx-ref' }, [el('summary', { text: ex.reference.title })]);
      ex.reference.lines.forEach(function (l) { ref.appendChild(el('p', { text: l })); });
      if (s.refOpen !== false) ref.open = true;
      ref.addEventListener('toggle', function () { s.refOpen = ref.open; persist(); });
      wrap.appendChild(ref);
    }

    // item navigator
    var nav = el('div', { class: 'pvx-dots', role: 'tablist', 'aria-label': 'Exercise items' });
    ex.items.forEach(function (it, i) {
      var st = itemStatus(it, s.r[i]);
      nav.appendChild(el('button', {
        class: 'pvx-dot pvx-' + st + (i === s.i ? ' pvx-on' : ''), role: 'tab', 'aria-selected': i === s.i ? 'true' : 'false',
        'aria-label': 'Item ' + (i + 1) + ' (' + ({ open: 'not started', partial: 'in progress', correct: 'matched key', review: 'review' })[st] + ')',
        text: String(i + 1), onclick: function () { s.i = i; rerender(); }
      }));
    });
    wrap.appendChild(nav);

    if (s.i === -1) { renderSummary(wrap, ex, s, rerender); return; }

    var item = ex.items[s.i], r = s.r[s.i] || (s.r[s.i] = {});
    var card = el('div', { class: 'pvx-card' });
    wrap.appendChild(card);
    card.appendChild(el('div', { class: 'pvx-item-label', text: 'Item ' + (s.i + 1) + ' of ' + ex.items.length + (item.label ? ' · ' + item.label : '') }));
    if (item.stimulus) {
      var stim = el('div', { class: 'pvx-stimulus' });
      (Array.isArray(item.stimulus) ? item.stimulus : [item.stimulus]).forEach(function (line) { stim.appendChild(el('p', { text: line })); });
      card.appendChild(stim);
    }
    item.parts.forEach(function (part, j) {
      if (!r[j]) r[j] = {};
      card.appendChild(renderPart(part, r[j], j, item.parts.length, rerender, m * 1000 + s.i * 10 + j, persist));
    });

    // footer nav
    var last = s.i === ex.items.length - 1;
    wrap.appendChild(el('div', { class: 'pvx-foot' }, [
      el('button', { class: 'btn btn-secondary', text: '← Previous item', disabled: s.i === 0, onclick: function () { s.i--; rerender(); } }),
      el('button', { class: 'btn btn-secondary', text: last ? 'See exercise summary →' : 'Next item →', onclick: function () { s.i = last ? -1 : s.i + 1; rerender(); } })
    ]));
  }

  function renderSummary(wrap, ex, s, rerender) {
    var sum = summary(ex, s);
    var box = el('div', { class: 'pvx-card' });
    var pct = sum.total ? Math.round(sum.correct / sum.total * 100) : 0;
    box.appendChild(el('div', { class: 'pvx-big', text: pct + '%' }));
    box.appendChild(el('p', { class: 'pvx-strong', text: sum.correct + ' of ' + sum.total + ' items matched the key · ' + sum.done + ' of ' + sum.total + ' answered' }));
    var review = ex.items.map(function (it, i) { return { i: i, st: itemStatus(it, s.r[i]) }; }).filter(function (x) { return x.st !== 'correct'; });
    if (review.length) {
      box.appendChild(el('p', { text: 'Return to these items:' }));
      var row = el('div', { class: 'pvx-chips' });
      review.forEach(function (x) { row.appendChild(el('button', { class: 'btn btn-secondary', text: 'Item ' + (x.i + 1) + (x.st === 'review' ? ' · review' : ' · open'), onclick: function () { s.i = x.i; rerender(); } })); });
      box.appendChild(row);
    } else {
      box.appendChild(el('p', { text: 'Every item matches the key. Re-read the explanations for any item you found difficult, then mark the lesson reviewed.' }));
    }
    box.appendChild(el('p', { class: 'pvx-note', text: 'Exercise results are browser-local practice. They help you prepare but are not assessor acceptance, qualification or authorization.' }));
    box.appendChild(el('div', { class: 'pvx-chips' }, [
      el('button', { class: 'btn btn-secondary', text: 'Back to item 1', onclick: function () { s.i = 0; rerender(); } }),
      el('button', { class: 'btn btn-ghost', text: 'Reset this exercise', onclick: function () { s.r = {}; s.i = 0; rerender(); } })
    ]));
    wrap.appendChild(box);
  }

  function feedback(ok, why, extra, labels) {
    var f = el('div', { class: 'pvx-fb ' + (ok ? 'pvx-fb-ok' : 'pvx-fb-no'), role: 'status' });
    labels = labels || ['Matches the key. ', 'Differs from the key. '];
    f.appendChild(el('strong', { text: ok ? labels[0] : labels[1] }));
    if (extra) f.appendChild(extra);
    if (why) f.appendChild(el('span', { text: why }));
    return f;
  }

  function renderPart(part, resp, j, nParts, rerender, seed, persist) {
    var box = el('div', { class: 'pvx-part' });
    var prefix = nParts > 1 ? (String.fromCharCode(97 + j) + ') ') : '';
    box.appendChild(el('p', { class: 'pvx-prompt', text: prefix + part.prompt }));
    var checked = !!resp.checked;
    var checkBtn = function (disabled) {
      return el('button', { class: 'btn btn-primary pvx-check', text: 'Check answer', disabled: disabled, onclick: function () { resp.checked = true; rerender(); } });
    };
    var retry = function () {
      return el('button', { class: 'btn btn-ghost', text: 'Try again', onclick: function () { delete resp.checked; if (part.type === 'rubric') { delete resp.marks; delete resp.revealed; } rerender(); } });
    };

    if (part.type === 'choice' || part.type === 'multi') {
      var multi = part.type === 'multi';
      var sel = multi ? (resp.v || []) : resp.v;
      var list = el('div', { class: 'pvx-opts', role: multi ? 'group' : 'radiogroup' });
      part.options.forEach(function (o, i) {
        var on = multi ? sel.indexOf(i) >= 0 : sel === i;
        var isKey = multi ? part.answers.indexOf(i) >= 0 : accepted(part).indexOf(i) >= 0;
        var cls = 'pvx-opt' + (on ? ' pvx-sel' : '');
        if (checked) cls += isKey ? ' pvx-key' : (on ? ' pvx-wrong' : '');
        list.appendChild(el('button', {
          class: cls, role: multi ? 'checkbox' : 'radio', 'aria-checked': on ? 'true' : 'false', disabled: checked,
          onclick: function () {
            if (multi) { var v = (resp.v || []).slice(), k = v.indexOf(i); if (k >= 0) v.splice(k, 1); else v.push(i); resp.v = v; }
            else resp.v = i;
            rerender();
          }
        }, [el('span', { class: 'pvx-mark', 'aria-hidden': 'true', text: multi ? (on ? '☑' : '☐') : (on ? '●' : '○') }), el('span', { text: o })]));
      });
      box.appendChild(list);
      if (multi && !checked) box.appendChild(el('p', { class: 'pvx-hint', text: 'Select all that apply.' }));
      if (!checked) box.appendChild(checkBtn(multi ? !(resp.v && resp.v.length) : resp.v == null));
      else {
        var extra = null;
        if (part.peer != null) extra = el('div', { class: 'pvx-peer' }, [el('strong', { text: 'Reviewer B (independent) chose: ' }), el('span', { text: part.options[part.peer] + '. ' })]);
        if (!multi && accepted(part).length > 1) extra = el('div', {}, [extra, el('div', { class: 'pvx-keylist', text: 'Accepted answers: ' + accepted(part).map(function (a) { return part.options[a]; }).join(' OR ') })]);
        box.appendChild(feedback(scorePart(part, resp) === 1, part.why, extra));
        box.appendChild(retry());
      }
      return box;
    }

    if (part.type === 'tag') {
      var tokens = tokenize(part.text), v = resp.v || (resp.v = {});
      var active = resp.cat && part.cats.indexOf(resp.cat) >= 0 ? resp.cat : part.cats[0];
      if (!checked) {
        var pal = el('div', { class: 'pvx-palette', role: 'radiogroup', 'aria-label': 'Tag type' });
        part.cats.forEach(function (c) {
          pal.appendChild(el('button', { class: 'pvx-cat pvx-c-' + c + (c === active ? ' pvx-sel' : ''), role: 'radio', 'aria-checked': c === active ? 'true' : 'false', text: CAT_LABEL[c] || c, onclick: function () { resp.cat = c; rerender(); } }));
        });
        box.appendChild(el('p', { class: 'pvx-hint', text: 'Choose a tag type, then select each word that belongs to it. Select a word again to clear it.' }));
        box.appendChild(pal);
      }
      var keyIdx = {};
      if (checked) part.cats.forEach(function (c) { phraseIdx(part.text, part.keys[c] || []).forEach(function (i) { keyIdx[i] = c; }); });
      var txt = el('div', { class: 'pvx-tagtext' });
      tokens.forEach(function (t, i) {
        if (!/\S/.test(t)) { txt.appendChild(document.createTextNode(t)); return; }
        var c = v[i], cls = 'pvx-tok' + (c ? ' pvx-c-' + c : '');
        if (checked) {
          if (keyIdx[i] && keyIdx[i] === c) cls += ' pvx-tok-ok';
          else if (keyIdx[i]) cls += ' pvx-tok-miss pvx-k-' + keyIdx[i];
          else if (c) cls += ' pvx-tok-extra';
        }
        txt.appendChild(el('button', {
          class: cls, disabled: checked, 'aria-pressed': c ? 'true' : 'false', 'aria-label': t + (c ? ' (' + (CAT_LABEL[c] || c) + ')' : ''), text: t,
          onclick: function () { if (v[i] === active) delete v[i]; else v[i] = active; rerender(); }
        }));
      });
      box.appendChild(txt);
      if (!checked) box.appendChild(checkBtn(!Object.keys(v).length));
      else {
        var legend = el('p', { class: 'pvx-hint', text: 'Solid underline: tagged as in the key. Dashed outline: a key word you did not tag. Struck through: tagged but not in the key.' });
        box.appendChild(legend);
        var keyList = el('div', { class: 'pvx-keylist' });
        part.cats.forEach(function (c) { keyList.appendChild(el('div', { text: (CAT_LABEL[c] || c) + ': ' + ((part.keys[c] || []).length ? part.keys[c].join(' · ') : 'none') })); });
        box.appendChild(feedback(scorePart(part, resp) === 1, part.why, keyList));
        box.appendChild(retry());
      }
      return box;
    }

    if (part.type === 'order') {
      if (!Array.isArray(resp.v) || resp.v.length !== part.steps.length) resp.v = shuffledOrder(part.steps.length, seed);
      var ol = el('ol', { class: 'pvx-order' });
      resp.v.forEach(function (stepIdx, pos) {
        var cls = 'pvx-step' + (checked ? (stepIdx === pos ? ' pvx-key' : ' pvx-wrong') : '');
        var move = function (d) { return function () { var a = resp.v, t = a[pos]; a[pos] = a[pos + d]; a[pos + d] = t; rerender(); }; };
        ol.appendChild(el('li', { class: cls }, [
          el('span', { class: 'pvx-step-t', text: part.steps[stepIdx] }),
          checked ? null : el('span', { class: 'pvx-step-b' }, [
            el('button', { class: 'btn btn-secondary btn-icon', 'aria-label': 'Move up', text: '↑', disabled: pos === 0, onclick: move(-1) }),
            el('button', { class: 'btn btn-secondary btn-icon', 'aria-label': 'Move down', text: '↓', disabled: pos === resp.v.length - 1, onclick: move(1) })
          ])
        ]));
      });
      box.appendChild(ol);
      if (!checked) box.appendChild(checkBtn(false));
      else {
        var right = el('ol', { class: 'pvx-keylist' });
        part.steps.forEach(function (t) { right.appendChild(el('li', { text: t })); });
        box.appendChild(feedback(scorePart(part, resp) === 1, part.why, scorePart(part, resp) === 1 ? null : el('div', {}, [el('span', { text: 'Key order:' }), right])));
        box.appendChild(retry());
      }
      return box;
    }

    if (part.type === 'rubric') {
      var ta = el('textarea', { class: 'pvx-textarea', rows: '6', 'aria-label': 'Your answer', placeholder: 'Write your answer here. Use fictional details only; do not enter real safety information or personal data.', disabled: !!resp.revealed });
      ta.value = resp.text || '';
      var count = el('span', { class: 'pvx-hint' });
      var revealBtn = el('button', { class: 'btn btn-primary', text: 'Compare with model answer' });
      // typing saves in place without re-rendering, so the cursor stays put
      var upd = function () { resp.text = ta.value; persist(); var n = ta.value.trim().length; count.textContent = n < MIN_WRITE ? (MIN_WRITE - n) + ' more characters before you can compare' : ''; revealBtn.disabled = n < MIN_WRITE; };
      ta.addEventListener('input', upd);
      box.appendChild(ta);
      if (!resp.revealed) {
        revealBtn.addEventListener('click', function () { resp.text = ta.value; resp.revealed = true; resp.marks = part.checks.map(function () { return false; }); rerender(); });
        box.appendChild(el('div', { class: 'pvx-row' }, [revealBtn, count]));
        upd();
        return box;
      }
      box.appendChild(el('div', { class: 'pvx-model' }, [el('h6', { text: 'Model answer' }), el('p', { text: part.model })]));
      var cl = el('div', { class: 'pvx-checks' }, [el('p', { class: 'pvx-strong', text: checked ? 'Your self-assessment' : 'Mark each point your answer covers' })]);
      part.checks.forEach(function (c, k) {
        cl.appendChild(el('label', { class: 'pvx-checkrow' }, [
          el('input', { type: 'checkbox', checked: !!resp.marks[k], disabled: checked, onchange: function (e) { resp.marks[k] = e.target.checked; rerender(); } }),
          el('span', { text: c })
        ]));
      });
      box.appendChild(cl);
      if (!checked) box.appendChild(el('button', { class: 'btn btn-primary', text: 'Submit self-assessment', onclick: function () { resp.checked = true; rerender(); } }));
      else {
        var met = resp.marks.filter(Boolean).length;
        var ok = scorePart(part, resp) === 1;
        box.appendChild(feedback(ok, ok ? 'Your answer covers ' + met + ' of ' + part.checks.length + ' points.' : 'Your answer covers ' + met + ' of ' + part.checks.length + ' points. Revise it to address the unmet points, then try again.', null, ['Meets the checklist. ', 'Below the checklist threshold. ']));
        box.appendChild(retry());
      }
      return box;
    }
    return box;
  }

  // ---------- mounting
  function sync() {
    var host = document.getElementById('pv-exercise-host');
    if (!host) { current.host = null; current.mod = null; return; }
    var m = parseInt(host.getAttribute('data-module'), 10);
    if (host !== current.host || m !== current.mod || !host.firstChild) {
      current.host = host; current.mod = m;
      render(host, m);
    }
  }
  function start() {
    sync();
    new MutationObserver(function () { sync(); }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-module'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
