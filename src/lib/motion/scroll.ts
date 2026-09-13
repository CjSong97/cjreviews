import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import Lenis from "lenis"

/**
 * The single place GSAP plugins and Lenis are configured.
 *
 * Components must not register plugins themselves (agent-os/product/decisions.md
 * → Motion Stack), so that the reduced-motion guard below cannot be bypassed by
 * a component that forgets it.
 */

let registered = false
let lenis: Lenis | null = null
let rafId: number | null = null

/**
 * Whether scroll-driven motion is permitted.
 *
 * Checked at call time, not cached, so a reader toggling the OS setting mid-visit
 * is respected on the next navigation. Returns false during SSR.
 */
export function canAnimate(): boolean {
  if (typeof window === "undefined") return false
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/** Registers GSAP plugins exactly once. */
export function registerGsap(): typeof gsap {
  if (!registered) {
    gsap.registerPlugin(ScrollTrigger)
    registered = true
  }
  return gsap
}

/**
 * Starts Lenis smooth scrolling and drives ScrollTrigger from it.
 *
 * No-ops under reduced motion: hijacking scroll is exactly what that setting
 * asks us not to do.
 */
export function startSmoothScroll(): Lenis | null {
  if (!canAnimate()) return null
  if (lenis) return lenis

  registerGsap()

  lenis = new Lenis({
    duration: 1.05,
    smoothWheel: true,
    // Touch scrolling stays native: overriding it on mobile feels broken and
    // costs us the platform's own momentum behaviour.
    syncTouch: false,
  })

  lenis.on("scroll", ScrollTrigger.update)

  const raf = (time: number) => {
    lenis?.raf(time)
    rafId = requestAnimationFrame(raf)
  }
  rafId = requestAnimationFrame(raf)

  return lenis
}

/**
 * Tears down smooth scrolling and every ScrollTrigger.
 *
 * Required for view transitions: without it, triggers from the previous page
 * survive the swap and pin elements that no longer exist.
 */
export function stopSmoothScroll(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }

  lenis?.destroy()
  lenis = null

  if (registered) {
    ScrollTrigger.getAll().forEach((t) => t.kill())
  }
}

/** Recomputes trigger positions after layout changes (fonts, images, swaps). */
export function refreshTriggers(): void {
  if (registered) ScrollTrigger.refresh()
}

export { ScrollTrigger, gsap }
