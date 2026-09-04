// The two DJ mixes offered from the homepage.
//
// The audio lives in `public/mixes/` rather than `src/assets/`: Astro copies
// public/ through verbatim, so the files keep stable URLs and are served
// straight off the CDN, which answers the byte-range requests that make
// scrubbing a 55-minute file work. Routed through Vite they would be
// fingerprinted and inlined into the build graph for no gain.
//
// They are 128 kbps AAC in an .m4a container — supported by every current
// browser (Chrome, Firefox, Safari, Edge) and by iOS lock-screen playback.
import { shareImage } from "./site";

export type Mix = {
    id: string;
    /** The bracketed label shown on the homepage. */
    label: string;
    /** Lock screen / Control Center title + artist. */
    title: string;
    artist: string;
    src: string;
    artwork: string;
};

// Optional cover art, one per mix: drop a square image into
// src/assets/mixes/ named `<id>-cover.jpg` (or .png/.webp) — e.g.
// `7pm-cover.jpg` — and it becomes that mix's lock-screen artwork. Until one
// exists the homepage film still (the same frame used for social sharing)
// stands in, so the lock screen is never blank.
const covers = import.meta.glob<{ default: ImageMetadata }>(
    "../assets/mixes/*-cover.{jpg,jpeg,png,webp}",
    { eager: true },
);

const coverFor = (id: string) => {
    const hit = Object.entries(covers).find(([path]) =>
        path.includes(`/${id}-cover.`),
    );
    return hit ? hit[1].default.src : shareImage;
};

export const mixes: Mix[] = [
    {
        id: "7pm",
        label: "ES.MIX 7PM",
        title: "ES.MIX 7PM",
        artist: "ONLYHANS",
        src: "/mixes/es-mix-7pm.m4a",
        artwork: coverFor("7pm"),
    },
    {
        id: "10pm",
        label: "ES.MIX 10PM",
        title: "ES.MIX 10PM",
        artist: "VAYIA",
        src: "/mixes/es-mix-10pm.m4a",
        artwork: coverFor("10pm"),
    },
];
