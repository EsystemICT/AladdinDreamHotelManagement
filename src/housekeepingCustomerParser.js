const ROOM_LABEL_PATTERN = /(?:room(?:\s*(?:no\.?|number))?|rm|\u623f(?:\u95f4|\u9593|\u53f7|\u865f)?|\u623f\u53f7|\u623f\u865f|bilik)\s*[:#\-\uFF1A]?\s*([a-z]?\d{1,4}[a-z]?)/i;
const DATE_LABEL_PATTERN = /(?:service\s*date|check[\s-]*in(?:\s*date)?|date|\u65e5\u671f|\u5165\u4f4f\u65e5\u671f|tarikh)\s*[:#\-\uFF1A]?\s*([^|;\n]+)/i;
const CUSTOMER_LABEL_PATTERN = /(?:customer(?:\s*info)?|guest|name|\u5ba2\u4eba|\u5ba2\u6237|\u5ba2\u6236|\u9867\u5ba2|\u59d3\u540d)\s*([12\u4e00\u4e8c]?)\s*[:#\-\uFF1A]?\s*([^|;\n]+)/gi;

const cleanValue = (value) => String(value || '')
  .trim()
  .replace(/^[\s:\uFF1A#\-|;,]+|[\s|;,]+$/g, '')
  .replace(/\s{2,}/g, ' ');

const MONTH_NAMES = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12
};

const normalizeDate = (rawValue, fallbackMonth) => {
  const value = cleanValue(rawValue);
  if (!value) return '';

  let year;
  let month;
  let day;

  // 1. ISO format YYYY-MM-DD
  let match = value.match(/\b(20\d{2})[./-](\d{1,2})[./-](\d{1,2})\b/);
  if (match) {
    [, year, month, day] = match;
  } else {
    // 2. Named month format DD MMM YYYY or DD-MMM-YYYY (e.g. 10 Aug 2026)
    const nameMatch = value.match(/\b(\d{1,2})[\s./-]([a-z]{3,9})(?:[\s./-](20\d{2}|\d{2}))?\b/i);
    if (nameMatch && MONTH_NAMES[nameMatch[2].toLowerCase()]) {
      day = nameMatch[1];
      month = MONTH_NAMES[nameMatch[2].toLowerCase()];
      year = nameMatch[3];
      if (!year) year = String(fallbackMonth || new Date().getFullYear()).slice(0, 4);
      if (year?.length === 2) year = `20${year}`;
    } else {
      // 3. DD/MM/YYYY or DD/MM
      match = value.match(/\b(\d{1,2})[./-](\d{1,2})(?:[./-](20\d{2}|\d{2}))?\b/);
      if (!match) return '';
      [, day, month, year] = match;
      if (!year) year = String(fallbackMonth || new Date().getFullYear()).slice(0, 4);
      if (year?.length === 2) year = `20${year}`;
    }
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
  return text.match(/\b(?:20\d{2}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}[./-]\d{1,2}(?:[./-](?:20\d{2}|\d{2}))?|\d{1,2}[\s./-][a-z]{3,9}(?:[\s./-](?:20\d{2}|\d{2}))?)\b/i)?.[0] || '';
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

export const parseHousekeepingArrangementText = (rawText, rooms, fallbackMonth) => {
  const text = String(rawText || '').trim();
  if (!text) return { serviceDate: '', entries: [], unknownRooms: [], error: '' };

  const knownRoomIds = rooms.map(room => String(room.id));
  const serviceDate = normalizeDate(findDateText(text), fallbackMonth);
  const entryMap = new Map();
  const unknownRooms = [];

  text.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Flexible line matcher for entries like:
    // 1. 101 - Customer remark
    // 1) 101 - Customer remark
    // 101 - Customer remark
    // Room 101: Customer remark
    // 1. Room 101 - Customer remark
    const match = trimmed.match(/^(?:\d+\s*[.)\-:]\s*)?(?:room|rm|bilik|\u623f|\u623f\u53f7|\u623f\u95f4)?\s*([a-z]?\d{1,4}[a-z]?)\s*[:#\-\u2013\u2014\uFF1A\s]\s*(.*)$/i);
    if (!match) return;

    const typedRoomId = match[1];
    const roomId = knownRoomIds.find(knownRoomId => knownRoomId.toLowerCase() === typedRoomId.toLowerCase());
    if (!roomId) {
      // Only record as unknown room if the line explicitly looks like a room line item
      if (/^(?:\d+\s*[.)\-:]|(?:room|rm|bilik|\u623f)\s*\d+)/i.test(trimmed)) {
        unknownRooms.push(typedRoomId);
      }
      return;
    }

    const remark = cleanValue(match[2]);
    const existingEntry = entryMap.get(roomId);
    if (existingEntry) {
      if (remark && !existingEntry.customerInfo[1]) existingEntry.customerInfo[1] = remark;
      return;
    }
    entryMap.set(roomId, { roomId, customerInfo: [remark, ''] });
  });

  const entries = [...entryMap.values()];
  if (entries.length > 0) {
    return {
      serviceDate,
      entries,
      unknownRooms: [...new Set(unknownRooms)],
      error: serviceDate ? '' : 'Arrangement date was not recognised. Use DD/MM/YYYY in the heading.'
    };
  }

  const singleEntry = parseHousekeepingCustomerText(text, rooms, fallbackMonth);
  return {
    serviceDate: singleEntry.serviceDate,
    entries: singleEntry.error ? [] : [{ roomId: singleEntry.roomId, customerInfo: singleEntry.customerInfo }],
    unknownRooms: [],
    error: singleEntry.error
  };
};
