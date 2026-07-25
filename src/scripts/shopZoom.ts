// Click-to-magnify with pan for the product-gallery images. Clicking an image
// scales it up inside its own slide (which clips the overflow); moving the
// pointer then pans the magnified view — the transform-origin follows the cursor
// on desktop and the finger on touch. Clicking/tapping again resets it. Each
// image keeps to its container, so this never becomes a full-screen lightbox.

const ZOOM = 2.4; // magnification factor
const MOVE_THRESHOLD = 6; // px of pointer travel that counts as a pan, not a click

function wireImage(img: HTMLElement) {
    if (img.dataset.zoomWired) return;
    img.dataset.zoomWired = "1";

    // The slide wrapping the image is the pan container: clip the scaled image
    // to it so it never spills over neighbouring slides.
    const slide = img.parentElement;
    if (!slide) return;
    slide.classList.add("overflow-hidden");
    img.classList.add(
        "transition-transform",
        "duration-300",
        "ease-out",
        "cursor-zoom-in",
    );

    let downX = 0;
    let downY = 0;
    let moved = false;

    const isZoomed = () => img.classList.contains("is-zoomed");

    // Map a viewport point to a transform-origin (% of the slide), clamped so it
    // stays within the image even when the pointer drifts to the very edge.
    const setOrigin = (clientX: number, clientY: number) => {
        const r = slide.getBoundingClientRect();
        const px = Math.min(Math.max((clientX - r.left) / r.width, 0), 1) * 100;
        const py = Math.min(Math.max((clientY - r.top) / r.height, 0), 1) * 100;
        img.style.transformOrigin = `${px}% ${py}%`;
    };

    const zoomIn = (clientX: number, clientY: number) => {
        setOrigin(clientX, clientY); // grow out from the clicked point
        img.style.transform = `scale(${ZOOM})`;
        img.classList.add("is-zoomed", "cursor-zoom-out");
        img.classList.remove("cursor-zoom-in");
        slide.style.touchAction = "none"; // let touch pan instead of scrolling
    };

    const zoomOut = () => {
        img.style.transform = "scale(1)";
        img.classList.remove("is-zoomed", "cursor-zoom-out");
        img.classList.add("cursor-zoom-in");
        slide.style.touchAction = "";
    };

    img.addEventListener("pointerdown", (e) => {
        downX = e.clientX;
        downY = e.clientY;
        moved = false;
    });

    img.addEventListener("pointermove", (e) => {
        if (Math.hypot(e.clientX - downX, e.clientY - downY) > MOVE_THRESHOLD)
            moved = true;
        // While magnified, any pointer movement pans (mouse hover or touch drag).
        if (isZoomed()) {
            setOrigin(e.clientX, e.clientY);
            e.preventDefault();
        }
    });

    img.addEventListener("pointerup", (e) => {
        if (moved) return; // that was a pan drag, not a click
        if (isZoomed()) zoomOut();
        else zoomIn(e.clientX, e.clientY);
    });

    // Reset when the reset helper is called from the gallery scroll handler.
    (img as HTMLElement & { _zoomReset?: () => void })._zoomReset = () => {
        if (isZoomed()) zoomOut();
    };
}

function wire() {
    document
        .querySelectorAll<HTMLElement>(".shop-gallery img")
        .forEach(wireImage);

    // Scrolling to another slide drops any active magnification, so you never
    // scroll away and leave a zoomed image behind.
    document
        .querySelectorAll<HTMLElement>(".shop-gallery")
        .forEach((gallery) => {
            if (gallery.dataset.zoomScrollWired) return;
            gallery.dataset.zoomScrollWired = "1";
            gallery.addEventListener(
                "scroll",
                () => {
                    gallery
                        .querySelectorAll<
                            HTMLElement & { _zoomReset?: () => void }
                        >("img.is-zoomed")
                        .forEach((img) => img._zoomReset?.());
                },
                { passive: true },
            );
        });
}

document.addEventListener("astro:page-load", wire);
