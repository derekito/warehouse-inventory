const cron = require('node-cron');
const dotenv = require('dotenv');

dotenv.config();

// Define types for API response
interface SyncResult {
  success: boolean;
  sku: string;
  error?: string;
}

interface SyncSummary {
  total: number;
  succeeded: number;
  failed: number;
}

interface SyncResponse {
  success: boolean;
  error?: string;
  details?: {
    productsUpdated: number;
    summary: SyncSummary;
    results: SyncResult[];
  };
}

const CRON_SECRET = process.env.CRON_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

if (!CRON_SECRET) {
  console.error('CRON_SECRET environment variable is not set');
  process.exit(1);
}

if (!APP_URL) {
  console.error('NEXT_PUBLIC_APP_URL environment variable is not set');
  process.exit(1);
}

async function runIncrementalSync() {
  try {
    console.log('Starting incremental sync...');
    
    // Use the global fetch available in Node 18+ / Vercel
    const response = await fetch(`${APP_URL}/api/cron/sync-incremental`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CRON_SECRET}`
      }
    });

    const data = await response.json() as SyncResponse;
    
    if (data.success && data.details) {
      console.log('Incremental sync completed successfully:', {
        productsUpdated: data.details.productsUpdated,
        summary: data.details.summary
      });
    } else {
      console.error('Incremental sync failed:', data.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Error running incremental sync:', error);
  }
}

// Run every 3 minutes for testing
cron.schedule('*/3 * * * *', runIncrementalSync);

console.log('Incremental sync cron job started. Will run every 3 minutes.');

// Run once immediately on startup
runIncrementalSync();