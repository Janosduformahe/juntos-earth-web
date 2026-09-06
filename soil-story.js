/* ============================================================================
   soil-story — scroll-driven motion-graphic overlay for "The Living Soil"
   ----------------------------------------------------------------------------
   Sits above the scrubbed film and tells the loop as you scroll: a worm tunnels
   through the soil, a seed drops, roots and a stem grow, four nutrient labels
   pop as the plant matures, and a sheep walks in and eats it. One SVG, driven
   by the section's band progress (0..1) handed over by the engine's `onRead`
   hook. No autoplay, no timers — scroll IS the clock, so it is fully
   reversible and lands on the same frame at the same scroll position.

   USAGE
     const soil = mountSoilStory(document.getElementById('world'), {
       sectionId: 'suelo',   // section whose band drives the story
       startAt: 0.22,        // band fraction where the story begins (after the dive)
     });
     mountScrollWorld(world, { …, onRead: (st) => soil.update(st) });
   ========================================================================== */
function mountSoilStory(container, opts) {
  opts = opts || {};
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const smallMQ = matchMedia('(max-width: 860px)');
  const sectionId = opts.sectionId || 'suelo';
  const startAt = opts.startAt != null ? opts.startAt : 0.22;
  const NS = 'http://www.w3.org/2000/svg';
  const uid = 'jeSoil' + (mountSoilStory._n = (mountSoilStory._n || 0) + 1);   // unique ids per mount

  injectSoilCSS();

  // ---- math ----
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lin = (q, a, b) => clamp((q - a) / (b - a));
  const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const outCubic = x => 1 - Math.pow(1 - clamp(x), 3);
  const inQuad = x => { x = clamp(x); return x * x; };
  const backOut = x => { x = clamp(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const f2 = n => (Math.round(n * 100) / 100).toString();

  // ---- DOM ----
  const layer = el('div', 'je-soil');
  const stage = el('div', 'je-soil__stage');
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'je-soil__svg');
  svg.setAttribute('viewBox', '0 0 1000 1000');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('aria-hidden', 'true');
  stage.appendChild(svg);
  const end = el('div', 'je-soil__end');
  end.innerHTML = 'What the soil grows, the flock eats.<em>What the flock eats ends up in your broth.</em>';
  stage.appendChild(end);
  layer.appendChild(stage);
  container.appendChild(layer);

  const GROUND = 560;
  const defs = svgEl('defs');
  defs.innerHTML =
    '<linearGradient id="' + uid + '-hazeV" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#D2E18B" stop-opacity=".3"/>' +
      '<stop offset="1" stop-color="#D2E18B" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="' + uid + '-fadeH" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".14" stop-color="#fff"/>' +
      '<stop offset=".86" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
    '<mask id="' + uid + '-hazeM"><rect x="-60" y="-120" width="1460" height="' + (GROUND + 120) + '" fill="url(#' + uid + '-fadeH)"/></mask>' +
    '<linearGradient id="' + uid + '-line" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0" stop-color="#FFFEF5" stop-opacity="0"/><stop offset=".1" stop-color="#FFFEF5" stop-opacity=".5"/>' +
      '<stop offset=".9" stop-color="#FFFEF5" stop-opacity=".5"/><stop offset="1" stop-color="#FFFEF5" stop-opacity="0"/></linearGradient>' +
    '<mask id="' + uid + '-wormM"><path id="' + uid + '-wormMP" fill="none" stroke="#fff" stroke-width="24" stroke-linecap="round"/></mask>';
  svg.appendChild(defs);

  // sky haze above the ground line (fades in as we settle underground); edges feathered
  const haze = svgEl('rect', { x: -60, y: -120, width: 1460, height: GROUND + 120, fill: 'url(#' + uid + '-hazeV)', mask: 'url(#' + uid + '-hazeM)', opacity: 0 });
  svg.appendChild(haze);

  // ---- worm: tunnel trail + segmented body along an invisible path ----
  const WORM_D = 'M-140,905 C40,840 150,965 300,905 C420,855 470,965 600,915 C720,870 790,955 900,905 C960,878 1040,905 1140,895';
  const wormPath = svgEl('path', { d: WORM_D, fill: 'none', stroke: 'none' });
  const tunnel = svgEl('path', { d: WORM_D, fill: 'none', stroke: 'rgba(255,254,245,.13)', 'stroke-width': 26, 'stroke-linecap': 'round' });
  svg.appendChild(wormPath); svg.appendChild(tunnel);
  const wormMaskPath = svg.querySelector('#' + uid + '-wormMP'); wormMaskPath.setAttribute('d', WORM_D);
  const wormG = svgEl('g', { class: 'je-worm' });
  // The body is a sliding window of the path (dasharray trick); the ring pattern rides
  // inside it through the mask; a lighter band marks the clitellum; two eyes at the head.
  const wormBody = svgEl('path', { d: WORM_D, fill: 'none', stroke: '#F27E9E', 'stroke-width': 24, 'stroke-linecap': 'round' });
  const wormRings = svgEl('path', { d: WORM_D, fill: 'none', stroke: 'rgba(160,20,70,.28)', 'stroke-width': 24, 'stroke-dasharray': '3 12', mask: 'url(#' + uid + '-wormM)' });
  const wormBand = svgEl('path', { d: WORM_D, fill: 'none', stroke: '#F9B7C8', 'stroke-width': 27, 'stroke-linecap': 'butt' });
  const eyeL = svgEl('circle', { r: 2.6, fill: '#0A2E19' }), eyeR = svgEl('circle', { r: 2.6, fill: '#0A2E19' });
  [wormBody, wormRings, wormBand, eyeL, eyeR].forEach(n => wormG.appendChild(n));
  svg.appendChild(wormG);
  let wormLen = 0;

  // ---- ground line + grass tufts ----
  const ground = svgEl('line', { x1: -60, y1: GROUND, x2: 1400, y2: GROUND, stroke: 'url(#' + uid + '-line)', 'stroke-width': 2, 'stroke-linecap': 'round' });
  svg.appendChild(ground);
  const tufts = [120, 250, 330, 560, 700, 850, 950].map((x, i) => {
    const t = svgEl('path', { d: 'M' + x + ',' + GROUND + ' l-7,-18 M' + x + ',' + GROUND + ' l0,-23 M' + x + ',' + GROUND + ' l7,-17', stroke: '#A5BC39', 'stroke-width': 2.5, 'stroke-linecap': 'round', fill: 'none' });
    t.dataset.x = x; t.dataset.i = i; svg.appendChild(t); return t;
  });

  // ---- roots + seed + stem + leaves + flower ----
  const PX = 430, SEED_Y = 640;
  const roots = [
    'M' + PX + ',652 C420,700 380,730 372,780',
    'M' + PX + ',652 C440,712 470,742 486,800',
    'M' + PX + ',652 C432,700 428,742 434,792',
    'M' + (PX + 2) + ',690 C452,704 462,716 470,728',
    'M' + (PX - 3) + ',700 C412,714 400,724 392,738',
  ].map((d, i) => svgEl('path', { d, fill: 'none', stroke: 'rgba(255,254,245,.6)', 'stroke-width': i < 3 ? 3 : 2, 'stroke-linecap': 'round', pathLength: 100, 'stroke-dasharray': 100, 'stroke-dashoffset': 100 }));
  roots.forEach(r => svg.appendChild(r));
  const seed = svgEl('ellipse', { cx: PX, cy: SEED_Y, rx: 11, ry: 8, fill: '#F8DB3F', opacity: 0 });
  svg.appendChild(seed);
  const STEM_TOP = 235;
  const stem = svgEl('path', { d: 'M' + PX + ',' + SEED_Y + ' C430,560 424,500 430,440 C436,380 444,320 438,' + STEM_TOP, fill: 'none', stroke: '#A5BC39', 'stroke-width': 7, 'stroke-linecap': 'round', pathLength: 100, 'stroke-dasharray': 100, 'stroke-dashoffset': 100 });
  svg.appendChild(stem);
  // leaves: attach point on the stem, side, fill; frac = height along the stem where it sprouts
  const LEAF_D = 'M0,0 C-30,-6 -62,-34 -68,-70 C-34,-62 -6,-36 0,0 Z';
  const LEAVES = [
    { y: 500, side: -1, fill: '#D2E18B', x: 429 },
    { y: 440, side: 1, fill: '#44843D', x: 430 },
    { y: 380, side: -1, fill: '#A5BC39', x: 436 },
    { y: 320, side: 1, fill: '#D2E18B', x: 442 },
  ].map(L => {
    const g = svgEl('g', { transform: 'translate(' + L.x + ',' + L.y + ')' });
    const inner = svgEl('g');
    inner.appendChild(svgEl('path', { d: LEAF_D, fill: L.fill, transform: L.side > 0 ? 'scale(-1,1)' : null }));
    g.appendChild(inner); svg.appendChild(g);
    L.frac = (SEED_Y - L.y) / (SEED_Y - STEM_TOP); L.inner = inner;
    L.tip = { x: L.x + (L.side < 0 ? -68 : 68), y: L.y - 70 };   // leaf tip, for leader lines
    return L;
  });
  const flower = svgEl('g', { transform: 'translate(438,' + STEM_TOP + ')' });
  const flowerIn = svgEl('g');
  for (let p = 0; p < 6; p++) flowerIn.appendChild(svgEl('ellipse', { cx: 0, cy: -20, rx: 11, ry: 22, fill: '#F27E9E', transform: 'rotate(' + (p * 60) + ')' }));
  flowerIn.appendChild(svgEl('circle', { r: 13, fill: '#F8DB3F' }));
  flower.appendChild(flowerIn); svg.appendChild(flower);

  // ---- nutrient chips (leader line + anchor dot + pill with title/sub) ----
  const CHIPS = [
    { key: 'minerals', title: 'Minerals', sub: 'Ca · Mg · K · P', dot: '#FF913F', at: 0.30, anchor: { x: 372, y: 780 }, pos: { x: 200, y: 800 }, posM: { x: 215, y: 815 }, eatAt: null },
    { key: 'omega', title: 'Omega-3 & fibre', sub: 'in every leaf', dot: '#56AAE8', at: 0.42, anchor: () => LEAVES[1].tip, pos: { x: 745, y: 292 }, posM: { x: 750, y: 300 }, eatAt: 0.92 },
    { key: 'polyphenols', title: 'Polyphenols', sub: 'plant antioxidants', dot: '#F27E9E', at: 0.48, anchor: () => LEAVES[2].tip, pos: { x: 200, y: 300 }, posM: { x: 195, y: 310 }, eatAt: 0.89 },
    { key: 'vitamins', title: 'Vitamins', sub: 'A · C · K', dot: '#F8DB3F', at: 0.56, anchor: { x: 438, y: STEM_TOP - 8 }, pos: { x: 705, y: 150 }, posM: { x: 705, y: 140 }, eatAt: 0.83 },
  ];
  CHIPS.forEach(c => {
    c.leader = svgEl('path', { fill: 'none', stroke: 'rgba(255,254,245,.72)', 'stroke-width': 2, 'stroke-linecap': 'round', pathLength: 100, 'stroke-dasharray': 100, 'stroke-dashoffset': 100 });
    c.dotEl = svgEl('circle', { r: 5, fill: c.dot, opacity: 0 });
    c.g = svgEl('g', { class: 'je-chip', opacity: 0 });
    c.rect = svgEl('rect', { rx: 30, ry: 30, fill: 'rgba(255,254,245,.94)' });
    c.dotIn = svgEl('circle', { r: 7, fill: c.dot });
    c.t1 = svgEl('text', { class: 'je-chip__title', fill: '#0A2E19' }); c.t1.textContent = c.title;
    c.t2 = svgEl('text', { class: 'je-chip__sub', fill: 'rgba(10,46,25,.72)' }); c.t2.textContent = c.sub;
    [c.rect, c.dotIn, c.t1, c.t2].forEach(n => c.g.appendChild(n));
    svg.appendChild(c.leader); svg.appendChild(c.dotEl); svg.appendChild(c.g);
  });

  // ---- sheep (faces left; feet on the ground line; local origin = feet centre) ----
  const sheep = svgEl('g', { class: 'je-sheep', opacity: 0 });
  const WOOL = '#FFFEF5', DARK = '#24492E';
  const LEG_X = [-72, -40, 32, 62];
  const legs = LEG_X.map(x => {
    const l = svgEl('g', { transform: 'translate(' + x + ',-78)' });
    l.appendChild(svgEl('rect', { x: -7, y: 0, width: 14, height: 80, rx: 7, fill: DARK, stroke: WOOL, 'stroke-width': 2 }));
    sheep.appendChild(l); return l;
  });
  const body = svgEl('g');
  body.appendChild(svgEl('ellipse', { cx: 0, cy: -125, rx: 125, ry: 72, fill: WOOL }));
  [[-100, -112, 48], [-62, -165, 52], [0, -182, 58], [62, -165, 52], [102, -118, 48], [72, -82, 42], [-72, -82, 42]]
    .forEach(([x, y, r]) => body.appendChild(svgEl('circle', { cx: x, cy: y, r, fill: WOOL })));
  body.appendChild(svgEl('ellipse', { cx: 134, cy: -128, rx: 16, ry: 10, fill: WOOL }));   // tail
  const head = svgEl('g');                                                                // pivot: neck (-118,-150)
  head.appendChild(svgEl('ellipse', { cx: -158, cy: -140, rx: 45, ry: 54, fill: DARK, stroke: WOOL, 'stroke-width': 3 }));
  head.appendChild(svgEl('ellipse', { cx: -126, cy: -176, rx: 26, ry: 11, fill: DARK, stroke: WOOL, 'stroke-width': 2.5, transform: 'rotate(-28 -126 -176)' }));
  head.appendChild(svgEl('circle', { cx: -150, cy: -182, r: 24, fill: WOOL }));            // wool tuft
  head.appendChild(svgEl('circle', { cx: -176, cy: -150, r: 6.5, fill: WOOL }));
  head.appendChild(svgEl('circle', { cx: -177, cy: -150, r: 3.2, fill: '#0A2E19' }));
  body.appendChild(head); sheep.appendChild(body); svg.appendChild(sheep);

  // ---- layout (desktop vs phone chip positions + type size) ----
  let mobile = smallMQ.matches;
  function layout() {
    mobile = smallMQ.matches;
    layer.classList.toggle('is-mobile', mobile);
    const T = mobile ? 36 : 25, S = mobile ? 24 : 17, H = mobile ? 78 : 60, PADX = mobile ? 24 : 18;
    CHIPS.forEach(c => {
      const p = mobile ? c.posM : c.pos; c.cx = p.x; c.cy = p.y;
      c.t1.setAttribute('font-size', T); c.t2.setAttribute('font-size', S);
      c.t1.setAttribute('font-weight', 700); c.t2.setAttribute('font-weight', 500);
      let w1 = 0, w2 = 0;
      try { w1 = c.t1.getComputedTextLength(); w2 = c.t2.getComputedTextLength(); } catch (e) {}
      if (!w1) w1 = c.title.length * T * 0.56;
      if (!w2) w2 = c.sub.length * S * 0.52;
      const W = Math.max(w1, w2) + PADX * 2 + 22;
      c.w = W; c.h = H;
      c.rect.setAttribute('x', -W / 2); c.rect.setAttribute('y', -H / 2); c.rect.setAttribute('width', W); c.rect.setAttribute('height', H);
      c.rect.setAttribute('rx', H / 2); c.rect.setAttribute('ry', H / 2);
      const tx = -W / 2 + PADX + 20;
      c.dotIn.setAttribute('cx', -W / 2 + PADX + 4); c.dotIn.setAttribute('cy', 0);
      c.t1.setAttribute('x', tx); c.t1.setAttribute('y', -H * 0.09);
      c.t2.setAttribute('x', tx); c.t2.setAttribute('y', H * 0.28);
      // leader: from the anchor to the chip's near edge, with a soft elbow
      const a = typeof c.anchor === 'function' ? c.anchor() : c.anchor;
      const dir = c.cx > a.x ? -1 : 1;                 // chip sits right (edge on its left) or left of the anchor
      const ex = c.cx + dir * (W / 2 - 4), ey = c.cy;
      const mx = (a.x + ex) / 2;
      c.leader.setAttribute('d', 'M' + a.x + ',' + a.y + ' C' + mx + ',' + a.y + ' ' + mx + ',' + ey + ' ' + ex + ',' + ey);
      c.dotEl.setAttribute('cx', a.x); c.dotEl.setAttribute('cy', a.y);
    });
    try { wormLen = wormPath.getTotalLength(); } catch (e) { wormLen = 1500; }
    lastQ = -1;
  }
  let lastQ = -1, shown = null;
  layout();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { layout(); if (lastQ >= 0) render(lastQ); });
  if (smallMQ.addEventListener) smallMQ.addEventListener('change', layout); else smallMQ.addListener(layout);

  // ---- the story, as a function of q (0..1 across the story part of the band) ----
  const SHEEP_X = 640, MOUTH = { x: 505, y: 478 };
  function render(q) {
    if (q === lastQ) return; lastQ = q;
    // haze + ground + tufts
    haze.setAttribute('opacity', f2(0.9 * smooth(lin(q, 0, 0.12))));
    ground.setAttribute('opacity', f2(smooth(lin(q, 0.02, 0.12))));
    tufts.forEach((t, i) => {
      const s = backOut(lin(q, 0.24 + i * 0.02, 0.32 + i * 0.02));
      t.setAttribute('transform', 'translate(' + t.dataset.x + ',' + GROUND + ') scale(' + f2(s) + ') translate(' + (-t.dataset.x) + ',' + (-GROUND) + ')');
      t.setAttribute('opacity', s > 0.02 ? 1 : 0);
    });
    // worm: the head travels the whole path across the story; segments trail with peristalsis
    const L = wormLen || 1500;
    const body = 128 + 14 * Math.sin(q * 46);                       // peristalsis: stretch / contract
    const headAt = -body - 20 + q * (L + body + 300);               // enters from the left, leaves right
    const win = (len, from) => ({ 'stroke-dasharray': f2(len) + ' ' + f2(L + 1000), 'stroke-dashoffset': f2(-from) });
    setAttrs(wormBody, win(body, headAt - body));
    setAttrs(wormMaskPath, win(body, headAt - body));
    wormRings.setAttribute('stroke-dashoffset', f2(-(headAt - body) + 6));
    setAttrs(wormBand, win(18, headAt - body * 0.68));
    let hp, ap;
    try { hp = wormPath.getPointAtLength(clamp(headAt, 0, L)); ap = wormPath.getPointAtLength(clamp(headAt - 6, 0, L)); }
    catch (e) { hp = { x: -300, y: 900 }; ap = { x: -306, y: 900 }; }
    const dx = hp.x - ap.x, dy = hp.y - ap.y, dl = Math.hypot(dx, dy) || 1, nx = -dy / dl, ny = dx / dl;
    const eyeOn = (headAt > 8 && headAt < L - 4) ? 1 : 0;
    eyeL.setAttribute('cx', f2(hp.x - dx / dl * 5 + nx * 5.5)); eyeL.setAttribute('cy', f2(hp.y - dy / dl * 5 + ny * 5.5)); eyeL.setAttribute('opacity', eyeOn);
    eyeR.setAttribute('cx', f2(hp.x - dx / dl * 5 - nx * 5.5)); eyeR.setAttribute('cy', f2(hp.y - dy / dl * 5 - ny * 5.5)); eyeR.setAttribute('opacity', eyeOn);
    tunnel.setAttribute('stroke-dasharray', f2(L) + ' ' + f2(L));
    tunnel.setAttribute('stroke-dashoffset', f2(L - clamp(headAt, 0, L)));
    // seed: falls from the sky and sinks into the bed
    const fall = inQuad(lin(q, 0.06, 0.16));
    seed.setAttribute('cy', f2(300 + (SEED_Y - 300) * fall));
    seed.setAttribute('opacity', f2(lin(q, 0.06, 0.09) * (1 - 0.35 * lin(q, 0.5, 0.6))));
    // roots + stem
    const rootP = outCubic(lin(q, 0.16, 0.34));
    roots.forEach((r, i) => r.setAttribute('stroke-dashoffset', f2(100 - 100 * clamp((rootP - i * 0.08) / 0.7))));
    const stemP = outCubic(lin(q, 0.18, 0.52));
    stem.setAttribute('stroke-dashoffset', f2(100 - 100 * stemP));
    // leaves sprout as the stem passes them; later they get eaten top-down
    LEAVES.forEach((Lf, i) => {
      const grow = backOut(lin(stemP, Lf.frac + 0.02, Lf.frac + 0.14));
      const eatAt = [0.95, 0.92, 0.89, 0.86][i];
      const gone = smooth(lin(q, eatAt, eatAt + 0.025));
      Lf.inner.setAttribute('transform', 'scale(' + f2(grow * (1 - gone)) + ')');
    });
    const bloom = backOut(lin(q, 0.52, 0.6)) * (1 - smooth(lin(q, 0.83, 0.855)));
    flowerIn.setAttribute('transform', 'scale(' + f2(bloom) + ') rotate(' + f2(q * 40) + ')');
    // chips pop in on their beat; the eaten ones fly into the sheep's mouth
    CHIPS.forEach(c => {
      const on = backOut(lin(q, c.at, c.at + 0.06));
      const gone = c.eatAt != null ? smooth(lin(q, c.eatAt, c.eatAt + 0.05)) : 0;
      c.leader.setAttribute('stroke-dashoffset', f2(100 - 100 * lin(q, c.at - 0.03, c.at + 0.04) * (1 - gone)));
      c.dotEl.setAttribute('opacity', f2(clamp(on) * (1 - gone)));
      const fx = c.cx + (MOUTH.x - c.cx) * gone, fy = c.cy + (MOUTH.y - c.cy) * gone;
      c.g.setAttribute('transform', 'translate(' + f2(fx) + ',' + f2(fy) + ') scale(' + f2(Math.max(0, on) * (1 - 0.8 * gone)) + ')');
      c.g.setAttribute('opacity', f2(clamp(on) * (1 - gone)));
    });
    // sheep: walks in from the right, then dips its head and chews
    const walk = outCubic(lin(q, 0.62, 0.8));
    const sx = 1180 + (SHEEP_X - 1180) * walk;
    const walking = q > 0.62 && q < 0.8;
    const phase = q * 95;
    const bob = walking ? -4 * Math.abs(Math.sin(phase)) : 0;
    sheep.setAttribute('transform', 'translate(' + f2(sx) + ',' + f2(GROUND + bob) + ') scale(' + (mobile ? 0.86 : 1) + ')');
    sheep.setAttribute('opacity', q > 0.6 ? 1 : 0);
    legs.forEach((l, i) => {
      const ang = walking ? (i % 2 ? -1 : 1) * 14 * Math.sin(phase) : 0;
      l.setAttribute('transform', 'translate(' + LEG_X[i] + ',-78) rotate(' + f2(ang) + ')');
    });
    const dip = smooth(lin(q, 0.8, 0.84)) * (1 - smooth(lin(q, 0.955, 0.985)));
    const chew = dip * 7 * Math.sin(q * 140);
    head.setAttribute('transform', 'rotate(' + f2(dip * 34 + chew) + ' -118 -150)');
    // closing line
    const endOn = q > 0.94;
    if (endOn !== shown) { end.classList.toggle('is-on', endOn); shown = endOn; }
  }

  function update(state) {
    const s = (state.sections || []).find(x => x.id === sectionId);
    if (!s || !s._seg) return;
    const seg = s._seg, vh = state.vh || innerHeight, y = state.y;
    if (reduce) {                                  // static diagram: no crawl, no sheep
      const inBand = y > seg.start - 0.2 * vh && y < seg.end + 0.2 * vh;
      layer.style.opacity = inBand ? 1 : 0; if (inBand) render(0.62); return;
    }
    const pr = clamp((y - seg.start) / (seg.end - seg.start));
    const q = clamp((pr - startAt) / (1 - startAt));
    const tail = y - seg.end;                       // keep the closing line readable past the seam
    const vis = (y < seg.start) ? 0 : smooth(lin(q, 0, 0.05)) * (1 - smooth(lin(tail, 0.06 * vh, 0.3 * vh)));
    layer.style.opacity = f2(vis);
    if (vis > 0.001) render(q);
  }

  return { update, layout, render, el: layer };

  // ---- helpers ----
  function el(tag, cls) { const n = document.createElement(tag); if (cls) n.className = cls; return n; }
  function svgEl(tag, attrs) { const n = document.createElementNS(NS, tag); if (attrs) for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]); return n; }
  function setAttrs(n, attrs) { for (const k in attrs) n.setAttribute(k, attrs[k]); }
}

function injectSoilCSS() {
  if (document.getElementById('je-soil-css')) return;
  const css = [
    '.je-soil{position:fixed;inset:0;z-index:25;pointer-events:none;opacity:0;will-change:opacity;}',
    '.je-soil__stage{position:absolute;left:46vw;right:3vw;top:6vh;bottom:7vh;}',
    '.je-soil__svg{width:100%;height:100%;overflow:visible;display:block;font-family:var(--sw-font-body,system-ui,sans-serif);}',
    '.je-chip__title{font-family:var(--sw-font-display,Georgia,serif);letter-spacing:-.01em;}',
    '.je-sheep{filter:drop-shadow(0 14px 22px rgba(0,0,0,.35));}',
    '.je-soil__end{position:absolute;left:0;right:0;bottom:0;text-align:center;font-family:var(--sw-font-display,Georgia,serif);font-weight:700;' +
      'font-size:clamp(1.05rem,1.55vw,1.5rem);line-height:1.2;color:#FFFEF5;opacity:0;transform:translateY(14px);' +
      'transition:opacity .45s ease,transform .55s cubic-bezier(.2,1,.3,1);text-shadow:0 2px 18px rgba(10,46,25,.85);}',
    '.je-soil__end em{display:block;font-style:normal;font-family:var(--sw-font-body,system-ui,sans-serif);font-weight:500;font-size:.74em;color:rgba(255,254,245,.74);margin-top:6px;}',
    '.je-soil__end.is-on{opacity:1;transform:none;}',
    '@media (max-width:860px){',
    '  .je-soil__stage{left:0;right:0;top:7vh;bottom:auto;height:46vh;}',
    '  .je-soil__end{bottom:-3.2em;padding:0 6vw;font-size:clamp(1rem,4.2vw,1.25rem);}',
    '}',
  ].join('\n');
  const style = document.createElement('style'); style.id = 'je-soil-css';
  style.textContent = '@layer sw {\n' + css + '\n}';
  document.head.appendChild(style);
}

if (typeof module !== 'undefined' && module.exports) module.exports = { mountSoilStory };
if (typeof window !== 'undefined') window.mountSoilStory = mountSoilStory;
