/* ============================================================================
   evidence — scroll-drawn spine for the science section
   ----------------------------------------------------------------------------
   A single SVG line snakes down the section and DRAWS ITSELF as you scroll,
   passing through each finding's node; cards fade in as the line reaches them
   and their headline figure counts up with the same progress value. Scroll is
   the clock, so everything is reversible and lands identically on the way back.

   The path is not hand-drawn: at layout we measure each node's real centre and
   build a smooth cubic through them, so the line always hits the nodes exactly
   at any width. Costs a few kilobytes — no video, no animation library.

   USAGE
     <section id="science">
       <div class="je-ev__spine" id="jeEvSpine">
         <svg class="je-ev__line"><path class="je-ev__track"/><path class="je-ev__draw"/></svg>
         <ol class="je-ev__items">
           <li class="je-ev__item" data-side="right">
             <span class="je-ev__node"></span>
             <div class="je-ev__card">
               <strong class="je-ev__num" data-to="27.6" data-decimals="1" data-prefix="" data-suffix="%"></strong>
               …
     mountEvidence();   // idempotent; no-op when the section is absent
   ========================================================================== */
function mountEvidence(opts) {
  opts = opts || {};
  const spine = document.getElementById(opts.spineId || 'jeEvSpine');
  if (!spine || spine.dataset.jeMounted) return null;
  spine.dataset.jeMounted = '1';

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const svg = spine.querySelector('.je-ev__line');
  const track = spine.querySelector('.je-ev__track');
  const draw = spine.querySelector('.je-ev__draw');
  const items = [...spine.querySelectorAll('.je-ev__item')];
  if (!svg || !draw || !items.length) return null;

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lin = (x, a, b) => clamp((x - a) / (b - a));
  const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const outCubic = x => 1 - Math.pow(1 - clamp(x), 3);

  // Numbers are written into the DOM at layout so a crawler and a reduced-motion
  // visitor always see the real figure, never a zero.
  const nums = items.map(li => {
    const el = li.querySelector('.je-ev__num');
    if (!el) return null;
    const to = parseFloat(el.dataset.to);
    return {
      el,
      to: isNaN(to) ? null : to,
      decimals: +(el.dataset.decimals || 0),
      prefix: el.dataset.prefix || '',
      suffix: el.dataset.suffix || '',
    };
  });
  const fmt = (n, d) => d ? n.toFixed(d) : String(Math.round(n));
  const writeNum = (n, v) => { if (n && n.to != null) n.el.textContent = n.prefix + fmt(v, n.decimals) + n.suffix; };

  let nodeAt = [];      // fraction along the path where each node sits
  let len = 0;

  function layout() {
    const box = spine.getBoundingClientRect();
    const W = Math.max(1, Math.round(box.width));
    const H = Math.max(1, Math.round(box.height));
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);

    // Real centre of every node, in spine-local coordinates.
    const pts = items.map(li => {
      const n = li.querySelector('.je-ev__node');
      const r = (n || li).getBoundingClientRect();
      return { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 };
    });
    // Enter from just above the first node and leave just below the last.
    const first = { x: pts[0].x, y: Math.max(0, pts[0].y - Math.min(140, pts[0].y)) };
    const last = { x: pts[pts.length - 1].x, y: Math.min(H, pts[pts.length - 1].y + 120) };
    const all = [first, ...pts, last];

    // Smooth cubic through the points: vertical control handles keep the line
    // reading as one continuous spine even when consecutive nodes swap sides.
    let d = 'M' + all[0].x.toFixed(1) + ',' + all[0].y.toFixed(1);
    for (let i = 1; i < all.length; i++) {
      const p0 = all[i - 1], p1 = all[i];
      const k = Math.max(24, Math.abs(p1.y - p0.y) * 0.5);
      d += ' C' + p0.x.toFixed(1) + ',' + (p0.y + k).toFixed(1) +
           ' ' + p1.x.toFixed(1) + ',' + (p1.y - k).toFixed(1) +
           ' ' + p1.x.toFixed(1) + ',' + p1.y.toFixed(1);
    }
    track.setAttribute('d', d);
    draw.setAttribute('d', d);
    draw.setAttribute('pathLength', '100');
    draw.style.strokeDasharray = '100';

    try { len = draw.getTotalLength(); } catch (e) { len = 0; }
    // Where each node falls along the path, as a 0..1 fraction: walk the path
    // once and take the closest sample to each node centre.
    if (len) {
      const SAMPLES = 400;
      const samples = [];
      for (let s = 0; s <= SAMPLES; s++) {
        const p = draw.getPointAtLength((s / SAMPLES) * len);
        samples.push(p);
      }
      nodeAt = pts.map(pt => {
        let best = 0, bestD = Infinity;
        for (let s = 0; s < samples.length; s++) {
          const dx = samples[s].x - pt.x, dy = samples[s].y - pt.y;
          const dd = dx * dx + dy * dy;
          if (dd < bestD) { bestD = dd; best = s; }
        }
        return best / SAMPLES;
      });
    } else {
      nodeAt = pts.map((_, i) => (i + 1) / (pts.length + 1));
    }
    read();
  }

  function render(p) {
    draw.style.strokeDashoffset = (100 - 100 * clamp(p)).toFixed(2);
    items.forEach((li, i) => {
      const at = nodeAt[i] != null ? nodeAt[i] : (i + 1) / (items.length + 1);
      // The card wakes just before the line reaches its node and settles just after.
      const local = lin(p, at - 0.10, at + 0.02);
      const on = smooth(local);
      li.style.setProperty('--je-ev-on', on.toFixed(3));
      li.classList.toggle('is-on', on > 0.55);
      const n = nums[i];
      if (n && n.to != null) writeNum(n, n.to * outCubic(lin(p, at - 0.09, at + 0.05)));
    });
  }

  let ticking = false;
  function read() {
    ticking = false;
    if (reduce) return;
    const box = spine.getBoundingClientRect();
    const vh = innerHeight;
    // Progress of the reading line (60% down the viewport) through the spine.
    const eye = vh * 0.6;
    const p = clamp((eye - box.top) / Math.max(1, box.height));
    render(p);
  }

  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(read); } }

  function restAll() {                       // reduced motion: finished state, no motion
    draw.style.strokeDashoffset = '0';
    items.forEach((li, i) => {
      li.style.setProperty('--je-ev-on', '1');
      li.classList.add('is-on');
      const n = nums[i]; if (n && n.to != null) writeNum(n, n.to);
    });
  }

  layout();
  if (reduce) restAll();
  else {
    items.forEach((li, i) => { const n = nums[i]; if (n && n.to != null) writeNum(n, 0); });
    read();
    addEventListener('scroll', onScroll, { passive: true });
  }
  addEventListener('resize', layout);
  addEventListener('orientationchange', layout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  addEventListener('load', layout);

  return { layout, read, render, items };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { mountEvidence };
if (typeof window !== 'undefined') window.mountEvidence = mountEvidence;
