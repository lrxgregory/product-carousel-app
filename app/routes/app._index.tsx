import type { LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import {
  BlockStack,
  Button,
  Card,
  InlineStack,
  Layout,
  Page,
  Text
} from "@shopify/polaris";
import { useEffect, useState } from "react";
import shopify from "../shopify.server";

// Définir un type pour `fetcher.data`
type DeleteMetafieldsResponse = {
  success?: boolean;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await shopify.authenticate.admin(request);
  return null;
};

export default function Index() {
  const fetcher = useFetcher<DeleteMetafieldsResponse>();
  const shopify = useAppBridge();

  const [isDeleting, setIsDeleting] = useState(false);
  const isLoading = fetcher.state === "loading" || isDeleting;

  useEffect(() => {
    if (fetcher.data && "success" in fetcher.data && fetcher.data.success) {
      shopify.toast.show("Metafields supprimés avec succès !");
      setIsDeleting(false);
    } else if (fetcher.data && "error" in fetcher.data) {
      shopify.toast.show("Erreur lors de la suppression des metafields.");
      setIsDeleting(false);
    }
  }, [fetcher.data, shopify]);

  const deleteMetafields = (deleteValues: boolean) => {
    setIsDeleting(true);
    fetcher.submit({ deleteValues }, { method: "POST", action: "/app/delete-metafields" });
  };

  return (
    <Page>
      <TitleBar title="Gestion des Metafields" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <Text as="h2" variant="headingMd">
                  Supprimer les Metafields
                </Text>
                <Text as="p" variant="bodyMd">
                  Vous pouvez supprimer uniquement les définitions de metafields ou bien les valeurs associées.
                </Text>
                <InlineStack gap="300">
                  <Button loading={isLoading} onClick={() => deleteMetafields(false)}>
                    Supprimer les Metafields (garder valeurs)
                  </Button>
                  <Button loading={isLoading} onClick={() => deleteMetafields(true)} tone="critical">
                    Supprimer Metafields + Valeurs
                  </Button>

                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
