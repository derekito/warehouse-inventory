import { useState, useEffect } from 'react';
import { getErrorRates } from '@/lib/db';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function ErrorMonitoring() {
  const [errorRates, setErrorRates] = useState<Array<{
    type: string;
    total: number;
    errors: number;
    rate: number;
  }>>([]);
  const [timeframe, setTimeframe] = useState(7);

  useEffect(() => {
    loadErrorRates();
  }, [timeframe]);

  const loadErrorRates = async () => {
    try {
      const rates = await getErrorRates(timeframe);
      setErrorRates(rates);
    } catch (error) {
      console.error('Error loading error rates:', error);
    }
  };

  const getStatusColor = (rate: number) => {
    if (rate <= 1) return 'text-green-600';
    if (rate <= 5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusBg = (rate: number) => {
    if (rate <= 1) return 'bg-green-50';
    if (rate <= 5) return 'bg-yellow-50';
    return 'bg-red-50';
  };

  const chartData = {
    labels: errorRates.map(item => item.type),
    datasets: [
      {
        label: 'Error Rate (%)',
        data: errorRates.map(item => item.rate),
        backgroundColor: errorRates.map(item => 
          item.rate <= 1 ? 'rgba(5, 150, 105, 0.5)' :
          item.rate <= 5 ? 'rgba(217, 119, 6, 0.5)' :
          'rgba(220, 38, 38, 0.5)'
        ),
        borderColor: errorRates.map(item => 
          item.rate <= 1 ? 'rgb(5, 150, 105)' :
          item.rate <= 5 ? 'rgb(217, 119, 6)' :
          'rgb(220, 38, 38)'
        ),
        borderWidth: 1
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const index = context.dataIndex;
            const item = errorRates[index];
            return `${item.errors} of ${item.total} requests failed (${item.rate.toFixed(1)}%)`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: Math.max(10, ...errorRates.map(item => item.rate))
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-700">Error Rates</h3>
        <select
          value={timeframe}
          onChange={(e) => setTimeframe(Number(e.target.value))}
          className="px-3 py-1 border rounded-lg text-sm"
        >
          <option value={1}>Last 24 hours</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>

      <div className="space-y-4">
        {/* Chart */}
        <div className="h-48 mb-4">
          <Bar data={chartData} options={chartOptions} />
        </div>

        {/* Error Rate List */}
        {errorRates.map((item) => (
          <div 
            key={item.type} 
            className={`flex items-center justify-between p-4 rounded-lg ${getStatusBg(item.rate)}`}
          >
            <div className="flex-1">
              <p className="font-medium capitalize">{item.type}</p>
              <div className="flex items-center space-x-2">
                <span className={`text-lg font-bold ${getStatusColor(item.rate)}`}>
                  {item.rate.toFixed(1)}%
                </span>
                <span className="text-sm text-gray-500">
                  ({item.errors} of {item.total} failed)
                </span>
              </div>
            </div>
          </div>
        ))}

        {errorRates.length === 0 && (
          <div className="text-center py-4 text-gray-500">
            No errors recorded in this period
          </div>
        )}
      </div>
    </div>
  );
} 