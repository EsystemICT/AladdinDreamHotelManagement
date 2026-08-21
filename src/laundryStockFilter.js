const timestampToMillis = (value) => {
  if (!value) return Number.MAX_SAFE_INTEGER;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const milliseconds = new Date(value).getTime();
  return Number.isNaN(milliseconds) ? Number.MAX_SAFE_INTEGER : milliseconds;
};

export const filterAndSortLaundryStockMovements = (movements, startDate = '', endDate = '') => (
  movements
    .filter(movement => {
      const transactionDate = movement.transactionDate || '';
      if (startDate && transactionDate < startDate) return false;
      if (endDate && transactionDate > endDate) return false;
      return true;
    })
    .sort((first, second) => {
      const dateComparison = (first.transactionDate || '').localeCompare(second.transactionDate || '');
      if (dateComparison !== 0) return dateComparison;
      const createdComparison = timestampToMillis(first.createdAt) - timestampToMillis(second.createdAt);
      return createdComparison || String(first.id || '').localeCompare(String(second.id || ''));
    })
);
