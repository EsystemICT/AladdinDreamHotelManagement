const MS_PER_DAY = 24 * 60 * 60 * 1000;

const getBirthdayUtc = (year, month, day) => {
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Date.UTC(year, month - 1, Math.min(day, lastDayOfMonth));
};

export const getUpcomingBirthday = (user, now = new Date(), windowDays = 7) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(user?.dateOfBirth || '');
  if (!match) return null;

  const month = Number(match[2]);
  const day = Number(match[3]);
  const sourceYear = Number(match[1]);
  const sourceDate = new Date(Date.UTC(sourceYear, month - 1, day));
  if (sourceDate.getUTCFullYear() !== sourceYear || sourceDate.getUTCMonth() !== month - 1 || sourceDate.getUTCDate() !== day) return null;
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  let birthdayUtc = getBirthdayUtc(now.getFullYear(), month, day);

  if (birthdayUtc < todayUtc) birthdayUtc = getBirthdayUtc(now.getFullYear() + 1, month, day);
  const daysUntil = Math.round((birthdayUtc - todayUtc) / MS_PER_DAY);
  if (daysUntil < 0 || daysUntil > windowDays) return null;

  return {
    ...user,
    daysUntil,
    nextBirthday: new Date(birthdayUtc)
  };
};

export const getUpcomingBirthdays = (users, now = new Date(), windowDays = 7) => (
  users
    .filter(user => user?.active !== false)
    .map(user => getUpcomingBirthday(user, now, windowDays))
    .filter(Boolean)
    .sort((a, b) => a.daysUntil - b.daysUntil || (a.name || '').localeCompare(b.name || ''))
);
