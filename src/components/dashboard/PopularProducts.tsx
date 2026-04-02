import { useState, useEffect } from 'react';
import { getPopularProducts } from '@/lib/db';
import Link from 'next/link';

export default function PopularProducts() {
  const [timeframe, setTimeframe] = useState(30);
  const [products, setProducts] = useState<Array<{
    productId: string;
    productName: string;
    sku: string;
    totalSold: number;
  }>>([]);

  useEffect(() => {
    loadPopularProducts();
  }, [timeframe]);

  const loadPopularProducts = async () => {
    try {
      const popularProducts = await getPopularProducts(timeframe);
      setProducts(popularProducts);
    } catch (error) {
      console.error('Error loading popular products:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-700">Popular Products</h3>
        <select
          value={timeframe}
          onChange={(e) => setTimeframe(Number(e.target.value))}
          className="px-3 py-1 border rounded-lg text-sm"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className="space-y-4">
        {products.map((product) => (
          <Link 
            key={product.productId}
            href={`/products/${product.productId}`}
            className="block hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center justify-between p-4 border-b last:border-0">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-gray-900 truncate">
                  {product.productName}
                </h4>
                <p className="text-sm text-gray-500">
                  SKU: {product.sku}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {product.totalSold} sold
                  </p>
                  <p className="text-xs text-gray-500">
                    in the last {timeframe} days
                  </p>
                </div>
                <div className="text-gray-400">
                  →
                </div>
              </div>
            </div>
          </Link>
        ))}

        {products.length === 0 && (
          <div className="text-center py-4 text-gray-500">
            No sales data available for this period
          </div>
        )}
      </div>
    </div>
  );
} 