import { gsap } from "gsap";

// ── Hover gallery ──────────────────────────────────────────────────────────
// On the shop/archive index grids:
//   • hovering a tile cycles its image through the rest and back (per <img>), and
//   • fades the *other* tiles down so the hovered one stands out (per grid).
// Each tile's image list is a JSON array of URLs on `data-hover-gallery`; a grid
// that should dim its non-hovered tiles carries `data-hover-dim`.
//
// The dim runs through GSAP rather than a CSS transition on purpose: the tiles
// keep the inline opacity GSAP leaves after their flicker-in, and a CSS
// transition on that same property would smear the flicker animation on load.

const CYCLE_MS = 650;
const DIM = 0.1; // opacity of the non-hovered tiles
const DIM_DUR = 0.3; // seconds

const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Cycle a tile's image through its gallery while hovered, back to the first on
// leave. Reduced motion swaps to the next image once instead of looping.
function wireCycling(img: HTMLImageElement) {
    if (img.dataset.hgWired) return;
    img.dataset.hgWired = "1";

    let urls: string[] = [];
    try {
        urls = JSON.parse(img.dataset.hoverGallery ?? "[]");
    } catch {
        urls = [];
    }
    if (urls.length < 2) return;

    // Warm the cache so swaps don't flash while hovering.
    urls.slice(1).forEach((u) => {
        const pre = new Image();
        pre.src = u;
    });

    let i = 0;
    let timer = 0;
    const show = (idx: number) => {
        i = (idx + urls.length) % urls.length;
        img.src = urls[i];
    };

    img.addEventListener("mouseenter", () => {
        if (prefersReducedMotion()) {
            show(1);
            return;
        }
        clearInterval(timer);
        timer = window.setInterval(() => show(i + 1), CYCLE_MS);
    });
    img.addEventListener("mouseleave", () => {
        clearInterval(timer);
        timer = 0;
        show(0);
    });
}

// Fade every tile in the grid except the hovered one, and invert the navbar
// label of each non-hovered tile (they share an href); restore on leave.
function wireDimming(grid: HTMLElement) {
    if (grid.dataset.hdWired) return;
    grid.dataset.hdWired = "1";

    const tiles = Array.from(grid.children) as HTMLElement[];
    const dur = () => (prefersReducedMotion() ? 0 : DIM_DUR);

    // The navbar row for a tile is the nav flicker link sharing its href.
    const navLabelFor = (tile: HTMLElement) => {
        const href = tile.getAttribute("href");
        return href
            ? document.querySelector<HTMLElement>(
                  `#navbar a[data-nav-flicker][href="${href}"]`,
              )
            : null;
    };

    const setFocus = (hovered: HTMLElement | null) => {
        tiles.forEach((t) => {
            const dimmed = hovered !== null && t !== hovered;
            gsap.to(t, {
                opacity: dimmed ? DIM : 1,
                duration: dur(),
                overwrite: true,
            });
            navLabelFor(t)?.classList.toggle("nav-inverted", dimmed);
        });
    };

    tiles.forEach((tile) => {
        tile.addEventListener("mouseenter", () => setFocus(tile));
    });

    // Pointer left the whole grid — restore everything. (Moving between tiles
    // is handled by the next tile's mouseenter.)
    grid.addEventListener("mouseleave", () => setFocus(null));
}

function wire() {
    document
        .querySelectorAll<HTMLImageElement>("img[data-hover-gallery]")
        .forEach(wireCycling);
    document
        .querySelectorAll<HTMLElement>("[data-hover-dim]")
        .forEach(wireDimming);
}

document.addEventListener("astro:page-load", wire);
