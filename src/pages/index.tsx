import { useEffect, useState } from 'react';
import { getAllProducts, getSyncStatus, type StoreSync, getSectionCounts, getRecentActivity, getPerformanceMetrics } from '@/lib/db';
import { onSnapshot, doc, Timestamp, query, collection, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product } from '@/types';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/router';
import { formatDistanceToNow } from 'date-fns';
import SalesTrends from '@/components/dashboard/SalesTrends';
import PopularProducts from '@/components/dashboard/PopularProducts';
import ErrorMonitoring from '@/components/dashboard/ErrorMonitoring';
import CombinedInventoryReport from '@/components/dashboard/CombinedInventoryReport';
import { exportToCSV, exportLocation2ToCSV } from '@/lib/exportToCSV';

export default function Dashboard() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<StoreSync | null>(null);
  const [recentActivity, setRecentActivity] = useState<Array<{
    id: string;
    type: 'webhook' | 'cron' | 'inventory';
    timestamp: Date;
    description: string;
    status: 'success' | 'error' | 'running';
  }>>([]);
  const [sectionCounts, setSectionCounts] = useState({
    joy: 0,
    love: 0,
    peace: 0,
    hope: 0
  });
  const [performanceMetrics, setPerformanceMetrics] = useState({
    apiResponseTime: 0,
    webhookSuccessRate: 100,
    totalWebhooks: 0,
    totalApiCalls: 0,
    timestamp: new Date()
  });

  useEffect(() => {
    loadProducts();
    
    // Set up real-time listener for sync status
    const unsubscribe = onSnapshot(
      doc(db, 'system', 'syncStatus'),
      (doc) => {
        if (doc.exists()) {
          setSyncStatus(doc.data() as StoreSync);
        }
      },
      (error) => {
        console.error('Error listening to sync status:', error);
        toast({
          title: 'Error',
          description: 'Failed to get sync status updates',
          variant: 'destructive',
        });
      }
    );

    // Cleanup subscription
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const loadSectionCounts = async () => {
      try {
        const counts = await getSectionCounts();
        setSectionCounts(counts);
      } catch (error) {
        console.error('Error loading section counts:', error);
      }
    };

    loadSectionCounts();
  }, []);

  useEffect(() => {
    const loadRecentActivity = async () => {
      try {
        const activities = await getRecentActivity(5);
        setRecentActivity(activities);
      } catch (error) {
        console.error('Error loading recent activity:', error);
      }
    };

    loadRecentActivity();
    
    // Optional: Set up real-time updates
    const unsubscribe = onSnapshot(
      query(collection(db, 'webhook_events'), orderBy('timestamp', 'desc'), limit(10)),
      (snapshot) => {
        loadRecentActivity(); // Reload all activity when webhooks change
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const loadPerformanceMetrics = async () => {
      try {
        const metrics = await getPerformanceMetrics();
        setPerformanceMetrics(metrics);
      } catch (error) {
        console.error('Error loading performance metrics:', error);
      }
    };

    loadPerformanceMetrics();
    
    // Refresh every minute
    const interval = setInterval(loadPerformanceMetrics, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadProducts = async () => {
    try {
      const [fetchedProducts, initialSyncStatus] = await Promise.all([
        getAllProducts(),
        getSyncStatus() // This will create the document if it doesn't exist
      ]);
      setProducts(fetchedProducts);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    // Show confirmation dialog
    if (!confirm('Are you sure you want to sync inventory with both Shopify stores?')) {
      return;
    }

    setSyncStatus({
      nakedArmor: { lastSynced: new Date(), status: 'syncing' },
      grownManShave: { lastSynced: new Date(), status: 'syncing' }
    });

    try {
      // Add your sync logic here
      toast({
        title: 'Success',
        description: 'Inventory synced successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to sync inventory',
        variant: 'destructive',
      });
    }
  };

  // Helper function to format sync time
  const formatSyncTime = (timestamp: Date | Timestamp | null) => {
    if (!timestamp) return 'Never';
    
    // Convert Firestore Timestamp to Date if needed
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
    
    try {
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Unknown';
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-[1800px] 2xl:max-w-none space-y-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Products</h3>
          <p className="text-3xl font-bold text-blue-600">{products.length}</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Low Stock Items</h3>
          <p className="text-3xl font-bold text-orange-500">
            {products.filter(p => p.onHand < 5).length}
          </p>
          <p className="text-sm text-gray-500 mt-2">Items with less than 5 units</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Out of Stock</h3>
          <p className="text-3xl font-bold text-red-600">
            {products.filter(p => p.onHand === 0).length}
          </p>
          <p className="text-sm text-gray-500 mt-2">Immediate attention needed</p>
        </div>
      </div>

      {/* Sales Trends - Full Width */}
      <div className="w-full">
        <SalesTrends />
      </div>

      {/* Popular Products - Full Width */}
      <div className="w-full">
        <PopularProducts />
      </div>

      {/* Combined Inventory Report - Full Width */}
      <div className="w-full">
        <CombinedInventoryReport products={products} />
      </div>

      {/* Shopify Sync Status and Stock Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Shopify Sync Status</h3>
          <div className="space-y-4">
            {syncStatus && (
              <>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">Naked Armor</p>
                    <p className="text-sm text-gray-500">
                      Last synced: {formatSyncTime(syncStatus.nakedArmor.lastSynced)}
                    </p>
                    {syncStatus.nakedArmor.error && (
                      <p className="text-sm text-red-500">{syncStatus.nakedArmor.error}</p>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    syncStatus.nakedArmor.status === 'syncing' 
                      ? 'bg-blue-100 text-blue-800'
                      : syncStatus.nakedArmor.status === 'error'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {syncStatus.nakedArmor.status === 'syncing' 
                      ? 'Syncing...' 
                      : syncStatus.nakedArmor.status === 'error'
                      ? 'Error'
                      : 'Synced'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">Grown Man Shave</p>
                    <p className="text-sm text-gray-500">
                      Last synced: {formatSyncTime(syncStatus.grownManShave.lastSynced)}
                    </p>
                    {syncStatus.grownManShave.error && (
                      <p className="text-sm text-red-500">{syncStatus.grownManShave.error}</p>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    syncStatus.grownManShave.status === 'syncing' 
                      ? 'bg-blue-100 text-blue-800'
                      : syncStatus.grownManShave.status === 'error'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {syncStatus.grownManShave.status === 'syncing' 
                      ? 'Syncing...' 
                      : syncStatus.grownManShave.status === 'error'
                      ? 'Error'
                      : 'Synced'}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Stock Alerts</h3>
          <div className="space-y-3">
            {products
              .filter(p => p.onHand < 5)
              .slice(0, 5)
              .map(product => (
                <div key={product.id} className="flex justify-between items-center py-2 border-b">
                  <div>
                    <p className="font-medium">{product.productName}</p>
                    <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    product.onHand === 0 
                      ? 'bg-red-100 text-red-800' 
                      : 'bg-orange-100 text-orange-800'
                  }`}>
                    {product.onHand} units left
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* System Health and Stock Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ErrorMonitoring />
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Performance Metrics</h3>
          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-500">API Response Time</p>
              <div className="flex items-baseline">
                <p className={`text-2xl font-bold ${
                  performanceMetrics.apiResponseTime < 300 ? 'text-green-600' :
                  performanceMetrics.apiResponseTime < 500 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {performanceMetrics.apiResponseTime}ms
                </p>
                <p className="text-sm text-gray-500 ml-2">
                  ({performanceMetrics.totalApiCalls} calls in 24h)
                </p>
              </div>
            </div>
            
            <div>
              <p className="text-sm text-gray-500">Webhook Success Rate</p>
              <div className="flex items-baseline">
                <p className={`text-2xl font-bold ${
                  performanceMetrics.webhookSuccessRate >= 98 ? 'text-green-600' :
                  performanceMetrics.webhookSuccessRate >= 90 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {performanceMetrics.webhookSuccessRate}%
                </p>
                <p className="text-sm text-gray-500 ml-2">
                  ({performanceMetrics.totalWebhooks} webhooks in 24h)
                </p>
              </div>
            </div>

            <div className="text-xs text-gray-400 mt-4">
              Last updated: {formatDistanceToNow(performanceMetrics.timestamp, { addSuffix: true })}
            </div>
          </div>
        </div>
      </div>

      {/* Location Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        {/* JOY Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700">JOY Section</h3>
          <p className="text-3xl font-bold mt-2">{sectionCounts.joy}</p>
          <p className="text-sm text-gray-500">products</p>
        </div>

        {/* LOVE Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700">LOVE Section</h3>
          <p className="text-3xl font-bold mt-2">{sectionCounts.love}</p>
          <p className="text-sm text-gray-500">products</p>
        </div>

        {/* PEACE Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700">PEACE Section</h3>
          <p className="text-3xl font-bold mt-2">{sectionCounts.peace}</p>
          <p className="text-sm text-gray-500">products</p>
        </div>

        {/* HOPE Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700">HOPE Section</h3>
          <p className="text-3xl font-bold mt-2">{sectionCounts.hope}</p>
          <p className="text-sm text-gray-500">products</p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Recent Activity</h3>
        <div className="space-y-4">
          {recentActivity.map((activity) => (
            <div key={activity.id} className="flex items-center space-x-4 py-2 border-b last:border-0">
              <span className={`p-2 rounded-full ${
                activity.type === 'webhook' ? 'bg-purple-100' :
                activity.type === 'cron' ? 'bg-blue-100' : 'bg-green-100'
              }`}>
                {activity.type === 'webhook' ? '🔔' :
                 activity.type === 'cron' ? '⏰' : '📦'}
              </span>
              <div className="flex-grow">
                <p className="text-sm font-medium">{activity.description}</p>
                <p className="text-xs text-gray-500">
                  {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                </p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs ${
                activity.status === 'success' 
                  ? 'bg-green-100 text-green-800' 
                  : activity.status === 'running'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {activity.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => router.push('/products/add')}
              className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className="block text-2xl mb-2">➕</span>
              <span className="text-sm font-medium">Add Product</span>
            </button>
            <button
              onClick={handleSync}
              className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className="block text-2xl mb-2">🔄</span>
              <span className="text-sm font-medium">Sync Now</span>
            </button>
            <button
              onClick={() => {
                const timestamp = new Date().toISOString().split('T')[0];
                exportToCSV(products, `inventory-report-${timestamp}`);
              }}
              className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className="block text-2xl mb-2">📊</span>
              <span className="text-sm font-medium">Stock Report</span>
            </button>
            <button
              onClick={() => {
                const timestamp = new Date().toISOString().split('T')[0];
                exportLocation2ToCSV(products, `location2-inventory-${timestamp}`);
              }}
              className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className="block text-2xl mb-2">📦</span>
              <span className="text-sm font-medium">Location 2 CSV</span>
            </button>
            <button
              onClick={() => router.push('/products/import')}
              className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className="block text-2xl mb-2">📥</span>
              <span className="text-sm font-medium">Import CSV</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-700">Critical Alerts</h3>
          <button 
            onClick={() => router.push('/stock-status')}
            className="text-sm text-indigo-600 hover:text-indigo-800"
          >
            View All →
          </button>
        </div>
        <div className="space-y-4">
          {products
            .filter(p => p.onHand === 0)
            .slice(0, 3)
            .map(product => (
              <div key={product.id} className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                <div>
                  <p className="font-medium">{product.productName}</p>
                  <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                </div>
                <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                  Out of Stock
                </span>
              </div>
          ))}
        </div>
      </div>
    </div>
  );
} 