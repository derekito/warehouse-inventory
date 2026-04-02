import { useState } from 'react';
import Papa from 'papaparse';
import Modal from './Modal';
import { Product } from '@/types';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: any[]) => void;
  mode?: 'import' | 'update';
}

const CSV_TEMPLATE_HEADERS = [
  'sku',
  'productName',
  'description',
  'status',
  // Primary Location
  'location.loc1',
  'location.loc2',
  'location.loc3',
  'location.loc4',
  'onHand',
  // Secondary Location
  'location2.loc1',
  'location2.loc2',
  'location2.loc3',
  'location2.loc4',
  'location2.onHand'
];

const SAMPLE_DATA = [
  'SKU123',
  'Product Name',
  'Product Description',
  'active',
  // Primary Location
  'JOY',
  'SH',
  '5',
  'BIN-4A',
  '10',
  // Secondary Location
  'JOY',
  'SH',
  '6',
  'BIN-10E',
  '5'
].join(',');

export default function CsvImportModal({ isOpen, onClose, onImport, mode = 'import' }: CsvImportModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        try {
          setIsLoading(true);
          const products = results.data.map((row: any) => {
            // Ensure SKU exists
            if (!row.sku && !row.SKU) {
              throw new Error('SKU is required for each row');
            }

            return {
              sku: row.sku || row.SKU,
              productName: row.productName || row.ProductName,
              description: row.description || row.Description || '',
              status: row.status?.toLowerCase() === 'inactive' ? 'inactive' : 'active',
              // Primary Location
              location: {
                loc1: row['location.loc1'] || row.Section || '',
                loc2: row['location.loc2'] || row.Aisle || '',
                loc3: row['location.loc3'] || row.Shelf || '',
                loc4: row['location.loc4'] || row.Bin || ''
              },
              onHand: parseInt(row.onHand || row.OnHand) || 0,
              // Secondary Location
              location2: {
                loc1: row['location2.loc1'] || '',
                loc2: row['location2.loc2'] || '',
                loc3: row['location2.loc3'] || '',
                loc4: row['location2.loc4'] || '',
                onHand: parseInt(row['location2.onHand']) || 0
              }
            };
          });

          await onImport(products);
          onClose();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to import products');
        } finally {
          setIsLoading(false);
        }
      },
      error: (error) => {
        setError(`Failed to parse CSV: ${error.message}`);
      }
    });
  };

  const handleDownloadTemplate = () => {
    const csvContent = [
      CSV_TEMPLATE_HEADERS.join(','),
      SAMPLE_DATA
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const processCSV = (csvText: string) => {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const product: any = {};
      
      headers.forEach((header, index) => {
        if (header.includes('.')) {
          // Handle nested properties (location and location2)
          const [parent, child] = header.split('.');
          if (!product[parent]) product[parent] = {};
          product[parent][child] = values[index];
          
          // Convert onHand to number for both locations
          if (child === 'onHand') {
            product[parent][child] = parseInt(values[index]) || 0;
          }
        } else {
          product[header] = values[index];
        }
      });

      return product;
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="bg-white p-6 rounded-lg max-w-lg w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            {mode === 'update' ? 'Update Products from CSV' : 'Import Products from CSV'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-2">
              Required columns: SKU, ProductName
              <br />
              Optional columns: Description, Status
              <br />
              Primary Location: location.loc1, location.loc2, location.loc3, location.loc4, onHand
              <br />
              Secondary Location: location2.loc1, location2.loc2, location2.loc3, location2.loc4, location2.onHand
            </p>
            <button
              onClick={handleDownloadTemplate}
              className="text-blue-600 hover:text-blue-800 text-sm underline"
            >
              Download Template
            </button>
          </div>

          <div className="mt-4">
            <label className="block">
              <span className="sr-only">Choose CSV file</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
              />
            </label>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
} 