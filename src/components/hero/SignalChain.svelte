<script lang="ts">
  import { onMount } from "svelte"
  import { canAnimate, refreshTriggers, registerGsap, ScrollTrigger } from "../../lib/motion/scroll"

  /**
   * Featured reviews as patch-bay modules strung together with cables,
   * travelling horizontally as the reader scrolls vertically.
   *
   * Three modes, decided at runtime:
   *   pinned   — desktop with motion allowed: ScrollTrigger pins and translates
   *   carousel — under 768px: native horizontal snap scrolling, no pinning,
   *              because hijacking touch scroll to fake it feels broken
   *   list     — reduced motion: a plain vertical list, no pinning at all
   *
   * SSR renders `list`, so the markup works before and without JS.
   */

  interface ChainPost {
    slug: string
    title: string
    brand: string | null
    productName: string | null
    rating: number | null
    productType: string | null
  }

  let { posts }: { posts: ChainPost[] } = $props()

  // Module geometry is fixed rather than measured, so the server-rendered cable
  // paths match what the client computes.
  const MODULE_W = 340
  const GAP = 72
  const RAIL_H = 320

  const trackWidth = $derived(
    posts.length > 0 ? posts.length * MODULE_W + (posts.length - 1) * GAP : 0
  )

  let section: HTMLElement | null = $state(null)
  let pin: HTMLElement | null = $state(null)
  let track: HTMLElement | null = $state(null)
  let mode = $state<"list" | "carousel" | "pinned">("list")
  let sag = $state(0)

  /** Cable control points between consecutive modules. */
  const cables = $derived(
    Array.from({ length: Math.max(0, posts.length - 1) }, (_, i) => {
      const x1 = i * (MODULE_W + GAP) + MODULE_W
      const x2 = (i + 1) * (MODULE_W + GAP)
      const y = RAIL_H / 2
      const dx = (x2 - x1) * 0.45
      // Cables droop when slack and straighten as the reader pulls through.
      const droop = 26 - sag * 22
      return `M${x1},${y} C${x1 + dx},${y + droop} ${x2 - dx},${y + droop} ${x2},${y}`
    })
  )

  function pickMode(): "list" | "carousel" | "pinned" {
    if (!canAnimate()) return "list"
    return window.innerWidth < 768 ? "carousel" : "pinned"
  }

  onMount(() => {
    if (posts.length === 0) return

    let trigger: ScrollTrigger | null = null

    const teardown = () => {
      trigger?.kill()
      trigger = null
      sag = 0
    }

    const build = () => {
      teardown()
      mode = pickMode()

      if (mode !== "pinned" || !section || !pin || !track) return

      const gsap = registerGsap()
      const distance = trackWidth - window.innerWidth + 96

      // Nothing to travel: leave it as a static row rather than pinning for 0px.
      if (distance <= 0) {
        mode = "carousel"
        return
      }

      const tween = gsap.to(track, {
        x: -distance,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: () => `+=${distance}`,
          pin: pin,
          scrub: true,
          invalidateOnRefresh: true,
          anticipatePin: 1,
          onUpdate: (self) => {
            sag = self.progress
          },
        },
      })

      trigger = tween.scrollTrigger ?? null
    }

    build()

    // Rebuild across breakpoint and reduced-motion changes, debounced so a
    // dragged window edge does not thrash ScrollTrigger.
    let resizeTimer: number | null = null
    const onResize = () => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => {
        build()
        refreshTriggers()
      }, 180)
    }

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    motionQuery.addEventListener("change", build)
    window.addEventListener("resize", onResize)

    return () => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer)
      motionQuery.removeEventListener("change", build)
      window.removeEventListener("resize", onResize)
      teardown()
    }
  })
</script>

{#if posts.length > 0}
  <section class="chain" data-mode={mode} bind:this={section} aria-labelledby="chain-heading">
    <div class="pin" bind:this={pin}>
      <div class="shell chain-head">
        <h2 id="chain-heading" class="label">Featured · signal chain</h2>
      </div>

      <div class="rail">
        <div
          class="track"
          bind:this={track}
          style:--track-width={`${trackWidth}px`}
          style:--module-w={`${MODULE_W}px`}
          style:--gap={`${GAP}px`}
          style:--rail-h={`${RAIL_H}px`}
        >
          {#if mode === "pinned"}
            <svg
              class="cables"
              width={trackWidth}
              height={RAIL_H}
              viewBox={`0 0 ${trackWidth} ${RAIL_H}`}
              aria-hidden="true"
            >
              {#each cables as d}
                <path {d} />
              {/each}
            </svg>
          {/if}

          {#each posts as post (post.slug)}
            <article class="module bezel" class:console={post.productType === "Game"}>
              <div class="jacks" aria-hidden="true">
                <span class="jack"></span>
                <span class="jack"></span>
              </div>

              <a class="module-link" href={`/reviews/${post.slug}`}>
                {#if post.brand || post.productName}
                  <span class="label module-overline">
                    {[post.brand, post.productName].filter(Boolean).join(" · ")}
                  </span>
                {/if}
                <h3 class="module-title">{post.title}</h3>
              </a>

              {#if post.rating !== null}
                <div class="module-meter">
                  <span class="numeral module-score">{post.rating}</span>
                  <span class="scale" aria-hidden="true">
                    {#each Array.from({ length: 10 }) as _, i}
                      <span class="seg" class:on={i < Math.ceil(post.rating / 10)}></span>
                    {/each}
                  </span>
                  <span class="visually-hidden">out of 100</span>
                </div>
              {/if}
            </article>
          {/each}
        </div>
      </div>
    </div>
  </section>
{/if}

<style>
  .chain {
    position: relative;
    background: var(--color-ground);
    border-block: 1px solid var(--color-panel-edge);
  }

  .pin {
    padding-block: 3rem;
  }

  .chain-head {
    margin-bottom: 1.5rem;
  }

  .chain-head .label {
    color: var(--color-signal);
  }

  .rail {
    position: relative;
  }

  .track {
    position: relative;
    display: flex;
    gap: var(--gap);
    padding-inline: 1.25rem;
  }

  .cables {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
  }

  .cables path {
    fill: none;
    stroke: var(--color-signal-dim);
    stroke-width: 3;
    stroke-linecap: round;
  }

  .module {
    position: relative;
    flex: 0 0 var(--module-w);
    min-height: var(--rail-h);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1.125rem;
    border-radius: var(--radius-lg);
    background: var(--color-panel);
  }

  .jacks {
    display: flex;
    justify-content: space-between;
  }

  .jack {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--color-ground);
    box-shadow:
      inset 0 0 0 2px var(--color-panel-edge),
      inset 0 1px 2px rgb(0 0 0 / 0.6);
  }

  .module-link {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    text-decoration: none;
    color: var(--color-text);
  }

  .module-link:hover,
  .module-link:focus-visible {
    color: var(--color-signal);
  }

  .console .module-link:hover,
  .console .module-link:focus-visible {
    color: var(--color-phosphor);
  }

  .module-overline {
    color: var(--color-text-muted);
  }

  .module-title {
    font-family: var(--font-display);
    font-size: var(--text-h3);
    line-height: 1.25;
  }

  .module-meter {
    margin-top: auto;
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .module-score {
    font-size: 1.5rem;
    color: var(--color-text);
  }

  .scale {
    display: flex;
    gap: 2px;
    align-items: flex-end;
  }

  .seg {
    width: 4px;
    height: 14px;
    border-radius: 1px;
    background: var(--color-panel-edge);
  }

  .seg.on {
    background: var(--color-signal);
  }

  .console .seg.on {
    background: var(--color-phosphor);
  }

  /* ── carousel: native horizontal scrolling, no pinning ─────────────────── */
  .chain[data-mode="carousel"] .rail {
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
  }

  .chain[data-mode="carousel"] .module {
    scroll-snap-align: center;
    flex-basis: min(var(--module-w), 78vw);
  }

  /* ── list: reduced motion, and the server-rendered default ─────────────── */
  .chain[data-mode="list"] .track {
    flex-direction: column;
    gap: 1.25rem;
    max-width: var(--max-w-shell);
    margin-inline: auto;
  }

  .chain[data-mode="list"] .module {
    flex-basis: auto;
    min-height: 0;
    width: 100%;
  }

  .chain[data-mode="list"] .jacks {
    display: none;
  }
</style>
