import { useState, useEffect } from 'react';
import { Product } from '@/types';
import { getAllProducts, addProduct, updateProduct, deleteProduct } from '@/lib/db';
import ProductEditModal from '@/components/ProductEditModal';
import CsvImportModal from '@/components/CsvImportModal';
import IncrementalSyncButton from '@/components/IncrementalSyncButton';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/router';

interface SyncResult {
  success: boolean;
  sku: string;
  error?: string;
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showUpdateMode, setShowUpdateMode] = useState(false);
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [lastAutoSync, setLastAutoSync] = useState<Date | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadProducts();
  }, []);

  // Auto-sync effect
  useEffect(() => {
    // Check if time has passed since last sync
    const shouldSync = () => {
      if (!lastAutoSync) {
        console.log('No previous sync found, should run initial sync');
        return true;
      }
      const thirtyMinutesInMs = 30 * 60 * 1000;  // 30 minutes in milliseconds
      const timeSinceLastSync = Date.now() - lastAutoSync.getTime();
      console.log(`Time since last sync: ${Math.floor(timeSinceLastSync / 1000)} seconds`);
      console.log(`Next sync in: ${Math.floor((thirtyMinutesInMs - timeSinceLastSync) / 1000)} seconds`);
      return timeSinceLastSync > thirtyMinutesInMs;
    };

    const autoSync = async () => {
      console.log('Checking if sync is needed...');
      if (shouldSync()) {
        console.log('Auto-sync triggered');
        const syncButton = document.querySelector('[data-testid="incremental-sync-btn"]');
        console.log('Sync button found:', !!syncButton);
        
        if (syncButton) {
          try {
            console.log('Attempting to trigger sync button click');
            (syncButton as HTMLButtonElement).click();
            setLastAutoSync(new Date());
            console.log('Sync button clicked, timestamp updated');
            toast({
              title: 'Auto-Sync Triggered',
              description: 'Running automatic sync...',
            });
          } catch (error) {
            console.error('Error triggering sync:', error);
            toast({
              title: 'Auto-Sync Failed',
              description: 'Failed to trigger automatic sync',
              variant: 'destructive',
            });
          }
        } else {
          console.error('Sync button not found in DOM');
          toast({
            title: 'Auto-Sync Error',
            description: 'Could not find sync button',
            variant: 'destructive',
          });
        }
      } else {
        console.log('Sync not needed yet');
      }
    };

    // Run initial check
    console.log('Setting up auto-sync...');
    autoSync();

    // Set up interval to check every minute
    const interval = setInterval(() => {
      console.log('Running periodic sync check...');
      autoSync();
    }, 60 * 1000);

    console.log('Auto-sync interval set up');

    return () => {
      console.log('Cleaning up auto-sync interval');
      clearInterval(interval);
    };
  }, [lastAutoSync]);

  const loadProducts = async () => {
    try {
      const fetchedProducts = await getAllProducts();
      console.log('Fetched products:', fetchedProducts);
      
      // Verify Shopify configuration
      fetchedProducts.forEach(product => {
        console.log(`Product ${product.sku} Shopify config:`, {
          hasShopifyProducts: !!product.shopifyProducts,
          nakedArmorConfig: product.shopifyProducts?.nakedArmor,
          grownManShaveConfig: product.shopifyProducts?.grownManShave
        });
      });
      
      setProducts(fetchedProducts);
    } catch (err) {
      setError('Failed to load products');
      console.error('Error loading products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (product: Product) => {
    setEditingProduct(product);
    setShowEditModal(true);
  };

  const handleAddClick = () => {
    setEditingProduct(null);
    setShowAddModal(true);
  };

  const handleEditSave = async (updatedProduct: Partial<Product>) => {
    try {
      if (!editingProduct?.id) throw new Error('No product selected for editing');
      
      // Remove any undefined or null values
      const cleanData = Object.fromEntries(
        Object.entries(updatedProduct).filter(([_, v]) => v != null)
      );

      await updateProduct(editingProduct.id, cleanData);
      toast({
        title: 'Success',
        description: 'Product updated successfully',
      });
      
      await loadProducts();
      setShowEditModal(false);
    } catch (err) {
      console.error('Error updating product:', err);
      toast({
        title: 'Error',
        description: 'Failed to update product',
        variant: 'destructive',
      });
    }
  };

  const handleAddSave = async (newProduct: Partial<Product>) => {
    try {
      await addProduct(newProduct as Omit<Product, 'id' | 'userId' | 'createdAt'>);
      toast({
        title: 'Success',
        description: 'Product added successfully',
      });
      
      await loadProducts();
      setShowAddModal(false);
    } catch (err) {
      console.error('Error adding product:', err);
      toast({
        title: 'Error',
        description: 'Failed to add product',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteClick = (product: Product) => {
    if (window.confirm(`Are you sure you want to delete ${product.productName}? This action cannot be undone.`)) {
      handleDelete(product);
    }
  };

  const handleDelete = async (product: Product) => {
    try {
      setDeletingProduct(product);
      await deleteProduct(product.sku);
      toast({
        title: 'Success',
        description: 'Product deleted successfully',
      });
      await loadProducts();
    } catch (err) {
      console.error('Error deleting product:', err);
      toast({
        title: 'Error',
        description: 'Failed to delete product',
        variant: 'destructive',
      });
    } finally {
      setDeletingProduct(null);
    }
  };

  const handleImportProducts = async (csvData: any[]) => {
    try {
      // Determine if this is an update or import based on button clicked
      const endpoint = showUpdateMode ? '/api/update-products' : '/api/import-csv';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ products: csvData })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: `${result.results.updated} products ${showUpdateMode ? 'updated' : 'imported'} successfully`,
        });
        await loadProducts();
      } else {
        toast({
          title: 'Error',
          description: result.message,
          variant: 'destructive',
        });
      }

    } catch (error) {
      console.error('Operation failed:', error);
      toast({
        title: 'Error',
        description: 'Failed to process products',
        variant: 'destructive',
      });
    } finally {
      setShowImportModal(false);
    }
  };

  const handleShopifySync = async (store: 'naked-armor' | 'grown-man-shave') => {
    setIsSyncing(true);
    try {
      console.log('Starting sync for store:', store);
      console.log('Total products:', products.length);

      // Remove the filter for pre-configured products
      const syncableProducts = products.filter(product => product.sku);

      console.log('Products to sync:', syncableProducts.map(p => ({
        sku: p.sku,
        onHand: p.onHand
      })));

      if (syncableProducts.length === 0) {
        toast({
          title: 'Warning',
          description: 'No products found to sync',
          variant: 'destructive',
        });
        return;
      }

      console.log('Calling sync API...');
      const response = await fetch('/api/shopify/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          products: syncableProducts,
          storeIdentifier: store,
        }),
      });

      console.log('API Response status:', response.status);
      const data = await response.json();
      console.log('API Response data:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync with Shopify');
      }

      toast({
        title: 'Sync Complete',
        description: `${data.summary.succeeded} products synced successfully, ${data.summary.failed} failed`,
        variant: data.success ? 'default' : 'destructive',
      });

      if (data.summary.failed > 0) {
        const failedItems = data.results
          .filter((r: SyncResult) => !r.success)
          .map((r: SyncResult) => `${r.sku}: ${r.error}`)
          .join('\n');
        
        toast({
          title: 'Sync Failures',
          description: `Failed items:\n${failedItems}`,
          variant: 'destructive',
        });
      }

      await loadProducts();
    } catch (error) {
      console.error('Error syncing with Shopify:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to sync with Shopify',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedProducts.length) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedProducts.length} products?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await Promise.all(selectedProducts.map(id => deleteProduct(id)));
      setSelectedProducts([]);
      await loadProducts();
      toast({
        title: 'Success',
        description: `${selectedProducts.length} products deleted successfully`,
      });
    } catch (error) {
      console.error('Error deleting products:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete products',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdateProducts = async () => {
    // Show the import modal first
    setShowImportModal(true);
  };

  const handleImportClick = () => {
    setShowUpdateMode(false);
    setShowImportModal(true);
  };

  const handleUpdateClick = () => {
    setShowUpdateMode(true);
    setShowImportModal(true);
  };

  const sortProducts = (products: Product[]) => {
    if (!sortField) return products;

    return [...products].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'sku':
        case 'productName':
        case 'status':
          aValue = a[sortField]?.toLowerCase();
          bValue = b[sortField]?.toLowerCase();
          break;
        case 'primaryLoc':
          aValue = a.location ? `${a.location.loc1}-${a.location.loc2}-${a.location.loc3}-${a.location.loc4}` : '';
          bValue = b.location ? `${b.location.loc1}-${b.location.loc2}-${b.location.loc3}-${b.location.loc4}` : '';
          break;
        case 'secondaryLoc':
          aValue = a.location2 ? `${a.location2.loc1}-${a.location2.loc2}-${a.location2.loc3}-${a.location2.loc4}` : '';
          bValue = b.location2 ? `${b.location2.loc1}-${b.location2.loc2}-${b.location2.loc3}-${b.location2.loc4}` : '';
          break;
        case 'primaryStock':
          aValue = a.onHand;
          bValue = b.onHand;
          break;
        case 'secondaryStock':
          aValue = a.location2?.onHand || 0;
          bValue = b.location2?.onHand || 0;
          break;
        default:
          return 0;
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  };

  const filteredProducts = sortProducts(
    products.filter(product => 
      product.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-center">{error}</div>;
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-[1400px]">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Products</h1>
        <div className="space-x-4">
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Add New Product
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
          >
            Import CSV
          </button>
          <IncrementalSyncButton />
          <button
            onClick={() => handleShopifySync('naked-armor')}
            className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
            disabled={isSyncing}
          >
            Sync Naked Armor
          </button>
          <button
            onClick={() => handleShopifySync('grown-man-shave')}
            className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
            disabled={isSyncing}
          >
            Sync Grown Man Shave
          </button>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by SKU or name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {selectedProducts.length > 0 && (
        <div className="mb-4 p-2 bg-gray-100 rounded flex items-center justify-between">
          <span>{selectedProducts.length} products selected</span>
          <button
            onClick={handleBulkDelete}
            disabled={isDeleting}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Delete Selected'}
          </button>
        </div>
      )}

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full table-fixed divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="w-36 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('sku')}
              >
                SKU {sortField === 'sku' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="w-72 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('productName')}
              >
                Name {sortField === 'productName' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="w-36 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('primaryLoc')}
              >
                Primary Loc {sortField === 'primaryLoc' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="w-20 px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('primaryStock')}
              >
                Stock {sortField === 'primaryStock' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="w-36 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('secondaryLoc')}
              >
                Secondary Loc {sortField === 'secondaryLoc' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="w-20 px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('secondaryStock')}
              >
                Stock {sortField === 'secondaryStock' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="w-24 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('status')}
              >
                Status {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th className="w-20 px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              <th className="w-12 px-2 py-3 text-center">
                <input
                  type="checkbox"
                  onChange={e => {
                    const checked = e.target.checked;
                    setSelectedProducts(checked ? filteredProducts.map(p => p.id) : []);
                  }}
                  checked={selectedProducts.length === filteredProducts.length}
                  className="rounded border-gray-300"
                />
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredProducts.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50">
                <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900">{product.sku}</td>
                <td className="px-2 py-3 text-sm text-gray-900 whitespace-normal">{product.productName}</td>
                <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900">
                  {product.location ? `${product.location.loc1}-${product.location.loc2}-${product.location.loc3}-${product.location.loc4}` : 'N/A'}
                </td>
                <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 text-center">{product.onHand}</td>
                <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900">
                  {product.location2 ? 
                    `${product.location2.loc1}-${product.location2.loc2}-${product.location2.loc3}-${product.location2.loc4}` 
                    : 'N/A'
                  }
                </td>
                <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 text-center">
                  {product.location2?.onHand || 0}
                </td>
                <td className="px-2 py-3 whitespace-nowrap text-sm">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    product.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {product.status}
                  </span>
                </td>
                <td className="px-2 py-3 whitespace-nowrap text-sm text-center">
                  <div className="flex justify-center items-center">
                    <button
                      onClick={() => handleEditClick(product)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Edit
                    </button>
                  </div>
                </td>
                <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 text-center">
                  <input
                    type="checkbox"
                    checked={selectedProducts.includes(product.id)}
                    onChange={e => {
                      setSelectedProducts(prev => 
                        e.target.checked
                          ? [...prev, product.id]
                          : prev.filter(id => id !== product.id)
                      );
                    }}
                    className="rounded border-gray-300"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showEditModal && (
        <ProductEditModal
          product={editingProduct}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSave={handleEditSave}
        />
      )}

      {showAddModal && (
        <ProductEditModal
          product={null}
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSave={handleAddSave}
        />
      )}

      <CsvImportModal
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setShowUpdateMode(false);
        }}
        onImport={handleImportProducts}
        mode={showUpdateMode ? 'update' : 'import'}
      />
    </div>
  );
} 