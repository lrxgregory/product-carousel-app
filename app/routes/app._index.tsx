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
import {
  DeleteIcon,
  PlusCircleIcon
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
  const isLoading = fetcher.state === "loading";

  useEffect(() => {
    if (fetcher.data?.success) {
      setTimeout(() => setToast({ content: "✅ Action completed successfully!" }), 200);
    } else if (fetcher.data?.error) {
      setTimeout(() => setToast({ content: "❌ An error occurred.", error: true }), 200);
    }
  }, [fetcher.data]);

  const handleSubmit = (action: string, data?: Record<string, any>) => {
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
                    The metafields should be created automatically when the app is installed, but if an issue occured or you removed them, you can create them again.
                  </Text>
                  <InlineStack>
                    <Button
                      loading={isLoading}
                      variant="primary"
                      icon={PlusCircleIcon}
                      onClick={() => handleSubmit("/app/create-metafields")}
                    >
                      Create Metafields
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>

            {/* 🔥 VISUAL DIVIDER */}
            <Layout.Section>
              <Divider />
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
                    <Button loading={isLoading} icon={DeleteIcon} tone="critical" onClick={() => handleSubmit("/app/delete-metafields", { deleteValues: false })}>
                      Delete Definitions
                    </Button>
                    <Button
                      loading={isLoading}
                      icon={DeleteIcon}
                      tone="critical"
                      variant="primary"
                      onClick={() => setIsDeletingAll(true)}
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
                handleSubmit("/app/delete-metafields", { deleteValues: true });
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

        {/* ✅ Global loading indicator */}
        {isLoading && (
          <Banner title="Action in progress..." tone="info">
            <Spinner size="small" />
            Please wait while processing.
          </Banner>
        )}
      </Page>
    </Frame>
  );
}
