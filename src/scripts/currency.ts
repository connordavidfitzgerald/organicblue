// ── Currency (client) ──────────────────────────────────────────────────────
// The build ships every market's prices as a lookup table in #ob-prices (see
// Navbar.astro, which renders it on every page). This module is the single
// reader: it resolves the visitor's chosen country to a price, keeps any
// [data-price-display] element in sync, and re-runs whenever the switcher
// dispatches `currency:change`.
//
// The stored value is a country ISO code, not a currency code — several
// countries share a currency but can sit in different markets, and Shopify's
// checkout is localized by country too.

export const CURRENCY_KEY = "ob-currency";

export interface Price {
    amount: number;
    currency: string;
}

interface Payload {
    default: string;
    prices: Record<string, Record<string, Price>>;
}

let payload: Payload = { default: "CA", prices: {} };

function readPayload() {
    const el = document.getElementById("ob-prices");
    if (!el?.textContent) return;
    try {
        payload = JSON.parse(el.textContent) as Payload;
    } catch {
        /* keep whatever we had */
    }
}

export function currentCountry(): string {
    if (Object.keys(payload.prices).length === 0) readPayload();
    try {
        return localStorage.getItem(CURRENCY_KEY) || payload.default;
    } catch {
        return payload.default;
    }
}

// Falls back to the store's own market for any country the build didn't manage
// to price, so a missing market shows a real price rather than nothing.
//
// Amounts are rounded up here rather than at display time, so line totals and
// the checkout total are summed from the same whole numbers the visitor sees —
// a cent-priced market (394.95 EUR) reads as 395 EUR everywhere.
export function priceFor(slug: string): Price | null {
    if (Object.keys(payload.prices).length === 0) readPayload();
    const bySlug = payload.prices[slug];
    if (!bySlug) return null;
    const price = bySlug[currentCountry()] ?? bySlug[payload.default] ?? null;
    return price && { ...price, amount: Math.ceil(price.amount) };
}

// "625 CAD". Prices arrive rounded up from priceFor; this also catches the
// cart's legacy path, where the amount was parsed from a stored string.
export const formatAmount = (amount: number) => String(Math.ceil(amount));

export const formatPrice = (price: Price) =>
    `${formatAmount(price.amount)} ${price.currency}`;

export const displayPrice = (slug: string) => {
    const price = priceFor(slug);
    return price ? formatPrice(price) : null;
};

// Every price on the page is marked with the slug it belongs to, so a switch is
// a single sweep. Add-to-cart buttons carry the same figure in `data-price`;
// keep it current for the cart's legacy path.
export function syncPrices() {
    document
        .querySelectorAll<HTMLElement>("[data-price-display]")
        .forEach((el) => {
            const text = displayPrice(el.dataset.priceDisplay ?? "");
            if (text) el.textContent = text;
        });
    document
        .querySelectorAll<HTMLElement>("[data-add-to-cart][data-slug]")
        .forEach((el) => {
            const text = displayPrice(el.dataset.slug ?? "");
            if (text) el.dataset.price = text;
        });
}

declare global {
    interface Window {
        __obCurrencyWired?: boolean;
    }
}

readPayload();

if (!window.__obCurrencyWired) {
    window.__obCurrencyWired = true;
    document.addEventListener("astro:page-load", () => {
        readPayload();
        syncPrices();
    });
    window.addEventListener("currency:change", syncPrices);
}
