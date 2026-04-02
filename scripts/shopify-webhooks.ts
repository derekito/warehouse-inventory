const { createAdminApiClient } = require('@shopify/admin-api-client');
const dotenv = require('dotenv');

dotenv.config();

// Simple client creation just for webhook registration
function getWebhookClient(store) {
  const config = {
    storeDomain: store === 'naked-armor' 
      ? process.env.SHOPIFY_STORE_ONE_URL 
      : process.env.SHOPIFY_STORE_TWO_URL,
    accessToken: store === 'naked-armor'
      ? process.env.SHOPIFY_STORE_ONE_ACCESS_TOKEN
      : process.env.SHOPIFY_STORE_TWO_ACCESS_TOKEN,
    apiVersion: '2025-10'
  };

  return createAdminApiClient(config);
}

async function deleteExistingWebhooks(client) {
  const query = `
    query {
      webhookSubscriptions(first: 10) {
        edges {
          node {
            id
          }
        }
      }
    }
  `;

  const mutation = `
    mutation webhookSubscriptionDelete($id: ID!) {
      webhookSubscriptionDelete(id: $id) {
        deletedWebhookSubscriptionId
        userErrors {
          field
          message
        }
      }
    }
  `;

  try {
    // Get existing webhooks
    const { data } = await client.request(query);
    
    // Delete each webhook
    for (const edge of data.webhookSubscriptions.edges) {
      await client.request(mutation, {
        variables: {
          id: edge.node.id
        }
      });
      console.log('Deleted webhook:', edge.node.id);
    }
  } catch (error) {
    console.error('Error deleting webhooks:', error);
  }
}

async function registerWebhook(store) {
  const client = getWebhookClient(store);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  
  const webhookEndpoint = `${appUrl}/api/webhooks/${store}/inventory`;
  
  const mutation = `
    mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookUrl: URL!) {
      webhookSubscriptionCreate(
        topic: $topic,
        webhookSubscription: {
          format: JSON,
          endpoint: {
            deliveryMethod: HTTP,
            url: $webhookUrl
          }
        }
      ) {
        webhookSubscription {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  try {
    // First, delete any existing webhooks
    await deleteExistingWebhooks(client);
    
    // Then create new webhook
    const response = await client.request(mutation, {
      variables: {
        topic: "INVENTORY_LEVELS_UPDATE",
        webhookUrl: webhookEndpoint
      }
    });

    console.log(`Webhook registered for ${store}:`, response);
    return response;
  } catch (error) {
    console.error(`Failed to register webhook for ${store}:`, error);
    throw error;
  }
}

async function registerAllWebhooks() {
  try {
    console.log('Registering webhooks for Naked Armor...');
    await registerWebhook('naked-armor');
    
    console.log('Registering webhooks for Grown Man Shave...');
    await registerWebhook('grown-man-shave');
    
    console.log('All webhooks registered successfully');
  } catch (error) {
    console.error('Failed to register webhooks:', error);
    process.exit(1);
  }
}

registerAllWebhooks();