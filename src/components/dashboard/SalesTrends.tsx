import { useState, useEffect } from 'react';
import { getSalesData } from '@/lib/db';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { subDays, format, eachDayOfInterval } from 'date-fns';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function SalesTrends() {
  const [timeframe, setTimeframe] = useState(7);
  const [salesData, setSalesData] = useState<{
    dates: string[];
    nakedArmor: number[];
    grownManShave: number[];
  }>({
    dates: [],
    nakedArmor: [],
    grownManShave: []
  });

  useEffect(() => {
    loadSalesData();
  }, [timeframe]);

  const loadSalesData = async () => {
    try {
      const endDate = new Date();
      const startDate = subDays(endDate, timeframe);
      
      // Get all dates in the range
      const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
      const formattedDates = dateRange.map(date => format(date, 'MM/dd'));
      
      // Get sales data
      const sales = await getSalesData(startDate, endDate);
      
      // Initialize data arrays
      const nakedArmorData = new Array(dateRange.length).fill(0);
      const grownManShaveData = new Array(dateRange.length).fill(0);
      
      // Aggregate sales by date and store
      sales.forEach(sale => {
        const dateIndex = dateRange.findIndex(date => 
          format(date, 'yyyy-MM-dd') === format(sale.date, 'yyyy-MM-dd')
        );
        if (dateIndex !== -1) {
          if (sale.store === 'nakedArmor') {
            nakedArmorData[dateIndex] += sale.quantity;
          } else {
            grownManShaveData[dateIndex] += sale.quantity;
          }
        }
      });

      setSalesData({
        dates: formattedDates,
        nakedArmor: nakedArmorData,
        grownManShave: grownManShaveData
      });
    } catch (error) {
      console.error('Error loading sales data:', error);
    }
  };

  const chartData = {
    labels: salesData.dates,
    datasets: [
      {
        label: 'Naked Armor',
        data: salesData.nakedArmor,
        borderColor: 'rgb(59, 130, 246)', // Blue
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        tension: 0.3
      },
      {
        label: 'Grown Man Shave',
        data: salesData.grownManShave,
        borderColor: 'rgb(16, 185, 129)', // Green
        backgroundColor: 'rgba(16, 185, 129, 0.5)',
        tension: 0.3
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: ${value} units`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1
        }
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-700">Sales Trends</h3>
        <select
          value={timeframe}
          onChange={(e) => setTimeframe(Number(e.target.value))}
          className="px-3 py-1 border rounded-lg text-sm"
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>

      <div className="h-[300px]">
        <Line data={chartData} options={chartOptions} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-gray-500">Naked Armor Total</p>
          <p className="text-xl font-bold text-blue-600">
            {salesData.nakedArmor.reduce((a, b) => a + b, 0)} units
          </p>
        </div>
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <p className="text-sm text-gray-500">Grown Man Shave Total</p>
          <p className="text-xl font-bold text-green-600">
            {salesData.grownManShave.reduce((a, b) => a + b, 0)} units
          </p>
        </div>
      </div>
    </div>
  );
} 