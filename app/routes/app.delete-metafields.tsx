import { type ActionFunctionArgs } from "@remix-run/node";
import { deleteMetafields } from "app/services/metafieldService.js";
import shopify from "../shopify.server";

export async function action({ request }: ActionFunctionArgs) {

    const formData = await request.formData();
    const deleteValues = formData.get("deleteValues") === "true";

    try {
        const auth = await shopify.authenticate.admin(request);
        console.log("✅ Authenticated Shopify admin:", auth.session);

        console.log("🛠 Creating metafields...");
        const response = await deleteMetafields({ request, deleteValues });
        console.log("✅ Metafields creation response:", response);

        return Response.json({ success: true });
    } catch (error) {
        console.error("❌ Error creating metafields:", error);
        return Response.json({ error: "Failed to create metafields" }, { status: 500 });
    }
}

