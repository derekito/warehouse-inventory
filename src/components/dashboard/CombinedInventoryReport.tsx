import { useState, useMemo } from 'react';
import type { Product } from '@/types';
import { exportCombinedInventoryToCSV } from '@/lib/exportToCSV';
import { updateProduct } from '@/lib/db';
import { toast } from '@/lib/toast';

interface CombinedInventoryReportProps {
  products: Product[];
}

export default function CombinedInventoryReport({ products }: CombinedInventoryReportProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'sku' | 'name' | 'total' | 'location1Qty' | 'location2Qty' | 'location1Str' | 'location2Str'>('sku');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [saving, setSaving] = useState<string | null>(null); // productId currently saving

  // Calculate combined inventory data
  const inventoryData = useMemo(() => {
    return products.map(product => {
      const location1Qty = product.onHand || 0;
      const location2Qty = product.location2?.onHand || 0;
      const totalQty = location1Qty + location2Qty;

      return {
        ...product,
        location1Qty,
        location2Qty,
        totalQty,
        hasLocation1: !!product.location,
        hasLocation2: !!product.location2,
        location1String: product.location 
          ? `${product.location.loc1}-${product.location.loc2}-${product.location.loc3}-${product.location.loc4}`
          : 'N/A',
        location2String: product.location2
          ? `${product.location2.loc1}-${product.location2.loc2}-${product.location2.loc3}-${product.location2.loc4}`
          : 'N/A'
      };
    });
  }, [products]);

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let filtered = inventoryData;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.sku.toLowerCase().includes(query) ||
        item.productName.toLowerCase().includes(query) ||
        item.location1String.toLowerCase().includes(query) ||
        item.location2String.toLowerCase().includes(query)
      );
    }

    // Sort data
    const sorted = [...filtered].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortBy) {
        case 'sku':
          aValue = a.sku;
          bValue = b.sku;
          break;
        case 'name':
          aValue = a.productName;
          bValue = b.productName;
          break;
        case 'total':
          aValue = a.totalQty;
          bValue = b.totalQty;
          break;
        case 'location1Qty':
          aValue = a.location1Qty;
          bValue = b.location1Qty;
          break;
        case 'location2Qty':
          aValue = a.location2Qty;
          bValue = b.location2Qty;
          break;
        case 'location1Str':
          aValue = a.location1String;
          bValue = b.location1String;
          break;
        case 'location2Str':
          aValue = a.location2String;
          bValue = b.location2String;
          break;
        default:
          aValue = a.sku;
          bValue = b.sku;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return sortOrder === 'asc'
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      }
    });

    return sorted;
  }, [inventoryData, searchQuery, sortBy, sortOrder]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    const location1Total = inventoryData.reduce((sum, item) => sum + item.location1Qty, 0);
    const location2Total = inventoryData.reduce((sum, item) => sum + item.location2Qty, 0);
    const combinedTotal = location1Total + location2Total;
    const productsWithLocation1 = inventoryData.filter(item => item.hasLocation1).length;
    const productsWithLocation2 = inventoryData.filter(item => item.hasLocation2).length;
    const productsWithBoth = inventoryData.filter(item => item.hasLocation1 && item.hasLocation2).length;

    return {
      location1Total,
      location2Total,
      combinedTotal,
      productsWithLocation1,
      productsWithLocation2,
      productsWithBoth,
      totalProducts: inventoryData.length
    };
  }, [inventoryData]);

  const handleSort = (newSortBy: typeof sortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (column: typeof sortBy) => {
    if (sortBy !== column) return '↕️';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  // Persist inventory quantity change
  const handleQuantityChange = async (productId: string, which: 'location1' | 'location2', value: number) => {
    try {
      setSaving(productId);
      if (which === 'location1') {
        await updateProduct(productId, { onHand: value });
      } else {
        // Use field path update to avoid overwriting other location2 fields
        await updateProduct(productId, { ['location2.onHand']: value } as unknown as Partial<Product>);
      }
      toast({ title: 'Saved', description: 'Inventory updated' });
    } catch (e) {
      console.error('Failed to save inventory', e);
      toast({ title: 'Error', description: 'Failed to save inventory', variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  // Persist location text change
  const handleLocationChange = async (
    productId: string,
    which: 'location' | 'location2',
    field: 'loc1' | 'loc2' | 'loc3' | 'loc4',
    value: string
  ) => {
    try {
      setSaving(productId);
      // Update only the specific subfield to preserve existing data (including onHand)
      const path = `${which}.${field}` as keyof Product;
      await updateProduct(productId, { [path]: value } as unknown as Partial<Product>);
      toast({ title: 'Saved', description: 'Location updated' });
    } catch (e) {
      console.error('Failed to save location', e);
      toast({ title: 'Error', description: 'Failed to save location', variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const handleDownload = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    exportCombinedInventoryToCSV(products, `combined-inventory-${timestamp}`);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-700">Combined Inventory Report</h3>
          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <span>📥</span>
            <span>Download CSV</span>
          </button>
        </div>
        
        {/* Summary Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-1">Location 1 Total</p>
            <p className="text-xl font-bold text-blue-600">{summary.location1Total.toLocaleString()}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-1">Location 2 Total</p>
            <p className="text-xl font-bold text-green-600">{summary.location2Total.toLocaleString()}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-1">Combined Total</p>
            <p className="text-xl font-bold text-purple-600">{summary.combinedTotal.toLocaleString()}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-1">Products with Both</p>
            <p className="text-xl font-bold text-gray-600">{summary.productsWithBoth}</p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <input
            type="text"
            placeholder="Search by SKU, name, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="text-sm text-gray-500 flex items-center">
            Showing {filteredAndSortedData.length} of {summary.totalProducts} products
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-visible">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                onClick={() => handleSort('sku')}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center gap-2">
                  SKU {getSortIcon('sku')}
                </div>
              </th>
              <th
                onClick={() => handleSort('name')}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center gap-2">
                  Product Name {getSortIcon('name')}
                </div>
              </th>
              <th
                onClick={() => handleSort('location1Str')}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center gap-2">
                  Location 1 {getSortIcon('location1Str')}
                </div>
              </th>
              <th
                onClick={() => handleSort('location1Qty')}
                className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center justify-center gap-2">
                  Qty {getSortIcon('location1Qty')}
                </div>
              </th>
              <th
                onClick={() => handleSort('location2Str')}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center gap-2">
                  Location 2 {getSortIcon('location2Str')}
                </div>
              </th>
              <th
                onClick={() => handleSort('location2Qty')}
                className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center justify-center gap-2">
                  Qty {getSortIcon('location2Qty')}
                </div>
              </th>
              <th
                onClick={() => handleSort('total')}
                className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center justify-center gap-2">
                  Combined Total {getSortIcon('total')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAndSortedData.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                  {item.sku}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {item.productName}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <input
                      defaultValue={item.location?.loc1 || ''}
                      onBlur={(e) => handleLocationChange(item.id!, 'location', 'loc1', e.target.value)}
                      className="w-14 px-2 py-1 border rounded"
                    />
                    <span>-</span>
                    <input
                      defaultValue={item.location?.loc2 || ''}
                      onBlur={(e) => handleLocationChange(item.id!, 'location', 'loc2', e.target.value)}
                      className="w-14 px-2 py-1 border rounded"
                    />
                    <span>-</span>
                    <input
                      defaultValue={item.location?.loc3 || ''}
                      onBlur={(e) => handleLocationChange(item.id!, 'location', 'loc3', e.target.value)}
                      className="w-14 px-2 py-1 border rounded"
                    />
                    <span>-</span>
                    <input
                      defaultValue={item.location?.loc4 || ''}
                      onBlur={(e) => handleLocationChange(item.id!, 'location', 'loc4', e.target.value)}
                      className="w-14 px-2 py-1 border rounded"
                    />
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-center font-medium text-blue-600">
                  <input
                    type="number"
                    defaultValue={item.location1Qty}
                    onBlur={(e) => handleQuantityChange(item.id!, 'location1', Number(e.target.value))}
                    className="w-16 px-2 py-1 border rounded text-center"
                  />
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <input
                      defaultValue={item.location2?.loc1 || ''}
                      onBlur={(e) => handleLocationChange(item.id!, 'location2', 'loc1', e.target.value)}
                      className="w-14 px-2 py-1 border rounded"
                    />
                    <span>-</span>
                    <input
                      defaultValue={item.location2?.loc2 || ''}
                      onBlur={(e) => handleLocationChange(item.id!, 'location2', 'loc2', e.target.value)}
                      className="w-14 px-2 py-1 border rounded"
                    />
                    <span>-</span>
                    <input
                      defaultValue={item.location2?.loc3 || ''}
                      onBlur={(e) => handleLocationChange(item.id!, 'location2', 'loc3', e.target.value)}
                      className="w-14 px-2 py-1 border rounded"
                    />
                    <span>-</span>
                    <input
                      defaultValue={item.location2?.loc4 || ''}
                      onBlur={(e) => handleLocationChange(item.id!, 'location2', 'loc4', e.target.value)}
                      className="w-14 px-2 py-1 border rounded"
                    />
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-center font-medium text-green-600">
                  <input
                    type="number"
                    defaultValue={item.location2Qty}
                    onBlur={(e) => handleQuantityChange(item.id!, 'location2', Number(e.target.value))}
                    className="w-16 px-2 py-1 border rounded text-center"
                  />
                </td>
                <td className="px-4 py-3 text-sm text-center font-bold text-purple-600">
                  {item.totalQty}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredAndSortedData.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {searchQuery ? 'No products found matching your search' : 'No products available'}
          </div>
        )}
      </div>
    </div>
  );
}
