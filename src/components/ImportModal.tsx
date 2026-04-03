import React, { useState } from 'react';
import { toast } from 'react-hot-toast';

type ImportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result?: unknown) => void;
};

export function ImportModal({ isOpen, onClose, onSuccess }: ImportModalProps) {
  const [importing, setImporting] = useState<boolean>(false);
  const [results, setResults] = useState<unknown | null>(null);

  const handleImport = async (parsedData: unknown) => {
    setImporting(true);
    try {
      const response = await fetch('/api/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: parsedData })
      });

      const data = await response.json();
      
      if (!response.ok) throw new Error(data.message);

      setResults(data.results);
      const summaryMsg = `Import Complete — Created: ${data.results.created}, Updated: ${data.results.updated}, Failed: ${data.results.failed}`;
      if (data.results.failed > 0) {
        toast(summaryMsg, { icon: '⚠️' });
      } else {
        toast.success(summaryMsg);
      }

      if (data.results.errors.length > 0) {
        console.error('Import errors:', data.results.errors);
      }

      onSuccess();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Import error:', error);
      toast.error(`Import Failed — ${message}`);
    } finally {
      setImporting(false);
    }
  };

  // ... rest of component
} 