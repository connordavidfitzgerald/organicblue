// Site-wide constants for the document head. Kept here rather than inline in
// Layout.astro so the homepage and the share tags read the same playback ID.

// The looping film behind the homepage (src/pages/index.astro).
export const homePlaybackId = "qDlRrWP8z9ZWKxN5PjJZath003lYoGgEgBQPtH4V15uk";

// Social share image, rendered from that same film instead of a standalone
// asset so the two can't drift apart. Mux serves a still from any public
// playback ID on demand: 1200x630 is the ratio Open Graph consumers crop to,
// and smartcrop keeps the subject in frame rather than centre-cutting it.
//
// `time` is the second to grab. The film opens on a near-black frame, so this
// steps a little way in — worth re-checking against the video if it's recut.
export const shareImage = `https://image.mux.com/${homePlaybackId}/thumbnail.png?width=1200&height=630&fit_mode=smartcrop&time=3`;

export const shareImageAlt = "Organic Blue";
