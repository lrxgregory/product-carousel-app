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

  // Filtrer les metafields configurés pour le type de propriétaire spécifié
  const keys = metafieldsConfig.metafields
    .filter((m: MetafieldConfig) => m.owner_type === ownerType.toUpperCase())
    .map((m: MetafieldConfig) => m.key);

  const definitions: Metafield[] = [];

  // Récupérer les définitions de metafields existantes pour chaque clé
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

    // Ajouter les définitions de metafields à la liste
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

  // Si deleteValues est true, on appelle deleteMetafieldsValue pour supprimer les valeurs
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
    // ✅ Récupérer les produits et leurs metafields
    const response = await admin.graphql(`
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

    const parsedResponse = await response.json();
    const products = parsedResponse.data.products.edges || [];

    hasNextPage = parsedResponse.data.products.pageInfo.hasNextPage;
    afterCursor = hasNextPage ? products.slice(-1)[0].cursor : null;

    // 🔥 **Création de la liste des metafields à supprimer**
    const metafieldsToDelete = [];
    for (const product of products) {
      for (const metafieldEdge of product.node.metafields.edges) {
        const metafield = metafieldEdge.node;
        metafieldsToDelete.push({
          ownerId: product.node.id, // ✅ Format correct `gid://shopify/Product/XXXXXX`
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

    // ✅ Utilisation de `metafieldsDelete` pour supprimer plusieurs valeurs d’un coup
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
      const deleteResponse = await admin.graphql(deleteMutation, {
        variables: { metafields: metafieldsToDelete }, // ✅ Correction ici
      });

      const parsedMutation = await deleteResponse.json();

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