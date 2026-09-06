/* ============================================================================
   soil-story — nutrient labels for "The Living Soil" (labels-only overlay)
   ----------------------------------------------------------------------------
   The soil scene is now real footage (Kling 3.0 reshoot): the camera dives into
   the bed, an earthworm crosses, a seed germinates, the shoot rises to the
   pasture, a sheep walks in and eats the plant, and the camera dives back to the
   roots that hand off to the kitchen. This layer only adds what footage can't:
   crisp, editable text. Four nutrient chips pop in as the plant grows and are
   "eaten" with it, then a closing line lands during the final dive.

   Everything is driven by the section's CLIP TIME (seconds), taken from the
   engine's scroll→time mapping (`_seg.target`), so labels stay welded to the
   footage whatever the band length or remap. Scroll is the clock: reversible.

   USAGE
     const soil = mountSoilStory(document.getElementById('world'), {
       sectionId: 'suelo',
       duration: 38.2,           // seconds of the soil clip (desktop encode)
       beats: { ... }            // optional overrides, see BEATS below
     });
     mountScrollWorld(world, { …, onRead: (st) => soil.update(st) });
   ========================================================================== */
function mountSoilStory(container, opts) {
  opts = opts || {};
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sectionId = opts.sectionId || 'suelo';
  const DURATION = opts.duration || 38.2;
  // Clip-time beats (seconds) for the 38 s soil clip:
  //   0–5.6 dive · 5.6–15.6 worm + germination · 15.6–25.6 shoot grows, rises to the
  //   pasture, sheep walks in · 25.6–35.6 sheep eats, camera dives back · 35.6– roots.
  // `at` = chip pops in, `eat` = the sheep takes it.
  const BEATS = Object.assign({
    minerals:    { at: 12.0, eat: 30.5 },
    omega:       { at: 17.5, eat: 29.0 },
    polyphenols: { at: 20.0, eat: 27.8 },
    vitamins:    { at: 22.0, eat: 26.5 },
    end:         { at: 32.5 },
  }, opts.beats || {});

  injectSoilCSS();

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lin = (q, a, b) => clamp((q - a) / (b - a));
  const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const backOut = x => { x = clamp(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const f2 = n => (Math.round(n * 1000) / 1000).toString();

  const layer = el('div', 'je-soil');
  const rail = el('div', 'je-soil__rail');
  const CHIPS = [
    { key: 'minerals',    title: 'Minerals',        sub: 'Ca · Mg · K · P — drawn up by the roots', dot: '#FF913F' },
    { key: 'omega',       title: 'Omega-3 & fibre', sub: 'in every leaf',                            dot: '#56AAE8' },
    { key: 'polyphenols', title: 'Polyphenols',     sub: 'plant antioxidants',                       dot: '#F27E9E' },
    { key: 'vitamins',    title: 'Vitamins',        sub: 'A · C · K',                                dot: '#F8DB3F' },
  ];
  CHIPS.forEach(c => {
    c.el = el('div', 'je-chip');
    c.el.innerHTML = '<i style="background:' + c.dot + '"></i><span><strong>' + esc(c.title) + '</strong><em>' + esc(c.sub) + '</em></span>';
    rail.appendChild(c.el);
  });
  const end = el('div', 'je-soil__end');
  end.innerHTML = 'What the soil grows, the flock eats.<em>What the flock eats ends up in your broth.</em>';
  layer.appendChild(rail); layer.appendChild(end);
  container.appendChild(layer);

  let lastT = -1;
  function render(t) {
    if (t === lastT) return; lastT = t;
    CHIPS.forEach(c => {
      const b = BEATS[c.key];
      const on = backOut(lin(t, b.at, b.at + 0.9));
      const gone = b.eat != null ? smooth(lin(t, b.eat, b.eat + 1.2)) : 0;
      const s = Math.max(0, on) * (1 - 0.7 * gone);
      const o = clamp(on) * (1 - gone);
      c.el.style.opacity = f2(o);
      c.el.style.transform = 'translate3d(' + f2(14 * gone) + 'vw,' + f2(18 * (1 - clamp(on)) + 26 * gone) + 'vh,0) scale(' + f2(s) + ')';
      c.el.style.visibility = o > 0.005 ? 'visible' : 'hidden';
    });
    const e = smooth(lin(t, BEATS.end.at, BEATS.end.at + 1.4));
    end.style.opacity = f2(e);
    end.style.transform = 'translate3d(0,' + f2(16 * (1 - e)) + 'px,0)';
  }

  function update(state) {
    const s = (state.sections || []).find(x => x.id === sectionId);
    if (!s || !s._seg) return;
    const seg = s._seg, vh = state.vh || innerHeight, y = state.y;
    if (reduce) {
      const inBand = y > seg.start - 0.2 * vh && y < seg.end + 0.2 * vh;
      layer.style.opacity = inBand ? 1 : 0; if (inBand) render(24); return;
    }
    const t = clamp(seg.target, 0, 1) * DURATION;
    const tail = y - seg.end;                       // keep the closing line readable past the seam
    const vis = (y < seg.start) ? 0 : 1 - smooth(lin(tail, 0.05 * vh, 0.3 * vh));
    layer.style.opacity = f2(vis);
    if (vis > 0.001) render(t);
  }

  return { update, render, el: layer, beats: BEATS };

  function el(tag, cls) { const n = document.createElement(tag); if (cls) n.className = cls; return n; }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
}

function injectSoilCSS() {
  if (document.getElementById('je-soil-css')) return;
  const css = [
    '.je-soil{position:fixed;inset:0;z-index:25;pointer-events:none;opacity:0;will-change:opacity;font-family:var(--sw-font-body,system-ui,sans-serif);}',
    /* a row under the top bar: sits in the sky / tunnel ceiling, clear of the sheep and the plant */
    '.je-soil__rail{position:absolute;left:50%;top:clamp(84px,13vh,132px);transform:translateX(-50%);display:flex;flex-wrap:wrap;justify-content:center;gap:12px;width:min(92vw,1100px);}',
    '.je-chip{display:flex;align-items:center;gap:12px;padding:11px 20px 11px 15px;border-radius:999px;background:rgba(255,254,245,.94);color:#0A2E19;',
      'box-shadow:0 14px 40px rgba(10,46,25,.35);opacity:0;visibility:hidden;transform-origin:50% 0;will-change:transform,opacity;}',
    '.je-chip i{width:12px;height:12px;border-radius:50%;flex:none;box-shadow:0 0 0 4px rgba(10,46,25,.06);}',
    '.je-chip span{display:flex;flex-direction:column;line-height:1.15;}',
    '.je-chip strong{font-family:var(--sw-font-display,Georgia,serif);font-weight:700;font-size:clamp(.98rem,1.15vw,1.12rem);letter-spacing:-.01em;}',
    '.je-chip em{font-style:normal;font-weight:500;font-size:clamp(.74rem,.85vw,.84rem);color:rgba(10,46,25,.7);margin-top:2px;}',
    '.je-soil__end{position:absolute;left:50%;bottom:clamp(56px,9vh,110px);transform:translateX(-50%);width:min(92vw,720px);text-align:center;',
      'font-family:var(--sw-font-display,Georgia,serif);font-weight:700;font-size:clamp(1.25rem,2.2vw,2rem);line-height:1.15;color:#FFFEF5;opacity:0;',
      'text-shadow:0 2px 24px rgba(10,46,25,.9),0 0 60px rgba(10,46,25,.6);will-change:transform,opacity;}',
    '.je-soil__end em{display:block;font-style:normal;font-family:var(--sw-font-body,system-ui,sans-serif);font-weight:500;font-size:.62em;color:rgba(255,254,245,.8);margin-top:10px;}',
    '@media (max-width:860px){',
    '  .je-soil__rail{left:16px;right:16px;width:auto;top:clamp(72px,11vh,110px);transform:none;flex-direction:column;align-items:flex-start;gap:10px;}',
    '  .je-chip{padding:10px 16px 10px 12px;}',
    '  .je-soil__end{bottom:auto;top:clamp(84px,13vh,130px);width:88vw;font-size:clamp(1.15rem,5.2vw,1.5rem);}',
    '}',
  ].join('\n');
  const style = document.createElement('style'); style.id = 'je-soil-css';
  style.textContent = '@layer sw {\n' + css + '\n}';
  document.head.appendChild(style);
}

if (typeof module !== 'undefined' && module.exports) module.exports = { mountSoilStory };
if (typeof window !== 'undefined') window.mountSoilStory = mountSoilStory;
