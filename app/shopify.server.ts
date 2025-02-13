import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    removeRest: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),

  hooks: {
    afterAuth: async ({ session }) => {
      console.log(`🔔 Auth réussie pour le shop: ${session.shop}. Création des Metafields...`);
      await createProductMetafields(session);
    },
  },
});

export default shopify;
export const apiVersion = ApiVersion.January25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;

/**
 * 🔨 Crée les Metafields pour les produits
 */
async function createProductMetafields(session: any) {
  const metafields = [
    { namespace: "custom", key: "test1", name: "Test Line 1", type: "single_line_text_field" },
    { namespace: "custom", key: "test2", name: "Test Line 2", type: "single_line_text_field" },
    { namespace: "custom", key: "test3", name: "Test Line 3", type: "single_line_text_field" },
    { namespace: "custom", key: "description_short", name: "Short Description", type: "single_line_text_field" },
  ];

  const endpoint = `https://${session.shop}/admin/api/${ApiVersion.January25}/graphql.json`;

  for (const metafield of metafields) {
    const mutation = `
      mutation {
        metafieldDefinitionCreate(definition: {
          name: "${metafield.name}",
          namespace: "${metafield.namespace}",
          key: "${metafield.key}",
          type: "${metafield.type}",
          ownerType: PRODUCT
        }) {
          createdDefinition {
            id
            name
            namespace
            key
            type {
              name
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": session.accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: mutation }),
      });

      const result = await response.json();
      if (result.data?.metafieldDefinitionCreate?.userErrors?.length) {
        console.error(`❌ Erreur lors de la création du Metafield ${metafield.key}:`, result.data.metafieldDefinitionCreate.userErrors);
      } else {
        console.log(`✅ Metafield "${metafield.key}" créé avec succès !`);
      }
    } catch (error) {
      console.error(`❌ Erreur générale lors de la création du Metafield "${metafield.key}" :`, error);
    }
  }
}
