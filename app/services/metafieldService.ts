import shopify from "app/shopify.server";
import metafieldsConfig from "../../extensions/config/metafields.json";

interface MetafieldConfig {
  name: string;
  namespace: string;
  key: string;
  type: string;
  owner_type: string;
}

interface Metafield {
  id: string;
  namespace: string;
  key: string;
  type: { name: string };
  name: string;
}

export async function getExistingMetafields({ request, ownerType }: { request: Request, ownerType: string }) {
  const { admin } = await shopify.authenticate.admin(request);

  // Filter metafields configurations for the specified owner type
  const keys = metafieldsConfig.metafields
    .filter((m: MetafieldConfig) => m.owner_type === ownerType.toUpperCase())
    .map((m: MetafieldConfig) => m.key);

  const definitions: Metafield[] = [];

  // Get metafield definitions for each key
  for (const key of keys) {
    const response = await admin.graphql(`
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
    `);

    const parsedResponse = await response.json();

    // Add metafield definition to the list
    if (parsedResponse.data.metafieldDefinitions.edges.length > 0) {
      definitions.push(parsedResponse.data.metafieldDefinitions.edges[0].node);
    }
  }

  return {
    metafieldDefinitions: definitions,
  };
}

export async function createMetafields({ request }: { request: Request }) {
  const { admin } = await shopify.authenticate.admin(request);

  console.log("🔍 Checking existing metafields...");
  const existingMetafields = await getExistingMetafields({ request, ownerType: "PRODUCT" });
  console.log(`Found ${existingMetafields.metafieldDefinitions.length} existing metafields`);

  for (const metafield of metafieldsConfig.metafields) {
    const alreadyExists = existingMetafields.metafieldDefinitions.some(
      (m: Metafield) => m.namespace === metafield.namespace && m.key === metafield.key
    );


    if (alreadyExists) {
      console.log(`Metafield "${metafield.namespace}.${metafield.key}" already exists, skipping.`);
      continue;
    }

    console.log(`📝 Creating new metafield "${metafield.namespace}.${metafield.key}"...`);

    const mutation = await admin.graphql(`
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
    `);

    const parsedMutation = await mutation.json();

    if (parsedMutation.data.metafieldDefinitionCreate.userErrors.length > 0) {
      console.log(`Failed to create metafield "${metafield.namespace}.${metafield.key}": ${parsedMutation.data.metafieldDefinitionCreate.userErrors[0].message}`);
      continue;
    }

    console.log(`Created metafield "${metafield.namespace}.${metafield.key}"`);
  }
}

export async function deleteMetafields({ request, deleteValues = false }: { request: Request; deleteValues?: boolean }) {
  const { admin } = await shopify.authenticate.admin(request);

  console.log("🔍 Checking existing metafields...");
  const existingMetafields = await getExistingMetafields({ request, ownerType: "PRODUCT" });

  if (existingMetafields.metafieldDefinitions.length === 0) {
    console.log("✅ No metafields found.");
  } else {
    for (const metafield of existingMetafields.metafieldDefinitions) {
      console.log(`🗑 Deleting metafield "${metafield.namespace}.${metafield.key}" (ID: ${metafield.id})...`);

      const mutation = await admin.graphql(`
        mutation {
          metafieldDefinitionDelete(id: "${metafield.id}") {
            deletedDefinitionId
            userErrors {
              field
              message
            }
          }
        }
      `);

      const parsedMutation = await mutation.json();

      if (parsedMutation.data.metafieldDefinitionDelete.userErrors.length > 0) {
        console.log(`❌ Failed to delete metafield "${metafield.namespace}.${metafield.key}": ${parsedMutation.data.metafieldDefinitionDelete.userErrors[0].message}`);
        continue;
      }

      console.log(`✅ Successfully deleted metafield "${metafield.namespace}.${metafield.key}"`);
    }
  }

  if (deleteValues) {
    console.log("🗑 Deleting metafield values...");
    await deleteMetafieldsValue({ request });
  }
}


export async function deleteMetafieldsValue({ request }: { request: Request }) {
  const { admin } = await shopify.authenticate.admin(request);

  console.log("🔍 Fetching products with metafields...");

  let hasNextPage = true;
  let afterCursor: string | null = null;

  while (hasNextPage) {
    // Get products with metafields
    const response: Response = await admin.graphql(`
      {
        products(first: 50${afterCursor ? `, after: "${afterCursor}"` : ""}) {
          edges {
            node {
              id
              metafields(first: 250, namespace: "custom") {
                edges {
                  node {
                    id
                    namespace
                    key
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
    `);

    // 🔹 Define Shopify response type
    type ShopifyGraphQLResponse = {
      data: {
        products: {
          edges: {
            node: {
              id: string;
              metafields: {
                edges: {
                  node: {
                    id: string;
                    namespace: string;
                    key: string;
                  };
                }[];
              };
            };
            cursor: string;
          }[];
          pageInfo: {
            hasNextPage: boolean;
          };
        };
      };
    };

    const parsedResponse: ShopifyGraphQLResponse = await response.json();
    const products = parsedResponse.data.products.edges || [];

    hasNextPage = parsedResponse.data.products.pageInfo.hasNextPage;
    afterCursor = hasNextPage ? products.slice(-1)[0].cursor : null;

    // Creation of the metafields list to delete
    const metafieldsToDelete: { ownerId: string; namespace: string; key: string }[] = [];
    for (const product of products) {
      for (const metafieldEdge of product.node.metafields.edges) {
        const metafield = metafieldEdge.node;
        metafieldsToDelete.push({
          ownerId: product.node.id,
          namespace: metafield.namespace,
          key: metafield.key,
        });
      }
    }

    if (metafieldsToDelete.length === 0) {
      console.log("✅ No metafields values found to delete.");
      return;
    }

    console.log(`🗑 Deleting ${metafieldsToDelete.length} metafields values...`);

    const deleteMutation = `
      mutation MetafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
        metafieldsDelete(metafields: $metafields) {
          deletedMetafields {
            key
            namespace
            ownerId
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    try {
      const deleteResponse: Response = await admin.graphql(deleteMutation, {
        variables: { metafields: metafieldsToDelete },
      });

      type ShopifyMutationResponse = {
        data: {
          metafieldsDelete: {
            deletedMetafields: { key: string; namespace: string; ownerId: string }[];
            userErrors: { field: string; message: string }[];
          };
        };
      };

      const parsedMutation: ShopifyMutationResponse = await deleteResponse.json();

      if (parsedMutation.data.metafieldsDelete.userErrors.length > 0) {
        console.log("❌ Shopify Errors:", parsedMutation.data.metafieldsDelete.userErrors);
      } else {
        console.log(`✅ Successfully deleted ${metafieldsToDelete.length} metafield values!`);
      }
    } catch (error) {
      console.error("❌ GraphQL error while deleting metafields:", error);
    }
  }
}