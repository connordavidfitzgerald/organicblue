import { gsap } from "gsap";

// ── Flicker-in ─────────────────────────────────────────────────────────────
// The site's shared "loading in" language, lifted from the WebScene sprites so
// the whole interface feels like one system: elements blink on via an opacity
// keyframe ([0,1,0.4,1], a full-on → quick dip → full), ~0.2–0.24s, power1.inOut,
// swept across the layout with a small staggered wave. Restrained and archival —
// each element flickers exactly once, dips never hit a hard strobe, and
// prefers-reduced-motion opts out entirely.
//
// Two entry points:
//   • [data-flicker]      — page-body content that genuinely reloads per page;
//                           flickers in on every page load.
//   • [data-nav-flicker]  — persistent chrome (the navbar). It is NOT re-run on
//                           navigation. Instead each keyed tile is diffed against
//                           the previous page: only tiles that are newly present
//                           flicker in, and tiles whose active state flipped
//                           (grey↔black) get an in-place colour-change flicker.

const FLASH_IN = [0, 1, 0.4, 1]; // appear from nothing
const FLASH_OUT = [1, 0.35, 0.7, 0]; // blink away (mirrors the WebScene flash-out)
// Softer appear: a shallower dip (less luminance swing) over a slower ramp
// (lower flash frequency) — gentler on photosensitivity while keeping the
// flicker character. Opt in per subtree with `data-flicker-soft`.
const FLASH_IN_SOFT = [0, 1, 0.72, 1];
const FLASH_STATE = [1, 0.3, 0.8, 0.4, 1]; // in-place "this cell updated" pulse
const DUR_MIN = 0.2;
const DUR_MAX = 0.24;
const SOFT_DUR_MIN = 0.36;
const SOFT_DUR_MAX = 0.44;
const STEP = 0.04; // base stagger between elements in the wave (seconds)
const JITTER = 0.04; // per-element random offset — the "organic/digital" grain
const MAX_WAVE = 1.0; // cap on how long the whole wave takes to sweep

const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Order elements as an on-screen wave: top-to-bottom, left-to-right.
const byPosition = (els: HTMLElement[]) =>
    els
        .map((el) => ({ el, rect: el.getBoundingClientRect() }))
        .sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left)
        .map((o) => o.el);

type FlickerOpts = {
    // When true (default) the wave sweeps top-to-bottom, left-to-right by
    // on-screen position. Pass false to keep the elements' given order.
    sort?: boolean;
    // Base stagger between elements. The wave is still capped by MAX_WAVE.
    step?: number;
    // Delay (seconds) before the wave begins.
    delay?: number;
    // Optional easing across the stagger, as a GSAP ease name (e.g.
    // "power2.out"). It remaps where each element lands along the wave without
    // changing its total length: "…out" front-loads the gaps so the stagger
    // tightens as it goes, "…in" does the reverse. Omitted → even/linear (the
    // information-page look).
    ease?: string;
    // Gentler flash for photosensitivity: shallower dip, slower ramp.
    soft?: boolean;
};

// Flash a set of elements in from nothing. Elements start hidden (opacity 0,
// set here) and blink on in a staggered wave.
export function flicker(
    targets: Iterable<Element> | ArrayLike<Element>,
    { sort = true, step = STEP, delay = 0, ease, soft = false }: FlickerOpts = {},
) {
    const els = Array.from(targets).filter(
        (el): el is HTMLElement => el instanceof HTMLElement,
    );
    if (els.length === 0) return;

    if (prefersReducedMotion()) {
        els.forEach((el) => {
            el.style.opacity = "1";
        });
        return;
    }

    const ordered = sort ? byPosition(els) : els;

    const n = ordered.length;
    const s = Math.min(step, MAX_WAVE / Math.max(n - 1, 1));
    const span = s * Math.max(n - 1, 1); // total length of the wave
    const easeFn = ease ? gsap.parseEase(ease) : null;
    const keys = soft ? FLASH_IN_SOFT : FLASH_IN;
    const durMin = soft ? SOFT_DUR_MIN : DUR_MIN;
    const durMax = soft ? SOFT_DUR_MAX : DUR_MAX;

    ordered.forEach((el, i) => {
        // Position along the wave, optionally reshaped by the ease. Linear
        // (easeFn === null) collapses back to the plain i * s cadence.
        const p = n > 1 ? i / (n - 1) : 0;
        const at = easeFn ? easeFn(p) * span : i * s;
        gsap.killTweensOf(el);
        el.style.opacity = "0";
        gsap.to(el, {
            keyframes: { opacity: keys, easeEach: "power1.inOut" },
            duration: gsap.utils.random(durMin, durMax),
            delay: delay + at + Math.random() * JITTER,
            // Leave the final inline opacity (1) in place so the element stays
            // lit — clearing it would hand control back to the [data-flicker]
            // rule and blink it out again.
        });
    });
}

// Flash a set of elements out (the mirror of `flicker`) and run `onDone` once
// the whole wave has finished — used for the cart's exit, where the cards blink
// away before the panel is torn down.
export function flickerOut(
    targets: Iterable<Element> | ArrayLike<Element>,
    onDone?: () => void,
    { sort = true, step = STEP }: { sort?: boolean; step?: number } = {},
) {
    const els = Array.from(targets).filter(
        (el): el is HTMLElement => el instanceof HTMLElement,
    );
    if (els.length === 0) {
        onDone?.();
        return;
    }
    if (prefersReducedMotion()) {
        els.forEach((el) => {
            el.style.opacity = "0";
        });
        onDone?.();
        return;
    }

    const ordered = sort ? byPosition(els) : els;
    const s = Math.min(step, MAX_WAVE / Math.max(ordered.length - 1, 1));
    let remaining = ordered.length;

    ordered.forEach((el, i) => {
        gsap.killTweensOf(el);
        gsap.to(el, {
            keyframes: { opacity: FLASH_OUT, easeEach: "power1.inOut" },
            duration: gsap.utils.random(DUR_MIN, DUR_MAX),
            delay: i * s + Math.random() * JITTER,
            onComplete: () => {
                if (--remaining === 0) onDone?.();
            },
        });
    });
}

// Flicker a set of elements in, but first split them into waves by their
// resolved settings so a subtree can be tuned from one container:
//   • data-flicker-step (seconds) — spacing between elements
//   • data-flicker-ease (GSAP ease) — reshapes the stagger over time
//   • data-flicker-soft — gentler flash (photosensitivity)
// Each setting is read from the element or its nearest ancestor that sets it,
// and elements resolving to the same settings animate as one wave.
function flickerGrouped(els: HTMLElement[]) {
    const resolve = (el: HTMLElement) => ({
        step:
            el.closest<HTMLElement>("[data-flicker-step]")?.dataset
                .flickerStep ?? "",
        ease:
            el.closest<HTMLElement>("[data-flicker-ease]")?.dataset
                .flickerEase ?? "",
        soft: el.closest("[data-flicker-soft]") !== null,
    });
    const groups = new Map<
        string,
        { els: HTMLElement[]; cfg: ReturnType<typeof resolve> }
    >();
    for (const el of els) {
        const cfg = resolve(el);
        const key = `${cfg.step}|${cfg.ease}|${cfg.soft}`;
        const g = groups.get(key);
        if (g) g.els.push(el);
        else groups.set(key, { els: [el], cfg });
    }
    groups.forEach(({ els, cfg }) => {
        flicker(els, {
            step: cfg.step ? parseFloat(cfg.step) : undefined,
            ease: cfg.ease || undefined,
            soft: cfg.soft,
        });
    });
}

// In-place flicker for a tile that stays on screen but changed state (e.g. a
// nav button flipping grey↔black). It never fully disappears — a quick pulse
// that draws the eye to the swap without reading as a re-load.
function flickerState(el: HTMLElement, delay: number) {
    gsap.killTweensOf(el);
    gsap.to(el, {
        keyframes: { opacity: FLASH_STATE, easeEach: "power1.inOut" },
        duration: gsap.utils.random(DUR_MIN, DUR_MAX),
        delay,
        onComplete: () => {
            el.style.opacity = "";
        },
    });
}

// ── Navbar diff ──────────────────────────────────────────────────────────
// Persists across client-side navigations (the module is not re-executed on
// navigation, only its listeners fire), so we can compare the incoming navbar
// against the one we last saw. `key` identifies a tile; `state` is whatever we
// want to flicker on when it changes (the active grey/black state).
const navPrev = new Map<string, string>();

function navFlicker() {
    const tiles = Array.from(
        document.querySelectorAll<HTMLElement>("[data-nav-flicker]"),
    );
    const appeared: HTMLElement[] = [];
    const changed: HTMLElement[] = [];
    const next = new Map<string, string>();

    for (const el of tiles) {
        const key = el.dataset.navKey ?? "";
        const state = el.dataset.navState ?? "";
        next.set(key, state);
        if (!navPrev.has(key)) appeared.push(el);
        else if (navPrev.get(key) !== state) changed.push(el);
    }

    // Commit this frame's states before animating (idempotent: the second call
    // per navigation — page-load after after-swap — then finds nothing to do).
    navPrev.clear();
    next.forEach((v, k) => navPrev.set(k, v));

    if (prefersReducedMotion()) return;

    // Genuinely new tiles (a filter row / shop row / archive row that just
    // appeared) blink in from nothing, honouring any per-tile stagger settings.
    if (appeared.length) flickerGrouped(appeared);

    // Tiles that persisted but flipped active-state get the in-place pulse.
    changed
        .sort(
            (a, b) =>
                a.getBoundingClientRect().top - b.getBoundingClientRect().top,
        )
        .forEach((el, i) => flickerState(el, i * 0.03));
}

// Wire once, even if this module is imported by more than one page script.
declare global {
    interface Window {
        __obFlickerWired?: boolean;
    }
}

if (!window.__obFlickerWired) {
    window.__obFlickerWired = true;

    // Page-body content flickers in on first paint and every navigation.
    // navFlicker also runs here so the navbar boots up on the initial hard load
    // (astro:after-swap does not fire for that first load).
    document.addEventListener("astro:page-load", () => {
        flickerGrouped(
            Array.from(document.querySelectorAll<HTMLElement>("[data-flicker]")),
        );
        navFlicker();
        // First sweep done — release the initial-load pre-hide so persistent
        // navbar tiles stay visible on subsequent navigations.
        document.documentElement.classList.remove("nav-boot");
    });

    // On client-side navigation, diff the navbar before the browser paints the
    // new frame, so appearing tiles never flash at full opacity first.
    document.addEventListener("astro:after-swap", navFlicker);
}
