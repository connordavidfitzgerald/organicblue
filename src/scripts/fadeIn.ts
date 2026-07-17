import { gsap } from "gsap";

// ── Staggered fade-in ───────────────────────────────────────────────────────
// A plain opacity fade for the shop/archive index tiles and archive collection
// grids: each `[data-fade-in]` element fades up one after another (auto-run on
// page load). Runs through GSAP (not a CSS animation) so it shares the
// inline-opacity channel with the hover-dim tweens in hoverGallery.ts — a CSS
// animation's fill would otherwise override them and freeze the dimming. The
// sweep is tunable per-tile from the markup; see `fadeInAll` below.

const FADE_DUR = 0.6;
const FADE_STEP = 0.15; // stagger between tiles
const MAX_WAVE = 0.8; // cap on the whole sweep
// The random (archive collection) grids are denser, so they sweep a touch
// tighter — a shorter per-tile step and a shorter overall wave cap.
const FADE_STEP_RANDOM = 0.1;
const MAX_WAVE_RANDOM = 0.8;
const FADE_EASE = "power2.out";

const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const toEls = (targets: Iterable<Element> | ArrayLike<Element>) =>
    Array.from(targets).filter(
        (el): el is HTMLElement => el instanceof HTMLElement,
    );

// Order elements as an on-screen sweep: left-to-right, falling back to top for
// anything stacked (a vertical stack like the cart collapses to top-to-bottom).
const byPosition = (els: HTMLElement[]) =>
    els
        .map((el) => ({ el, rect: el.getBoundingClientRect() }))
        .sort((a, b) => a.rect.left - b.rect.left || a.rect.top - b.rect.top)
        .map((o) => o.el);

// Fisher–Yates shuffle, in place.
const shuffle = (els: HTMLElement[]) => {
    for (let i = els.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [els[i], els[j]] = [els[j], els[i]];
    }
    return els;
};

type FadeOpts = {
    // When true (default) the wave sweeps by on-screen position. Pass false to
    // keep the elements' given (DOM/reading) order.
    sort?: boolean;
    // Randomize appear order instead of sweeping by position. Overrides `sort`.
    random?: boolean;
    // Base stagger between elements (seconds). Still capped by `maxWave`.
    step?: number;
    // Cap on the whole sweep (seconds).
    maxWave?: number;
    // Delay (seconds) before the wave begins.
    delay?: number;
    // How long each element takes to fade (seconds).
    duration?: number;
    // Easing curve, as a GSAP ease name (e.g. "power2.out", "expo.inOut").
    ease?: string;
};

// Fade a set of elements in from nothing (opacity 0 → 1) in a staggered wave.
export function fadeIn(
    targets: Iterable<Element> | ArrayLike<Element>,
    {
        sort = true,
        random = false,
        step = FADE_STEP,
        maxWave = MAX_WAVE,
        delay = 0,
        duration = FADE_DUR,
        ease = FADE_EASE,
    }: FadeOpts = {},
) {
    const els = toEls(targets);
    if (els.length === 0) return;

    if (prefersReducedMotion()) {
        els.forEach((el) => {
            el.style.opacity = "1";
        });
        return;
    }

    const ordered = random
        ? shuffle([...els])
        : sort
          ? byPosition(els)
          : els;
    const s = Math.min(step, maxWave / Math.max(ordered.length - 1, 1));

    ordered.forEach((el, i) => {
        gsap.killTweensOf(el);
        el.style.opacity = "0";
        gsap.to(el, {
            opacity: 1,
            duration,
            ease,
            delay: delay + i * s,
        });
    });
}

// Auto-run for page-body tiles marked `[data-fade-in]`. The sweep can be tuned
// from the markup — set any of these on a tile or a shared ancestor (e.g. the
// stage container), and tiles resolving to the same settings animate as one
// wave:
//   • data-fade-in-step (seconds)     — stagger between tiles. An explicit value
//                                        is honoured as-is (the default cap is
//                                        only applied to the built-in step).
//   • data-fade-in-duration (seconds) — how long each tile takes to fade.
//   • data-fade-in-ease (GSAP ease)   — easing curve, e.g. "power2.out".
// Archive collection grids also opt into a random, slightly tighter sweep via a
// `[data-fade-random]` ancestor; everything else fades left-to-right.
function fadeInAll() {
    const els = Array.from(
        document.querySelectorAll<HTMLElement>("[data-fade-in]"),
    );
    if (els.length === 0) return;

    // Each override is read from the element or its nearest ancestor that sets
    // it (empty string = unset → fall back to the defaults).
    const resolve = (el: HTMLElement) => ({
        random: el.closest("[data-fade-random]") !== null,
        step:
            el.closest<HTMLElement>("[data-fade-in-step]")?.dataset.fadeInStep ??
            "",
        duration:
            el.closest<HTMLElement>("[data-fade-in-duration]")?.dataset
                .fadeInDuration ?? "",
        ease:
            el.closest<HTMLElement>("[data-fade-in-ease]")?.dataset.fadeInEase ??
            "",
    });

    const groups = new Map<
        string,
        { els: HTMLElement[]; cfg: ReturnType<typeof resolve> }
    >();
    for (const el of els) {
        const cfg = resolve(el);
        const key = `${cfg.random}|${cfg.step}|${cfg.duration}|${cfg.ease}`;
        const g = groups.get(key);
        if (g) g.els.push(el);
        else groups.set(key, { els: [el], cfg });
    }

    groups.forEach(({ els, cfg }) => {
        const hasStep = cfg.step !== "";
        fadeIn(els, {
            random: cfg.random,
            sort: !cfg.random,
            step: hasStep
                ? parseFloat(cfg.step)
                : cfg.random
                  ? FADE_STEP_RANDOM
                  : FADE_STEP,
            // An explicit step is honoured directly; the built-in step keeps the
            // cap so a big grid can't sweep for too long.
            maxWave: hasStep
                ? Infinity
                : cfg.random
                  ? MAX_WAVE_RANDOM
                  : MAX_WAVE,
            duration: cfg.duration ? parseFloat(cfg.duration) : undefined,
            ease: cfg.ease || undefined,
        });
    });
}

declare global {
    interface Window {
        __obFadeInWired?: boolean;
    }
}

if (!window.__obFadeInWired) {
    window.__obFadeInWired = true;
    document.addEventListener("astro:page-load", fadeInAll);
}
