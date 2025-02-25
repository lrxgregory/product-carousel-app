import { useFetcher } from "@remix-run/react";
import { TitleBar } from "@shopify/app-bridge-react";
import {
  BlockStack,
  Button,
  Card,
  Frame,
  InlineStack,
  Layout,
  Modal,
  Page,
  Text,
  Toast
} from "@shopify/polaris";
import {
  DeleteIcon, PlusIcon
} from '@shopify/polaris-icons';
import { useEffect, useState } from "react";



// Define a type for `fetcher.data`
type MetafieldsResponse = {
  success?: boolean;
  error?: string;
};

export default function Index() {
  const fetcher = useFetcher<MetafieldsResponse>();

  const [toast, setToast] = useState<{ content: string; error?: boolean } | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const isLoading = fetcher.state === "loading";

  useEffect(() => {
    if (fetcher.data?.success) {
      setToast({ content: `✅ ${actionMessage} successfully!` });
    } else if (fetcher.data?.error) {
      setToast({ content: "❌ An error occurred.", error: true });
    }
  }, [fetcher.data, actionMessage]);

  const handleSubmit = (action: string, message: string, data?: Record<string, any>) => {
    setActionMessage(message);
    fetcher.submit(data || null, { method: "POST", action });
  };

  return (
    <Frame>
      <Page>
        <TitleBar title="Metafields Management" />
        <BlockStack gap="500">
          <Layout>
            {/* ➕ CREATE SECTION */}
            <Layout.Section>
              <Card>
                <BlockStack gap="500">
                  <Text as="h2" variant="headingMd" fontWeight="bold">
                    Add metafields
                  </Text>
                  <Text as="p" variant="bodyMd">
                    The metafields should be created automatically when the app is installed, but if an issue occurred or you removed them, you can create them again.
                  </Text>
                  <InlineStack>
                    <Button
                      loading={isLoading}
                      variant="primary"
                      icon={PlusIcon}
                      onClick={() => handleSubmit("/app/create-metafields", "Metafields created")}
                    >
                      Create Metafields
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>

            {/* 🗑️ DELETE SECTION */}
            <Layout.Section>
              <Card>
                <BlockStack gap="500">
                  <Text as="h2" variant="headingMd" fontWeight="bold">
                    Delete Metafields
                  </Text>
                  <Text as="p" variant="bodyMd">
                    You can delete only metafield definitions or completely remove their values.
                  </Text>

                  <InlineStack gap="200">
                    <Button
                      loading={isLoading}
                      icon={DeleteIcon}
                      tone="critical"
                      onClick={() => handleSubmit("/app/delete-metafields", "Metafield definitions deleted", { deleteValues: false })}
                    >
                      Delete Definitions
                    </Button>
                    <Button
                      loading={isLoading}
                      icon={DeleteIcon}
                      tone="critical"
                      variant="primary"
                      onClick={() => {
                        setIsDeletingAll(true);
                        setActionMessage("All metafields deleted");
                      }}
                    >
                      Delete All
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>
        </BlockStack>

        {/* ✅ Toast Feedback */}
        {toast && <Toast content={toast.content} error={toast.error} onDismiss={() => setToast(null)} />}

        {/* 🔥 Confirmation before total deletion */}
        {isDeletingAll && (
          <Modal
            open
            onClose={() => setIsDeletingAll(false)}
            title="Confirm Deletion"
            primaryAction={{
              content: "Delete All",
              destructive: true,
              onAction: () => {
                setIsDeletingAll(false);
                handleSubmit("/app/delete-metafields", "All metafields deleted", { deleteValues: true });
              },
            }}
            secondaryActions={[{ content: "Cancel", onAction: () => setIsDeletingAll(false) }]}
          >
            <Modal.Section>
              <Text as="p">
                This action is <strong>irreversible</strong>. All metafields and their values will be permanently deleted.
              </Text>
            </Modal.Section>
          </Modal>
        )}
      </Page>
    </Frame>
  );
}
