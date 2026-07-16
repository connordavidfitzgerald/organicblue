import { shopify, shopifyConfigured } from "./shopify";
import { products as fallbackProducts } from "../data/products";

export interface ProductImage {
    // Display-optimized WebP (~1000px) — shop grid tiles + cart thumbnail.
    url: string;
    // High-quality WebP (~2000px, capped at the original) — detail gallery.
    full: string;
    alt: string;
}

export interface Product {
    slug: string; // maps to the Shopify product handle
    name: string; // short name, e.g. "ES.RS" — used in the navbar
    price: string; // e.g. "590 CAD"
    // Numeric ID of the first variant, used to build the Shopify checkout
    // permalink. Empty in fallback mode.
    variantId: string;
    detailTitle: string; // heading shown on the product detail page
    description: string; // HTML from Shopify (empty in fallback)
    images: ProductImage[];
    // Product detail metafields (custom namespace), normalized to string lists
    // keyed by metafield key. Empty when Shopify isn't configured.
    specs: Record<string, string[]>;
}

const money = (amount: string, code: string) =>
    `${Math.round(Number(amount))} ${code}`;

// Product detail metafields we surface in the spec panel. All live in the
// `custom` namespace in Shopify.
const SPEC_KEYS = [
    "volume",
    "tuned_for",
    "production",
    "weight",
    "materials",
    "sizing",
    "technical_features",
] as const;

// Detail-page heading, fetched alongside the spec metafields but surfaced as a
// dedicated field rather than in the spec map.
const DETAIL_TITLE_KEY = "detail_title";

const METAFIELD_IDENTIFIERS = [...SPEC_KEYS, DETAIL_TITLE_KEY]
    .map((key) => `{ namespace: "custom", key: "${key}" }`)
    .join(", ");

const PRODUCT_FIELDS = `
    handle
    title
    descriptionHtml
    priceRange { minVariantPrice { amount currencyCode } }
    variants(first: 1) { nodes { id } }
    images(first: 20) {
        nodes {
            altText
            url(transform: { maxWidth: 1600, preferredContentType: WEBP })
            fullUrl: url(transform: { maxWidth: 1600, preferredContentType: WEBP })
        }
    }
    metafields(identifiers: [${METAFIELD_IDENTIFIERS}]) { key value type }
`;

// Metafields come back as either a JSON-encoded list or a bare string; both
// are normalized to a string array so the panel can render them uniformly.
function parseMetafield(value: string, type: string): string[] {
    if (type.startsWith("list.")) {
        try {
            return (JSON.parse(value) as string[]).map((v) => v.trim());
        } catch {
            return [];
        }
    }
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
}

function mapShopify(p: any): Product {
    const price = p.priceRange.minVariantPrice;
    const specs: Record<string, string[]> = {};
    let detailTitle = "";
    for (const mf of p.metafields ?? []) {
        if (!mf) continue; // null entries for keys the product doesn't set
        if (mf.key === DETAIL_TITLE_KEY) {
            detailTitle = mf.value.trim();
            continue;
        }
        specs[mf.key] = parseMetafield(mf.value, mf.type);
    }
    // Storefront IDs are GIDs (gid://shopify/ProductVariant/123); the checkout
    // permalink wants the trailing numeric part.
    const variantGid: string = p.variants?.nodes?.[0]?.id ?? "";
    return {
        slug: p.handle,
        name: p.title,
        price: money(price.amount, price.currencyCode),
        variantId: variantGid.split("/").pop() ?? "",
        detailTitle: detailTitle || p.title,
        description: p.descriptionHtml ?? "",
        images: p.images.nodes.map((i: any) => ({
            url: i.url,
            full: i.fullUrl,
            alt: i.altText ?? p.title,
        })),
        specs,
    };
}

// Used until a real token is in place — keeps the site building and looking
// right; Shopify data takes over automatically once configured.
function fromFallback(p: {
    slug: string;
    name: string;
    price: string;
}): Product {
    return {
        ...p,
        variantId: "",
        detailTitle: p.name,
        description: "",
        images: [],
        specs: {},
    };
}

// Canonical display order for the shop grid + navbar. Shopify returns products
// in its own order, so we sort to this. Anything unlisted falls to the end.
const SLUG_ORDER = ["es-rs", "es-cap", "es-st"];

function byCanonicalOrder(a: Product, b: Product): number {
    const rank = (slug: string) => {
        const i = SLUG_ORDER.indexOf(slug);
        return i === -1 ? SLUG_ORDER.length : i;
    };
    return rank(a.slug) - rank(b.slug);
}

// Memoized for the whole build so navbar + pages share one fetch.
let cache: Promise<Product[]> | null = null;

async function fetchProducts(): Promise<Product[]> {
    if (!shopifyConfigured)
        return fallbackProducts.map(fromFallback).sort(byCanonicalOrder);
    try {
        const data = await shopify<{ products: { nodes: any[] } }>(
            `query { products(first: 50) { nodes { ${PRODUCT_FIELDS} } } }`,
        );
        return data.products.nodes.map(mapShopify).sort(byCanonicalOrder);
    } catch (err) {
        console.warn("[shopify] product fetch failed, using fallback:", err);
        return fallbackProducts.map(fromFallback).sort(byCanonicalOrder);
    }
}

export function getProducts(): Promise<Product[]> {
    return (cache ??= fetchProducts());
}

export async function getProduct(handle: string): Promise<Product | null> {
    const all = await getProducts();
    return all.find((p) => p.slug === handle) ?? null;
}
