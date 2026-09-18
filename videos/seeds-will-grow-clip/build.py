"""Generate index.html for the Seeds Will Grow audiogram.

Everything time-varying is precomputed here and inlined as JSON so the render is
deterministic: caption word timings come from transcribing the FINAL edited audio,
and the waveform is the RMS envelope of that same file at 30 fps.

    python build.py
"""
import json, pathlib, html

ROOT = pathlib.Path(__file__).parent
words = json.loads((ROOT / "assets/voice-words.json").read_text(encoding="utf-8"))
wave = json.loads((ROOT / "assets/waveform.json").read_text(encoding="utf-8"))

# ---------------------------------------------------------------- captions ----
# Split each spoken sentence into balanced lines of roughly TARGET characters,
# preferring a break after a comma, so no line is left with an orphan word.
TARGET = 27


def split_sentence(ws):
    total = len(" ".join(x["w"] for x in ws))
    n = max(1, round(total / TARGET))
    if n == 1:
        return [ws]
    ideal = total / n
    out, cur, used = [], [], 0
    for i, w in enumerate(ws):
        cur.append(w)
        used += len(w["w"]) + 1
        left = len(ws) - i - 1
        if len(out) == n - 1:
            continue                               # last line takes the remainder
        comma = w["w"].rstrip().endswith((",", ";", ":"))
        if (used >= ideal * 0.8 and comma) or used >= ideal or left <= (n - len(out) - 1):
            out.append(cur)
            cur, used = [], 0
    if cur:
        out.append(cur)
    return out


sentences, cur = [], []
for seg in words["segments"]:
    for w in seg["words"]:
        cur.append({"w": w["w"], "s": w["s"], "e": w["e"]})
        if w["w"].rstrip().endswith((".", "?", "!")):
            sentences.append(cur)
            cur = []
    if cur:
        sentences.append(cur)
        cur = []
if cur:
    sentences.append(cur)

chunks = [c for s_ in sentences for c in split_sentence(s_)]

CAPTIONS = []
for i, c in enumerate(chunks):
    start = c[0]["s"]
    # hold each chunk until the next one starts, so there is never a blank beat
    end = chunks[i + 1][0]["s"] if i + 1 < len(chunks) else c[-1]["e"] + 0.7
    CAPTIONS.append({"s": round(start, 3), "e": round(end, 3),
                     "words": [{"w": x["w"], "s": round(x["s"], 3)} for x in c]})

AUDIO_END = round(words["segments"][-1]["words"][-1]["e"], 2)
DUR = 31.0
END_CARD_AT = 26.4

# ------------------------------------------------------------------- html ----
doc = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <title>The Seeds Will Grow — trailer cut</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      @font-face {{
        font-family: 'Bricolage Grotesque';
        src: url('assets/fonts/bricolage.woff2') format('woff2');
        font-weight: 700; font-style: normal; font-display: block;
      }}
      @font-face {{
        font-family: 'Plus Jakarta Sans';
        src: url('assets/fonts/jakarta.woff2') format('woff2');
        font-weight: 500 700; font-style: normal; font-display: block;
      }}
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      body {{ background: #0A2E19; }}
      #root {{ position: relative; width: 100%; height: 100%; overflow: hidden;
        background: #0A2E19; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }}

      video.clip {{ position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }}

      /* Legibility grade: the film is warm and bright at the top, so text sits on a
         forest-green wash that deepens where the copy lives. */
      #grade {{ position: absolute; inset: 0; pointer-events: none;
        background:
          linear-gradient(180deg, rgba(10,46,25,.88) 0%, rgba(10,46,25,.18) 26%,
                          rgba(10,46,25,.30) 52%, rgba(10,46,25,.82) 78%, rgba(10,46,25,.97) 100%),
          radial-gradient(120% 70% at 50% 42%, rgba(0,0,0,0) 40%, rgba(0,0,0,.42) 100%); }}

      #brandbar {{ position: absolute; top: 96px; left: 0; right: 0; display: flex;
        flex-direction: column; align-items: center; gap: 22px; }}
      #wordmark {{ font-family: 'Bricolage Grotesque', Georgia, serif; font-weight: 700;
        font-size: 34px; letter-spacing: .34em; text-transform: uppercase; color: rgba(255,254,245,.72); }}
      #showchip {{ display: flex; align-items: center; gap: 14px; padding: 14px 30px; border-radius: 999px;
        background: rgba(255,254,245,.1); border: 2px solid rgba(255,254,245,.26); backdrop-filter: blur(6px); }}
      #showchip i {{ width: 16px; height: 16px; border-radius: 50%; background: #A5BC39;
        box-shadow: 0 0 0 6px rgba(165,188,57,.22); }}
      #showchip span {{ font-weight: 700; font-size: 30px; letter-spacing: .04em; color: #FFFEF5; }}

      #stage {{ position: absolute; left: 76px; right: 76px; bottom: 300px; }}
      #caption {{ display: flex; flex-wrap: wrap; justify-content: center; gap: 0 20px;
        font-family: 'Bricolage Grotesque', Georgia, serif; font-weight: 700;
        font-size: 82px; line-height: 1.08; letter-spacing: -.02em; color: #FFFEF5;
        text-shadow: 0 6px 34px rgba(10,46,25,.95), 0 2px 10px rgba(10,46,25,.8);
        min-height: 190px; align-items: flex-end; }}
      #caption .w {{ display: inline-block; transition: none; }}
      #caption .w.on {{ color: #F8DB3F; }}

      #wave {{ display: flex; align-items: center; justify-content: center; gap: 9px;
        height: 150px; margin-top: 54px; }}
      #wave i {{ display: block; width: 11px; border-radius: 6px; background: rgba(210,225,139,.5); }}
      #wave i.mid {{ background: #F8DB3F; }}

      #footer {{ position: absolute; left: 0; right: 0; bottom: 120px; text-align: center; }}
      #footer b {{ display: block; font-weight: 700; font-size: 32px; color: rgba(255,254,245,.92); }}
      #footer em {{ display: block; font-style: normal; font-weight: 500; font-size: 26px;
        letter-spacing: .12em; text-transform: uppercase; color: rgba(255,254,245,.5); margin-top: 12px; }}

      #endcard {{ position: absolute; inset: 0; display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 0; background: rgba(10,46,25,.93); }}
      #endcard img {{ width: 430px; height: 430px; border-radius: 34px; display: block;
        box-shadow: 0 30px 80px rgba(0,0,0,.55); }}
      #endtitle {{ font-family: 'Bricolage Grotesque', Georgia, serif; font-weight: 700;
        font-size: 84px; line-height: 1.04; color: #FFFEF5; margin-top: 56px; text-align: center;
        display: flex; flex-direction: column; }}
      #endsub {{ font-weight: 500; font-size: 30px; color: rgba(255,254,245,.66); margin-top: 22px; }}
      #endwhere {{ display: flex; gap: 16px; margin-top: 46px; }}
      #endwhere .pill {{ font-weight: 700; font-size: 27px; color: #0A2E19;
        background: #F8DB3F; padding: 16px 30px; border-radius: 999px; }}
      #endwhere .pill.ghost {{ color: #FFFEF5; background: transparent; border: 2px solid rgba(255,254,245,.4); }}
      #endsite {{ font-weight: 700; font-size: 28px; letter-spacing: .2em; text-transform: uppercase;
        color: rgba(255,254,245,.55); margin-top: 60px; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-width="1080" data-height="1920" data-duration="{DUR}">
      <video id="v1" class="clip" src="assets/finca-916.mp4" data-start="0" data-duration="10" data-track-index="0" muted playsinline></video>
      <video id="v2" class="clip" src="assets/mundo-916.mp4" data-start="9.4" data-duration="8.6" data-track-index="1" muted playsinline></video>
      <video id="v3" class="clip" src="assets/suelo-916.mp4" data-start="17.2" data-duration="13.8" data-track-index="2" muted playsinline></video>
      <audio id="vo" src="assets/voice.mp3" data-start="0" data-duration="{AUDIO_END + 1.0}" data-track-index="9" data-volume="1"></audio>

      <div id="grade"></div>

      <div id="brandbar">
        <div id="wordmark">Juntos Earth</div>
        <div id="showchip"><i></i><span>The Seeds Will Grow</span></div>
      </div>

      <div id="stage">
        <div id="caption"></div>
        <div id="wave"></div>
      </div>

      <div id="footer">
        <b>Hosted by Finn Harries</b>
        <em>New episodes every Wednesday</em>
      </div>

      <section id="endcard" class="clip" data-start="{END_CARD_AT}" data-duration="{DUR - END_CARD_AT}" data-track-index="5">
        <img id="endart" src="assets/cover.jpg" alt="" />
        <div id="endtitle"><span>The Seeds</span><span>Will Grow</span></div>
        <div id="endsub">A podcast from the farm in Ibiza</div>
        <div id="endwhere"><span class="pill">Spotify</span><span class="pill ghost">Apple Podcasts</span></div>
        <div id="endsite">juntosearth.com</div>
      </section>
    </div>

    <script>
      const CAPTIONS = {json.dumps(CAPTIONS)};
      const WAVE = {json.dumps(wave["values"])};
      const WAVE_FPS = {wave["fps"]};
      const BARS = 44, HALF = 22;

      const capEl = document.getElementById("caption");
      const waveEl = document.getElementById("wave");
      const bars = [];
      for (let i = 0; i < BARS; i++) {{
        const b = document.createElement("i");
        if (i === HALF) b.className = "mid";
        waveEl.appendChild(b);
        bars.push(b);
      }}

      let shown = -1, spans = [];
      function paintChunk(idx) {{
        if (idx === shown) return;
        shown = idx;
        capEl.textContent = "";
        spans = [];
        if (idx < 0) return;
        for (const w of CAPTIONS[idx].words) {{
          const s = document.createElement("span");
          s.className = "w";
          s.textContent = w.w;
          capEl.appendChild(s);
          spans.push(s);
        }}
      }}

      // Pure function of timeline time: same frame in preview, snapshot and render.
      function draw() {{
        const t = tl.time();

        let idx = -1;
        for (let i = 0; i < CAPTIONS.length; i++) {{
          if (t >= CAPTIONS[i].s && t < CAPTIONS[i].e) {{ idx = i; break; }}
        }}
        paintChunk(idx);

        if (idx >= 0) {{
          const c = CAPTIONS[idx];
          const rise = Math.min(1, (t - c.s) / 0.22);
          const ease = 1 - Math.pow(1 - rise, 3);
          capEl.style.opacity = ease.toFixed(3);
          capEl.style.transform = "translateY(" + ((1 - ease) * 26).toFixed(1) + "px)";
          for (let i = 0; i < spans.length; i++) {{
            const on = t >= c.words[i].s;
            if (spans[i].classList.contains("on") !== on) spans[i].classList.toggle("on", on);
          }}
        }} else {{
          capEl.style.opacity = "0";
        }}

        const f = Math.round(t * WAVE_FPS);
        for (let i = 0; i < BARS; i++) {{
          const k = f - HALF + i;
          const v = (k >= 0 && k < WAVE.length) ? WAVE[k] : 0;
          const h = 8 + v * 132;
          bars[i].style.height = h.toFixed(1) + "px";
          bars[i].style.opacity = (0.34 + v * 0.66).toFixed(3);
        }}
      }}

      const tl = gsap.timeline({{ paused: true, onUpdate: draw }});

      // background crossfades
      tl.fromTo("#v2", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.7, ease: "power1.inOut" }}, 9.4);
      tl.fromTo("#v3", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.7, ease: "power1.inOut" }}, 17.2);

      // chrome in, and out before the end card
      tl.fromTo("#brandbar", {{ opacity: 0, y: -22 }}, {{ opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }}, 0.15);
      tl.fromTo("#footer", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.8, ease: "power2.out" }}, 0.5);
      tl.to("#brandbar", {{ opacity: 0, duration: 0.5, ease: "power2.in" }}, {END_CARD_AT} - 0.5);
      tl.to("#footer", {{ opacity: 0, duration: 0.5, ease: "power2.in" }}, {END_CARD_AT} - 0.5);
      tl.to("#stage", {{ opacity: 0, duration: 0.5, ease: "power2.in" }}, {END_CARD_AT} - 0.5);

      // end card
      tl.fromTo("#endcard", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.55, ease: "power2.out" }}, {END_CARD_AT});
      tl.fromTo("#endart", {{ scale: 0.9, opacity: 0 }}, {{ scale: 1, opacity: 1, duration: 0.7, ease: "back.out(1.4)" }}, {END_CARD_AT} + 0.1);
      tl.fromTo("#endtitle", {{ y: 30, opacity: 0 }}, {{ y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }}, {END_CARD_AT} + 0.3);
      tl.fromTo("#endsub", {{ y: 20, opacity: 0 }}, {{ y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }}, {END_CARD_AT} + 0.45);
      tl.fromTo("#endwhere", {{ y: 20, opacity: 0 }}, {{ y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }}, {END_CARD_AT} + 0.6);
      tl.fromTo("#endsite", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.5, ease: "power2.out" }}, {END_CARD_AT} + 0.85);

      // keep the timeline alive to the full length so draw() runs on every frame
      tl.to({{}}, {{ duration: {DUR} }}, 0);

      window.__timelines["main"] = tl;
      tl.seek(0);
      draw();
    </script>
  </body>
</html>
"""

(ROOT / "index.html").write_text(doc, encoding="utf-8", newline="\n")
print(f"index.html written · {len(CAPTIONS)} caption chunks · audio ends {AUDIO_END}s · duration {DUR}s")
for c in CAPTIONS:
    print(f"  {c['s']:6.2f}-{c['e']:6.2f}  {' '.join(w['w'] for w in c['words'])}")
