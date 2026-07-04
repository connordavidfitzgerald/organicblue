const domain = import.meta.env.SHOPIFY_STORE_DOMAIN;
const token = import.meta.env.SHOPIFY_STOREFRONT_TOKEN;

// True once real credentials are in .env (the template default doesn't count).
export const shopifyConfigured =
    !!domain && !!token && domain !== "your-store.myshopify.com";

const endpoint = `https://${domain}/api/2025-01/graphql.json`;

export async function shopify<T>(query: string, variables = {}): Promise<T> {
    const res = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Shopify-Storefront-Access-Token": token,
        },
        body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) {
        throw new Error(`Shopify ${res.status}: ${await res.text()}`);
    }
    const { data, errors } = await res.json();
    if (errors) throw new Error(JSON.stringify(errors));
    return data as T;
}
