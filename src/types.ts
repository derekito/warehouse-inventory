export interface Product {
  id: string;
  sku: string;
  productName: string;
  description?: string;
  onHand: number;
  status: 'active' | 'inactive';
  createdAt: Timestamp;
  lastUpdated: Timestamp;
  userId: string;
  location: {
    loc1: string;
    loc2: string;
    loc3: string;
    loc4: string;
  };
  location2?: {
    loc1: string;
    loc2: string;
    loc3: string;
    loc4: string;
    onHand: number;
  };
  shopifyProducts: {
    nakedArmor: {
      productId: string;
      variantId: string;
      inventoryItemId: string;
      locationId?: string;
    };
    grownManShave: {
      productId: string;
      variantId: string;
      inventoryItemId: string;
      locationId?: string;
    };
  };
}

export interface WebhookEvent {
  id: string;
  store: 'nakedArmor' | 'grownManShave';
  eventType: 'inventory_update' | 'product_update' | 'order_created' | 'refund';
  payload: {
    sku?: string;
    productId?: string;
    variantId?: string;
    quantity?: number;
    orderId?: string;
    previousQuantity?: number;
    newQuantity?: number;
  };
  status: 'success' | 'error';
  error?: string;
  timestamp: Date;
  processedAt?: Date;
}

export interface CronJob {
  id: string;
  type: 'sync' | 'cleanup' | 'backup';
  status: 'success' | 'error' | 'running';
  startTime: Date;
  endTime?: Date;
  error?: string;
  details?: {
    productsProcessed?: number;
    nakedArmorSync?: boolean;
    grownManShaveSync?: boolean;
    [key: string]: any;
  };
}

export interface Location {
  id?: string;
  name: string;
  // Add other location fields as needed
}

export interface InventoryUpdate {
  id?: string;
  productSku: string;
  quantity: number;
  type: 'increment' | 'decrement' | 'set';
  timestamp: Date;
  userId: string;
  notes?: string;
} 