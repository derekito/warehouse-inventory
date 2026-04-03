import type { NextApiRequest, NextApiResponse } from 'next';
import { addProduct } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  console.log('\n=== Starting New Product Import ===');
  
  try {
    const { products } = req.body;
    
    if (!Array.isArray(products) || products.length === 0) {
      throw new Error('No valid products data provided');
    }

    console.log('New Products to Process:', {
      total: products.length,
      skus: products.map(p => p.sku).filter(Boolean)
    });

    const results = await Promise.all(products.map(async (product: any) => {
      if (!product.sku) {
        throw new Error('SKU is required for import');
      }

      const status: 'active' | 'inactive' =
        product.status?.toLowerCase() === 'inactive' ? 'inactive' : 'active';

      const newProduct = {
        sku: product.sku,
        productName: product.productName || product.ProductName,
        description: product.description || product.Description || '',
        status,
        // Primary Location
        location: {
          loc1: product.location?.loc1 || '',
          loc2: product.location?.loc2 || '',
          loc3: product.location?.loc3 || '',
          loc4: product.location?.loc4 || ''
        },
        onHand: parseInt(product.onHand || product.OnHand) || 0,
        // Secondary Location
        location2: product.location2
          ? {
              loc1: product.location2.loc1 || '',
              loc2: product.location2.loc2 || '',
              loc3: product.location2.loc3 || '',
              loc4: product.location2.loc4 || '',
              onHand: parseInt(product.location2.onHand) || 0
            }
          : undefined,
        // Initialize Shopify configurations
        shopifyProducts: {
          nakedArmor: {
            productId: '',
            variantId: '',
            inventoryItemId: '',
            locationId: process.env.SHOPIFY_STORE_ONE_LOCATION_ID || ''
          },
          grownManShave: {
            productId: '',
            variantId: '',
            inventoryItemId: '',
            locationId: process.env.SHOPIFY_STORE_TWO_LOCATION_ID || ''
          }
        }
      };

      console.log('Formatted new product:', {
        sku: newProduct.sku,
        primaryLoc: newProduct.location,
        secondaryLoc: newProduct.location2,
        onHand: newProduct.onHand
      });

      return await addProduct(newProduct);
    }));

    console.log('\n=== Import Summary ===');
    console.log('Results:', {
      total: products.length,
      imported: results.length,
      processed: results.map(r => r.sku)
    });
    console.log('=== Import Complete ===\n');

    return res.status(200).json({
      success: true,
      results,
      message: `Successfully imported ${results.length} new products`
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