import { NextApiRequest, NextApiResponse } from 'next';
import { adminDb as db } from '@/lib/firebase-admin';
import { syncProductWithBothStores } from '@/lib/shopify';
import { Product } from '@/types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check for cron authentication
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  if (!authHeader || `Bearer ${cronSecret}` !== authHeader) {
    console.log('Unauthorized cron attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('Starting incremental sync from cron...');

    // Get last sync timestamp
    const syncRef = db.collection('sync_history').doc('last_sync');
    const lastSync = await syncRef.get();
    const lastSyncTime = lastSync.exists ? lastSync.data()?.timestamp : new Date(0);

    // Query for products modified since last sync
    const productsRef = db.collection('products');
    const updatedProducts = await productsRef
      .where('lastUpdated', '>', lastSyncTime)
      .get();

    if (updatedProducts.empty) {
      return res.json({ 
        success: true, 
        message: 'No products updated since last sync',
        details: {
          productsUpdated: 0
        }
      });
    }

    // Process only updated products
    const products = updatedProducts.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Product[];

    let totalSucceeded = 0;
    let totalFailed = 0;
    const allResults = [];

    // Sync each product with both stores
    for (const product of products) {
      const results = await syncProductWithBothStores(product);
      allResults.push(...results);
      
      results.forEach(result => {
        if (result.success) totalSucceeded++;
        else totalFailed++;
      });
    }

    // Update last sync timestamp
    await syncRef.set({
      timestamp: new Date(),
      productCount: products.length,
      type: 'incremental'
    });

    return res.json({
      success: totalFailed === 0,
      details: {
        productsUpdated: products.length,
        summary: {
          total: totalSucceeded + totalFailed,
          succeeded: totalSucceeded,
          failed: totalFailed
        },
        results: allResults
      }
    });

  } catch (error) {
    console.error('Incremental sync failed:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 