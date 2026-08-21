import test from 'node:test';
import assert from 'node:assert/strict';
import { filterAndSortLaundryStockMovements } from './laundryStockFilter.js';

const movements = [
  { id: 'later', transactionDate: '2026-08-22', createdAt: new Date('2026-08-22T10:00:00Z') },
  { id: 'same-day-late', transactionDate: '2026-08-20', createdAt: new Date('2026-08-20T16:00:00Z') },
  { id: 'earlier', transactionDate: '2026-08-18', createdAt: new Date('2026-08-18T08:00:00Z') },
  { id: 'same-day-early', transactionDate: '2026-08-20', createdAt: new Date('2026-08-20T09:00:00Z') }
];

test('sorts all Laundry Stock movements from earliest to latest by default', () => {
  assert.deepEqual(
    filterAndSortLaundryStockMovements(movements).map(movement => movement.id),
    ['earlier', 'same-day-early', 'same-day-late', 'later']
  );
});

test('filters an inclusive Laundry Stock date range', () => {
  assert.deepEqual(
    filterAndSortLaundryStockMovements(movements, '2026-08-20', '2026-08-22').map(movement => movement.id),
    ['same-day-early', 'same-day-late', 'later']
  );
});

test('includes every movement when both dates are the same day', () => {
  assert.deepEqual(
    filterAndSortLaundryStockMovements(movements, '2026-08-20', '2026-08-20').map(movement => movement.id),
    ['same-day-early', 'same-day-late']
  );
});
