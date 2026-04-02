npm run dev## Shopify Inventory Management

Build a Shopify app that tracks inventory levels from two different Shopify stores and "merges" that data into a very basic warehouse system. The warehouse system tracks products along with their assigned shelf and bin locations. The system allows users to look up real-time inventory levels for any product in the warehouse location. 

## Sync Functionality

The app provides two ways to sync inventory with Shopify stores:

### 1. Full Sync
Syncs all products in the database with both Shopify stores:

```typescript
// Example of full sync function
async function handleShopifySync(store: 'naked-armor' | 'grown-man-shave') {
  const syncableProducts = products.filter(product => product.sku);
  
  const response = await fetch('/api/shopify/sync', {
    method: 'POST',
    body: JSON.stringify({
      products: syncableProducts,
      storeIdentifier: store,
    }),
  });
}
```

### 2. Incremental Sync
The app provides both manual and automatic incremental sync:

#### Manual Sync
Only syncs products that have been modified since the last sync:

```typescript
// API endpoint for incremental sync
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Get last sync timestamp
  const lastSync = await db.collection('sync_history').doc('last_sync').get();
  const lastSyncTime = lastSync.exists ? lastSync.data()?.timestamp : new Date(0);

  // Query only modified products
  const updatedProducts = await productsRef
    .where('lastUpdated', '>', lastSyncTime)
    .get();

  // Sync each modified product
  for (const product of products) {
    const results = await syncProductWithBothStores(product);
    // Process results...
  }
}
```

#### Automatic Sync
Automatically triggers the incremental sync every 3 minutes (configurable):

```typescript
// Auto-sync implementation in Products page
useEffect(() => {
  const shouldSync = () => {
    if (!lastAutoSync) return true;
    const threeMinutesInMs = 3 * 60 * 1000;
    const timeSinceLastSync = Date.now() - lastAutoSync.getTime();
    return timeSinceLastSync > threeMinutesInMs;
  };

  const autoSync = async () => {
    if (shouldSync()) {
      const syncButton = document.querySelector('[data-testid="incremental-sync-btn"]');
      if (syncButton) {
        (syncButton as HTMLButtonElement).click();
        setLastAutoSync(new Date());
      }
    }
  };

  // Run check every minute
  const interval = setInterval(autoSync, 60 * 1000);
  return () => clearInterval(interval);
}, [lastAutoSync]);
```

The IncrementalSyncButton component handles the actual sync:

```typescript
export default function IncrementalSyncButton({ className = '', ...props }) {
  const handleIncrementalSync = async () => {
    const response = await fetch('/api/sync/incremental', {
      method: 'POST'
    });
    
    const data = await response.json();
    if (data.success) {
      toast({
        title: 'Sync Complete',
        description: `Updated ${data.details.productsUpdated} products`,
      });
    }
  };

  return (
    <button
      onClick={handleIncrementalSync}
      data-testid="incremental-sync-btn"
    >
      Sync Partial
    </button>
  );
}
```

### Key Features:
- Uses SKU as the master identifier across systems
- Maintains sync history in Firestore
- Provides detailed success/failure reporting
- Handles both stores simultaneously
- Prevents unnecessary API calls for unchanged products
- Automatic sync every 3 minutes (configurable to any interval)
- Visual feedback through toast notifications
- Detailed logging for troubleshooting

The app will be built using the Shopify API and the Next.js framework. The app will be deployed to Vercel.

Check if your products in the database have the shopifyProducts field configured?

We use the SKU to track and lookup products. Our goal is to call the api, look through each shopify store's product catalog (by sku) and once we find the product we update that product from our master sku.

The second function is when an product sells on either of the shopify stores, then it updates the master application with the new inventory level and we then push the new inventory level back to both shopify stores to update the inventory with a unified inventory calculation.

We have the Sync buttons while we are testing the stores and application but once we know the api works and our application is functioning as intended then we will set up a cron job to run inventory function at a regualr interval.

Please review the shopify documentation:

@https://shopify.dev/docs/apps/build/orders-fulfillment/inventory-management-apps#webhooks 

Let's focus on getting the system to work as intended, going step by step to to allow us to call shopify api, search through the shopify product catalog by sku, find the inventory number and then overwrite the shopify inventory with our master inventory.
Let's get step one working first.

Step 1:
Connect to Naked Armor using the proper call functions via api and manual sync button, lookup sku and inventory, update each product in shopfy with the master inventory levels in our application.

Step 2:
Repeat steps one with second store Grown Man Shave.

Step 3:
Update master inventory once a product sells on shopify and depricate the master inventory to refelct the new inventory on hand. Repeat with each store via manual sync.

Step 4:
Use the master inventory to update each shopify store with the new inventory level via Manual Sync button.

Stap 5:
Create a cron job that fires the aplication and api to replace the manual sync button every 15 mins. Keep the manual sync in place in case a manual sync is required.

## Features

- Track inventory levels from two different Shopify stores
– Listen for inventory change events from both stores (for example, via the inventory_levels/update webhook).
- Merge inventory data into a warehouse system
- Track products along with their assigned shelf and bin locations
- Allow users to look up real-time inventory levels for any product in the warehouse location
- Allow users to add, edit, and delete products in the warehouse system
- Allow users update inventory though the front-end per product or as an import via csv file

## Project Setup

### Prerequisites
- Node.js (version X.X.X)
- Shopify Partner Account
- Firebase Account
- Vercel Account

### Installation
1. Clone the repository
```bash
git clone [repository-url]
cd inv-manage
```
2. Install dependencies
```bash
npm install
```
3. Set up environment variables
```bash
cp .env.example .env.local
```
4. Configure Firebase credentials
5. Configure Shopify API credentials
6. Run cron job
```bash
npm install node-cron node-fetch dotenv
```
7. Run cron:
```bash
npm run cron
```
8. Run Incremental Cron Job:
```bash
node cron/sync-incremental.js
```
Reinstall Dependencies // Server Down

# Stop the server and run:
```bash
rm -rf .next

# Remove node_modules and package-lock.json
```bash
rm -rf node_modules package-lock.json

# Reinstall dependencies
npm install

npm run dev
```

## Architecture

### Tech Stack
- Next.js (Frontend & API routes)
- Firebase Firestore (Database)
- Shopify API (Store integration)
  - Store One: Naked Armor
  - Store Two: Grown Man Shave
- Vercel (Deployment)

### Environment Setup
1. Copy the `.env.example` file to create a new `.env` file:
```bash
cp .env.example .env
```

2. Fill in your Firebase credentials in `.env`:
- Get these from your Firebase Console
- Project Settings > General > Your Apps
- Create a new Web App if needed

3. Fill in your Shopify credentials in `.env`:
- Get these from your Shopify Partner account
- Apps > App Setup
- API credentials section

4. Never commit the `.env` file to version control

### System Design
[Include a basic system diagram showing the flow between Shopify stores, webhooks, and your warehouse system]

## Mapping Shopify Data to Warehouse Records:

- When a webhook event is received, determine which store sent it (using request headers or by using a different endpoint per store).
- Update your local inventory records. Each record might include: 
- Shopify store identifier which will be handled by product sku`
- Current inventory quantity
- Warehouse details: shelf and bin location

## API Documentation

### Webhooks
- `/api/webhooks/store1/inventory` - Handles inventory updates from Store 1
- `/api/webhooks/store2/inventory` - Handles inventory updates from Store 2

### REST Endpoints
- `GET /api/inventory` - Get all inventory items
- `POST /api/inventory` - Create new inventory item
- `PUT /api/inventory/:sku` - Update inventory item
- `DELETE /api/inventory/:sku` - Delete inventory item

## Security Considerations
- Shopify webhook verification
- Firebase security rules
- API authentication
- Rate limiting
- Data validation

## Development Workflow

### Local Development
```bash
npm run dev
```

### Testing
```bash
npm run test
```

### Deployment
```bash
npm run build
npm run deploy
```

## Start Application

npm run dev

## Database Schema & Structure

Use Firebase Firestore for the database.

### Firestore Collections

#### Products Collection
- `SKU` (string, primary key)
- `ProductName` (string)
gro

#### Audit Collection
- Track inventory changes
- Record user actions
- Maintain history of updates

#### Warehouse Collection
- Warehouse configuration
- Location mappings
- Storage capacity

## Features Roadmap

### Phase 1 - Core Features
- Basic inventory tracking
- Webhook integration
- Warehouse location management

### Phase 2 - Enhanced Features
- Batch updates via CSV
- Inventory alerts
- Advanced search
- Reporting dashboard

### Phase 3 - Optimization
- Performance improvements
- Analytics integration
- Mobile optimization

## Troubleshooting

### Common Issues
- Webhook verification failures
- Inventory sync delays
- Database connection issues

### Logging
- Error logging strategy
- Monitoring setup
- Debug procedures

## Contributing

### Development Guidelines
- Code style guide
- Pull request process
- Testing requirements

### Branch Strategy
- main: production
- develop: development
- feature/*: new features
- hotfix/*: urgent fixes

## License

[Specify your license type]

## CSV Import/Update System

The system supports two modes for handling CSV product data:
1. Import - Creates new products
2. Update - Updates existing products by SKU

### Update Existing Products

The update functionality uses a dedicated endpoint and function to safely update existing products:

```typescript
// API Endpoint: /api/update-products
export async function updateExistingProductBySku(productData: Partial<Product>) {
  try {
    const sku = productData.sku.trim();
    
    // Find existing product
    const snapshot = await adminDb
      .collection('products')
      .where('sku', '==', sku)
      .limit(1)
      .get();

    if (snapshot.empty) {
      throw new Error(`Cannot update: No product found with SKU: ${sku}`);
    }

    // Get existing data
    const doc = snapshot.docs[0];
    const existingData = doc.data();

    // Update only specific fields, preserving others
    const updateData = {
      productName: productData.productName || existingData.productName,
      description: productData.description || existingData.description,
      onHand: productData.onHand || existingData.onHand,
      status: productData.status || existingData.status,
      location: productData.location || existingData.location,
      lastUpdated: new Date()
    };

    // Perform update
    await adminDb
      .collection('products')
      .doc(doc.id)
      .update(updateData);

    return {
      status: 'updated',
      id: doc.id,
      sku
    };
  } catch (error) {
    throw error;
  }
}
```

### CSV Import Format

The CSV file should contain the following columns:
- SKU (required)
- ProductName
- Description
- OnHand
- Status (active/inactive)
- Section (Location)
- Aisle
- Shelf
- Bin

Example CSV:
```csv
SKU,ProductName,Description,OnHand,Status,Section,Aisle,Shelf,Bin
70,Merkur Razor,Chrome finish,2,active,JOY,SH.6,BIN,7D
```

### Key Features

1. **Safe Updates**: Only updates existing products, never creates duplicates
2. **Field Preservation**: Maintains critical fields like Shopify configurations
3. **Validation**: Ensures SKU exists before attempting updates
4. **Error Handling**: Provides detailed feedback on success/failure

### Usage

1. Click "Update From CSV" button
2. Upload CSV file with product data
3. System will:
   - Match products by SKU
   - Update only existing products
   - Preserve Shopify configurations
   - Report success/failures

### Implementation Notes

- Uses Firebase Admin SDK for database operations
- Separate endpoints for import vs update
- Maintains data integrity with field preservation
- Provides detailed logging and error reporting

## Shopify Integration

### API and Webhook Implementation

The system integrates with two Shopify stores using both REST APIs and webhooks for real-time synchronization.

### 1. Shopify API Setup

```typescript
// src/lib/shopify.ts
import { adminApiClient } from '@shopify/admin-api-client';

// Configure API clients for each store
const nakedArmorClient = adminApiClient({
  storeDomain: process.env.SHOPIFY_STORE_ONE_URL,
  accessToken: process.env.SHOPIFY_STORE_ONE_ACCESS_TOKEN,
});

const grownManShaveClient = adminApiClient({
  storeDomain: process.env.SHOPIFY_STORE_TWO_URL,
  accessToken: process.env.SHOPIFY_STORE_TWO_ACCESS_TOKEN,
});

// Sync inventory levels
export async function syncAllProducts(store: 'naked-armor' | 'grown-man-shave') {
  const client = store === 'naked-armor' ? nakedArmorClient : grownManShaveClient;
  
  try {
    // Get products from database
    const products = await getAllProducts();
    
    for (const product of products) {
      if (product.shopifyProducts?.[store]?.inventoryItemId) {
        await updateInventoryLevel(client, {
          inventoryItemId: product.shopifyProducts[store].inventoryItemId,
          locationId: product.shopifyProducts[store].locationId,
          quantity: product.onHand
        });
      }
    }
  } catch (error) {
    console.error('Sync failed:', error);
    throw error;
  }
}
```

### 2. Webhook Implementation

```typescript
// src/pages/api/webhooks/[store]/inventory.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { verifyShopifyWebhook } from '@/lib/shopify';
import { updateProductInventory } from '@/lib/db-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { store } = req.query;
  
  // Verify webhook authenticity
  const hmac = req.headers['x-shopify-hmac-sha256'];
  const topic = req.headers['x-shopify-topic'];
  
  if (!verifyShopifyWebhook(req, store as string)) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  try {
    const data = req.body;
    await updateProductInventory(data, store as string);
    res.status(200).end();
  } catch (error) {
    console.error('Webhook processing failed:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
}
```

### 3. Webhook Security

```typescript
// src/lib/shopify.ts
export function verifyShopifyWebhook(req: NextApiRequest, store: string) {
  const hmac = req.headers['x-shopify-hmac-sha256'] as string;
  const secret = store === 'naked-armor' 
    ? process.env.SHOPIFY_STORE_ONE_WEBHOOK_SECRET 
    : process.env.SHOPIFY_STORE_TWO_WEBHOOK_SECRET;

  const hash = crypto
    .createHmac('sha256', secret)
    .update(req.body)
    .digest('base64');

  return hash === hmac;
}
```

### 4. Database Updates

```typescript
// src/lib/db-admin.ts
export async function updateProductInventory(data: any, store: string) {
  const { sku, quantity } = data;
  
  try {
    const product = await getProductBySkuAdmin(sku);
    if (!product) throw new Error(`No product found with SKU: ${sku}`);

    await updateProductAdmin(product.id, {
      onHand: quantity,
      lastUpdated: new Date(),
      [`shopifyProducts.${store}.lastSync`]: new Date()
    });
  } catch (error) {
    console.error('Failed to update inventory:', error);
    throw error;
  }
}
```

### Setup Instructions

1. Configure Shopify App in Partner Dashboard:
   ```bash
   # Store One (Naked Armor)
   SHOPIFY_STORE_ONE_URL=your-store.myshopify.com
   SHOPIFY_STORE_ONE_ACCESS_TOKEN=your_access_token
   SHOPIFY_STORE_ONE_WEBHOOK_SECRET=your_webhook_secret

   # Store Two (Grown Man Shave)
   SHOPIFY_STORE_TWO_URL=your-store.myshopify.com
   SHOPIFY_STORE_TWO_ACCESS_TOKEN=your_access_token
   SHOPIFY_STORE_TWO_WEBHOOK_SECRET=your_webhook_secret
   ```

2. Set up webhooks in Shopify:
   - Inventory levels update: `/api/webhooks/[store]/inventory`
   - Products update: `/api/webhooks/[store]/products`
   - Use store identifier in URL: `naked-armor` or `grown-man-shave`

3. Verify webhook functionality:
   ```bash
   # Test webhook endpoint
   curl -X POST \
     -H "X-Shopify-Topic: inventory_levels/update" \
     -H "X-Shopify-Hmac-SHA256: your_hmac" \
     -d '{"sku":"test","quantity":5}' \
     https://your-domain.com/api/webhooks/naked-armor/inventory
   ```
### Cron Job cron/sync.js

npm run cron

  Updated cron schedule from */1 * * * * to 0 */6 * * *
  This means it will run at:
  -12:00 AM
  6:00 AM
  12:00 PM
  6:00 PM
  
  3. Updated the console log message to reflect the new schedule
  
  The cron expression 0 */6 * * * breaks down as:
  0 - At minute 0
  */6 - Every 6th hour
  * * * - Every day, every month, every day of the week



### Key Features

1. **Bi-directional Sync**: 
   - Webhooks handle Shopify → Local updates
   - API calls handle Local → Shopify updates

2. **Security**:
   - HMAC verification for webhooks
   - Access token authentication for API calls
   - Environment variable configuration

3. **Error Handling**:
   - Webhook verification
   - Database transaction safety
   - Detailed error logging

4. **Multi-store Support**:
   - Separate configurations per store
   - Store-specific webhook endpoints
   - Independent inventory tracking

### Firebase Rules

- Working Version Pasted Into Firebase Directly

rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }

    // Products collection - allow all operations when authenticated
    match /products/{productId} {
      allow read, write: if true; // Keep this as true for now since it was working
    }

    // Locations collection
    match /locations/{locationId} {
      allow read, write: if isAuthenticated();
    }

    // Inventory updates
    match /inventory_updates/{updateId} {
      allow read, write: if true; // Allow reading for dashboard activity
    }

    // Dashboard Collections
    match /sales/{saleId} {
      allow read: if true; // Allow reading for sales trends
      allow write: if isAuthenticated();
    }

    match /error_logs/{logId} {
      allow read: if true; // Allow reading for error monitoring
      allow write: if true; // Allow writing for error logging
    }

    match /api_metrics/{metricId} {
      allow read: if true; // Allow reading for performance metrics
      allow write: if true; // Allow writing for API monitoring
    }

    // Webhook and Cron Collections
    match /webhook_events/{eventId} {
      allow read: if true; // Allow reading for recent activity
      allow write: if true; // Allow webhook processing
    }

    match /cron_jobs/{jobId} {
      allow read: if true; // Allow reading for recent activity
      allow write: if true; // Allow cron job updates
    }

    // System status
    match /system/{docId} {
      allow read: if true; // Allow reading sync status
      allow write: if isAuthenticated();
    }

    // Performance metrics collection
    match /performance_metrics/{metricId} {
      allow read: if true; // Allow reading for dashboard
      allow write: if isAuthenticated();
    }
  }
}
```

## Cron Jobs

The application uses cron jobs to keep inventory in sync:

* Full sync: Runs daily at midnight
* Incremental sync: Runs every 5 minutes (temporary for testing)

To start the cron jobs:
```bash
npm run cron
```

# 1. First, fix ownership of your project directory
sudo chown -R $(whoami) /Users/derekdodds-r/Coding/inv-manage

# 2. Fix permissions for the npm cache
sudo chown -R $(whoami) ~/.npm

# 3. Remove existing node_modules and package-lock.json
rm -rf node_modules package-lock.json

# 4. Clear npm cache completely
npm cache clean --force

# 5. Now try installing again
npm install

Restarting Computer & Ngrok
- npm run dev (start app)
- ngrok http 3000 (start ngrok)

login to: https://dashboard.ngrok.com/login
