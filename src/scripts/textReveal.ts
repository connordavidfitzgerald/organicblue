import { gsap } from "gsap";

// ── Text cascade ───────────────────────────────────────────────────────────
// A row-by-row reveal for structured copy (used on the product pages' spec
// panel): each text row rises + fades in one after another, top-to-bottom. It's
// a smooth, single-direction reveal — meant to sit *inside* a tile that has
// already flickered in, so the panel loads, then its rows cascade.
//
// Rows are the panel's own line elements (labels + values). Each row's own
// resting opacity is preserved (dimmed labels stay dimmed) by animating up to
// its natural computed opacity rather than a hard 1. The container is expected
// to be hidden until it flickers in (it carries `data-flicker` too), so the
// rows — zeroed here on page-load — never flash before their cascade.

const ROW_SELECTOR = "p, li";
const REVEAL_DUR = 0.3;
const REVEAL_STEP = 0.04; // stagger between rows
const REVEAL_DELAY = 0.4; // wait for the surrounding tile to flicker in first

const REVEAL_RISE = 25; // yPercent each row travels up into place

const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function revealAll() {
    const containers = Array.from(
        document.querySelectorAll<HTMLElement>("[data-text-reveal]"),
    );
    if (containers.length === 0) return;

    // Reduced motion: leave every row at its natural opacity, no cascade.
    if (prefersReducedMotion()) return;

    containers.forEach((container) => {
        const rows = Array.from(
            container.querySelectorAll<HTMLElement>(ROW_SELECTOR),
        );
        if (rows.length === 0) return;

        // Row-by-row: sweep top-to-bottom, left-to-right across any columns.
        rows.sort((a, b) => {
            const ra = a.getBoundingClientRect();
            const rb = b.getBoundingClientRect();
            return ra.top - rb.top || ra.left - rb.left;
        });

        const delay = Number(container.dataset.textRevealDelay ?? REVEAL_DELAY);

        rows.forEach((row, i) => {
            // Animate up to the row's own resting opacity so dimmed labels
            // (opacity-50) don't get forced to full.
            const target = parseFloat(getComputedStyle(row).opacity) || 1;
            gsap.fromTo(
                row,
                { opacity: 0 },
                {
                    opacity: target,

                    duration: REVEAL_DUR,

                    delay: delay + i * REVEAL_STEP,
                },
            );
        });
    });
}

declare global {
    interface Window {
        __obTextRevealWired?: boolean;
    }
}

if (!window.__obTextRevealWired) {
    window.__obTextRevealWired = true;
    document.addEventListener("astro:page-load", revealAll);
}
