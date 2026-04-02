import { useState } from 'react';
import { toast } from '@/lib/toast';

export default function IncrementalSyncButton({ className = '', ...props }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleIncrementalSync = async () => {
    console.log('Incremental sync triggered');
    setIsLoading(true);
    
    try {
      console.log('Making sync API request...');
      const response = await fetch('/api/sync/incremental', {
        method: 'POST'
      });
      
      console.log('API response received:', response.status);
      const data = await response.json();
      console.log('Sync response data:', data);
      
      if (data.success) {
        if (data.details.productsUpdated > 0) {
          console.log(`Sync completed: ${data.details.productsUpdated} products updated`);
          toast({
            title: 'Sync Complete',
            description: `Updated ${data.details.productsUpdated} products`,
          });
        } else {
          console.log('Sync completed: No updates needed');
          toast({
            title: 'No Updates Needed',
            description: 'No products have changed since last sync',
          });
        }
      } else {
        console.error('Sync failed:', data.error);
        toast({
          title: 'Sync Failed',
          description: data.error || 'Unknown error occurred',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: 'Sync Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      console.log('Sync process completed');
    }
  };

  return (
    <button
      onClick={handleIncrementalSync}
      disabled={isLoading}
      data-testid="incremental-sync-btn"
      className={`bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded ${className} ${isLoading ? 'opacity-50' : ''}`}
      {...props}
    >
      {isLoading ? 'Syncing...' : 'Sync Partial'}
    </button>
  );
} 