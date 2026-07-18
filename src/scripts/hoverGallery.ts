// ── Hover gallery ──────────────────────────────────────────────────────────
// On the shop/archive index grids:
//   • hovering a tile cycles its image through the rest and back (per <img>), and
//   • dims the *other* images so the hovered one stands out (per grid).
// Each tile's image list is a JSON array of URLs on `data-hover-gallery`; a grid
// that should dim its non-hovered tiles carries `data-hover-dim`.
//
// The dim multiplies the non-hovered images into the tile background and drops
// them to 30% opacity. mix-blend-mode isn't animatable, so it toggles instantly
// while a CSS transition fades the opacity — its own channel, so it never
// touches the inline opacity the fade-in leaves on the tiles, and it interrupts
// cleanly when you move between tiles mid-hover.
//
// The tile background is animated too: on dimming it snaps to a light grey
// (#ececec) and transitions to the resting dark grey (#3f3f3f) as the opacity
// fades, so the multiply eases the dimmed image down rather than snapping.

const CYCLE_MS = 1000;
const DIM_OPACITY = 0.2; // opacity of the non-hovered images while dimmed
const DIM_BG_FROM = "#ececec"; // backdrop the dim starts from (light grey)
const DIM_BG_TO = "#3f3f3f"; // backdrop the dim settles to (dark grey)
const DIM_DUR = 0.3; // seconds
const DIM_EASE = "cubic-bezier(0.4, 0, 0.2, 1)"; // easing for the dim/undim

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
    // Dim the image itself (falling back to the tile for image-less slots) so
    // the multiply blends against the tile's own background.
    const targetOf = (t: HTMLElement) =>
        t.querySelector<HTMLElement>("img") ?? t;

    // The navbar row for a tile is the nav flicker link sharing its href.
    const navLabelFor = (tile: HTMLElement) => {
        const href = tile.getAttribute("href");
        return href
            ? document.querySelector<HTMLElement>(
                  `#navbar a[data-nav-flicker][href="${href}"]`,
              )
            : null;
    };

    const reduced = prefersReducedMotion();
    const opacityT = reduced ? "" : `opacity ${DIM_DUR}s ${DIM_EASE}`;
    const bgT = reduced ? "" : `background-color ${DIM_DUR}s ${DIM_EASE}`;

    // Drive the tile backdrop light grey → dark grey. The resting bg differs
    // from the dim's start colour, so on *entering* the dimmed state we snap to
    // #ececec (transition off) then ease to #3f3f3f. Guarded on a state flag so
    // moving between tiles doesn't restart an already-dimmed tile's animation
    // (which would flick it back to light). `both` carries the opacity channel
    // too for image-less slots, where the tile is its own blend target.
    const setBackdrop = (t: HTMLElement, dimmed: boolean, both: boolean) => {
        if ((t.dataset.hgDimmed === "1") === dimmed) return;
        t.dataset.hgDimmed = dimmed ? "1" : "0";
        const on = both ? [opacityT, bgT].filter(Boolean).join(", ") : bgT;
        if (reduced) {
            t.style.backgroundColor = dimmed ? DIM_BG_TO : "";
            return;
        }
        if (dimmed) {
            t.style.transition = "none";
            t.style.backgroundColor = DIM_BG_FROM;
            void t.offsetWidth; // commit the snap before arming the transition
            t.style.transition = on;
            t.style.backgroundColor = DIM_BG_TO;
        } else {
            t.style.transition = on;
            t.style.backgroundColor = ""; // back to the resting bg class
        }
    };

    const setFocus = (hovered: HTMLElement | null) => {
        tiles.forEach((t) => {
            const dimmed = hovered !== null && t !== hovered;
            const target = targetOf(t);
            target.style.mixBlendMode = dimmed ? "multiply" : "normal";
            target.style.opacity = dimmed ? String(DIM_OPACITY) : "1";
            setBackdrop(t, dimmed, target === t);
            navLabelFor(t)?.classList.toggle("nav-inverted", dimmed);
        });
    };

    tiles.forEach((tile) => {
        // Opacity transition rides on the image; the backdrop transition is set
        // per state change in setBackdrop (it toggles transition:none for the
        // snap). Image-less slots blend on the tile, so setBackdrop owns both.
        if (targetOf(tile) !== tile) targetOf(tile).style.transition = opacityT;
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
