import { type ActionFunctionArgs } from "@remix-run/node";
import { createMetafields } from "app/services/metafieldService.js";
import shopify from "../shopify.server";

export async function action({ request }: ActionFunctionArgs) {
    try {
        const auth = await shopify.authenticate.admin(request);
        console.log("✅ Authenticated Shopify admin:", auth.session);

        console.log("🛠 Creating metafields...");
        const response = await createMetafields({ request });
        console.log("✅ Metafields creation response:", response);

        return Response.json({ success: true });
    } catch (error) {
        console.error("❌ Error creating metafields:", error);
        return Response.json({ error: "Failed to create metafields" }, { status: 500 });
    }
}

