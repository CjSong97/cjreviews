<script lang="ts">
  import { onMount } from "svelte"
  import { canAnimate, registerGsap } from "../../lib/motion/scroll"

  /**
   * Rating as a VU meter: the needle swings to the score with a slight spring
   * overshoot when it enters the viewport.
   *
   * The numeral stays in the DOM as text and the needle is rendered at its final
   * angle on the server, so the rating never depends on the animation — or on
   * JavaScript — to be readable (DESIGN.md §3.5, §6.4).
   */

  let { rating }: { rating: number } = $props()

  const clamped = Math.max(0, Math.min(100, rating))

  // Sweep spans 120°, centred on vertical.
  const SWEEP = 120
  const MIN_ANGLE = -SWEEP / 2
  const finalAngle = MIN_ANGLE + (clamped / 100) * SWEEP

  const ticks = [0, 20, 40, 60, 80, 100]
  const tier = clamped >= 80 ? "high" : clamped >= 60 ? "mid" : "low"

  let needle: SVGGElement | null = $state(null)
  let root: HTMLElement | null = $state(null)

  function arcPoint(angleDeg: number, radius: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180
    return { x: 60 + radius * Math.cos(rad), y: 62 + radius * Math.sin(rad) }
  }

  onMount(() => {
    if (!canAnimate() || !needle || !root) return

    const gsap = registerGsap()
    const target = needle

    const observer = new IntersectionObserver(
      ([entry], obs) => {
        if (!entry.isIntersecting) return
        obs.disconnect()

        gsap.fromTo(
          target,
          { rotation: MIN_ANGLE - 4, transformOrigin: "60px 62px" },
          {
            rotation: finalAngle,
            transformOrigin: "60px 62px",
            duration: 1.1,
            // Overshoot then settle, the way a real meter needle behaves.
            ease: "back.out(1.9)",
          }
        )
      },
      { threshold: 0.4 }
    )

    observer.observe(root)
    return () => observer.disconnect()
  })
</script>

<div class="vu {tier}" bind:this={root}>
  <svg viewBox="0 0 120 76" role="img" aria-label={`Rated ${clamped} out of 100`}>
    <!-- Scale arc -->
    <path
      d={`M${arcPoint(MIN_ANGLE, 44).x},${arcPoint(MIN_ANGLE, 44).y} A44,44 0 0 1 ${arcPoint(-MIN_ANGLE, 44).x},${arcPoint(-MIN_ANGLE, 44).y}`}
      class="arc"
    />

    {#each ticks as tick}
      {@const angle = MIN_ANGLE + (tick / 100) * SWEEP}
      {@const outer = arcPoint(angle, 44)}
      {@const inner = arcPoint(angle, 37)}
      <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} class="tick" />
    {/each}

    <!-- Rendered at the final angle: correct without JS. -->
    <g bind:this={needle} transform={`rotate(${finalAngle} 60 62)`}>
      <line x1="60" y1="62" x2="60" y2="20" class="needle" />
    </g>

    <circle cx="60" cy="62" r="4" class="hub" />
  </svg>

  <p class="value">
    <span class="numeral score">{clamped}</span><span class="of">/100</span>
  </p>
</div>

<style>
  .vu {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.125rem;
    width: 6.5rem;
  }

  svg {
    width: 100%;
    height: auto;
    overflow: visible;
  }

  .arc {
    fill: none;
    stroke: var(--color-panel-edge);
    stroke-width: 2;
    stroke-linecap: round;
  }

  .tick {
    stroke: var(--color-panel-edge);
    stroke-width: 1.5;
    stroke-linecap: round;
  }

  .needle {
    stroke-width: 2;
    stroke-linecap: round;
  }

  .hub {
    fill: var(--color-panel-edge);
  }

  /* Tier colours the needle, but the numeral below carries the same
     information as text. */
  .high .needle {
    stroke: var(--color-phosphor);
  }

  .mid .needle {
    stroke: var(--color-signal);
  }

  .low .needle {
    stroke: var(--color-alert);
  }

  .value {
    display: flex;
    align-items: baseline;
    gap: 0.0625rem;
  }

  .score {
    font-size: 1.375rem;
    font-weight: 500;
    color: var(--color-text);
    line-height: 1;
  }

  .of {
    font-family: var(--font-mono);
    font-size: 0.625rem;
    color: var(--color-text-muted);
  }
</style>
