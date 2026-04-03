import { NextApiRequest, NextApiResponse } from 'next';
import { adminDb as db } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { store } = req.query;
  const topic = req.headers['x-shopify-topic'];
  const payload = req.body;

  console.log('[WEBHOOK] Starting webhook processing:', {
    store,
    topic,
    headers: req.headers,
    body: req.body
  });

  try {
    // Initialize webhook_events collection if it doesn't exist
    const webhookCollection = db.collection('webhook_events');
    
    // Create a test document to ensure collection exists
    const testDoc = await webhookCollection.doc('_test').get();
    if (!testDoc.exists) {
      await webhookCollection.doc('_test').set({
        type: 'test',
        timestamp: new Date(),
        message: 'Collection initialization document'
      });
      console.log('[WEBHOOK] Created webhook_events collection');
    }

    const webhookData = {
      store: store === 'store-one' ? 'nakedArmor' : 'grownManShave',
      eventType: topic === 'orders/create' ? 'order_created' : 
                 topic === 'inventory_levels/update' ? 'inventory_update' : 
                 topic === 'refunds/create' ? 'refund' : 'other',
      payload,
      status: 'success',
      timestamp: new Date(),
      processedAt: new Date()
    };

    console.log('[WEBHOOK] Attempting to save data:', webhookData);

    const docRef = await webhookCollection.add(webhookData);

    console.log('[WEBHOOK] Successfully saved webhook with ID:', docRef.id);

    // Verify the document was saved
    const savedDoc = await docRef.get();
    console.log('[WEBHOOK] Verification - Document exists:', savedDoc.exists);
    if (savedDoc.exists) {
      console.log('[WEBHOOK] Saved data:', savedDoc.data());
    }

    res.status(200).json({ 
      message: 'Webhook processed',
      id: docRef.id,
      data: webhookData
    });
  } catch (error) {
    console.error('[WEBHOOK] Error processing webhook:', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    
    try {
      const webhookCollection = db.collection('webhook_events');
      await webhookCollection.add({
        store: store === 'store-one' ? 'nakedArmor' : 'grownManShave',
        eventType: topic === 'orders/create' ? 'order_created' : 
                   topic === 'inventory_levels/update' ? 'inventory_update' : 
                   topic === 'refunds/create' ? 'refund' : 'other',
        payload,
        status: 'error',
        error: errMsg,
        timestamp: new Date(),
        processedAt: new Date()
      });
    } catch (logError) {
      console.error('[WEBHOOK] Failed to log webhook error:', logError);
    }

    res.status(500).json({ message: 'Webhook processing failed' });
  }
} 