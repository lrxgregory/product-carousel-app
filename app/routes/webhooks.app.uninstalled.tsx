import type { ActionFunctionArgs } from "@remix-run/node";
import { ApiVersion } from "@shopify/shopify-api";
import db from "../db.server";
import { authenticate } from "../shopify.server";

// 📦 Import du JSON des Metafields à supprimer
import metafieldsConfig from "../../extensions/config/metafields.json";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);
  console.log(`📢 Received ${topic} webhook for ${shop}`);

  // 🚮 Suppression des Metafields associés
  if (session) {
    if (session.accessToken) {
      await deleteProductMetafields(shop, session.accessToken);
    }
    await db.session.deleteMany({ where: { shop } });
  }

  return new Response();
};


async function deleteProductMetafields(shop: string, accessToken: string) {
  const endpoint = `https://${shop}/admin/api/${ApiVersion.January25}/graphql.json`;

  for (const metafield of metafieldsConfig.metafields) {
    const mutation = `
      mutation {
        metafieldDefinitionDelete(id: "gid://shopify/MetafieldDefinition/${metafield.namespace}.${metafield.key}") {
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
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: mutation }),
      });

      const result = await response.json();

      if (result.data?.metafieldDefinitionDelete?.userErrors?.length) {
        console.error(
          `❌ Erreur lors de la suppression de ${metafield.key} :`,
          result.data.metafieldDefinitionDelete.userErrors
        );
      } else {
        console.log(`✅ Metafield "${metafield.key}" supprimé avec succès !`);
      }
    } catch (error) {
      console.error(`❌ Erreur générale lors de la suppression de "${metafield.key}" :`, error);
    }
  }
}
