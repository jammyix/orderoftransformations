(function () {
  'use strict';

  /* =========================================================
     Exact fractions
     ========================================================= */
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const r = a % b; a = b; b = r; } return a || 1; }

  class Frac {
    constructor(n, d = 1) {
      if (d === 0) throw new Error('zero denominator');
      if (d < 0) { n = -n; d = -d; }
      const g = gcd(n, d);
      this.n = n / g; this.d = d / g;
      if (Object.is(this.n, -0)) this.n = 0;
    }
    static of(x) { return x instanceof Frac ? x : new Frac(x, 1); }
    add(o) { o = Frac.of(o); return new Frac(this.n * o.d + o.n * this.d, this.d * o.d); }
    sub(o) { return this.add(Frac.of(o).neg()); }
    mul(o) { o = Frac.of(o); return new Frac(this.n * o.n, this.d * o.d); }
    div(o) { o = Frac.of(o); return new Frac(this.n * o.d, this.d * o.n); }
    neg() { return new Frac(-this.n, this.d); }
    abs() { return new Frac(Math.abs(this.n), this.d); }
    inv() { return new Frac(this.d, this.n); }
    eq(o) { o = Frac.of(o); return this.n === o.n && this.d === o.d; }
    isZero() { return this.n === 0; }
    isNeg() { return this.n < 0; }
    val() { return this.n / this.d; }
  }
  const F = (n, d = 1) => new Frac(n, d);

  function parseFrac(str) {
    if (str == null) return null;
    const s = String(str).trim().replace(/[−–—]/g, '-').replace(/\s+/g, '').replace(/^\((.*)\)$/, '$1');
    if (!s) return null;
    let m = s.match(/^([+-]?)(\d+)\/([+-]?)(\d+)$/);
    if (m) {
      const d = +m[4];
      if (d === 0) return null;
      const sign = (m[1] === '-' ? -1 : 1) * (m[3] === '-' ? -1 : 1);
      return F(sign * +m[2], d);
    }
    m = s.match(/^([+-]?)(\d*)(?:\.(\d*))?$/);
    if (m && (m[2] || m[3])) {
      const dec = m[3] || '';
      return F((m[1] === '-' ? -1 : 1) * +((m[2] || '0') + dec), Math.pow(10, dec.length));
    }
    return null;
  }

  /* =========================================================
     Maths formatting (HTML)
     ========================================================= */
  const XV = '<i>x</i>';
  const fx = inner => `<i>f</i>(${inner})`;
  const num = x => (x < 0 ? '−' : '') + Math.abs(x);

  function fracHTML(f) {
    f = Frac.of(f);
    const s = f.n < 0 ? '−' : '';
    const n = Math.abs(f.n);
    if (f.d === 1) return s + n;
    return `${s}<span class="frac"><span>${n}</span><span>${f.d}</span></span>`;
  }
  // A·x + B
  function linHTML(A, B) {
    A = Frac.of(A); B = Frac.of(B);
    let out;
    if (A.eq(1)) out = XV;
    else if (A.eq(-1)) out = '−' + XV;
    else out = fracHTML(A) + XV;
    if (!B.isZero()) out += (B.isNeg() ? ' − ' : ' + ') + fracHTML(B.abs());
    return out;
  }
  // inside of f( ) in factorised form
  function factorHTML(a, b) {
    if (b.isZero()) return linHTML(a, 0);
    if (a.eq(1)) return linHTML(1, b);
    const inner = linHTML(1, b.div(a));
    if (a.eq(-1)) return `−(${inner})`;
    return `${fracHTML(a)}(${inner})`;
  }
  function bracketHTML(a, c) {
    const inner = linHTML(1, c);
    if (a.eq(1)) return inner;
    if (a.eq(-1)) return `−(${inner})`;
    return `${fracHTML(a)}(${inner})`;
  }
  const yEq = inner => `<span class="m">y = ${fx(inner)}</span>`;
  const vecHTML = d => `<span class="vec"><span>${fracHTML(d)}</span><span>0</span></span>`;
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  function stretchPhrase(k) {
    const m = k.abs(), parts = [];
    if (!m.eq(1)) parts.push(`stretch parallel to the <i>x</i>-axis, scale factor <span class="m">${fracHTML(m)}</span>`);
    if (k.isNeg()) parts.push('reflection in the <i>y</i>-axis');
    return parts.join(' and ');
  }
  function stretchHint(k) {
    const m = k.abs();
    let h = '';
    if (m.val() < 1) h = `Every <i>x</i>-coordinate is multiplied by <span class="m">${fracHTML(m)}</span>, so the graph is <b>squashed</b> horizontally towards the <i>y</i>-axis.`;
    else if (m.val() > 1) h = `Every <i>x</i>-coordinate is multiplied by <span class="m">${fracHTML(m)}</span>, so the graph is <b>stretched</b> horizontally away from the <i>y</i>-axis.`;
    if (k.isNeg()) h += (h ? ' ' : '') + 'Every <i>x</i>-coordinate also changes sign, which reflects the graph in the <i>y</i>-axis.';
    return h;
  }
  const translatePhrase = d => `translation by vector ${vecHTML(d)}`;
  const dirWord = d => (d.isNeg() ? 'left' : 'right');
  const shiftHTML = d => `<span class="m">${fracHTML(d.abs())}</span> ${dirWord(d)}`;
  function translateHint(d) {
    const m = `<span class="m">${fracHTML(d.abs())}</span>`;
    return d.isNeg()
      ? `Every <i>x</i>-coordinate decreases by ${m}, so the graph moves ${m} to the <b>left</b>.`
      : `Every <i>x</i>-coordinate increases by ${m}, so the graph moves ${m} to the <b>right</b>.`;
  }
  function opPhrase(o) {
    if (o.type === 'translate') return translatePhrase(o.d);
    return stretchPhrase(o.k);
  }

  /* =========================================================
     Base graphs
     ========================================================= */
  const FUNCS = {
    zigzag: {
      pts: [[-4, 0], [-2, 3], [1, -2], [3, 2]],
      keys: [['A', -4, 0], ['B', -2, 3], ['C', 1, -2], ['D', 3, 2]],
      y: [-4, 5]
    },
    cubic: {
      f: x => 0.5 * x * (x - 3) * (x + 2),
      dom: [-2.4, 3.5],
      keys: [['A', -2, 0], ['B', -1, 2], ['C', 2, -4], ['D', 3, 0]],
      y: [-5, 5]
    },
    parabola: {
      f: x => x * x,
      dom: [-2.6, 2.6],
      keys: [['A', -2, 4], ['B', 0, 0], ['C', 1, 1]],
      y: [-2, 7]
    }
  };
  function samples(fn) {
    if (fn._s) return fn._s;
    if (fn.pts) return (fn._s = fn.pts);
    const [a, b] = fn.dom, N = 220, out = [];
    for (let i = 0; i <= N; i++) { const u = a + (b - a) * i / N; out.push([u, fn.f(u)]); }
    return (fn._s = out);
  }
  function domainOf(fn) { return fn.pts ? [fn.pts[0][0], fn.pts[fn.pts.length - 1][0]] : fn.dom; }

  /* A graph state is a horizontal map u -> s·u + t applied to every point (u, f(u)).
     y = f(ax + b) corresponds to s = 1/a, t = -b/a. */
  function eqFromST(s, t) { return linHTML(s.inv(), t.neg().div(s)); }
  function compose(ops) {
    let s = F(1), t = F(0);
    for (const o of ops) {
      if (o.type === 'translate') t = t.add(o.d);
      else { s = s.mul(o.k); t = t.mul(o.k); }
    }
    return { s, t };
  }

  function stagesFor(route, a, b) {
    const s = a.inv(), p = b.div(a), zero = F(0), one = F(1);
    const st = [{ s: one, t: zero, eq: XV, kind: 'start' }];
    if (route === 'factor') {
      st.push({ s, t: zero, eq: linHTML(a, 0), kind: 'stretch', k: s });
      st.push({ s, t: p.neg(), eq: factorHTML(a, b), kind: 'translate', d: p.neg() });
    } else if (route === 'translate') {
      st.push({ s: one, t: b.neg(), eq: linHTML(1, b), kind: 'translate', d: b.neg() });
      st.push({ s, t: p.neg(), eq: linHTML(a, b), kind: 'stretch', k: s });
    } else {
      st.push({ s, t: zero, eq: linHTML(a, 0), kind: 'stretch', k: s });
      st.push({ s, t: b.neg(), eq: bracketHTML(a, b), kind: 'translate', d: b.neg() });
    }
    return st.filter((x, i) => i === 0 || !(x.kind === 'translate' && x.d.isZero()));
  }
  const allStages = (a, b) => ['factor', 'translate', 'mistake'].flatMap(r => stagesFor(r, a, b));

  function viewFor(fn, stages) {
    let m = 4;
    const [d0, d1] = domainOf(fn);
    for (const st of stages) for (const u of [d0, d1]) m = Math.max(m, Math.abs(st.s.val() * u + st.t.val()));
    let h = 48;
    for (const c of [6, 8, 10, 12, 16, 20, 24, 32, 40]) if (m + 0.5 <= c) { h = c; break; }
    return { x0: -h, x1: h, y0: fn.y[0], y1: fn.y[1] };
  }

  /* =========================================================
     SVG graph
     ========================================================= */
  class Graph {
    constructor(svg) {
      this.svg = svg; this.W = 660; this.H = 420;
      this.pad = { l: 6, r: 6, t: 6, b: 6 };
      this.id = 'clip' + Math.random().toString(36).slice(2, 9);
      this.view = { x0: -10, x1: 10, y0: -5, y1: 5 };
      svg.setAttribute('viewBox', `0 0 ${this.W} ${this.H}`);
    }
    X(x) { const v = this.view, p = this.pad; return p.l + (x - v.x0) / (v.x1 - v.x0) * (this.W - p.l - p.r); }
    Y(y) { const v = this.view, p = this.pad; return p.t + (v.y1 - y) / (v.y1 - v.y0) * (this.H - p.t - p.b); }
    path(fn, s, t) {
      return 'M' + samples(fn).map(([u, y]) => `${this.X(s * u + t).toFixed(1)},${this.Y(y).toFixed(1)}`).join('L');
    }
    render({ fn, layers = [], points = [] }) {
      const v = this.view, p = this.pad;
      const L = p.l, R = this.W - p.r, T = p.t, B = this.H - p.b;
      const o = [];
      o.push(`<defs><clipPath id="${this.id}"><rect x="${L}" y="${T}" width="${R - L}" height="${B - T}"/></clipPath></defs>`);
      o.push(`<rect class="plot-bg" x="${L}" y="${T}" width="${R - L}" height="${B - T}" rx="6"/>`);
      const w = v.x1 - v.x0, h = v.y1 - v.y0;
      const gx = w <= 24 ? 1 : 2, lx = w <= 16 ? 2 : (w <= 32 ? 4 : 8);
      const ly = h <= 12 ? 1 : 2;
      for (let x = Math.ceil(v.x0 / gx) * gx; x <= v.x1; x += gx) {
        const X = this.X(x).toFixed(1);
        o.push(`<line class="grid${x % lx === 0 ? ' major' : ''}" x1="${X}" y1="${T}" x2="${X}" y2="${B}"/>`);
      }
      for (let y = Math.ceil(v.y0); y <= v.y1; y++) {
        const Y = this.Y(y).toFixed(1);
        o.push(`<line class="grid${y % ly === 0 ? ' major' : ''}" x1="${L}" y1="${Y}" x2="${R}" y2="${Y}"/>`);
      }
      const ax = this.Y(0), ay = this.X(0);
      o.push(`<line class="axis" x1="${L}" y1="${ax}" x2="${R}" y2="${ax}"/>`);
      o.push(`<line class="axis" x1="${ay}" y1="${T}" x2="${ay}" y2="${B}"/>`);
      for (let x = Math.ceil(v.x0 / lx) * lx; x <= v.x1; x += lx) {
        if (x === 0 || x === v.x0 || x === v.x1) continue;
        o.push(`<text class="tick" x="${this.X(x)}" y="${ax + 16}" text-anchor="middle">${num(x)}</text>`);
      }
      for (let y = Math.ceil(v.y0 / ly) * ly; y <= v.y1; y += ly) {
        if (y === 0 || y === v.y0 || y === v.y1) continue;
        o.push(`<text class="tick" x="${ay - 6}" y="${this.Y(y) + 4}" text-anchor="end">${num(y)}</text>`);
      }
      o.push(`<text class="axname" x="${R - 8}" y="${ax - 8}" text-anchor="end">x</text>`);
      o.push(`<text class="axname" x="${ay + 8}" y="${T + 16}">y</text>`);
      o.push(`<g clip-path="url(#${this.id})">`);
      for (const ly2 of layers) o.push(`<path class="${ly2.cls}" d="${this.path(fn, ly2.s, ly2.t)}"/>`);
      for (const pt of points) {
        for (const [name, u, y] of (pt.keys || fn.keys)) {
          const cx = this.X(pt.s * u + pt.t), cy = this.Y(y);
          o.push(`<g class="${pt.cls}"><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${pt.label === false ? 4 : 6}"/>` +
            (pt.label === false ? '' : `<text x="${(cx + 9).toFixed(1)}" y="${(cy - 9).toFixed(1)}">${name}</text>`) + '</g>');
        }
      }
      o.push('</g>');
      this.svg.innerHTML = o.join('');
    }
  }

  /* =========================================================
     Helpers
     ========================================================= */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const DUR = reduceMotion ? 0 : 950;
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function tween(from, to, ms, onFrame, onDone) {
    const fs = from.s, ft = from.t, start = performance.now();
    let raf = 0, dead = false;
    function step(now) {
      if (dead) return;
      const k = ms <= 0 ? 1 : Math.min(1, (now - start) / ms);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      onFrame(fs + (to.s - fs) * e, ft + (to.t - ft) * e);
      if (k < 1) raf = requestAnimationFrame(step); else if (onDone) onDone();
    }
    raf = requestAnimationFrame(step);
    return () => { dead = true; cancelAnimationFrame(raf); };
  }

  function segSelect(container, attr, onChange) {
    $$('button', container).forEach(btn => btn.addEventListener('click', () => {
      $$('button', container).forEach(b => b.classList.toggle('on', b === btn));
      onChange(btn.dataset[attr]);
    }));
  }

  const POOLS = {
    starter: { a: [[2], [3], [4]], b: [-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6] },
    challenge: { a: [[2], [3], [1, 2], [3, 2], [-1], [-2], [-1, 2]], b: [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5] }
  };
  function pickAB(level, fn, avoid) {
    for (let i = 0; i < 300; i++) {
      const a = F(...pick(POOLS[level].a)), b = F(pick(POOLS[level].b));
      if (avoid && a.eq(avoid.a) && b.eq(avoid.b)) continue;
      if (viewFor(fn, allStages(a, b)).x1 <= 20) return { a, b };
    }
    return { a: F(2), b: F(3) };
  }

  /* =========================================================
     Tabs
     ========================================================= */
  const onTab = {};
  $$('.tab').forEach(tab => tab.addEventListener('click', () => {
    $$('.tab').forEach(t => t.setAttribute('aria-selected', String(t === tab)));
    $$('.panel').forEach(p => { p.hidden = p.id !== 'tab-' + tab.dataset.tab; });
    if (onTab[tab.dataset.tab]) onTab[tab.dataset.tab]();
  }));

  /* =========================================================
     0. GUIDED WALKTHROUGH
     ========================================================= */
  const ln = { step: 0, cur: { s: 1, t: 0 }, cancel: null, token: 0, wrong: false, target: false, unlocked: false };
  const lnGraph = new Graph($('#ln-graph'));
  lnGraph.view = { x0: -8, x1: 8, y0: -4, y1: 5 };
  const HALF = fracHTML(F(1, 2)), THIRD = fracHTML(F(1, 3)), THREE2 = fracHTML(F(3, 2));
  const m = html => `<span class="m">${html}</span>`;
  const Y = inner => m(`y = ${fx(inner)}`);
  const ST = (s, t, eq, cap) => ({ s, t, eq, cap });

  function lnRender() {
    const fn = FUNCS.zigzag;
    const layers = [{ s: 1, t: 0, cls: 'c-orig' }];
    if (ln.target) layers.push({ s: 0.5, t: -1.5, cls: 'c-target' });
    const moved = ln.cur.s !== 1 || ln.cur.t !== 0;
    if (moved) layers.push({ s: ln.cur.s, t: ln.cur.t, cls: ln.wrong ? 'c-wrong' : 'c-cur' });
    lnGraph.render({
      fn, layers,
      points: [moved ? { s: ln.cur.s, t: ln.cur.t, cls: ln.wrong ? 'p-wrong' : 'p-cur' } : { s: 1, t: 0, cls: 'p-orig' }]
    });
    $('#ln-legend-target').hidden = !ln.target;
  }
  function lnNow(eq, cap) {
    $('#ln-now').innerHTML = `y = ${fx(eq)}` + (cap ? `<span class="cap">${cap}</span>` : '');
  }
  function lnReset() {
    if (ln.cancel) ln.cancel();
    ln.cancel = null; ln.token++; ln.wrong = false;
    ln.cur = { s: 1, t: 0 };
    lnNow(XV); lnRender();
  }
  // Animate through a list of states, starting from the first. Resolves when finished.
  function lnPlay(states) {
    lnReset();
    const token = ln.token;
    return new Promise(resolve => {
      let i = 0;
      const next = () => {
        if (token !== ln.token) return;
        i++;
        if (i >= states.length) { resolve(); return; }
        const st = states[i];
        lnNow(st.eq, st.cap);
        ln.cancel = tween(ln.cur, st, DUR * 1.2,
          (s, t) => { ln.cur = { s, t }; lnRender(); },
          () => { ln.cancel = null; setTimeout(next, i < states.length - 1 ? 900 : 0); });
      };
      setTimeout(next, 350);
    });
  }
  function lnAfter(html) { $('#ln-after').insertAdjacentHTML('beforeend', html); }
  function lnUnlock() { ln.unlocked = true; $('#ln-next').disabled = false; }

  const LN_STEPS = [
    {
      target: false,
      html: `<h2>Sketching graphs like ${Y(linHTML(2, 3))}</h2>
        <p>In this short walkthrough you'll see what the <b>2</b> and the <b>+ 3</b> each do to a graph, and why the <b>order</b> you do them in matters.</p>
        <p>Here's the graph of ${Y(XV)} we'll use. Keep an eye on the labelled points <b>A</b>, <b>B</b>, <b>C</b> and <b>D</b>.</p>`,
      enter() { lnUnlock(); }
    },
    {
      target: false,
      html: `<h2>Adding inside the bracket moves the graph sideways</h2>
        <p>What do you think ${Y(linHTML(1, 3))} looks like? Press the button to find out.</p>
        <div class="ln-actions"><button class="btn primary" id="ln-a1">Show ${m(`y = ${fx(linHTML(1, 3))}`)}</button></div>`,
      enter() {
        $('#ln-a1').addEventListener('click', async e => {
          e.currentTarget.disabled = true;
          await lnPlay([ST(1, 0, XV), ST(1, -3, linHTML(1, 3), 'Every point moves 3 to the left')]);
          lnAfter(`<div class="fb info">It moved <b>3 to the left</b>, not to the right! Point <b>D</b> went from ${m('(3, 2)')} to ${m('(0, 2)')}.<br>Inside the bracket, changes work the <b>opposite way</b> to what you might expect: <b>+ 3</b> means <b>left 3</b>.</div>
            <div class="ln-ask"><p>Quick check: which way does ${Y(linHTML(1, -2))} move?</p>
              <div class="row"><button class="btn" data-ans="left">Left 2</button><button class="btn" data-ans="right">Right 2</button></div>
              <div class="fb" id="ln-f1"></div></div>`);
          $$('#ln-after [data-ans]').forEach(b => b.addEventListener('click', () => {
            const ok = b.dataset.ans === 'right';
            b.classList.add(ok ? 'chosen-good' : 'chosen-bad');
            const f = $('#ln-f1');
            if (ok) {
              f.className = 'fb good';
              f.innerHTML = `✓ Right. <b>− 2</b> inside the bracket means <b>right 2</b>.`;
              $$('#ln-after [data-ans]').forEach(x => { x.disabled = true; });
              lnPlay([ST(1, 0, XV), ST(1, 2, linHTML(1, -2), 'Every point moves 2 to the right')]);
              lnUnlock();
            } else {
              f.className = 'fb bad';
              f.innerHTML = 'Not quite. Remember, inside the bracket it works the opposite way. Try again.';
            }
          }));
        });
      }
    },
    {
      target: false,
      html: `<h2>Multiplying <i>x</i> inside the bracket squashes the graph</h2>
        <p>Now try ${Y(linHTML(2, 0))}. The <b>2</b> multiplies <i>x</i> before <i>f</i> is applied.</p>
        <div class="ln-actions"><button class="btn primary" id="ln-a2">Show ${m(`y = ${fx(linHTML(2, 0))}`)}</button></div>`,
      enter() {
        $('#ln-a2').addEventListener('click', async e => {
          e.currentTarget.disabled = true;
          await lnPlay([ST(1, 0, XV), ST(0.5, 0, linHTML(2, 0), `Every <i>x</i>-coordinate is multiplied by ${HALF}`)]);
          lnAfter(`<div class="fb info">The graph got <b>squashed</b> towards the <i>y</i>-axis. Point <b>D</b> went from ${m('(3, 2)')} to ${m(`(${THREE2}, 2)`)}: its <i>x</i>-coordinate <b>halved</b>, and its <i>y</i>-coordinate stayed the same.<br>Again it's the opposite of what you might expect: <b>× 2</b> inside gives a <b>stretch parallel to the <i>x</i>-axis, scale factor ${HALF}</b>.</div>
            <div class="ln-ask"><p>Quick check: ${Y(linHTML(3, 0))} is a stretch parallel to the <i>x</i>-axis with scale factor…</p>
              <div class="row"><button class="btn" data-ans="3">${m('3')}</button><button class="btn" data-ans="third">${m(THIRD)}</button></div>
              <div class="fb" id="ln-f2"></div></div>`);
          $$('#ln-after [data-ans]').forEach(b => b.addEventListener('click', () => {
            const ok = b.dataset.ans === 'third';
            b.classList.add(ok ? 'chosen-good' : 'chosen-bad');
            const f = $('#ln-f2');
            if (ok) {
              f.className = 'fb good';
              f.innerHTML = `✓ Right. Every <i>x</i>-coordinate is divided by 3, so the scale factor is ${m(THIRD)}.`;
              $$('#ln-after [data-ans]').forEach(x => { x.disabled = true; });
              lnPlay([ST(1, 0, XV), ST(1 / 3, 0, linHTML(3, 0), `Every <i>x</i>-coordinate is multiplied by ${THIRD}`)]);
              lnUnlock();
            } else {
              f.className = 'fb bad';
              f.innerHTML = 'Not quite. Would multiplying <i>x</i> by 3 inside make the graph wider or narrower? Try again.';
            }
          }));
        });
      }
    },
    {
      target: true,
      html: `<h2>Now both at once: ${Y(linHTML(2, 3))}</h2>
        <p>This has a <b>squash</b> (from the 2) and a <b>move left 3</b> (from the + 3). But which do you do first?</p>
        <p>Try both orders. Which one lands exactly on the <b style="color:var(--target)">dashed target</b>?</p>
        <div class="ln-actions">
          <button class="btn" id="ln-oA">Squash first, then left 3</button>
          <button class="btn" id="ln-oB">Left 3 first, then squash</button>
        </div>`,
      enter() {
        const tried = new Set();
        let busy = false;
        const finish = () => {
          if (tried.size < 2 || $('#ln-why')) return;
          lnAfter(`<div class="fb info" id="ln-why"><b>Why does the order matter?</b><br>
            A squash acts on the <b>whole graph</b>, so it also squashes any move you've <b>already</b> made.<br>
            • <b>Left 3, then squash:</b> the squash halves the move, so 3 left becomes ${THREE2} left. ✓<br>
            • <b>Squash, then left 3:</b> nothing halves the move afterwards, so the graph goes a full 3 left, which is too far. ✗</div>`);
          lnUnlock();
        };
        $('#ln-oA').addEventListener('click', async e => {
          if (busy) return; busy = true;
          const btn = e.currentTarget;
          $('#ln-fo') && $('#ln-fo').remove();
          await lnPlay([ST(1, 0, XV), ST(0.5, 0, linHTML(2, 0), `Squash: <i>x</i>-coordinates × ${HALF}`), ST(0.5, -3, `2(${linHTML(1, 3)})`, 'Move 3 left')]);
          ln.wrong = true; lnRender();
          lnNow(`2(${linHTML(1, 3)})`, `= ${fx(linHTML(2, 6))}, not ${fx(linHTML(2, 3))}`);
          btn.classList.add('chosen-bad');
          lnAfter(`<div class="fb bad" id="ln-fo">✗ <b>Missed!</b> The graph has gone too far left. After the squash, moving left 3 gives ${m(`y = ${fx(`2(${linHTML(1, 3)})`)} = ${fx(linHTML(2, 6))}`)}. This is the <b>most common mistake</b>.</div>`);
          tried.add('A'); busy = false; finish();
        });
        $('#ln-oB').addEventListener('click', async e => {
          if (busy) return; busy = true;
          const btn = e.currentTarget;
          $('#ln-fo') && $('#ln-fo').remove();
          await lnPlay([ST(1, 0, XV), ST(1, -3, linHTML(1, 3), 'Move 3 left'), ST(0.5, -1.5, linHTML(2, 3), `Squash: <i>x</i>-coordinates × ${HALF}. Watch the move get halved too`)]);
          btn.classList.add('chosen-good');
          lnAfter(`<div class="fb good" id="ln-fo">✓ <b>Hit!</b> Watch the second step again: the squash pulled the graph back towards the <i>y</i>-axis, so the move of 3 left became ${THREE2} left.</div>`);
          tried.add('B'); busy = false; finish();
        });
      }
    },
    {
      target: true,
      html: `<h2>Want to squash first? Factorise!</h2>
        <p>Squashing first <b>can</b> work, but only if you take the 2 out of the bracket first. That shows you the move you actually need.</p>
        <div class="ln-ask"><p>Fill in the gap:</p>
          <div class="qq m">2<i>x</i> + 3 = 2(<i>x</i> + <input type="text" id="ln-p" aria-label="Missing value">)</div>
          <div class="row"><button class="btn primary" id="ln-pc">Check</button></div>
          <div class="fb" id="ln-pf"></div>
        </div>`,
      enter() {
        let tries = 0;
        const check = () => {
          const v = parseFrac($('#ln-p').value), f = $('#ln-pf');
          if (!v) { f.className = 'fb info'; f.innerHTML = `Type a number, e.g. ${m('3/2')} or ${m('1.5')}.`; return; }
          tries++;
          if (v.eq(F(3, 2))) {
            $('#ln-p').className = 'ok'; $('#ln-p').disabled = true; $('#ln-pc').disabled = true;
            f.className = 'fb good';
            f.innerHTML = `✓ Yes: ${m(`2(<i>x</i> + ${THREE2}) = 2<i>x</i> + 3`)}. So ${Y(linHTML(2, 3))} is the same as ${Y(`2(${linHTML(1, F(3, 2))})`)}.`;
            lnAfter(`<div class="ln-ask"><p>Inside the bracket now, the move is <b>${THREE2} left</b>. Let's squash first, then move ${THREE2} left.</p>
              <div class="row"><button class="btn primary" id="ln-a4">Play: squash, then left ${THREE2}</button></div></div>`);
            $('#ln-a4').addEventListener('click', async e => {
              e.currentTarget.disabled = true;
              await lnPlay([ST(1, 0, XV), ST(0.5, 0, linHTML(2, 0), `Squash: <i>x</i>-coordinates × ${HALF}`), ST(0.5, -1.5, `2(${linHTML(1, F(3, 2))})`, `Move ${THREE2} left`)]);
              lnAfter(`<div class="fb good">✓ <b>Hit!</b> Squashing first works, as long as you move by the <b>factorised</b> amount, ${THREE2}, and not by 3.</div>`);
              lnUnlock();
            });
          } else {
            $('#ln-p').className = 'no';
            f.className = 'fb bad';
            f.innerHTML = tries === 1
              ? `Not quite. Expand your bracket: ${m('2 × (your answer)')} needs to equal 3.`
              : `Divide the 3 by 2: the answer is ${m(THREE2)}.`;
          }
        };
        $('#ln-pc').addEventListener('click', check);
        $('#ln-p').addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
      }
    },
    {
      target: true,
      html: `<h2>Summary</h2>
        <p>There are two correct ways to get ${Y(linHTML(2, 3))} from ${Y(XV)}:</p>
        <div class="ln-summary">
          <div><b>✓ Translate first:</b> move left 3, then squash with scale factor ${HALF}. The squash halves the move for you.</div>
          <div><b>✓ Factorise first:</b> write ${Y(`2(${linHTML(1, F(3, 2))})`)}, then squash with scale factor ${HALF}, then move left ${THREE2}.</div>
          <div class="no"><b>✗ Common mistake:</b> squash, then move left 3. Once you've squashed, the move must come from the factorised bracket.</div>
        </div>
        <p>Now try it with other numbers and other graphs.</p>
        <div class="ln-actions"><button class="btn primary" id="ln-go">Start exploring ▶</button><button class="btn ghost" id="ln-again">↺ Replay walkthrough</button></div>`,
      enter() {
        lnUnlock();
        lnPlay([ST(1, 0, XV), ST(0.5, 0, linHTML(2, 0), `Squash: <i>x</i>-coordinates × ${HALF}`), ST(0.5, -1.5, `2(${linHTML(1, F(3, 2))})`, `Move ${THREE2} left`)]);
        $('#ln-go').addEventListener('click', () => { $('.tab[data-tab="explore"]').click(); window.scrollTo(0, 0); });
        $('#ln-again').addEventListener('click', () => lnShow(0));
      }
    }
  ];

  function lnShow(i) {
    ln.step = Math.max(0, Math.min(LN_STEPS.length - 1, i));
    const step = LN_STEPS[ln.step];
    ln.target = step.target;
    ln.unlocked = false;
    $('#ln-body').innerHTML = step.html;
    $('#ln-after').innerHTML = '';
    $('#ln-count').textContent = `Step ${ln.step + 1} of ${LN_STEPS.length}`;
    $('#ln-dots').innerHTML = LN_STEPS.map((_, k) => `<span class="${k <= ln.step ? 'on' : ''}"></span>`).join('');
    $('#ln-back').disabled = ln.step === 0;
    $('#ln-next').hidden = ln.step === LN_STEPS.length - 1;
    $('#ln-next').disabled = true;
    lnReset();
    step.enter();
  }
  $('#ln-next').addEventListener('click', () => { if (ln.unlocked) { lnShow(ln.step + 1); $('#tab-learn').scrollIntoView({ block: 'start' }); } });
  $('#ln-back').addEventListener('click', () => lnShow(ln.step - 1));
  lnShow(0);

  /* =========================================================
     1. EXPLORE
     ========================================================= */
  const ex = { func: 'zigzag', a: F(2), b: F(3), route: 'factor', stage: 0, stages: [], cur: { s: 1, t: 0 }, cancel: null, token: 0, animating: false };
  const exGraph = new Graph($('#ex-graph'));

  function exStop() { if (ex.cancel) ex.cancel(); ex.cancel = null; ex.animating = false; ex.token++; }

  function exSetup() {
    exStop();
    ex.stages = stagesFor(ex.route, ex.a, ex.b);
    exGraph.view = viewFor(FUNCS[ex.func], allStages(ex.a, ex.b));
    ex.stage = 0; ex.cur = { s: 1, t: 0 };
    exExpr(); exSteps(); exRender();
  }

  function exRender() {
    const fn = FUNCS[ex.func];
    const finalS = ex.a.inv().val(), finalT = ex.b.div(ex.a).neg().val();
    const wrong = ex.route === 'mistake' && !ex.b.isZero() && ex.stage === ex.stages.length - 1 && !ex.animating;
    const layers = [{ s: 1, t: 0, cls: 'c-orig' }];
    if ($('#ex-target').checked) layers.push({ s: finalS, t: finalT, cls: 'c-target' });
    layers.push({ s: ex.cur.s, t: ex.cur.t, cls: wrong ? 'c-wrong' : 'c-cur' });
    exGraph.render({
      fn, layers,
      points: [{ s: 1, t: 0, cls: 'p-orig', label: false }, { s: ex.cur.s, t: ex.cur.t, cls: wrong ? 'p-wrong' : 'p-cur' }]
    });
  }

  function exExpr() {
    const { a, b } = ex;
    $('#ex-expr').innerHTML = 'y = ' + fx(linHTML(a, b));
    $('#ex-target-eq').innerHTML = 'y = ' + fx(linHTML(a, b));
    $('#ex-b-val').textContent = num(b.n);
    const note = $('#ex-factor-note');
    if (b.isZero()) {
      $('#ex-factor').innerHTML = 'y = ' + fx(linHTML(a, 0));
      note.innerHTML = 'There is no constant, so there is only a stretch and the order can\'t go wrong. Set <i>b</i> to something other than 0.';
    } else {
      $('#ex-factor').innerHTML = 'y = ' + fx(factorHTML(a, b));
      note.innerHTML = `Take out the factor of <span class="m">${fracHTML(a)}</span>: <span class="m">${fracHTML(b)} ÷ ${a.isNeg() ? '(' + fracHTML(a) + ')' : fracHTML(a)} = ${fracHTML(b.div(a))}</span>.`;
    }
    const p = b.div(a);
    $('#ex-idea').innerHTML = b.isZero()
      ? `<li>Try a value of <i>b</i> that isn't 0 to see why order matters.</li>`
      : `<li>In <span class="m">${fx(linHTML(a, b))}</span>, <i>x</i> is <b>multiplied</b> by ${fracHTML(a)} and <b>then</b> ${fracHTML(b.abs())} is ${b.isNeg() ? 'subtracted' : 'added'}. So the graph <b>translates first</b> (${shiftHTML(b.neg())}), then stretches.</li>
         <li>In <span class="m">${fx(factorHTML(a, b))}</span>, ${fracHTML(p.abs())} is ${p.isNeg() ? 'subtracted' : 'added'} <b>first</b>, then the result is multiplied by ${fracHTML(a)}. So the graph <b>stretches first</b>, then translates ${shiftHTML(p.neg())}.</li>`;
  }

  function stepInfo(st, i) {
    const { a, b, route } = ex;
    const p = b.div(a);
    if (st.kind === 'start') {
      return { tone: '', title: `Start with ${yEq(XV)}`, body: 'This is the original graph. Keep an eye on the labelled points as you step through.' };
    }
    const title = `Step ${i}: ${cap(st.kind === 'stretch' ? stretchPhrase(st.k) : translatePhrase(st.d))}`;
    let body = st.kind === 'stretch' ? stretchHint(st.k) : translateHint(st.d);
    let tone = '';
    const last = i === ex.stages.length - 1;
    if (b.isZero()) {
      body += ` Result: ${yEq(st.eq)}. ✓`;
      tone = 'good';
    } else if (route === 'factor') {
      if (st.kind === 'stretch') body += ` Nothing has been translated yet, so only the shape changes. Result: ${yEq(st.eq)}.`;
      else body += ` The shift is read straight from the factorised bracket, and nothing stretches it afterwards. Result: ${yEq(st.eq)}, which is ${yEq(linHTML(a, b))}. ✓`;
    } else if (route === 'translate') {
      if (st.kind === 'translate') body += ` The stretch hasn't happened yet, so we use the full shift from <span class="m">${fx(linHTML(1, b))}</span>. Result: ${yEq(st.eq)}.`;
      else body += ` The stretch also acts on the shift from step 1: ${shiftHTML(b.neg())} becomes ${shiftHTML(p.neg())}. Result: ${yEq(st.eq)}. ✓`;
    } else {
      if (st.kind === 'stretch') body += ` It's tempting to read <span class="m">${fx(linHTML(a, 0) + ' …')}</span> as "squash" and do that first. That's fine so far. Result: ${yEq(st.eq)}.`;
      else {
        const bt = `<span class="m">${b.isNeg() ? '−' : '+'} ${fracHTML(b.abs())}</span>`;
        body += ` Here the ${bt} in ${yEq(linHTML(a, b))} has been read as "move ${shiftHTML(b.neg())}". <b>But</b> the squash has already happened, so this gives <span class="m">y = ${fx(st.eq)} = ${fx(linHTML(a, b.mul(a)))}</span>, which is <b>not</b> ${yEq(linHTML(a, b))}. ✗`
          + `<br><br>You can only read a shift straight off the bracket when <i>x</i> is on its own. After the squash, take it from the factorised form ${yEq(factorHTML(a, b))}: ${shiftHTML(p.neg())}.`
          + ` (Moving ${shiftHTML(b.neg())} <b>before</b> the squash does work, because the squash then turns it into ${shiftHTML(p.neg())}.) Compare with the dashed target.`;
        tone = 'bad';
      }
    }
    if (last && tone === '' && route !== 'mistake') tone = 'good';
    return { tone, title, body };
  }

  function exSteps() {
    const wrongRoute = ex.route === 'mistake' && !ex.b.isZero();
    $('#ex-steps').innerHTML = ex.stages.map((st, i) => {
      const bad = wrongRoute && i === ex.stages.length - 1;
      return `<button class="step${i === ex.stage ? ' on' : ''}${bad ? ' bad' : ''}" data-i="${i}">
        <span class="n">${i === 0 ? 'Start' : 'Step ' + i}</span><span class="m">y = ${fx(st.eq)}</span></button>`;
    }).join('');
    $$('#ex-steps .step').forEach(btn => btn.addEventListener('click', () => { ex.token++; exGo(+btn.dataset.i); }));

    const info = stepInfo(ex.stages[ex.stage], ex.stage);
    const box = $('#ex-explain');
    box.className = 'explain' + (info.tone && !ex.animating ? ' ' + info.tone : '');
    box.innerHTML = `<h3>${info.title}</h3><p>${info.body}</p>`;

    $('#ex-back').disabled = ex.stage === 0;
    $('#ex-next').disabled = ex.stage === ex.stages.length - 1;

    const fn = FUNCS[ex.func];
    const head = ex.stages.map((st, i) => `<th class="${i === ex.stage ? 'on' : ''}">${i === 0 ? 'Start' : 'After step ' + i}<br><span class="m">y = ${fx(st.eq)}</span></th>`).join('');
    const rows = fn.keys.map(([name, u, y]) => `<tr><td>${name}</td>` + ex.stages.map((st, i) =>
      `<td class="m${i === ex.stage ? ' on' : ''}">(${fracHTML(st.s.mul(u).add(st.t))}, ${fracHTML(y)})</td>`).join('') + '</tr>').join('');
    $('#ex-table').innerHTML = `<table><thead><tr><th>Point</th>${head}</tr></thead><tbody>${rows}</tbody></table>`;
  }

  function exGo(i, done) {
    i = Math.max(0, Math.min(ex.stages.length - 1, i));
    if (ex.cancel) ex.cancel();
    const st = ex.stages[i];
    ex.stage = i; ex.animating = true;
    exSteps();
    ex.cancel = tween(ex.cur, { s: st.s.val(), t: st.t.val() }, DUR,
      (s, t) => { ex.cur = { s, t }; exRender(); },
      () => { ex.cancel = null; ex.animating = false; exRender(); exSteps(); if (done) done(); });
  }

  function exPlay() {
    exStop();
    const token = ex.token;
    ex.stage = 0; ex.cur = { s: 1, t: 0 }; exSteps(); exRender();
    let i = 0;
    const next = () => {
      if (ex.token !== token) return;
      i++;
      if (i >= ex.stages.length) return;
      exGo(i, () => setTimeout(next, 1400));
    };
    setTimeout(next, 600);
  }

  segSelect($('#ex-func'), 'func', v => { ex.func = v; exSetup(); });
  segSelect($('#ex-route'), 'route', v => { ex.route = v; exSetup(); exPlay(); });
  $$('#ex-a button').forEach(btn => btn.addEventListener('click', () => {
    $$('#ex-a button').forEach(b => b.classList.toggle('on', b === btn));
    ex.a = parseFrac(btn.dataset.a); exSetup();
  }));
  const bSlider = $('#ex-b');
  bSlider.addEventListener('input', () => { ex.b = F(+bSlider.value); exSetup(); });
  $('#ex-b-minus').addEventListener('click', () => { bSlider.value = Math.max(-6, +bSlider.value - 1); ex.b = F(+bSlider.value); exSetup(); });
  $('#ex-b-plus').addEventListener('click', () => { bSlider.value = Math.min(6, +bSlider.value + 1); ex.b = F(+bSlider.value); exSetup(); });
  $('#ex-target').addEventListener('change', exRender);
  $('#ex-back').addEventListener('click', () => { ex.token++; exGo(ex.stage - 1); });
  $('#ex-next').addEventListener('click', () => { ex.token++; exGo(ex.stage + 1); });
  $('#ex-play').addEventListener('click', exPlay);

  exSetup();

  /* =========================================================
     2. MATCH THE GRAPH
     ========================================================= */
  const mt = { level: 'starter', func: 'zigzag', a: F(2), b: F(3), ops: [], cur: { s: 1, t: 0 }, cancel: null, token: 0, solved: new Set(), played: false };
  const mtGraph = new Graph($('#mt-graph'));
  const seq = $('#mt-seq');
  const seqCards = () => $$('.seqcard', seq);

  function mtOrder() { return seqCards().map(c => c.dataset.kind); }
  function mtLabelOrder() {
    seqCards().forEach((c, i) => { $('.ord', c).textContent = i === 0 ? '1st' : '2nd'; });
  }
  function mtSetOrder(first) {
    const cards = seqCards();
    const want = first === cards[0].dataset.kind ? cards : [cards[1], cards[0]];
    seq.append(want[0], swapBtn, want[1]);
    mtLabelOrder();
  }
  const swapBtn = $('#mt-swap');
  function mtSwap() {
    const [c0, c1] = seqCards();
    seq.append(c1, swapBtn, c0);
    mtLabelOrder();
    seqCards().forEach(c => { c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash'); });
  }

  function mtNew() {
    const fn = FUNCS[mt.func];
    Object.assign(mt, pickAB(mt.level, fn, { a: mt.a, b: mt.b }));
    mt.solved = new Set();
    mtGraph.view = viewFor(fn, allStages(mt.a, mt.b));
    $('#mt-target').innerHTML = 'y = ' + fx(linHTML(mt.a, mt.b));
    $('#mt-refl-wrap').hidden = mt.level !== 'challenge';
    $('#mt-refl').checked = false;
    $('#mt-tr-amt').value = ''; $('#mt-sf').value = ''; $('#mt-dir').value = 'left';
    mtSetOrder(Math.random() < 0.5 ? 'translate' : 'stretch'); // neither order is the "default"
    mtReset();
  }

  function mtReset() {
    if (mt.cancel) mt.cancel();
    mt.cancel = null; mt.token++;
    mt.ops = []; mt.played = false;
    mt.cur = { s: 1, t: 0 };
    $('#mt-step').hidden = true;
    mtUpdate();
    mtRender();
  }

  function mtRender() {
    const fn = FUNCS[mt.func];
    const layers = [
      { s: 1, t: 0, cls: 'c-orig' },
      { s: mt.a.inv().val(), t: mt.b.div(mt.a).neg().val(), cls: 'c-target' }
    ];
    const moved = mt.cur.s !== 1 || mt.cur.t !== 0;
    if (moved) layers.push({ s: mt.cur.s, t: mt.cur.t, cls: 'c-cur' });
    mtGraph.render({ fn, layers, points: moved ? [{ s: mt.cur.s, t: mt.cur.t, cls: 'p-cur', label: false }] : [] });
  }

  function mtError(html) { const msg = $('#mt-msg'); msg.className = 'msg err'; msg.innerHTML = html; }

  function mtReadOps() {
    const tr = parseFrac($('#mt-tr-amt').value);
    const sfRaw = $('#mt-sf').value.trim();
    const refl = !$('#mt-refl-wrap').hidden && $('#mt-refl').checked;
    let sf = sfRaw === '' && refl ? F(1) : parseFrac(sfRaw);
    if (!tr) { mtError('Fill in the translation amount, e.g. <span class="m">3/2</span> or <span class="m">1.5</span>.'); $('#mt-tr-amt').focus(); return null; }
    if (tr.isNeg()) { mtError('Type a positive translation amount, and use the left/right menu for the direction.'); return null; }
    if (tr.isZero()) { mtError('A translation of 0 does nothing. Try another amount.'); return null; }
    if (!sf) { mtError('Fill in the scale factor, e.g. <span class="m">1/2</span> or <span class="m">3</span>.'); $('#mt-sf').focus(); return null; }
    if (sf.isZero() || sf.isNeg()) { mtError(mt.level === 'challenge' ? 'Use a positive scale factor, and tick the box to reflect.' : 'The scale factor must be positive.'); return null; }
    if (sf.eq(1) && !refl) { mtError('A scale factor of 1 does nothing. Try another value.'); return null; }
    const ops = {
      translate: { type: 'translate', d: $('#mt-dir').value === 'left' ? tr.neg() : tr },
      stretch: { type: 'stretch', k: refl ? sf.neg() : sf }
    };
    return mtOrder().map(k => ops[k]);
  }

  function mtPlay() {
    const ops = mtReadOps();
    if (!ops) return;
    if (mt.cancel) mt.cancel();
    const token = ++mt.token;
    mt.ops = ops; mt.played = false;
    mt.cur = { s: 1, t: 0 };
    mtRender();
    $('#mt-play').disabled = true;
    const msg = $('#mt-msg'); msg.className = 'msg'; msg.innerHTML = 'Watch the graph…';
    const box = $('#mt-step');
    box.hidden = false;
    let i = 0;
    const next = () => {
      if (token !== mt.token) return;
      if (i >= ops.length) {
        mt.played = true;
        $('#mt-play').disabled = false;
        box.hidden = true;
        mtUpdate();
        return;
      }
      const { s, t } = compose(ops.slice(0, i + 1));
      box.className = 'explain';
      box.innerHTML = `<h3>${i === 0 ? '1st' : '2nd'}: ${cap(opPhrase(ops[i]))}</h3><p>Now ${yEq(eqFromST(s, t))}</p>`;
      i++;
      mt.cancel = tween(mt.cur, { s: s.val(), t: t.val() }, DUR * 1.1,
        (ss, tt) => { mt.cur = { s: ss, t: tt }; mtRender(); },
        () => { mt.cancel = null; setTimeout(next, 900); });
    };
    setTimeout(next, 300);
  }

  function mtUpdate() {
    const { a, b, ops } = mt;
    const labels = { stretch: 'Stretch first', translate: 'Translate first' };
    const badges = () => { $('#mt-badges').innerHTML = ['translate', 'stretch'].map(k => `<span class="badge${mt.solved.has(k) ? ' on' : ''}">${mt.solved.has(k) ? '✓ ' : ''}${labels[k]}</span>`).join(''); };
    const msg = $('#mt-msg');
    const set = (cls, html) => { msg.className = 'msg' + (cls ? ' ' + cls : ''); msg.innerHTML = html; };

    if (!mt.played) {
      $('#mt-current').innerHTML = 'y = ' + fx(XV);
      set('', `Plan two transformations that turn <span class="m">y = <i>f</i>(<i>x</i>)</span> into ${yEq(linHTML(a, b))}, then press <b>Play</b>.`);
      badges();
      return;
    }

    const { s, t } = compose(ops);
    const A = s.inv(), B = t.neg().div(s);
    $('#mt-current').innerHTML = 'y = ' + fx(eqFromST(s, t));
    const firstT = ops[0].type === 'translate';
    const other = firstT ? 'stretching first' : 'translating first';

    if (A.eq(a) && B.eq(b)) {
      mt.solved.add(firstT ? 'translate' : 'stretch');
      let html = '<b>✓ Matched!</b> ';
      if (mt.solved.size === 2) {
        html += `You've done it both ways. Stretch first uses the factorised form ${yEq(factorHTML(a, b))}, so the shift is ${shiftHTML(b.div(a).neg())}. Translate first uses ${yEq(linHTML(a, b))} as it stands, so the shift is ${shiftHTML(b.neg())}, and the stretch then scales it. Try a new target!`;
      } else if (firstT) {
        html += `You translated first using ${yEq(linHTML(a, b))} as it stands, so the stretch scaled your shift. <b>Now try the other order:</b> press ⇅ Swap order so the stretch comes first. What does the translation need to be now?`;
      } else {
        html += `You stretched first, so the translation came from the factorised form ${yEq(factorHTML(a, b))}. <b>Now try the other order:</b> press ⇅ Swap order so the translation comes first. What does it need to be now?`;
      }
      set('good', html);
    } else {
      let html = `Your graph is ${yEq(eqFromST(s, t))}, but the target is ${yEq(linHTML(a, b))}. `;
      if (A.eq(a)) {
        html += firstT
          ? `The stretch is right, but because you translated <b>first</b>, the stretch also scaled your translation. With this order, use the shift from ${yEq(linHTML(1, b))}: ${shiftHTML(b.neg())}.`
          : `The stretch is right. Because you stretched <b>first</b>, read the translation from the factorised form ${yEq(factorHTML(a, b))}: ${shiftHTML(b.div(a).neg())}.`;
      } else if (A.eq(a.inv())) {
        html += `Check the scale factor. In ${yEq(linHTML(a, 0) + ' …')} the <i>x</i>-coordinates are multiplied by <span class="m">${fracHTML(a.inv().abs())}</span>, not <span class="m">${fracHTML(a.abs())}</span>.`;
      } else if (A.eq(a.neg())) {
        html += 'Check the reflection. The sign of the <i>x</i> coefficient is wrong.';
      } else {
        html += `The <i>x</i> coefficient should be <span class="m">${fracHTML(a)}</span>, so the stretch needs scale factor <span class="m">${fracHTML(a.inv().abs())}</span>${a.isNeg() ? ' with a reflection' : ''}.`;
      }
      html += ` Change your numbers, or try ${other}, then press Play again.`;
      set('hint', html);
    }
    badges();
  }

  // Swap button + drag-to-reorder (drag starts from the card's grip)
  swapBtn.addEventListener('click', mtSwap);
  let dragCard = null;
  seqCards().forEach(card => {
    $('.grip', card).addEventListener('mousedown', () => { card.draggable = true; });
    card.addEventListener('dragstart', e => { dragCard = card; card.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', card.dataset.kind); } catch (_) {} });
    card.addEventListener('dragend', () => { card.draggable = false; card.classList.remove('dragging'); seqCards().forEach(c => c.classList.remove('over')); dragCard = null; });
    card.addEventListener('dragover', e => { if (dragCard && dragCard !== card) { e.preventDefault(); card.classList.add('over'); } });
    card.addEventListener('dragleave', () => card.classList.remove('over'));
    card.addEventListener('drop', e => { e.preventDefault(); card.classList.remove('over'); if (dragCard && dragCard !== card) mtSwap(); });
  });

  $('#mt-play').addEventListener('click', mtPlay);
  ['#mt-tr-amt', '#mt-sf'].forEach(id => $(id).addEventListener('keydown', e => { if (e.key === 'Enter') mtPlay(); }));
  $('#mt-new').addEventListener('click', mtNew);
  segSelect($('#mt-level'), 'level', v => { mt.level = v; mtNew(); });
  segSelect($('#mt-func'), 'func', v => {
    mt.func = v;
    mtGraph.view = viewFor(FUNCS[v], allStages(mt.a, mt.b));
    mtRender();
  });

  mtNew();

  /* =========================================================
     3. TEST YOURSELF
     ========================================================= */
  const qz = { level: 'starter', q: null, correct: 0, total: 0, cur: { s: 1, t: 0 }, cancel: null, token: 0 };
  const qzGraph = new Graph($('#qz-graph'));

  function qzNew() {
    const func = pick(['zigzag', 'cubic']);
    const fn = FUNCS[func];
    const { a, b } = pickAB(qz.level, fn, qz.q);
    const key = pick(fn.keys);
    const p = b.div(a);

    const pool = [
      { ops: [{ type: 'stretch', k: a.inv() }, { type: 'translate', d: p.neg() }] },
      { ops: [{ type: 'translate', d: b.neg() }, { type: 'stretch', k: a.inv() }] },
      { ops: [{ type: 'stretch', k: a.inv() }, { type: 'translate', d: b.neg() }] }
    ];
    const extra = [
      { ops: [{ type: 'translate', d: p.neg() }, { type: 'stretch', k: a.inv() }] },
      { ops: [{ type: 'stretch', k: a }, { type: 'translate', d: p.neg() }] },
      { ops: [{ type: 'translate', d: b.neg() }, { type: 'stretch', k: a }] }
    ];
    const text = o => cap(o.ops.map(opPhrase).join(', <b>then</b> '));
    const used = new Set(pool.map(text));
    const extras = shuffle(extra).filter(o => !used.has(text(o)));
    if (extras.length) pool.push(extras[0]);
    const options = shuffle(pool).map(o => {
      const r = compose(o.ops);
      return { html: text(o), s: r.s, t: r.t, right: r.s.eq(a.inv()) && r.t.eq(p.neg()) };
    });

    qz.q = { func, fn, a, b, p, key, options, parts: [{ tries: 0, done: false }, { tries: 0, done: false }, { tries: 0, done: false }] };
    if (qz.cancel) qz.cancel();
    qz.token++;
    qz.cur = { s: 1, t: 0 };
    qzGraph.view = viewFor(fn, allStages(a, b));
    qzBuild();
    qzRender(false);
    $('#qz-watch').hidden = true;
    $('#qz-next').hidden = true;
    $('#qz-legend-target').hidden = true;
    const cap0 = $('#qz-caption');
    cap0.className = 'explain';
    cap0.innerHTML = 'Answer all three parts to unlock the animation.';
  }

  function qzRender(reveal, wrong) {
    const q = qz.q;
    const [name, u, y] = q.key;
    const layers = [{ s: 1, t: 0, cls: 'c-orig' }];
    const points = [{ s: 1, t: 0, cls: 'p-orig', keys: [[name, u, y]] }];
    if (reveal) {
      layers.push({ s: q.a.inv().val(), t: q.p.neg().val(), cls: 'c-target' });
      layers.push({ s: qz.cur.s, t: qz.cur.t, cls: wrong ? 'c-wrong' : 'c-cur' });
      points.push({ s: qz.cur.s, t: qz.cur.t, cls: wrong ? 'p-wrong' : 'p-cur', keys: [[name + '′', u, y]] });
    }
    qzGraph.render({ fn: q.fn, layers, points });
  }

  function qzBuild() {
    const q = qz.q;
    const { a, b } = q;
    const [name, u, y] = q.key;
    const body = $('#qz-body');
    body.innerHTML = `
      <div class="card">
        <span class="label">The graph of <span class="m">y = <i>f</i>(<i>x</i>)</span> is transformed to</span>
        <div class="expr-big m target-eq">y = ${fx(linHTML(a, b))}</div>
      </div>

      <div class="card qpart" id="qp1">
        <div class="qhead"><span class="qnum">a</span><p>Factorise the inside of the bracket.</p></div>
        <div class="qq m">${fx(linHTML(a, b))} = ${a.eq(-1) ? '<i>f</i>(−(' : `<i>f</i>(${fracHTML(a)}(`}<i>x</i> + <input type="text" id="qz-p" aria-label="Value inside bracket">))</div>
        <div class="row"><button class="btn primary" id="qz-c1">Check</button><button class="btn ghost" id="qz-s1" hidden>Show answer</button></div>
        <div class="fb" id="qz-f1"></div>
      </div>

      <div class="card qpart" id="qp2">
        <div class="qhead"><span class="qnum">b</span><p>Which of these sequences map <span class="m">y = <i>f</i>(<i>x</i>)</span> onto ${yEq(linHTML(a, b))}? <b>Tick all that work.</b></p></div>
        <div class="opts">${q.options.map((o, i) => `<label class="opt" id="qz-o${i}"><input type="checkbox" value="${i}"><span>${o.html}<span class="res"></span></span></label>`).join('')}</div>
        <div class="row" style="margin-top:10px"><button class="btn primary" id="qz-c2">Check</button><button class="btn ghost" id="qz-s2" hidden>Show answer</button></div>
        <div class="fb" id="qz-f2"></div>
      </div>

      <div class="card qpart" id="qp3">
        <div class="qhead"><span class="qnum">c</span><p>Point <b>${name}</b> <span class="m">(${num(u)}, ${num(y)})</span> lies on <span class="m">y = <i>f</i>(<i>x</i>)</span>. Find the coordinates of its image on ${yEq(linHTML(a, b))}.</p></div>
        <div class="qq m">( <input type="text" id="qz-x" aria-label="x-coordinate"> , <input type="text" id="qz-y" aria-label="y-coordinate"> )</div>
        <div class="row"><button class="btn primary" id="qz-c3">Check</button><button class="btn ghost" id="qz-s3" hidden>Show answer</button></div>
        <div class="fb" id="qz-f3"></div>
      </div>`;

    $('#qz-c1').addEventListener('click', qzCheck1);
    $('#qz-c2').addEventListener('click', qzCheck2);
    $('#qz-c3').addEventListener('click', qzCheck3);
    $('#qz-s1').addEventListener('click', () => qzShow(1));
    $('#qz-s2').addEventListener('click', () => qzShow(2));
    $('#qz-s3').addEventListener('click', () => qzShow(3));
    $('#qz-p').addEventListener('keydown', e => { if (e.key === 'Enter') qzCheck1(); });
    ['#qz-x', '#qz-y'].forEach(id => $(id).addEventListener('keydown', e => { if (e.key === 'Enter') qzCheck3(); }));
  }

  function fb(i, cls, html) { const el = $('#qz-f' + i); el.className = 'fb ' + cls; el.innerHTML = html; }

  function qzFinishPart(i, firstTry) {
    const part = qz.q.parts[i - 1];
    if (part.done) return;
    part.done = true;
    qz.total++;
    if (firstTry) qz.correct++;
    $('#qp' + i).classList.add('done');
    $('#qz-c' + i).disabled = true;
    $('#qz-s' + i).hidden = true;
    $('#qz-score').textContent = `${qz.correct} / ${qz.total}`;
    if (qz.q.parts.every(p => p.done)) qzUnlock();
  }

  function qzCheck1() {
    const q = qz.q, part = q.parts[0];
    if (part.done) return;
    const inp = $('#qz-p');
    const v = parseFrac(inp.value);
    if (!v) { fb(1, 'info', 'Type a number, e.g. <span class="m">3/2</span> or <span class="m">−1.5</span>.'); return; }
    part.tries++;
    if (v.eq(q.p)) {
      inp.className = 'ok';
      fb(1, 'good', `✓ Correct: <span class="m">${fracHTML(q.b)} ÷ ${q.a.isNeg() ? '(' + fracHTML(q.a) + ')' : fracHTML(q.a)} = ${fracHTML(q.p)}</span>, so ${yEq(factorHTML(q.a, q.b))}.`);
      qzFinishPart(1, part.tries === 1);
    } else {
      inp.className = 'no';
      let hint = `Not quite. Divide the constant term by <span class="m">${fracHTML(q.a)}</span>.`;
      if (v.eq(q.b)) hint = `That's the original constant. When you take out the factor of <span class="m">${fracHTML(q.a)}</span>, the constant must be divided by it too. Check by expanding.`;
      else if (v.eq(q.b.mul(q.a))) hint = `You multiplied by <span class="m">${fracHTML(q.a)}</span>. You need to divide instead. Check by expanding the bracket.`;
      fb(1, 'bad', hint);
      $('#qz-s1').hidden = false;
    }
  }

  function qzCheck2() {
    const q = qz.q, part = q.parts[1];
    if (part.done) return;
    const chosen = new Set($$('#qp2 input:checked').map(i => +i.value));
    if (!chosen.size) { fb(2, 'info', 'Tick at least one option.'); return; }
    part.tries++;
    const allRight = q.options.every((o, i) => o.right === chosen.has(i));
    if (allRight) {
      qzMarkOptions();
      fb(2, 'good', `✓ Correct. Both orders work, <b>as long as</b> the translation matches: stretch first uses the factorised shift ${shiftHTML(q.p.neg())}; translate first uses the full shift ${shiftHTML(q.b.neg())}.`);
      qzFinishPart(2, part.tries === 1);
    } else {
      const nRight = q.options.filter(o => o.right).length;
      fb(2, 'bad', `Not quite. Exactly ${nRight} of these work. Hint: a stretch applied <b>after</b> a translation also stretches that translation, but a translation applied after a stretch is not changed.`);
      $('#qz-s2').hidden = false;
    }
  }

  function qzMarkOptions() {
    const q = qz.q;
    q.options.forEach((o, i) => {
      const el = $('#qz-o' + i);
      el.classList.add(o.right ? 'right' : 'wrong');
      el.querySelector('input').checked = o.right;
      el.querySelector('input').disabled = true;
      $('.res', el).innerHTML = (o.right ? '✓ gives ' : '✗ gives ') + yEq(eqFromST(o.s, o.t));
    });
  }

  function qzCheck3() {
    const q = qz.q, part = q.parts[2];
    if (part.done) return;
    const [, u, y] = q.key;
    const ix = $('#qz-x'), iy = $('#qz-y');
    const vx = parseFrac(ix.value), vy = parseFrac(iy.value);
    if (!vx || !vy) { fb(3, 'info', 'Fill in both coordinates. Fractions like <span class="m">−7/2</span> are fine.'); return; }
    part.tries++;
    const ax = F(u).sub(q.b).div(q.a);
    const okX = vx.eq(ax), okY = vy.eq(y);
    ix.className = okX ? 'ok' : 'no';
    iy.className = okY ? 'ok' : 'no';
    if (okX && okY) {
      fb(3, 'good', `✓ Correct: <span class="m">(${fracHTML(ax)}, ${num(y)})</span>. Check: when <span class="m"><i>x</i> = ${fracHTML(ax)}</span>, <span class="m">${linHTML(q.a, q.b)} = ${num(u)}</span>, so <span class="m">y = <i>f</i>(${num(u)}) = ${num(y)}</span>.`);
      qzFinishPart(3, part.tries === 1);
    } else {
      let hint = '';
      if (!okY) hint += 'A horizontal transformation never changes the <i>y</i>-coordinate. ';
      if (!okX) {
        if (vx.eq(F(u).sub(q.b))) hint += `You translated but didn't stretch. `;
        else if (vx.eq(F(u).mul(q.a.inv()).sub(q.b))) hint += `That's the common mistake: you stretched first, then moved by the unfactorised <span class="m">${fracHTML(q.b.abs())}</span>. After stretching, use the shift from the factorised form. `;
        else if (vx.eq(F(u).sub(q.p).mul(q.a.inv()))) hint += 'You translated by the factorised shift, then stretched, so the stretch shrank that shift too. ';
        hint += `Try solving <span class="m">${linHTML(q.a, q.b)} = ${num(u)}</span> for <i>x</i>.`;
      }
      fb(3, 'bad', hint);
      $('#qz-s3').hidden = false;
    }
  }

  function qzShow(i) {
    const q = qz.q;
    if (i === 1) {
      $('#qz-p').value = q.p.d === 1 ? String(q.p.n) : `${q.p.n}/${q.p.d}`;
      $('#qz-p').className = '';
      fb(1, 'info', `The answer is <span class="m">${fracHTML(q.p)}</span>, since <span class="m">${fracHTML(q.b)} ÷ ${q.a.isNeg() ? '(' + fracHTML(q.a) + ')' : fracHTML(q.a)} = ${fracHTML(q.p)}</span>, so ${yEq(factorHTML(q.a, q.b))}.`);
    } else if (i === 2) {
      qzMarkOptions();
      fb(2, 'info', `A stretch applied <b>after</b> a translation scales that translation. Stretch first: shift ${shiftHTML(q.p.neg())}. Translate first: shift ${shiftHTML(q.b.neg())}.`);
    } else {
      const [, u, y] = q.key;
      const ax = F(u).sub(q.b).div(q.a);
      $('#qz-x').value = ax.d === 1 ? String(ax.n) : `${ax.n}/${ax.d}`;
      $('#qz-y').value = String(y);
      $('#qz-x').className = $('#qz-y').className = '';
      fb(3, 'info', `Solve <span class="m">${linHTML(q.a, q.b)} = ${num(u)}</span>, giving <span class="m"><i>x</i> = ${fracHTML(ax)}</span>. The image is <span class="m">(${fracHTML(ax)}, ${num(y)})</span>.`);
    }
    qzFinishPart(i, false);
  }

  function qzUnlock() {
    const q = qz.q;
    $('#qz-watch').hidden = false;
    $('#qz-next').hidden = false;
    $('#qz-legend-target').hidden = false;
    $('#qz-target-eq').innerHTML = 'y = ' + fx(linHTML(q.a, q.b));
    qzPlay('factor');
  }

  function qzPlay(route) {
    const q = qz.q;
    if (qz.cancel) qz.cancel();
    const token = ++qz.token;
    const stages = stagesFor(route, q.a, q.b);
    const box = $('#qz-caption');
    qz.cur = { s: 1, t: 0 };
    qzRender(true);
    box.className = 'explain';
    box.innerHTML = `<h3>Start: ${yEq(XV)}</h3><p>${route === 'mistake' ? 'Watch what goes wrong…' : 'Watch the point move.'}</p>`;
    let i = 0;
    const next = () => {
      if (qz.token !== token) return;
      i++;
      if (i >= stages.length) return;
      const st = stages[i];
      const last = i === stages.length - 1;
      const wrong = route === 'mistake' && last;
      qz.cancel = tween(qz.cur, { s: st.s.val(), t: st.t.val() }, DUR,
        (s, t) => { qz.cur = { s, t }; qzRender(true); },
        () => {
          if (qz.token !== token) return;
          qzRender(true, wrong);
          const phrase = cap(st.kind === 'stretch' ? stretchPhrase(st.k) : translatePhrase(st.d));
          let tail = `Now ${yEq(st.eq)}.`;
          if (last && !wrong) tail += ' ✓ Matches the target.';
          if (wrong) tail = `Now <span class="m">y = ${fx(st.eq)} = ${fx(linHTML(q.a, q.b.mul(q.a)))}</span>. ✗ That's not ${yEq(linHTML(q.a, q.b))}. After the stretch, the shift must come from the factorised form: ${shiftHTML(q.p.neg())}, not ${shiftHTML(q.b.neg())}.`;
          box.className = 'explain' + (last ? (wrong ? ' bad' : ' good') : '');
          box.innerHTML = `<h3>Step ${i}: ${phrase}</h3><p>${tail}</p>`;
          setTimeout(next, 1300);
        });
      const phrase = cap(st.kind === 'stretch' ? stretchPhrase(st.k) : translatePhrase(st.d));
      box.className = 'explain';
      box.innerHTML = `<h3>Step ${i}: ${phrase}</h3><p>${st.kind === 'stretch' ? stretchHint(st.k) : translateHint(st.d)}</p>`;
    };
    setTimeout(next, 700);
  }

  $$('#qz-watch button').forEach(btn => btn.addEventListener('click', () => qzPlay(btn.dataset.route)));
  $('#qz-next').addEventListener('click', qzNew);
  segSelect($('#qz-level'), 'level', v => { qz.level = v; qzNew(); });

  qzNew();
})();
