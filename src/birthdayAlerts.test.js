import test from 'node:test';
import assert from 'node:assert/strict';
import { getUpcomingBirthdays } from './birthdayAlerts.js';

test('includes birthdays from today through the next seven days', () => {
  const users = [
    { name: 'Today', dateOfBirth: '1990-08-20' },
    { name: 'Seven days', dateOfBirth: '1991-08-27' },
    { name: 'Too late', dateOfBirth: '1992-08-28' }
  ];

  assert.deepEqual(
    getUpcomingBirthdays(users, new Date(2026, 7, 20)).map(user => [user.name, user.daysUntil]),
    [['Today', 0], ['Seven days', 7]]
  );
});

test('finds birthdays across the end of the year and skips inactive staff', () => {
  const users = [
    { name: 'New year', dateOfBirth: '1990-01-02' },
    { name: 'Inactive', dateOfBirth: '1990-12-31', active: false }
  ];

  assert.deepEqual(
    getUpcomingBirthdays(users, new Date(2026, 11, 29)).map(user => [user.name, user.daysUntil]),
    [['New year', 4]]
  );
});

test('treats a leap-day birthday as February 28 in a non-leap year', () => {
  const [birthday] = getUpcomingBirthdays(
    [{ name: 'Leap birthday', dateOfBirth: '2000-02-29' }],
    new Date(2026, 1, 24)
  );

  assert.equal(birthday.daysUntil, 4);
  assert.equal(birthday.nextBirthday.toISOString().slice(0, 10), '2026-02-28');
});
