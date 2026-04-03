import { db } from './firebase';
import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, Timestamp, serverTimestamp, limit, setDoc, orderBy, documentId } from 'firebase/firestore';
import { Product, Location, InventoryUpdate, WebhookEvent, CronJob } from '../types';
import { auth } from './firebase';
import { getAuth } from 'firebase/auth';

// Collections
export const productsCollection = collection(db, 'products');
export const locationsCollection = collection(db, 'locations');
export const inventoryUpdatesCollection = collection(db, 'inventory_updates');
export const webhookEventsCollection = collection(db, 'webhook_events');
export const cronJobsCollection = collection(db, 'cron_jobs');

// Test data function
export async function createTestProduct() {
  try {
    if (!auth.currentUser) {
      throw new Error('User must be authenticated to create products');
    }

    const testProduct = {
      sku: `TEST-${Date.now()}`,
      productName: 'Test Product',
      warehouseName: 'Main Warehouse',
      location: {
        loc1: 'A',
        loc2: '01',
        loc3: 'B',
        loc4: '01'
      },
      onHand: 100,
      lastUpdated: Timestamp.now(),
      storeIdentifier: 'naked-armor',
      shopifyProductId: `test-${Date.now()}`,
      status: 'active',
      userId: auth.currentUser.uid,
      createdAt: Timestamp.now()
    };

    const docRef = await addDoc(productsCollection, testProduct);
    console.log('Test product created with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating test product:', error);
    throw error;
  }
}

// Product Operations
export async function getProduct(sku: string): Promise<Product | null> {
  const q = query(productsCollection, where('sku', '==', sku));
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) {
    return null;
  }
  
  const doc = querySnapshot.docs[0];
  return { ...doc.data(), id: doc.id } as Product;
}

export async function getAllProducts(): Promise<Product[]> {
  const querySnapshot = await getDocs(productsCollection);
  return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Product);
}

export async function addProduct(productData: Omit<Product, 'id' | 'createdAt' | 'userId' | 'lastUpdated'>) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User must be logged in to add a product');

    const newProduct = {
      ...productData,
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp(),
      userId: user.uid,
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

    const docRef = await addDoc(collection(db, 'products'), newProduct);
    return { id: docRef.id, ...newProduct };
  } catch (error) {
    console.error('Error adding product:', error);
    throw error;
  }
}

export async function updateProduct(productId: string, data: any) {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const productRef = doc(db, 'products', productId);
    const productSnap = await getDoc(productRef);

    if (!productSnap.exists()) {
      throw new Error('Product not found');
    }

    const currentData = productSnap.data();
    
    // Create update data without undefined values
    const updateData = {
      ...data,
      lastUpdated: serverTimestamp(),
      updatedBy: user.uid,
      createdAt: currentData.createdAt,
      userId: currentData.userId || user.uid,
      sku: currentData.sku
    };

    // Check if onHand quantity has changed
    if (data.onHand !== undefined && data.onHand !== currentData.onHand) {
      // Log the inventory update
      await addDoc(inventoryUpdatesCollection, {
        productId,
        productSku: currentData.sku,
        quantity: data.onHand - currentData.onHand, // Calculate the difference
        previousQuantity: currentData.onHand,
        newQuantity: data.onHand,
        timestamp: serverTimestamp(),
        userId: user.uid,
        type: 'manual',
        status: 'success'
      });
    }

    // Remove any undefined values
    Object.keys(updateData).forEach(key => 
      updateData[key] === undefined && delete updateData[key]
    );

    await updateDoc(productRef, updateData);
    
    console.log("Update successful:", {
      productId,
      updatedFields: Object.keys(updateData)
    });

  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Detailed error in updateProduct:", {
        error: error.message,
        errorCode: (error as any).code,
        errorMessage: error.message,
        errorDetails: (error as any).details
      });
    } else {
      console.error("Unknown error in updateProduct:", error);
    }
    throw error;
  }
}

export async function deleteProduct(id: string): Promise<void> {
  try {
    const productRef = doc(db, 'products', id);
    await deleteDoc(productRef);
  } catch (error) {
    console.error('Error deleting product:', error);
    throw error;
  }
}

// Location Operations
export async function getLocation(id: string): Promise<Location | null> {
  const docRef = doc(locationsCollection, id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  return { ...docSnap.data(), id: docSnap.id } as Location;
}

export async function getAllLocations(): Promise<Location[]> {
  const querySnapshot = await getDocs(locationsCollection);
  return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Location);
}

// Inventory Update Operations
export async function recordInventoryUpdate(update: Omit<InventoryUpdate, 'id' | 'timestamp'>): Promise<string> {
  const docRef = await addDoc(inventoryUpdatesCollection, {
    ...update,
    timestamp: new Date()
  });
  return docRef.id;
}

export async function getInventoryUpdates(productSku: string): Promise<InventoryUpdate[]> {
  const q = query(inventoryUpdatesCollection, where('productSku', '==', productSku));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as InventoryUpdate);
}

export async function searchProductsBySku(searchTerm: string): Promise<Product[]> {
  try {
    const q = query(
      productsCollection,
      where('sku', '>=', searchTerm),
      where('sku', '<=', searchTerm + '\uf8ff')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Product);
  } catch (error) {
    console.error('Error searching products:', error);
    throw error;
  }
}

// Shopify Configuration Operations
export async function updateShopifyConfig(
  productId: string, 
  store: 'nakedArmor' | 'grownManShave',
  config: ShopifyStoreConfig
) {
  try {
    const productRef = doc(db, 'products', productId);
    const productSnap = await getDoc(productRef);
    
    if (!productSnap.exists()) {
      throw new Error('Product not found');
    }

    const currentProduct = productSnap.data() as Product;
    const shopifyProducts = currentProduct.shopifyProducts || {};

    await updateDoc(productRef, {
      shopifyProducts: {
        ...shopifyProducts,
        [store]: config
      },
      lastUpdated: serverTimestamp()
    });

    return {
      ...currentProduct,
      shopifyProducts: {
        ...shopifyProducts,
        [store]: config
      }
    };
  } catch (error) {
    console.error('Error updating Shopify config:', error);
    throw error;
  }
}

// Update the ShopifyStoreConfig type
export type ShopifyStoreConfig = {
  productId: string;
  variantId: string;
  inventoryItemId: string;
  locationId?: string;  // Make optional since we'll use env var as fallback
};

// Add this function if it doesn't exist
export async function getProductBySku(sku: string) {
  try {
    const q = query(productsCollection, where('sku', '==', sku));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) return null;
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error('Error getting product by SKU:', error);
    throw error;
  }
}

// First, add a function to get product ID by SKU
async function getProductIdBySku(sku: string): Promise<string | null> {
  const q = query(productsCollection, where('sku', '==', sku.trim()));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) return null;
  return snapshot.docs[0].id;
}

// Modify the upsertProductFromCsv function to use a transaction
export async function upsertProductFromCsv(productData: any) {
  try {
    if (!productData.sku) {
      throw new Error('SKU is required for import');
    }

    console.log('Processing SKU:', productData.sku);

    // Query for existing product
    const q = query(productsCollection, where('sku', '==', productData.sku));
    const querySnapshot = await getDocs(q);

    // If product exists, update it
    if (!querySnapshot.empty) {
      const existingDoc = querySnapshot.docs[0];
      const updateData = {
        ...productData,
        lastUpdated: serverTimestamp()
      };

      await updateDoc(doc(db, 'products', existingDoc.id), updateData);
      
      return {
        status: 'updated',
        sku: productData.sku,
        id: existingDoc.id
      };
    } 
    // If product doesn't exist, create it
    else {
      // Add Shopify configurations for new products
      const newProduct = {
        ...productData,
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
        },
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp()
      };

      const docRef = await addDoc(productsCollection, newProduct);
      
      return {
        status: 'created',
        sku: productData.sku,
        id: docRef.id
      };
    }

  } catch (error) {
    console.error('Error in upsertProductFromCsv:', error);
    throw error;
  }
}

// Test function using same approach as getProductBySku
export async function testSkuLookup(sku: string) {
  try {
    if (!sku) {
      throw new Error('SKU is required');
    }

    // Use the same collection reference and query structure as getProductBySku
    const q = query(productsCollection, where('sku', '==', sku));
    const querySnapshot = await getDocs(q);

    // Log the results
    console.log('SKU Lookup Results:', {
      searchedSku: sku,
      found: querySnapshot.size,
      matches: querySnapshot.docs.map(doc => ({
        id: doc.id,
        sku: doc.data().sku,
        productName: doc.data().productName
      }))
    });

    // Return in the same format as other functions
    if (querySnapshot.empty) return [];
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

  } catch (error) {
    console.error('SKU Lookup Error:', error);
    throw error;
  }
}

// Add this function
export async function verifyProductAccess(productId: string) {
  try {
    const productRef = doc(db, 'products', productId);
    const productSnap = await getDoc(productRef);
    
    console.log("Product verification:", {
      exists: productSnap.exists(),
      data: productSnap.data(),
      id: productId
    });
    
    return productSnap.exists();
  } catch (error) {
    console.error("Product verification error:", error);
    return false;
  }
}

// Add these functions to track sync status
export interface SyncStatus {
  lastSynced: Timestamp | Date;
  status: 'idle' | 'syncing' | 'error';
  error?: string;
}

export interface StoreSync {
  nakedArmor: SyncStatus;
  grownManShave: SyncStatus;
}

// Function to get sync status
export async function getSyncStatus(): Promise<StoreSync> {
  const syncRef = doc(db, 'system', 'syncStatus');
  const syncDoc = await getDoc(syncRef);
  
  if (!syncDoc.exists()) {
    // Initialize with default values if not exists
    const defaultStatus: StoreSync = {
      nakedArmor: { lastSynced: new Date(), status: 'idle' },
      grownManShave: { lastSynced: new Date(), status: 'idle' }
    };
    await setDoc(syncRef, defaultStatus);
    return defaultStatus;
  }
  
  return syncDoc.data() as StoreSync;
}

// Function to update sync status
export async function updateSyncStatus(store: 'nakedArmor' | 'grownManShave', status: Partial<SyncStatus>) {
  const syncRef = doc(db, 'system', 'syncStatus');
  const update = {
    [store]: {
      lastSynced: status.status === 'idle' ? new Date() : serverTimestamp(),
      ...status
    }
  };
  await updateDoc(syncRef, update);
}

// Function to log webhook events
export async function logWebhookEvent(event: Omit<WebhookEvent, 'id'>) {
  try {
    const docRef = await addDoc(webhookEventsCollection, {
      ...event,
      timestamp: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error logging webhook event:', error);
    throw error;
  }
}

// Function to get webhook history
export async function getWebhookHistory(limitCount = 100): Promise<WebhookEvent[]> {
  console.log('[DB] Getting webhook history...');
  try {
    const q = query(
      webhookEventsCollection,
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    
    console.log('[DB] Executing webhook query...');
    const querySnapshot = await getDocs(q);
    console.log('[DB] Got webhook snapshot, doc count:', querySnapshot.size);

    const events = querySnapshot.docs.map(doc => {
      const data = doc.data();
      console.log('[DB] Processing webhook doc:', doc.id, data);
      return {
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate(),
        processedAt: data.processedAt?.toDate()
      };
    });

    console.log('[DB] Processed webhook events:', events.length);
    return events as WebhookEvent[];
  } catch (error) {
    console.error('[DB] Error fetching webhook history:', error);
    throw error;
  }
}

// Function to log cron job start
export async function startCronJob(type: CronJob['type']) {
  try {
    const docRef = await addDoc(cronJobsCollection, {
      type,
      status: 'running',
      startTime: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error logging cron start:', error);
    throw error;
  }
}

// Function to update cron job status
export async function updateCronJob(
  jobId: string, 
  status: 'success' | 'error',
  details?: CronJob['details'],
  error?: string
) {
  try {
    await updateDoc(doc(cronJobsCollection, jobId), {
      status,
      endTime: serverTimestamp(),
      ...(details && { details }),
      ...(error && { error })
    });
  } catch (error) {
    console.error('Error updating cron job:', error);
    throw error;
  }
}

// Function to get cron history
export async function getCronHistory(limitCount = 50): Promise<CronJob[]> {
  const q = query(
    cronJobsCollection,
    orderBy('startTime', 'desc'),
    limit(limitCount)
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    startTime: doc.data().startTime?.toDate(),
    endTime: doc.data().endTime?.toDate()
  })) as CronJob[];
}

// Add these functions to track sales and errors
export interface SalesData {
  date: Date;
  store: 'nakedArmor' | 'grownManShave';
  quantity: number;
  revenue: number;
  productId: string;
}

export interface ErrorLog {
  timestamp: Date;
  type: 'webhook' | 'sync' | 'api';
  message: string;
  details?: any;
}

// Function to get sales data within a date range
export async function getSalesData(startDate: Date, endDate: Date): Promise<SalesData[]> {
  const q = query(
    collection(db, 'sales'),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    ...doc.data(),
    date: doc.data().date.toDate()
  })) as SalesData[];
}

// Function to get popular products
export async function getPopularProducts(days = 30): Promise<{
  productId: string;
  productName: string;
  sku: string;
  totalSold: number;
}[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const salesQuery = query(
    collection(db, 'sales'),
    where('date', '>=', startDate)
  );
  
  const salesDocs = await getDocs(salesQuery);
  const salesData = salesDocs.docs.map(doc => doc.data());
  
  // If no sales data, return empty array
  if (salesData.length === 0) {
    return [];
  }
  
  // Aggregate sales by product
  const productSales = salesData.reduce((acc, sale) => {
    const { productId, quantity } = sale;
    if (!acc[productId]) {
      acc[productId] = { totalSold: 0 };
    }
    acc[productId].totalSold += quantity;
    return acc;
  }, {} as Record<string, { totalSold: number; }>);
  
  const productIds = Object.keys(productSales);
  
  // If no product IDs, return empty array
  if (productIds.length === 0) {
    return [];
  }
  
  // Get product details by Firestore document ID.
  // Firestore "in" queries are limited to 10 values, so query in chunks.
  const productsRef = collection(db, 'products');
  const chunks: string[][] = [];
  for (let i = 0; i < productIds.length; i += 10) {
    chunks.push(productIds.slice(i, i + 10));
  }

  const snapshots = await Promise.all(
    chunks.map((ids) =>
      getDocs(query(productsRef, where(documentId(), 'in', ids)))
    )
  );

  const docs = snapshots.flatMap((snapshot) => snapshot.docs);

  return docs
    .map((doc) => ({
      productId: doc.id,
      productName: doc.data().productName || 'Unnamed Product',
      sku: doc.data().sku || 'N/A',
      totalSold: productSales[doc.id]?.totalSold || 0
    }))
    .sort((a, b) => b.totalSold - a.totalSold);
}

// Function to get error rates
export async function getErrorRates(days = 7): Promise<{
  type: string;
  total: number;
  errors: number;
  rate: number;
}[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const q = query(
    collection(db, 'error_logs'),
    where('timestamp', '>=', startDate),
    orderBy('timestamp', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  const errors = querySnapshot.docs.map(doc => ({
    ...doc.data(),
    timestamp: doc.data().timestamp?.toDate()
  }));
  
  // Group by type and calculate rates
  const errorsByType = errors.reduce((acc, raw) => {
    const error = raw as { type?: string; status?: string };
    const type = error.type || 'unknown';
    if (!acc[type]) {
      acc[type] = { total: 0, errors: 0 };
    }
    acc[type].total++;
    if (error.status === 'error') {
      acc[type].errors++;
    }
    return acc;
  }, {} as Record<string, { total: number; errors: number; }>);
  
  return Object.entries(errorsByType)
    .map(([type, data]) => ({
      type,
      total: data.total,
      errors: data.errors,
      rate: (data.errors / data.total) * 100
    }))
    .sort((a, b) => b.rate - a.rate); // Sort by error rate descending
}

// Add these exports to your db.ts file
export async function getRecentWebhooks() {
  const q = query(
    collection(db, 'webhook_events'),
    orderBy('timestamp', 'desc'),
    limit(10)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getRecentCronJobs() {
  const q = query(
    collection(db, 'cron_jobs'),
    orderBy('timestamp', 'desc'),
    limit(10)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Add this function to get section counts
export async function getSectionCounts() {
  const snapshot = await getDocs(productsCollection);
  const products = snapshot.docs.map(doc => doc.data());
  
  return {
    joy: products.filter(p => p.location?.loc1 === 'JOY').length,
    love: products.filter(p => p.location2?.loc1 === 'LOVE').length,
    peace: products.filter(p => p.location?.loc1 === 'PEACE').length,
    hope: products.filter(p => p.location?.loc1 === 'HOPE').length
  };
}

function toActivityStatus(s: unknown): 'success' | 'error' | 'running' {
  return s === 'success' || s === 'error' || s === 'running' ? s : 'success';
}

export type RecentActivityRow = {
  id: string;
  type: 'webhook' | 'cron' | 'inventory' | 'product';
  timestamp: Date;
  description: string;
  status: 'success' | 'error' | 'running';
};

// Add this function to get recent activity
export async function getRecentActivity(limitCount = 50): Promise<RecentActivityRow[]> {
  try {
    // Get recent webhooks
    const webhookQuery = query(
      webhookEventsCollection,
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    
    // Get recent cron jobs
    const cronQuery = query(
      cronJobsCollection,
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    
    // Get recent inventory updates
    const inventoryQuery = query(
      inventoryUpdatesCollection,
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    // Get recent product updates
    const productQuery = query(
      productsCollection,
      orderBy('lastUpdated', 'desc'),
      limit(limitCount)
    );

    try {
      const [webhooks, cronJobs, inventoryUpdates, products] = await Promise.all([
        getDocs(webhookQuery),
        getDocs(cronQuery),
        getDocs(inventoryQuery),
        getDocs(productQuery)
      ]);

      const activities = [
        ...webhooks.docs.map(doc => ({
          id: doc.id,
          type: 'webhook' as const,
          timestamp: doc.data().timestamp?.toDate() || new Date(),
          description: `Received ${doc.data().eventType || 'webhook'} from ${doc.data().store || 'unknown'}`,
          status: toActivityStatus(doc.data().status)
        })),
        ...cronJobs.docs.map(doc => ({
          id: doc.id,
          type: 'cron' as const,
          timestamp: doc.data().timestamp?.toDate() || new Date(),
          description: `${doc.data().type || 'Sync'} job ${doc.data().status === 'success' ? 'completed' : 'failed'}`,
          status: toActivityStatus(doc.data().status)
        })),
        ...inventoryUpdates.docs.map(doc => ({
          id: doc.id,
          type: 'inventory' as const,
          timestamp: doc.data().timestamp?.toDate() || new Date(),
          description: `Manual stock adjustment: SKU ${doc.data().productSku} (${doc.data().quantity > 0 ? '+' : ''}${doc.data().quantity})`,
          status: 'success' as const
        })),
        ...products.docs.map(doc => ({
          id: doc.id,
          type: 'product' as const,
          timestamp: doc.data().lastUpdated?.toDate() || doc.data().createdAt?.toDate() || new Date(),
          description: `Product ${doc.data().sku} ${doc.data().createdAt ? 'created' : 'updated'}`,
          status: 'success' as const
        }))
      ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
       .slice(0, limitCount);

      return activities;
    } catch (error) {
      console.error('Error in getRecentActivity:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    return [];
  }
}

// Add these functions to track performance metrics
export async function getPerformanceMetrics() {
  try {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get recent webhooks
    const webhookQuery = query(
      webhookEventsCollection,
      where('timestamp', '>=', last24Hours),
      orderBy('timestamp', 'desc')
    );

    // Get recent API calls
    const apiCallsQuery = query(
      collection(db, 'api_metrics'),
      where('timestamp', '>=', last24Hours),
      orderBy('timestamp', 'desc')
    );

    const [webhooks, apiCalls] = await Promise.all([
      getDocs(webhookQuery),
      getDocs(apiCallsQuery)
    ]);

    // Calculate webhook success rate
    const webhookDocs = webhooks.docs.map(doc => doc.data());
    const totalWebhooks = webhookDocs.length;
    const successfulWebhooks = webhookDocs.filter(doc => doc.status === 'success').length;
    const webhookSuccessRate = totalWebhooks > 0 
      ? Math.round((successfulWebhooks / totalWebhooks) * 100) 
      : 100;

    // Calculate average API response time
    const apiCallDocs = apiCalls.docs.map(doc => doc.data());
    const avgResponseTime = apiCallDocs.length > 0
      ? Math.round(apiCallDocs.reduce((acc, call) => acc + (call.duration || 0), 0) / apiCallDocs.length)
      : 0;

    return {
      apiResponseTime: avgResponseTime,
      webhookSuccessRate,
      totalWebhooks,
      totalApiCalls: apiCallDocs.length,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('Error in getPerformanceMetrics:', error);
    return {
      apiResponseTime: 0,
      webhookSuccessRate: 100,
      totalWebhooks: 0,
      totalApiCalls: 0,
      timestamp: new Date()
    };
  }
}

// Add this to track API calls
export async function recordApiCall(endpoint: string, duration: number, status: 'success' | 'error') {
  await addDoc(collection(db, 'api_metrics'), {
    endpoint,
    duration,
    status,
    timestamp: serverTimestamp()
  });
}

// Add or update this function
export async function logError(type: string, error: any) {
  try {
    await addDoc(collection(db, 'error_logs'), {
      type,
      message: error.message || 'Unknown error',
      details: error,
      timestamp: serverTimestamp(),
      status: 'error'
    });
  } catch (e) {
    console.error('Error logging error:', e);
  }
}