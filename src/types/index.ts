// Product Types
export interface Product {
  id?: string;
  sku: string;
  productName: string;
  description?: string;
  status?: 'active' | 'inactive';
  // Primary Location
  location?: {
    loc1: string;
    loc2: string;
    loc3: string;
    loc4: string;
  };
  onHand: number;
  // Secondary Location
  location2?: {
    loc1: string;
    loc2: string;
    loc3: string;
    loc4: string;
    onHand: number;
  };
  lastUpdated?: any; // Timestamp
  createdAt?: any; // Timestamp
  userId?: string;
  shopifyProducts?: {
    nakedArmor?: ShopifyStoreConfig;
    grownManShave?: ShopifyStoreConfig;
  };
}

// Location Types
export interface Location {
  id?: string;
  name: string;
  code: string;
  type: string;
}

// Inventory Update Types
export interface InventoryUpdate {
  id?: string;
  productSku: string;
  quantity: number;
  type: 'increment' | 'decrement' | 'set';
  timestamp?: Date;
  userId?: string;
  notes?: string;
}

// User Types
export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
  preferences: {
    defaultWarehouse?: string;
    notifications?: {
      lowStock: boolean;
      inventoryUpdates: boolean;
    };
  };
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Shopify Types
export interface ShopifyInventoryUpdate {
  inventory_item_id: string;
  location_id: string;
  available: number;
  updated_at: string;
}

// Shopify Store Config Type
export interface ShopifyStoreConfig {
  productId: string;
  variantId: string;
  inventoryItemId: string;
  locationId?: string;
}

export interface WebhookEvent {
  id: string;
  store: 'nakedArmor' | 'grownManShave';
  eventType: 'order_created' | 'inventory_update' | 'refund' | 'other';
  payload: any;
  status: 'success' | 'error';
  timestamp: Date;
  processedAt: Date;
  error?: string;
} 