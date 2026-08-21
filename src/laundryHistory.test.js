import test from 'node:test';
import assert from 'node:assert/strict';
import { filterAndSortLaundryHistory } from './laundryHistory.js';

const records = [
  { id: 'later', status: 'received', createdAt: new Date(2026, 7, 22, 16, 30) },
  { id: 'pending', status: 'pending', createdAt: new Date(2026, 7, 20, 9, 0) },
  { id: 'same-day-late', status: 'received', createdAt: new Date(2026, 7, 20, 23, 59) },
  { id: 'earlier', status: 'received', createdAt: new Date(2026, 7, 18, 8, 0) },
  { id: 'same-day-early', status: 'received', createdAt: new Date(2026, 7, 20, 0, 1) }
];

test('shows all received laundry records from earliest to latest by default', () => {
  assert.deepEqual(
    filterAndSortLaundryHistory(records).map(record => record.id),
    ['earlier', 'same-day-early', 'same-day-late', 'later']
  );
});

test('filters an inclusive laundry date range and keeps ascending order', () => {
  assert.deepEqual(
    filterAndSortLaundryHistory(records, '2026-08-20', '2026-08-22').map(record => record.id),
    ['same-day-early', 'same-day-late', 'later']
  );
});

test('includes every record when the start and end dates are the same day', () => {
  assert.deepEqual(
    filterAndSortLaundryHistory(records, '2026-08-20', '2026-08-20').map(record => record.id),
    ['same-day-early', 'same-day-late']
  );
});
