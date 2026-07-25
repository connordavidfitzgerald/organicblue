// ── Hide the browser's link URL preview ─────────────────────────────────────
// The navbar sits at the bottom of the viewport, exactly where Chrome/Safari/
// Firefox draw the status bubble ("https://…") on link hover. That bubble is
// drawn purely because the hovered element carries an `href`, so the only way
// to suppress it is for the element not to have one while the mouse is over it.
//
// This stashes `href` into `data-hidden-href` on hover and puts it back the
// moment any real interaction begins, so nothing else changes:
//   • pointerdown restores before the click fires — plain clicks, ⌘/ctrl-click,
//     and middle-click all navigate natively, and Astro's ClientRouter still
//     sees a normal `a[href]` click to intercept.
//   • contextmenu restores, so right-click keeps "Open Link in New Tab" /
//     "Copy Link Address".
//   • focusin restores, so keyboard users get a focusable link + Enter.
//   • Only mouse hovers strip anything (`pointerType === "mouse"`); on touch,
//     pointerdown precedes the synthetic mouseover, which would otherwise leave
//     the anchor href-less at click time.
// The markup Astro ships is untouched, so crawlers and no-JS visitors see real
// links. `a[data-hidden-href] { cursor: pointer }` in global.css keeps the hand
// cursor while the attribute is parked.

const STASH = "hiddenHref"; // → data-hidden-href

// The anchor currently under the mouse with its href stripped.
let hidden: HTMLAnchorElement | null = null;

const hide = (a: HTMLAnchorElement) => {
    const href = a.getAttribute("href");
    if (href === null) return;
    a.dataset[STASH] = href;
    a.removeAttribute("href");
};

const show = (a: HTMLAnchorElement) => {
    const href = a.dataset[STASH];
    if (href === undefined) return;
    a.setAttribute("href", href);
    delete a.dataset[STASH];
};

const showAll = () => {
    document
        .querySelectorAll<HTMLAnchorElement>(`a[data-hidden-href]`)
        .forEach(show);
    hidden = null;
};

const anchorOf = (target: EventTarget | null) =>
    target instanceof Element ? target.closest("a") : null;

function onPointerOver(e: PointerEvent) {
    if (e.pointerType !== "mouse") return;
    const a = anchorOf(e.target);
    if (a === hidden) return; // moving between children of the same link
    if (hidden) show(hidden);
    hidden = a;
    if (a) hide(a);
}

function onPointerOut(e: PointerEvent) {
    if (!hidden) return;
    // Fires when entering a descendant too; only restore once the pointer has
    // genuinely left the anchor (relatedTarget is null when it leaves the window).
    const to = e.relatedTarget;
    if (to instanceof Node && hidden.contains(to)) return;
    show(hidden);
    hidden = null;
}

// A click/tap/right-click/drag or a keyboard focus is about to use the link:
// hand the href back first. Capture phase so we run before Astro's own
// document-level click and prefetch handlers.
function onInteract() {
    showAll();
}

// After a client-side navigation the DOM is new (or persisted, in the navbar's
// case) — restore everything, but keep the link the cursor is still resting on
// stripped, since clicking a navbar link usually leaves the mouse right on it.
function onPageLoad() {
    const under = document.querySelector<HTMLAnchorElement>("a:hover");
    document
        .querySelectorAll<HTMLAnchorElement>(`a[data-hidden-href]`)
        .forEach((a) => {
            if (a !== under) show(a);
        });
    hidden = under;
    if (under) hide(under);
}

declare global {
    interface Window {
        __obLinkPreviewWired?: boolean;
    }
}

if (!window.__obLinkPreviewWired) {
    window.__obLinkPreviewWired = true;
    document.addEventListener("pointerover", onPointerOver, { passive: true });
    document.addEventListener("pointerout", onPointerOut, { passive: true });
    for (const event of [
        "pointerdown",
        "contextmenu",
        "focusin",
        "dragstart",
    ]) {
        document.addEventListener(event, onInteract, {
            capture: true,
            passive: true,
        });
    }
    document.addEventListener("astro:page-load", onPageLoad);
}
