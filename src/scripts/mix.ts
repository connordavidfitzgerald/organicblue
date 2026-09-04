// ── Mix player ─────────────────────────────────────────────────────────────
// One <audio> element lives in the layout on every page (MixAudio.astro) and
// carries `transition:persist`, so ClientRouter moves the node itself into the
// swapped-in document and playback runs straight through a navigation. This
// module is its controller: it owns loading a mix, play/pause, and the
// Media Session metadata that puts the mix on a phone's lock screen.
//
// The visible transport (MixPlayer.astro) is homepage-only and is a pure view
// over this — it reads the audio element's own events rather than keeping any
// state of its own.

export type MixInfo = {
    id: string;
    label: string;
    title: string;
    artist: string;
    src: string;
    artwork: string;
};

declare global {
    interface Window {
        __obMixWired?: boolean;
    }
}

const AUDIO_ID = "ob-mix-audio";
const PAYLOAD_ID = "ob-mixes";
// Survives a hard reload (a full page load, an external link and back) so the
// transport comes back on the right mix at the right place. Playback itself
// can't resume without a gesture — browsers require one — so it restores
// paused and waits for a tap.
const RESUME_KEY = "ob-mix-resume";

export const getAudio = () =>
    document.getElementById(AUDIO_ID) as HTMLAudioElement | null;

// Baked into the page by MixAudio.astro, the same build-time JSON idiom the
// navbar uses for its price table.
export const getMixes = (): MixInfo[] => {
    try {
        const raw = document.getElementById(PAYLOAD_ID)?.textContent;
        return raw ? (JSON.parse(raw) as MixInfo[]) : [];
    } catch {
        return [];
    }
};

/** The loaded mix's id, or null while nothing has been chosen yet. */
export const currentMixId = () => getAudio()?.dataset.mixId || null;

const findMix = (id: string) => getMixes().find((m) => m.id === id);

// What iOS/Android draw on the lock screen and in Control Center. Set on every
// mix change; without it the phone shows the page title and no artwork.
const setMetadata = (mix: MixInfo) => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
        title: mix.title,
        artist: mix.artist,
        album: "Organic Blue",
        // One entry, no declared size: the stand-in is the wide film still,
        // and a square cover dropped in later swaps straight into its place.
        artwork: [{ src: new URL(mix.artwork, location.href).href }],
    });
};

// The lock-screen scrubber only moves if we publish where we are. Guarded:
// duration is NaN until metadata lands, and a bad value throws.
const syncPositionState = () => {
    const audio = getAudio();
    if (!audio || !("mediaSession" in navigator)) return;
    if (!navigator.mediaSession.setPositionState) return;
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    try {
        navigator.mediaSession.setPositionState({
            duration: audio.duration,
            playbackRate: audio.playbackRate,
            position: Math.min(audio.currentTime, audio.duration),
        });
    } catch {
        /* a seek in flight can put position past duration for a frame */
    }
};

// timeupdate fires ~4x a second; the resume point only needs to be roughly
// right, so this writes at most once every couple of seconds.
let lastRemembered = 0;
const remember = (force = false) => {
    const audio = getAudio();
    if (!audio?.dataset.mixId) return;
    const now = Date.now();
    if (!force && now - lastRemembered < 2000) return;
    lastRemembered = now;
    try {
        sessionStorage.setItem(
            RESUME_KEY,
            JSON.stringify({ id: audio.dataset.mixId, time: audio.currentTime }),
        );
    } catch {
        /* private mode */
    }
};

/** Load a mix (if it isn't already) and play it. */
export const playMix = (id: string) => {
    const audio = getAudio();
    const mix = findMix(id);
    if (!audio || !mix) return;
    if (audio.dataset.mixId !== id) {
        audio.dataset.mixId = id;
        audio.preload = "metadata";
        audio.src = mix.src;
        setMetadata(mix);
    }
    audio.play().catch(() => {
        /* autoplay policy, or the file 404s — the transport shows paused */
    });
};

/** Play/pause whatever is loaded. No-op before a mix has been chosen. */
export const toggleMix = () => {
    const audio = getAudio();
    if (!audio?.dataset.mixId) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
};

export const seekMix = (seconds: number) => {
    const audio = getAudio();
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = Math.max(0, Math.min(seconds, audio.duration));
    syncPositionState();
};

/** "3:07" / "1:04:22" — hours only once the mix runs past one. */
export const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
    const total = Math.floor(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

// Restore the mix a previous page load left off on — source and position only,
// paused. Runs once, and only if nothing is loaded yet.
const restore = (audio: HTMLAudioElement) => {
    if (audio.dataset.mixId) return;
    let saved: { id?: string; time?: number } | null = null;
    try {
        const raw = sessionStorage.getItem(RESUME_KEY);
        saved = raw ? JSON.parse(raw) : null;
    } catch {
        return;
    }
    if (!saved?.id) return;
    const mix = findMix(saved.id);
    if (!mix) return;

    audio.dataset.mixId = mix.id;
    audio.preload = "metadata";
    audio.src = mix.src;
    setMetadata(mix);
    const at = Number(saved.time) || 0;
    if (at > 0) {
        audio.addEventListener(
            "loadedmetadata",
            () => {
                audio.currentTime = Math.min(at, audio.duration || at);
            },
            { once: true },
        );
    }
};

// ── One-time wiring ────────────────────────────────────────────────────────
// Module scripts are not re-executed across ClientRouter navigations, but this
// module is imported by two components — the guard keeps the handlers single.
if (!window.__obMixWired) {
    window.__obMixWired = true;

    const audio = getAudio();
    if (audio) {
        restore(audio);
        audio.addEventListener("timeupdate", () => {
            syncPositionState();
            remember();
        });
        audio.addEventListener("durationchange", syncPositionState);
        audio.addEventListener("play", () => {
            if ("mediaSession" in navigator)
                navigator.mediaSession.playbackState = "playing";
            syncPositionState();
        });
        audio.addEventListener("pause", () => {
            if ("mediaSession" in navigator)
                navigator.mediaSession.playbackState = "paused";
            remember(true);
        });
    }

    if ("mediaSession" in navigator) {
        const handler = (
            action: MediaSessionAction,
            fn: MediaSessionActionHandler,
        ) => {
            try {
                navigator.mediaSession.setActionHandler(action, fn);
            } catch {
                /* action unsupported in this browser */
            }
        };
        handler("play", () => getAudio()?.play());
        handler("pause", () => getAudio()?.pause());
        handler("stop", () => {
            const a = getAudio();
            if (!a) return;
            a.pause();
            a.currentTime = 0;
        });
        handler("seekto", (details) => {
            if (typeof details.seekTime === "number") seekMix(details.seekTime);
        });
        handler("seekbackward", (details) => {
            const a = getAudio();
            if (a) seekMix(a.currentTime - (details.seekOffset ?? 15));
        });
        handler("seekforward", (details) => {
            const a = getAudio();
            if (a) seekMix(a.currentTime + (details.seekOffset ?? 30));
        });
        // Two mixes, so the lock screen's track buttons flip between them.
        const step = (delta: number) => () => {
            const list = getMixes();
            const i = list.findIndex((m) => m.id === currentMixId());
            if (i < 0 || list.length < 2) return;
            playMix(list[(i + delta + list.length) % list.length].id);
        };
        handler("nexttrack", step(1));
        handler("previoustrack", step(-1));
    }
}
