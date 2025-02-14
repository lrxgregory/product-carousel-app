import { ApiVersion } from "@shopify/shopify-app-remix/server";
import metafieldsConfig from "../../extensions/config/metafields.json";

/**
 * Retrieves existing metafields from Shopify
 */
export async function getExistingMetafields(endpoint: string, accessToken: string, ownerType: string = "PRODUCT") {
    const keys = metafieldsConfig.metafields
        .filter((m: any) => m.owner_type === ownerType.toUpperCase())
        .map((m: any) => m.key);

    const definitions = [];

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
* Creates metafields if they don't exist
*/
export async function createMetafieldsIfNeeded(session: any) {
    const endpoint = `https://${session.shop}/admin/api/${ApiVersion.January25}/graphql.json`;

    console.log("🔍 Checking existing metafields...");
    const existingMetafields = await getExistingMetafields(endpoint, session.accessToken);
    console.log(`Found ${existingMetafields.length} existing metafields`);

    for (const metafield of metafieldsConfig.metafields) {
        const alreadyExists = existingMetafields.some(
            (m: any) => m.namespace === metafield.namespace && m.key === metafield.key
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
                console.error(`❌ Error for ${metafield.namespace}.${metafield.key}:`,
                    result.data.metafieldDefinitionCreate.userErrors
                );
            } else {
                console.log(`✅ Metafield "${metafield.namespace}.${metafield.key}" successfully created!`);
            }
        } catch (error) {
            console.error(`❌ General error for "${metafield.namespace}.${metafield.key}":`, error);
        }
    }
}