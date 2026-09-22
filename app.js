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
  const val = x => (x instanceof Frac ? x.val() : x);

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
  const fracText = f => (f.d === 1 ? String(f.n) : `${f.n}/${f.d}`);

  /* =========================================================
     Maths formatting (HTML)
     ========================================================= */
  const XV = '<i>x</i>';
  const FX = '<i>f</i>(<i>x</i>)';
  const fx = inner => `<i>f</i>(${inner})`;
  const num = x => (x < 0 ? '−' : '') + Math.abs(x);
  const mm = h => `<span class="m">${h}</span>`;
  const Y = rhs => mm(`y = ${rhs}`);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const vec2 = (top, bot) => `<span class="vec"><span>${top}</span><span>${bot}</span></span>`;

  function fracHTML(f) {
    f = Frac.of(f);
    const s = f.n < 0 ? '−' : '';
    const n = Math.abs(f.n);
    if (f.d === 1) return s + n;
    return `${s}<span class="frac"><span>${n}</span><span>${f.d}</span></span>`;
  }
  // m·body, e.g. 2x, −x, ½f(x)
  function coefHTML(m, body) {
    m = Frac.of(m);
    if (m.eq(1)) return body;
    if (m.eq(-1)) return '−' + body;
    return fracHTML(m) + body;
  }
  // " + c" / " − c" / ""
  function plusHTML(c) {
    c = Frac.of(c);
    return c.isZero() ? '' : (c.isNeg() ? ' − ' : ' + ') + fracHTML(c.abs());
  }
  const linHTML = (A, B) => coefHTML(A, XV) + plusHTML(B);
  const prefixHTML = a => (a.eq(-1) ? '−' : fracHTML(a));
  const divHTML = (b, a) => `${fracHTML(b)} ÷ ${a.isNeg() ? '(' + fracHTML(a) + ')' : fracHTML(a)} = ${fracHTML(b.div(a))}`;
  const signed = x => (x < 0 ? `(${num(x)})` : num(x));

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

  /* A graph state ("map") sends each point (u, f(u)) to (s·u + t, S·f(u) + T).
     Each topic turns its own pair (m, c) into a map: inside the bracket acts on x, outside acts on y. */
  const ID = { s: 1, t: 0, S: 1, T: 0 };
  const isID = mp => Math.abs(mp.s - 1) < 1e-9 && Math.abs(mp.t) < 1e-9 && Math.abs(mp.S - 1) < 1e-9 && Math.abs(mp.T) < 1e-9;

  function viewFor(fn, maps) {
    const [d0, d1] = domainOf(fn);
    const ys = samples(fn).map(p => p[1]);
    const fmin = Math.min(...ys), fmax = Math.max(...ys);
    let mx = 4, ylo = fn.y[0], yhi = fn.y[1];
    for (const mp of maps) {
      for (const u of [d0, d1]) mx = Math.max(mx, Math.abs(mp.s * u + mp.t));
      const y1 = mp.S * fmin + mp.T, y2 = mp.S * fmax + mp.T;
      ylo = Math.min(ylo, y1 - 1, y2 - 1);
      yhi = Math.max(yhi, y1 + 1, y2 + 1);
    }
    let h = 48;
    for (const c of [6, 8, 10, 12, 16, 20, 24, 32, 40]) if (mx + 0.5 <= c) { h = c; break; }
    return { x0: -h, x1: h, y0: Math.floor(ylo), y1: Math.ceil(yhi) };
  }

  // Compose transformations; every topic uses the same algebra on its (m, c) pair.
  function compose(ops) {
    let m = F(1), c = F(0);
    for (const o of ops) {
      if (o.type === 'translate') c = c.add(o.d);
      else { m = m.mul(o.k); c = c.mul(o.k); }
    }
    return { m, c };
  }

  /* =========================================================
     SVG graph
     ========================================================= */
  class Graph {
    constructor(svg, W = 660, H = 420) {
      this.svg = svg; this.W = W; this.H = H;
      this.pad = { l: 6, r: 6, t: 6, b: 6 };
      this.id = 'clip' + Math.random().toString(36).slice(2, 9);
      this.view = { x0: -10, x1: 10, y0: -5, y1: 5 };
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    }
    X(x) { const v = this.view, p = this.pad; return p.l + (x - v.x0) / (v.x1 - v.x0) * (this.W - p.l - p.r); }
    Y(y) { const v = this.view, p = this.pad; return p.t + (v.y1 - y) / (v.y1 - v.y0) * (this.H - p.t - p.b); }
    path(fn, mp) {
      return 'M' + samples(fn).map(([u, y]) => `${this.X(mp.s * u + mp.t).toFixed(1)},${this.Y(mp.S * y + mp.T).toFixed(1)}`).join('L');
    }
    render({ fn, layers = [], points = [], ticks = true }) {
      const v = this.view, p = this.pad;
      const L = p.l, R = this.W - p.r, T = p.t, B = this.H - p.b;
      const o = [];
      o.push(`<defs><clipPath id="${this.id}"><rect x="${L}" y="${T}" width="${R - L}" height="${B - T}"/></clipPath></defs>`);
      o.push(`<rect class="plot-bg" x="${L}" y="${T}" width="${R - L}" height="${B - T}" rx="6"/>`);
      const w = v.x1 - v.x0, h = v.y1 - v.y0;
      const gx = w <= 24 ? 1 : 2, lx = w <= 16 ? 2 : (w <= 32 ? 4 : 8);
      const gy = h <= 24 ? 1 : 2, ly = h <= 12 ? 1 : (h <= 24 ? 2 : 4);
      for (let x = Math.ceil(v.x0 / gx) * gx; x <= v.x1; x += gx) {
        const X = this.X(x).toFixed(1);
        o.push(`<line class="grid${x % lx === 0 ? ' major' : ''}" x1="${X}" y1="${T}" x2="${X}" y2="${B}"/>`);
      }
      for (let y = Math.ceil(v.y0 / gy) * gy; y <= v.y1; y += gy) {
        const Yp = this.Y(y).toFixed(1);
        o.push(`<line class="grid${y % ly === 0 ? ' major' : ''}" x1="${L}" y1="${Yp}" x2="${R}" y2="${Yp}"/>`);
      }
      const ax = this.Y(0), ay = this.X(0);
      o.push(`<line class="axis" x1="${L}" y1="${ax}" x2="${R}" y2="${ax}"/>`);
      o.push(`<line class="axis" x1="${ay}" y1="${T}" x2="${ay}" y2="${B}"/>`);
      if (ticks) {
        for (let x = Math.ceil(v.x0 / lx) * lx; x <= v.x1; x += lx) {
          if (x === 0 || x === v.x0 || x === v.x1) continue;
          o.push(`<text class="tick" x="${this.X(x)}" y="${ax + 16}" text-anchor="middle">${num(x)}</text>`);
        }
        for (let y = Math.ceil(v.y0 / ly) * ly; y <= v.y1; y += ly) {
          if (y === 0 || y === v.y0 || y === v.y1) continue;
          o.push(`<text class="tick" x="${ay - 6}" y="${this.Y(y) + 4}" text-anchor="end">${num(y)}</text>`);
        }
      }
      o.push(`<text class="axname" x="${R - 8}" y="${ax - 8}" text-anchor="end">x</text>`);
      o.push(`<text class="axname" x="${ay + 8}" y="${T + 16}">y</text>`);
      o.push(`<g clip-path="url(#${this.id})">`);
      for (const ly2 of layers) o.push(`<path class="${ly2.cls}" d="${this.path(fn, ly2)}"/>`);
      for (const pt of points) {
        for (const [name, u, y] of (pt.keys || fn.keys)) {
          const cx = this.X(pt.s * u + pt.t), cy = this.Y(pt.S * y + pt.T);
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
    const f = { ...from }, start = performance.now();
    let raf = 0, dead = false;
    function step(now) {
      if (dead) return;
      const k = ms <= 0 ? 1 : Math.min(1, (now - start) / ms);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      onFrame({ s: f.s + (to.s - f.s) * e, t: f.t + (to.t - f.t) * e, S: f.S + (to.S - f.S) * e, T: f.T + (to.T - f.T) * e });
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

  /* =========================================================
     Wording for each axis
     ========================================================= */
  const HORIZ = {
    stretchPhrase(k) {
      const m = k.abs(), parts = [];
      if (!m.eq(1)) parts.push(`stretch parallel to the <i>x</i>-axis, scale factor ${mm(fracHTML(m))}`);
      if (k.isNeg()) parts.push('reflection in the <i>y</i>-axis');
      return parts.join(' and ');
    },
    stretchHint(k) {
      const m = k.abs();
      let h = '';
      if (m.val() < 1) h = `Every <i>x</i>-coordinate is multiplied by ${mm(fracHTML(m))}, so the graph is <b>squashed</b> horizontally towards the <i>y</i>-axis.`;
      else if (m.val() > 1) h = `Every <i>x</i>-coordinate is multiplied by ${mm(fracHTML(m))}, so the graph is <b>stretched</b> horizontally away from the <i>y</i>-axis.`;
      if (k.isNeg()) h += (h ? ' ' : '') + 'Every <i>x</i>-coordinate also changes sign, which reflects the graph in the <i>y</i>-axis.';
      return h;
    },
    translatePhrase: d => `translation by vector ${vec2(fracHTML(d), '0')}`,
    translateHint(d) {
      const m = mm(fracHTML(d.abs()));
      return d.isNeg()
        ? `Every <i>x</i>-coordinate decreases by ${m}, so the graph moves ${m} to the <b>left</b>.`
        : `Every <i>x</i>-coordinate increases by ${m}, so the graph moves ${m} to the <b>right</b>.`;
    },
    shift: d => `${mm(fracHTML(d.abs()))} ${d.isNeg() ? 'left' : 'right'}`
  };
  const VERT = {
    stretchPhrase(k) {
      const m = k.abs(), parts = [];
      if (!m.eq(1)) parts.push(`stretch parallel to the <i>y</i>-axis, scale factor ${mm(fracHTML(m))}`);
      if (k.isNeg()) parts.push('reflection in the <i>x</i>-axis');
      return parts.join(' and ');
    },
    stretchHint(k) {
      const m = k.abs();
      let h = '';
      if (m.val() < 1) h = `Every <i>y</i>-coordinate is multiplied by ${mm(fracHTML(m))}, so the graph is <b>squashed</b> vertically towards the <i>x</i>-axis.`;
      else if (m.val() > 1) h = `Every <i>y</i>-coordinate is multiplied by ${mm(fracHTML(m))}, so the graph is <b>stretched</b> vertically away from the <i>x</i>-axis.`;
      if (k.isNeg()) h += (h ? ' ' : '') + 'Every <i>y</i>-coordinate also changes sign, which reflects the graph in the <i>x</i>-axis.';
      return h + ' Points on the <i>x</i>-axis stay where they are.';
    },
    translatePhrase: d => `translation by vector ${vec2('0', fracHTML(d))}`,
    translateHint(d) {
      const m = mm(fracHTML(d.abs()));
      return d.isNeg()
        ? `Every <i>y</i>-coordinate decreases by ${m}, so the graph moves ${m} <b>down</b>.`
        : `Every <i>y</i>-coordinate increases by ${m}, so the graph moves ${m} <b>up</b>.`;
    },
    shift: d => `${mm(fracHTML(d.abs()))} ${d.isNeg() ? 'down' : 'up'}`
  };

  /* =========================================================
     Topic: y = f(ax + b)   (inside the function)
     ========================================================= */
  function innerFactor(a, b) {
    if (b.isZero()) return linHTML(a, 0);
    if (a.eq(1)) return linHTML(1, b);
    return `${prefixHTML(a)}(${linHTML(1, b.div(a))})`;
  }
  const innerBracket = (a, c) => `${prefixHTML(a)}(${linHTML(1, c)})`;

  const INSIDE = {
    ...HORIZ,
    id: 'inside',
    name: `y = ${fx('<i>a</i><i>x</i> + <i>b</i>')}`,
    lede: `Why does ${Y(fx(linHTML(2, 3)))} move the graph left by ${mm(fracHTML(F(3, 2)))} and not by 3? Start with the short walkthrough, then explore, match graphs and test yourself.`,
    formHTML: fx('<i>a</i><i>x</i> + <i>b</i>'),
    map: (m, c) => ({ s: val(m), t: val(c), S: 1, T: 0 }),
    coord: (m, c, u, y) => [m.mul(u).add(c), F(y)],
    target: (a, b) => ({ m: a.inv(), c: b.div(a).neg() }),
    rhs: (m, c) => { m = Frac.of(m); c = Frac.of(c); return fx(linHTML(m.inv(), c.neg().div(m))); },
    expr: (a, b) => fx(linHTML(a, b)),
    factored: (a, b) => fx(innerFactor(a, b)),
    routes: [
      { id: 'factor', label: 'Factorise: stretch, then translate', short: 'Stretch, then translate' },
      { id: 'translate', label: "Don't factorise: translate, then stretch", short: 'Translate, then stretch' },
      { id: 'mistake', label: 'Common mistake', short: 'Common mistake', warn: true }
    ],
    stages(route, a, b) {
      const s = a.inv(), p = b.div(a), zero = F(0), one = F(1);
      const st = [{ m: one, c: zero, eq: FX, kind: 'start' }];
      if (route === 'factor') {
        st.push({ m: s, c: zero, eq: fx(linHTML(a, 0)), kind: 'stretch', k: s });
        st.push({ m: s, c: p.neg(), eq: fx(innerFactor(a, b)), kind: 'translate', d: p.neg() });
      } else if (route === 'translate') {
        st.push({ m: one, c: b.neg(), eq: fx(linHTML(1, b)), kind: 'translate', d: b.neg() });
        st.push({ m: s, c: p.neg(), eq: fx(linHTML(a, b)), kind: 'stretch', k: s });
      } else {
        st.push({ m: s, c: zero, eq: fx(linHTML(a, 0)), kind: 'stretch', k: s });
        st.push({ m: s, c: b.neg(), eq: fx(innerBracket(a, b)), kind: 'translate', d: b.neg() });
      }
      return st.filter((x, i) => i === 0 || !(x.kind === 'translate' && x.d.isZero()));
    },
    stepText(route, st, a, b) {
      const p = b.div(a);
      let body = st.kind === 'stretch' ? HORIZ.stretchHint(st.k) : HORIZ.translateHint(st.d);
      let tone = '';
      if (b.isZero()) { body += ` Result: ${Y(st.eq)}. ✓`; tone = 'good'; }
      else if (route === 'factor') {
        if (st.kind === 'stretch') body += ` Nothing has been translated yet, so only the shape changes. Result: ${Y(st.eq)}.`;
        else { body += ` The shift is read straight from the factorised bracket, and nothing stretches it afterwards. Result: ${Y(st.eq)}, which is ${Y(fx(linHTML(a, b)))}. ✓`; tone = 'good'; }
      } else if (route === 'translate') {
        if (st.kind === 'translate') body += ` The stretch hasn't happened yet, so we use the full shift from ${mm(fx(linHTML(1, b)))}. Result: ${Y(st.eq)}.`;
        else { body += ` The stretch also acts on the shift from step 1: ${HORIZ.shift(b.neg())} becomes ${HORIZ.shift(p.neg())}. Result: ${Y(st.eq)}. ✓`; tone = 'good'; }
      } else if (st.kind === 'stretch') {
        body += ` It's tempting to read ${mm(fx(linHTML(a, 0) + ' …'))} as "squash" and do that first. That's fine so far. Result: ${Y(st.eq)}.`;
      } else {
        const bt = mm(`${b.isNeg() ? '−' : '+'} ${fracHTML(b.abs())}`);
        body += ` Here the ${bt} in ${Y(fx(linHTML(a, b)))} has been read as "move ${HORIZ.shift(b.neg())}". <b>But</b> the squash has already happened, so this gives ${mm(`y = ${st.eq} = ${fx(linHTML(a, b.mul(a)))}`)}, which is <b>not</b> ${Y(fx(linHTML(a, b)))}. ✗`
          + `<br><br>You can only read a shift straight off the bracket when <i>x</i> is on its own. After the squash, take it from the factorised form ${Y(fx(innerFactor(a, b)))}: ${HORIZ.shift(p.neg())}.`
          + ` (Moving ${HORIZ.shift(b.neg())} <b>before</b> the squash does work, because the squash then turns it into ${HORIZ.shift(p.neg())}.) Compare with the dashed target.`;
        tone = 'bad';
      }
      return { tone, body };
    },
    factorLabel: 'Factorise the bracket',
    factorNote: (a, b) => `Take out the factor of ${mm(fracHTML(a))}: ${mm(divHTML(b, a))}.`,
    ideaIntro: 'Inside the bracket, the graph undoes what happens to <i>x</i>, so the transformations come in the <b>reverse order</b>.',
    idea(a, b) {
      const p = b.div(a);
      return `<li>In ${mm(fx(linHTML(a, b)))}, <i>x</i> is <b>multiplied</b> by ${fracHTML(a)} and <b>then</b> ${fracHTML(b.abs())} is ${b.isNeg() ? 'subtracted' : 'added'}. So the graph <b>translates first</b> (${HORIZ.shift(b.neg())}), then stretches.</li>
        <li>In ${mm(fx(innerFactor(a, b)))}, ${fracHTML(p.abs())} is ${p.isNeg() ? 'subtracted' : 'added'} <b>first</b>, then the result is multiplied by ${fracHTML(a)}. So the graph <b>stretches first</b>, then translates ${HORIZ.shift(p.neg())}.</li>`;
    },
    tableNote: 'Only the <i>x</i>-coordinates change. The <i>y</i>-coordinates stay the same throughout.',
    pools: {
      starter: { a: [[2], [3], [4]], b: [-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6] },
      challenge: { a: [[2], [3], [1, 2], [3, 2], [-1], [-2], [-1, 2]], b: [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5] }
    },
    viewOK: v => v.x1 <= 20,
    match: {
      trLabel: 'Translate horizontally', neg: 'left', pos: 'right',
      sfLabel: 'Stretch parallel to the <i>x</i>-axis', refl: 'and reflect in the <i>y</i>-axis',
      success(firstT, both, a, b) {
        if (both) return `You've done it both ways. Stretch first uses the factorised form ${Y(fx(innerFactor(a, b)))}, so the shift is ${HORIZ.shift(b.div(a).neg())}. Translate first uses ${Y(fx(linHTML(a, b)))} as it stands, so the shift is ${HORIZ.shift(b.neg())}, and the stretch then scales it. Try a new target!`;
        return firstT
          ? `You translated first using ${Y(fx(linHTML(a, b)))} as it stands, so the stretch scaled your shift. <b>Now try the other order:</b> press ⇅ Swap order so the stretch comes first. What does the translation need to be now?`
          : `You stretched first, so the translation came from the factorised form ${Y(fx(innerFactor(a, b)))}. <b>Now try the other order:</b> press ⇅ Swap order so the translation comes first. What does it need to be now?`;
      },
      shiftHint: (firstT, a, b) => firstT
        ? `The stretch is right, but because you translated <b>first</b>, the stretch also scaled your translation. With this order, use the shift from ${Y(fx(linHTML(1, b)))}: ${HORIZ.shift(b.neg())}.`
        : `The stretch is right. Because you stretched <b>first</b>, read the translation from the factorised form ${Y(fx(innerFactor(a, b)))}: ${HORIZ.shift(b.div(a).neg())}.`,
      sfInvHint: a => `Check the scale factor. In ${Y(fx(linHTML(a, 0) + ' …'))} the <i>x</i>-coordinates are multiplied by ${mm(fracHTML(a.inv().abs()))}, not ${mm(fracHTML(a.abs()))}.`,
      sfHint: a => `The <i>x</i> coefficient should be ${mm(fracHTML(a))}, so the stretch needs scale factor ${mm(fracHTML(a.inv().abs()))}${a.isNeg() ? ' with a reflection' : ''}.`
    },
    quiz: {
      aPrompt: 'Factorise the inside of the bracket.',
      aLine: (a, b, input) => `${fx(linHTML(a, b))} = ${a.eq(-1) ? '<i>f</i>(−(' : `<i>f</i>(${fracHTML(a)}(`}<i>x</i> + ${input}))`,
      aCorrect: (a, b) => `✓ Correct: ${mm(divHTML(b, a))}, so ${Y(fx(innerFactor(a, b)))}.`,
      pool(a, b) {
        const p = b.div(a), k = a.inv();
        return {
          main: [
            [{ type: 'stretch', k }, { type: 'translate', d: p.neg() }],
            [{ type: 'translate', d: b.neg() }, { type: 'stretch', k }],
            [{ type: 'stretch', k }, { type: 'translate', d: b.neg() }]
          ],
          extra: [
            [{ type: 'translate', d: p.neg() }, { type: 'stretch', k }],
            [{ type: 'stretch', k: a }, { type: 'translate', d: p.neg() }],
            [{ type: 'translate', d: b.neg() }, { type: 'stretch', k: a }]
          ]
        };
      },
      bCorrect: (a, b) => `✓ Correct. Both orders work, <b>as long as</b> the translation matches: stretch first uses the factorised shift ${HORIZ.shift(b.div(a).neg())}; translate first uses the full shift ${HORIZ.shift(b.neg())}.`,
      bShow: (a, b) => `A stretch applied <b>after</b> a translation scales that translation. Stretch first: shift ${HORIZ.shift(b.div(a).neg())}. Translate first: shift ${HORIZ.shift(b.neg())}.`,
      image: (u, v, a, b) => [F(u).sub(b).div(a), F(v)],
      cCorrect: (u, v, a, b, X) => `✓ Correct: ${mm(`(${fracHTML(X)}, ${num(v)})`)}. Check: when ${mm(`<i>x</i> = ${fracHTML(X)}`)}, ${mm(`${linHTML(a, b)} = ${num(u)}`)}, so ${mm(`y = <i>f</i>(${num(u)}) = ${num(v)}`)}.`,
      cHint(vx, vy, u, v, a, b, okX, okY) {
        const p = b.div(a);
        let hint = '';
        if (!okY) hint += 'A horizontal transformation never changes the <i>y</i>-coordinate. ';
        if (!okX) {
          if (vx.eq(F(u).sub(b))) hint += "You translated but didn't stretch. ";
          else if (vx.eq(F(u).mul(a.inv()).sub(b))) hint += `That's the common mistake: you stretched first, then moved by the unfactorised ${mm(fracHTML(b.abs()))}. After stretching, use the shift from the factorised form. `;
          else if (vx.eq(F(u).sub(p).mul(a.inv()))) hint += 'You translated by the factorised shift, then stretched, so the stretch shrank that shift too. ';
          hint += `Try solving ${mm(`${linHTML(a, b)} = ${num(u)}`)} for <i>x</i>.`;
        }
        return hint;
      },
      cShow: (u, v, a, b, X) => `Solve ${mm(`${linHTML(a, b)} = ${num(u)}`)}, giving ${mm(`<i>x</i> = ${fracHTML(X)}`)}. The image is ${mm(`(${fracHTML(X)}, ${num(v)})`)}.`,
      mistakeTail: (a, b) => `✗ That's not ${Y(fx(linHTML(a, b)))}. After the stretch, the shift must come from the factorised form: ${HORIZ.shift(b.div(a).neg())}, not ${HORIZ.shift(b.neg())}.`
    }
  };

  /* =========================================================
     Topic: y = af(x) + b   (outside the function)
     ========================================================= */
  const outRHS = (m, c) => coefHTML(m, FX) + plusHTML(c);
  const outBracket = (a, c) => `${prefixHTML(a)}(${FX}${plusHTML(c)})`;
  const outFactor = (a, b) => (b.isZero() ? outRHS(a, 0) : outBracket(a, b.div(a)));

  const OUTSIDE = {
    ...VERT,
    id: 'outside',
    name: `y = <i>a</i>${FX} + <i>b</i>`,
    lede: `In ${Y(outRHS(2, 3))}, do you stretch first or move up 3 first? Start with the short walkthrough, then explore, match graphs and test yourself.`,
    formHTML: `<i>a</i>${FX} + <i>b</i>`,
    map: (m, c) => ({ s: 1, t: 0, S: val(m), T: val(c) }),
    coord: (m, c, u, y) => [F(u), m.mul(y).add(c)],
    target: (a, b) => ({ m: a, c: b }),
    rhs: (m, c) => outRHS(m, c),
    expr: (a, b) => outRHS(a, b),
    factored: (a, b) => outFactor(a, b),
    routes: [
      { id: 'natural', label: 'Stretch, then translate', short: 'Stretch, then translate' },
      { id: 'factor', label: 'Factorise: translate, then stretch', short: 'Factorise: translate, then stretch' },
      { id: 'mistake', label: 'Common mistake', short: 'Common mistake', warn: true }
    ],
    stages(route, a, b) {
      const p = b.div(a), zero = F(0), one = F(1);
      const st = [{ m: one, c: zero, eq: FX, kind: 'start' }];
      if (route === 'natural') {
        st.push({ m: a, c: zero, eq: outRHS(a, 0), kind: 'stretch', k: a });
        st.push({ m: a, c: b, eq: outRHS(a, b), kind: 'translate', d: b });
      } else if (route === 'factor') {
        st.push({ m: one, c: p, eq: outRHS(1, p), kind: 'translate', d: p });
        st.push({ m: a, c: b, eq: outFactor(a, b), kind: 'stretch', k: a });
      } else {
        st.push({ m: one, c: b, eq: outRHS(1, b), kind: 'translate', d: b });
        st.push({ m: a, c: b.mul(a), eq: outBracket(a, b), kind: 'stretch', k: a });
      }
      return st.filter((x, i) => i === 0 || !(x.kind === 'translate' && x.d.isZero()));
    },
    stepText(route, st, a, b) {
      const p = b.div(a);
      let body = st.kind === 'stretch' ? VERT.stretchHint(st.k) : VERT.translateHint(st.d);
      let tone = '';
      const bt = mm(`${b.isNeg() ? '−' : '+'} ${fracHTML(b.abs())}`);
      if (b.isZero()) { body += ` Result: ${Y(st.eq)}. ✓`; tone = 'good'; }
      else if (route === 'natural') {
        if (st.kind === 'stretch') body += ` Nothing has been translated yet, so only the shape changes. Result: ${Y(st.eq)}.`;
        else { body += ` The stretch is already done, so nothing changes this move afterwards. It's just the ${bt} from ${Y(outRHS(a, b))}. Result: ${Y(st.eq)}. ✓`; tone = 'good'; }
      } else if (route === 'factor') {
        if (st.kind === 'translate') body += ` The stretch hasn't happened yet, so we use the move from the factorised form ${Y(outFactor(a, b))}. Result: ${Y(st.eq)}.`;
        else { body += ` The stretch also acts on the move from step 1: ${VERT.shift(p)} becomes ${VERT.shift(b)}. Result: ${mm(`y = ${st.eq} = ${outRHS(a, b)}`)}. ✓`; tone = 'good'; }
      } else if (st.kind === 'translate') {
        body += ` It's tempting to do the ${bt} first. That's fine so far. Result: ${Y(st.eq)}.`;
      } else {
        body += ` <b>But</b> the stretch also acts on the move already done: ${VERT.shift(b)} becomes ${VERT.shift(b.mul(a))}. This gives ${mm(`y = ${st.eq} = ${outRHS(a, b.mul(a))}`)}, which is <b>not</b> ${Y(outRHS(a, b))}. ✗`
          + `<br><br>Outside the function, follow the order of operations: stretch first, then move ${VERT.shift(b)}. Or, to move first, use the factorised form ${Y(outFactor(a, b))}: ${VERT.shift(p)}. Compare with the dashed target.`;
        tone = 'bad';
      }
      return { tone, body };
    },
    factorLabel: 'Factorised form (for translating first)',
    factorNote: (a, b) => `Take out the factor of ${mm(fracHTML(a))}: ${mm(divHTML(b, a))}. This is the move you need if you translate first.`,
    ideaIntro: 'Outside the function, the graph follows the <b>same order</b> as the arithmetic, and changes work the way you\'d expect.',
    idea(a, b) {
      const p = b.div(a);
      return `<li>In ${mm(outRHS(a, b))}, ${mm(FX)} is <b>multiplied</b> by ${fracHTML(a)} and <b>then</b> ${fracHTML(b.abs())} is ${b.isNeg() ? 'subtracted' : 'added'}. The graph does the same, in the same order: <b>stretch first</b>, then move ${VERT.shift(b)}.</li>
        <li>In ${mm(outFactor(a, b))}, ${fracHTML(p.abs())} is ${p.isNeg() ? 'subtracted' : 'added'} <b>first</b>, then the result is multiplied by ${fracHTML(a)}. So the graph <b>moves first</b> (${VERT.shift(p)}), then stretches.</li>`;
    },
    tableNote: 'Only the <i>y</i>-coordinates change. The <i>x</i>-coordinates stay the same throughout.',
    pools: {
      starter: { a: [[2], [3], [1, 2]], b: [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5] },
      challenge: { a: [[2], [3], [1, 2], [3, 2], [-1], [-2], [-1, 2]], b: [-4, -3, -2, -1, 1, 2, 3, 4] }
    },
    viewOK: v => v.y1 - v.y0 <= 26,
    match: {
      trLabel: 'Translate vertically', neg: 'down', pos: 'up',
      sfLabel: 'Stretch parallel to the <i>y</i>-axis', refl: 'and reflect in the <i>x</i>-axis',
      success(firstT, both, a, b) {
        if (both) return `You've done it both ways. Stretch first follows the order of operations in ${Y(outRHS(a, b))}, so the move is ${VERT.shift(b)}. Translate first uses the factorised form ${Y(outFactor(a, b))}, so the move is ${VERT.shift(b.div(a))}, and the stretch then scales it. Try a new target!`;
        return firstT
          ? `You translated first using the factorised form ${Y(outFactor(a, b))}, so the stretch scaled your move up to ${VERT.shift(b)}. <b>Now try the other order:</b> press ⇅ Swap order so the stretch comes first. What does the translation need to be now?`
          : `You stretched first, following the order of operations in ${Y(outRHS(a, b))}, so the move is just ${VERT.shift(b)}. <b>Now try the other order:</b> press ⇅ Swap order so the translation comes first. What does it need to be now?`;
      },
      shiftHint: (firstT, a, b) => firstT
        ? `The stretch is right, but because you translated <b>first</b>, the stretch also stretched your translation. With this order, use the factorised form ${Y(outFactor(a, b))}: ${VERT.shift(b.div(a))}.`
        : `The stretch is right. Because you stretched <b>first</b>, nothing changes the translation afterwards, so use the ${mm(fracHTML(b.abs()))} from ${Y(outRHS(a, b))} as it is: ${VERT.shift(b)}.`,
      sfInvHint: a => `Check the scale factor. In ${Y(coefHTML(a, FX) + ' …')} the <i>y</i>-coordinates are multiplied by ${mm(fracHTML(a.abs()))}, not ${mm(fracHTML(a.inv().abs()))}.`,
      sfHint: a => `The coefficient of ${mm(FX)} should be ${mm(fracHTML(a))}, so the stretch needs scale factor ${mm(fracHTML(a.abs()))}${a.isNeg() ? ' with a reflection' : ''}.`
    },
    quiz: {
      aPrompt: 'Factorise out the number in front of <i>f</i>(<i>x</i>). This is the form you would use to translate first.',
      aLine: (a, b, input) => `${outRHS(a, b)} = ${prefixHTML(a)}(${FX} + ${input})`,
      aCorrect: (a, b) => `✓ Correct: ${mm(divHTML(b, a))}, so ${Y(outFactor(a, b))}.`,
      pool(a, b) {
        const p = b.div(a);
        return {
          main: [
            [{ type: 'stretch', k: a }, { type: 'translate', d: b }],
            [{ type: 'translate', d: p }, { type: 'stretch', k: a }],
            [{ type: 'translate', d: b }, { type: 'stretch', k: a }]
          ],
          extra: [
            [{ type: 'stretch', k: a }, { type: 'translate', d: p }],
            [{ type: 'stretch', k: a.inv() }, { type: 'translate', d: b }],
            [{ type: 'translate', d: b }, { type: 'stretch', k: a.inv() }]
          ]
        };
      },
      bCorrect: (a, b) => `✓ Correct. Both orders work, <b>as long as</b> the translation matches: stretch first uses the move straight from ${mm(outRHS(a, b))}, ${VERT.shift(b)}; translate first uses the factorised move ${VERT.shift(b.div(a))}.`,
      bShow: (a, b) => `A stretch applied <b>after</b> a translation stretches that translation too. Stretch first: move ${VERT.shift(b)}. Translate first: move ${VERT.shift(b.div(a))}.`,
      image: (u, v, a, b) => [F(u), a.mul(v).add(b)],
      cCorrect: (u, v, a, b, X, Yv) => `✓ Correct: ${mm(`(${num(u)}, ${fracHTML(Yv)})`)}. Check: ${mm(`y = ${fracHTML(a)} × ${signed(v)}${plusHTML(b)} = ${fracHTML(Yv)}`)}, and the <i>x</i>-coordinate doesn't change.`,
      cHint(vx, vy, u, v, a, b, okX, okY) {
        let hint = '';
        if (!okX) hint += 'A vertical transformation never changes the <i>x</i>-coordinate. ';
        if (!okY) {
          if (vy.eq(F(v).add(b))) hint += "You translated but didn't stretch. ";
          else if (vy.eq(a.mul(v))) hint += "You stretched but didn't translate. ";
          else if (vy.eq(a.mul(F(v).add(b)))) hint += "That's the common mistake: you added first, then stretched, so the stretch changed the translation too. ";
          hint += `Work it out like the equation: ${mm(`y = ${fracHTML(a)} × <i>f</i>(${num(u)})${plusHTML(b)}`)}, where ${mm(`<i>f</i>(${num(u)}) = ${num(v)}`)}.`;
        }
        return hint;
      },
      cShow: (u, v, a, b, X, Yv) => `${mm(`y = ${fracHTML(a)} × ${signed(v)}${plusHTML(b)} = ${fracHTML(Yv)}`)}, and the <i>x</i>-coordinate stays the same. The image is ${mm(`(${num(u)}, ${fracHTML(Yv)})`)}.`,
      mistakeTail: (a, b) => `✗ That's not ${Y(outRHS(a, b))}. The stretch also stretched the move: ${VERT.shift(b)} became ${VERT.shift(b.mul(a))}. Stretch first, or move by the factorised ${VERT.shift(b.div(a))}.`
    }
  };

  const MODES = { outside: OUTSIDE, inside: INSIDE };
  let M = OUTSIDE;

  const allMaps = (a, b) => M.routes.flatMap(r => M.stages(r.id, a, b)).map(st => M.map(st.m, st.c));
  const opPhrase = o => (o.type === 'translate' ? M.translatePhrase(o.d) : M.stretchPhrase(o.k));
  function pickAB(level, fn, avoid) {
    for (let i = 0; i < 300; i++) {
      const a = F(...pick(M.pools[level].a)), b = F(pick(M.pools[level].b));
      if (avoid && avoid.a && a.eq(avoid.a) && b.eq(avoid.b)) continue;
      if (M.viewOK(viewFor(fn, allMaps(a, b)))) return { a, b };
    }
    return { a: F(2), b: F(3) };
  }

  /* =========================================================
     Tabs
     ========================================================= */
  function selectTab(name) {
    $$('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
    $$('.panel').forEach(p => { p.hidden = p.id !== 'tab-' + name; });
  }
  $$('.tab').forEach(tab => tab.addEventListener('click', () => selectTab(tab.dataset.tab)));

  /* =========================================================
     0. GUIDED WALKTHROUGH
     ========================================================= */
  const ln = { step: 0, cur: { ...ID }, cancel: null, token: 0, wrong: false, target: false, unlocked: false, steps: [] };
  const lnGraph = new Graph($('#ln-graph'));
  const HALF = fracHTML(F(1, 2)), THIRD = fracHTML(F(1, 3)), THREE2 = fracHTML(F(3, 2));
  const ST = (m, c, eq, capt) => ({ m, c, eq, cap: capt });

  function lnRender() {
    const fn = FUNCS.zigzag;
    const layers = [{ ...ID, cls: 'c-orig' }];
    if (ln.target) layers.push({ ...M.map(M.learn.target.m, M.learn.target.c), cls: 'c-target' });
    const moved = !isID(ln.cur);
    if (moved) layers.push({ ...ln.cur, cls: ln.wrong ? 'c-wrong' : 'c-cur' });
    lnGraph.render({
      fn, layers,
      points: [moved ? { ...ln.cur, cls: ln.wrong ? 'p-wrong' : 'p-cur' } : { ...ID, cls: 'p-orig' }]
    });
    $('#ln-legend-target').hidden = !ln.target;
  }
  function lnNow(eq, capt) {
    $('#ln-now').innerHTML = `y = ${eq}` + (capt ? `<span class="cap">${capt}</span>` : '');
  }
  function lnReset() {
    if (ln.cancel) ln.cancel();
    ln.cancel = null; ln.token++; ln.wrong = false;
    ln.cur = { ...ID };
    lnNow(FX); lnRender();
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
        ln.cancel = tween(ln.cur, M.map(st.m, st.c), DUR * 1.2,
          mp => { ln.cur = mp; lnRender(); },
          () => { ln.cancel = null; setTimeout(next, i < states.length - 1 ? 900 : 0); });
      };
      setTimeout(next, 350);
    });
  }
  function lnAfter(html) { $('#ln-after').insertAdjacentHTML('beforeend', html); }
  function lnUnlock() { ln.unlocked = true; $('#ln-next').disabled = false; }

  // A two-button quick check: the right answer plays `onRight` and unlocks Next.
  function lnQuickCheck(question, options, rightKey, fbId, rightMsg, wrongMsg, onRight) {
    lnAfter(`<div class="ln-ask"><p>${question}</p>
      <div class="row">${options.map(([k, label]) => `<button class="btn" data-ans="${k}">${label}</button>`).join('')}</div>
      <div class="fb" id="${fbId}"></div></div>`);
    $$('#ln-after [data-ans]').forEach(b => b.addEventListener('click', () => {
      const ok = b.dataset.ans === rightKey;
      b.classList.add(ok ? 'chosen-good' : 'chosen-bad');
      const f = $('#' + fbId);
      if (ok) {
        f.className = 'fb good'; f.innerHTML = rightMsg;
        $$('#ln-after [data-ans]').forEach(x => { x.disabled = true; });
        onRight();
        lnUnlock();
      } else {
        f.className = 'fb bad'; f.innerHTML = wrongMsg;
      }
    }));
  }

  // "Try both orders" step. `orders` = [{ btn, states, wrong, eqEnd, capEnd, fb }]
  function lnBothOrders(orders, why) {
    const tried = new Set();
    let busy = false;
    orders.forEach((o, idx) => {
      $('#' + o.btn).addEventListener('click', async e => {
        if (busy) return;
        busy = true;
        const btn = e.currentTarget;
        const old = $('#ln-fo'); if (old) old.remove();
        await lnPlay(o.states);
        if (o.wrong) { ln.wrong = true; lnRender(); lnNow(o.eqEnd, o.capEnd); }
        btn.classList.add(o.wrong ? 'chosen-bad' : 'chosen-good');
        lnAfter(`<div class="fb ${o.wrong ? 'bad' : 'good'}" id="ln-fo">${o.fb}</div>`);
        tried.add(idx);
        busy = false;
        if (tried.size === orders.length && !$('#ln-why')) {
          lnAfter(`<div class="fb info" id="ln-why">${why}</div>`);
          lnUnlock();
        }
      });
    });
  }

  // Fill-the-gap factorising step, then a play button that hits the target.
  function lnFactorStep(playLabel, states, hitMsg) {
    let tries = 0;
    const check = () => {
      const v = parseFrac($('#ln-p').value), f = $('#ln-pf');
      if (!v) { f.className = 'fb info'; f.innerHTML = `Type a number, e.g. ${mm('3/2')} or ${mm('1.5')}.`; return; }
      tries++;
      if (v.eq(F(3, 2))) {
        $('#ln-p').className = 'ok'; $('#ln-p').disabled = true; $('#ln-pc').disabled = true;
        f.className = 'fb good';
        f.innerHTML = M.learn.factorRight;
        lnAfter(`<div class="ln-ask"><p>${M.learn.factorNext}</p>
          <div class="row"><button class="btn primary" id="ln-a4">${playLabel}</button></div></div>`);
        $('#ln-a4').addEventListener('click', async e => {
          e.currentTarget.disabled = true;
          await lnPlay(states);
          lnAfter(`<div class="fb good">${hitMsg}</div>`);
          lnUnlock();
        });
      } else {
        $('#ln-p').className = 'no';
        f.className = 'fb bad';
        f.innerHTML = tries === 1 ? M.learn.factorWrong : `Divide the 3 by 2: the answer is ${mm(THREE2)}.`;
      }
    };
    $('#ln-pc').addEventListener('click', check);
    $('#ln-p').addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
  }

  function lnSummaryButtons(otherMode) {
    $('#ln-go').addEventListener('click', () => { selectTab('explore'); window.scrollTo(0, 0); });
    $('#ln-other').addEventListener('click', () => { location.hash = otherMode; window.scrollTo(0, 0); });
    $('#ln-again').addEventListener('click', () => lnShow(0));
  }
  const summaryActions = other => `<div class="ln-actions"><button class="btn primary" id="ln-go">Start exploring ▶</button><button class="btn" id="ln-other">${other}</button><button class="btn ghost" id="ln-again">↺ Replay walkthrough</button></div>`;

  /* ----- Walkthrough: y = f(ax + b) ----- */
  INSIDE.learn = {
    view: { x0: -8, x1: 8, y0: -4, y1: 5 },
    target: { m: 0.5, c: -1.5 },
    targetEq: `y = ${fx(linHTML(2, 3))}`,
    factorRight: `✓ Yes: ${mm(`2(<i>x</i> + ${THREE2}) = 2<i>x</i> + 3`)}. So ${Y(fx(linHTML(2, 3)))} is the same as ${Y(fx(`2(${linHTML(1, F(3, 2))})`))}.`,
    factorNext: `Inside the bracket now, the move is <b>${THREE2} left</b>. Let's squash first, then move ${THREE2} left.`,
    factorWrong: `Not quite. Expand your bracket: ${mm('2 × (your answer)')} needs to equal 3.`,
    steps: () => [
      {
        target: false,
        html: `<h2>Sketching graphs like ${Y(fx(linHTML(2, 3)))}</h2>
          <p>In this short walkthrough you'll see what the <b>2</b> and the <b>+ 3</b> each do to a graph, and why the <b>order</b> you do them in matters.</p>
          <p>Here's the graph of ${Y(FX)} we'll use. Keep an eye on the labelled points <b>A</b>, <b>B</b>, <b>C</b> and <b>D</b>.</p>`,
        enter() { lnUnlock(); }
      },
      {
        target: false,
        html: `<h2>Adding inside the bracket moves the graph sideways</h2>
          <p>What do you think ${Y(fx(linHTML(1, 3)))} looks like? Press the button to find out.</p>
          <div class="ln-actions"><button class="btn primary" id="ln-a1">Show ${mm(`y = ${fx(linHTML(1, 3))}`)}</button></div>`,
        enter() {
          $('#ln-a1').addEventListener('click', async e => {
            e.currentTarget.disabled = true;
            await lnPlay([ST(1, 0, FX), ST(1, -3, fx(linHTML(1, 3)), 'Every point moves 3 to the left')]);
            lnAfter(`<div class="fb info">It moved <b>3 to the left</b>, not to the right! Point <b>D</b> went from ${mm('(3, 2)')} to ${mm('(0, 2)')}.<br>Inside the bracket, changes work the <b>opposite way</b> to what you might expect: <b>+ 3</b> means <b>left 3</b>.</div>`);
            lnQuickCheck(`Quick check: which way does ${Y(fx(linHTML(1, -2)))} move?`, [['left', 'Left 2'], ['right', 'Right 2']], 'right', 'ln-f1',
              '✓ Right. <b>− 2</b> inside the bracket means <b>right 2</b>.',
              'Not quite. Remember, inside the bracket it works the opposite way. Try again.',
              () => lnPlay([ST(1, 0, FX), ST(1, 2, fx(linHTML(1, -2)), 'Every point moves 2 to the right')]));
          });
        }
      },
      {
        target: false,
        html: `<h2>Multiplying <i>x</i> inside the bracket squashes the graph</h2>
          <p>Now try ${Y(fx(linHTML(2, 0)))}. The <b>2</b> multiplies <i>x</i> before <i>f</i> is applied.</p>
          <div class="ln-actions"><button class="btn primary" id="ln-a2">Show ${mm(`y = ${fx(linHTML(2, 0))}`)}</button></div>`,
        enter() {
          $('#ln-a2').addEventListener('click', async e => {
            e.currentTarget.disabled = true;
            await lnPlay([ST(1, 0, FX), ST(0.5, 0, fx(linHTML(2, 0)), `Every <i>x</i>-coordinate is multiplied by ${HALF}`)]);
            lnAfter(`<div class="fb info">The graph got <b>squashed</b> towards the <i>y</i>-axis. Point <b>D</b> went from ${mm('(3, 2)')} to ${mm(`(${THREE2}, 2)`)}: its <i>x</i>-coordinate <b>halved</b>, and its <i>y</i>-coordinate stayed the same.<br>Again it's the opposite of what you might expect: <b>× 2</b> inside gives a <b>stretch parallel to the <i>x</i>-axis, scale factor ${HALF}</b>.</div>`);
            lnQuickCheck(`Quick check: ${Y(fx(linHTML(3, 0)))} is a stretch parallel to the <i>x</i>-axis with scale factor…`, [['3', mm('3')], ['third', mm(THIRD)]], 'third', 'ln-f2',
              `✓ Right. Every <i>x</i>-coordinate is divided by 3, so the scale factor is ${mm(THIRD)}.`,
              'Not quite. Would multiplying <i>x</i> by 3 inside make the graph wider or narrower? Try again.',
              () => lnPlay([ST(1, 0, FX), ST(1 / 3, 0, fx(linHTML(3, 0)), `Every <i>x</i>-coordinate is multiplied by ${THIRD}`)]));
          });
        }
      },
      {
        target: true,
        html: `<h2>Now both at once: ${Y(fx(linHTML(2, 3)))}</h2>
          <p>This has a <b>squash</b> (from the 2) and a <b>move left 3</b> (from the + 3). But which do you do first?</p>
          <p>Try both orders. Which one lands exactly on the <b style="color:var(--target)">dashed target</b>?</p>
          <div class="ln-actions">
            <button class="btn" id="ln-oA">Squash first, then left 3</button>
            <button class="btn" id="ln-oB">Left 3 first, then squash</button>
          </div>`,
        enter() {
          lnBothOrders([
            {
              btn: 'ln-oA', wrong: true,
              states: [ST(1, 0, FX), ST(0.5, 0, fx(linHTML(2, 0)), `Squash: <i>x</i>-coordinates × ${HALF}`), ST(0.5, -3, fx(`2(${linHTML(1, 3)})`), 'Move 3 left')],
              eqEnd: fx(`2(${linHTML(1, 3)})`), capEnd: `= ${fx(linHTML(2, 6))}, not ${fx(linHTML(2, 3))}`,
              fb: `✗ <b>Missed!</b> The graph has gone too far left. After the squash, moving left 3 gives ${mm(`y = ${fx(`2(${linHTML(1, 3)})`)} = ${fx(linHTML(2, 6))}`)}. This is the <b>most common mistake</b>.`
            },
            {
              btn: 'ln-oB', wrong: false,
              states: [ST(1, 0, FX), ST(1, -3, fx(linHTML(1, 3)), 'Move 3 left'), ST(0.5, -1.5, fx(linHTML(2, 3)), `Squash: <i>x</i>-coordinates × ${HALF}. Watch the move get halved too`)],
              fb: `✓ <b>Hit!</b> Watch the second step again: the squash pulled the graph back towards the <i>y</i>-axis, so the move of 3 left became ${THREE2} left.`
            }
          ], `<b>Why does the order matter?</b><br>
            A squash acts on the <b>whole graph</b>, so it also squashes any move you've <b>already</b> made.<br>
            • <b>Left 3, then squash:</b> the squash halves the move, so 3 left becomes ${THREE2} left. ✓<br>
            • <b>Squash, then left 3:</b> nothing halves the move afterwards, so the graph goes a full 3 left, which is too far. ✗`);
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
          lnFactorStep(`Play: squash, then left ${THREE2}`,
            [ST(1, 0, FX), ST(0.5, 0, fx(linHTML(2, 0)), `Squash: <i>x</i>-coordinates × ${HALF}`), ST(0.5, -1.5, fx(`2(${linHTML(1, F(3, 2))})`), `Move ${THREE2} left`)],
            `✓ <b>Hit!</b> Squashing first works, as long as you move by the <b>factorised</b> amount, ${THREE2}, and not by 3.`);
        }
      },
      {
        target: true,
        html: `<h2>Summary</h2>
          <p>There are two correct ways to get ${Y(fx(linHTML(2, 3)))} from ${Y(FX)}:</p>
          <div class="ln-summary">
            <div><b>✓ Translate first:</b> move left 3, then squash with scale factor ${HALF}. The squash halves the move for you.</div>
            <div><b>✓ Factorise first:</b> write ${Y(fx(`2(${linHTML(1, F(3, 2))})`))}, then squash with scale factor ${HALF}, then move left ${THREE2}.</div>
            <div class="no"><b>✗ Common mistake:</b> squash, then move left 3. Once you've squashed, the move must come from the factorised bracket.</div>
          </div>
          <div class="compare"><b>Compare with ${Y(outRHS(2, 3))}:</b> outside the function, changes work the way you'd expect (+ 3 means up 3) and in the normal order. Inside the bracket, they work the opposite way and the order flips.</div>
          <p>Now try it with other numbers and other graphs.</p>
          ${summaryActions(`Try ${mm(`y = <i>a</i>${FX} + <i>b</i>`)}`)}`,
        enter() {
          lnUnlock();
          lnPlay([ST(1, 0, FX), ST(0.5, 0, fx(linHTML(2, 0)), `Squash: <i>x</i>-coordinates × ${HALF}`), ST(0.5, -1.5, fx(`2(${linHTML(1, F(3, 2))})`), `Move ${THREE2} left`)]);
          lnSummaryButtons('outside');
        }
      }
    ]
  };

  /* ----- Walkthrough: y = af(x) + b ----- */
  const TWO_FX = coefHTML(2, FX);
  OUTSIDE.learn = {
    view: { x0: -6, x1: 6, y0: -5, y1: 13 },
    target: { m: 2, c: 3 },
    targetEq: `y = ${outRHS(2, 3)}`,
    factorRight: `✓ Yes: ${mm(`2(${FX} + ${THREE2}) = ${outRHS(2, 3)}`)}. So ${Y(outRHS(2, 3))} is the same as ${Y(outBracket(F(2), F(3, 2)))}.`,
    factorNext: `Inside the bracket now, the move is <b>${THREE2} up</b>. Let's move up ${THREE2} first, then stretch.`,
    factorWrong: `Not quite. Expand your bracket: ${mm('2 × (your answer)')} needs to equal 3.`,
    steps: () => [
      {
        target: false,
        html: `<h2>Sketching graphs like ${Y(outRHS(2, 3))}</h2>
          <p>In this short walkthrough you'll see what the <b>2</b> and the <b>+ 3</b> each do to a graph, and why the <b>order</b> you do them in matters.</p>
          <p>Here's the graph of ${Y(FX)} we'll use. Keep an eye on the labelled points <b>A</b>, <b>B</b>, <b>C</b> and <b>D</b>.</p>`,
        enter() { lnUnlock(); }
      },
      {
        target: false,
        html: `<h2>Adding outside the function moves the graph up or down</h2>
          <p>What do you think ${Y(outRHS(1, 3))} looks like? Press the button to find out.</p>
          <div class="ln-actions"><button class="btn primary" id="ln-a1">Show ${mm(`y = ${outRHS(1, 3)}`)}</button></div>`,
        enter() {
          $('#ln-a1').addEventListener('click', async e => {
            e.currentTarget.disabled = true;
            await lnPlay([ST(1, 0, FX), ST(1, 3, outRHS(1, 3), 'Every point moves up 3')]);
            lnAfter(`<div class="fb info">It moved <b>up 3</b>. Point <b>D</b> went from ${mm('(3, 2)')} to ${mm('(3, 5)')}.<br>Outside the function, changes work the way you'd expect: <b>+ 3</b> means <b>up 3</b>.</div>`);
            lnQuickCheck(`Quick check: which way does ${Y(outRHS(1, -2))} move?`, [['up', 'Up 2'], ['down', 'Down 2']], 'down', 'ln-f1',
              '✓ Right. <b>− 2</b> outside the function means <b>down 2</b>.',
              'Not quite. Outside the function, a minus moves the graph the way you would expect. Try again.',
              () => lnPlay([ST(1, 0, FX), ST(1, -2, outRHS(1, -2), 'Every point moves down 2')]));
          });
        }
      },
      {
        target: false,
        html: `<h2>Multiplying outside the function stretches the graph vertically</h2>
          <p>Now try ${Y(TWO_FX)}. The <b>2</b> doubles every output of <i>f</i>.</p>
          <div class="ln-actions"><button class="btn primary" id="ln-a2">Show ${mm(`y = ${TWO_FX}`)}</button></div>`,
        enter() {
          $('#ln-a2').addEventListener('click', async e => {
            e.currentTarget.disabled = true;
            await lnPlay([ST(1, 0, FX), ST(2, 0, TWO_FX, 'Every <i>y</i>-coordinate is multiplied by 2')]);
            lnAfter(`<div class="fb info">The graph got <b>stretched</b> away from the <i>x</i>-axis. Point <b>D</b> went from ${mm('(3, 2)')} to ${mm('(3, 4)')} and <b>C</b> from ${mm('(1, −2)')} to ${mm('(1, −4)')}. Point <b>A</b> is on the <i>x</i>-axis, so it didn't move.<br>This is a <b>stretch parallel to the <i>y</i>-axis, scale factor 2</b>, just what you'd expect.</div>`);
            lnQuickCheck(`Quick check: ${Y(coefHTML(F(1, 2), FX))} is a stretch parallel to the <i>y</i>-axis with scale factor…`, [['2', mm('2')], ['half', mm(HALF)]], 'half', 'ln-f2',
              `✓ Right. Every <i>y</i>-coordinate is halved, so the scale factor is ${mm(HALF)}.`,
              'Not quite. Outside the function the number works the way you would expect. Try again.',
              () => lnPlay([ST(1, 0, FX), ST(0.5, 0, coefHTML(F(1, 2), FX), `Every <i>y</i>-coordinate is multiplied by ${HALF}`)]));
          });
        }
      },
      {
        target: true,
        html: `<h2>Now both at once: ${Y(outRHS(2, 3))}</h2>
          <p>This has a <b>stretch</b> (from the 2) and a <b>move up 3</b> (from the + 3). But which do you do first?</p>
          <p>Try both orders. Which one lands exactly on the <b style="color:var(--target)">dashed target</b>?</p>
          <div class="ln-actions">
            <button class="btn" id="ln-oA">Up 3 first, then stretch</button>
            <button class="btn" id="ln-oB">Stretch first, then up 3</button>
          </div>`,
        enter() {
          lnBothOrders([
            {
              btn: 'ln-oA', wrong: true,
              states: [ST(1, 0, FX), ST(1, 3, outRHS(1, 3), 'Move up 3'), ST(2, 6, outBracket(F(2), F(3)), 'Stretch: <i>y</i>-coordinates × 2. Watch the move get doubled too')],
              eqEnd: outBracket(F(2), F(3)), capEnd: `= ${outRHS(2, 6)}, not ${outRHS(2, 3)}`,
              fb: `✗ <b>Missed!</b> The graph has gone too high. The stretch doubled everything, including the move of 3, so this gives ${mm(`y = ${outBracket(F(2), F(3))} = ${outRHS(2, 6)}`)}. This is the <b>most common mistake</b>.`
            },
            {
              btn: 'ln-oB', wrong: false,
              states: [ST(1, 0, FX), ST(2, 0, TWO_FX, 'Stretch: <i>y</i>-coordinates × 2'), ST(2, 3, outRHS(2, 3), 'Move up 3')],
              fb: '✓ <b>Hit!</b> The move came after the stretch, so nothing changed it: it stays as 3.'
            }
          ], `<b>Why does the order matter?</b><br>
            A stretch acts on the <b>whole graph</b>, so it also stretches any move you've <b>already</b> made.<br>
            • <b>Stretch, then up 3:</b> nothing changes the move afterwards. ✓<br>
            • <b>Up 3, then stretch:</b> the stretch doubles the move to 6, which is too high. ✗<br>
            Outside the function, just follow the order of operations in ${mm(outRHS(2, 3))}: multiply by 2 first, then add 3.`);
        }
      },
      {
        target: true,
        html: `<h2>Want to move first? Factorise!</h2>
          <p>Moving first <b>can</b> work, but only if you take the 2 out as a factor first. That shows you the move you actually need.</p>
          <div class="ln-ask"><p>Fill in the gap:</p>
            <div class="qq m">${outRHS(2, 3)} = 2(${FX} + <input type="text" id="ln-p" aria-label="Missing value">)</div>
            <div class="row"><button class="btn primary" id="ln-pc">Check</button></div>
            <div class="fb" id="ln-pf"></div>
          </div>`,
        enter() {
          lnFactorStep(`Play: up ${THREE2}, then stretch`,
            [ST(1, 0, FX), ST(1, 1.5, outRHS(1, F(3, 2)), `Move up ${THREE2}`), ST(2, 3, outBracket(F(2), F(3, 2)), 'Stretch: <i>y</i>-coordinates × 2. The move doubles to 3')],
            `✓ <b>Hit!</b> Moving first works, as long as you move by the <b>factorised</b> amount, ${THREE2}. The stretch then doubles it to 3.`);
        }
      },
      {
        target: true,
        html: `<h2>Summary</h2>
          <p>There are two correct ways to get ${Y(outRHS(2, 3))} from ${Y(FX)}:</p>
          <div class="ln-summary">
            <div><b>✓ Stretch first:</b> stretch with scale factor 2, then move up 3. This follows the order of operations.</div>
            <div><b>✓ Factorise first:</b> write ${Y(outBracket(F(2), F(3, 2)))}, then move up ${THREE2}, then stretch with scale factor 2.</div>
            <div class="no"><b>✗ Common mistake:</b> move up 3, then stretch. The stretch doubles the move too.</div>
          </div>
          <div class="compare"><b>Coming up next:</b> inside the bracket, like ${Y(fx(linHTML(2, 3)))}, things work differently. There, + 3 moves the graph <b>left</b>, and the order flips.</div>
          <p>Now try it with other numbers and other graphs.</p>
          ${summaryActions(`Next: ${mm(`y = ${fx('<i>a</i><i>x</i> + <i>b</i>')}`)}`)}`,
        enter() {
          lnUnlock();
          lnPlay([ST(1, 0, FX), ST(2, 0, TWO_FX, 'Stretch: <i>y</i>-coordinates × 2'), ST(2, 3, outRHS(2, 3), 'Move up 3')]);
          lnSummaryButtons('inside');
        }
      }
    ]
  };

  function lnShow(i) {
    ln.step = Math.max(0, Math.min(ln.steps.length - 1, i));
    const step = ln.steps[ln.step];
    ln.target = step.target;
    ln.unlocked = false;
    $('#ln-body').innerHTML = step.html;
    $('#ln-after').innerHTML = '';
    $('#ln-count').textContent = `Step ${ln.step + 1} of ${ln.steps.length}`;
    $('#ln-dots').innerHTML = ln.steps.map((_, k) => `<span class="${k <= ln.step ? 'on' : ''}"></span>`).join('');
    $('#ln-back').disabled = ln.step === 0;
    $('#ln-next').hidden = ln.step === ln.steps.length - 1;
    $('#ln-next').disabled = true;
    lnReset();
    step.enter();
  }
  $('#ln-next').addEventListener('click', () => { if (ln.unlocked) { lnShow(ln.step + 1); $('#tab-learn').scrollIntoView({ block: 'start' }); } });
  $('#ln-back').addEventListener('click', () => lnShow(ln.step - 1));

  function lnInit() {
    ln.steps = M.learn.steps();
    lnGraph.view = M.learn.view;
    $('#ln-target-eq').innerHTML = M.learn.targetEq;
    lnShow(0);
  }

  /* =========================================================
     1. EXPLORE
     ========================================================= */
  const ex = { func: 'zigzag', a: F(2), b: F(3), route: '', stage: 0, stages: [], cur: { ...ID }, cancel: null, token: 0, animating: false };
  const exGraph = new Graph($('#ex-graph'));

  function exStop() { if (ex.cancel) ex.cancel(); ex.cancel = null; ex.animating = false; ex.token++; }

  function exSetup() {
    exStop();
    ex.stages = M.stages(ex.route, ex.a, ex.b);
    exGraph.view = viewFor(FUNCS[ex.func], allMaps(ex.a, ex.b));
    ex.stage = 0; ex.cur = { ...ID };
    exExpr(); exSteps(); exRender();
  }

  const exIsWrong = () => ex.route === 'mistake' && !ex.b.isZero() && ex.stage === ex.stages.length - 1 && !ex.animating;

  function exRender() {
    const fn = FUNCS[ex.func];
    const tg = M.target(ex.a, ex.b);
    const wrong = exIsWrong();
    const layers = [{ ...ID, cls: 'c-orig' }];
    if ($('#ex-target').checked) layers.push({ ...M.map(tg.m, tg.c), cls: 'c-target' });
    layers.push({ ...ex.cur, cls: wrong ? 'c-wrong' : 'c-cur' });
    exGraph.render({
      fn, layers,
      points: [{ ...ID, cls: 'p-orig', label: false }, { ...ex.cur, cls: wrong ? 'p-wrong' : 'p-cur' }]
    });
  }

  function exExpr() {
    const { a, b } = ex;
    $('#ex-expr').innerHTML = 'y = ' + M.expr(a, b);
    $('#ex-target-eq').innerHTML = 'y = ' + M.expr(a, b);
    $('#ex-b-val').textContent = num(b.n);
    const note = $('#ex-factor-note');
    if (b.isZero()) {
      $('#ex-factor').innerHTML = 'y = ' + M.expr(a, b);
      note.innerHTML = 'There is no constant, so there is only a stretch and the order can\'t go wrong. Set <i>b</i> to something other than 0.';
    } else {
      $('#ex-factor').innerHTML = 'y = ' + M.factored(a, b);
      note.innerHTML = M.factorNote(a, b);
    }
    $('#ex-idea').innerHTML = b.isZero()
      ? '<li>Try a value of <i>b</i> that isn\'t 0 to see why order matters.</li>'
      : M.idea(a, b);
  }

  function exStepInfo(st, i) {
    if (st.kind === 'start') {
      return { tone: '', title: `Start with ${Y(FX)}`, body: 'This is the original graph. Keep an eye on the labelled points as you step through.' };
    }
    const title = `Step ${i}: ${cap(st.kind === 'stretch' ? M.stretchPhrase(st.k) : M.translatePhrase(st.d))}`;
    return { title, ...M.stepText(ex.route, st, ex.a, ex.b) };
  }

  function exSteps() {
    const wrongRoute = ex.route === 'mistake' && !ex.b.isZero();
    $('#ex-steps').innerHTML = ex.stages.map((st, i) => {
      const bad = wrongRoute && i === ex.stages.length - 1;
      return `<button class="step${i === ex.stage ? ' on' : ''}${bad ? ' bad' : ''}" data-i="${i}">
        <span class="n">${i === 0 ? 'Start' : 'Step ' + i}</span><span class="m">y = ${st.eq}</span></button>`;
    }).join('');
    $$('#ex-steps .step').forEach(btn => btn.addEventListener('click', () => { ex.token++; exGo(+btn.dataset.i); }));

    const info = exStepInfo(ex.stages[ex.stage], ex.stage);
    const box = $('#ex-explain');
    box.className = 'explain' + (info.tone && !ex.animating ? ' ' + info.tone : '');
    box.innerHTML = `<h3>${info.title}</h3><p>${info.body}</p>`;

    $('#ex-back').disabled = ex.stage === 0;
    $('#ex-next').disabled = ex.stage === ex.stages.length - 1;

    const fn = FUNCS[ex.func];
    const head = ex.stages.map((st, i) => `<th class="${i === ex.stage ? 'on' : ''}">${i === 0 ? 'Start' : 'After step ' + i}<br><span class="m">y = ${st.eq}</span></th>`).join('');
    const rows = fn.keys.map(([name, u, y]) => `<tr><td>${name}</td>` + ex.stages.map((st, i) => {
      const [X, Yc] = M.coord(st.m, st.c, u, y);
      return `<td class="m${i === ex.stage ? ' on' : ''}">(${fracHTML(X)}, ${fracHTML(Yc)})</td>`;
    }).join('') + '</tr>').join('');
    $('#ex-table').innerHTML = `<table><thead><tr><th>Point</th>${head}</tr></thead><tbody>${rows}</tbody></table>`;
  }

  function exGo(i, done) {
    i = Math.max(0, Math.min(ex.stages.length - 1, i));
    if (ex.cancel) ex.cancel();
    const st = ex.stages[i];
    ex.stage = i; ex.animating = true;
    exSteps();
    ex.cancel = tween(ex.cur, M.map(st.m, st.c), DUR,
      mp => { ex.cur = mp; exRender(); },
      () => { ex.cancel = null; ex.animating = false; exRender(); exSteps(); if (done) done(); });
  }

  function exPlay() {
    exStop();
    const token = ex.token;
    ex.stage = 0; ex.cur = { ...ID }; exSteps(); exRender();
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

  function exInit() {
    $('#ex-build-eq').innerHTML = 'y = ' + M.formHTML;
    $('#ex-factor-label').innerHTML = M.factorLabel;
    $('#ex-idea-intro').innerHTML = M.ideaIntro;
    $('#ex-table-note').innerHTML = M.tableNote;
    $('#ex-route').innerHTML = M.routes.map((r, i) => `<button data-route="${r.id}" class="${i === 0 ? 'on' : ''}${r.warn ? ' warn' : ''}">${r.label}</button>`).join('');
    segSelect($('#ex-route'), 'route', v => { ex.route = v; exSetup(); exPlay(); });
    ex.route = M.routes[0].id;
    ex.a = F(2); ex.b = F(3);
    $$('#ex-a button').forEach(b => b.classList.toggle('on', b.dataset.a === '2'));
    bSlider.value = 3;
    exSetup();
  }

  /* =========================================================
     2. MATCH THE GRAPH
     ========================================================= */
  const mt = { level: 'starter', func: 'zigzag', a: null, b: null, ops: [], cur: { ...ID }, cancel: null, token: 0, solved: new Set(), played: false };
  const mtGraph = new Graph($('#mt-graph'));
  const seq = $('#mt-seq');
  const swapBtn = $('#mt-swap');
  const seqCards = () => $$('.seqcard', seq);

  function mtOrder() { return seqCards().map(c => c.dataset.kind); }
  function mtLabelOrder() { seqCards().forEach((c, i) => { $('.ord', c).textContent = i === 0 ? '1st' : '2nd'; }); }
  function mtSetOrder(first) {
    const cards = seqCards();
    const want = first === cards[0].dataset.kind ? cards : [cards[1], cards[0]];
    seq.append(want[0], swapBtn, want[1]);
    mtLabelOrder();
  }
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
    mtGraph.view = viewFor(fn, allMaps(mt.a, mt.b));
    $('#mt-target').innerHTML = 'y = ' + M.expr(mt.a, mt.b);
    $('#mt-refl-wrap').hidden = mt.level !== 'challenge';
    $('#mt-refl').checked = false;
    $('#mt-tr-amt').value = ''; $('#mt-sf').value = ''; $('#mt-dir').value = 'neg';
    mtSetOrder(Math.random() < 0.5 ? 'translate' : 'stretch'); // neither order is the "default"
    mtReset();
  }

  function mtReset() {
    if (mt.cancel) mt.cancel();
    mt.cancel = null; mt.token++;
    mt.ops = []; mt.played = false;
    mt.cur = { ...ID };
    $('#mt-step').hidden = true;
    $('#mt-play').disabled = false;
    mtUpdate();
    mtRender();
  }

  function mtRender() {
    const fn = FUNCS[mt.func];
    const tg = M.target(mt.a, mt.b);
    const layers = [{ ...ID, cls: 'c-orig' }, { ...M.map(tg.m, tg.c), cls: 'c-target' }];
    const moved = !isID(mt.cur);
    if (moved) layers.push({ ...mt.cur, cls: 'c-cur' });
    mtGraph.render({ fn, layers, points: moved ? [{ ...mt.cur, cls: 'p-cur', label: false }] : [] });
  }

  function mtError(html) { const msg = $('#mt-msg'); msg.className = 'msg err'; msg.innerHTML = html; }

  function mtReadOps() {
    const tr = parseFrac($('#mt-tr-amt').value);
    const sfRaw = $('#mt-sf').value.trim();
    const refl = !$('#mt-refl-wrap').hidden && $('#mt-refl').checked;
    const sf = sfRaw === '' && refl ? F(1) : parseFrac(sfRaw);
    if (!tr) { mtError(`Fill in the translation amount, e.g. ${mm('3/2')} or ${mm('1.5')}.`); $('#mt-tr-amt').focus(); return null; }
    if (tr.isNeg()) { mtError(`Type a positive translation amount, and use the ${M.match.neg}/${M.match.pos} menu for the direction.`); return null; }
    if (tr.isZero()) { mtError('A translation of 0 does nothing. Try another amount.'); return null; }
    if (!sf) { mtError(`Fill in the scale factor, e.g. ${mm('1/2')} or ${mm('3')}.`); $('#mt-sf').focus(); return null; }
    if (sf.isZero() || sf.isNeg()) { mtError(mt.level === 'challenge' ? 'Use a positive scale factor, and tick the box to reflect.' : 'The scale factor must be positive.'); return null; }
    if (sf.eq(1) && !refl) { mtError('A scale factor of 1 does nothing. Try another value.'); return null; }
    const ops = {
      translate: { type: 'translate', d: $('#mt-dir').value === 'neg' ? tr.neg() : tr },
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
    mt.cur = { ...ID };
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
      const { m, c } = compose(ops.slice(0, i + 1));
      box.className = 'explain';
      box.innerHTML = `<h3>${i === 0 ? '1st' : '2nd'}: ${cap(opPhrase(ops[i]))}</h3><p>Now ${Y(M.rhs(m, c))}</p>`;
      i++;
      mt.cancel = tween(mt.cur, M.map(m, c), DUR * 1.1,
        mp => { mt.cur = mp; mtRender(); },
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
      $('#mt-current').innerHTML = 'y = ' + FX;
      set('', `Plan two transformations that turn ${Y(FX)} into ${Y(M.expr(a, b))}, then press <b>Play</b>.`);
      badges();
      return;
    }

    const got = compose(ops), tg = M.target(a, b);
    $('#mt-current').innerHTML = 'y = ' + M.rhs(got.m, got.c);
    const firstT = ops[0].type === 'translate';
    const other = firstT ? 'stretching first' : 'translating first';

    if (got.m.eq(tg.m) && got.c.eq(tg.c)) {
      mt.solved.add(firstT ? 'translate' : 'stretch');
      set('good', '<b>✓ Matched!</b> ' + M.match.success(firstT, mt.solved.size === 2, a, b));
    } else {
      let html = `Your graph is ${Y(M.rhs(got.m, got.c))}, but the target is ${Y(M.expr(a, b))}. `;
      if (got.m.eq(tg.m)) html += M.match.shiftHint(firstT, a, b);
      else if (got.m.eq(tg.m.inv())) html += M.match.sfInvHint(a);
      else if (got.m.eq(tg.m.neg())) html += 'Check the reflection: the graph is the wrong way up or round.';
      else html += M.match.sfHint(a);
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
    card.addEventListener('dragstart', e => { dragCard = card; card.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', card.dataset.kind); } catch (_) { /* ignore */ } });
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
    mtGraph.view = viewFor(FUNCS[v], allMaps(mt.a, mt.b));
    mtRender();
  });

  function mtInit() {
    $('#mt-tr-label').innerHTML = M.match.trLabel;
    $('#mt-sf-label').innerHTML = M.match.sfLabel;
    $('#mt-refl-label').innerHTML = M.match.refl;
    $('#mt-dir option[value="neg"]').textContent = M.match.neg;
    $('#mt-dir option[value="pos"]').textContent = M.match.pos;
    mt.a = null; mt.b = null;
    mtNew();
  }

  /* =========================================================
     3. TEST YOURSELF
     ========================================================= */
  const qz = { level: 'starter', q: null, correct: 0, total: 0, cur: { ...ID }, cancel: null, token: 0 };
  const qzGraph = new Graph($('#qz-graph'));

  function qzNew() {
    const func = pick(['zigzag', 'cubic']);
    const fn = FUNCS[func];
    const { a, b } = pickAB(qz.level, fn, qz.q);
    const key = pick(fn.keys);
    const p = b.div(a);
    const tg = M.target(a, b);

    const { main, extra } = M.quiz.pool(a, b);
    const text = ops => cap(ops.map(opPhrase).join(', <b>then</b> '));
    const used = new Set(main.map(text));
    const extras = shuffle(extra).filter(o => !used.has(text(o)));
    const pool = extras.length ? main.concat([extras[0]]) : main;
    const options = shuffle(pool).map(ops => {
      const r = compose(ops);
      return { html: text(ops), m: r.m, c: r.c, right: r.m.eq(tg.m) && r.c.eq(tg.c) };
    });

    qz.q = { func, fn, a, b, p, key, options, parts: [{ tries: 0, done: false }, { tries: 0, done: false }, { tries: 0, done: false }] };
    if (qz.cancel) qz.cancel();
    qz.token++;
    qz.cur = { ...ID };
    qzGraph.view = viewFor(fn, allMaps(a, b));
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
    const layers = [{ ...ID, cls: 'c-orig' }];
    const points = [{ ...ID, cls: 'p-orig', keys: [[name, u, y]] }];
    if (reveal) {
      const tg = M.target(q.a, q.b);
      layers.push({ ...M.map(tg.m, tg.c), cls: 'c-target' });
      layers.push({ ...qz.cur, cls: wrong ? 'c-wrong' : 'c-cur' });
      points.push({ ...qz.cur, cls: wrong ? 'p-wrong' : 'p-cur', keys: [[name + '′', u, y]] });
    }
    qzGraph.render({ fn: q.fn, layers, points });
  }

  function qzBuild() {
    const q = qz.q;
    const { a, b } = q;
    const [name, u, y] = q.key;
    $('#qz-body').innerHTML = `
      <div class="card">
        <span class="label">The graph of <span class="m">y = <i>f</i>(<i>x</i>)</span> is transformed to</span>
        <div class="expr-big m target-eq">y = ${M.expr(a, b)}</div>
      </div>

      <div class="card qpart" id="qp1">
        <div class="qhead"><span class="qnum">a</span><p>${M.quiz.aPrompt}</p></div>
        <div class="qq m">${M.quiz.aLine(a, b, '<input type="text" id="qz-p" aria-label="Missing value">')}</div>
        <div class="row"><button class="btn primary" id="qz-c1">Check</button><button class="btn ghost" id="qz-s1" hidden>Show answer</button></div>
        <div class="fb" id="qz-f1"></div>
      </div>

      <div class="card qpart" id="qp2">
        <div class="qhead"><span class="qnum">b</span><p>Which of these sequences map ${Y(FX)} onto ${Y(M.expr(a, b))}? <b>Tick all that work.</b></p></div>
        <div class="opts">${q.options.map((o, i) => `<label class="opt" id="qz-o${i}"><input type="checkbox" value="${i}"><span>${o.html}<span class="res"></span></span></label>`).join('')}</div>
        <div class="row" style="margin-top:10px"><button class="btn primary" id="qz-c2">Check</button><button class="btn ghost" id="qz-s2" hidden>Show answer</button></div>
        <div class="fb" id="qz-f2"></div>
      </div>

      <div class="card qpart" id="qp3">
        <div class="qhead"><span class="qnum">c</span><p>Point <b>${name}</b> ${mm(`(${num(u)}, ${num(y)})`)} lies on ${Y(FX)}. Find the coordinates of its image on ${Y(M.expr(a, b))}.</p></div>
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
    if (!v) { fb(1, 'info', `Type a number, e.g. ${mm('3/2')} or ${mm('−1.5')}.`); return; }
    part.tries++;
    if (v.eq(q.p)) {
      inp.className = 'ok';
      fb(1, 'good', M.quiz.aCorrect(q.a, q.b));
      qzFinishPart(1, part.tries === 1);
    } else {
      inp.className = 'no';
      let hint = `Not quite. Divide the constant term by ${mm(fracHTML(q.a))}.`;
      if (v.eq(q.b)) hint = `That's the original constant. When you take out the factor of ${mm(fracHTML(q.a))}, the constant must be divided by it too. Check by expanding.`;
      else if (v.eq(q.b.mul(q.a))) hint = `You multiplied by ${mm(fracHTML(q.a))}. You need to divide instead. Check by expanding the bracket.`;
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
    if (q.options.every((o, i) => o.right === chosen.has(i))) {
      qzMarkOptions();
      fb(2, 'good', M.quiz.bCorrect(q.a, q.b));
      qzFinishPart(2, part.tries === 1);
    } else {
      const nRight = q.options.filter(o => o.right).length;
      fb(2, 'bad', `Not quite. Exactly ${nRight} of these work. Hint: a stretch applied <b>after</b> a translation also stretches that translation, but a translation applied after a stretch is not changed.`);
      $('#qz-s2').hidden = false;
    }
  }

  function qzMarkOptions() {
    qz.q.options.forEach((o, i) => {
      const el = $('#qz-o' + i);
      el.classList.add(o.right ? 'right' : 'wrong');
      el.querySelector('input').checked = o.right;
      el.querySelector('input').disabled = true;
      $('.res', el).innerHTML = (o.right ? '✓ gives ' : '✗ gives ') + Y(M.rhs(o.m, o.c));
    });
  }

  function qzCheck3() {
    const q = qz.q, part = q.parts[2];
    if (part.done) return;
    const [, u, v] = q.key;
    const ix = $('#qz-x'), iy = $('#qz-y');
    const vx = parseFrac(ix.value), vy = parseFrac(iy.value);
    if (!vx || !vy) { fb(3, 'info', `Fill in both coordinates. Fractions like ${mm('−7/2')} are fine.`); return; }
    part.tries++;
    const [X, Yv] = M.quiz.image(u, v, q.a, q.b);
    const okX = vx.eq(X), okY = vy.eq(Yv);
    ix.className = okX ? 'ok' : 'no';
    iy.className = okY ? 'ok' : 'no';
    if (okX && okY) {
      fb(3, 'good', M.quiz.cCorrect(u, v, q.a, q.b, X, Yv));
      qzFinishPart(3, part.tries === 1);
    } else {
      fb(3, 'bad', M.quiz.cHint(vx, vy, u, v, q.a, q.b, okX, okY));
      $('#qz-s3').hidden = false;
    }
  }

  function qzShow(i) {
    const q = qz.q;
    if (i === 1) {
      $('#qz-p').value = fracText(q.p);
      $('#qz-p').className = '';
      fb(1, 'info', `The answer is ${mm(fracHTML(q.p))}: ${mm(divHTML(q.b, q.a))}, so ${Y(M.factored(q.a, q.b))}.`);
    } else if (i === 2) {
      qzMarkOptions();
      fb(2, 'info', M.quiz.bShow(q.a, q.b));
    } else {
      const [, u, v] = q.key;
      const [X, Yv] = M.quiz.image(u, v, q.a, q.b);
      $('#qz-x').value = fracText(X);
      $('#qz-y').value = fracText(Yv);
      $('#qz-x').className = $('#qz-y').className = '';
      fb(3, 'info', M.quiz.cShow(u, v, q.a, q.b, X, Yv));
    }
    qzFinishPart(i, false);
  }

  function qzUnlock() {
    const q = qz.q;
    $('#qz-watch').hidden = false;
    $('#qz-next').hidden = false;
    $('#qz-legend-target').hidden = false;
    $('#qz-target-eq').innerHTML = 'y = ' + M.expr(q.a, q.b);
    qzPlay(M.routes[0].id);
  }

  function qzPlay(route) {
    const q = qz.q;
    if (qz.cancel) qz.cancel();
    const token = ++qz.token;
    const stages = M.stages(route, q.a, q.b);
    const box = $('#qz-caption');
    qz.cur = { ...ID };
    qzRender(true);
    box.className = 'explain';
    box.innerHTML = `<h3>Start: ${Y(FX)}</h3><p>${route === 'mistake' ? 'Watch what goes wrong…' : 'Watch the point move.'}</p>`;
    let i = 0;
    const next = () => {
      if (qz.token !== token) return;
      i++;
      if (i >= stages.length) return;
      const st = stages[i];
      const last = i === stages.length - 1;
      const wrong = route === 'mistake' && last;
      const phrase = cap(st.kind === 'stretch' ? M.stretchPhrase(st.k) : M.translatePhrase(st.d));
      qz.cancel = tween(qz.cur, M.map(st.m, st.c), DUR,
        mp => { qz.cur = mp; qzRender(true); },
        () => {
          if (qz.token !== token) return;
          qzRender(true, wrong);
          let tail = `Now ${Y(st.eq)}.`;
          if (last && !wrong) tail += ' ✓ Matches the target.';
          if (wrong) tail = `Now ${mm(`y = ${st.eq} = ${M.rhs(st.m, st.c)}`)}. ${M.quiz.mistakeTail(q.a, q.b)}`;
          box.className = 'explain' + (last ? (wrong ? ' bad' : ' good') : '');
          box.innerHTML = `<h3>Step ${i}: ${phrase}</h3><p>${tail}</p>`;
          setTimeout(next, 1300);
        });
      box.className = 'explain';
      box.innerHTML = `<h3>Step ${i}: ${phrase}</h3><p>${st.kind === 'stretch' ? M.stretchHint(st.k) : M.translateHint(st.d)}</p>`;
    };
    setTimeout(next, 700);
  }

  $('#qz-next').addEventListener('click', qzNew);
  segSelect($('#qz-level'), 'level', v => { qz.level = v; qzNew(); });

  function qzInit() {
    $('#qz-watch-row').innerHTML = M.routes.map(r => `<button class="btn${r.warn ? ' warn-btn' : ''}" data-route="${r.id}">${r.short}</button>`).join('');
    $$('#qz-watch-row button').forEach(btn => btn.addEventListener('click', () => qzPlay(btn.dataset.route)));
    qz.correct = 0; qz.total = 0; qz.q = null;
    $('#qz-score').textContent = '0 / 0';
    qzNew();
  }

  /* =========================================================
     Topic menu + routing (#outside / #inside)
     ========================================================= */
  const DEFAULT_TITLE = 'Order of transformations';
  function stopAll() {
    [ln, ex, mt, qz].forEach(s => { if (s.cancel) s.cancel(); s.cancel = null; s.token++; });
  }

  function showMenu() {
    stopAll();
    $('#menu').hidden = false;
    $$('.panel').forEach(p => { p.hidden = true; });
    $('#tabs').hidden = true;
    $('#change-topic').hidden = true;
    $('#title').innerHTML = DEFAULT_TITLE;
    $('#lede').innerHTML = 'Pick a topic to start. Each one has a short walkthrough, then activities to explore, match graphs and test yourself.';
    document.title = DEFAULT_TITLE;
  }

  function enterMode(id) {
    stopAll();
    M = MODES[id];
    $('#menu').hidden = true;
    $('#tabs').hidden = false;
    $('#change-topic').hidden = false;
    $('#title').innerHTML = `${DEFAULT_TITLE}: ${mm(M.name)}`;
    $('#lede').innerHTML = M.lede;
    document.title = `${DEFAULT_TITLE}: ${M.id === 'outside' ? 'y = af(x) + b' : 'y = f(ax + b)'}`;
    exInit(); mtInit(); qzInit(); lnInit();
    selectTab('learn');
  }

  function route() {
    const h = location.hash.replace('#', '');
    if (MODES[h]) enterMode(h); else showMenu();
  }

  $$('.menu-card').forEach(card => card.addEventListener('click', () => { location.hash = card.dataset.mode; window.scrollTo(0, 0); }));
  $('#change-topic').addEventListener('click', () => { location.hash = ''; window.scrollTo(0, 0); });
  window.addEventListener('hashchange', route);

  // Menu thumbnails
  const thumbO = new Graph($('#menu-g-outer'), 660, 300);
  thumbO.view = { x0: -6, x1: 6, y0: -4, y1: 10 };
  thumbO.render({ fn: FUNCS.zigzag, ticks: false, layers: [{ ...ID, cls: 'c-orig' }, { s: 1, t: 0, S: 2, T: 3, cls: 'c-cur' }] });
  const thumbI = new Graph($('#menu-g-inner'), 660, 300);
  thumbI.view = { x0: -7, x1: 7, y0: -3, y1: 4 };
  thumbI.render({ fn: FUNCS.zigzag, ticks: false, layers: [{ ...ID, cls: 'c-orig' }, { s: 0.5, t: -1.5, S: 1, T: 0, cls: 'c-cur' }] });

  route();
})();
