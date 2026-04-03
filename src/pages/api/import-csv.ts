import type { NextApiRequest, NextApiResponse } from 'next';
import { upsertProductFromCsv } from '@/lib/db';
import { serverTimestamp } from 'firebase/firestore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  console.log('\n=== Starting CSV Import ===');
  
  try {
    const { products } = req.body;
    
    // Validate products array
    if (!Array.isArray(products) || products.length === 0) {
      throw new Error('No valid products data provided');
    }

    console.log('Products to Process:', {
      total: products.length,
      skus: products.map(p => p.sku).filter(Boolean)
    });

    const results = await Promise.all(products.map(async (product: any) => {
      if (!product.sku) {
        throw new Error('SKU is required for import');
      }

      // Format the location data
      const formattedProduct = {
        ...product,
        // Format primary location
        location: {
          loc1: product.location?.loc1 || '',
          loc2: product.location?.loc2 || '',
          loc3: product.location?.loc3 || '',
          loc4: product.location?.loc4 || ''
        },
        onHand: parseInt(product.onHand) || 0,
        // Format secondary location
        location2: product.location2 ? {
          loc1: product.location2.loc1 || '',
          loc2: product.location2.loc2 || '',
          loc3: product.location2.loc3 || '',
          loc4: product.location2.loc4 || '',
          onHand: parseInt(product.location2.onHand) || 0
        } : null
      };

      console.log('Formatted product for import:', {
        sku: formattedProduct.sku,
        primaryLoc: formattedProduct.location,
        secondaryLoc: formattedProduct.location2,
        onHand: formattedProduct.onHand
      });

      return await upsertProductFromCsv(formattedProduct);
    }));

    console.log('\n=== Import Summary ===');
    console.log('Results:', {
      total: products.length,
      updated: results.length,
      failed: 0,
      processed: results.map(r => r.sku),
      errors: []
    });
    console.log('=== Import Complete ===\n');

    return res.status(200).json({
      success: true,
      results,
      message: `Successfully processed ${results.length} products`
    });

  } catch (error) {
    console.error('Import error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      success: false,
      message
    });
  }
} 