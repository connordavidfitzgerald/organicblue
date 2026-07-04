export interface Product {
    slug: string;
    name: string;
    price: string;
}

// Single source of truth for the shop index + navbar shop row.
// Swap/extend when wiring up Shopify.
export const products: Product[] = [
    { slug: "es-rs", name: "ES.RS", price: "590 CAD" },
    { slug: "es-cap", name: "ES.CAP", price: "115 CAD" },
    { slug: "es-st", name: "ES.ST", price: "480 CAD" },
];
