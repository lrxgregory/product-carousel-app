import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

import metafieldsConfig from "../extensions/config/metafields.json";

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
      console.log(`🔔 Auth réussie pour le shop: ${session.shop}. Vérification et création des Metafields...`);
      await createProductMetafieldsIfNeeded(session);
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

async function createProductMetafieldsIfNeeded(session: any) {

  const endpoint = `https://${session.shop}/admin/api/${ApiVersion.January25}/graphql.json`;

  const existingMetafields = await getExistingProductMetafields(endpoint, session.accessToken);

  for (const metafield of metafieldsConfig.metafields) {
    const alreadyExists = existingMetafields.some(
      (m: any) => m.namespace === metafield.namespace && m.key === metafield.key
    );

    if (alreadyExists) {
      console.log(`⏭️ Metafield "${metafield.key}" existe déjà, pas besoin de le recréer.`);
      continue;
    }

    const mutation = `
      mutation {
        metafieldDefinitionCreate(definition: {
          name: "${metafield.name}",
          namespace: "${metafield.namespace}",
          key: "${metafield.key}",
          type: "${metafield.type}",
          ownerType: "${metafield.owner_type}"
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
        console.error(`❌ Erreur pour ${metafield.key}:`, result.data.metafieldDefinitionCreate.userErrors);
      } else {
        console.log(metafieldsConfig);
        console.log(`✅ Metafield "${metafield.key}" créé avec succès !`);
      }
    } catch (error) {
      console.error(`❌ Erreur générale pour "${metafield.key}" :`, error);
    }
  }
}

/**
 * 🔍 Récupère les Metafields existants
 */
async function getExistingProductMetafields(endpoint: string, accessToken: string) {
  const query = `
    {
      shop {
        metafieldDefinitions(first: 50, ownerType: PRODUCT) {
          edges {
            node {
              namespace
              key
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    const result = await response.json();
    return result.data?.shop?.metafieldDefinitions?.edges.map((edge: any) => edge.node) || [];
  } catch (error) {
    console.error(`❌ Erreur lors de la récupération des Metafields existants :`, error);
    return [];
  }
}
