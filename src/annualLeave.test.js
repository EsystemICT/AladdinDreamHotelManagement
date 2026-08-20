import test from 'node:test';
import assert from 'node:assert/strict';
import { getAnnualLeaveDaysByYear, getAnnualLeaveSummary } from './annualLeave.js';

test('counts annual leave dates inclusively', () => {
  assert.deepEqual(
    getAnnualLeaveDaysByYear({ startDate: '2026-08-20', endDate: '2026-08-22' }),
    { 2026: 3 }
  );
});

test('splits leave days across calendar years', () => {
  assert.deepEqual(
    getAnnualLeaveDaysByYear({ startDate: '2026-12-30', endDate: '2027-01-02' }),
    { 2026: 2, 2027: 2 }
  );
});

test('summarises only the selected staff member annual leave', () => {
  const leaves = [
    { id: '1', userId: 'staff1', type: 'Annual leave', status: 'approved', startDate: '2026-01-01', endDate: '2026-01-02' },
    { id: '2', userId: 'staff1', type: 'Annual leave', status: 'pending', startDate: '2026-02-01', endDate: '2026-02-03' },
    { id: '3', userId: 'staff1', type: 'MC', status: 'approved', startDate: '2026-03-01', endDate: '2026-03-05' },
    { id: '4', userId: 'staff2', type: 'Annual leave', status: 'approved', startDate: '2026-04-01', endDate: '2026-04-05' }
  ];

  assert.deepEqual(getAnnualLeaveSummary(leaves, 'staff1', 2026, 12), {
    entitlement: 12,
    approvedDays: 2,
    pendingDays: 3,
    remainingDays: 10,
    availableAfterPending: 7
  });
});
