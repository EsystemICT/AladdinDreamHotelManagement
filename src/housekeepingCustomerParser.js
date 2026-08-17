const ROOM_LABEL_PATTERN = /(?:room(?:\s*(?:no\.?|number))?|rm|\u623f(?:\u95f4|\u9593|\u53f7|\u865f)?|\u623f\u53f7|\u623f\u865f|bilik)\s*[:#\-\uFF1A]?\s*([a-z]?\d{1,4}[a-z]?)/i;
const DATE_LABEL_PATTERN = /(?:service\s*date|check[\s-]*in(?:\s*date)?|date|\u65e5\u671f|\u5165\u4f4f\u65e5\u671f|tarikh)\s*[:#\-\uFF1A]?\s*([^|;\n]+)/i;
const CUSTOMER_LABEL_PATTERN = /(?:customer(?:\s*info)?|guest|name|\u5ba2\u4eba|\u5ba2\u6237|\u5ba2\u6236|\u9867\u5ba2|\u59d3\u540d)\s*([12\u4e00\u4e8c]?)\s*[:#\-\uFF1A]?\s*([^|;\n]+)/gi;

const cleanValue = (value) => String(value || '')
  .trim()
  .replace(/^[\s:\uFF1A#\-|;,]+|[\s|;,]+$/g, '')
  .replace(/\s{2,}/g, ' ');

const normalizeDate = (rawValue, fallbackMonth) => {
  const value = cleanValue(rawValue);
  let match = value.match(/\b(20\d{2})[./-](\d{1,2})[./-](\d{1,2})\b/);
  let year;
  let month;
  let day;

  if (match) {
    [, year, month, day] = match;
  } else {
    match = value.match(/\b(\d{1,2})[./-](\d{1,2})(?:[./-](20\d{2}|\d{2}))?\b/);
    if (!match) return '';
    [, day, month, year] = match;
    if (!year) year = String(fallbackMonth || '').slice(0, 4);
    if (year?.length === 2) year = `20${year}`;
  }

  if (!year) return '';
  const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const parsedDate = new Date(`${isoDate}T00:00:00`);
  return !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.getFullYear() === Number(year) &&
    parsedDate.getMonth() + 1 === Number(month) &&
    parsedDate.getDate() === Number(day)
    ? isoDate
    : '';
};

const findDateText = (text) => {
  const labelledDate = text.match(DATE_LABEL_PATTERN)?.[1];
  if (labelledDate) return labelledDate;
  return text.match(/\b(?:20\d{2}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}[./-]\d{1,2}(?:[./-](?:20\d{2}|\d{2}))?)\b/)?.[0] || '';
};

const findRoomId = (text, knownRoomIds) => {
  const labelledRoom = cleanValue(text.match(ROOM_LABEL_PATTERN)?.[1]);
  const roomMatch = knownRoomIds.find(roomId => roomId.toLowerCase() === labelledRoom.toLowerCase());
  if (roomMatch) return roomMatch;

  const segments = text.split(/[|;,\n\t]/).map(cleanValue).filter(Boolean);
  return knownRoomIds.find(roomId => segments.some(segment => (
    segment.toLowerCase() === roomId.toLowerCase() ||
    new RegExp(`(?:^|\\s)${roomId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|\\s)`, 'i').test(segment)
  ))) || labelledRoom;
};

const extractLabelledCustomers = (text) => {
  const customers = [];
  for (const match of text.matchAll(CUSTOMER_LABEL_PATTERN)) {
    const position = match[1];
    const value = cleanValue(match[2]);
    if (!value) continue;
    const index = position === '2' || position === '\u4e8c' ? 1 : position === '1' || position === '\u4e00' ? 0 : customers.length;
    if (index < 2 && !customers[index]) customers[index] = value;
  }
  return customers;
};

const extractSegmentCustomers = (text, roomId, rawDate) => text
  .split(/[|;\n\t]/)
  .map(cleanValue)
  .filter(Boolean)
  .filter(segment => {
    if (ROOM_LABEL_PATTERN.test(segment) || DATE_LABEL_PATTERN.test(segment)) return false;
    if (roomId && segment.toLowerCase() === roomId.toLowerCase()) return false;
    if (rawDate && segment.includes(rawDate)) return false;
    return !normalizeDate(segment, '');
  })
  .map(segment => cleanValue(segment.replace(CUSTOMER_LABEL_PATTERN, '$2')))
  .filter(Boolean)
  .slice(0, 2);

export const parseHousekeepingCustomerText = (rawText, rooms, fallbackMonth) => {
  const text = String(rawText || '').trim();
  if (!text) return { roomId: '', serviceDate: '', customerInfo: ['', ''], error: '' };

  const knownRoomIds = rooms.map(room => String(room.id));
  const roomId = findRoomId(text, knownRoomIds);
  const rawDate = findDateText(text);
  const serviceDate = normalizeDate(rawDate, fallbackMonth);
  const labelledCustomers = extractLabelledCustomers(text);
  const segmentCustomers = extractSegmentCustomers(text, roomId, rawDate);
  const customerInfo = [
    cleanValue(labelledCustomers[0] || segmentCustomers[0]),
    cleanValue(labelledCustomers[1] || segmentCustomers[1])
  ];

  let error = '';
  if (!roomId) error = 'Room number was not recognised.';
  else if (!knownRoomIds.some(knownRoomId => knownRoomId.toLowerCase() === roomId.toLowerCase())) error = `Room ${roomId} does not exist.`;
  else if (!serviceDate) error = 'Date was not recognised. Use DD/MM/YYYY.';
  else if (!customerInfo.some(Boolean)) error = 'Customer information was not recognised.';

  return { roomId, serviceDate, customerInfo, error };
};
