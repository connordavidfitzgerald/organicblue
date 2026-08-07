import { shopify, shopifyConfigured } from "./shopify";
import { getProducts } from "./products";

// ── Shopify Markets ────────────────────────────────────────────────────────
// The store sells into every country configured in Shopify Markets, each with
// its own currency and its own price points (they're market prices, not FX
// conversions — JP and AU land on their own round numbers). The Storefront API
// exposes them through the `@inContext(country:)` directive, which is an
// operation-level directive: one request per country, no way to alias several
// into a single query.
//
// The site builds statically, so all of that happens at build time and ships as
// a lookup table (see the #ob-prices payload in Navbar.astro). Nothing is
// fetched in the browser and no token is exposed.

export interface Market {
    iso: string; // country code, e.g. "CA" — also what checkout wants
    name: string; // "Canada"
    currency: string; // "CAD"
    symbol: string; // "$"
}

export interface Price {
    amount: number;
    currency: string;
}

// slug -> country ISO -> price in that market
export type PriceMap = Record<string, Record<string, Price>>;

export interface Markets {
    countries: Market[];
    // The store's own market, used as the default until a visitor picks one.
    defaultCountry: string;
    prices: PriceMap;
}

// Requests run in parallel in small batches: 40-odd tiny queries, without
// opening 40 sockets at once or tripping the Storefront API's cost limiter.
const BATCH = 6;

const LOCALIZATION_QUERY = `{
    localization {
        country { isoCode }
        availableCountries {
            isoCode
            name
            currency { isoCode symbol }
        }
    }
}`;

const priceQuery = (iso: string) => `query @inContext(country: ${iso}) {
    products(first: 50) {
        nodes {
            handle
            priceRange { minVariantPrice { amount currencyCode } }
        }
    }
}`;

type LocalizationResponse = {
    localization: {
        country: { isoCode: string };
        availableCountries: {
            isoCode: string;
            name: string;
            currency: { isoCode: string; symbol: string };
        }[];
    };
};

type PriceResponse = {
    products: {
        nodes: {
            handle: string;
            priceRange: {
                minVariantPrice: { amount: string; currencyCode: string };
            };
        }[];
    };
};

// Prices already baked into the product records (the build's default market),
// used verbatim when Shopify isn't configured and as the safety net for any
// country whose query fails.
async function fallbackMarkets(): Promise<Markets> {
    const products = await getProducts();
    const prices: PriceMap = {};
    for (const p of products) {
        const [amount, currency] = p.price.split(" ");
        prices[p.slug] = {
            CA: { amount: Number(amount) || 0, currency: currency ?? "CAD" },
        };
    }
    return {
        countries: [{ iso: "CA", name: "Canada", currency: "CAD", symbol: "$" }],
        defaultCountry: "CA",
        prices,
    };
}

async function fetchMarkets(): Promise<Markets> {
    if (!shopifyConfigured) return fallbackMarkets();

    try {
        const { localization } =
            await shopify<LocalizationResponse>(LOCALIZATION_QUERY);

        const countries: Market[] = localization.availableCountries
            // The code is interpolated into the query as a CountryCode enum
            // value, so only accept the shape Shopify documents.
            .filter((c) => /^[A-Z]{2}$/.test(c.isoCode))
            .map((c) => ({
                iso: c.isoCode,
                name: c.name,
                currency: c.currency.isoCode,
                symbol: c.currency.symbol,
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

        const prices: PriceMap = {};
        for (let i = 0; i < countries.length; i += BATCH) {
            await Promise.all(
                countries.slice(i, i + BATCH).map(async ({ iso }) => {
                    try {
                        const data = await shopify<PriceResponse>(
                            priceQuery(iso),
                        );
                        for (const node of data.products.nodes) {
                            const money = node.priceRange.minVariantPrice;
                            (prices[node.handle] ??= {})[iso] = {
                                amount: Number(money.amount) || 0,
                                currency: money.currencyCode,
                            };
                        }
                    } catch (err) {
                        // One bad market shouldn't fail the build — that
                        // country just falls back to the default one at
                        // render time.
                        console.warn(`[shopify] prices for ${iso} failed:`, err);
                    }
                }),
            );
        }

        return {
            countries,
            defaultCountry: localization.country.isoCode,
            prices,
        };
    } catch (err) {
        console.warn("[shopify] markets fetch failed, using fallback:", err);
        return fallbackMarkets();
    }
}

// Memoized for the whole build: the navbar and the currency switcher share it.
let cache: Promise<Markets> | null = null;

export function getMarkets(): Promise<Markets> {
    return (cache ??= fetchMarkets());
}
