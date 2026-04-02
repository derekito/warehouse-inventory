import { useEffect, useState } from 'react';
import { getWebhookHistory } from '@/lib/db';
import type { WebhookEvent } from '@/types';
import { toast } from '@/lib/toast';
import { format } from 'date-fns';

export default function WebhookHistory() {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadWebhookHistory();
  }, []);

  const loadWebhookHistory = async () => {
    try {
      const history = await getWebhookHistory();
      setEvents(history);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load webhook history',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'inventory_update': return 'Inventory Update';
      case 'product_update': return 'Product Update';
      case 'order_created': return 'Order Created';
      case 'refund': return 'Refund';
      default: return type;
    }
  };

  const filteredEvents = events.filter(event => 
    filter === 'all' || event.eventType === filter
  );

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-[1400px]">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Webhook History</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="all">All Events</option>
          <option value="inventory_update">Inventory Updates</option>
          <option value="product_update">Product Updates</option>
          <option value="order_created">Orders</option>
          <option value="refund">Refunds</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="w-full">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Store
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Event Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEvents.map((event) => (
                <tr key={event.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(event.timestamp, 'MMM d, yyyy HH:mm:ss')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {event.store === 'nakedArmor' ? 'Naked Armor' : 'Grown Man Shave'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getEventTypeLabel(event.eventType)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {event.payload.sku && <div>SKU: {event.payload.sku}</div>}
                    {event.payload.quantity && (
                      <div>
                        Quantity: {event.payload.previousQuantity} → {event.payload.newQuantity}
                      </div>
                    )}
                    {event.payload.orderId && <div>Order ID: {event.payload.orderId}</div>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      event.status === 'success' 
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {event.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 