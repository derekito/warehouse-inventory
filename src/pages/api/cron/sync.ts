import { NextApiRequest, NextApiResponse } from 'next';
import { adminDb as db } from '@/lib/firebase-admin';
import { syncInventoryWithShopify } from '@/lib/shopify';
import { Product } from '@/types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Verify cron secret
  if (req.headers['x-cron-token'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  let jobId: string | undefined;

  try {
    // Get all products from Firestore
    const snapshot = await db.collection('products').get();
    
    const products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Product[];  // Fix type error by asserting as Product[]

    // Filter products with SKUs
    const syncableProducts = products.filter(product => product.sku);

    if (syncableProducts.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No products to sync'
      });
    }

    // Create a job record
    const jobRef = await db.collection('cron_jobs').add({
      startTime: new Date(),
      status: 'running',
      type: 'full_sync'
    });
    jobId = jobRef.id;

    const results = await Promise.all(
      syncableProducts.map(async (product) => {
        const nakedArmorResult = await syncInventoryWithShopify(product, 'naked-armor');
        const grownManResult = await syncInventoryWithShopify(product, 'grown-man-shave');
        return [nakedArmorResult, grownManResult];
      })
    );

    // Update job status
    await jobRef.update({
      status: 'completed',
      endTime: new Date(),
      results
    });

    return res.status(200).json({
      success: true,
      jobId,
      results
    });

  } catch (err) {
    // Log error status if job was started
    const error = err as Error;  // Type assertion
    if (jobId) {
      await db.collection('cron_jobs').doc(jobId).update({
        status: 'error',
        error: error.message,
        endTime: new Date()
      });
    }

    console.error('Sync error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
} 