import { NextApiRequest, NextApiResponse } from 'next';
import { recordWebhookEvent } from '@/lib/db';
import { verifyShopifyWebhook } from '@/lib/shopify';
import { adminDb } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { store } = req.query;
  if (store !== 'naked-armor' && store !== 'grown-man-shave') {
    return res.status(400).json({ error: 'Invalid store identifier' });
  }

  try {
    // Verify webhook authenticity
    const isValid = await verifyShopifyWebhook(req);
    if (!isValid) {
      throw new Error('Invalid webhook signature');
    }

    const payload = req.body;
    console.log('Received inventory webhook payload:', payload);

    // Extract inventory information from Shopify webhook
    const inventoryLevel = payload.inventory_level;
    const inventoryItemId = inventoryLevel.inventory_item_id;
    const newQuantity = inventoryLevel.available;

    // Find product by Shopify inventory item ID
    const storeKey = store === 'naked-armor' ? 'nakedArmor' : 'grownManShave';
    const productsRef = adminDb.collection('products');
    const productQuery = await productsRef
      .where(`shopifyProducts.${storeKey}.inventoryItemId`, '==', inventoryItemId)
      .get();

    if (productQuery.empty) {
      throw new Error(`No product found for inventory item ID: ${inventoryItemId}`);
    }

    const product = productQuery.docs[0];
    const productData = product.data();
    const previousQuantity = productData.onHand;

    // Record the webhook event
    await recordWebhookEvent({
      timestamp: new Date(),
      store: store === 'naked-armor' ? 'nakedArmor' : 'grownManShave',
      eventType: 'inventory_update',
      status: 'success',
      payload: {
        sku: productData.sku,
        previousQuantity,
        newQuantity,
        inventoryItemId
      }
    });

    // Update the product inventory
    await product.ref.update({
      onHand: newQuantity,
      lastUpdated: new Date()
    });

    console.log('Updated inventory:', {
      sku: productData.sku,
      previousQuantity,
      newQuantity,
      store
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    
    // Record the error event
    await recordWebhookEvent({
      timestamp: new Date(),
      store: store === 'naked-armor' ? 'nakedArmor' : 'grownManShave',
      eventType: 'inventory_update',
      status: 'error',
      payload: {
        error: error instanceof Error ? error.message : 'Unknown error',
        originalBody: req.body
      }
    });

    res.status(500).json({ error: 'Webhook processing failed' });
  }
} 