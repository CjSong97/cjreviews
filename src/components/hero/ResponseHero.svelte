<script lang="ts">
  import { onMount } from "svelte"
  import {
    DB_LIMIT,
    catmullRomPath,
    dbAtHz,
    dbToUnit,
    generateCurve,
    hzToUnit,
    lerpCurves,
    decorativeTrace,
    isAuthored,
    TRACE_LABELS,
    unitToHz,
    type CurvePoint,
    type TuningInput,
  } from "../../lib/audio/curve"
  import { canAnimate } from "../../lib/motion/scroll"

  /**
   * The signature moment: a frequency-response graticule whose trace morphs
   * between featured reviews as the reader scrolls.
   *
   * The markup this component server-renders — graticule, headline, readout and
   * a static SVG trace — is also the no-JS and reduced-motion experience. The
   * canvas only ever paints *over* a page that already works (DESIGN.md §6.4).
   */

  interface HeroPost {
    slug: string
    title: string
    brand: string | null
    productName: string | null
    rating: number | null
    price: number | null
    /** null when CJ has not authored a tuning signature for this review. */
    tuning: TuningInput | null
  }

  let { posts }: { posts: HeroPost[] } = $props()

  const VIEWBOX_W = 1000
  const VIEWBOX_H = 420

  /*
   * Authored signatures are used where they exist; otherwise the trace is
   * decorative and must be labelled as such. Claiming CJ authored a hash would
   * be a false statement about the review (DESIGN.md §8).
   */
  const curves = posts.map((p) =>
    generateCurve(isAuthored(p.tuning) ? p.tuning : decorativeTrace(p.slug, p.rating))
  )

  function toXY(curve: CurvePoint[]) {
    return curve.map((point) => ({
      x: hzToUnit(point.hz) * VIEWBOX_W,
      y: dbToUnit(point.db) * VIEWBOX_H,
    }))
  }

  /** Decade rules for the log axis, plus the dB grid. */
  const freqTicks = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000]
  const dbTicks = [-12, -6, 0, 6, 12]

  const staticPath = curves.length > 0 ? catmullRomPath(toXY(curves[0])) : ""

  let canvas: HTMLCanvasElement | null = $state(null)
  let section: HTMLElement | null = $state(null)
  let live = $state(false)

  // Morph position through the featured set, as a float: 1.4 means 40% of the
  // way from post 1 to post 2.
  let position = $state(0)
  let pointer = $state<{ x: number; y: number } | null>(null)

  const index = $derived(Math.min(posts.length - 1, Math.max(0, Math.round(position))))
  const current = $derived(posts[index])

  const readout = $derived.by(() => {
    if (!pointer || curves.length === 0) return null
    const hz = unitToHz(pointer.x)
    const curve = currentCurve()
    return { hz, db: dbAtHz(curve, hz) }
  })

  function currentCurve(): CurvePoint[] {
    if (curves.length === 0) return []
    if (curves.length === 1) return curves[0]
    const lower = Math.floor(position)
    const upper = Math.min(curves.length - 1, lower + 1)
    return lerpCurves(curves[lower], curves[upper], position - lower)
  }

  onMount(() => {
    if (!canAnimate()) return // reduced motion keeps the static SVG trace

    // canvas is bound by now: it is always in the DOM, never behind an {#if}.
    const ctx = canvas?.getContext("2d")
    if (!ctx || !canvas) return

    let width = 0
    let height = 0
    let visible = true
    let frame: number | null = null
    let pointerTarget: { x: number; y: number } | null = null
    let bump = 0 // eased cursor-bump amplitude

    const resize = () => {
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      // Cap DPR at 2: beyond that the pixel cost buys nothing visible.
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const style = getComputedStyle(document.documentElement)
    const signal = style.getPropertyValue("--color-signal").trim() || "#ffb627"

    const draw = () => {
      frame = null
      if (!visible || width === 0) return

      ctx.clearRect(0, 0, width, height)

      const curve = currentCurve()
      if (curve.length === 0) return

      // Ease the cursor bump toward its target so it trails the pointer.
      bump += ((pointerTarget ? 1 : 0) - bump) * 0.12
      pointer = pointerTarget

      const points = curve.map((point) => {
        let db = point.db

        if (pointerTarget && bump > 0.001) {
          // A local Gaussian centred on the pointer: a resonance you drag.
          const distance = hzToUnit(point.hz) - pointerTarget.x
          const lift = Math.exp(-0.5 * Math.pow(distance / 0.06, 2))
          const towards = (0.5 - pointerTarget.y) * DB_LIMIT * 0.9 - db
          db += towards * lift * bump
        }

        return {
          x: hzToUnit(point.hz) * width,
          y: dbToUnit(db) * height,
        }
      })

      const path = new Path2D(catmullRomPath(points))

      // Outer glow, then the crisp trace on top.
      ctx.save()
      ctx.strokeStyle = signal
      ctx.globalAlpha = 0.18
      ctx.lineWidth = 10
      ctx.shadowColor = signal
      ctx.shadowBlur = 24
      ctx.stroke(path)
      ctx.restore()

      ctx.save()
      ctx.strokeStyle = signal
      ctx.lineWidth = 2
      ctx.lineJoin = "round"
      ctx.stroke(path)
      ctx.restore()

      if (pointerTarget) {
        const hz = unitToHz(pointerTarget.x)
        const x = hzToUnit(hz) * width
        const y = points.reduce((best, p) => (Math.abs(p.x - x) < Math.abs(best.x - x) ? p : best)).y

        ctx.save()
        ctx.fillStyle = signal
        ctx.shadowColor = signal
        ctx.shadowBlur = 12
        ctx.beginPath()
        ctx.arc(x, y, 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      // Only now has the canvas actually painted, so the static SVG can stand
      // down. Had setup failed above we would never reach here and the SVG would
      // stay up — a degraded hero rather than a blank one.
      live = true

      // Keep animating while the bump is still settling.
      if (bump > 0.001 && !pointerTarget) schedule()
    }

    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(draw)
    }

    // Pointer events only set state; painting happens on the next frame, so
    // moving the mouse cannot outpace the renderer.
    const onPointerMove = (event: PointerEvent) => {
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      pointerTarget = {
        x: (event.clientX - rect.left) / rect.width,
        y: (event.clientY - rect.top) / rect.height,
      }
      schedule()
    }

    const onPointerLeave = () => {
      pointerTarget = null
      schedule()
    }

    const onScroll = () => {
      if (!section || posts.length < 2) return
      const rect = section.getBoundingClientRect()
      const travel = rect.height - window.innerHeight
      if (travel <= 0) return
      const progress = Math.min(1, Math.max(0, -rect.top / travel))
      position = progress * (posts.length - 1)
      schedule()
    }

    // Pause entirely when the hero is offscreen rather than burning frames.
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
        if (visible) schedule()
      },
      { threshold: 0 }
    )
    if (section) observer.observe(section)

    const resizeObserver = new ResizeObserver(() => {
      resize()
      schedule()
    })
    if (canvas) resizeObserver.observe(canvas)

    resize()
    schedule()

    canvas.addEventListener("pointermove", onPointerMove)
    canvas.addEventListener("pointerleave", onPointerLeave)
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()

    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
      observer.disconnect()
      resizeObserver.disconnect()
      canvas?.removeEventListener("pointermove", onPointerMove)
      canvas?.removeEventListener("pointerleave", onPointerLeave)
      window.removeEventListener("scroll", onScroll)
    }
  })

  const overline = $derived(
    current ? [current.brand, current.productName].filter(Boolean).join(" · ") : ""
  )

  /*
    * Scroll distance for the morph. Kept deliberately modest: this is a blog,
    * and making the reader scroll three screens of hero before reaching a single
    * review would be hostile however good the animation is.
    */
  const stageHeight = $derived(
    posts.length > 1 ? `calc(100vh + ${(posts.length - 1) * 45}vh)` : "100vh"
  )
</script>

<section
  class="stage"
  data-surface="screen"
  style:--stage-height={stageHeight}
  bind:this={section}
  aria-labelledby="hero-heading"
>
  <div class="viewport">
    <!-- Graticule is SVG, not canvas: it never changes, so it costs no frames
         and stays crisp at any DPR. -->
    <svg
      class="graticule"
      viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {#each freqTicks as hz}
        <line x1={hzToUnit(hz) * VIEWBOX_W} y1="0" x2={hzToUnit(hz) * VIEWBOX_W} y2={VIEWBOX_H} />
      {/each}
      {#each dbTicks as db}
        <line x1="0" y1={dbToUnit(db) * VIEWBOX_H} x2={VIEWBOX_W} y2={dbToUnit(db) * VIEWBOX_H} />
      {/each}
    </svg>

    <!-- The static trace: the whole experience without JS, and the reduced-motion
         experience with it. Hidden only once the canvas is actually painting. -->
    <svg
      class="trace-static"
      class:hidden={live}
      viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={staticPath} />
    </svg>

    <!-- Never behind an {#if}: setting a flag does not flush the DOM, so a
         conditional canvas would leave bind:this null throughout onMount. -->
    <canvas class="trace" bind:this={canvas}></canvas>

    <div class="axis" aria-hidden="true">
      {#each freqTicks as hz}
        <span class="axis-tick numeral" style:left={`${hzToUnit(hz) * 100}%`}>
          {hz >= 1000 ? `${hz / 1000}k` : hz}
        </span>
      {/each}
    </div>

    <div class="shell content">
      <p class="label channel">Signal · in</p>
      <h1 id="hero-heading" class="hero-title">
        Honest reviews of<br /><span class="accent">what you listen with</span>
      </h1>

      {#if current}
        <div class="now-playing">
          <p class="label np-label">Now showing</p>
          {#key current.slug}
            <a class="np-link" href={`/reviews/${current.slug}`}>
              {#if overline}<span class="label np-overline">{overline}</span>{/if}
              <span class="np-title">{current.title}</span>
            </a>
          {/key}
          <div class="np-meta">
            {#if current.rating !== null}
              <span class="numeral np-rating">{current.rating}<span class="np-of">/100</span></span>
            {/if}
            {#if current.price !== null}
              <span class="numeral np-price">£{current.price}</span>
            {/if}
          </div>
        </div>
      {/if}

      <p class="label honesty">
        {current && isAuthored(current.tuning) ? TRACE_LABELS.authored : TRACE_LABELS.decorative}
      </p>
    </div>

    {#if readout}
      <output class="readout" aria-live="off">
        <span class="numeral">{Math.round(readout.hz)}</span><span class="unit">Hz</span>
        <span class="numeral db">{readout.db >= 0 ? "+" : ""}{readout.db.toFixed(1)}</span><span
          class="unit">dB</span
        >
      </output>
    {/if}

    <div class="vignette" aria-hidden="true"></div>
  </div>
</section>

<style>
  .stage {
    position: relative;
    height: var(--stage-height, 100vh);
  }

  .viewport {
    position: sticky;
    top: 0;
    height: 100vh;
    overflow: hidden;
    display: flex;
    align-items: center;
    background: var(--color-ground);
  }

  .graticule,
  .trace-static,
  .trace {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .graticule line {
    stroke: var(--color-panel-edge);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  .trace-static path {
    fill: none;
    stroke: var(--color-signal);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
    filter: drop-shadow(0 0 6px var(--color-signal));
  }

  .trace-static.hidden {
    display: none;
  }

  .trace {
    touch-action: pan-y;
  }

  .axis {
    position: absolute;
    inset-inline: 0;
    bottom: 0.5rem;
    height: 1rem;
    pointer-events: none;
  }

  .axis-tick {
    position: absolute;
    transform: translateX(-50%);
    font-size: 0.625rem;
    color: var(--color-text-muted);
  }

  .content {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.875rem;
    pointer-events: none;
  }

  /* The content sits above the canvas, so re-enable hits only on real links. */
  .content a {
    pointer-events: auto;
  }

  .channel {
    color: var(--color-signal);
  }

  .hero-title {
    font-family: var(--font-display);
    font-size: var(--text-hero);
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--color-text);
  }

  .accent {
    color: var(--color-signal);
  }

  .now-playing {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.75rem 1rem;
    border-radius: var(--radius);
    background: color-mix(in srgb, var(--color-panel) 70%, transparent);
    box-shadow: inset 0 0 0 1px var(--color-panel-edge);
    min-width: min(100%, 22rem);
  }

  .np-label {
    color: var(--color-signal);
  }

  .np-link {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    text-decoration: none;
    color: var(--color-text);
    /* Cross-fade as the morph advances; keyed on slug so it replays per post. */
    animation: fade-in var(--duration-morph) var(--ease-instrument) both;
  }

  .np-link:hover,
  .np-link:focus-visible {
    color: var(--color-signal);
  }

  .np-overline {
    color: var(--color-text-muted);
  }

  .np-title {
    font-family: var(--font-display);
    font-size: 1.125rem;
    font-weight: 600;
  }

  .np-meta {
    display: flex;
    align-items: baseline;
    gap: 0.875rem;
    font-size: var(--text-small);
    color: var(--color-text-muted);
  }

  .np-rating {
    color: var(--color-text);
  }

  .np-of {
    color: var(--color-text-muted);
  }

  .honesty {
    max-width: 44ch;
    color: var(--color-text-muted);
    text-transform: none;
    letter-spacing: 0.02em;
  }

  .readout {
    position: absolute;
    top: 1rem;
    right: 1.25rem;
    z-index: 2;
    display: flex;
    align-items: baseline;
    gap: 0.25rem;
    padding: 0.375rem 0.625rem;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--color-panel) 80%, transparent);
    box-shadow: inset 0 0 0 1px var(--color-panel-edge);
    font-size: var(--text-small);
    color: var(--color-signal);
    pointer-events: none;
  }

  .readout .unit {
    font-family: var(--font-mono);
    font-size: 0.625rem;
    color: var(--color-text-muted);
    margin-right: 0.375rem;
  }

  .readout .db {
    color: var(--color-text);
  }

  /* CRT falloff at the edges of the screen. */
  .vignette {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(120% 90% at 50% 45%, transparent 55%, rgb(0 0 0 / 0.55) 100%);
  }

  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .stage {
      /* No scroll distance to reserve when nothing morphs. */
      height: 100vh;
    }

    .np-link {
      animation: none;
    }
  }

  @media (max-width: 640px) {
    .stage {
      height: 100vh;
    }

    .now-playing {
      min-width: 0;
    }

    .readout {
      display: none;
    }
  }
</style>
