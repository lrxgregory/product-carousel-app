import { useFetcher } from "@remix-run/react";
import { TitleBar } from "@shopify/app-bridge-react";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  Divider,
  Frame,
  InlineStack,
  Layout,
  Modal,
  Page,
  Spinner,
  Text,
  Toast
} from "@shopify/polaris";
import { useEffect, useState } from "react";

// Définir un type pour `fetcher.data`
type MetafieldsResponse = {
  success?: boolean;
  error?: string;
};

export default function Index() {
  const fetcher = useFetcher<MetafieldsResponse>();

  const [toast, setToast] = useState<{ content: string; error?: boolean } | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const isLoading = fetcher.state === "loading";

  useEffect(() => {
    if (fetcher.data) {
      if (fetcher.data.success) {
        setToast({ content: "✅ Action réalisée avec succès !" });
      } else if (fetcher.data.error) {
        setToast({ content: "❌ Une erreur est survenue.", error: true });
      }
    }
  }, [fetcher.data]);

  const handleSubmit = (action: string, data?: Record<string, any>) => {
    fetcher.submit(data || null, { method: "POST", action });
  };

  return (
    <Frame>
      <Page>
        <TitleBar title="Gestion des Metafields" />
        <BlockStack gap="500">
          <Layout>
            {/* ➕ SECTION CRÉATION */}
            <Layout.Section>
              <Card>
                <BlockStack gap="500">
                  <Text as="h2" variant="headingMd">
                    ➕ Créer des Metafields
                  </Text>
                  <Text as="p" variant="bodyMd">
                    Ajouter de nouveaux metafields à votre boutique.
                  </Text>
                  <Button loading={isLoading} primary onClick={() => handleSubmit("/app/create-metafields")}>
                    ➕ Créer les metafields
                  </Button>
                </BlockStack>
              </Card>
            </Layout.Section>

            {/* 🔥 DIVISEUR VISUEL */}
            <Layout.Section>
              <Divider />
            </Layout.Section>

            {/* 🗑️ SECTION SUPPRESSION */}
            <Layout.Section>
              <Card>
                <BlockStack gap="500">
                  <Text as="h2" variant="headingMd">
                    🗑️ Supprimer des Metafields
                  </Text>
                  <Text as="p" variant="bodyMd">
                    Vous pouvez supprimer uniquement les définitions des metafields ou supprimer totalement leurs valeurs.
                  </Text>

                  <InlineStack gap="300">
                    <Button loading={isLoading} onClick={() => handleSubmit("/app/delete-metafields", { deleteValues: false })}>
                      🗑️ Supprimer les définitions
                    </Button>
                    <Button loading={isLoading} destructive onClick={() => setIsDeletingAll(true)}>
                      ⚠️ Supprimer TOUT (définitions + valeurs)
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>
        </BlockStack>

        {/* ✅ Toast Feedback */}
        {toast && <Toast content={toast.content} error={toast.error} onDismiss={() => setToast(null)} />}

        {/* 🔥 Confirmation avant suppression totale */}
        {isDeletingAll && (
          <Modal
            open
            onClose={() => setIsDeletingAll(false)}
            title="Confirmer la suppression"
            primaryAction={{
              content: "Supprimer tout",
              destructive: true,
              onAction: () => {
                setIsDeletingAll(false);
                handleSubmit("/app/delete-metafields", { deleteValues: true });
              },
            }}
            secondaryActions={[
              {
                content: "Annuler",
                onAction: () => setIsDeletingAll(false),
              },
            ]}
          >
            <Modal.Section>
              <Text as="p">
                Cette action est <strong>irréversible</strong>. Tous les metafields et leurs valeurs seront supprimés définitivement.
              </Text>
            </Modal.Section>
          </Modal>
        )}

        {/* ✅ Indicateur de chargement global */}
        {isLoading && (
          <Banner title="Action en cours..." status="info">
            <Spinner size="small" />
            <Text as="p">Veuillez patienter pendant le traitement.</Text>
          </Banner>
        )}
      </Page>
    </Frame>
  );
}
