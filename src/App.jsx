import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, deleteField, serverTimestamp, query, orderBy, where, getDocs, getDoc, limit, setDoc, writeBatch } from 'firebase/firestore';
import './App.css';

// ICONS & TABS
const ICONS = { 
  ROOMS: { icon: "fa-solid fa-bed", label: "Rooms" },
  TICKETS: { icon: "fa-solid fa-wrench", label: "Tickets" },
  ITEMS: { icon: "fa-solid fa-boxes-stacked", label: "Item Request" },
  LAUNDRY: { icon: "fa-solid fa-shirt", label: "Laundry/Stock" },
  CLAIMS: { icon: "fa-solid fa-calendar-check", label: "Claim Days" },
  DEPOSIT: { icon: "fa-solid fa-money-bill-wave", label: "Deposits" },
  VERIFY: { icon: "fa-solid fa-file-invoice-dollar", label: "Verification" },
  REQ: { icon: "fa-solid fa-paper-plane", label: "Request Staff" },
  SHIFT: { icon: "fa-solid fa-clock", label: "My Shift" },
  MC: { icon: "fa-solid fa-notes-medical", label: "Request MC" },
  ATT_REPORT: { icon: "fa-solid fa-clipboard-user", label: "Attendance Portal" }
};

// LAUNDRY ITEMS
const LAUNDRY_ITEMS = [
  "Bed Sheet", "Duvet Cover", "Pillow Case", "Bath Towel", "Bath Mat", 
  "Bath Towel New", "Face Towel", "Pillow Pad", "Pillow", "Comforter", 
  "Mattress Pad", "Shower Curtain", "Duvet Insert", "Day Curtain", 
  "Night Curtain", "Floor Mat", "Blanket", "Wiping Cloth", "Bed Runner"
];

// HELPERS
const getStatusColor = (status) => {
  switch(status) {
    case 'maintenance': return 'bg-gray-800';
    default: return 'bg-green-500'; 
  }
};

const formatTime = (timestamp) => {
  if (!timestamp) return '-';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString('en-MY', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
  });
};

const formatDate = (timestamp) => {
  if (!timestamp) return '-';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-MY');
};

const formatDuration = (ms) => {
  if (!ms || ms <= 0) return '0 hrs 0 mins';
  const totalMins = Math.floor(ms / (1000 * 60));
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return `${hrs} hrs ${mins} mins`;
};

const getCurrentMonthString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidDateOfBirth = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const [year, month, day] = value.split('-').map(Number);
  const birthDate = new Date(`${value}T00:00:00`);
  return !Number.isNaN(birthDate.getTime()) &&
    birthDate.getFullYear() === year &&
    birthDate.getMonth() + 1 === month &&
    birthDate.getDate() === day &&
    birthDate <= new Date();
};

const isProfileComplete = (user) => (
  EMAIL_PATTERN.test(user?.email?.trim() || '') && isValidDateOfBirth(user?.dateOfBirth)
);

const isoDateToDisplay = (value) => {
  if (!isValidDateOfBirth(value)) return '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
};

const displayDateToIso = (value) => {
  const match = (value || '').trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return '';
  const [, day, month, year] = match;
  const isoValue = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  return isValidDateOfBirth(isoValue) ? isoValue : '';
};

const isValidCalendarDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const [year, month, day] = value.split('-').map(Number);
  const calendarDate = new Date(`${value}T00:00:00`);
  return !Number.isNaN(calendarDate.getTime()) &&
    calendarDate.getFullYear() === year &&
    calendarDate.getMonth() + 1 === month &&
    calendarDate.getDate() === day;
};

const calendarIsoToDisplay = (value) => {
  if (!isValidCalendarDate(value)) return '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
};

const calendarDisplayToIso = (value) => {
  const match = (value || '').trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return '';
  const [, day, month, year] = match;
  const isoValue = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  return isValidCalendarDate(isoValue) ? isoValue : '';
};

const getLocalIsoDate = (date = new Date()) => (
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
);

const DateOfBirthField = ({ defaultValue = '', idPrefix }) => {
  const pickerRef = useRef(null);
  const [displayValue, setDisplayValue] = useState(() => isoDateToDisplay(defaultValue));
  const [isoValue, setIsoValue] = useState(() => isValidDateOfBirth(defaultValue) ? defaultValue : '');

  const handleTextChange = (e) => {
    const nextDisplayValue = e.target.value;
    setDisplayValue(nextDisplayValue);
    setIsoValue(displayDateToIso(nextDisplayValue));
  };

  const handleCalendarChange = (e) => {
    const nextIsoValue = e.target.value;
    setIsoValue(nextIsoValue);
    setDisplayValue(isoDateToDisplay(nextIsoValue));
  };

  const openCalendar = () => {
    const picker = pickerRef.current;
    if (!picker) return;
    try {
      if (typeof picker.showPicker === 'function') picker.showPicker();
      else picker.click();
    } catch {
      picker.click();
    }
  };

  return (
    <>
      <div className="profile-date-entry">
        <i className="fa-solid fa-cake-candles"></i>
        <input
          id={`${idPrefix}-display`}
          type="text"
          value={displayValue}
          onChange={handleTextChange}
          placeholder="DD/MM/YYYY"
          inputMode="numeric"
          autoComplete="bday"
          aria-label="Date of birth in day month year format"
          required
        />
        <button type="button" className="profile-calendar-btn" onClick={openCalendar} aria-label="Choose date of birth from calendar" title="Choose from calendar">
          <i className="fa-solid fa-calendar-days"></i>
        </button>
        <input
          ref={pickerRef}
          className="profile-native-date-picker"
          type="date"
          value={isoValue}
          max={getLocalIsoDate()}
          onChange={handleCalendarChange}
          tabIndex="-1"
          aria-hidden="true"
        />
      </div>
      <input type="hidden" name="dateOfBirth" value={isoValue} readOnly />
      <small className="profile-date-help">Enter DD/MM/YYYY or choose from the calendar.</small>
    </>
  );
};

const CalendarDateField = ({ name, idPrefix, ariaLabel }) => {
  const pickerRef = useRef(null);
  const hiddenInputRef = useRef(null);
  const [displayValue, setDisplayValue] = useState('');
  const [isoValue, setIsoValue] = useState('');

  useEffect(() => {
    const form = hiddenInputRef.current?.form;
    if (!form) return undefined;
    const handleReset = () => {
      setDisplayValue('');
      setIsoValue('');
    };
    form.addEventListener('reset', handleReset);
    return () => form.removeEventListener('reset', handleReset);
  }, []);

  const openCalendar = () => {
    const picker = pickerRef.current;
    if (!picker) return;
    try {
      if (typeof picker.showPicker === 'function') picker.showPicker();
      else picker.click();
    } catch {
      picker.click();
    }
  };

  return (
    <>
      <div className="profile-date-entry mc-date-entry">
        <i className="fa-solid fa-calendar-day"></i>
        <input
          id={`${idPrefix}-display`}
          type="text"
          value={displayValue}
          onChange={(event) => {
            setDisplayValue(event.target.value);
            setIsoValue(calendarDisplayToIso(event.target.value));
          }}
          placeholder="DD/MM/YYYY"
          inputMode="numeric"
          autoComplete="off"
          aria-label={ariaLabel}
          required
        />
        <button type="button" className="profile-calendar-btn" onClick={openCalendar} aria-label={`Choose ${ariaLabel} from calendar`} title="Choose from calendar">
          <i className="fa-solid fa-calendar-days"></i>
        </button>
        <input
          ref={pickerRef}
          className="profile-native-date-picker"
          type="date"
          value={isoValue}
          onChange={(event) => {
            setIsoValue(event.target.value);
            setDisplayValue(calendarIsoToDisplay(event.target.value));
          }}
          tabIndex="-1"
          aria-hidden="true"
        />
      </div>
      <input ref={hiddenInputRef} type="hidden" name={name} value={isoValue} readOnly />
      <small className="profile-date-help">Enter DD/MM/YYYY or choose from the calendar.</small>
    </>
  );
};

const DEVICE_ID_STORAGE_KEY = 'hotelApprovedDeviceId';
const DEVICE_BINDING_ERROR = 'This account is already linked to another device. Please contact the administrator to reset the linked device.';
const DEVICE_BINDING_RESET_MESSAGE = '\u88dd\u7f6e\u7d81\u5b9a\u5df2\u91cd\u8a2d\uff0c\u8acb\u91cd\u65b0\u767b\u5165\u3002';

// Attendance punching is mobile/tablet only. iPadOS can identify itself as a Mac,
// so touch capability is also checked before classifying the device.
const isMobileOrTabletDevice = () => {
  if (typeof navigator === 'undefined') return false;

  const userAgent = navigator.userAgent || '';
  const platform = navigator.userAgentData?.platform || navigator.platform || '';
  const isIPad = /iPad/i.test(userAgent) || (/Mac/i.test(platform) && navigator.maxTouchPoints > 1);
  return navigator.userAgentData?.mobile === true ||
    /Android|iPhone|iPod|Windows Phone|Mobi/i.test(userAgent) ||
    isIPad;
};

const isComputerDevice = () => !isMobileOrTabletDevice();

// Existing user documents predate the active flag, so only an explicit false
// marks an account as inactive.
const isUserActive = (user) => user?.active !== false;

const getDeviceId = (createIfMissing = true) => {
  if (typeof window === 'undefined') return null;
  let deviceId = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (!deviceId && createIfMissing) {
    deviceId = globalThis.crypto?.randomUUID?.() ||
      `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
  }
  return deviceId;
};

const getDeviceName = () => {
  if (typeof navigator === 'undefined') return 'Mobile device';
  const userAgent = navigator.userAgent || '';
  if (/iPad/i.test(userAgent) || (/Mac/i.test(navigator.platform || '') && navigator.maxTouchPoints > 1)) return 'iPad';
  if (/iPhone/i.test(userAgent)) return 'iPhone';
  if (/Android/i.test(userAgent)) return /Mobile/i.test(userAgent) ? 'Android phone' : 'Android tablet';
  return 'Mobile device';
};

const approveOrValidateMobileDevice = async (userDocId, expectedPassword = null) => {
  const deviceId = getDeviceId(true);
  const userRef = doc(db, 'users', userDocId);
  const userSnapshot = await getDoc(userRef);
  if (!userSnapshot.exists()) throw new Error('USER_NOT_FOUND');

  const latestUser = userSnapshot.data();
  if (!isUserActive(latestUser)) throw new Error('ACCOUNT_INACTIVE');
  if (expectedPassword !== null && latestUser.password !== expectedPassword) {
    throw new Error('INCORRECT_PASSWORD');
  }
  if (latestUser.role === 'admin') return { dbId: userDocId, ...latestUser };
  if (latestUser.approvedDeviceId && latestUser.approvedDeviceId !== deviceId) {
    const error = new Error('DEVICE_ALREADY_BOUND');
    error.code = 'DEVICE_ALREADY_BOUND';
    throw error;
  }

  if (!latestUser.approvedDeviceId) {
    await updateDoc(userRef, {
      approvedDeviceId: deviceId,
      approvedDeviceName: getDeviceName(),
      approvedDeviceBoundAt: serverTimestamp()
    });
  }

  const confirmedSnapshot = await getDoc(userRef);
  if (!confirmedSnapshot.exists()) throw new Error('USER_NOT_FOUND');
  const confirmedUser = confirmedSnapshot.data();
  if (!isUserActive(confirmedUser)) throw new Error('ACCOUNT_INACTIVE');
  if (confirmedUser.approvedDeviceId !== deviceId) {
    const error = new Error('DEVICE_ALREADY_BOUND');
    error.code = 'DEVICE_ALREADY_BOUND';
    throw error;
  }

  return { dbId: userDocId, ...confirmedUser };
};

// Aladdin Dream Hotel, 68, 70 & 72 Jalan Lembah 19, Bandar Seri Alam.
// Staff within 100 metres of the hotel are treated as on site.
const ATTENDANCE_RADIUS_METERS = 100;
const DEFAULT_HOTEL_COORDS = {
  lat: 1.509149,
  lng: 103.866151,
  radiusMeters: ATTENDANCE_RADIUS_METERS
};

// Calculate distance in meters between two coordinates (Haversine formula)
const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Get display text for attendance location (including distance if away)
const getLocationText = (log, hotelLoc = DEFAULT_HOTEL_COORDS) => {
  if (!log) return 'On Site';
  if (log.locationStatus !== 'away') return 'On Site';
  if (log.locationLabel && log.locationLabel !== 'Away') {
    return log.locationLabel;
  }
  if (log.coords?.lat && log.coords?.lng) {
    const tLat = hotelLoc?.lat || DEFAULT_HOTEL_COORDS.lat;
    const tLng = hotelLoc?.lng || DEFAULT_HOTEL_COORDS.lng;
    const dist = calculateDistanceMeters(log.coords.lat, log.coords.lng, tLat, tLng);
    if (dist !== null) {
      const formatted = dist >= 1000 ? `${(dist / 1000).toFixed(1)}km` : `${Math.round(dist)}m`;
      return `Away (${formatted})`;
    }
  }
  return log.locationLabel || 'Away';
};

// Ignore stale/incorrect saved centres that are clearly not near this hotel.
const normalizeHotelLocation = (location = {}) => {
  const savedLat = Number(location.lat);
  const savedLng = Number(location.lng);
  const hasValidSavedPoint = Number.isFinite(savedLat) && Number.isFinite(savedLng);
  const savedPointDistance = hasValidSavedPoint
    ? calculateDistanceMeters(savedLat, savedLng, DEFAULT_HOTEL_COORDS.lat, DEFAULT_HOTEL_COORDS.lng)
    : null;
  const isStaleOrIncorrect = savedPointDistance === null || savedPointDistance > 2000;

  return isStaleOrIncorrect
    ? DEFAULT_HOTEL_COORDS
    : { lat: savedLat, lng: savedLng, radiusMeters: ATTENDANCE_RADIUS_METERS };
};

// --- ATTENDANCE SESSION PROCESSOR ---
const processAttendanceSessions = (rawLogs, usersList, leavesList, referenceTime = new Date()) => {
  const sortedLogs = [...rawLogs].filter(a => a.timestamp).sort((a, b) => {
    const tA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
    const tB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
    return tA - tB;
  });

  const userLogsMap = {};
  usersList.forEach(u => {
    userLogsMap[u.userid] = { user: u, logs: [] };
  });

  sortedLogs.forEach(log => {
    if (!userLogsMap[log.userId]) {
      userLogsMap[log.userId] = { 
        user: { userid: log.userId, name: log.userName || log.userId, role: 'staff' }, 
        logs: [] 
      };
    }
    userLogsMap[log.userId].logs.push(log);
  });

  const sessions = [];
  const rosterStatus = [];

  Object.keys(userLogsMap).forEach(uid => {
    const { user, logs } = userLogsMap[uid];
    let currentIn = null;

    logs.forEach(log => {
      if (log.type === 'in') {
        if (currentIn) {
          sessions.push({
            id: currentIn.id,
            userId: uid,
            userName: user.name,
            inLog: currentIn,
            outLog: null,
            inTime: currentIn.timestamp,
            outTime: null,
            durationMs: 0,
            status: 'missing_out'
          });
        }
        currentIn = log;
      } else if (log.type === 'out') {
        if (currentIn) {
          const inDate = currentIn.timestamp?.toDate ? currentIn.timestamp.toDate() : new Date(currentIn.timestamp);
          const outDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
          const diffMs = outDate - inDate;

          sessions.push({
            id: currentIn.id + '_' + log.id,
            userId: uid,
            userName: user.name,
            inLog: currentIn,
            outLog: log,
            inTime: currentIn.timestamp,
            outTime: log.timestamp,
            durationMs: diffMs > 0 ? diffMs : 0,
            status: 'completed'
          });
          currentIn = null;
        } else {
          sessions.push({
            id: log.id,
            userId: uid,
            userName: user.name,
            inLog: null,
            outLog: log,
            inTime: null,
            outTime: log.timestamp,
            durationMs: 0,
            status: 'orphan_out'
          });
        }
      }
    });

    if (currentIn) {
      const inDate = currentIn.timestamp?.toDate ? currentIn.timestamp.toDate() : new Date(currentIn.timestamp);
      sessions.push({
        id: currentIn.id,
        userId: uid,
        userName: user.name,
        inLog: currentIn,
        outLog: null,
        inTime: currentIn.timestamp,
        outTime: null,
        durationMs: Math.max(0, referenceTime - inDate),
        status: 'working'
      });
    }

    const lastLog = logs[logs.length - 1];
    const todayStr = referenceTime.toLocaleDateString('en-MY');
    const todayIso = getLocalIsoDate(referenceTime);
    const isOnLeaveToday = leavesList.some(l => {
      if (l.userId !== uid || l.status !== 'approved') return false;
      if (l.startDate) {
        const leaveEndDate = l.endDate || l.startDate;
        return l.startDate <= todayIso && todayIso <= leaveEndDate;
      }
      const lDate = l.createdAt?.toDate ? l.createdAt.toDate().toLocaleDateString('en-MY') : '';
      return lDate === todayStr;
    });

    if (isOnLeaveToday) {
      rosterStatus.push({
        userId: uid,
        userName: user.name,
        role: user.role,
        status: 'on_leave',
        lastTime: lastLog ? lastLog.timestamp : null
      });
    } else if (lastLog && lastLog.type === 'in') {
      const inDate = lastLog.timestamp?.toDate ? lastLog.timestamp.toDate() : new Date(lastLog.timestamp);
      rosterStatus.push({
        userId: uid,
        userName: user.name,
        role: user.role,
        status: 'working',
        startTime: lastLog.timestamp,
        elapsedMs: referenceTime - inDate,
        locationStatus: lastLog.locationStatus || 'on_site',
        locationLabel: lastLog.locationLabel || (lastLog.locationStatus === 'away' ? 'Away' : 'On Site'),
        coords: lastLog.coords || null
      });
    } else {
      rosterStatus.push({
        userId: uid,
        userName: user.name,
        role: user.role,
        status: 'off_duty',
        lastTime: lastLog ? lastLog.timestamp : null
      });
    }
  });

  return { sessions, rosterStatus };
};

// --- AUDIT LOGGER HELPER ---
const logSystemAction = async (actorName, actionType, details) => {
  try {
    await addDoc(collection(db, "auditLogs"), {
      user: actorName || 'System',
      action: actionType,
      details: details,
      timestamp: serverTimestamp()
    });
  } catch(e) {
    console.error("Audit log failed:", e);
  }
};

export default function App() {
  // STATE
  const [currentUser, setCurrentUser] = useState(null);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [view, setView] = useState('ROOMS');
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // SYSTEM MAINTENANCE (SECRET OVERRIDE)
  const [maintenanceData, setMaintenanceData] = useState({ active: false, message: '' });
  const [isSecretAdmin, setIsSecretAdmin] = useState(false);

  // Data
  const [rooms, setRooms] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [users, setUsers] = useState([]); 
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [claimDays, setClaimDays] = useState([]);
  const [laundry, setLaundry] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [laundryItemDetails, setLaundryItemDetails] = useState({});
  const [auditLogs, setAuditLogs] = useState([]);
  const [adminAlerts, setAdminAlerts] = useState([]);
  const [deposits, setDeposits] = useState([]); 
  const [verifications, setVerifications] = useState([]); 

  // UI
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileTab, setProfileTab] = useState('PROFILE');
  const [profileFeedback, setProfileFeedback] = useState({ type: '', message: '' });
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [roomSearch, setRoomSearch] = useState('');
  const [staffModal, setStaffModal] = useState(null);
  const [rejectModal, setRejectModal] = useState({ show: false, reqId: null });
  const [rejectReason, setRejectReason] = useState('');
  
  // Requests UI
  const [reqReceiver, setReqReceiver] = useState('');
  const [reqContent, setReqContent] = useState('');
  
  // Login UI
  const [loginId, setLoginId] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetUserId, setResetUserId] = useState('');
  const [resetFeedback, setResetFeedback] = useState({ type: '', message: '' });
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);
  const [acknowledgingAlertId, setAcknowledgingAlertId] = useState('');
  const [isMcSubmitting, setIsMcSubmitting] = useState(false);

  // Forms UI
  const [lastClock, setLastClock] = useState(null);
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketSort, setTicketSort] = useState('date-desc');

  // Laundry UI
  const [laundryForm, setLaundryForm] = useState({});
  const [receiveLaundryModal, setReceiveLaundryModal] = useState(null);
  const [editStockModal, setEditStockModal] = useState(null);

  // Claim Days UI
  const [claimModal, setClaimModal] = useState(false);
  const [claimForm, setClaimForm] = useState({
    guestName: '', icNumber: '', contactNumber: '', bookingDate: '', roomType: '', payment: '', usedDates: [], balanceClaim: 0, recordedBy: ''
  });
  const [editingClaim, setEditingClaim] = useState(null);

  // Audit Filters UI
  const [auditFilterMonth, setAuditFilterMonth] = useState(getCurrentMonthString);
  const [auditFilterUser, setAuditFilterUser] = useState('');
  const [auditFilterAction, setAuditFilterAction] = useState('');

  // Attendance Report UI State
  const [attFilterMonth, setAttFilterMonth] = useState(getCurrentMonthString);
  const [attFilterStartDate, setAttFilterStartDate] = useState('');
  const [attFilterEndDate, setAttFilterEndDate] = useState('');
  const [attFilterUser, setAttFilterUser] = useState('');
  const [attFilterSearch, setAttFilterSearch] = useState('');
  const [attReportSubTab, setAttReportSubTab] = useState('LOGS'); // 'LOGS' | 'SUMMARY' | 'ROSTER'
  const [hotelLocation, setHotelLocation] = useState(DEFAULT_HOTEL_COORDS);
  const isRequestView = view === 'REQ';

  const requests = useMemo(() => {
    const uniqueRequests = new Map();
    [...receivedRequests, ...sentRequests].forEach(request => uniqueRequests.set(request.id, request));
    return [...uniqueRequests.values()].sort((a, b) => {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }, [receivedRequests, sentRequests]);

  // --- 1. PERSISTENCE, CLOCK & SECRET ROUTE ---
  useEffect(() => {
    const storedUser = localStorage.getItem('hotelUser');
    let cancelled = false;

    const restoreSession = async () => {
      if (!storedUser) {
        if (!cancelled) setIsSessionReady(true);
        return;
      }

      try {
        const savedUser = JSON.parse(storedUser);
        if (!savedUser.dbId) throw new Error('INVALID_SESSION');

        const userSnapshot = await getDoc(doc(db, 'users', savedUser.dbId));
        if (!userSnapshot.exists()) throw new Error('USER_NOT_FOUND');

        const latestUser = { dbId: userSnapshot.id, ...userSnapshot.data() };
        if (!isUserActive(latestUser)) throw new Error('ACCOUNT_INACTIVE');
        if (latestUser.role !== 'admin' && isMobileOrTabletDevice()) {
          if (!latestUser.approvedDeviceId) {
            const error = new Error('DEVICE_BINDING_RESET');
            error.code = 'DEVICE_BINDING_RESET';
            throw error;
          }
          if (latestUser.approvedDeviceId !== getDeviceId(false)) {
            const error = new Error('DEVICE_ALREADY_BOUND');
            error.code = 'DEVICE_ALREADY_BOUND';
            throw error;
          }
        }
        const userObj = latestUser;

        if (!cancelled) {
          setCurrentUser(userObj);
          localStorage.setItem('hotelUser', JSON.stringify(userObj));
          setView(userObj.role === 'admin' ? 'ADMIN' : 'ROOMS');
        }
      } catch (error) {
        localStorage.removeItem('hotelUser');
        if (!cancelled && (error.code === 'DEVICE_ALREADY_BOUND' || error.message === 'DEVICE_ALREADY_BOUND')) {
          setLoginError(DEVICE_BINDING_ERROR);
        } else if (!cancelled && (error.code === 'DEVICE_BINDING_RESET' || error.message === 'DEVICE_BINDING_RESET')) {
          setLoginError(DEVICE_BINDING_RESET_MESSAGE);
        } else if (!cancelled && error.message === 'ACCOUNT_INACTIVE') {
          setLoginError('This staff account is inactive. Please contact an administrator.');
        }
      } finally {
        if (!cancelled) setIsSessionReady(true);
      }
    };

    restoreSession();
    // --- SECRET OVERRIDE LISTENER ---
    const handleHashChange = () => {
      if (window.location.hash === '#system-override') setIsSecretAdmin(true);
      else setIsSecretAdmin(false);
    };
    handleHashChange(); // Check immediately on load
    window.addEventListener('hashchange', handleHashChange);

    // --- MAINTENANCE DATABASE LISTENER ---
    const unsubMaintenance = onSnapshot(doc(db, "settings", "maintenance"), (snap) => {
      if (snap.exists()) setMaintenanceData(snap.data());
      else setMaintenanceData({ active: false, message: '' });
    });

    // --- HOTEL LOCATION SETTING LISTENER ---
    const unsubLocation = onSnapshot(doc(db, "settings", "location"), (snap) => {
      if (snap.exists()) setHotelLocation(normalizeHotelLocation(snap.data()));
    });

    return () => {
      cancelled = true;
      window.removeEventListener('hashchange', handleHashChange);
      unsubMaintenance();
      unsubLocation();
    };
  }, []);

  // Avoid re-rendering the entire application every second on pages that do
  // not display a live clock or running attendance durations.
  useEffect(() => {
    if (!currentUser || !['SHIFT', 'ATT_REPORT'].includes(view)) return;
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [currentUser, view]);

  // --- 2. CORE DATA LISTENERS ---
  useEffect(() => {
    if (!currentUser || !isProfileComplete(currentUser)) return;

    const unsubRooms = onSnapshot(collection(db, "rooms"), (snap) => {
      setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const loadedUsers = snap.docs.map(d => ({ dbId: d.id, ...d.data() }));
      setUsers(loadedUsers);

      const latestCurrentUser = loadedUsers.find(user => user.dbId === currentUser.dbId);
      const accountUnavailable = !latestCurrentUser || !isUserActive(latestCurrentUser);
      const deviceUnavailable = currentUser.role !== 'admin' &&
        isMobileOrTabletDevice() &&
        latestCurrentUser?.approvedDeviceId !== getDeviceId(false);

      if (accountUnavailable || deviceUnavailable) {
          localStorage.removeItem('hotelUser');
          setCurrentUser(null);
          setLoginId('');
          setLoginPass('');
          if (latestCurrentUser && !isUserActive(latestCurrentUser)) {
            setLoginError('This staff account is inactive. Please contact an administrator.');
          } else if (deviceUnavailable) {
            setLoginError(latestCurrentUser?.approvedDeviceId ? DEVICE_BINDING_ERROR : DEVICE_BINDING_RESET_MESSAGE);
          }
          setView('ROOMS');
      }
    });

    let unsubAdminLeaves = () => {};
    if (currentUser.role === 'admin') {
      const qLeaves = query(collection(db, "leaves"), orderBy("createdAt", "desc"), limit(100));
      unsubAdminLeaves = onSnapshot(qLeaves, (snap) => setLeaves(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }
    
    return () => {
      unsubRooms();
      unsubUsers();
      unsubAdminLeaves();
    };
  }, [currentUser]);

  // Only read messages that belong to the signed-in user. Sent history is
  // subscribed to only while the Request Staff page is actually open.
  useEffect(() => {
    if (!currentUser || !isProfileComplete(currentUser)) return undefined;

    const incomingQuery = query(
      collection(db, 'requests'),
      where('receiverId', '==', currentUser.dbId),
      limit(100)
    );
    const unsubIncoming = onSnapshot(incomingQuery, (snapshot) => {
      setReceivedRequests(snapshot.docs.map(requestDoc => ({ id: requestDoc.id, ...requestDoc.data() })));
    });

    let unsubSent = () => {};
    if (isRequestView) {
      const sentQuery = query(
        collection(db, 'requests'),
        where('senderId', '==', currentUser.dbId),
        limit(100)
      );
      unsubSent = onSnapshot(sentQuery, (snapshot) => {
        setSentRequests(snapshot.docs.map(requestDoc => ({ id: requestDoc.id, ...requestDoc.data() })));
      });
    }

    return () => {
      unsubIncoming();
      unsubSent();
    };
  }, [currentUser, isRequestView]);

  // Load each section only when it is opened instead of downloading every
  // collection immediately after login.
  useEffect(() => {
    if (!currentUser || !isProfileComplete(currentUser)) return;
    const unsubs = [];

    if (view === 'ROOMS' && !selectedRoom) {
      const qOpenTickets = query(collection(db, "tickets"), where("status", "==", "open"), limit(100));
      unsubs.push(onSnapshot(qOpenTickets, (snap) => setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
    } else if (view === 'TICKETS' || selectedRoom) {
      const qTickets = query(collection(db, "tickets"), orderBy("createdAt", "desc"), limit(200));
      unsubs.push(onSnapshot(qTickets, (snap) => setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
    }

    let attendanceQuery = null;
    if (view === 'SHIFT') {
      attendanceQuery = query(collection(db, "attendance"), orderBy("timestamp", "desc"), limit(100));
    } else if (view === 'ATT_REPORT' && currentUser.role === 'admin') {
      if (attFilterMonth) {
        const [filterYear, filterMonth] = attFilterMonth.split('-').map(Number);
        const monthStart = new Date(filterYear, filterMonth - 1, 1);
        const monthEnd = new Date(filterYear, filterMonth, 1);
        attendanceQuery = query(
          collection(db, "attendance"),
          where("timestamp", ">=", monthStart),
          where("timestamp", "<", monthEnd),
          orderBy("timestamp", "desc"),
          limit(1000)
        );
      } else {
        attendanceQuery = query(collection(db, "attendance"), orderBy("timestamp", "desc"), limit(1000));
      }
    } else if (view === 'ADMIN' && currentUser.role === 'admin' && staffModal) {
      attendanceQuery = query(collection(db, "attendance"), orderBy("timestamp", "desc"), limit(200));
    }

    if (attendanceQuery) {
      unsubs.push(onSnapshot(attendanceQuery, (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setAttendance(data);
        const myLogs = data.filter(a => a.userId === currentUser.userid);
        setLastClock(myLogs.length > 0 ? myLogs[0] : null);
      }));
    }

    if (['SHIFT', 'MC'].includes(view) && currentUser.role !== 'admin') {
      const qLeaves = query(collection(db, "leaves"), where("userId", "==", currentUser.userid), limit(100));
      unsubs.push(onSnapshot(qLeaves, (snap) => {
        const staffLeaves = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => {
          const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
          const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
          return bTime - aTime;
        });
        setLeaves(staffLeaves);
      }));
    }

    if (view === 'ITEMS') {
      const qInv = query(collection(db, "inventory"), orderBy("createdAt", "asc"), limit(200));
      unsubs.push(onSnapshot(qInv, (snap) => setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
    }

    if (view === 'CLAIMS') {
      const qClaims = query(collection(db, "claimDays"), orderBy("createdAt", "desc"), limit(200));
      unsubs.push(onSnapshot(qClaims, (snap) => setClaimDays(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
    }

    if (view === 'LAUNDRY') {
      const qLaundry = query(collection(db, "laundry"), orderBy("createdAt", "desc"), limit(200));
      unsubs.push(onSnapshot(qLaundry, (snap) => setLaundry(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
      unsubs.push(onSnapshot(doc(db, "settings", "laundryDetails"), (snap) => {
        if (snap.exists()) setLaundryItemDetails(snap.data().items || {});
      }));
      const qStock = query(collection(db, "stock"), orderBy("order", "asc"), limit(200));
      unsubs.push(onSnapshot(qStock, (snap) => setStockItems(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
    }

    if (view === 'DEPOSIT') {
      const qDeposits = query(collection(db, "deposits"), orderBy("createdAt", "desc"), limit(200));
      unsubs.push(onSnapshot(qDeposits, (snap) => setDeposits(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
    }

    if (view === 'VERIFY') {
      const qVerify = query(collection(db, "verifications"), orderBy("createdAt", "desc"), limit(200));
      unsubs.push(onSnapshot(qVerify, (snap) => setVerifications(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
    }

    if (view === 'ADMIN' && currentUser.role === 'admin') {
      const qAudit = query(collection(db, "auditLogs"), orderBy("timestamp", "desc"), limit(300));
      unsubs.push(onSnapshot(qAudit, (snap) => setAuditLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
    }

    return () => unsubs.forEach(unsubscribe => unsubscribe());
  }, [currentUser, view, selectedRoom, staffModal, attFilterMonth]);

  // Keep attendance alerts live for admins on every page. Unacknowledged
  // alerts remain visible after logout so an offline admin sees them later.
  useEffect(() => {
    if (currentUser?.role !== 'admin' || !isProfileComplete(currentUser)) {
      return undefined;
    }

    const alertsQuery = query(collection(db, 'adminAlerts'), orderBy('createdAt', 'desc'), limit(30));
    return onSnapshot(alertsQuery, (snapshot) => {
      setAdminAlerts(snapshot.docs.map(alertDoc => ({ id: alertDoc.id, ...alertDoc.data() })));
    }, (error) => {
      console.error('Admin alert listener failed:', error);
    });
  }, [currentUser]);

  const { sessions: allAttSessions, rosterStatus: attRosterStatus } = useMemo(
    () => processAttendanceSessions(attendance, users, leaves, currentTime),
    [attendance, users, leaves, currentTime]
  );

  const openTicketCountByRoom = useMemo(() => tickets.reduce((counts, ticket) => {
    if (ticket.status !== 'open' || ticket.roomId === undefined || ticket.roomId === null) return counts;
    const roomId = String(ticket.roomId);
    counts[roomId] = (counts[roomId] || 0) + 1;
    return counts;
  }, {}), [tickets]);


  // ======================================================================
  // --- SECRET OVERRIDE RENDERS --- (Intercepts everything else)
  // ======================================================================

  const handleSaveMaintenance = async (e) => {
    e.preventDefault();
    const msg = e.target.message.value;
    const active = e.target.active.checked;
    try {
      await setDoc(doc(db, "settings", "maintenance"), { active, message: msg }, { merge: true });
      if(currentUser) logSystemAction(currentUser.name, 'SYSTEM_OVERRIDE', `Toggled maintenance mode to: ${active}`); 
      alert("System Override applied instantly!");
    } catch {
      alert("Failed to apply settings");
    }
  };

  // 1. If user is on the secret URL route
  if (isSecretAdmin) {
    return (
      <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#111', color: '#fff', padding: '20px', boxSizing: 'border-box'}}>
        <div style={{background: '#222', padding: '40px', borderRadius: '12px', width: '100%', maxWidth: '500px', boxShadow: '0 10px 40px rgba(0,0,0,0.8)', border: '1px solid #333'}}>
          <h2 style={{color: '#ef4444', textAlign: 'center', marginBottom: '10px', fontSize: '2rem'}}>
             <i className="fa-solid fa-lock"></i> Override Control
          </h2>
          <p style={{color: '#888', fontSize: '0.9rem', textAlign: 'center', marginBottom: '30px'}}>
             Use this panel to instantly disconnect all staff and brick the live site.
          </p>
          <form onSubmit={handleSaveMaintenance} style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
            <label style={{display: 'flex', alignItems: 'center', gap: '15px', fontSize: '1.2rem', cursor: 'pointer', background: '#333', padding: '20px', borderRadius: '8px', border: '1px solid #444'}}>
              <input type="checkbox" name="active" defaultChecked={maintenanceData?.active} style={{width: '25px', height: '25px', cursor: 'pointer'}} />
              <strong>BRICK SITE (Maintenance Mode)</strong>
            </label>
            <textarea 
               name="message" 
               defaultValue={maintenanceData?.message} 
               placeholder="Enter the message users will see when they try to access the site..." 
               rows="5" 
               style={{width: '100%', padding: '15px', background: '#333', color: '#fff', border: '1px solid #444', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box'}} 
            />
            <button type="submit" className="btn red" style={{justifyContent: 'center', padding: '20px', fontSize: '1.2rem', fontWeight: 'bold'}}>APPLY OVERRIDE SETTINGS</button>
          </form>
          <button onClick={() => window.location.hash = ''} style={{background:'none', border:'none', color:'#666', marginTop:'30px', cursor:'pointer', width: '100%', textDecoration:'underline', fontSize: '1rem'}}>Exit Secret Panel</button>
        </div>
      </div>
    );
  }

  // 2. If Maintenance is Active AND we are NOT on the secret route
  if (maintenanceData?.active) {
    return (
      <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f8f9fa', textAlign: 'center', padding: '20px'}}>
          <div style={{maxWidth: '600px'}}>
              <i className="fa-solid fa-triangle-exclamation" style={{fontSize: '6rem', color: '#ef4444', marginBottom: '20px', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))'}}></i>
              <h1 style={{fontSize: '3rem', color: '#222', marginBottom: '15px', fontWeight: '900'}}>System Lockdown</h1>
              <p style={{fontSize: '1.4rem', color: '#555', lineHeight: '1.6', padding: '0 20px'}}>{maintenanceData.message || 'The system is currently undergoing scheduled maintenance. Please try again later.'}</p>
          </div>
      </div>
    );
  }

  // --- 3. AUTH ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const q = query(collection(db, "users"), where("userid", "==", loginId));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) { setLoginError('User ID not found'); return; }

      const userData = querySnapshot.docs[0].data();
      const docId = querySnapshot.docs[0].id;
      if (!isUserActive(userData)) {
        setLoginError('This staff account is inactive. Please contact an administrator.');
        return;
      }
      if (userData.password !== loginPass) { setLoginError('Incorrect Password'); return; }

      const isMobileStaff = userData.role !== 'admin' && isMobileOrTabletDevice();
      const shouldBindDevice = isMobileStaff && !userData.approvedDeviceId;
      let userObj = { dbId: docId, ...userData };

      if (isMobileStaff && userData.approvedDeviceId) {
        if (userData.approvedDeviceId !== getDeviceId(false)) {
          setLoginError(DEVICE_BINDING_ERROR);
          return;
        }
      } else if (shouldBindDevice) {
        userObj = await approveOrValidateMobileDevice(docId, loginPass);
      }

      setCurrentUser(userObj);
      localStorage.setItem('hotelUser', JSON.stringify(userObj));
      logSystemAction(userObj.name, 'LOGIN', isComputerDevice() ? 'Logged into the system on computer' : `Logged into the system on approved device: ${getDeviceName()}`);
      if (shouldBindDevice) {
        logSystemAction(userObj.name, 'DEVICE_BINDING_APPROVED', `Approved first mobile device: ${getDeviceName()}`);
      }
      setView(userObj.role === 'admin' ? 'ADMIN' : 'ROOMS');
    } catch (error) {
      if (error.code === 'DEVICE_ALREADY_BOUND' || error.message === 'DEVICE_ALREADY_BOUND') {
        setLoginError(DEVICE_BINDING_ERROR);
      } else if (error.message === 'ACCOUNT_INACTIVE') {
        setLoginError('This staff account is inactive. Please contact an administrator.');
      } else if (error.message === 'INCORRECT_PASSWORD') {
        setLoginError('Incorrect Password');
      } else {
        console.error('Login failed:', error);
        setLoginError('Login failed. Please try again.');
      }
    }
  };

  const handleLogout = () => {
    logSystemAction(currentUser.name, 'LOGOUT', 'Logged out of the system');
    localStorage.removeItem('hotelUser');
    setCurrentUser(null);
    setLoginId('');
    setLoginPass('');
    setShowProfileModal(false);
    setProfileFeedback({ type: '', message: '' });
    setView('ROOMS');
  };

  const openForgotPassword = () => {
    setResetUserId(loginId.trim());
    setResetFeedback({ type: '', message: '' });
    setLoginError('');
    setShowForgotPassword(true);
  };

  const closeForgotPassword = () => {
    setShowForgotPassword(false);
    setResetFeedback({ type: '', message: '' });
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    const userId = resetUserId.trim();
    if (!userId || isResetSubmitting) return;

    setIsResetSubmitting(true);
    setResetFeedback({ type: '', message: '' });

    try {
      const resetQuery = query(collection(db, 'users'), where('userid', '==', userId));
      const resetSnapshot = await getDocs(resetQuery);

      if (resetSnapshot.empty) {
        setResetFeedback({ type: 'error', message: 'User ID not found. Please check and try again.' });
        return;
      }

      const userDocument = resetSnapshot.docs[0];
      const userData = userDocument.data();
      if (!isUserActive(userData)) {
        setResetFeedback({ type: 'error', message: 'This account is inactive. Please contact an administrator.' });
        return;
      }

      if (userData.passwordResetStatus !== 'pending') {
        await updateDoc(doc(db, 'users', userDocument.id), {
          passwordResetStatus: 'pending',
          passwordResetRequestedAt: serverTimestamp()
        });
        await logSystemAction(userData.name, 'PASSWORD_RESET_REQUEST', `Requested a password reset for User ID: ${userId}`);
      }

      setResetFeedback({
        type: 'success',
        message: 'Request sent. Please contact an administrator to receive your new password.'
      });
    } catch (error) {
      console.error('Password reset request failed:', error);
      setResetFeedback({ type: 'error', message: 'Unable to send the request. Please try again.' });
    } finally {
      setIsResetSubmitting(false);
    }
  };

  const openProfilePortal = () => {
    setProfileTab('PROFILE');
    setProfileFeedback({ type: '', message: '' });
    setShowProfileModal(true);
  };

  const closeProfilePortal = () => {
    setShowProfileModal(false);
    setProfileFeedback({ type: '', message: '' });
  };

  const changeProfileTab = (tab) => {
    setProfileTab(tab);
    setProfileFeedback({ type: '', message: '' });
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (isProfileSaving) return;

    const form = e.currentTarget;
    const name = form.fullName.value.trim();
    const email = form.email.value.trim().toLowerCase();
    const dateOfBirth = form.dateOfBirth.value;
    const phone = form.phone.value.trim();

    if (name.length < 2) {
      setProfileFeedback({ type: 'error', message: 'Please enter a valid full name.' });
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      setProfileFeedback({ type: 'error', message: 'A valid email address is required.' });
      return;
    }
    if (!isValidDateOfBirth(dateOfBirth)) {
      setProfileFeedback({ type: 'error', message: 'A valid date of birth is required.' });
      return;
    }

    setIsProfileSaving(true);
    setProfileFeedback({ type: '', message: '' });

    try {
      await updateDoc(doc(db, 'users', currentUser.dbId), {
        name,
        email,
        dateOfBirth,
        phone,
        profileUpdatedAt: serverTimestamp()
      });

      const updatedUser = { ...currentUser, name, email, dateOfBirth, phone };
      setCurrentUser(updatedUser);
      localStorage.setItem('hotelUser', JSON.stringify(updatedUser));
      await logSystemAction(name, 'PROFILE_UPDATE', 'Updated personal profile information');
      setProfileFeedback({ type: 'success', message: 'Your profile has been updated successfully.' });
    } catch (error) {
      console.error('Profile update failed:', error);
      setProfileFeedback({ type: 'error', message: 'Unable to update your profile. Please try again.' });
    } finally {
      setIsProfileSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (isProfileSaving) return;

    const form = e.currentTarget;
    const currentPass = form.currentPass.value;
    const newPass = form.newPass.value;
    const confirmPass = form.confirmPass.value;

    if (currentPass !== currentUser.password) {
      setProfileFeedback({ type: 'error', message: 'Your current password is incorrect.' });
      return;
    }
    if (newPass !== confirmPass) {
      setProfileFeedback({ type: 'error', message: 'The new passwords do not match.' });
      return;
    }

    setIsProfileSaving(true);
    setProfileFeedback({ type: '', message: '' });

    try {
      await updateDoc(doc(db, "users", currentUser.dbId), {
        password: newPass,
        passwordResetStatus: deleteField(),
        passwordResetRequestedAt: deleteField()
      });
      const updatedUser = { ...currentUser, password: newPass };
      setCurrentUser(updatedUser);
      localStorage.setItem('hotelUser', JSON.stringify(updatedUser));
      await logSystemAction(currentUser.name, 'PASSWORD_CHANGE', 'Changed their own password');
      form.reset();
      setProfileFeedback({ type: 'success', message: 'Your password has been changed successfully.' });
    } catch (error) {
      console.error('Password change failed:', error);
      setProfileFeedback({ type: 'error', message: 'Unable to change your password. Please try again.' });
    } finally {
      setIsProfileSaving(false);
    }
  };

  const handleAdminChangePassword = async (staffDocId, staffName) => {
    const newPass = prompt(`Enter new password for ${staffName}:`);
    if (newPass === null) return; 
    if (!newPass) return alert("Password cannot be empty.");
    try {
        await updateDoc(doc(db, "users", staffDocId), {
          password: newPass,
          passwordResetStatus: deleteField(),
          passwordResetRequestedAt: deleteField()
        });
        setStaffModal(previous => previous?.dbId === staffDocId
          ? { ...previous, passwordResetStatus: undefined, passwordResetRequestedAt: undefined }
          : previous
        );
        logSystemAction(currentUser.name, 'ADMIN_OVERRIDE', `Changed password for staff: ${staffName}`); 
        alert(`Password for ${staffName} updated successfully!`);
    } catch {
        alert("Failed to update password.");
    }
  };

  // --- ADD OR RESTORE ROOMS (NEW ADMIN FEATURE) ---
  const handleAddRoom = async (e) => {
    e.preventDefault();
    const f = e.target;
    const rId = f.roomId.value;
    const rFloor = f.floor.value;
    const rType = f.roomType.value.toUpperCase();

    try {
      await setDoc(doc(db, "rooms", rId), {
        id: rId,
        floor: rFloor,
        type: rType,
        status: 'vacant',
        hasKey: true
      }, { merge: true }); // Merge true ensures it creates it safely if it doesn't exist
      
      logSystemAction(currentUser.name, 'ROOM_CREATED', `Added/Restored Room ${rId}`);
      alert(`Room ${rId} successfully added/restored!`);
      f.reset();
    } catch (err) {
      alert("Failed to add room: " + err.message);
    }
  };

  // --- 4. LAUNDRY & STOCK FUNCTIONS ---
  const handleLaundryChange = (item, val) => {
    setLaundryForm(prev => {
       const updated = {...prev};
       if (val === '' || val === '0') delete updated[item];
       else updated[item] = parseInt(val);
       return updated;
    });
  };

  const handleSendLaundry = async () => {
    const itemsToSend = {};
    let hasItems = false;
    LAUNDRY_ITEMS.forEach(itemName => {
        if (laundryForm[itemName] > 0) {
            itemsToSend[itemName] = { sentQty: laundryForm[itemName], status: 'pending', remark: '' };
            hasItems = true;
        }
    });
    if (!hasItems) return alert("Please enter at least one item quantity.");
    await addDoc(collection(db, "laundry"), { items: itemsToSend, status: 'pending', sentBy: currentUser.name, createdAt: serverTimestamp() });
    logSystemAction(currentUser.name, 'LAUNDRY_SENT', `Sent ${Object.keys(itemsToSend).length} types of items to laundry`); 
    setLaundryForm({});
    alert("Laundry Sent!");
  };

  const handleItemReceiveToggle = (itemName, status) => {
    const updated = {...receiveLaundryModal};
    if (status === 'correct') {
        updated.items[itemName].status = 'correct';
        updated.items[itemName].remark = '';
    } else {
        const remark = prompt(`Enter missing amount or remark for ${itemName} (Sent: ${updated.items[itemName].sentQty}):`);
        if (remark === null) return;
        updated.items[itemName].status = 'incorrect';
        updated.items[itemName].remark = remark;
    }
    setReceiveLaundryModal(updated);
  };

  const handleSaveReceivedLaundry = async () => {
    const allChecked = Object.values(receiveLaundryModal.items).every(i => i.status !== 'pending');
    if(!allChecked) { if(!confirm("Some items have not been verified. Mark batch as received anyway?")) return; }
    await updateDoc(doc(db, "laundry", receiveLaundryModal.id), { items: receiveLaundryModal.items, status: 'received', receivedBy: currentUser.name, receivedAt: serverTimestamp() });
    logSystemAction(currentUser.name, 'LAUNDRY_RECEIVED', `Verified and received laundry batch`); 
    setReceiveLaundryModal(null);
    alert("Laundry marked as received!");
  };

  const handleUpdateLaundryItemDetails = async (itemName) => {
    const currentDetails = laundryItemDetails[itemName] || '';
    const newDetails = prompt(`Enter opening stock details for ${itemName} (e.g., "100" or "100 Single, 100 Queen"):`, currentDetails);
    if (newDetails === null) return;
    try {
      await setDoc(doc(db, "settings", "laundryDetails"), { items: { [itemName]: newDetails } }, { merge: true });
      logSystemAction(currentUser.name, 'STOCK_CONFIG', `Updated opening stock label for ${itemName}`); 
      alert("Opening stock updated!");
    } catch { alert("Failed to update opening stock"); }
  };

  const handleAddStock = async (e) => {
    e.preventDefault();
    const f = e.target;
    const maxOrder = stockItems.length > 0 ? Math.max(...stockItems.map(i => i.order || 0)) : 0;
    await addDoc(collection(db, "stock"), {
      name: f.name.value, quantity: parseInt(f.quantity.value) || 0, category: f.category.value || "General", subcategory: f.subcategory.value || "", order: maxOrder + 1, createdAt: serverTimestamp()
    });
    logSystemAction(currentUser.name, 'STOCK_ADD', `Added new stock item: ${f.name.value} (${f.quantity.value})`); 
    f.reset(); alert("Stock item added!");
  };

  const handleUpdateStock = async (e) => {
    e.preventDefault();
    if (!editStockModal) return;
    await updateDoc(doc(db, "stock", editStockModal.id), {
      name: editStockModal.name, quantity: parseInt(editStockModal.quantity) || 0, category: editStockModal.category || "General", subcategory: editStockModal.subcategory || ""
    });
    logSystemAction(currentUser.name, 'STOCK_UPDATE', `Updated stock for: ${editStockModal.name} to qty: ${editStockModal.quantity}`); 
    setEditStockModal(null); alert("Stock updated!");
  };

  const handleDeleteStock = async (itemId) => {
    const item = stockItems.find(i => i.id === itemId);
    if (!confirm(`Delete stock item: ${item?.name}?`)) return;
    await deleteDoc(doc(db, "stock", itemId));
    logSystemAction(currentUser.name, 'STOCK_DELETE', `Deleted stock item: ${item?.name}`); 
  };

  const openEditStock = (item) => {
    setEditStockModal({ id: item.id, name: item.name, quantity: item.quantity, category: item.category || 'General', subcategory: item.subcategory || '' });
  };

  // --- 5. ROOM DEPOSITS LOGIC ---
  const handleAddDeposit = async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      await addDoc(collection(db, "deposits"), {
        roomNo: f.roomNo.value,
        amount: parseFloat(f.amount.value),
        checkInDate: f.checkInDate.value,
        recordedBy: currentUser.name,
        createdAt: serverTimestamp()
      });
      logSystemAction(currentUser.name, 'DEPOSIT_ADD', `Collected RM${f.amount.value} deposit for Room ${f.roomNo.value}`);
      f.reset();
      alert("Deposit recorded successfully!");
    } catch {
      alert("Failed to record deposit");
    }
  };

  const handleDeleteDeposit = async (id, roomNo) => {
    if (!window.confirm(`Are you sure you want to delete the deposit record for Room ${roomNo}?`)) return;
    try {
      await deleteDoc(doc(db, "deposits", id));
      logSystemAction(currentUser.name, 'DEPOSIT_DELETE', `Deleted deposit record for Room ${roomNo}`);
    } catch {
      alert("Failed to delete deposit record");
    }
  };

  // --- 6. ONLINE PAYMENT VERIFICATION LOGIC ---
  const handleAddVerification = async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      await addDoc(collection(db, "verifications"), {
        paymentDate: f.paymentDate.value,
        paymentTime: f.paymentTime.value,
        refId: f.refId.value,
        amount: parseFloat(f.amount.value),
        status: 'pending', 
        recordedBy: currentUser.name,
        createdAt: serverTimestamp()
      });
      logSystemAction(currentUser.name, 'VERIFY_ADD', `Logged payment verification request for Ref: *${f.refId.value} (RM${f.amount.value})`);
      f.reset();
      alert("Verification request recorded successfully!");
    } catch {
      alert("Failed to record verification request");
    }
  };

  const handleDeleteVerification = async (id, refId) => {
    if (!window.confirm(`Are you sure you want to delete the verification record for Ref *${refId}?`)) return;
    try {
      await deleteDoc(doc(db, "verifications", id));
      logSystemAction(currentUser.name, 'VERIFY_DELETE', `Deleted verification record for Ref *${refId}`);
    } catch {
      alert("Failed to delete verification record");
    }
  };

  const toggleVerificationStatus = async (v) => {
    if (currentUser.role !== 'admin') return;
    const newStatus = v.status === 'verified' ? 'pending' : 'verified';
    try {
        await updateDoc(doc(db, "verifications", v.id), { status: newStatus });
        logSystemAction(currentUser.name, 'VERIFY_STATUS', `Marked payment Ref *${v.refId} as ${newStatus.toUpperCase()}`);
    } catch {
        alert("Failed to update status");
    }
  };

  const handleResetApprovedDevice = async (staff) => {
    if (currentUser.role !== 'admin' || staff.role === 'admin') return;
    if (!staff.approvedDeviceId) {
      alert(`${staff.name} does not have a bound device.`);
      return;
    }
    if (!confirm(`Reset the approved device for ${staff.name}? Their current phone will be logged out and the next phone used to log in will be approved.`)) return;

    try {
      await updateDoc(doc(db, 'users', staff.dbId), {
        approvedDeviceId: deleteField(),
        approvedDeviceName: deleteField(),
        approvedDeviceBoundAt: deleteField()
      });
      await logSystemAction(currentUser.name, 'DEVICE_BINDING_RESET', `Reset approved device for staff: ${staff.name} (${staff.userid})`);
      alert(`Approved device for ${staff.name} has been reset.`);
    } catch (error) {
      console.error('Device reset failed:', error);
      alert('Failed to reset the approved device.');
    }
  };

  // --- 7. ROOM & TICKETS LOGIC ---
  const toggleRoomKey = async (room) => {
    const newHasKey = !room.hasKey;
    await updateDoc(doc(db, "rooms", room.id), { hasKey: newHasKey });
    logSystemAction(currentUser.name, 'ROOM_UPDATE', `Flagged Room ${room.id} key status as: ${newHasKey ? 'Has Key' : 'No Key'}`); 
    setSelectedRoom({...room, hasKey: newHasKey}); 
  };

  const updateRoomStatus = async (roomId, newStatus) => {
    await updateDoc(doc(db, "rooms", roomId), { status: newStatus });
    logSystemAction(currentUser.name, 'ROOM_UPDATE', `Changed Room ${roomId} status to ${newStatus.toUpperCase()}`); 
    setSelectedRoom(null);
  };

  const reportIssue = async (roomId) => {
    const issue = prompt(`Issue description for Room ${roomId}?`);
    if (!issue) return;
    await addDoc(collection(db, "tickets"), { roomId, issue, status: 'open', createdAt: serverTimestamp(), reportedBy: currentUser.name });
    logSystemAction(currentUser.name, 'TICKET_CREATE', `Reported issue for Room ${roomId}: ${issue}`); 
    await updateRoomStatus(roomId, 'maintenance');
  };

  const resolveTicket = async (ticket) => {
    if(!confirm("Mark this ticket as Resolved?")) return;
    await updateDoc(doc(db, "tickets", ticket.id), { status: 'resolved', resolvedAt: serverTimestamp(), resolvedBy: currentUser.name });
    logSystemAction(currentUser.name, 'TICKET_RESOLVE', `Resolved maintenance ticket for Room ${ticket.roomId}`); 
    await updateDoc(doc(db, "rooms", ticket.roomId), { status: 'vacant' });
  };

  // --- 8. OTHER ACTIONS & ATTENDANCE PORTAL FUNCTIONS ---
  const handleClock = async (type) => {
      if (isComputerDevice()) {
        alert("Clock IN and Clock OUT are only available on a mobile phone or tablet. You can continue using all other system features on this computer.");
        return;
      }

      if (currentUser.role !== 'admin') {
        try {
          const userSnapshot = await getDoc(doc(db, 'users', currentUser.dbId));
          const approvedDeviceId = userSnapshot.exists() ? userSnapshot.data().approvedDeviceId : null;
          if (!approvedDeviceId || approvedDeviceId !== getDeviceId(false)) {
            const deviceErrorMessage = approvedDeviceId ? DEVICE_BINDING_ERROR : DEVICE_BINDING_RESET_MESSAGE;
            localStorage.removeItem('hotelUser');
            setCurrentUser(null);
            setLoginId('');
            setLoginPass('');
            setLoginError(deviceErrorMessage);
            setView('ROOMS');
            alert(deviceErrorMessage);
            return;
          }
        } catch (error) {
          console.error('Device validation failed:', error);
          alert('Unable to verify this approved device. Please check your connection and try again.');
          return;
        }
      }

      if(!confirm(`Confirm Clock ${type.toUpperCase()}?`)) return;

      let locStatus = 'away';
      let locLabel = 'Away';
      let coords = null;

      try {
        if (!("geolocation" in navigator)) {
          throw new Error("Geolocation is not supported by this browser");
        }

        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 6000,
            maximumAge: 0
          });
        });
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        coords = { lat, lng };

        const targetLat = hotelLocation.lat || DEFAULT_HOTEL_COORDS.lat;
        const targetLng = hotelLocation.lng || DEFAULT_HOTEL_COORDS.lng;
        const targetRadius = ATTENDANCE_RADIUS_METERS;

        const distMeters = calculateDistanceMeters(lat, lng, targetLat, targetLng);
        if (distMeters !== null && distMeters <= targetRadius) {
          locStatus = 'on_site';
          locLabel = 'On Site';
        } else {
          locStatus = 'away';
          if (distMeters !== null) {
            const formattedDist = distMeters >= 1000
              ? `${(distMeters / 1000).toFixed(1)}km`
              : `${Math.round(distMeters)}m`;
            locLabel = `Away (${formattedDist})`;
          } else {
            locLabel = 'Away';
          }
        }
      } catch (err) {
        console.log("GPS location unavailable or denied:", err);
        if (type === 'in') {
          alert("GPS location is required to Clock IN. Please enable location access and try again.");
          return;
        }
        locStatus = 'away';
        locLabel = 'Away (No GPS)';
      }

      const clockBatch = writeBatch(db);
      const attendanceRef = doc(collection(db, "attendance"));
      clockBatch.set(attendanceRef, {
        userId: currentUser.userid, 
        userName: currentUser.name, 
        type: type, 
        timestamp: serverTimestamp(),
        locationStatus: locStatus,
        locationLabel: locLabel,
        coords: coords,
        deviceId: currentUser.role === 'admin' ? null : getDeviceId(false),
        deviceName: getDeviceName()
      });

      if (locStatus === 'away') {
        const adminAlertRef = doc(collection(db, 'adminAlerts'));
        clockBatch.set(adminAlertRef, {
          type: 'ATTENDANCE_AWAY',
          attendanceId: attendanceRef.id,
          staffId: currentUser.userid,
          staffName: currentUser.name,
          clockType: type,
          locationLabel: locLabel,
          coords,
          deviceName: getDeviceName(),
          acknowledged: false,
          createdAt: serverTimestamp()
        });
      }

      await clockBatch.commit();
      
      logSystemAction(currentUser.name, 'ATTENDANCE', `Clocked ${type.toUpperCase()} - Location: ${locLabel}`);
      if (locStatus === 'away') {
        alert(`Clock ${type.toUpperCase()} saved. Location status recorded as AWAY (${locLabel}).`);
      } else {
        alert(`Clock ${type.toUpperCase()} saved. Location verified ON SITE.`);
      }
  };

  const acknowledgeAdminAlert = async (adminAlert) => {
    if (currentUser.role !== 'admin' || acknowledgingAlertId) return;
    setAcknowledgingAlertId(adminAlert.id);
    try {
      await updateDoc(doc(db, 'adminAlerts', adminAlert.id), {
        acknowledged: true,
        acknowledgedAt: serverTimestamp(),
        acknowledgedBy: currentUser.name
      });
      await logSystemAction(
        currentUser.name,
        'ATTENDANCE_AWAY_ACKNOWLEDGED',
        `Acknowledged ${adminAlert.staffName}'s away Clock ${String(adminAlert.clockType).toUpperCase()}`
      );
    } catch (error) {
      console.error('Unable to acknowledge admin alert:', error);
      alert('Unable to acknowledge this attendance alert. Please try again.');
    } finally {
      setAcknowledgingAlertId('');
    }
  };

  const handleSubmitMcRequest = async (event) => {
    event.preventDefault();
    if (isMcSubmitting) return;

    const form = event.currentTarget;
    const startDate = form.startDate.value;
    const endDate = form.endDate.value;
    const clinicName = form.clinicName.value.trim();
    const remarks = form.remarks.value.trim();

    if (!startDate || !endDate || endDate < startDate) {
      alert('Please select a valid MC date range.');
      return;
    }

    const overlapsPendingRequest = leaves.some(leave => (
      leave.userId === currentUser.userid &&
      leave.status === 'pending' &&
      startDate <= (leave.endDate || leave.startDate || '') &&
      endDate >= (leave.startDate || leave.endDate || '')
    ));
    if (overlapsPendingRequest) {
      alert('You already have a pending MC request for this date range.');
      return;
    }

    setIsMcSubmitting(true);
    try {
      await addDoc(collection(db, 'leaves'), {
        userId: currentUser.userid,
        userDocId: currentUser.dbId,
        userName: currentUser.name,
        type: 'MC',
        startDate,
        endDate,
        clinicName,
        remarks,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      await logSystemAction(
        currentUser.name,
        'MC_REQUEST',
        `Requested MC from ${startDate} to ${endDate}${clinicName ? ` (${clinicName})` : ''}`
      );
      form.reset();
      alert('MC request submitted successfully.');
    } catch (error) {
      console.error('MC request failed:', error);
      alert('Unable to submit the MC request. Please try again.');
    } finally {
      setIsMcSubmitting(false);
    }
  };

  const handleWithdrawMcRequest = async (mcRequest) => {
    if (mcRequest.userId !== currentUser.userid || mcRequest.status !== 'pending') return;
    if (!confirm('Withdraw this pending MC request?')) return;

    try {
      await deleteDoc(doc(db, 'leaves', mcRequest.id));
      await logSystemAction(
        currentUser.name,
        'MC_WITHDRAW',
        `Withdrew MC request from ${mcRequest.startDate || '-'} to ${mcRequest.endDate || '-'}`
      );
    } catch (error) {
      console.error('MC withdrawal failed:', error);
      alert('Unable to withdraw this MC request.');
    }
  };

  const handleReviewMcRequest = async (mcRequest, status) => {
    if (currentUser.role !== 'admin' || !['approved', 'rejected'].includes(status)) return;

    try {
      await updateDoc(doc(db, 'leaves', mcRequest.id), {
        status,
        reviewedAt: serverTimestamp(),
        reviewedBy: currentUser.name
      });
      await logSystemAction(
        currentUser.name,
        status === 'approved' ? 'MC_APPROVED' : 'MC_REJECTED',
        `${status === 'approved' ? 'Approved' : 'Rejected'} MC request for ${mcRequest.userName} (${mcRequest.startDate || '-'} to ${mcRequest.endDate || '-'})`
      );
    } catch (error) {
      console.error('MC review failed:', error);
      alert(`Unable to mark this MC request as ${status}.`);
    }
  };

  const handleSaveHotelLocation = async (e) => {
    e.preventDefault();
    const lat = parseFloat(e.target.lat.value);
    const lng = parseFloat(e.target.lng.value);
    const radiusMeters = ATTENDANCE_RADIUS_METERS;
    try {
      await setDoc(doc(db, "settings", "location"), { lat, lng, radiusMeters }, { merge: true });
      logSystemAction(currentUser.name, 'LOCATION_CONFIG', `Updated Hotel GPS location to Lat: ${lat}, Lng: ${lng}, Radius: ${radiusMeters}m`);
      alert("Hotel Location coordinates updated successfully!");
    } catch (err) {
      alert("Failed to update hotel location: " + err.message);
    }
  };

  const handleSetCurrentGPSAsHotel = () => {
    if (!("geolocation" in navigator)) return alert("Geolocation not supported by browser");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        try {
          await setDoc(doc(db, "settings", "location"), { lat, lng, radiusMeters: ATTENDANCE_RADIUS_METERS }, { merge: true });
          logSystemAction(currentUser.name, 'LOCATION_CONFIG', `Set current GPS position as Hotel Location: Lat ${lat}, Lng ${lng}`);
          alert(`Hotel GPS location updated to your current position!\nLatitude: ${lat}\nLongitude: ${lng}`);
        } catch {
          alert("Failed to save location");
        }
      },
      (err) => alert("Failed to get current GPS location: " + err.message),
      { enableHighAccuracy: true }
    );
  };

  const handleExportAttendanceCSV = (sessionsToExport) => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,Staff ID,Staff Name,Clock In Time,Clock In Location,Clock Out Time,Clock Out Location,Duration (Hours),Status\n";

    sessionsToExport.forEach(s => {
      const dateStr = s.inTime ? formatDate(s.inTime) : (s.outTime ? formatDate(s.outTime) : '-');
      const inTimeStr = s.inTime ? formatTime(s.inTime) : '-';
      const outTimeStr = s.outTime ? formatTime(s.outTime) : (s.status === 'working' ? 'Working Now' : '-');
      const inLocationStr = s.inLog ? getLocationText(s.inLog, hotelLocation) : '-';
      const outLocationStr = s.outLog ? getLocationText(s.outLog, hotelLocation) : '-';
      const durationStr = s.durationMs ? (s.durationMs / (1000 * 3600)).toFixed(2) : '0';
      const statusStr = s.status === 'working' ? 'Currently Working' : (s.status === 'completed' ? 'Completed' : s.status);

      csvContent += `"${dateStr}","${s.userId}","${s.userName}","${inTimeStr}","${inLocationStr}","${outTimeStr}","${outLocationStr}","${durationStr}","${statusStr}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Hotel_Attendance_Report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintAttendanceReport = (sessionsToPrint, summaryToPrint) => {
    const printWindow = window.open('', '', 'height=700,width=900');
    let html = `
      <html>
        <head>
          <title>Aladdin Dream Hotel - Attendance Portal Report</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #222; padding: 20px; }
            h1 { color: #1e3a8a; margin-bottom: 5px; }
            .header-info { color: #666; font-size: 0.9rem; margin-bottom: 20px; border-bottom: 2px solid #ddbd88; padding-bottom: 10px; }
            .section-title { font-size: 1.1rem; font-weight: bold; margin-top: 25px; margin-bottom: 10px; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 0.85rem; }
            th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; }
            th { background: #f3f4f6; color: #111; font-weight: bold; }
            tr:nth-child(even) { background: #f9fafb; }
            .badge-working { background: #dcfce7; color: #15803d; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; }
            .badge-completed { background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Aladdin Dream Hotel - Attendance & Shift Report</h1>
          <div class="header-info">
            Generated on: ${new Date().toLocaleString('en-MY')} | Total Sessions Logged: ${sessionsToPrint.length}
          </div>

          <div class="section-title">Staff Monthly Summary</div>
          <table>
            <thead>
              <tr>
                <th>Staff ID</th>
                <th>Staff Name</th>
                <th>Total Days Worked</th>
                <th>Total Work Hours</th>
              </tr>
            </thead>
            <tbody>
              ${summaryToPrint.map(s => `
                <tr>
                  <td>${s.userId}</td>
                  <td><b>${s.userName}</b></td>
                  <td>${s.daysWorked} days</td>
                  <td><b>${s.totalHoursStr}</b></td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="section-title">Detailed Attendance Logs</div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Staff Name</th>
                <th>Clock In</th>
                <th>Clock In Location</th>
                <th>Clock Out</th>
                <th>Clock Out Location</th>
                <th>Duration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${sessionsToPrint.map(s => `
                <tr>
                  <td>${s.inTime ? formatDate(s.inTime) : (s.outTime ? formatDate(s.outTime) : '-')}</td>
                  <td><b>${s.userName}</b> (${s.userId})</td>
                  <td>${s.inTime ? formatTime(s.inTime) : '-'}</td>
                  <td>${s.inLog ? getLocationText(s.inLog, hotelLocation) : '-'}</td>
                  <td>${s.outTime ? formatTime(s.outTime) : (s.status === 'working' ? 'Working Now' : '-')}</td>
                  <td>${s.outLog ? getLocationText(s.outLog, hotelLocation) : '-'}</td>
                  <td>${formatDuration(s.durationMs)}</td>
                  <td><span class="${s.status === 'working' ? 'badge-working' : 'badge-completed'}">${s.status.toUpperCase()}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 300);
  };

  const handleItemRequest = async (e) => {
    e.preventDefault();
    const f = e.target;
    await addDoc(collection(db, "inventory"), { department: f.department.value, item: f.item.value, qty: f.qty.value || '', remark: f.remark.value || '', bought: false, buyRemark: '', requestedBy: currentUser.name, createdAt: serverTimestamp() });
    logSystemAction(currentUser.name, 'ITEM_REQUEST', `Requested ${f.qty.value} ${f.item.value} for ${f.department.value}`); 
    f.reset();
  };

  const toggleItemBought = async (invItem) => {
    if (!invItem.bought) {
        const remark = prompt("Optional complete remark (e.g., 'datin done buy'):");
        if (remark === null) return; 
        await updateDoc(doc(db, "inventory", invItem.id), { bought: true, buyRemark: remark, boughtBy: currentUser.name, boughtAt: serverTimestamp() });
        logSystemAction(currentUser.name, 'ITEM_UPDATE', `Marked requested item as bought: ${invItem.item}`); 
    } else {
        if(confirm("Unmark this item as bought?")) {
            await updateDoc(doc(db, "inventory", invItem.id), { bought: false, buyRemark: '', boughtBy: null, boughtAt: null });
            logSystemAction(currentUser.name, 'ITEM_UPDATE', `Unmarked requested item: ${invItem.item}`); 
        }
    }
  };

  const handleSendRequest = async (e) => {
    e.preventDefault();
    if (!reqReceiver || !reqContent) { alert("Select receiver and enter details."); return; }
    const receiverUser = users.find(u => u.dbId === reqReceiver);
    await addDoc(collection(db, "requests"), { senderId: currentUser.dbId, senderName: currentUser.name, receiverId: reqReceiver, receiverName: receiverUser.name, content: reqContent, status: 'pending', createdAt: serverTimestamp() });
    logSystemAction(currentUser.name, 'MSG_SENT', `Sent message to ${receiverUser.name}`); 
    setReqContent(''); setReqReceiver(''); alert("Message Sent!");
  };

  const handleAcceptRequest = async (reqId) => {
    if(!confirm("Accept this request?")) return;
    await updateDoc(doc(db, "requests", reqId), { status: 'accepted', acceptedAt: serverTimestamp() });
  };

  const handleCompleteRequest = async (reqId) => {
    const remark = prompt("Optional completion note:");
    if(remark === null) return; 
    await updateDoc(doc(db, "requests", reqId), { status: 'completed', completedAt: serverTimestamp(), completionRemark: remark });
  };

  const submitReject = async () => {
    if(!rejectReason) return alert("Please enter reason.");
    await updateDoc(doc(db, "requests", rejectModal.reqId), { status: 'rejected', rejectionReason: rejectReason, completedAt: serverTimestamp() });
    setRejectModal({ show: false, reqId: null });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const f = e.target;
    const userId = f.userid.value.trim();
    const existingUser = users.find(user => user.userid?.toLowerCase() === userId.toLowerCase());
    if (existingUser) {
      alert(isUserActive(existingUser)
        ? `User ID ${userId} already exists.`
        : `User ID ${userId} belongs to an inactive staff account. Reactivate that account instead.`);
      return;
    }

    await addDoc(collection(db, "users"), {
      userid: userId,
      name: f.name.value.trim(),
      password: f.password.value,
      role: f.role.value,
      active: true,
      createdAt: serverTimestamp()
    });
    await logSystemAction(currentUser.name, 'STAFF_CREATE', `Created new staff profile: ${f.name.value.trim()} (${userId})`);
    f.reset(); alert("User Created!");
  };

  const handleSetStaffActive = async (staff, active) => {
    if (currentUser.role !== 'admin' || staff.role === 'admin') return;

    const actionLabel = active ? 'reactivate' : 'set as inactive';
    const confirmation = active
      ? `Reactivate ${staff.name} (${staff.userid})?`
      : `Set ${staff.name} (${staff.userid}) as inactive?`;
    if (!confirm(confirmation)) return;

    try {
      const statusFields = active
        ? { active: true, inactiveAt: deleteField(), inactivatedBy: deleteField() }
        : { active: false, inactiveAt: serverTimestamp(), inactivatedBy: currentUser.name };
      await updateDoc(doc(db, 'users', staff.dbId), statusFields);
      await logSystemAction(
        currentUser.name,
        active ? 'STAFF_REACTIVATED' : 'STAFF_INACTIVATED',
        `${active ? 'Reactivated' : 'Set as inactive'} staff account: ${staff.name} (${staff.userid})`
      );
    } catch (error) {
      console.error(`Failed to ${actionLabel} staff account:`, error);
      alert(`Failed to ${actionLabel} staff account.`);
    }
  };

  const handleAddClaim = async () => {
    if (!claimForm.guestName || !claimForm.icNumber || !claimForm.contactNumber) { alert('Please fill in guest details'); return; }
    try {
      await addDoc(collection(db, "claimDays"), { ...claimForm, recordedBy: currentUser.name, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      logSystemAction(currentUser.name, 'CLAIM_ADD', `Created claim record for guest: ${claimForm.guestName}`); 
      setClaimModal(false); resetClaimForm(); alert('Record added successfully!');
    } catch { alert("Failed to add claim record"); }
  };

  const handleUpdateClaim = async () => {
    if (!editingClaim) return;
    try {
      await updateDoc(doc(db, "claimDays", editingClaim), { ...claimForm, updatedAt: serverTimestamp() });
      logSystemAction(currentUser.name, 'CLAIM_UPDATE', `Updated claim record for guest: ${claimForm.guestName}`); 
      setClaimModal(false); setEditingClaim(null); resetClaimForm(); alert('Record updated successfully!');
    } catch { alert("Failed to update claim record"); }
  };

  const handleDeleteClaim = async (claimId) => {
    const claim = claimDays.find(c => c.id === claimId);
    if (!window.confirm(`Are you sure you want to delete claim record for ${claim?.guestName}?`)) return;
    try { 
      await deleteDoc(doc(db, "claimDays", claimId)); 
      logSystemAction(currentUser.name, 'CLAIM_DELETE', `Deleted claim record for guest: ${claim?.guestName}`); 
      alert('Record deleted!'); 
    } catch { alert("Failed to delete record"); }
  };

  const openEditClaim = (claim) => {
    setClaimForm({ ...claim, usedDates: claim.usedDates || [] });
    setEditingClaim(claim.id); setClaimModal(true);
  };

  const resetClaimForm = () => {
    setClaimForm({ guestName: '', icNumber: '', contactNumber: '', bookingDate: '', roomType: '', payment: '', usedDates: [], balanceClaim: 0, recordedBy: '' });
    setEditingClaim(null);
  };

  const addUsedDate = () => {
    const date = prompt('Enter used date (e.g., 29/1/2026):');
    const roomType = prompt('Enter room type (e.g., deluxe, s/king):');
    const roomNumber = prompt('Enter room number (e.g., 115, 216):');
    const staff = prompt('Enter staff name (e.g., emma/alisya):');
    if (date && roomType && roomNumber && staff) {
      setClaimForm(prev => ({ ...prev, usedDates: [...prev.usedDates, { date, roomType, roomNumber, staff }] }));
    }
  };

  const removeUsedDate = (index) => {
    setClaimForm(prev => ({ ...prev, usedDates: prev.usedDates.filter((_, i) => i !== index) }));
  };

  // --- PRINT AUDIT FUNCTION ---
  const handlePrintAudit = () => {
    const printWindow = window.open('', '', 'height=600,width=800');
    
    // Generate Report Content
    let reportContent = `
      <html>
        <head>
          <title>System Audit Report</title>
          <style>
            body { font-family: sans-serif; color: #333; padding: 20px; }
            h1 { color: #1e3a8a; text-align: center; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 0.9rem; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background-color: #f4f4f4; color: #111; }
            tr:nth-child(even) { background-color: #fafafa; }
            .timestamp { white-space: nowrap; color: #555; }
          </style>
        </head>
        <body>
          <h1>Aladdin Dream Hotel - System Audit Report</h1>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Action Type</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
    `;

    filteredAuditLogs.forEach(log => {
      reportContent += `
        <tr>
          <td class="timestamp">${formatDate(log.timestamp)} ${formatTime(log.timestamp)}</td>
          <td><b>${log.user}</b></td>
          <td>${log.action}</td>
          <td>${log.details}</td>
        </tr>
      `;
    });

    if (filteredAuditLogs.length === 0) {
      reportContent += `<tr><td colspan="4" style="text-align:center;">No records found for these filters.</td></tr>`;
    }

    reportContent += `
            </tbody>
          </table>
          <p style="text-align:center; font-size:0.8rem; color:#888; margin-top:30px;">
            Generated on: ${new Date().toLocaleString('en-MY')}
          </p>
        </body>
      </html>
    `;

    printWindow.document.write(reportContent);
    printWindow.document.close();
    printWindow.focus();
    
    // Slight delay to allow styles to load before print dialog pops up
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // --- DATA PROCESSING ---
  const filteredAttSessions = allAttSessions.filter(s => {
    let match = true;
    const refTime = s.inTime || s.outTime;
    if (refTime) {
      const d = refTime.toDate ? refTime.toDate() : new Date(refTime);
      
      if (attFilterMonth) {
        const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (mStr !== attFilterMonth) match = false;
      }
      
      if (attFilterStartDate) {
        const startD = new Date(attFilterStartDate);
        startD.setHours(0,0,0,0);
        if (d < startD) match = false;
      }
      if (attFilterEndDate) {
        const endD = new Date(attFilterEndDate);
        endD.setHours(23,59,59,999);
        if (d > endD) match = false;
      }
    }

    if (attFilterUser && s.userId !== attFilterUser) match = false;

    if (attFilterSearch) {
      const q = attFilterSearch.toLowerCase();
      const matchName = s.userName.toLowerCase().includes(q);
      const matchId = s.userId.toLowerCase().includes(q);
      if (!matchName && !matchId) match = false;
    }

    return match;
  }).sort((a, b) => {
    const tA = a.inTime ? (a.inTime.toDate ? a.inTime.toDate() : new Date(a.inTime)) : new Date(0);
    const tB = b.inTime ? (b.inTime.toDate ? b.inTime.toDate() : new Date(b.inTime)) : new Date(0);
    return tB - tA;
  });

  const attStaffSummaryMap = {};
  let totalFilteredDurationMs = 0;

  filteredAttSessions.forEach(s => {
    if (s.durationMs) totalFilteredDurationMs += s.durationMs;

    if (!attStaffSummaryMap[s.userId]) {
      attStaffSummaryMap[s.userId] = {
        userId: s.userId,
        userName: s.userName,
        datesWorkedSet: new Set(),
        totalDurationMs: 0,
        sessionCount: 0
      };
    }
    const dStr = s.inTime ? formatDate(s.inTime) : (s.outTime ? formatDate(s.outTime) : '');
    if (dStr) attStaffSummaryMap[s.userId].datesWorkedSet.add(dStr);
    attStaffSummaryMap[s.userId].totalDurationMs += (s.durationMs || 0);
    attStaffSummaryMap[s.userId].sessionCount += 1;
  });

  const attStaffSummaryData = Object.values(attStaffSummaryMap).map(st => ({
    ...st,
    daysWorked: st.datesWorkedSet.size,
    totalHoursStr: formatDuration(st.totalDurationMs)
  })).sort((a, b) => b.totalDurationMs - a.totalDurationMs);

  const workingCount = attRosterStatus.filter(r => r.status === 'working').length;
  const offDutyCount = attRosterStatus.filter(r => r.status === 'off_duty').length;
  const onLeaveCount = attRosterStatus.filter(r => r.status === 'on_leave').length;

  const filteredRooms = rooms.filter(r => String(r.id).toLowerCase().includes(roomSearch.toLowerCase()));
  const pendingLeavesCount = leaves.filter(l => l.status === 'pending').length;
  const pendingPasswordResetCount = users.filter(u => u.passwordResetStatus === 'pending').length;
  const myPendingRequests = requests.filter(r => r.receiverId === currentUser?.dbId && r.status === 'pending').length;
  const unreadAdminAlerts = adminAlerts.filter(adminAlert => !adminAlert.acknowledged);
  const activeAdminAlert = unreadAdminAlerts[0] || null;

  const processedTickets = [...tickets].filter(t => t.roomId.toString().toLowerCase().includes(ticketSearch.toLowerCase())).sort((a, b) => {
      const dateA = a.createdAt ? a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt) : new Date(0);
      const dateB = b.createdAt ? b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt) : new Date(0);
      const roomA = parseInt(a.roomId) || 0;
      const roomB = parseInt(b.roomId) || 0;
      switch (ticketSort) {
        case 'date-desc': return dateB - dateA;
        case 'date-asc': return dateA - dateB;
        case 'room-asc': return roomA - roomB;
        case 'room-desc': return roomB - roomA;
        default: return 0;
      }
  });

  const currentMonthName = currentTime.toLocaleString('en-MY', { month: 'long', year: 'numeric' }).toUpperCase();
  const currentMonthIndex = currentTime.getMonth();
  const currentYear = currentTime.getFullYear();
  const currentMonthInventory = inventory.filter(inv => {
      const d = inv.createdAt ? (inv.createdAt.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt)) : new Date();
      return d.getMonth() === currentMonthIndex && d.getFullYear() === currentYear;
  });

  const groupedStock = {};
  stockItems.forEach(item => {
      const cat = item.category || 'General';
      const sub = item.subcategory || '';
      if (!groupedStock[cat]) groupedStock[cat] = {};
      if (!groupedStock[cat][sub]) groupedStock[cat][sub] = [];
      groupedStock[cat][sub].push(item);
  });

  const todayDateString = currentTime.toLocaleDateString('en-MY');
  const todaysAttendanceMap = {};
  attendance.forEach(a => {
      const d = a.timestamp ? (a.timestamp.toDate ? a.timestamp.toDate() : new Date(a.timestamp)) : new Date();
      if (d.toLocaleDateString('en-MY') === todayDateString) {
          if (!todaysAttendanceMap[a.userId]) todaysAttendanceMap[a.userId] = { userName: a.userName, inTime: null, outTime: null, inRaw: 0, outRaw: 0 };
          const timeMs = d.getTime();
          if (a.type === 'in') {
              if (!todaysAttendanceMap[a.userId].inRaw || timeMs < todaysAttendanceMap[a.userId].inRaw) {
                  todaysAttendanceMap[a.userId].inRaw = timeMs; todaysAttendanceMap[a.userId].inTime = formatTime(a.timestamp);
              }
          } else if (a.type === 'out') {
              if (!todaysAttendanceMap[a.userId].outRaw || timeMs > todaysAttendanceMap[a.userId].outRaw) {
                  todaysAttendanceMap[a.userId].outRaw = timeMs; todaysAttendanceMap[a.userId].outTime = formatTime(a.timestamp);
              }
          }
      }
  });
  const todaysAttendanceData = Object.values(todaysAttendanceMap).sort((a, b) => {
    if (!a.inRaw) return 1; if (!b.inRaw) return -1; return a.inRaw - b.inRaw;
  });

  const oneWeekAgo = new Date(currentTime);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const pendingLaundry = laundry.filter(l => l.status === 'pending');
  const historyLaundry = laundry.filter(l => {
      if (l.status !== 'received') return false;
      const d = l.createdAt ? (l.createdAt.toDate ? l.createdAt.toDate() : new Date(l.createdAt)) : new Date();
      return d >= oneWeekAgo;
  });

  // --- FILTER AUDIT LOGS ---
  const filteredAuditLogs = auditLogs.filter(log => {
      let match = true;
      if (auditFilterMonth) {
          const logDate = log.timestamp ? (log.timestamp.toDate ? log.timestamp.toDate() : new Date(log.timestamp)) : new Date();
          const logMonthStr = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}`;
          if (logMonthStr !== auditFilterMonth) match = false;
      }
      if (auditFilterUser && log.user !== auditFilterUser) match = false;
      if (auditFilterAction && log.action !== auditFilterAction) match = false;
      return match;
  });

  const uniqueAuditUsers = [...new Set(auditLogs.map(l => l.user))].sort();
  const uniqueAuditActions = [...new Set(auditLogs.map(l => l.action))].sort();

  if (!isSessionReady) {
    return (
      <div className="app-container">
        <div className="login-container">
          <div className="login-card">
            <i className="fa-solid fa-spinner fa-spin" style={{fontSize:'2rem', color:'#2563eb'}}></i>
            <p style={{color:'#666', marginBottom:0}}>Checking session...</p>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER LOGIN ---
  if (!currentUser) {
    return (
      <div className="app-container">
        <div className="login-container">
          {showForgotPassword ? (
            <form className="login-card" onSubmit={handleForgotPassword}>
              <div className="login-icon"><i className="fa-solid fa-key"></i></div>
              <h1>Forgot Password</h1>
              <p className="forgot-password-instructions">
                Enter your User ID. An administrator will be notified to reset your password.
              </p>
              <label className="login-field-label" htmlFor="reset-user-id">User ID</label>
              <input
                id="reset-user-id"
                placeholder="Enter your User ID"
                value={resetUserId}
                onChange={e => setResetUserId(e.target.value)}
                autoComplete="username"
                autoFocus
                required
              />
              {resetFeedback.message && (
                <p className={`reset-feedback ${resetFeedback.type}`} role="status">
                  <i className={`fa-solid ${resetFeedback.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
                  {resetFeedback.message}
                </p>
              )}
              {resetFeedback.type !== 'success' && (
                <button type="submit" className="btn blue login-submit-btn" disabled={isResetSubmitting}>
                  {isResetSubmitting ? <><i className="fa-solid fa-spinner fa-spin"></i> Sending...</> : <><i className="fa-solid fa-paper-plane"></i> Send Reset Request</>}
                </button>
              )}
              <button type="button" className="login-link-btn" onClick={closeForgotPassword}>
                <i className="fa-solid fa-arrow-left"></i> Back to Login
              </button>
            </form>
          ) : (
            <form className="login-card" onSubmit={handleLogin}>
              <h1><i className="fa-solid fa-hotel"></i> Aladdin Dream Hotel</h1>
              <h3 style={{color:'#666', marginBottom:'20px'}}>Staff Login</h3>
              <input placeholder="User ID" value={loginId} onChange={e => setLoginId(e.target.value)} autoComplete="username" required />
              <input type="password" placeholder="Password" value={loginPass} onChange={e => setLoginPass(e.target.value)} autoComplete="current-password" required />
              {loginError && <p className="error-msg">{loginError}</p>}
              <button type="submit" className="btn blue login-submit-btn">Login</button>
              <button type="button" className="login-link-btn" onClick={openForgotPassword}>Forgot Password?</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // New and existing accounts must complete the required profile fields before
  // any operational data or navigation is made available.
  if (!isProfileComplete(currentUser)) {
    return (
      <div className="profile-setup-page">
        <div className="profile-setup-card">
          <div className="profile-setup-header">
            <div className="profile-setup-logo"><i className="fa-solid fa-hotel"></i></div>
            <span className="profile-required-badge"><i className="fa-solid fa-circle-exclamation"></i> Required setup</span>
            <h1>Complete your profile</h1>
            <p>Please provide your email address and date of birth before accessing the hotel portal.</p>
          </div>

          <form className="profile-setup-form" onSubmit={handleUpdateProfile}>
            <div className="profile-setup-user">
              <div className="profile-avatar small" aria-hidden="true">
                {currentUser.name?.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'U'}
              </div>
              <div>
                <strong>{currentUser.name}</strong>
                <span>{currentUser.userid} · {currentUser.role}</span>
              </div>
            </div>

            <input name="fullName" type="hidden" value={currentUser.name || ''} readOnly />

            <label>
              <span>Email address <em>Required</em></span>
              <div className="profile-input-wrap"><i className="fa-solid fa-envelope"></i><input name="email" type="email" defaultValue={currentUser.email || ''} placeholder="name@example.com" autoComplete="email" autoFocus required /></div>
            </label>

            <div className="profile-birthdate-field">
              <span>Date of birth <em>Required</em></span>
              <DateOfBirthField defaultValue={currentUser.dateOfBirth || ''} idPrefix="required-profile-birth-date" />
            </div>

            <label>
              <span>Phone number <small>Optional</small></span>
              <div className="profile-input-wrap"><i className="fa-solid fa-phone"></i><input name="phone" type="tel" defaultValue={currentUser.phone || ''} placeholder="e.g. 0123456789" autoComplete="tel" /></div>
            </label>

            {profileFeedback.message && (
              <p className={`reset-feedback ${profileFeedback.type}`} role="status">
                <i className={`fa-solid ${profileFeedback.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
                {profileFeedback.message}
              </p>
            )}

            <button type="submit" className="btn blue profile-continue-btn" disabled={isProfileSaving}>
              {isProfileSaving ? <><i className="fa-solid fa-spinner fa-spin"></i> Saving...</> : <>Save & Continue <i className="fa-solid fa-arrow-right"></i></>}
            </button>
            <button type="button" className="profile-setup-logout" onClick={handleLogout}>
              <i className="fa-solid fa-right-from-bracket"></i> Sign out
            </button>
          </form>

          <p className="profile-privacy-note"><i className="fa-solid fa-lock"></i> Your personal information is stored securely in your staff profile.</p>
        </div>
      </div>
    );
  }

  // --- RENDER APP ---
  return (
    <div className="app-container">
      {currentUser.role === 'admin' && activeAdminAlert && (
        <aside className="admin-away-alert" role="alert" aria-live="assertive">
          <div className="admin-away-alert-icon"><i className="fa-solid fa-location-dot"></i></div>
          <div className="admin-away-alert-content">
            <div className="admin-away-alert-heading">
              <strong>Away Punch Alert</strong>
              {unreadAdminAlerts.length > 1 && <span>{unreadAdminAlerts.length} pending</span>}
            </div>
            <p>
              <strong>{activeAdminAlert.staffName}</strong> punched <strong>{String(activeAdminAlert.clockType).toUpperCase()}</strong> away from the hotel.
            </p>
            <small>{activeAdminAlert.locationLabel || 'Away'} · {formatTime(activeAdminAlert.createdAt)}</small>
            <div className="admin-away-alert-actions">
              <button type="button" onClick={() => setView('ATT_REPORT')}>View Attendance</button>
              <button
                type="button"
                className="acknowledge"
                disabled={acknowledgingAlertId === activeAdminAlert.id}
                onClick={() => acknowledgeAdminAlert(activeAdminAlert)}
              >
                {acknowledgingAlertId === activeAdminAlert.id ? 'Saving...' : 'Acknowledge'}
              </button>
            </div>
          </div>
        </aside>
      )}
      <header className="header">
        <div className="header-content">
          <div className="header-top">
            <div className="hotel-brand">
              <span className="brand-icon"><i className="fa-solid fa-hotel"></i></span>
              <div>
                <h1>Aladdin Dream Hotel</h1>
                <span className="brand-subtitle">Hotel Management System</span>
              </div>
            </div>
            <div className="header-actions">
             <button type="button" className="user-profile" onClick={openProfilePortal} title="Open profile">
               <i className="fa-solid fa-circle-user" style={{color: '#ddbd88'}}></i>
               <span>{currentUser.name}</span>
             </button>
              <button onClick={handleLogout} className="logout-btn" title="Logout">
                <i className="fa-solid fa-right-from-bracket"></i> <span>Logout</span>
              </button>
            </div>
          </div>
          <div className="tabs">
            {Object.keys(ICONS).map(v => {
              if (v === 'ATT_REPORT' && currentUser.role !== 'admin') return null;
              return (
                <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>
                  <i className={ICONS[v].icon}></i> <span>{ICONS[v].label}</span>
                  {v === 'REQ' && myPendingRequests > 0 && <span className="nav-badge">{myPendingRequests}</span>}
                </button>
              );
            })}
            {currentUser.role === 'admin' && (
              <button className={view === 'ADMIN' ? 'active' : ''} onClick={() => setView('ADMIN')}>
                <i className="fa-solid fa-lock"></i> <span>Admin</span>
                {(pendingLeavesCount + pendingPasswordResetCount + unreadAdminAlerts.length) > 0 && (
                  <span className="nav-badge">{pendingLeavesCount + pendingPasswordResetCount + unreadAdminAlerts.length}</span>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* --- VIEW: ROOMS (GRID) --- */}
      {view === 'ROOMS' && (
        <div className="dashboard">
          <div className="floor-section">
            <h2 className="floor-title">
              <span><i className="fa-solid fa-bed"></i> Room Status</span>
              <input className="search-bar" placeholder="Search Room..." value={roomSearch} onChange={e => setRoomSearch(e.target.value)} />
            </h2>
            
            {[1, 2, 3, 'Public', 'Store'].map(floorNum => {
               let floorRooms = [];
               if (floorNum === 'Store') {
                   // Show any room with type 'STORE' or storeroom IDs like 1A, 2A, etc
                   floorRooms = filteredRooms.filter(r => r.type === 'STORE' || /^\d[A-Z]$/.test(r.id)).sort((a,b) => String(a.id).localeCompare(String(b.id), undefined, {numeric: true}));
               } else if (floorNum === 'Public') {
                   // Show rooms where floor is 'Public' or type contains 'LOBBY' or 'LEVEL'
                   floorRooms = filteredRooms.filter(r => String(r.floor) === 'Public' || r.type === 'LOBBY' || r.type?.includes('LEVEL')).sort((a,b) => String(a.id).localeCompare(String(b.id), undefined, {numeric: true}));
               } else {
                   // Show rooms where floor matches the number (as string or number) and is NOT a storeroom
                   floorRooms = filteredRooms.filter(r => {
                     const roomFloor = String(r.floor);
                     const targetFloor = String(floorNum);
                     const isStoreroom = r.type === 'STORE' || /^\d[A-Z]$/.test(r.id);
                     return roomFloor === targetFloor && !isStoreroom;
                   }).sort((a,b) => String(a.id).localeCompare(String(b.id), undefined, {numeric: true}));
               }
               
               if (floorRooms.length === 0) return null;
               
               let sectionTitle = `Level ${floorNum}`;
               if (floorNum === 'Public') sectionTitle = 'Public Areas & Facilities';
               if (floorNum === 'Store') sectionTitle = 'Storerooms';
               
               return (
                 <div key={floorNum} style={{marginBottom:'20px'}}>
                   <h3 style={{fontSize:'1rem', color:'#666', borderBottom:'1px solid #eee'}}>{sectionTitle}</h3>
                   <div className="room-grid">
                     {floorRooms.map(room => (
                        <div key={room.id} className={`room-card ${getStatusColor(room.status)}`} onClick={() => setSelectedRoom(room)}>
                          {room.hasKey && <i className="fa-solid fa-key" style={{position: 'absolute', top: '6px', left: '6px', color: '#fbbf24', fontSize: '0.9rem', filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.4))'}}></i>}
                          {openTicketCountByRoom[String(room.id)] > 0 && (
                            <span className="room-issue-badge" title={`${openTicketCountByRoom[String(room.id)]} unresolved issue${openTicketCountByRoom[String(room.id)] > 1 ? 's' : ''}`}>
                              {openTicketCountByRoom[String(room.id)]}
                            </span>
                          )}
                          <div className="room-number" style={{fontSize: String(room.id).length > 5 ? '1rem' : '1.4rem'}}>{room.id}</div>
                          <div className="room-type">{room.type}</div>
                          {room.status === 'maintenance' && <div style={{fontSize:'0.6rem', marginTop:'2px'}}>MAINT</div>}
                        </div>
                     ))}
                   </div>
                 </div>
               );
             })}
          </div>
        </div>
      )}

      {/* --- VIEW: TICKETS --- */}
      {view === 'TICKETS' && (
        <div className="dashboard">
          <div className="list-view">
            <h2><i className="fa-solid fa-triangle-exclamation"></i> Active Issues</h2>
            <div className="scroll-pane scroll-pane-tall">
              {tickets.filter(t => t.status === 'open').length === 0 ? <p style={{textAlign:'center', color:'#999'}}>No active issues.</p> :
                tickets.filter(t => t.status === 'open').map(ticket => (
                  <div key={ticket.id} className="ticket-card open">
                    <div>
                      <strong>Room {ticket.roomId}</strong> - <span style={{color:'#666'}}>{ticket.issue}</span>
                      <div style={{fontSize:'0.8rem', color:'#888', marginTop:'5px'}}>Reported by <b>{ticket.reportedBy || 'Unknown'}</b> on {formatTime(ticket.createdAt)}</div>
                    </div>
                    <button onClick={() => resolveTicket(ticket)} className="btn blue">Resolve</button>
                  </div>
                ))
              }
            </div>
          </div>

          <div className="list-view">
            <h2><i className="fa-solid fa-clock-rotate-left"></i> Resolved History</h2>
            <div className="scroll-pane scroll-pane-tall">
              {tickets.filter(t => t.status === 'resolved').map(ticket => (
                  <div key={ticket.id} className="ticket-card resolved">
                    <div>
                      <strong>Room {ticket.roomId}</strong> - {ticket.issue}
                      <div style={{fontSize:'0.8rem', color:'#666', marginTop:'5px'}}>
                          Reported by <b>{ticket.reportedBy || 'Unknown'}</b> on {formatDate(ticket.createdAt)}<br/>
                          Fixed by <b>{ticket.resolvedBy || 'Unknown'}</b> on {formatTime(ticket.resolvedAt)}
                      </div>
                    </div>
                    <div style={{color:'green', fontWeight:'bold', fontSize:'0.8rem'}}>FIXED</div>
                  </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- VIEW: ITEMS INVENTORY --- */}
      {view === 'ITEMS' && (
        <div className="dashboard">
          <div className="floor-section">
            <h2 className="floor-title"><i className="fa-solid fa-cart-plus"></i> Request New Item</h2>
            <form onSubmit={handleItemRequest} style={{display:'flex', gap:'10px', flexWrap:'wrap'}}>
              <select name="department" required style={{flex:'1', minWidth:'150px'}}>
                <option value="">-- Department --</option>
                <option value="Frontdesk">Frontdesk</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Housekeeping">Housekeeping</option>
              </select>
              <input name="item" placeholder="Item Name" required style={{flex:'2', minWidth:'200px'}} />
              <input name="qty" placeholder="Qty (Opt)" style={{flex:'1', minWidth:'100px'}} />
              <input name="remark" placeholder="Remark (Opt)" style={{flex:'2', minWidth:'150px'}} />
              <button type="submit" className="btn blue">Add List</button>
            </form>
          </div>

          <div className="list-view">
            <h2 style={{textAlign: 'center', marginBottom: '25px'}}>REQUEST ITEM {currentMonthName}</h2>
            <div className="scroll-pane scroll-pane-tall" style={{paddingRight: '15px'}}>
                {['Frontdesk', 'Maintenance', 'Housekeeping'].map(dept => {
                    const deptItems = currentMonthInventory.filter(i => i.department === dept);
                    if(deptItems.length === 0) return null;
                    return (
                        <div key={dept} className="inv-group">
                            <div className="inv-dept-title">{dept}</div>
                            {deptItems.map((item, idx) => (
                                <div key={item.id} className="inv-item">
                                    <span style={{color:'#888', width:'25px'}}>{idx + 1})</span>
                                    <div className="inv-content">
                                        <span className={item.bought ? "inv-bought" : ""}>{item.item} {item.qty && ` - ${item.qty}`}</span>
                                        {item.remark && <span className="inv-note">Note: {item.remark}</span>}
                                        {item.bought && item.buyRemark && <span className="inv-remark">- {item.buyRemark} ✅</span>}
                                        {item.bought && !item.buyRemark && <span className="inv-remark">✅</span>}
                                        {item.bought && item.boughtBy && (
                                            <span style={{display: 'block', fontSize: '0.75rem', color: '#999', marginTop: '2px'}}>
                                                Checked by {item.boughtBy} on {formatTime(item.boughtAt)}
                                            </span>
                                        )}
                                    </div>
                                    <input type="checkbox" className="inv-checkbox" checked={item.bought} onChange={() => toggleItemBought(item)} />
                                </div>
                            ))}
                        </div>
                    );
                })}
                {currentMonthInventory.length === 0 && <p style={{textAlign:'center', color:'#999'}}>No items requested this month.</p>}
            </div>
          </div>
        </div>
      )}

      {/* --- VIEW: LAUNDRY & CATEGORIZED STOCK --- */}
      {view === 'LAUNDRY' && (
        <div className="dashboard">
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px'}}>
              
              <div className="floor-section" style={{margin:0}}>
                <h2 className="floor-title">
                  <span><i className="fa-solid fa-truck-fast"></i> Send Laundry</span>
                </h2>
                <div className="scroll-pane scroll-pane-tall" style={{paddingRight: '10px'}}>
                    <div className="laundry-grid">
                        {LAUNDRY_ITEMS.map(itemName => (
                            <div key={itemName} className="laundry-input-card">
                                <div style={{display:'flex', justifyContent:'space-between', alignItems:'start', marginBottom:'5px'}}>
                                  <label style={{flex: 1, whiteSpace: 'normal', wordWrap: 'break-word'}}>
                                    {itemName} {laundryItemDetails[itemName] ? <span style={{color:'#0056b3'}}>({laundryItemDetails[itemName]})</span> : ''}
                                  </label>
                                  {currentUser.role === 'admin' && (
                                    <button onClick={() => handleUpdateLaundryItemDetails(itemName)} style={{background:'none', border:'none', color:'#3b82f6', cursor:'pointer', fontSize:'0.75rem', padding: '2px 4px'}} title="Edit opening stock">
                                      <i className="fa-solid fa-edit"></i>
                                    </button>
                                  )}
                                </div>
                                <input type="number" min="0" placeholder="0" value={laundryForm[itemName] || ''} onChange={(e) => handleLaundryChange(itemName, e.target.value)} />
                            </div>
                        ))}
                    </div>
                </div>
                <button onClick={handleSendLaundry} className="btn blue" style={{width: '100%', justifyContent: 'center', marginTop: '15px'}}>Submit Laundry Batch</button>
              </div>

              <div className="floor-section" style={{margin:0}}>
                <h2 className="floor-title">
                  <span><i className="fa-solid fa-box"></i> Hotel Stock</span>
                  {currentUser.role === 'admin' && (
                    <button className="btn green" style={{fontSize:'0.8rem', padding:'6px 12px'}} onClick={handleAddStock}>
                      <i className="fa-solid fa-plus"></i> Add Item
                    </button>
                  )}
                </h2>
                <div className="scroll-pane scroll-pane-tall" style={{paddingRight: '10px'}}>
                    {currentUser.role === 'admin' && (
                      <form onSubmit={handleAddStock} style={{display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'20px', paddingBottom:'20px', borderBottom:'2px solid #eee'}}>
                        <input name="category" placeholder="Category (e.g. Toiletries)" required style={{flex:'1', minWidth:'130px'}} />
                        <input name="subcategory" placeholder="Sub-category (Opt)" style={{flex:'1', minWidth:'130px'}} />
                        <input name="name" placeholder="Item Name" required style={{flex:'2', minWidth:'150px'}} />
                        <input name="quantity" placeholder="Qty" type="number" required style={{width:'80px', flex:'none'}} />
                        <button type="submit" className="btn green" style={{flex:'1', justifyContent:'center'}}>Add</button>
                      </form>
                    )}
                    {stockItems.length === 0 ? <p style={{textAlign:'center', color:'#999', padding:'20px'}}>No stock items configured.</p> : (
                      <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                        {Object.keys(groupedStock).sort().map(cat => (
                            <div key={cat}>
                                <h3 style={{fontSize: '1rem', color: '#1e3a8a', borderBottom: '2px solid #eff6ff', paddingBottom: '4px', marginBottom: '10px', textTransform:'uppercase'}}>
                                  <i className="fa-solid fa-folder-open" style={{marginRight:'8px'}}></i>{cat}
                                </h3>
                                {Object.keys(groupedStock[cat]).sort().map(sub => (
                                    <div key={sub} style={{marginBottom: '12px', paddingLeft: '10px'}}>
                                        {sub && <h4 style={{fontSize: '0.85rem', color: '#6b7280', margin: '0 0 8px 0', textTransform: 'uppercase'}}><i className="fa-solid fa-angle-right" style={{marginRight:'5px'}}></i>{sub}</h4>}
                                        <div style={{display:'flex', flexDirection:'column', gap:'6px', paddingLeft: sub ? '15px' : '0'}}>
                                          {groupedStock[cat][sub].map((item) => (
                                              <div key={item.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:'6px'}}>
                                                  <div style={{display:'flex', alignItems:'center', gap:'10px', flex:1}}><span style={{fontWeight:'bold', color:'#333'}}>{item.name}</span></div>
                                                  <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                                                    <span style={{fontWeight:'bold', color:'#3b82f6', fontSize:'1.1rem', background:'#eff6ff', padding:'2px 8px', borderRadius:'12px'}}>{item.quantity}</span>
                                                    {currentUser.role === 'admin' && (
                                                      <div style={{display:'flex', gap:'5px', borderLeft:'1px solid #ddd', paddingLeft:'10px'}}>
                                                        <button onClick={() => openEditStock(item)} className="btn blue" style={{fontSize:'0.75rem', padding:'4px 8px'}}><i className="fa-solid fa-edit"></i></button>
                                                        <button onClick={() => handleDeleteStock(item.id)} className="btn red" style={{fontSize:'0.75rem', padding:'4px 8px'}}><i className="fa-solid fa-trash"></i></button>
                                                      </div>
                                                    )}
                                                  </div>
                                              </div>
                                          ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                      </div>
                    )}
                </div>
              </div>
          </div>

          <div className="floor-section" style={{marginTop: '20px'}}>
            <h2 className="floor-title"><i className="fa-solid fa-spinner"></i> Pending Received Laundry</h2>
            <div className="scroll-pane">
                {pendingLaundry.length === 0 ? <p style={{textAlign:'center', color:'#999', padding:'20px'}}>No pending laundry batches.</p> : 
                    pendingLaundry.map(batch => (
                        <div key={batch.id} className="req-card" style={{borderLeftColor: '#f59e0b'}}>
                            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px'}}>
                                <strong>Sent by: {batch.sentBy}</strong>
                                <span style={{fontSize:'0.75rem', color:'#666'}}>{formatTime(batch.createdAt)}</span>
                            </div>
                            <div style={{fontSize:'0.85rem', color:'#555', marginBottom:'15px'}}>Contains {Object.keys(batch.items).length} types of items.</div>
                            <button className="btn green" style={{width:'100%', justifyContent:'center'}} onClick={() => setReceiveLaundryModal(JSON.parse(JSON.stringify(batch)))}>
                                <i className="fa-solid fa-clipboard-check"></i> Verify & Receive
                            </button>
                        </div>
                    ))
                }
            </div>
          </div>

          <div className="floor-section" style={{marginTop: '20px'}}>
             <h2 className="floor-title"><i className="fa-solid fa-clock-rotate-left"></i> 7-Day Laundry History</h2>
             <div className="scroll-pane scroll-pane-tall">
                {historyLaundry.length === 0 ? <p style={{textAlign:'center', color:'#999'}}>No history in the last 7 days.</p> : 
                    historyLaundry.map(batch => (
                        <div key={batch.id} className="req-card" style={{borderLeftColor: '#10b981'}}>
                            <div style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #eee', paddingBottom:'8px', marginBottom:'10px'}}>
                                <div>
                                    <span style={{fontSize:'0.8rem', color:'#666', display:'block'}}>Sent: {batch.sentBy} ({formatTime(batch.createdAt)})</span>
                                    <span style={{fontSize:'0.8rem', color:'#10b981', display:'block', fontWeight:'bold'}}>Received: {batch.receivedBy} ({formatTime(batch.receivedAt)})</span>
                                </div>
                            </div>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px'}}>
                                {Object.entries(batch.items).map(([itemName, data]) => (
                                    <div key={itemName} style={{fontSize:'0.8rem', padding:'4px', color: data.status === 'incorrect' ? '#ef4444' : '#333'}}>
                                        <strong>{itemName}:</strong> Sent {data.sentQty} 
                                        {data.status === 'incorrect' && <span> (Issue: {data.remark})</span>}
                                        {data.status === 'correct' && <span> ✓</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                }
             </div>
          </div>
        </div>
      )}

      {/* --- VIEW: DEPOSITS --- */}
      {view === 'DEPOSIT' && (
        <div className="dashboard">
          <div className="floor-section">
            <h2 className="floor-title"><i className="fa-solid fa-money-bill-wave"></i> Room Deposit Collected</h2>
            <form onSubmit={handleAddDeposit} style={{display:'flex', gap:'10px', flexWrap:'wrap', marginBottom: '20px', background: '#f9fafb', padding: '15px', borderRadius: '8px', border: '1px solid #eee'}}>
              <select name="roomNo" required style={{flex:'1', minWidth:'120px', margin:0}}>
                <option value="">-- Select Room --</option>
                {rooms
                  .filter(r => r.type !== 'STORE' && r.floor !== 'Public')
                  .sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, {numeric: true}))
                  .map(room => (
                    <option key={room.id} value={room.id}>Room {room.id}</option>
                  ))
                }
              </select>
              <input name="amount" type="number" placeholder="Amount (RM)" required style={{flex:'1', minWidth:'120px', margin:0}} />
              <input 
                  name="checkInDate" 
                  type="date" 
                  required 
                  style={{flex:'1', minWidth:'150px', cursor:'pointer', margin:0}} 
                  onClick={(e) => e.target.showPicker && e.target.showPicker()}
              />
              <button type="submit" className="btn blue" style={{flex: '1', minWidth: '120px', justifyContent: 'center'}}>Add Deposit</button>
            </form>

            <div className="admin-table-container scroll-pane scroll-pane-tall">
              <table>
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Deposit (RM)</th>
                    <th>Check-in Date</th>
                    <th>Collected On</th>
                    <th>Recorded By</th>
                    {currentUser.role === 'admin' && <th>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {deposits.length === 0 ? (
                    <tr><td colSpan={currentUser.role === 'admin' ? 6 : 5} style={{textAlign:'center', color:'#999'}}>No deposits recorded.</td></tr>
                  ) : (
                    deposits.map(dep => (
                      <tr key={dep.id}>
                        <td><strong>{dep.roomNo}</strong></td>
                        <td><span style={{color: '#10b981', fontWeight: 'bold'}}>RM {dep.amount}</span></td>
                        <td>{dep.checkInDate}</td>
                        <td style={{fontSize: '0.85rem', color: '#666'}}>{formatDate(dep.createdAt)}</td>
                        <td>{dep.recordedBy}</td>
                        {currentUser.role === 'admin' && (
                          <td>
                             <button className="btn red" style={{padding: '4px 8px', fontSize: '0.75rem'}} onClick={() => handleDeleteDeposit(dep.id, dep.roomNo)}>
                               <i className="fa-solid fa-trash"></i>
                             </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- VIEW: VERIFICATION (NEW) --- */}
      {view === 'VERIFY' && (
        <div className="dashboard">
          <div className="floor-section">
            <h2 className="floor-title"><i className="fa-solid fa-file-invoice-dollar"></i> Online Payment Verification</h2>
            <form onSubmit={handleAddVerification} style={{display:'flex', gap:'10px', flexWrap:'wrap', marginBottom: '20px', background: '#f9fafb', padding: '15px', borderRadius: '8px', border: '1px solid #eee'}}>
              <input 
                  name="paymentDate" 
                  type="date" 
                  required 
                  style={{flex:'1', minWidth:'130px', cursor:'pointer', margin:0}} 
                  onClick={(e) => e.target.showPicker && e.target.showPicker()}
              />
              <input 
                  name="paymentTime" 
                  type="time" 
                  required 
                  style={{flex:'1', minWidth:'110px', cursor:'pointer', margin:0}} 
                  onClick={(e) => e.target.showPicker && e.target.showPicker()}
              />
              <input name="refId" placeholder="Last 4 Digits Ref (e.g. 1234)" maxLength="4" required style={{flex:'1', minWidth:'150px', margin:0}} />
              <input name="amount" type="number" step="0.01" placeholder="Amount (RM)" required style={{flex:'1', minWidth:'120px', margin:0}} />
              
              <button type="submit" className="btn blue" style={{flex: '1', minWidth: '120px', justifyContent: 'center'}}>Submit Verify</button>
            </form>

            <div className="admin-table-container scroll-pane scroll-pane-tall">
              <table>
                <thead>
                  <tr>
                    <th>Payment Date & Time</th>
                    <th>Ref ID (Last 4)</th>
                    <th>Amount (RM)</th>
                    <th>Recorded By</th>
                    <th>Submitted On</th>
                    <th>Status</th>
                    {currentUser.role === 'admin' && <th>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {verifications.length === 0 ? (
                    <tr><td colSpan={currentUser.role === 'admin' ? 7 : 6} style={{textAlign:'center', color:'#999'}}>No verification records.</td></tr>
                  ) : (
                    verifications.map(v => (
                      <tr key={v.id}>
                        <td><strong>{v.paymentDate}</strong> at {v.paymentTime}</td>
                        <td>Ref: {v.refId}</td>
                        <td><span style={{color: '#10b981', fontWeight: 'bold'}}>RM {v.amount}</span></td>
                        <td>{v.recordedBy}</td>
                        <td style={{fontSize: '0.85rem', color: '#666'}}>{formatDate(v.createdAt)} <br/> {formatTime(v.createdAt)}</td>
                        <td>
                            {currentUser.role === 'admin' ? (
                               <button 
                                  onClick={() => toggleVerificationStatus(v)}
                                  className={`btn ${v.status === 'verified' ? 'green' : 'orange'}`} 
                                  style={{padding: '4px 8px', fontSize: '0.75rem', width: '80px', justifyContent:'center'}}
                               >
                                 {v.status === 'verified' ? 'Verified' : 'Pending'}
                               </button>
                            ) : (
                               <span className={`badge ${v.status === 'verified' ? 'green' : 'orange'}`} style={{fontSize:'0.75rem', padding:'4px 8px'}}>
                                  {v.status === 'verified' ? 'Verified' : 'Pending'}
                               </span>
                            )}
                        </td>
                        {currentUser.role === 'admin' && (
                          <td>
                             <button className="btn red" style={{padding: '4px 8px', fontSize: '0.75rem'}} onClick={() => handleDeleteVerification(v.id, v.refId)}>
                               <i className="fa-solid fa-trash"></i>
                             </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- VIEW: MESSAGES/REQUESTS --- */}
      {view === 'REQ' && (
        <div className="list-view">
          <div className="floor-section" style={{marginBottom:'20px', border:'1px solid #eee'}}>
            <h2 className="floor-title"><i className="fa-solid fa-paper-plane"></i> Message Staff</h2>
            <form onSubmit={handleSendRequest} style={{display:'flex', flexDirection:'column', gap:'10px'}}>
              <select value={reqReceiver} onChange={e => setReqReceiver(e.target.value)} required>
                <option value="">-- Select Recipient --</option>
                {users.filter(u => u.dbId !== currentUser.dbId && isUserActive(u)).map(u => (
                    <option key={u.dbId} value={u.dbId}>{u.name} ({u.role})</option>
                ))}
              </select>
              <textarea placeholder="Message..." value={reqContent} onChange={e => setReqContent(e.target.value)} required rows="2"></textarea>
              <button type="submit" className="btn blue" style={{justifyContent:'center'}}>Send</button>
            </form>
          </div>

          <h2 className="floor-title">Inbox</h2>
          {requests.filter(r => r.receiverId === currentUser.dbId).length === 0 && <p style={{color:'#999', textAlign:'center'}}>No incoming requests.</p>}
          <div className="scroll-pane">
              {requests.filter(r => r.receiverId === currentUser.dbId).map(req => (
                <div key={req.id} className="req-card">
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
                    <span className={`req-status status-${req.status}`}>{req.status}</span>
                    <span style={{fontSize:'0.8rem', color:'#666'}}>From: <b>{req.senderName}</b></span>
                  </div>
                  <p style={{margin:'5px 0', fontSize:'1rem'}}>{req.content}</p>

                  {req.status === 'pending' && (
                    <div style={{display:'flex', gap:'10px', marginTop:'10px'}}>
                      <button onClick={() => handleAcceptRequest(req.id)} className="btn green" style={{flex:1, justifyContent:'center'}}>Accept</button>
                      <button onClick={() => { setRejectModal({show:true, reqId:req.id}); setRejectReason(''); }} className="btn red" style={{flex:1, justifyContent:'center'}}>Reject</button>
                    </div>
                  )}
                  {req.status === 'accepted' && <button onClick={() => handleCompleteRequest(req.id)} className="btn blue" style={{width:'100%', justifyContent:'center', marginTop:'10px'}}>Mark Complete</button>}
                  {req.status === 'rejected' && <div style={{background:'#fff', borderLeft:'3px solid red', padding:'5px', marginTop:'5px', fontSize:'0.9rem'}}>Reason: {req.rejectionReason}</div>}
                  {req.status === 'completed' && req.completionRemark && <div style={{background:'#fff', borderLeft:'3px solid green', padding:'5px', marginTop:'5px', fontSize:'0.9rem'}}>Note: {req.completionRemark}</div>}

                  <div style={{fontSize:'0.75rem', color:'#666', marginTop:'10px', borderTop:'1px solid #eee', paddingTop:'5px'}}>Sent: {formatTime(req.createdAt)}</div>
                </div>
              ))}
          </div>

          <h2 className="floor-title" style={{marginTop:'30px'}}>Sent History</h2>
          <div className="scroll-pane">
              {requests.filter(r => r.senderId === currentUser.dbId).map(req => (
                <div key={req.id} className="req-card" style={{opacity:0.9}}>
                    <div style={{display:'flex', justifyContent:'space-between'}}>
                    <span className={`req-status status-${req.status}`}>{req.status}</span>
                    <span style={{fontSize:'0.8rem', color:'#666'}}>To: <b>{req.receiverName}</b></span>
                    </div>
                    <p style={{margin:'5px 0', color:'#555'}}>{req.content}</p>
                    {req.status === 'rejected' && <div style={{color:'red', fontSize:'0.85rem'}}>Rejected: {req.rejectionReason}</div>}
                    {req.status === 'completed' && req.completionRemark && <div style={{color:'green', fontSize:'0.85rem'}}>Note: {req.completionRemark}</div>}
                    <div style={{fontSize:'0.75rem', color:'#888', marginTop:'5px'}}>Sent: {formatTime(req.createdAt)}</div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* --- VIEW: MY SHIFT (ATTENDANCE) --- */}
      {view === 'SHIFT' && (
        <div className="dashboard">
            <div className="clock-card">
                <p className="attendance-greeting">
                  Hi, have a productive day. Happy working. TQ.
                </p>
                <div className="clock-display">
                    <div className="clock-date">{currentTime.toLocaleDateString('en-MY', {weekday:'long', day:'numeric', month:'long', year:'numeric'})}</div>
                    <div className="clock-time">{currentTime.toLocaleTimeString('en-MY', {hour12:false})}</div>
                </div>
                {isComputerDevice() && (
                  <div className="device-restriction-notice">
                    <i className="fa-solid fa-desktop"></i>
                    Computer access is allowed, but Clock IN / Clock OUT is only available on an approved mobile device.
                  </div>
                )}
                <div style={{display:'flex', gap:'20px', justifyContent:'center'}}>
                    <button onClick={() => handleClock('in')} className="btn green clock-btn" disabled={isComputerDevice() || lastClock?.type === 'in'}>Clock IN</button>
                    <button onClick={() => handleClock('out')} className="btn red clock-btn" disabled={isComputerDevice() || lastClock?.type !== 'in'}>Clock OUT</button>
                </div>
                <div style={{marginTop:'15px', color:'#666', display:'flex', flexDirection:'column', alignItems:'center', gap:'5px'}}>
                    <div>
                      Status: <strong>{lastClock?.type === 'in' ? '🟢 Working' : '🔴 Off Duty'}</strong>
                      {lastClock?.locationStatus && (
                        <span className={`status-badge ${lastClock.locationStatus === 'away' ? 'away' : 'on_site'}`} style={{marginLeft: '8px'}}>
                          <i className={`fa-solid ${lastClock.locationStatus === 'away' ? 'fa-location-dot' : 'fa-hotel'}`}></i> {getLocationText(lastClock, hotelLocation)}
                        </span>
                      )}
                    </div>
                    {lastClock?.type === 'in' && lastClock?.timestamp && (
                      <div className="session-duration" style={{fontSize: '0.9rem', padding: '6px 14px', marginTop: '5px'}}>
                        Shift Timer: {formatDuration(currentTime - (lastClock.timestamp?.toDate ? lastClock.timestamp.toDate() : new Date(lastClock.timestamp)))}
                      </div>
                    )}
                    {currentUser.role === 'admin' && (
                      <button className="btn blue" style={{fontSize:'0.8rem', padding:'6px 12px', marginTop:'10px'}} onClick={() => setView('ATT_REPORT')}>
                        <i className="fa-solid fa-clipboard-user"></i> Open Attendance Portal & Reports
                      </button>
                    )}
                </div>
            </div>

            <div className="list-view" style={{margin:0}}>
                <h3>My Logs</h3>
                <div className="scroll-pane">
                    {attendance.filter(a => a.userId === currentUser.userid).map(a => (
                        <div key={a.id} style={{padding:'10px', borderBottom:'1px solid #eee', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                            <div>
                              <span style={{fontWeight:'bold', color: a.type==='in'?'green':'red', marginRight:'8px'}}>{a.type.toUpperCase()}</span>
                              {a.locationStatus === 'away' ? (
                                <span className="status-badge away" style={{fontSize:'0.7rem'}}><i className="fa-solid fa-location-dot"></i> {getLocationText(a, hotelLocation)}</span>
                              ) : (
                                <span className="status-badge on_site" style={{fontSize:'0.7rem'}}><i className="fa-solid fa-hotel"></i> On Site</span>
                              )}
                            </div>
                            <span>{formatDate(a.timestamp)} {formatTime(a.timestamp)}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* --- VIEW: REQUEST MEDICAL CERTIFICATE --- */}
      {view === 'MC' && (
        <div className="dashboard mc-page">
          <div className="floor-section mc-request-panel">
            <div className="floor-title">
              <span><i className="fa-solid fa-notes-medical"></i> Request Medical Certificate (MC)</span>
            </div>
            <p className="mc-intro">Submit your MC dates and details for Admin review.</p>

            <form className="mc-request-form" onSubmit={handleSubmitMcRequest}>
              <div className="mc-form-grid">
                <label>
                  <span>Start Date (DD/MM/YYYY)</span>
                  <CalendarDateField name="startDate" idPrefix="mc-start-date" ariaLabel="MC start date in day month year format" />
                </label>
                <label>
                  <span>End Date (DD/MM/YYYY)</span>
                  <CalendarDateField name="endDate" idPrefix="mc-end-date" ariaLabel="MC end date in day month year format" />
                </label>
                <label className="mc-field-wide">
                  <span>Clinic / Hospital Name <small>(Optional)</small></span>
                  <input name="clinicName" type="text" maxLength="100" placeholder="e.g. Klinik Sentosa" />
                </label>
                <label className="mc-field-wide">
                  <span>Reason / Remarks</span>
                  <textarea name="remarks" rows="4" maxLength="500" placeholder="Briefly describe your MC request..." required></textarea>
                </label>
              </div>
              <button type="submit" className="btn blue mc-submit-btn" disabled={isMcSubmitting}>
                {isMcSubmitting
                  ? <><i className="fa-solid fa-spinner fa-spin"></i> Submitting...</>
                  : <><i className="fa-solid fa-paper-plane"></i> Submit MC Request</>}
              </button>
            </form>
          </div>

          <div className="floor-section">
            <h2 className="floor-title"><i className="fa-solid fa-clock-rotate-left"></i> My MC Requests</h2>
            <div className="mc-request-list">
              {leaves.filter(leave => leave.userId === currentUser.userid && leave.type === 'MC').length === 0 ? (
                <div className="mc-empty-state">
                  <i className="fa-regular fa-folder-open"></i>
                  <p>No MC requests submitted yet.</p>
                </div>
              ) : (
                leaves
                  .filter(leave => leave.userId === currentUser.userid && leave.type === 'MC')
                  .map(leave => (
                    <article key={leave.id} className={`mc-request-card mc-${leave.status || 'pending'}`}>
                      <div className="mc-request-card-top">
                        <div>
                          <strong>{formatDate(leave.startDate)}{leave.endDate && leave.endDate !== leave.startDate ? ` – ${formatDate(leave.endDate)}` : ''}</strong>
                          <small>Submitted {formatDate(leave.createdAt)} · {formatTime(leave.createdAt)}</small>
                        </div>
                        <span className={`req-status status-${leave.status || 'pending'}`}>{leave.status || 'pending'}</span>
                      </div>
                      {leave.clinicName && <p><i className="fa-solid fa-house-medical"></i> {leave.clinicName}</p>}
                      <p className="mc-remarks">{leave.remarks}</p>
                      {leave.reviewedBy && <small className="mc-reviewed-by">Reviewed by {leave.reviewedBy}</small>}
                      {leave.status === 'pending' && (
                        <button type="button" className="btn red mc-withdraw-btn" onClick={() => handleWithdrawMcRequest(leave)}>
                          <i className="fa-solid fa-xmark"></i> Withdraw Request
                        </button>
                      )}
                    </article>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- VIEW: ATTENDANCE PORTAL & REPORTS (ADMIN ONLY) --- */}
      {view === 'ATT_REPORT' && currentUser.role === 'admin' && (
        <div className="dashboard">
          {/* Metrics Header */}
          <div className="att-metrics-grid">
            <div className="att-metric-card">
              <div className="att-metric-icon" style={{background: '#dcfce7', color: '#166534'}}>
                <i className="fa-solid fa-user-clock"></i>
              </div>
              <div>
                <div className="att-metric-value">{workingCount}</div>
                <div className="att-metric-label">Currently Working</div>
              </div>
            </div>

            <div className="att-metric-card">
              <div className="att-metric-icon" style={{background: '#f1f5f9', color: '#475569'}}>
                <i className="fa-solid fa-user-check"></i>
              </div>
              <div>
                <div className="att-metric-value">{offDutyCount}</div>
                <div className="att-metric-label">Off Duty</div>
              </div>
            </div>

            <div className="att-metric-card">
              <div className="att-metric-icon" style={{background: '#f3e8ff', color: '#7e22ce'}}>
                <i className="fa-solid fa-user-minus"></i>
              </div>
              <div>
                <div className="att-metric-value">{onLeaveCount}</div>
                <div className="att-metric-label">On Leave Today</div>
              </div>
            </div>

            <div className="att-metric-card">
              <div className="att-metric-icon" style={{background: '#e0f2fe', color: '#0369a1'}}>
                <i className="fa-solid fa-stopwatch"></i>
              </div>
              <div>
                <div className="att-metric-value">{formatDuration(totalFilteredDurationMs)}</div>
                <div className="att-metric-label">Total Hours Logged</div>
              </div>
            </div>
          </div>

          <div className="floor-section">
            <div className="floor-title">
              <span><i className="fa-solid fa-clipboard-user"></i> Attendance & Shift Portal</span>
              <div style={{display:'flex', gap:'8px', flexWrap:'wrap'}}>
                <button className="btn blue" style={{fontSize: '0.85rem'}} onClick={() => handleExportAttendanceCSV(filteredAttSessions)}>
                  <i className="fa-solid fa-file-csv"></i> Export CSV
                </button>
                <button className="btn grey" style={{fontSize: '0.85rem'}} onClick={() => handlePrintAttendanceReport(filteredAttSessions, attStaffSummaryData)}>
                  <i className="fa-solid fa-print"></i> Print Report
                </button>
              </div>
            </div>

            {/* Sub-Navigation Tabs */}
            <div className="att-subnav">
              <button className={attReportSubTab === 'LOGS' ? 'active' : ''} onClick={() => setAttReportSubTab('LOGS')}>
                <i className="fa-solid fa-list-check"></i> Attendance Sessions ({filteredAttSessions.length})
              </button>
              <button className={attReportSubTab === 'SUMMARY' ? 'active' : ''} onClick={() => setAttReportSubTab('SUMMARY')}>
                <i className="fa-solid fa-chart-pie"></i> Staff Monthly Summary
              </button>
              <button className={attReportSubTab === 'ROSTER' ? 'active' : ''} onClick={() => setAttReportSubTab('ROSTER')}>
                <i className="fa-solid fa-users-viewfinder"></i> Live Staff Roster ({attRosterStatus.length})
              </button>
            </div>

            {/* Filters Toolbar */}
            <div className="filter-bar" style={{display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'15px', background:'#f9f9f9', padding:'12px', borderRadius:'8px', border:'1px solid #eee'}}>
              <div style={{flex: 1, minWidth: '140px'}}>
                <label style={{fontSize: '0.75rem', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '2px'}}>Month</label>
                <input 
                  type="month" 
                  value={attFilterMonth} 
                  onChange={e => setAttFilterMonth(e.target.value)} 
                  onClick={(e) => e.target.showPicker && e.target.showPicker()}
                  style={{margin: 0, width: '100%', cursor: 'pointer'}} 
                />
              </div>

              <div style={{flex: 1, minWidth: '130px'}}>
                <label style={{fontSize: '0.75rem', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '2px'}}>From Date</label>
                <input 
                  type="date" 
                  value={attFilterStartDate} 
                  onChange={e => setAttFilterStartDate(e.target.value)} 
                  onClick={(e) => e.target.showPicker && e.target.showPicker()}
                  style={{margin: 0, width: '100%', cursor: 'pointer'}} 
                />
              </div>

              <div style={{flex: 1, minWidth: '130px'}}>
                <label style={{fontSize: '0.75rem', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '2px'}}>To Date</label>
                <input 
                  type="date" 
                  value={attFilterEndDate} 
                  onChange={e => setAttFilterEndDate(e.target.value)} 
                  onClick={(e) => e.target.showPicker && e.target.showPicker()}
                  style={{margin: 0, width: '100%', cursor: 'pointer'}} 
                />
              </div>

              <div style={{flex: 1, minWidth: '150px'}}>
                <label style={{fontSize: '0.75rem', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '2px'}}>Staff Member</label>
                <select value={attFilterUser} onChange={e => setAttFilterUser(e.target.value)} style={{margin: 0, width: '100%'}}>
                  <option value="">-- All Staff --</option>
                  {users.map(u => <option key={u.userid} value={u.userid}>{u.name} ({u.userid})</option>)}
                </select>
              </div>

              <div style={{flex: 1, minWidth: '150px'}}>
                <label style={{fontSize: '0.75rem', color: '#666', fontWeight: 'bold', display: 'block', marginBottom: '2px'}}>Search</label>
                <input 
                  placeholder="Search Staff Name/ID..." 
                  value={attFilterSearch} 
                  onChange={e => setAttFilterSearch(e.target.value)}
                  style={{margin: 0, width: '100%'}} 
                />
              </div>

              <div style={{display: 'flex', alignItems: 'flex-end'}}>
                <button className="btn grey" onClick={() => { setAttFilterMonth(''); setAttFilterStartDate(''); setAttFilterEndDate(''); setAttFilterUser(''); setAttFilterSearch(''); }} style={{padding: '9px 15px', fontSize: '0.85rem'}}>
                  Reset
                </button>
              </div>
            </div>

            {/* SUBTAB 1: LOGS */}
            {attReportSubTab === 'LOGS' && (
              <div className="admin-table-container scroll-pane scroll-pane-tall">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Staff Name (ID)</th>
                      <th>Location</th>
                      <th>Clock In</th>
                      <th>Clock Out</th>
                      <th>Work Duration</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttSessions.length === 0 ? (
                      <tr><td colSpan={7} style={{textAlign:'center', color:'#999', padding:'25px'}}>No attendance records match the current filters.</td></tr>
                    ) : (
                      filteredAttSessions.map(s => (
                        <tr key={s.id}>
                          <td><strong>{s.inTime ? formatDate(s.inTime) : (s.outTime ? formatDate(s.outTime) : '-')}</strong></td>
                          <td>
                            <strong>{s.userName}</strong>
                            <div style={{fontSize: '0.75rem', color: '#64748b'}}>{s.userId}</div>
                          </td>
                          <td>
                            {s.inLog?.locationStatus === 'away' || s.outLog?.locationStatus === 'away' ? (
                              <span className="status-badge away">
                                <i className="fa-solid fa-location-dot"></i> {getLocationText(s.inLog?.locationStatus === 'away' ? s.inLog : s.outLog, hotelLocation)}
                              </span>
                            ) : (
                              <span className="status-badge on_site">
                                <i className="fa-solid fa-hotel"></i> On Site
                              </span>
                            )}
                          </td>
                          <td>
                            <div>
                              {s.inTime ? formatTime(s.inTime) : <span style={{color: '#94a3b8'}}>-</span>}
                            </div>
                            {s.inLog?.locationStatus === 'away' && (
                              <div style={{marginTop: '3px'}}>
                                <span className="status-badge away" style={{fontSize: '0.7rem'}}>
                                  <i className="fa-solid fa-location-dot"></i> {getLocationText(s.inLog, hotelLocation)}
                                </span>
                              </div>
                            )}
                          </td>
                          <td>
                            <div>
                              {s.outTime ? formatTime(s.outTime) : (s.status === 'working' ? <span className="status-badge working"><span className="badge-dot"></span> Working Now</span> : <span style={{color: '#ef4444', fontSize: '0.8rem'}}>No Clock-out</span>)}
                            </div>
                            {s.outLog?.locationStatus === 'away' && (
                              <div style={{marginTop: '3px'}}>
                                <span className="status-badge away" style={{fontSize: '0.7rem'}}>
                                  <i className="fa-solid fa-location-dot"></i> {getLocationText(s.outLog, hotelLocation)}
                                </span>
                              </div>
                            )}
                          </td>
                          <td>
                            <span className="session-duration">
                              {formatDuration(s.durationMs)}
                            </span>
                          </td>
                          <td>
                            {s.status === 'working' && <span className="status-badge working"><span className="badge-dot"></span> Working Now</span>}
                            {s.status === 'completed' && <span className="status-badge off_duty">Completed</span>}
                            {s.status === 'missing_out' && <span style={{color: '#f59e0b', fontSize: '0.75rem', fontWeight: 'bold'}}>Incomplete</span>}
                            {s.status === 'orphan_out' && <span style={{color: '#ef4444', fontSize: '0.75rem', fontWeight: 'bold'}}>Clock Out Only</span>}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* SUBTAB 2: SUMMARY */}
            {attReportSubTab === 'SUMMARY' && (
              <div className="admin-table-container scroll-pane scroll-pane-tall">
                <table>
                  <thead>
                    <tr>
                      <th>Staff ID</th>
                      <th>Staff Name</th>
                      <th>Total Days Present</th>
                      <th>Total Hours Worked</th>
                      <th>Sessions Recorded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attStaffSummaryData.length === 0 ? (
                      <tr><td colSpan="5" style={{textAlign:'center', color:'#999', padding:'25px'}}>No staff attendance records available for summary.</td></tr>
                    ) : (
                      attStaffSummaryData.map(st => (
                        <tr key={st.userId}>
                          <td><strong>{st.userId}</strong></td>
                          <td><strong>{st.userName}</strong></td>
                          <td><span style={{fontWeight: 'bold', color: '#10b981'}}>{st.daysWorked} days</span></td>
                          <td><span className="session-duration">{st.totalHoursStr}</span></td>
                          <td>{st.sessionCount} sessions</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* SUBTAB 3: LIVE ROSTER */}
            {attReportSubTab === 'ROSTER' && (
              <div className="att-roster-grid scroll-pane scroll-pane-tall">
                {attRosterStatus.map(st => (
                  <div key={st.userId} className="roster-card">
                    <div>
                      <div className="roster-header">
                        <div>
                          <div className="roster-name">{st.userName}</div>
                          <div className="roster-role">ID: {st.userId} • {st.role}</div>
                        </div>
                        <div>
                          {st.status === 'working' && (
                            <span className={`status-badge ${st.locationStatus === 'away' ? 'away' : 'working'}`}>
                              <span className="badge-dot"></span> {st.locationStatus === 'away' ? `Working (${getLocationText(st, hotelLocation)})` : 'Working (On Site)'}
                            </span>
                          )}
                          {st.status === 'off_duty' && <span className="status-badge off_duty"><span className="badge-dot"></span> Off Duty</span>}
                          {st.status === 'on_leave' && <span className="status-badge on_leave"><span className="badge-dot"></span> On Leave</span>}
                        </div>
                      </div>
                      
                      <div style={{fontSize: '0.85rem', color: '#475569', marginTop: '10px'}}>
                        {st.status === 'working' && (
                          <p style={{margin: 0}}>
                            <strong>Clocked in at:</strong> {formatTime(st.startTime)}<br/>
                            <strong>Elapsed:</strong> <span style={{color: '#0284c7', fontWeight: 'bold'}}>{formatDuration(currentTime - (st.startTime?.toDate ? st.startTime.toDate() : new Date(st.startTime)))}</span>
                          </p>
                        )}
                        {st.status === 'off_duty' && (
                          <p style={{margin: 0}}>
                            <strong>Last recorded activity:</strong> {st.lastTime ? formatTime(st.lastTime) : 'None'}
                          </p>
                        )}
                        {st.status === 'on_leave' && (
                          <p style={{margin: 0, color: '#7e22ce'}}>
                            <strong>Status:</strong> Approved Leave / MC Today
                          </p>
                        )}
                      </div>
                    </div>

                    <div style={{marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-start', alignItems: 'center'}}>
                      <button className="btn grey" style={{fontSize: '0.75rem', padding: '4px 8px'}} onClick={() => { setAttFilterUser(st.userId); setAttReportSubTab('LOGS'); }}>
                        History Logs
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- VIEW: CLAIM DAYS --- */}
      {view === 'CLAIMS' && (
        <div className="dashboard">
          <div className="floor-section">
            <div className="floor-title">
              <span><i className="fa-solid fa-calendar-check"></i> Guest Claim Days</span>
              <button className="btn blue" onClick={() => { resetClaimForm(); setClaimModal(true); }}>
                <i className="fa-solid fa-plus"></i> Add Record
              </button>
            </div>
            
            <div className="claims-grid">
              {claimDays.map(claim => (
                <div key={claim.id} className="claim-card">
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'start', marginBottom:'10px'}}>
                    <div>
                      <h3>{claim.guestName}</h3>
                      <p style={{fontSize:'0.85rem', color:'#666'}}>IC: {claim.icNumber}</p>
                      <p style={{fontSize:'0.85rem', color:'#666'}}>Contact: {claim.contactNumber}</p>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:'1.2rem', fontWeight:'bold', color: claim.balanceClaim === 0 ? '#10b981' : '#ef4444'}}>
                        Balance: {claim.balanceClaim} days
                      </div>
                    </div>
                  </div>
                  
                  <div style={{background:'#f8f9fa', padding:'10px', borderRadius:'5px', marginBottom:'10px'}}>
                    <p style={{fontSize:'0.85rem'}}><strong>Booking Date:</strong> {claim.bookingDate}</p>
                    <p style={{fontSize:'0.85rem'}}><strong>Room Type:</strong> {claim.roomType}</p>
                    <p style={{fontSize:'0.85rem'}}><strong>Payment:</strong> RM{claim.payment}</p>
                  </div>

                  {claim.usedDates && claim.usedDates.length > 0 && (
                    <div style={{marginBottom:'10px'}}>
                      <strong style={{fontSize:'0.85rem'}}>Used Dates:</strong>
                      <div className="scroll-pane-modal" style={{maxHeight:'150px'}}>
                        {claim.usedDates.map((used, idx) => (
                          <div key={idx} style={{fontSize:'0.8rem', padding:'5px 0', borderBottom:'1px dashed #eee'}}>
                            {used.date} - {used.roomType} {used.roomNumber} ({used.staff})
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{fontSize:'0.7rem', color:'#999', marginTop:'10px', paddingTop:'10px', borderTop:'1px solid #eee'}}>
                    Recorded by {claim.recordedBy} on {formatDate(claim.createdAt)}
                  </div>

                  <div style={{display:'flex', gap:'5px', marginTop:'10px'}}>
                    <button className="btn blue" style={{flex:1, fontSize:'0.8rem', padding:'8px'}} onClick={() => openEditClaim(claim)}>
                      <i className="fa-solid fa-edit"></i> Edit
                    </button>
                    {currentUser.role === 'admin' && (
                      <button className="btn red" style={{flex:1, fontSize:'0.8rem', padding:'8px'}} onClick={() => handleDeleteClaim(claim.id)}>
                        <i className="fa-solid fa-trash"></i> Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- VIEW: ADMIN --- */}
      {view === 'ADMIN' && (
        <div className="dashboard">

            {/* HOTEL GPS LOCATION CONFIG */}
            <div className="floor-section">
              <h2 className="floor-title"><i className="fa-solid fa-location-crosshairs"></i> Hotel GPS Location Config</h2>
              <form onSubmit={handleSaveHotelLocation} style={{display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'center', marginBottom:'10px'}}>
                <input name="lat" type="number" step="any" defaultValue={hotelLocation.lat} placeholder="Latitude (e.g. 1.509149)" required style={{flex: 1, minWidth: '130px'}} />
                <input name="lng" type="number" step="any" defaultValue={hotelLocation.lng} placeholder="Longitude (e.g. 103.866151)" required style={{flex: 1, minWidth: '130px'}} />
                <input name="radiusMeters" type="number" value={ATTENDANCE_RADIUS_METERS} aria-label="Attendance radius in metres" readOnly style={{width: '120px', background: '#f1f5f9'}} />
                <button type="submit" className="btn blue">Save Coordinates</button>
                <button type="button" className="btn green" onClick={handleSetCurrentGPSAsHotel}>
                  <i className="fa-solid fa-location-arrow"></i> Set Current GPS Position
                </button>
              </form>
              <p style={{fontSize: '0.85rem', margin: '0 0 6px'}}>
                <strong>Located at:</strong> 68, 70 &amp; 72, Jalan Lembah 19, Bandar Baru Seri Alam, 81750 Masai, Johor
                {' · '}<a href={`https://www.google.com/maps?q=${hotelLocation.lat},${hotelLocation.lng}`} target="_blank" rel="noreferrer">Open map</a>
              </p>
              <p style={{fontSize: '0.85rem', color: '#666', margin: 0}}>
                *Staff clocking in/out outside this radius ({hotelLocation.radiusMeters}m from Lat: {hotelLocation.lat}, Lng: {hotelLocation.lng}) will be automatically flagged as <strong>Away</strong>.
              </p>
            </div>

            {/* NEW: ADD OR RESTORE ROOM */}
            <div className="floor-section" style={{marginTop: '20px'}}>
              <h2 className="floor-title"><i className="fa-solid fa-door-open"></i> Add / Restore Missing Room</h2>
              <form onSubmit={handleAddRoom} style={{display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'10px'}}>
                <input name="roomId" placeholder="Room No (e.g. 106)" required style={{flex:1, minWidth: '120px'}} />
                <input name="floor" placeholder="Floor (e.g. 1)" required style={{flex:1, minWidth: '100px'}} />
                <input name="roomType" placeholder="Type (e.g. DLXR, SUIT)" required style={{flex:1, minWidth: '120px'}} />
                <button type="submit" className="btn green">Add Room</button>
              </form>
              <p style={{fontSize: '0.85rem', color: '#666', margin: 0}}>*If a room accidentally disappeared, enter its details here to restore it. Existing rooms won't be overwritten.</p>
            </div>

            <div className="floor-section" style={{marginTop: '20px'}}>
              <h2 className="floor-title">
                <span><i className="fa-solid fa-users-gear"></i> Manage Staff (Click row for history)</span>
                {pendingPasswordResetCount > 0 && (
                  <span className="password-reset-count">
                    <i className="fa-solid fa-key"></i>
                    {pendingPasswordResetCount} reset request{pendingPasswordResetCount === 1 ? '' : 's'}
                  </span>
                )}
              </h2>
              <form onSubmit={handleCreateUser} style={{display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'20px'}}>
                <input name="userid" placeholder="ID" required style={{flex:1}} />
                <input name="name" placeholder="Name" required style={{flex:1}} />
                <input name="password" placeholder="Pass" required style={{width:'100px'}} />
                <select name="role" style={{width:'100px'}}><option value="staff">Staff</option><option value="admin">Admin</option></select>
                <button className="btn green">Add</button>
              </form>
              <div className="admin-table-container scroll-pane scroll-pane-tall">
                <table>
                  <thead><tr><th>ID</th><th>Name</th><th>Role</th><th>Status</th><th>Approved Device</th><th>Manage</th></tr></thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.dbId} className={`clickable-row ${isUserActive(u) ? '' : 'inactive-staff-row'} ${u.passwordResetStatus === 'pending' ? 'password-reset-row' : ''}`} onClick={() => setStaffModal(u)}>
                        <td>{u.userid}</td><td>{u.name}</td><td>{u.role}</td>
                        <td>
                          <span className={`staff-account-status ${isUserActive(u) ? 'active' : 'inactive'}`}>
                            <i className={`fa-solid ${isUserActive(u) ? 'fa-circle-check' : 'fa-circle-minus'}`}></i>
                            {isUserActive(u) ? 'Active' : 'Inactive'}
                          </span>
                          {u.passwordResetStatus === 'pending' && (
                            <span className="password-reset-badge" title={`Requested ${formatTime(u.passwordResetRequestedAt)}`}>
                              <i className="fa-solid fa-key"></i> Reset requested
                            </span>
                          )}
                        </td>
                        <td>
                          {u.role === 'admin' ? (
                            <span className="device-status admin-exempt"><i className="fa-solid fa-shield-halved"></i> Exempt</span>
                          ) : u.approvedDeviceId ? (
                            <span className="device-status bound" title={`Bound ${formatTime(u.approvedDeviceBoundAt)}`}><i className="fa-solid fa-mobile-screen-button"></i> {u.approvedDeviceName || 'Approved device'}</span>
                          ) : (
                            <span className="device-status unbound"><i className="fa-solid fa-mobile-screen"></i> Not bound</span>
                          )}
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                            {u.passwordResetStatus === 'pending' && (
                              <button onClick={() => handleAdminChangePassword(u.dbId, u.name)} className="btn password-reset-btn" title="Set a new password and complete this request">
                                <i className="fa-solid fa-key"></i> Reset Password
                              </button>
                            )}
                            {u.role !== 'admin' && isUserActive(u) && u.approvedDeviceId && (
                              <button onClick={() => handleResetApprovedDevice(u)} className="btn device-reset-btn" title="Reset approved device">
                                <i className="fa-solid fa-mobile-screen-button"></i> Reset Device
                              </button>
                            )}
                            {u.role !== 'admin' && (
                              <button
                                onClick={() => handleSetStaffActive(u, !isUserActive(u))}
                                className={`btn staff-status-btn ${isUserActive(u) ? 'set-inactive' : 'set-active'}`}
                                title={isUserActive(u) ? 'Set staff account as inactive' : 'Reactivate staff account'}
                              >
                                <i className={`fa-solid ${isUserActive(u) ? 'fa-user-slash' : 'fa-user-check'}`}></i>
                                {isUserActive(u) ? 'Set Inactive' : 'Reactivate'}
                              </button>
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          
            <div className="floor-section" style={{marginTop: '20px'}}>
              <h2 className="floor-title"><i className="fa-solid fa-clock"></i> Today's Attendance</h2>
              <div className="admin-table-container scroll-pane scroll-pane-tall">
                <table>
                  <thead><tr><th>Staff Name</th><th>Clock In</th><th>Clock Out</th></tr></thead>
                  <tbody>
                    {todaysAttendanceData.length === 0 ? (
                        <tr><td colSpan="3" style={{textAlign:'center', color:'#999'}}>No staff clocked in today.</td></tr>
                    ) : (
                        todaysAttendanceData.map((a, idx) => (
                          <tr key={idx}>
                            <td><strong>{a.userName}</strong></td>
                            <td>{a.inTime ? a.inTime : <span style={{color: '#999'}}>-</span>}</td>
                            <td>
                              {a.outTime ? a.outTime : (
                                  <span style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>Still Working</span>
                              )}
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          <div className="floor-section" style={{marginTop: '20px'}}>
            <h2 className="floor-title"><i className="fa-solid fa-notes-medical"></i> Medical Certificate Requests</h2>
            <div className="admin-table-container scroll-pane">
               <table>
                   <thead><tr><th>Staff</th><th>MC Dates</th><th>Clinic</th><th>Remarks</th><th>Submitted</th><th>Status</th></tr></thead>
                   <tbody>
                       {leaves.filter(l => l.type === 'MC').length === 0 ? (
                         <tr><td colSpan="6" style={{textAlign:'center', color:'#999'}}>No MC requests submitted.</td></tr>
                       ) : leaves.filter(l => l.type === 'MC').map(l => (
                           <tr key={l.id}>
                               <td>{l.userName}</td>
                               <td><strong>{formatDate(l.startDate)}</strong>{l.endDate && l.endDate !== l.startDate ? <> – <strong>{formatDate(l.endDate)}</strong></> : ''}</td>
                               <td>{l.clinicName || '-'}</td>
                               <td>{l.remarks}</td>
                               <td>{formatDate(l.createdAt)}</td>
                               <td>
                                   {l.status === 'pending' ? (
                                       <div style={{display:'flex', gap:'5px'}}>
                                           <button onClick={() => handleReviewMcRequest(l, 'approved')} className="btn green" style={{padding:'6px 9px'}} title="Approve MC"><i className="fa-solid fa-check"></i></button>
                                           <button onClick={() => handleReviewMcRequest(l, 'rejected')} className="btn red" style={{padding:'6px 9px'}} title="Reject MC"><i className="fa-solid fa-xmark"></i></button>
                                       </div>
                                   ) : (
                                       <span style={{fontWeight:'bold', color: l.status==='approved'?'green':'red'}}>{l.status.toUpperCase()}</span>
                                   )}
                               </td>
                           </tr>
                       ))}
                   </tbody>
               </table>
            </div>
          </div>

          <div className="floor-section">
            <h2 className="floor-title"><i className="fa-solid fa-wrench"></i> Maintenance Tickets History</h2>
            <div className="filter-bar">
                <input placeholder="Search Room No..." value={ticketSearch} onChange={e => setTicketSearch(e.target.value)} />
                <select value={ticketSort} onChange={e => setTicketSort(e.target.value)}>
                    <option value="date-desc">Date (Newest)</option>
                    <option value="date-asc">Date (Oldest)</option>
                    <option value="room-asc">Room (Asc)</option>
                    <option value="room-desc">Room (Desc)</option>
                </select>
            </div>
            <div className="admin-table-container scroll-pane scroll-pane-tall">
              <table>
                <thead>
                  <tr><th>Room</th><th>Issue</th><th>Status</th><th>Reported By</th><th>Reported</th><th>Resolved</th><th>Resolved By</th></tr>
                </thead>
                <tbody>
                  {processedTickets.map(t => (
                    <tr key={t.id}>
                      <td><strong>{t.roomId}</strong></td>
                      <td>{t.issue}</td>
                      <td><span style={{fontWeight:'bold', color: t.status === 'open' ? '#ef4444' : '#10b981'}}>{t.status.toUpperCase()}</span></td>
                      <td>{t.reportedBy || '-'}</td>
                      <td>{formatDate(t.createdAt)}</td>
                      <td>{t.resolvedAt ? formatDate(t.resolvedAt) : '-'}</td>
                      <td>{t.resolvedBy || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SYSTEM AUDIT TRAIL */}
          <div className="floor-section" style={{marginTop: '20px'}}>
            <h2 className="floor-title">
              <span><i className="fa-solid fa-list-check"></i> System Audit Trail</span>
              <button className="btn grey" style={{fontSize: '0.8rem', padding: '6px 12px'}} onClick={handlePrintAudit}>
                <i className="fa-solid fa-print"></i> Print Report
              </button>
            </h2>

            <div className="filter-bar" style={{display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'15px', background:'#f9f9f9', padding:'10px', borderRadius:'8px', border:'1px solid #eee'}}>
                <input 
                  type="month" 
                  value={auditFilterMonth} 
                  onChange={e => setAuditFilterMonth(e.target.value)} 
                  onClick={(e) => e.target.showPicker && e.target.showPicker()}
                  style={{margin:0, flex: 1, minWidth: '150px', cursor: 'pointer'}} 
                />
                
                <select value={auditFilterUser} onChange={e => setAuditFilterUser(e.target.value)} style={{margin:0, flex: 1, minWidth: '150px'}}>
                  <option value="">-- All Users --</option>
                  {uniqueAuditUsers.map(u => <option key={u} value={u}>{u}</option>)}
                </select>

                <select value={auditFilterAction} onChange={e => setAuditFilterAction(e.target.value)} style={{margin:0, flex: 1, minWidth: '150px'}}>
                  <option value="">-- All Actions --</option>
                  {uniqueAuditActions.map(a => <option key={a} value={a}>{a}</option>)}
                </select>

                <button className="btn grey" onClick={() => {setAuditFilterMonth(''); setAuditFilterUser(''); setAuditFilterAction('');}} style={{padding: '0 15px'}}>Clear Filters</button>
            </div>

            <div className="admin-table-container scroll-pane scroll-pane-tall" id="audit-table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAuditLogs.length === 0 ? (
                    <tr><td colSpan="4" style={{textAlign:'center', color:'#999'}}>No logs match the current filters.</td></tr>
                  ) : (
                    filteredAuditLogs.map(log => (
                      <tr key={log.id}>
                        <td style={{whiteSpace:'nowrap', color:'#666', fontSize:'0.85rem'}}>{formatDate(log.timestamp)} <br/> {formatTime(log.timestamp)}</td>
                        <td><strong>{log.user}</strong></td>
                        <td><span className="badge blue" style={{fontSize:'0.7rem', padding:'3px 6px'}}>{log.action}</span></td>
                        <td>{log.details}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- MODALS --- */}
      {editStockModal && (
        <div className="modal-overlay" onClick={() => setEditStockModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Edit Stock Item</h2>
            <form onSubmit={handleUpdateStock} style={{display:'flex', flexDirection:'column', gap:'10px', marginTop:'15px'}}>
              <div><label style={{fontSize:'0.85rem', color:'#666'}}>Category</label><input value={editStockModal.category} onChange={e => setEditStockModal({...editStockModal, category: e.target.value})} placeholder="Category" required /></div>
              <div><label style={{fontSize:'0.85rem', color:'#666'}}>Sub-category</label><input value={editStockModal.subcategory} onChange={e => setEditStockModal({...editStockModal, subcategory: e.target.value})} placeholder="Sub-category (Optional)" /></div>
              <div><label style={{fontSize:'0.85rem', color:'#666'}}>Item Name</label><input value={editStockModal.name} onChange={e => setEditStockModal({...editStockModal, name: e.target.value})} placeholder="Item Name" required /></div>
              <div><label style={{fontSize:'0.85rem', color:'#666'}}>Quantity</label><input type="number" value={editStockModal.quantity} onChange={e => setEditStockModal({...editStockModal, quantity: e.target.value})} placeholder="Quantity" required /></div>
              <button type="submit" className="btn blue" style={{justifyContent:'center', marginTop:'10px'}}>Update Stock</button>
              <button type="button" className="btn grey" style={{justifyContent:'center'}} onClick={() => setEditStockModal(null)}>Cancel</button>
            </form>
          </div>
        </div>
      )}

      {receiveLaundryModal && (
        <div className="modal-overlay" onClick={() => setReceiveLaundryModal(null)}>
          <div className="modal-content large-modal" onClick={e => e.stopPropagation()}>
            <h2>Verify Received Laundry</h2>
            <p style={{fontSize:'0.85rem', color:'#666', marginBottom:'15px'}}>Sent by {receiveLaundryModal.sentBy} on {formatTime(receiveLaundryModal.createdAt)}</p>
            <div className="scroll-pane scroll-pane-modal" style={{maxHeight:'400px', paddingRight:'10px'}}>
               {Object.entries(receiveLaundryModal.items).map(([itemName, data]) => (
                   <div key={itemName} className={`laundry-item-row ${data.status === 'correct' ? 'correct' : data.status === 'incorrect' ? 'incorrect' : ''}`}>
                       <div style={{flex: 1}}>
                           <div style={{fontWeight:'bold', fontSize:'0.9rem'}}>{itemName}</div>
                           <div style={{fontSize:'0.75rem', color:'#666'}}>Sent: {data.sentQty}</div>
                           {data.status === 'incorrect' && <div style={{fontSize:'0.75rem', color:'#ef4444', marginTop:'3px'}}><b>Note:</b> {data.remark}</div>}
                       </div>
                       <div className="laundry-actions">
                           <button className={`btn ${data.status === 'correct' ? 'green' : 'grey'}`} style={{padding: '6px 12px'}} onClick={() => handleItemReceiveToggle(itemName, 'correct')}><i className="fa-solid fa-check"></i></button>
                           <button className={`btn ${data.status === 'incorrect' ? 'red' : 'grey'}`} style={{padding: '6px 12px'}} onClick={() => handleItemReceiveToggle(itemName, 'incorrect')}><i className="fa-solid fa-times"></i></button>
                       </div>
                   </div>
               ))}
            </div>
            <div style={{display:'flex', gap:'10px', marginTop:'20px'}}>
              <button className="btn grey" style={{flex:1, justifyContent:'center'}} onClick={() => setReceiveLaundryModal(null)}>Cancel</button>
              <button className="btn blue" style={{flex:1, justifyContent:'center'}} onClick={handleSaveReceivedLaundry}>Save Verification</button>
            </div>
          </div>
        </div>
      )}

      {rejectModal.show && (
        <div className="modal-overlay" onClick={() => setRejectModal({show:false, reqId:null})}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{color:'#dc3545'}}>Reject Request</h2>
            <textarea placeholder="Reason..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows="3" autoFocus></textarea>
            <div style={{display:'flex', gap:'10px', marginTop:'15px'}}>
              <button className="btn grey" style={{flex:1, justifyContent:'center'}} onClick={() => setRejectModal({show:false, reqId:null})}>Cancel</button>
              <button className="btn red" style={{flex:1, justifyContent:'center'}} onClick={submitReject}>Reject</button>
            </div>
          </div>
        </div>
      )}
      
      {staffModal && (
          <div className="modal-overlay" onClick={() => setStaffModal(null)}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                  <h2>{staffModal.name}</h2>
                  {staffModal.passwordResetStatus === 'pending' && (
                    <div className="password-reset-alert">
                      <i className="fa-solid fa-key"></i>
                      This staff member requested a password reset.
                    </div>
                  )}
                  <h3 style={{fontSize:'1rem', marginTop:'20px', borderBottom:'2px solid #eee'}}>Attendance History</h3>
                  <div className="scroll-pane scroll-pane-modal" style={{marginBottom:'20px'}}>
                      <table style={{fontSize:'0.85rem'}}>
                          <thead><tr><th>Type</th><th>Time</th><th>Location</th></tr></thead>
                          <tbody>
                              {attendance.filter(a => a.userId === staffModal.userid).map(a => (
                                  <tr key={a.id}>
                                      <td style={{color: a.type==='in'?'green':'red', fontWeight:'bold'}}>{a.type.toUpperCase()}</td>
                                      <td>{formatDate(a.timestamp)} {formatTime(a.timestamp)}</td>
                                      <td>
                                        {a.locationStatus === 'away' ? (
                                          <span className="status-badge away" style={{fontSize: '0.7rem'}}>
                                            <i className="fa-solid fa-location-dot"></i> {getLocationText(a, hotelLocation)}
                                          </span>
                                        ) : (
                                          <span className="status-badge on_site" style={{fontSize: '0.7rem'}}>
                                            <i className="fa-solid fa-hotel"></i> On Site
                                          </span>
                                        )}
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
                  <h3 style={{fontSize:'1rem', borderBottom:'2px solid #eee'}}>Leave History</h3>
                  <div className="scroll-pane scroll-pane-modal">
                      <table style={{fontSize:'0.85rem'}}>
                          <thead><tr><th>Type</th><th>Status</th></tr></thead>
                          <tbody>
                              {leaves.filter(l => l.userId === staffModal.userid).map(l => (
                                  <tr key={l.id}><td>{l.type}</td><td>{l.status}</td></tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
                  <button onClick={() => handleAdminChangePassword(staffModal.dbId, staffModal.name)} className="btn blue" style={{width:'100%', marginTop:'20px', justifyContent:'center'}}><i className="fa-solid fa-key"></i> Change Staff Password</button>
                  <button onClick={() => setStaffModal(null)} className="btn grey" style={{width:'100%', marginTop:'10px', justifyContent:'center'}}>Close</button>
              </div>
          </div>
      )}

      {showProfileModal && (
        <div className="modal-overlay" onClick={closeProfilePortal}>
          <div className="modal-content profile-portal" onClick={e => e.stopPropagation()}>
            <button type="button" className="profile-close-btn" onClick={closeProfilePortal} aria-label="Close profile">
              <i className="fa-solid fa-xmark"></i>
            </button>

            <div className="profile-hero">
              <div className="profile-avatar" aria-hidden="true">
                {currentUser.name?.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'U'}
              </div>
              <div className="profile-identity">
                <p>MY PROFILE</p>
                <h2>{currentUser.name}</h2>
                <span className="profile-role-badge"><i className="fa-solid fa-shield-halved"></i> {currentUser.role}</span>
              </div>
            </div>

            <div className="profile-tabs" role="tablist" aria-label="Profile sections">
              <button type="button" role="tab" aria-selected={profileTab === 'PROFILE'} className={profileTab === 'PROFILE' ? 'active' : ''} onClick={() => changeProfileTab('PROFILE')}>
                <i className="fa-solid fa-user"></i> Personal Details
              </button>
              <button type="button" role="tab" aria-selected={profileTab === 'SECURITY'} className={profileTab === 'SECURITY' ? 'active' : ''} onClick={() => changeProfileTab('SECURITY')}>
                <i className="fa-solid fa-lock"></i> Password & Security
              </button>
            </div>

            {profileTab === 'PROFILE' ? (
              <form className="profile-form" onSubmit={handleUpdateProfile}>
                <div className="profile-section-heading">
                  <div>
                    <h3>Personal information</h3>
                    <p>Keep your contact details up to date.</p>
                  </div>
                </div>

                <div className="profile-account-grid">
                  <div className="profile-account-item">
                    <span>User ID</span>
                    <strong>{currentUser.userid}</strong>
                  </div>
                  <div className="profile-account-item">
                    <span>Account status</span>
                    <strong className="profile-status-active"><i className="fa-solid fa-circle-check"></i> Active</strong>
                  </div>
                </div>

                <div className="profile-fields-grid">
                  <label>
                    <span>Full name</span>
                    <div className="profile-input-wrap"><i className="fa-solid fa-user"></i><input name="fullName" defaultValue={currentUser.name || ''} autoComplete="name" required /></div>
                  </label>
                  <label>
                    <span>Email address <em className="required-field-label">Required</em></span>
                    <div className="profile-input-wrap"><i className="fa-solid fa-envelope"></i><input name="email" type="email" defaultValue={currentUser.email || ''} placeholder="name@example.com" autoComplete="email" required /></div>
                  </label>
                  <div className="profile-birthdate-field profile-field-wide">
                    <span>Date of birth <em className="required-field-label">Required</em></span>
                    <DateOfBirthField defaultValue={currentUser.dateOfBirth || ''} idPrefix="profile-birth-date" />
                  </div>
                  <label>
                    <span>Phone number <small className="optional-field-label">Optional</small></span>
                    <div className="profile-input-wrap"><i className="fa-solid fa-phone"></i><input name="phone" type="tel" defaultValue={currentUser.phone || ''} placeholder="e.g. 0123456789" autoComplete="tel" /></div>
                  </label>
                  <label>
                    <span>Role</span>
                    <div className="profile-input-wrap readonly"><i className="fa-solid fa-id-badge"></i><input value={currentUser.role} readOnly aria-label="Account role" /></div>
                  </label>
                </div>

                <div className="profile-device-card">
                  <span className="profile-device-icon"><i className={`fa-solid ${currentUser.role === 'admin' ? 'fa-shield-halved' : 'fa-mobile-screen-button'}`}></i></span>
                  <div>
                    <span>{currentUser.role === 'admin' ? 'Device access' : 'Approved device'}</span>
                    <strong>{currentUser.role === 'admin' ? 'Administrator - device restriction exempt' : (currentUser.approvedDeviceName || 'No mobile device approved')}</strong>
                  </div>
                  <i className={`fa-solid ${currentUser.role === 'admin' || currentUser.approvedDeviceId ? 'fa-circle-check' : 'fa-circle-minus'} profile-device-state`}></i>
                </div>

                {profileFeedback.message && (
                  <p className={`reset-feedback ${profileFeedback.type}`} role="status">
                    <i className={`fa-solid ${profileFeedback.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
                    {profileFeedback.message}
                  </p>
                )}

                <div className="profile-form-actions">
                  <button type="button" className="btn grey" onClick={closeProfilePortal}>Cancel</button>
                  <button type="submit" className="btn blue" disabled={isProfileSaving}>
                    {isProfileSaving ? <><i className="fa-solid fa-spinner fa-spin"></i> Saving...</> : <><i className="fa-solid fa-floppy-disk"></i> Save Profile</>}
                  </button>
                </div>
              </form>
            ) : (
              <form className="profile-form" onSubmit={handleChangePassword}>
                <div className="profile-section-heading">
                  <div>
                    <h3>Change password</h3>
                    <p>Confirm your current password before choosing a new one.</p>
                  </div>
                </div>

                <div className="profile-security-note">
                  <i className="fa-solid fa-shield-halved"></i>
                  <div><strong>Protect your account</strong><span>Use a password that other people cannot easily guess.</span></div>
                </div>

                <div className="profile-password-fields">
                  <label>
                    <span>Current password</span>
                    <div className="profile-input-wrap"><i className="fa-solid fa-lock"></i><input name="currentPass" type="password" autoComplete="current-password" required /></div>
                  </label>
                  <label>
                    <span>New password</span>
                    <div className="profile-input-wrap"><i className="fa-solid fa-key"></i><input name="newPass" type="password" autoComplete="new-password" required /></div>
                  </label>
                  <label>
                    <span>Confirm new password</span>
                    <div className="profile-input-wrap"><i className="fa-solid fa-check-double"></i><input name="confirmPass" type="password" autoComplete="new-password" required /></div>
                  </label>
                </div>

                {profileFeedback.message && (
                  <p className={`reset-feedback ${profileFeedback.type}`} role="status">
                    <i className={`fa-solid ${profileFeedback.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
                    {profileFeedback.message}
                  </p>
                )}

                <div className="profile-form-actions">
                  <button type="button" className="btn grey" onClick={closeProfilePortal}>Cancel</button>
                  <button type="submit" className="btn blue" disabled={isProfileSaving}>
                    {isProfileSaving ? <><i className="fa-solid fa-spinner fa-spin"></i> Updating...</> : <><i className="fa-solid fa-key"></i> Update Password</>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {selectedRoom && (
        <div className="modal-overlay" onClick={() => setSelectedRoom(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{position: 'relative'}}>
            <button onClick={() => toggleRoomKey(selectedRoom)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: selectedRoom.hasKey ? '#fbbf24' : '#e5e7eb', transition: 'color 0.2s' }} title={selectedRoom.hasKey ? "Room has key (Click to remove)" : "No key (Click to flag as having key)"}>
              <i className="fa-solid fa-key"></i>
            </button>
            <h2>Room {selectedRoom.id}</h2>
            <p>Status: <strong>{selectedRoom.status.toUpperCase()}</strong></p>
            <div style={{display:'flex', flexDirection:'column', gap:'10px', marginBottom: '20px'}}>
              {selectedRoom.status === 'maintenance' ? (
                  <button className="btn green" onClick={() => updateRoomStatus(selectedRoom.id, 'vacant')} style={{justifyContent:'center', padding:'15px'}}>Mark Done (Ready)</button>
              ) : (
                  <button className="btn grey" onClick={() => reportIssue(selectedRoom.id)} style={{justifyContent:'center', padding:'15px'}}>Report Issue</button>
              )}
            </div>
            <h3 style={{fontSize:'1rem', borderBottom:'2px solid #eee', paddingBottom:'5px'}}>Maintenance History</h3>
            <div className="scroll-pane scroll-pane-modal" style={{textAlign: 'left'}}>
                {tickets.filter(t => t.roomId === selectedRoom.id).length === 0 ? <p style={{color: '#999', fontSize: '0.85rem'}}>No history recorded.</p> : (
                    tickets.filter(t => t.roomId === selectedRoom.id).map(t => (
                        <div key={t.id} style={{padding: '10px 0', borderBottom: '1px dashed #eee'}}>
                            <div style={{display: 'flex', justifyContent: 'space-between'}}>
                                <strong>{t.issue}</strong>
                                <span style={{fontSize: '0.7rem', color: t.status === 'open' ? 'red' : 'green', fontWeight: 'bold'}}>{t.status.toUpperCase()}</span>
                            </div>
                            <div style={{fontSize: '0.8rem', color: '#666', marginTop: '5px'}}>
                                Reported by <b>{t.reportedBy || 'Unknown'}</b> on {formatDate(t.createdAt)}<br/>
                                {t.resolvedAt && <>Resolved: {formatDate(t.resolvedAt)} by {t.resolvedBy || 'Unknown'}</>}
                            </div>
                        </div>
                    ))
                )}
            </div>
            <button style={{marginTop:'15px', background:'none', border:'none', textDecoration:'underline', cursor:'pointer', color:'#666', width: '100%'}} onClick={() => setSelectedRoom(null)}>Close</button>
          </div>
        </div>
      )}

      {claimModal && (
        <div className="modal-overlay" onClick={() => { setClaimModal(false); resetClaimForm(); }}>
          <div className="modal-content large-modal" onClick={e => e.stopPropagation()}>
            <h2>{editingClaim ? 'Edit' : 'Add'} Claim Day Record</h2>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginTop:'15px'}}>
              <div><label style={{fontSize:'0.85rem', color:'#666'}}>Guest Name</label><input value={claimForm.guestName} onChange={e => setClaimForm({...claimForm, guestName: e.target.value})} placeholder="Full Name" /></div>
              <div><label style={{fontSize:'0.85rem', color:'#666'}}>IC Number</label><input value={claimForm.icNumber} onChange={e => setClaimForm({...claimForm, icNumber: e.target.value})} placeholder="IC/Passport No" /></div>
              <div><label style={{fontSize:'0.85rem', color:'#666'}}>Contact Number</label><input value={claimForm.contactNumber} onChange={e => setClaimForm({...claimForm, contactNumber: e.target.value})} placeholder="Phone Number" /></div>
              <div><label style={{fontSize:'0.85rem', color:'#666'}}>Booking Date</label><input type="date" value={claimForm.bookingDate} onChange={e => setClaimForm({...claimForm, bookingDate: e.target.value})} onClick={(e) => e.target.showPicker && e.target.showPicker()} style={{ cursor: 'pointer' }} required /></div>
              <div><label style={{fontSize:'0.85rem', color:'#666'}}>Room Type</label><input value={claimForm.roomType} onChange={e => setClaimForm({...claimForm, roomType: e.target.value})} placeholder="e.g., Deluxe, Suite" /></div>
              <div><label style={{fontSize:'0.85rem', color:'#666'}}>Payment (RM)</label><input type="number" value={claimForm.payment} onChange={e => setClaimForm({...claimForm, payment: e.target.value})} placeholder="550" /></div>
              <div><label style={{fontSize:'0.85rem', color:'#666'}}>Balance Claim (Days)</label><input type="number" value={claimForm.balanceClaim} onChange={e => setClaimForm({...claimForm, balanceClaim: parseInt(e.target.value) || 0})} placeholder="0" /></div>
            </div>
            <div style={{marginTop:'20px'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
                <label style={{fontSize:'0.85rem', color:'#666', fontWeight:'bold'}}>Used Dates</label>
                <button className="btn blue" style={{fontSize:'0.75rem', padding:'5px 10px'}} onClick={addUsedDate}><i className="fa-solid fa-plus"></i> Add Date</button>
              </div>
              {claimForm.usedDates.length === 0 ? <p style={{color:'#999', fontSize:'0.85rem', textAlign:'center', padding:'20px'}}>No dates added yet</p> : (
                <div style={{maxHeight:'200px', overflowY:'auto', border:'1px solid #eee', borderRadius:'5px', padding:'10px'}}>
                  {claimForm.usedDates.map((used, idx) => (
                    <div key={idx} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px', background:'#f8f9fa', marginBottom:'5px', borderRadius:'3px'}}>
                      <span style={{fontSize:'0.85rem'}}>{used.date} - {used.roomType} {used.roomNumber} ({used.staff})</span>
                      <button className="btn red" style={{fontSize:'0.7rem', padding:'3px 8px'}} onClick={() => removeUsedDate(idx)}><i className="fa-solid fa-trash"></i></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{display:'flex', gap:'10px', marginTop:'20px'}}>
              <button className="btn grey" style={{flex:1, justifyContent:'center'}} onClick={() => { setClaimModal(false); resetClaimForm(); }}>Cancel</button>
              <button className="btn blue" style={{flex:1, justifyContent:'center'}} onClick={editingClaim ? handleUpdateClaim : handleAddClaim}>{editingClaim ? 'Update' : 'Add'} Record</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
// End of App component
