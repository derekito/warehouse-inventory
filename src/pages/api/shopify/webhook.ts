import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import getRawBody from 'raw-body';
import { getProductBySkuAdmin, updateProductAdmin } from '@/lib/db-admin';
import { adminDb } from '@/lib/firebase-admin';
import { withFirestoreRetry } from '@/lib/firestore-retry';

type LineItemResult = {
  sku: string;
  title?: string;
  status: 'updated' | 'skipped_no_sku' | 'skipped_not_in_warehouse' | 'error';
  previousOnHand?: number;
  newOnHand?: number;
  quantitySold?: number;
  saleRecorded?: boolean;
  error?: string;
};

type ProcessOrderResult = {
  topic: string;
  orderId?: string | number;
  orderNumber?: string;
  store: string;
  isTest: boolean;
  lineItems: LineItemResult[];
  summary: {
    total: number;
    updated: number;
    skipped: number;
    errors: number;
  };
};

function webhookLog(message: string, data?: Record<string, unknown>) {
  if (data) {
    console.log(`[WEBHOOK] ${message}`, JSON.stringify(data, null, 2));
  } else {
    console.log(`[WEBHOOK] ${message}`);
  }
}

function getStoreConfig(shopDomain: string) {
  if (shopDomain === process.env.SHOPIFY_STORE_ONE_URL) {
    return {
      name: 'naked-armor',
      secret: process.env.SHOPIFY_STORE_ONE_WEBHOOK_SECRET,
    };
  }
  if (shopDomain === process.env.SHOPIFY_STORE_TWO_URL) {
    return {
      name: 'grown-man-shave',
      secret: process.env.SHOPIFY_STORE_TWO_WEBHOOK_SECRET,
    };
  }
  return null;
}

function verifyWebhook(rawBody: Buffer, hmac: string, secret: string): boolean {
  const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  return hash === hmac;
}

async function logWebhookEvent(payload: {
  store: string;
  topic: string;
  isTest: boolean;
  status: 'success' | 'error';
  result: ProcessOrderResult;
  error?: string;
}) {
  try {
    await withFirestoreRetry(
      () =>
        adminDb.collection('webhook_events').add({
          store: payload.store === 'naked-armor' ? 'nakedArmor' : 'grownManShave',
          eventType: payload.topic === 'orders/create' ? 'order_created' : 'other',
          status: payload.status,
          payload: {
            isTest: payload.isTest,
            summary: payload.result.summary,
            lineItems: payload.result.lineItems,
            orderId: payload.result.orderId,
            orderNumber: payload.result.orderNumber,
          },
          ...(payload.error !== undefined && { error: payload.error }),
          timestamp: new Date(),
          processedAt: new Date(),
        }),
      'webhook_events.add'
    );
  } catch (err) {
    webhookLog('Failed to persist webhook_events record (processing may still have succeeded)', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function processOrder(
  order: {
    id?: string | number;
    order_number?: string;
    line_items?: Array<{
      sku?: string;
      quantity?: number;
      title?: string;
      price?: string;
      price_set?: { shop_money?: { amount?: string } };
    }>;
  },
  storeConfig: { name: string },
  meta: { topic: string; isTest: boolean }
): Promise<ProcessOrderResult> {
  const lineItems: LineItemResult[] = [];
  const items = order.line_items ?? [];

  webhookLog('Processing order', {
    topic: meta.topic,
    store: storeConfig.name,
    isTest: meta.isTest,
    orderId: order.id,
    orderNumber: order.order_number,
    lineItemCount: items.length,
    skus: items.map((i) => i.sku).filter(Boolean),
  });

  if (meta.topic !== 'orders/create') {
    webhookLog('Unsupported topic — no inventory change applied', { topic: meta.topic });
    return {
      topic: meta.topic,
      orderId: order.id,
      orderNumber: order.order_number,
      store: storeConfig.name,
      isTest: meta.isTest,
      lineItems: [],
      summary: { total: 0, updated: 0, skipped: 0, errors: 0 },
    };
  }

  for (const item of items) {
    const sku = item.sku?.trim();
    const quantity = Number(item.quantity ?? 0);

    if (!sku) {
      webhookLog('Skipping line item — no SKU', { title: item.title, quantity });
      lineItems.push({
        sku: '(missing)',
        title: item.title,
        status: 'skipped_no_sku',
      });
      continue;
    }

    try {
      const lookupStarted = Date.now();
      webhookLog('Looking up warehouse product by SKU', { sku, quantitySold: quantity });

      const product = await getProductBySkuAdmin(sku);
      webhookLog('SKU lookup finished', {
        sku,
        found: Boolean(product),
        durationMs: Date.now() - lookupStarted,
      });
      if (!product) {
        webhookLog('SKU not in warehouse database — no inventory change', {
          sku,
          hint: 'Add this SKU to Firestore products or use a real order SKU when testing',
        });
        lineItems.push({
          sku,
          title: item.title,
          status: 'skipped_not_in_warehouse',
          quantitySold: quantity,
        });
        continue;
      }

      const previousOnHand = product.onHand;
      const newOnHand = Math.max(0, previousOnHand - quantity);

      webhookLog('Decrementing master inventory', {
        sku,
        productId: product.id,
        previousOnHand,
        quantitySold: quantity,
        newOnHand,
      });

      await updateProductAdmin(product.id, {
        onHand: newOnHand,
        lastUpdated: new Date(),
      });

      let saleRecorded = false;
      try {
        const storeKey =
          storeConfig.name === 'naked-armor' ? 'nakedArmor' : 'grownManShave';
        const unitPrice =
          Number(item.price) || Number(item.price_set?.shop_money?.amount) || 0;
        const revenue = unitPrice * quantity;

        await withFirestoreRetry(
          () =>
            adminDb.collection('sales').add({
              date: new Date(),
              store: storeKey,
              quantity,
              revenue,
              productId: product.id,
              sku,
            }),
          `sales.add(${sku})`
        );
        saleRecorded = true;
      } catch (salesError) {
        webhookLog('Inventory updated but sale record failed', {
          sku,
          error: salesError instanceof Error ? salesError.message : String(salesError),
        });
      }

      webhookLog('Line item complete — inventory updated', {
        sku,
        previousOnHand,
        newOnHand,
        saleRecorded,
      });

      lineItems.push({
        sku,
        title: item.title,
        status: 'updated',
        previousOnHand,
        newOnHand,
        quantitySold: quantity,
        saleRecorded,
      });
    } catch (itemError) {
      const message = itemError instanceof Error ? itemError.message : String(itemError);
      webhookLog('Line item failed', { sku, error: message });
      lineItems.push({
        sku,
        title: item.title,
        status: 'error',
        quantitySold: quantity,
        error: message,
      });
    }
  }

  const summary = {
    total: lineItems.length,
    updated: lineItems.filter((i) => i.status === 'updated').length,
    skipped: lineItems.filter((i) => i.status.startsWith('skipped')).length,
    errors: lineItems.filter((i) => i.status === 'error').length,
  };

  webhookLog('Order processing summary', summary);

  return {
    topic: meta.topic,
    orderId: order.id,
    orderNumber: order.order_number,
    store: storeConfig.name,
    isTest: meta.isTest,
    lineItems,
    summary,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const topic = (req.headers['x-shopify-topic'] as string) || 'unknown';
  const shopDomain = req.headers['x-shopify-shop-domain'] as string;
  const isTest = req.headers['x-shopify-test'] === 'true';

  try {
    const startedAt = Date.now();
    const rawBody = await getRawBody(req);
    const hmac = req.headers['x-shopify-hmac-sha256'] as string;

    webhookLog('Received', { topic, shop: shopDomain, isTest });

    const storeConfig = getStoreConfig(shopDomain);
    if (!storeConfig?.secret) {
      webhookLog('Rejected — unknown shop or missing webhook secret', { shopDomain });
      return res.status(403).json({ message: 'Unauthorized shop' });
    }

    if (!verifyWebhook(rawBody, hmac, storeConfig.secret)) {
      webhookLog('Rejected — invalid HMAC signature', { shop: shopDomain });
      return res.status(403).json({ message: 'Invalid signature' });
    }

    webhookLog('Signature verified', { store: storeConfig.name });

    const order = JSON.parse(rawBody.toString('utf8'));

    // Must await processing before responding — Vercel kills the function after res.end()
    const result = await processOrder(order, storeConfig, { topic, isTest });

    await logWebhookEvent({
      store: storeConfig.name,
      topic,
      isTest,
      status: result.summary.errors === 0 ? 'success' : 'error',
      result,
    });

    const responseBody = {
      success: result.summary.errors === 0,
      message: 'Webhook processed',
      ...result,
    };

    webhookLog('Responding to Shopify', {
      success: responseBody.success,
      summary: result.summary,
      durationMs: Date.now() - startedAt,
    });

    return res.status(200).json(responseBody);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    webhookLog('Fatal webhook error', { error: message });
    return res.status(500).json({ success: false, message: 'Internal server error', error: message });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
