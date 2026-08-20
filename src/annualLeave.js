const MS_PER_DAY = 24 * 60 * 60 * 1000;

const parseIsoDateUtc = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? timestamp
    : null;
};

export const getAnnualLeaveDaysByYear = (leave) => {
  const start = parseIsoDateUtc(leave?.startDate);
  const end = parseIsoDateUtc(leave?.endDate || leave?.startDate);
  if (start === null || end === null || end < start) return {};

  const daysByYear = {};
  const startYear = new Date(start).getUTCFullYear();
  const endYear = new Date(end).getUTCFullYear();
  for (let year = startYear; year <= endYear; year += 1) {
    const yearStart = Date.UTC(year, 0, 1);
    const yearEnd = Date.UTC(year, 11, 31);
    const clampedStart = Math.max(start, yearStart);
    const clampedEnd = Math.min(end, yearEnd);
    if (clampedEnd >= clampedStart) daysByYear[year] = Math.round((clampedEnd - clampedStart) / MS_PER_DAY) + 1;
  }
  return daysByYear;
};

export const getAnnualLeaveSummary = (leaves, userId, year, entitlement = 0, excludeLeaveId = '') => {
  let approvedDays = 0;
  let pendingDays = 0;

  leaves.forEach(leave => {
    if (leave.id === excludeLeaveId || leave.userId !== userId || leave.type !== 'Annual leave') return;
    const days = getAnnualLeaveDaysByYear(leave)[year] || 0;
    if (leave.status === 'approved') approvedDays += days;
    if (leave.status === 'pending') pendingDays += days;
  });

  const normalizedEntitlement = Number.isFinite(Number(entitlement)) ? Math.max(0, Number(entitlement)) : 0;
  return {
    entitlement: normalizedEntitlement,
    approvedDays,
    pendingDays,
    remainingDays: normalizedEntitlement - approvedDays,
    availableAfterPending: normalizedEntitlement - approvedDays - pendingDays
  };
};

export const getAnnualLeaveBalanceId = (year, userDocId) => `${year}_${userDocId}`;
