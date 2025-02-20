import { ApiVersion } from "@shopify/shopify-app-remix/server";
import metafieldsConfig from "../../extensions/config/metafields.json";

// Typage pour les metafields
interface Metafield {
  id: string;
  namespace: string;
  key: string;
  type: { name: string };
}

interface MetafieldConfig {
  name: string;
  namespace: string;
  key: string;
  type: string;
  owner_type: string;
}

/**
 * Récupère les metafields existants depuis Shopify
 */
export async function getExistingMetafields(
  endpoint: string,
  accessToken: string,
  ownerType: string = "PRODUCT"
): Promise<Metafield[]> {
  const keys = metafieldsConfig.metafields
    .filter((m: MetafieldConfig) => m.owner_type === ownerType.toUpperCase())
    .map((m: MetafieldConfig) => m.key);

  const definitions: Metafield[] = [];

  for (const key of keys) {
    const query = `
      {
        metafieldDefinitions(first: 1, ownerType: ${ownerType}, namespace: "custom", key: "${key}") {
          edges {
            node {
              id
              namespace
              key
              type { name }
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
      if (result.errors) {
        console.error(`🚨 GraphQL Error for key "${key}":`, result.errors);
        continue;
      }

      const nodes = result.data?.metafieldDefinitions?.edges.map((edge: any) => edge.node) || [];
      definitions.push(...nodes);
    } catch (error) {
      console.error(`❌ Error while retrieving metafield for key "${key}":`, error);
    }
  }

  console.log(`🔍 Found metafield definitions for ${ownerType}:`, definitions);
  return definitions;
}

/**
 * Crée les metafields s'ils n'existent pas
 */
export async function createMetafieldsIfNeeded(session: any) {
  const endpoint = `https://${session.shop}/admin/api/${ApiVersion.January25}/graphql.json`;

  console.log("🔍 Checking existing metafields...");
  const existingMetafields = await getExistingMetafields(endpoint, session.accessToken);
  console.log(`Found ${existingMetafields.length} existing metafields`);

  for (const metafield of metafieldsConfig.metafields) {
    const alreadyExists = existingMetafields.some(
      (m: Metafield) => m.namespace === metafield.namespace && m.key === metafield.key
    );

    if (alreadyExists) {
      console.log(`Metafield "${metafield.namespace}.${metafield.key}" already exists, skipping.`);
      continue;
    }

    console.log(`📝 Creating new metafield "${metafield.namespace}.${metafield.key}"...`);

    const mutation = `
      mutation {
        metafieldDefinitionCreate(definition: {
          name: "${metafield.name}",
          namespace: "${metafield.namespace}",
          key: "${metafield.key}",
          type: "${metafield.type}",
          ownerType: ${metafield.owner_type.toUpperCase()}
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
        console.error(`❌ Error for ${metafield.namespace}.${metafield.key}:`, result.data.metafieldDefinitionCreate.userErrors);
      } else {
        console.log(`✅ Metafield "${metafield.namespace}.${metafield.key}" successfully created!`);
      }
    } catch (error) {
      console.error(`❌ General error for "${metafield.namespace}.${metafield.key}":`, error);
    }
  }
}

/**
 * Supprime les metafields existants via GraphQL
 */
export async function deleteMetafields(session: any, deleteValues = false) {
  const endpoint = `https://${session.shop}/admin/api/${ApiVersion.January25}/graphql.json`;

  console.log("🔍 Récupération des metafields existants...");
  const existingMetafields = await getExistingMetafields(endpoint, session.accessToken);

  if (existingMetafields.length === 0) {
    console.log("✅ Aucun metafield trouvé.");
    return;
  }

  for (const metafield of existingMetafields) {
    console.log(`🗑 Suppression du metafield ${metafield.namespace}.${metafield.key}...`);

    const mutation = `
      mutation {
        metafieldDefinitionDelete(id: "${metafield.id}") {
          deletedDefinitionId
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
      console.log("📝 Réponse Shopify :", JSON.stringify(result, null, 2));

      if (result.data?.metafieldDefinitionDelete?.userErrors?.length) {
        console.error("❌ Erreur Shopify :", result.data.metafieldDefinitionDelete.userErrors);
      } else {
        console.log(`✅ Metafield "${metafield.namespace}.${metafield.key}" supprimé.`);
      }
    } catch (error) {
      console.error(`❌ Erreur réseau pour "${metafield.namespace}.${metafield.key}":`, error);
    }
  }

  if (deleteValues) {
    console.log("🗑 Suppression des valeurs des metafields...");
    await deleteMetafieldValues(session);
  }
}

/**
 * Supprime les valeurs des metafields de tous les produits
 */
async function deleteMetafieldValues(session: any) {
  const endpoint = `https://${session.shop}/admin/api/${ApiVersion.January25}/graphql.json`;

  let hasNextPage = true;
  let afterCursor = null;

  while (hasNextPage) {
    const productQuery = `
      {
        products(first: 50${afterCursor ? `, after: "${afterCursor}"` : ""}) {
          edges {
            node {
              id
              metafields(first: 250, namespace: "custom") {
                edges {
                  node {
                    id
                  }
                }
              }
            }
            cursor
          }
          pageInfo {
            hasNextPage
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
        body: JSON.stringify({ query: productQuery }),
      });

      const result = await response.json();
      const products = result.data?.products?.edges || [];

      for (const product of products) {
        for (const metafield of product.node.metafields.edges) {
          const deleteMutation = `
            mutation {
              metafieldDelete(input: { id: "${metafield.node.id}" }) {
                deletedId
                userErrors {
                  field
                  message
                }
              }
            }
          `;

          await fetch(endpoint, {
            method: "POST",
            headers: {
              "X-Shopify-Access-Token": session.accessToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ query: deleteMutation }),
          });

          console.log(`✅ Valeur du metafield ${metafield.node.id} supprimée.`);
        }
      }

      hasNextPage = result.data?.products?.pageInfo?.hasNextPage || false;
      afterCursor = products[products.length - 1]?.cursor || null;
    } catch (error) {
      console.error("❌ Erreur lors de la suppression des valeurs des metafields:", error);
      break;
    }
  }
}