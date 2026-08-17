import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHousekeepingArrangementText, parseHousekeepingCustomerText } from './housekeepingCustomerParser.js';

const rooms = [{ id: '101' }, { id: '203' }, { id: 'A1' }];

test('recognises a compact pipe-separated entry', () => {
  assert.deepEqual(
    parseHousekeepingCustomerText('Room 203 | 18/08/2026 | Alice Tan | Late checkout', rooms, '2026-08'),
    { roomId: '203', serviceDate: '2026-08-18', customerInfo: ['Alice Tan', 'Late checkout'], error: '' }
  );
});

test('recognises labelled English fields', () => {
  assert.deepEqual(
    parseHousekeepingCustomerText('Room: 101\nDate: 19/08/2026\nCustomer 1: Mei Ling\nCustomer 2: Baby cot', rooms, '2026-08'),
    { roomId: '101', serviceDate: '2026-08-19', customerInfo: ['Mei Ling', 'Baby cot'], error: '' }
  );
});

test('recognises Chinese labels and a date without a year', () => {
  assert.deepEqual(
    parseHousekeepingCustomerText('\u623f\u53f7\uFF1AA1\n\u65e5\u671f\uFF1A20/08\n\u5ba2\u4eba1\uFF1A\u738b\u5c0f\u660e\n\u5ba2\u4eba2\uFF1A\u5ef6\u8fdf\u9000\u623f', rooms, '2026-08'),
    { roomId: 'A1', serviceDate: '2026-08-20', customerInfo: ['\u738b\u5c0f\u660e', '\u5ef6\u8fdf\u9000\u623f'], error: '' }
  );
});

test('reports an unknown room', () => {
  assert.equal(
    parseHousekeepingCustomerText('Room 999 | 18/08/2026 | Alice', rooms, '2026-08').error,
    'Room 999 does not exist.'
  );
});

test('recognises a complete room arrangement list using the heading date', () => {
  const text = `LIST ROOM ARRANGEMENT 10/8/2026

DELUXE

1. 101 -
2. 203 - naqiuddin (bcom) 10/8 c/o 12/8
3. 999 - not configured
4. A1 - Nevi (agoda) 10/8 c/out 12/8`;

  assert.deepEqual(parseHousekeepingArrangementText(text, rooms, '2026-08'), {
    serviceDate: '2026-08-10',
    entries: [
      { roomId: '101', customerInfo: ['', ''] },
      { roomId: '203', customerInfo: ['naqiuddin (bcom) 10/8 c/o 12/8', ''] },
      { roomId: 'A1', customerInfo: ['Nevi (agoda) 10/8 c/out 12/8', ''] }
    ],
    unknownRooms: ['999'],
    error: ''
  });
});
