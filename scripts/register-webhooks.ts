const { registerShopifyWebhooks } = require('../src/lib/shopify');
const dotenv = require('dotenv');

dotenv.config();

async function registerAllWebhooks() {
  try {
    console.log('Registering webhooks for Naked Armor...');
    await registerShopifyWebhooks('naked-armor');
    
    console.log('Registering webhooks for Grown Man Shave...');
    await registerShopifyWebhooks('grown-man-shave');
    
    console.log('All webhooks registered successfully');
  } catch (error) {
    console.error('Failed to register webhooks:', error);
    process.exit(1);
  }
}

registerAllWebhooks(); 