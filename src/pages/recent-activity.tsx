import { useState, useEffect } from 'react';
import { getRecentActivity, type RecentActivityRow } from '@/lib/db';
import { formatDistanceToNow } from 'date-fns';

export default function RecentActivityPage() {
  const [activities, setActivities] = useState<RecentActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    loadActivities();
    // Set up auto-refresh every minute
    const interval = setInterval(loadActivities, 60000);
    return () => clearInterval(interval);
  }, [limit]);

  const loadActivities = async () => {
    try {
      const recentActivities = await getRecentActivity(limit);
      setActivities(recentActivities);
    } catch (error) {
      console.error('Error loading recent activity:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityEmoji = (type: string) => {
    switch (type) {
      case 'inventory':
        return '📦';
      case 'webhook':
        return '🔄';
      case 'cron':
        return '⚡';
      case 'product':
        return '🏷️';
      default:
        return '•';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600 bg-green-50';
      case 'error':
        return 'text-red-600 bg-red-50';
      case 'running':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Recent Activity</h1>
        <div className="flex items-center gap-4">
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value={25}>Last 25 activities</option>
            <option value={50}>Last 50 activities</option>
            <option value={100}>Last 100 activities</option>
          </select>
          <button
            onClick={loadActivities}
            className="px-4 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading activities...</div>
        ) : activities.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No recent activities found</div>
        ) : (
          <div className="divide-y">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1 text-gray-400 text-lg">
                    {getActivityEmoji(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">
                        {activity.description}
                      </p>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                          activity.status
                        )}`}
                      >
                        {activity.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                    </p>
                  </div>
                  <div className="text-sm text-gray-500">
                    {activity.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 