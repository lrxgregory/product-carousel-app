import { deleteMetafields } from "app/services/metafieldService";
import shopify from "app/shopify.server";

export async function action({ request }: { request: Request }) {
    // Vérifie que `shop` est bien défini
    const { session } = await shopify.authenticate.admin(request);

    if (!session?.shop) {
        console.error("❌ Erreur : Impossible d'authentifier l'admin Shopify.");
        return Response.json({ error: "Unauthorized - Admin authentication failed" }, { status: 401 });
    }

    console.log(`✅ Authentification réussie pour la boutique ${session.shop}`);

    const formData = await request.formData();
    const deleteValues = formData.get("deleteValues") === "true"; // Convertir en booléen

    try {
        await deleteMetafields(session, deleteValues);
        return Response.json({ success: true });
    } catch (error) {
        console.error("❌ Erreur lors de la suppression des metafields:", error);
        return Response.json({ error: "Erreur lors de la suppression des metafields" }, { status: 500 });
    }
}
