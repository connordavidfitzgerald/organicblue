// ── Hover gallery ──────────────────────────────────────────────────────────
// The shop/archive index tiles show one image at rest and cycle through the
// rest while hovered, returning to the first on leave. Each tile's image list
// is passed as a JSON array of URLs on `data-hover-gallery`.
//
// Motion-aware: with reduced motion we don't auto-advance — hovering just swaps
// to the next image once (a single change, no loop).

const CYCLE_MS = 650;

const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function wire() {
    document
        .querySelectorAll<HTMLImageElement>("img[data-hover-gallery]")
        .forEach((img) => {
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

            const reduce = prefersReducedMotion();
            let i = 0;
            let timer = 0;
            const show = (idx: number) => {
                i = (idx + urls.length) % urls.length;
                img.src = urls[i];
            };

            img.addEventListener("mouseenter", () => {
                if (reduce) {
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
        });
}

document.addEventListener("astro:page-load", wire);
