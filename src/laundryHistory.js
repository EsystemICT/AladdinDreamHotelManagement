const timestampToDate = (value) => {
  if (!value) return null;
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getLocalDateKey = (value) => {
  const date = timestampToDate(value);
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const filterAndSortLaundryHistory = (records, startDate = '', endDate = '') => (
  records
    .filter(record => {
      if (record.status !== 'received') return false;
      const dateKey = getLocalDateKey(record.createdAt);
      if (!dateKey) return !startDate && !endDate;
      if (startDate && dateKey < startDate) return false;
      if (endDate && dateKey > endDate) return false;
      return true;
    })
    .sort((first, second) => {
      const firstDate = timestampToDate(first.createdAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const secondDate = timestampToDate(second.createdAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return firstDate - secondDate || String(first.id || '').localeCompare(String(second.id || ''));
    })
);
