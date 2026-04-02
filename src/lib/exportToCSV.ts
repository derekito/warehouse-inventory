export function exportToCSV(products: any[], fileName: string) {
  // Define CSV headers and map product fields
  const headers = [
    'SKU',
    'Product Name',
    'On Hand',
    'Primary Location',
    'Secondary Location',
    'Last Updated',
    'Status'
  ];

  // Convert products to CSV rows
  const rows = products.map(product => [
    product.sku,
    product.productName,
    product.onHand,
    `${product.location?.loc1 || 'N/A'} > ${product.location?.loc2 || 'N/A'} > ${product.location?.loc3 || 'N/A'} > ${product.location?.loc4 || 'N/A'}`,
    product.location2 ? 
      `${product.location2.loc1 || 'N/A'} > ${product.location2.loc2 || 'N/A'} > ${product.location2.loc3 || 'N/A'} > ${product.location2.loc4 || 'N/A'}` : 
      'N/A',
    new Date(product.lastUpdated?.seconds * 1000).toLocaleDateString(),
    product.status
  ]);

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${fileName}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportLocation2ToCSV(products: any[], fileName: string) {
  // Filter products that have location2 data
  const location2Products = products.filter(product => product.location2);

  // Define CSV headers for Location 2 inventory
  const headers = [
    'SKU',
    'Product Name',
    'On Hand (Location 2)',
    'Location 2 (loc1)',
    'Location 2 (loc2)',
    'Location 2 (loc3)',
    'Location 2 (loc4)',
    'Full Location',
    'Status'
  ];

  // Convert products to CSV rows
  const rows = location2Products.map(product => [
    product.sku,
    product.productName,
    product.location2?.onHand || 0,
    product.location2?.loc1 || '',
    product.location2?.loc2 || '',
    product.location2?.loc3 || '',
    product.location2?.loc4 || '',
    `${product.location2?.loc1 || ''}-${product.location2?.loc2 || ''}-${product.location2?.loc3 || ''}-${product.location2?.loc4 || ''}`,
    product.status || 'active'
  ]);

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${fileName}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportCombinedInventoryToCSV(products: any[], fileName: string) {
  // Define CSV headers for combined inventory
  const headers = [
    'SKU',
    'Product Name',
    'Location 1 (Full)',
    'Location 1 Qty',
    'Location 2 (Full)',
    'Location 2 Qty',
    'Combined Total',
    'Status'
  ];

  // Convert products to CSV rows with combined data
  const rows = products.map(product => {
    const location1Qty = product.onHand || 0;
    const location2Qty = product.location2?.onHand || 0;
    const combinedTotal = location1Qty + location2Qty;

    const location1String = product.location
      ? `${product.location.loc1}-${product.location.loc2}-${product.location.loc3}-${product.location.loc4}`
      : 'N/A';
    
    const location2String = product.location2
      ? `${product.location2.loc1}-${product.location2.loc2}-${product.location2.loc3}-${product.location2.loc4}`
      : 'N/A';

    return [
      product.sku,
      product.productName,
      location1String,
      location1Qty,
      location2String,
      location2Qty,
      combinedTotal,
      product.status || 'active'
    ];
  });

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${fileName}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
} 