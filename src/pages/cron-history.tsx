import { useState, useEffect } from 'react';
import { getCronHistory } from '@/lib/db';
import { formatDistanceToNow, formatDuration, intervalToDuration } from 'date-fns';

export default function CronHistory() {
  const [cronJobs, setCronJobs] = useState<Array<{
    id: string;
    type: 'sync' | 'cleanup' | 'backup';
    status: 'success' | 'error' | 'running';
    startTime: Date;
    endTime?: Date;
    error?: string;
    details?: {
      duration?: number;
      productsProcessed?: number;
      nakedArmorSync?: boolean;
      grownManShaveSync?: boolean;
    };
  }>>([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadCronJobs();
  }, []);

  const loadCronJobs = async () => {
    try {
      const jobs = await getCronHistory();
      setCronJobs(jobs);
    } catch (error) {
      console.error('Error loading cron jobs:', error);
    }
  };

  const getDuration = (job: typeof cronJobs[0]) => {
    if (!job.endTime) return 'Running...';
    
    const duration = intervalToDuration({
      start: job.startTime,
      end: job.endTime
    });

    return formatDuration(duration, { delimiter: ', ' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Cron Job History</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="all">All Jobs</option>
          <option value="sync">Sync Jobs</option>
          <option value="cleanup">Cleanup Jobs</option>
          <option value="backup">Backup Jobs</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Start Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Duration
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Details
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {cronJobs
              .filter(job => filter === 'all' || job.type === filter)
              .map(job => (
                <tr key={job.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDistanceToNow(job.startTime, { addSuffix: true })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                    {job.type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {getDuration(job)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(job.status)}`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {job.details && (
                      <div>
                        <p>Products: {job.details.productsProcessed}</p>
                        <p>NA Sync: {job.details.nakedArmorSync ? '✅' : '❌'}</p>
                        <p>GMS Sync: {job.details.grownManShaveSync ? '✅' : '❌'}</p>
                      </div>
                    )}
                    {job.error && (
                      <p className="text-red-600">{job.error}</p>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 