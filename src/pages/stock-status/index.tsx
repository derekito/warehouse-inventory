import { useEffect, useState } from 'react';
import { getAllProducts } from '@/lib/db';
import type { Product } from '@/types';
import { toast } from '@/lib/toast';

export default function StockStatus() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [stockThreshold, setStockThreshold] = useState<number>(2);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const fetchedProducts = await getAllProducts();
      setProducts(fetchedProducts);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load stock status',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getLowStockProducts = () => {
    return products
      .filter(p => {
        // First filter by search query
        const matchesSearch = p.productName.toLowerCase().includes(searchQuery.toLowerCase());
        // Then filter by stock threshold
        const isLowStock = p.onHand <= stockThreshold;
        return matchesSearch && isLowStock;
      })
      .sort((a, b) => {
        if (sortOrder === 'asc') {
          return a.productName.localeCompare(b.productName);
        }
        return b.productName.localeCompare(a.productName);
      });
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-[1400px]">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Stock Status Detail</h1>
        <button
          onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
          className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <span>Sort by Name</span>
          <span>{sortOrder === 'asc' ? '↓' : '↑'}</span>
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        {/* Search Bar */}
        <div className="flex-grow">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by product name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Stock Threshold Input */}
        <div className="flex items-center space-x-2">
          <label htmlFor="threshold" className="whitespace-nowrap text-sm text-gray-600">
            Show items with
          </label>
          <input
            id="threshold"
            type="number"
            min="0"
            value={stockThreshold}
            onChange={(e) => setStockThreshold(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <span className="whitespace-nowrap text-sm text-gray-600">
            or fewer units
          </span>
        </div>
      </div>

      {searchQuery && (
        <p className="mt-2 mb-4 text-sm text-gray-500">
          Showing results for "{searchQuery}"
        </p>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <div className="space-y-3">
          {getLowStockProducts().map(product => (
            <div 
              key={product.id} 
              className="flex justify-between items-center py-4 border-b last:border-0"
            >
              <div className="flex-grow">
                <p className="font-medium text-lg">{product.productName}</p>
                <div className="flex space-x-4 text-sm text-gray-500">
                  <p>SKU: {product.sku}</p>
                  <p>Location: {product.location ? 
                    `${product.location.loc1}-${product.location.loc2}-${product.location.loc3}-${product.location.loc4}` 
                    : 'N/A'}
                  </p>
                </div>
              </div>
              <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                product.onHand === 0 
                  ? 'bg-red-100 text-red-800' 
                  : 'bg-orange-100 text-orange-800'
              }`}>
                {product.onHand} units left
              </span>
            </div>
          ))}
          {getLowStockProducts().length === 0 && (
            <p className="text-center text-gray-500 py-8">
              {searchQuery 
                ? `No products matching "${searchQuery}" with ${stockThreshold} or fewer units`
                : `No products with ${stockThreshold} or fewer units in stock`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
} 