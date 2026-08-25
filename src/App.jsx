import React, { useState, useEffect, useMemo, useRef } from 'react';
import { auth, db, staffProvisioningAuth } from './firebase';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, deleteField, serverTimestamp, query, orderBy, where, getDocs, getDoc, limit, setDoc, writeBatch } from 'firebase/firestore';
import { confirmPasswordReset, createUserWithEmailAndPassword, deleteUser, EmailAuthProvider, reauthenticateWithCredential, reload, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateEmail, updatePassword, verifyBeforeUpdateEmail, verifyPasswordResetCode } from 'firebase/auth';
import './App.css';
import { parseHousekeepingArrangementText } from './housekeepingCustomerParser';
import { getUpcomingBirthdays } from './birthdayAlerts';
import { getAnnualLeaveBalanceId, getAnnualLeaveDaysByYear, getAnnualLeaveSummary } from './annualLeave';
import { filterAndSortLaundryStockMovements } from './laundryStockFilter';

// ICONS & TABS
const ICONS = { 
  ROOMS: { icon: "fa-solid fa-bed", label: "Rooms" },
  TICKETS: { icon: "fa-solid fa-wrench", label: "Tickets" },
  CUSTOMERS: { icon: "fa-solid fa-address-book", label: "Customer Details" },
  ITEMS: { icon: "fa-solid fa-boxes-stacked", label: "Item Request" },
  LAUNDRY: { icon: "fa-solid fa-shirt", label: "Laundry/Stock" },
  HOUSEKEEPING: { icon: "fa-solid fa-broom", label: "Housekeeping" },
  CLAIMS: { icon: "fa-solid fa-calendar-check", label: "Claim Days" },
  DEPOSIT: { icon: "fa-solid fa-money-bill-wave", label: "Deposits" },
  VERIFY: { icon: "fa-solid fa-file-invoice-dollar", label: "Verification" },
  REQ: { icon: "fa-solid fa-paper-plane", label: "Request Staff" },
  SHIFT: { icon: "fa-solid fa-clock", label: "My Shift" },
  MC: { icon: "fa-solid fa-notes-medical", label: "Apply Leave/MC" },
  ATT_REPORT: { icon: "fa-solid fa-clipboard-user", label: "Attendance Portal" },
  HELP: { icon: "fa-solid fa-comment", label: "Help" }
};

const LEAVE_TYPES = ['Annual leave', 'Unpaid leave', 'PH CLAIM', 'MC'];

const HELP_TOPICS = [
  {
    id: 'change-password',
    icon: 'fa-solid fa-key',
    title: 'How to change your password',
    summary: 'Update your password from your personal profile.',
    steps: [
      'Select your name at the top-right of the screen.',
      'Open Password & Security.',
      'Enter your current password, then enter and confirm your new password.',
      'Select Update Password to save the change.'
    ],
    tip: 'Use a password that other people cannot easily guess or reuse.',
    action: 'SECURITY',
    actionLabel: 'Open Password & Security',
    featured: true,
    audience: 'all',
    keywords: 'change update password security profile account'
  },
  {
    id: 'forgot-password',
    icon: 'fa-solid fa-unlock-keyhole',
    title: 'Forgot your password?',
    summary: 'Receive a secure Firebase password-reset link by email.',
    steps: [
      'Log out and select Forgot password? on the login screen.',
      'Enter your User ID and select Email Reset Link.',
      'Open the email sent to the address saved in your profile.',
      'Follow the secure link, enter New Password and Confirm Password, then save it.'
    ],
    tip: 'If the link does not arrive after a few minutes, check your email Spam or Junk folder.',
    audience: 'all',
    keywords: 'forgot reset cannot login password user id administrator'
  },
  {
    id: 'update-profile',
    icon: 'fa-solid fa-address-card',
    title: 'Update your personal details',
    summary: 'Keep your name, email, date of birth and phone number current.',
    steps: [
      'Select your name at the top-right of the screen.',
      'Stay on Personal Details and update the required information.',
      'Select Save Profile.'
    ],
    action: 'PROFILE',
    actionLabel: 'Open Personal Details',
    audience: 'all',
    keywords: 'profile personal details email phone birthday name'
  },
  {
    id: 'attendance',
    icon: 'fa-solid fa-mobile-screen-button',
    title: 'Clock in and clock out',
    summary: 'Record attendance from your approved mobile device at the hotel.',
    steps: [
      'Open My Shift on your approved phone or tablet.',
      'Allow location access when your browser asks for it.',
      'Select Clock In when your shift starts and Clock Out when it ends.',
      'Check Recent Activity to confirm the record was saved.'
    ],
    tip: 'If your account is linked to another device, ask an administrator to reset the approved device.',
    action: 'SHIFT',
    actionLabel: 'Go to My Shift',
    audience: 'all',
    keywords: 'attendance shift clock punch in out location device mobile'
  },
  {
    id: 'room-ticket',
    icon: 'fa-solid fa-screwdriver-wrench',
    title: 'Report a room problem',
    summary: 'Create and follow up a maintenance ticket for a room.',
    steps: [
      'Open Rooms and select the affected room.',
      'Create a maintenance ticket and describe the problem clearly.',
      'Open Tickets to check its status or update the work completed.'
    ],
    action: 'TICKETS',
    actionLabel: 'Go to Tickets',
    audience: 'all',
    keywords: 'room issue problem repair maintenance ticket report'
  },
  {
    id: 'daily-housekeeping',
    icon: 'fa-solid fa-broom',
    title: 'Record daily room housekeeping',
    summary: 'Record which staff members handled housekeeping for each room and date.',
    steps: [
      'Open Housekeeping from the navigation menu.',
      'Choose the month you want to schedule.',
      'Find the room on the left and the date across the top.',
      'Type directly into either Remark field inside a room/date cell, or open the cell to edit customer information and staff together. Changes save automatically.',
      'For faster entry, paste the complete LIST ROOM ARRANGEMENT into Smart Customer Key In and confirm the recognised rooms before saving.'
    ],
    tip: 'The smart text bar recognises English, Chinese and Malay room/date labels. Tick every staff member who worked together.',
    action: 'HOUSEKEEPING',
    actionLabel: 'Go to Housekeeping',
    audience: 'all',
    keywords: 'daily housekeeping room cleaner staff record assignment clean customer guest smart key in remark'
  },
  {
    id: 'request-staff',
    icon: 'fa-solid fa-paper-plane',
    title: 'Send a request to another staff member',
    summary: 'Assign a request and track whether it is accepted or completed.',
    steps: [
      'Open Request Staff and choose the receiving staff member.',
      'Write a clear request, including the room number when relevant.',
      'Send it and check the same page for the latest status.'
    ],
    action: 'REQ',
    actionLabel: 'Go to Request Staff',
    audience: 'all',
    keywords: 'send request staff task assign accept complete'
  },
  {
    id: 'request-mc',
    icon: 'fa-solid fa-notes-medical',
    title: 'Apply for Leave/MC',
    summary: 'Send your leave or medical certificate details for review.',
    steps: [
      'Open Apply Leave/MC and enter the relevant dates.',
      'Add the relevant reason or remarks.',
      'Submit the request and return to the page to check its status.'
    ],
    action: 'MC',
    actionLabel: 'Go to Apply Leave/MC',
    audience: 'all',
    keywords: 'mc medical certificate sick leave request status'
  },
  {
    id: 'admin-password-reset',
    icon: 'fa-solid fa-user-lock',
    title: 'Send a staff password-reset email',
    summary: 'Send a secure Firebase reset link to the email in a staff profile.',
    steps: [
      'Open Admin and find Staff Management.',
      'Select the staff member and confirm that their email address is correct.',
      'Choose Send Password Reset Email.',
      'Ask the staff member to follow the link, enter New Password and Confirm Password, then save it.'
    ],
    action: 'ADMIN',
    actionLabel: 'Open Admin',
    audience: 'admin',
    keywords: 'admin staff forgot reset password pending temporary'
  },
  {
    id: 'admin-device-reset',
    icon: 'fa-solid fa-mobile-retro',
    title: 'Reset a staff approved device',
    summary: 'Allow a staff member to bind their account to a replacement phone or tablet.',
    steps: [
      'Open Admin and locate the staff member.',
      'Check the Approved Device status and select Reset Device.',
      'Ask the staff member to sign in again on the device they want to use.'
    ],
    tip: 'Only reset a device after confirming the request belongs to that staff member.',
    action: 'ADMIN',
    actionLabel: 'Open Admin',
    audience: 'admin',
    keywords: 'admin approved device reset phone tablet bind linked'
  },
  {
    id: 'admin-attendance',
    icon: 'fa-solid fa-clipboard-user',
    title: 'Review attendance records',
    summary: 'Check staff logs, summaries, roster status and away punches.',
    steps: [
      'Open Attendance Portal.',
      'Choose Logs, Summary or Roster depending on what you need.',
      'Use the date, staff and search filters to narrow the results.',
      'Review away-punch alerts and acknowledge them after checking.'
    ],
    action: 'ATT_REPORT',
    actionLabel: 'Open Attendance Portal',
    audience: 'admin',
    keywords: 'admin attendance report logs summary roster away punch alert'
  },
  {
    id: 'admin-utility-bills',
    icon: 'fa-solid fa-file-invoice-dollar',
    title: 'Record a monthly SAJ or TNB bill',
    summary: 'Add and review the hotel water and electricity bill register.',
    steps: [
      'Open SAJ / TNB Bills under Administration in the left navigation.',
      'Choose SAJ or TNB, then enter the billing month and amount.',
      'Add the bill date, due date, payment status and optional reference details.',
      'Select Save Bill. Saving the same provider and month updates that record.'
    ],
    tip: 'This page and its records are available only to administrators.',
    action: 'BILLS',
    actionLabel: 'Open SAJ / TNB Bills',
    audience: 'admin',
    keywords: 'admin saj tnb water electricity utility monthly bill payment'
  },
  {
    id: 'admin-manual-backup',
    icon: 'fa-solid fa-cloud-arrow-down',
    title: 'Download a manual data backup',
    summary: 'Save a private JSON copy of the current hotel Firestore records.',
    steps: [
      'Open Admin from the left navigation.',
      'At the top of the page, select Download Full Backup.',
      'Wait until the browser downloads the dated JSON file.',
      'Move the file to a secure Google Drive, OneDrive or external drive folder.'
    ],
    tip: 'Download a new backup every week and keep the latest four to eight files. Never share a backup publicly.',
    action: 'ADMIN',
    actionLabel: 'Open Admin Backup',
    audience: 'admin',
    keywords: 'admin manual data backup download json firestore copy save'
  }
];

// LAUNDRY ITEMS
const LAUNDRY_ITEMS = [
  "Bed Sheet", "Duvet Cover", "Pillow Case", "Bath Towel", "Bath Mat", 
  "Bath Towel New", "Face Towel", "Pillow Pad", "Pillow", "Comforter", 
  "Mattress Pad", "Shower Curtain", "Duvet Insert", "Day Curtain", 
  "Night Curtain", "Floor Mat", "Blanket", "Wiping Cloth", "Bed Runner"
];

const LAUNDRY_STOCK_ITEMS = [
  "Bed Sheet", "Duvet Cover", "Pillow Case", "Towel", "Pillow", "Blanket", "Sejadah"
];

const BACKUP_COLLECTIONS = [
  'rooms', 'users', 'tickets', 'customerDetails', 'requests', 'attendance',
  'leaves', 'annualLeaveBalances', 'inventory', 'claimDays', 'laundry', 'stock', 'laundryStockMovements',
  'housekeepingDaily', 'housekeepingCustomerInfo', 'deposits', 'verifications', 'utilityBills', 'auditLogs',
  'adminAlerts', 'guestFeedback', 'settings'
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

const formatDateTime = (timestamp) => {
  if (!timestamp) return '-';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString('en-MY', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
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

const serializeBackupValue = (value) => {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value?.toDate === 'function') {
    return { __firestoreType: 'timestamp', value: value.toDate().toISOString() };
  }
  if (typeof value?.latitude === 'number' && typeof value?.longitude === 'number') {
    return { __firestoreType: 'geopoint', latitude: value.latitude, longitude: value.longitude };
  }
  if (typeof value?.path === 'string' && value?.firestore) {
    return { __firestoreType: 'reference', path: value.path };
  }
  if (Array.isArray(value)) return value.map(serializeBackupValue);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => [key, serializeBackupValue(nestedValue)]));
  }
  return value;
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

const monthIsoToDisplay = (value) => {
  const match = (value || '').match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!match) return '';
  return `${Number(match[2])}/${match[1]}`;
};

const monthDisplayToIso = (value) => {
  const match = (value || '').trim().match(/^(0?[1-9]|1[0-2])\/(\d{4})$/);
  if (!match) return '';
  return `${match[2]}-${match[1].padStart(2, '0')}`;
};

const getLocalIsoDate = (date = new Date()) => (
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
);

const getLocalTimeValue = (date = new Date()) => (
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
);

const formatClockTime = (value) => {
  if (!/^\d{2}:\d{2}$/.test(value || '')) return value || '-';
  const [hours, minutes] = value.split(':').map(Number);
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString('en-MY', {
    hour: '2-digit', minute: '2-digit', hour12: true
  });
};

const CUSTOMER_PHONE_PATTERN = /^\+?[0-9][0-9\s-]{7,18}$/;

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
          lang="en-GB"
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
          lang="en-GB"
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

const MonthYearField = ({ value, onChange }) => {
  const pickerRef = useRef(null);
  const [displayValue, setDisplayValue] = useState(() => monthIsoToDisplay(value));

  const openMonthPicker = () => {
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
    <div className="profile-date-entry laundry-month-year-entry">
      <i className="fa-solid fa-calendar-days" aria-hidden="true"></i>
      <input
        type="text"
        value={displayValue}
        onChange={event => {
          const nextDisplayValue = event.target.value;
          setDisplayValue(nextDisplayValue);
          const nextIsoValue = monthDisplayToIso(nextDisplayValue);
          if (nextIsoValue) onChange(nextIsoValue);
        }}
        onBlur={() => {
          if (!monthDisplayToIso(displayValue)) setDisplayValue(monthIsoToDisplay(value));
        }}
        placeholder="8/2026"
        inputMode="numeric"
        aria-label="Month and year in month slash year format"
      />
      <button type="button" className="profile-calendar-btn" onClick={openMonthPicker} aria-label="Choose month and year" title="Choose month and year">
        <i className="fa-solid fa-calendar-days"></i>
      </button>
      <input
        ref={pickerRef}
        className="profile-native-date-picker"
        type="month"
        lang="en-GB"
        value={value}
        onChange={event => {
          if (!event.target.value) return;
          setDisplayValue(monthIsoToDisplay(event.target.value));
          onChange(event.target.value);
        }}
        tabIndex="-1"
        aria-hidden="true"
      />
    </div>
  );
};

const PasswordField = ({ wrapperClassName = '', leadingIcon = '', toggleLabel = 'password', ...inputProps }) => {
  const [isVisible, setIsVisible] = useState(false);
  const visibilityAction = isVisible ? 'Hide' : 'Show';

  return (
    <div className={`password-field ${wrapperClassName}`.trim()}>
      {leadingIcon && <i className={leadingIcon} aria-hidden="true"></i>}
      <input {...inputProps} type={isVisible ? 'text' : 'password'} />
      <button
        type="button"
        className="password-visibility-toggle"
        onClick={() => setIsVisible((visible) => !visible)}
        aria-label={`${visibilityAction} ${toggleLabel}`}
        aria-pressed={isVisible}
        title={`${visibilityAction} ${toggleLabel}`}
      >
        <i className={`fa-solid ${isVisible ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true"></i>
      </button>
    </div>
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

const isInvalidAuthCredential = (error) => [
  'auth/invalid-credential',
  'auth/invalid-login-credentials',
  'auth/user-not-found',
  'auth/wrong-password'
].includes(error?.code);

const isAuthProviderUnavailable = (error) => [
  'auth/operation-not-allowed',
  'auth/configuration-not-found'
].includes(error?.code);

const normalizeEmail = (email) => email?.trim().toLowerCase() || '';

const getAuthenticationEmail = (user) => normalizeEmail(user?.authEmail || user?.email);

const syncFirebaseEmail = async (firebaseUser, email) => {
  const normalizedEmail = normalizeEmail(email);
  if (normalizeEmail(firebaseUser?.email) === normalizedEmail) return 'synced';

  try {
    await updateEmail(firebaseUser, normalizedEmail);
    return 'synced';
  } catch (error) {
    // updateEmail is blocked when Email Enumeration Protection is enabled.
    // Firebase's supported replacement verifies the new address before applying it.
    if (error?.code !== 'auth/operation-not-allowed') throw error;

    try {
      const continueUrl = typeof window === 'undefined'
        ? undefined
        : `${window.location.origin}${window.location.pathname}`;
      await verifyBeforeUpdateEmail(firebaseUser, normalizedEmail, continueUrl ? { url: continueUrl } : undefined);
      return 'verification-sent';
    } catch (verificationError) {
      if (isAuthProviderUnavailable(verificationError)) return 'deferred';
      throw verificationError;
    }
  }
};

const getAuthSetupMessage = (error, fallback) => {
  if (isAuthProviderUnavailable(error)) {
    return 'Email/password sign-in is not enabled in Firebase Authentication. Please contact the system administrator.';
  }
  if (error?.code === 'auth/invalid-email') return 'The email address saved for this account is not valid.';
  if (error?.code === 'auth/weak-password') return 'Firebase requires the password to contain at least 6 characters.';
  if (error?.code === 'auth/too-many-requests') return 'Too many attempts. Please wait a few minutes and try again.';
  return fallback;
};

const maskEmailAddress = (email) => {
  const [localPart, domain] = (email || '').split('@');
  if (!localPart || !domain) return 'your registered email address';
  return `${localPart[0]}${'*'.repeat(Math.max(2, Math.min(localPart.length - 1, 5)))}@${domain}`;
};

const provisionLegacyAuthAccount = async (email, legacyPassword) => {
  try {
    let credential;
    try {
      credential = await createUserWithEmailAndPassword(staffProvisioningAuth, email, legacyPassword);
    } catch (error) {
      if (error.code !== 'auth/weak-password') throw error;
      const migrationPassword = `Migrate-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-Aa1!`}`;
      credential = await createUserWithEmailAndPassword(staffProvisioningAuth, email, migrationPassword);
    }
    return { uid: credential.user.uid, created: true };
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') return { uid: null, created: false };
    throw error;
  } finally {
    await signOut(staffProvisioningAuth).catch(() => {});
  }
};

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

const approveOrValidateMobileDevice = async (userDocId) => {
  const deviceId = getDeviceId(true);
  const userRef = doc(db, 'users', userDocId);
  const userSnapshot = await getDoc(userRef);
  if (!userSnapshot.exists()) throw new Error('USER_NOT_FOUND');

  const latestUser = userSnapshot.data();
  if (!isUserActive(latestUser)) throw new Error('ACCOUNT_INACTIVE');
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
  const [customerDetails, setCustomerDetails] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [users, setUsers] = useState([]); 
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [annualLeaveBalances, setAnnualLeaveBalances] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [claimDays, setClaimDays] = useState([]);
  const [laundry, setLaundry] = useState([]);
  const [laundryStockMovements, setLaundryStockMovements] = useState([]);
  const [housekeepingRecords, setHousekeepingRecords] = useState([]);
  const [housekeepingCustomerRecords, setHousekeepingCustomerRecords] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [laundryItemDetails, setLaundryItemDetails] = useState({});
  const [auditLogs, setAuditLogs] = useState([]);
  const [adminAlerts, setAdminAlerts] = useState([]);
  const [deposits, setDeposits] = useState([]); 
  const [verifications, setVerifications] = useState([]); 
  const [utilityBills, setUtilityBills] = useState([]);
  const [guestFeedback, setGuestFeedback] = useState([]);

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
  const [resetLinkState, setResetLinkState] = useState({ status: 'idle', email: '', message: '' });
  const [isResetLinkSubmitting, setIsResetLinkSubmitting] = useState(false);
  const [acknowledgingAlertId, setAcknowledgingAlertId] = useState('');
  const [isMcSubmitting, setIsMcSubmitting] = useState(false);
  const [annualLeaveYear, setAnnualLeaveYear] = useState(() => new Date().getFullYear());
  const [annualLeaveDrafts, setAnnualLeaveDrafts] = useState({});
  const [savingAnnualLeaveStaffId, setSavingAnnualLeaveStaffId] = useState('');
  const [annualLeaveFeedback, setAnnualLeaveFeedback] = useState({ type: '', message: '' });

  // Forms UI
  const [lastClock, setLastClock] = useState(null);
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketSort, setTicketSort] = useState('date-desc');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerCallTime, setCustomerCallTime] = useState(getLocalTimeValue);
  const [customerFeedback, setCustomerFeedback] = useState({ type: '', message: '' });
  const [isCustomerSaving, setIsCustomerSaving] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerEditFeedback, setCustomerEditFeedback] = useState({ type: '', message: '' });
  const [isCustomerUpdating, setIsCustomerUpdating] = useState(false);
  const [deletingCustomerId, setDeletingCustomerId] = useState('');
  const [helpSearch, setHelpSearch] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDrawerCollapsed, setIsDrawerCollapsed] = useState(() => (
    typeof window !== 'undefined' && window.localStorage.getItem('hotelDrawerCollapsed') === 'true'
  ));
  const [utilityBillFeedback, setUtilityBillFeedback] = useState({ type: '', message: '' });
  const [isUtilityBillSaving, setIsUtilityBillSaving] = useState(false);
  const [isBackupDownloading, setIsBackupDownloading] = useState(false);
  const [backupFeedback, setBackupFeedback] = useState({ type: '', message: '' });
  const [guestFeedbackSearch, setGuestFeedbackSearch] = useState('');
  const [guestFeedbackSource, setGuestFeedbackSource] = useState('ALL');
  const [guestFeedbackLoadError, setGuestFeedbackLoadError] = useState('');

  // Laundry UI
  const [laundryForm, setLaundryForm] = useState({});
  const [receiveLaundryModal, setReceiveLaundryModal] = useState(null);
  const [editStockModal, setEditStockModal] = useState(null);
  const [laundryStockMonth, setLaundryStockMonth] = useState(getCurrentMonthString);
  const [laundryStockInlineEntries, setLaundryStockInlineEntries] = useState({});
  const [laundryStockFeedback, setLaundryStockFeedback] = useState({ type: '', message: '' });
  const [savingLaundryStockDate, setSavingLaundryStockDate] = useState('');
  const [laundryStockStartDate, setLaundryStockStartDate] = useState(getLocalIsoDate);
  const [laundryStockEndDate, setLaundryStockEndDate] = useState(getLocalIsoDate);

  // Daily Housekeeping UI
  const [housekeepingMonth, setHousekeepingMonth] = useState(getCurrentMonthString);
  const [housekeepingFeedback, setHousekeepingFeedback] = useState({ type: '', message: '' });
  const [housekeepingPendingAssignments, setHousekeepingPendingAssignments] = useState({});
  const [housekeepingStaffModal, setHousekeepingStaffModal] = useState(null);
  const [housekeepingAutoSaveStatus, setHousekeepingAutoSaveStatus] = useState('idle');
  const [housekeepingCustomerAutoSaveStatus, setHousekeepingCustomerAutoSaveStatus] = useState('idle');
  const [housekeepingSmartText, setHousekeepingSmartText] = useState('');
  const [isHousekeepingSmartSaving, setIsHousekeepingSmartSaving] = useState(false);
  const [housekeepingInlineCustomerDrafts, setHousekeepingInlineCustomerDrafts] = useState({});
  const [housekeepingPendingCustomerCells, setHousekeepingPendingCustomerCells] = useState({});
  const [housekeepingActiveCell, setHousekeepingActiveCell] = useState(null);
  const housekeepingAutoSaveTimerRef = useRef(null);
  const housekeepingCustomerAutoSaveTimerRef = useRef(null);
  const housekeepingInlineCustomerTimersRef = useRef({});

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
  const changeView = (nextView) => {
    if (['ADMIN', 'ATT_REPORT', 'BILLS', 'GUEST_FEEDBACK'].includes(nextView) && currentUser?.role !== 'admin') return;
    setView(nextView);
    setIsDrawerOpen(false);
  };
  const passwordResetCode = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'resetPassword' ? (params.get('oobCode') || '') : '';
  }, []);

  useEffect(() => () => {
    if (housekeepingAutoSaveTimerRef.current) clearTimeout(housekeepingAutoSaveTimerRef.current.timerId);
    if (housekeepingCustomerAutoSaveTimerRef.current) clearTimeout(housekeepingCustomerAutoSaveTimerRef.current.timerId);
    Object.values(housekeepingInlineCustomerTimersRef.current).forEach(timer => clearTimeout(timer));
  }, []);

  useEffect(() => {
    window.localStorage.setItem('hotelDrawerCollapsed', String(isDrawerCollapsed));
  }, [isDrawerCollapsed]);

  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') setAnnualLeaveYear(new Date().getFullYear());
  }, [currentUser]);

  useEffect(() => {
    if (!passwordResetCode) return;
    let cancelled = false;
    setResetLinkState({ status: 'checking', email: '', message: '' });

    verifyPasswordResetCode(auth, passwordResetCode)
      .then(email => {
        if (!cancelled) setResetLinkState({ status: 'ready', email, message: '' });
      })
      .catch(error => {
        console.error('Password reset link verification failed:', error);
        if (!cancelled) {
          setResetLinkState({
            status: 'error',
            email: '',
            message: 'This password reset link is invalid or has expired. Request a new link from the login page.'
          });
        }
      });

    return () => { cancelled = true; };
  }, [passwordResetCode]);

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

        await auth.authStateReady();

        const userSnapshot = await getDoc(doc(db, 'users', savedUser.dbId));
        if (!userSnapshot.exists()) throw new Error('USER_NOT_FOUND');

        const latestUser = { dbId: userSnapshot.id, ...userSnapshot.data() };
        if (!isUserActive(latestUser)) throw new Error('ACCOUNT_INACTIVE');
        if (latestUser.authUid && auth.currentUser?.uid !== latestUser.authUid) {
          throw new Error('AUTH_SESSION_EXPIRED');
        }
        if (latestUser.authUid && auth.currentUser && latestUser.pendingAuthEmail) {
          await reload(auth.currentUser).catch(() => {});
          if (normalizeEmail(auth.currentUser.email) === normalizeEmail(latestUser.pendingAuthEmail)) {
            latestUser.email = normalizeEmail(latestUser.pendingAuthEmail);
            latestUser.authEmail = normalizeEmail(latestUser.pendingAuthEmail);
            delete latestUser.pendingAuthEmail;
            await updateDoc(doc(db, 'users', savedUser.dbId), {
              email: latestUser.email,
              authEmail: latestUser.authEmail,
              pendingAuthEmail: deleteField(),
              profileUpdatedAt: serverTimestamp()
            });
          }
        }
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
        const userObj = { ...latestUser };
        delete userObj.password;

        if (!cancelled) {
          setCurrentUser(userObj);
          localStorage.setItem('hotelUser', JSON.stringify(userObj));
          setView(userObj.role === 'admin' ? 'ADMIN' : 'ROOMS');
        }
      } catch (error) {
        localStorage.removeItem('hotelUser');
        await signOut(auth).catch(() => {});
        if (!cancelled && (error.code === 'DEVICE_ALREADY_BOUND' || error.message === 'DEVICE_ALREADY_BOUND')) {
          setLoginError(DEVICE_BINDING_ERROR);
        } else if (!cancelled && (error.code === 'DEVICE_BINDING_RESET' || error.message === 'DEVICE_BINDING_RESET')) {
          setLoginError(DEVICE_BINDING_RESET_MESSAGE);
        } else if (!cancelled && error.message === 'ACCOUNT_INACTIVE') {
          setLoginError('This staff account is inactive. Please contact an administrator.');
        } else if (!cancelled && error.message === 'AUTH_SESSION_EXPIRED') {
          setLoginError('Your session has expired. Please sign in again.');
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

  useEffect(() => {
    if (!isDrawerOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsDrawerOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isDrawerOpen]);

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
      const qLeaves = query(collection(db, "leaves"), orderBy("createdAt", "desc"), limit(500));
      unsubAdminLeaves = onSnapshot(qLeaves, (snap) => setLeaves(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }
    
    return () => {
      unsubRooms();
      unsubUsers();
      unsubAdminLeaves();
    };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !isProfileComplete(currentUser)) return undefined;
    const shouldLoadAdminBalances = currentUser.role === 'admin' && view === 'ADMIN';
    const shouldLoadOwnBalance = currentUser.role !== 'admin' && view === 'MC';
    if (!shouldLoadAdminBalances && !shouldLoadOwnBalance) return undefined;

    if (shouldLoadAdminBalances) {
      const balancesQuery = query(
        collection(db, 'annualLeaveBalances'),
        where('year', '==', annualLeaveYear),
        limit(500)
      );
      return onSnapshot(balancesQuery, snapshot => {
        setAnnualLeaveBalances(snapshot.docs.map(balanceDoc => ({ id: balanceDoc.id, ...balanceDoc.data() })));
      }, error => {
        console.error('Annual leave balances listener failed:', error);
        setAnnualLeaveFeedback({ type: 'error', message: 'Unable to load annual leave balances.' });
      });
    }

    const balanceRef = doc(db, 'annualLeaveBalances', getAnnualLeaveBalanceId(annualLeaveYear, currentUser.dbId));
    return onSnapshot(balanceRef, snapshot => {
      setAnnualLeaveBalances(snapshot.exists() ? [{ id: snapshot.id, ...snapshot.data() }] : []);
    }, error => {
      console.error('Own annual leave balance listener failed:', error);
      setAnnualLeaveFeedback({ type: 'error', message: 'Unable to load your annual leave balance.' });
    });
  }, [currentUser, view, annualLeaveYear]);

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

    if (view === 'CUSTOMERS') {
      const qCustomerDetails = query(collection(db, "customerDetails"), orderBy("createdAt", "desc"), limit(200));
      unsubs.push(onSnapshot(qCustomerDetails, (snap) => setCustomerDetails(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
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
      const qLeaves = query(collection(db, "leaves"), where("userId", "==", currentUser.userid), limit(500));
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
      const qLaundryStockMovements = query(
        collection(db, "laundryStockMovements"),
        where("month", "==", laundryStockMonth)
      );
      unsubs.push(onSnapshot(qLaundryStockMovements, (snap) => {
        setLaundryStockMovements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }));
    }

    if (view === 'HOUSEKEEPING') {
      const qHousekeeping = query(
        collection(db, "housekeepingDaily"),
        where("month", "==", housekeepingMonth),
        limit(2000)
      );
      unsubs.push(onSnapshot(qHousekeeping, (snap) => {
        const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        records.sort((a, b) => {
          const dateComparison = (b.serviceDate || '').localeCompare(a.serviceDate || '');
          if (dateComparison !== 0) return dateComparison;
          return String(a.roomId || '').localeCompare(String(b.roomId || ''), undefined, { numeric: true });
        });
        setHousekeepingRecords(records);
      }));
      const qHousekeepingCustomers = query(
        collection(db, "housekeepingCustomerInfo"),
        where("month", "==", housekeepingMonth),
        limit(1000)
      );
      unsubs.push(onSnapshot(qHousekeepingCustomers, (snap) => {
        setHousekeepingCustomerRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (error) => {
        console.error('Housekeeping customer information listener failed:', error);
        setHousekeepingFeedback({ type: 'error', message: 'Unable to load housekeeping customer information.' });
      }));
    }

    if (view === 'DEPOSIT') {
      const qDeposits = query(collection(db, "deposits"), orderBy("createdAt", "desc"), limit(200));
      unsubs.push(onSnapshot(qDeposits, (snap) => setDeposits(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
    }

    if (view === 'VERIFY') {
      const qVerify = query(collection(db, "verifications"), orderBy("createdAt", "desc"), limit(200));
      unsubs.push(onSnapshot(qVerify, (snap) => setVerifications(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
    }

    if (view === 'BILLS' && currentUser.role === 'admin') {
      const qUtilityBills = query(collection(db, "utilityBills"), orderBy("billingMonth", "desc"), limit(240));
      unsubs.push(onSnapshot(qUtilityBills, (snap) => {
        const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        records.sort((a, b) => {
          const monthComparison = String(b.billingMonth || '').localeCompare(String(a.billingMonth || ''));
          return monthComparison || String(a.provider || '').localeCompare(String(b.provider || ''));
        });
        setUtilityBills(records);
      }, (error) => {
        console.error('Utility bill listener failed:', error);
        setUtilityBillFeedback({ type: 'error', message: 'Unable to load SAJ / TNB bill records.' });
      }));
    }

    if (view === 'GUEST_FEEDBACK' && currentUser.role === 'admin') {
      setGuestFeedbackLoadError('');
      const feedbackQuery = query(collection(db, 'guestFeedback'), orderBy('submittedAt', 'desc'), limit(500));
      unsubs.push(onSnapshot(feedbackQuery, snapshot => {
        setGuestFeedback(snapshot.docs.map(feedbackDoc => ({ id: feedbackDoc.id, ...feedbackDoc.data() })));
      }, error => {
        console.error('Guest feedback listener failed:', error);
        setGuestFeedbackLoadError('Unable to load guest feedback. Please try again.');
      }));
    }

    if (view === 'ADMIN' && currentUser.role === 'admin') {
      const qAudit = query(collection(db, "auditLogs"), orderBy("timestamp", "desc"), limit(300));
      unsubs.push(onSnapshot(qAudit, (snap) => setAuditLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
    }

    return () => unsubs.forEach(unsubscribe => unsubscribe());
  }, [currentUser, view, selectedRoom, staffModal, attFilterMonth, laundryStockMonth, housekeepingMonth]);

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
      let firebaseUser = null;
      const authenticationEmails = [userData.pendingAuthEmail, userData.authEmail, userData.email]
        .map(normalizeEmail)
        .filter((email, index, emails) => EMAIL_PATTERN.test(email) && emails.indexOf(email) === index);

      if (authenticationEmails.length > 0) {
        let lastAuthError = null;
        for (const email of authenticationEmails) {
          try {
            firebaseUser = (await signInWithEmailAndPassword(auth, email, loginPass)).user;
            break;
          } catch (error) {
            lastAuthError = error;
            if (isAuthProviderUnavailable(error)) break;
            if (!isInvalidAuthCredential(error)) throw error;
          }
        }

        if (!firebaseUser && userData.password === loginPass && !isAuthProviderUnavailable(lastAuthError)) {
          try {
            const migrationEmail = normalizeEmail(userData.email) || authenticationEmails[0];
            firebaseUser = (await createUserWithEmailAndPassword(auth, migrationEmail, loginPass)).user;
          } catch (migrationError) {
            if (migrationError.code === 'auth/email-already-in-use') {
              const incorrectPasswordError = new Error('INCORRECT_PASSWORD');
              incorrectPasswordError.code = 'INCORRECT_PASSWORD';
              throw incorrectPasswordError;
            }
            if (!isAuthProviderUnavailable(migrationError)) throw migrationError;
          }
        }

        if (!firebaseUser && userData.password !== loginPass) throw lastAuthError || new Error('INCORRECT_PASSWORD');

        if (firebaseUser) {
          if (userData.authUid && userData.authUid !== firebaseUser.uid) {
            await signOut(auth).catch(() => {});
            throw new Error('AUTH_ACCOUNT_MISMATCH');
          }

          let signedInEmail = normalizeEmail(firebaseUser.email);
          let pendingEmailWasVerified = signedInEmail === normalizeEmail(userData.pendingAuthEmail);
          if (userData.pendingAuthEmail && !pendingEmailWasVerified) {
            const emailSyncStatus = await syncFirebaseEmail(firebaseUser, userData.pendingAuthEmail);
            if (emailSyncStatus === 'synced') {
              signedInEmail = normalizeEmail(userData.pendingAuthEmail);
              pendingEmailWasVerified = true;
            }
          }
          await updateDoc(doc(db, 'users', docId), {
            ...(pendingEmailWasVerified ? { email: signedInEmail } : {}),
            authEmail: signedInEmail,
            pendingAuthEmail: pendingEmailWasVerified ? deleteField() : (userData.pendingAuthEmail || deleteField()),
            authUid: firebaseUser.uid,
            authMigratedAt: serverTimestamp(),
            password: deleteField()
          });
          userData.authEmail = signedInEmail;
          if (pendingEmailWasVerified) {
            userData.email = signedInEmail;
            delete userData.pendingAuthEmail;
          }
        }
      } else if (userData.password !== loginPass) {
        setLoginError('Incorrect Password');
        return;
      }

      const isMobileStaff = userData.role !== 'admin' && isMobileOrTabletDevice();
      const shouldBindDevice = isMobileStaff && !userData.approvedDeviceId;
      const sanitizedUserData = { ...userData, ...(firebaseUser ? { authUid: firebaseUser.uid } : {}) };
      delete sanitizedUserData.password;
      let userObj = { dbId: docId, ...sanitizedUserData };

      if (isMobileStaff && userData.approvedDeviceId) {
        if (userData.approvedDeviceId !== getDeviceId(false)) {
          await signOut(auth).catch(() => {});
          setLoginError(DEVICE_BINDING_ERROR);
          return;
        }
      } else if (shouldBindDevice) {
        userObj = await approveOrValidateMobileDevice(docId);
        delete userObj.password;
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
      } else if (isInvalidAuthCredential(error)) {
        setLoginError('Incorrect Password');
      } else if (error.message === 'AUTH_ACCOUNT_MISMATCH') {
        setLoginError('This email is linked to a different account. Please contact an administrator.');
      } else {
        console.error('Login failed:', error);
        setLoginError(getAuthSetupMessage(error, 'Login failed. Please try again.'));
      }
    }
  };

  const handleLogout = async () => {
    logSystemAction(currentUser.name, 'LOGOUT', 'Logged out of the system');
    await signOut(auth).catch(error => console.error('Firebase sign-out failed:', error));
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

      const email = getAuthenticationEmail(userData);
      if (!EMAIL_PATTERN.test(email || '')) {
        setResetFeedback({ type: 'error', message: 'No valid email is saved for this account. Please contact an administrator.' });
        return;
      }

      if (!userData.authUid && userData.password) {
        const provisionedAccount = await provisionLegacyAuthAccount(email, userData.password);
        if (provisionedAccount.created) {
          await updateDoc(doc(db, 'users', userDocument.id), {
            authUid: provisionedAccount.uid,
            authEmail: email,
            authMigratedAt: serverTimestamp(),
            password: deleteField(),
            passwordResetStatus: deleteField(),
            passwordResetRequestedAt: deleteField()
          });
        }
      }

      await sendPasswordResetEmail(auth, email);
      if (userData.passwordResetStatus === 'pending') {
        await updateDoc(doc(db, 'users', userDocument.id), {
          passwordResetStatus: deleteField(),
          passwordResetRequestedAt: deleteField()
        });
      }
      await logSystemAction(userData.name, 'PASSWORD_RESET_EMAIL', `Requested a Firebase password reset email for User ID: ${userId}`);

      setResetFeedback({
        type: 'success',
        message: `Reset link sent to ${maskEmailAddress(email)}. Check your inbox and spam folder.`
      });
    } catch (error) {
      console.error('Password reset email failed:', error);
      setResetFeedback({ type: 'error', message: getAuthSetupMessage(error, 'Unable to send the reset email. Please try again.') });
    } finally {
      setIsResetSubmitting(false);
    }
  };

  const handleCompletePasswordReset = async (e) => {
    e.preventDefault();
    if (!passwordResetCode || isResetLinkSubmitting) return;

    const form = e.currentTarget;
    const newPassword = form.newPassword.value;
    const confirmPassword = form.confirmPassword.value;

    if (newPassword !== confirmPassword) {
      setResetLinkState(previous => ({ ...previous, message: 'New Password and Confirm Password do not match.' }));
      return;
    }

    setIsResetLinkSubmitting(true);
    setResetLinkState(previous => ({ ...previous, message: '' }));
    try {
      await confirmPasswordReset(auth, passwordResetCode, newPassword);
      setResetLinkState(previous => ({
        ...previous,
        status: 'success',
        message: 'Your password has been reset successfully. You can now return to login.'
      }));
    } catch (error) {
      console.error('Password reset completion failed:', error);
      const expiredLink = ['auth/expired-action-code', 'auth/invalid-action-code'].includes(error.code);
      setResetLinkState(previous => ({
        ...previous,
        status: expiredLink ? 'error' : 'ready',
        message: expiredLink
          ? 'This password reset link is invalid or has expired. Request a new link from the login page.'
          : getAuthSetupMessage(error, 'Unable to reset the password. Please try again.')
      }));
    } finally {
      setIsResetLinkSubmitting(false);
    }
  };

  const leavePasswordResetPage = () => {
    const cleanUrl = `${window.location.origin}${window.location.pathname}`;
    window.history.replaceState({}, document.title, cleanUrl);
    window.location.reload();
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
      let firebaseUser = auth.currentUser;
      let authSyncStatus = 'synced';
      let authenticationEmail = getAuthenticationEmail(currentUser);
      if (!firebaseUser) {
        const latestSnapshot = await getDoc(doc(db, 'users', currentUser.dbId));
        const legacyPassword = latestSnapshot.data()?.password;
        if (!legacyPassword) throw new Error('AUTH_SESSION_EXPIRED');
        try {
          firebaseUser = (await createUserWithEmailAndPassword(auth, email, legacyPassword)).user;
          authenticationEmail = email;
        } catch (error) {
          if (!isAuthProviderUnavailable(error)) throw error;
          authSyncStatus = 'deferred';
        }
      } else if (normalizeEmail(firebaseUser.email) !== email) {
        authSyncStatus = await syncFirebaseEmail(firebaseUser, email);
        authenticationEmail = authSyncStatus === 'synced' ? email : normalizeEmail(firebaseUser.email);
      } else {
        authenticationEmail = email;
      }

      const profileUpdates = {
        name,
        email,
        dateOfBirth,
        phone,
        ...(authenticationEmail ? { authEmail: authenticationEmail } : {}),
        pendingAuthEmail: authSyncStatus === 'synced' ? deleteField() : email,
        profileUpdatedAt: serverTimestamp()
      };
      if (firebaseUser) {
        profileUpdates.authUid = firebaseUser.uid;
        profileUpdates.authMigratedAt = serverTimestamp();
        profileUpdates.password = deleteField();
      }
      await updateDoc(doc(db, 'users', currentUser.dbId), profileUpdates);

      const updatedUser = {
        ...currentUser,
        name,
        email,
        dateOfBirth,
        phone,
        ...(firebaseUser ? { authUid: firebaseUser.uid } : {}),
        ...(authenticationEmail ? { authEmail: authenticationEmail } : {})
      };
      if (authSyncStatus === 'synced') delete updatedUser.pendingAuthEmail;
      else updatedUser.pendingAuthEmail = email;
      delete updatedUser.password;
      setCurrentUser(updatedUser);
      localStorage.setItem('hotelUser', JSON.stringify(updatedUser));
      await logSystemAction(name, 'PROFILE_UPDATE', 'Updated personal profile information');
      const successMessage = authSyncStatus === 'verification-sent'
        ? `Profile saved. Check ${email} and verify the new address to finish updating your sign-in email.`
        : authSyncStatus === 'deferred'
          ? 'Profile saved. The sign-in email will sync automatically when Firebase Email/Password authentication is enabled.'
          : 'Your profile and sign-in email have been updated successfully.';
      setProfileFeedback({ type: 'success', message: successMessage });
    } catch (error) {
      console.error('Profile update failed:', error);
      const message = error.message === 'AUTH_SESSION_EXPIRED' || error.code === 'auth/email-already-in-use'
        ? 'Please sign out and sign in again before updating your email address.'
        : getAuthSetupMessage(error, error.code === 'auth/requires-recent-login'
          ? 'Please sign out, sign in again and then update your email address.'
          : 'Unable to update your profile. Please try again.');
      setProfileFeedback({ type: 'error', message });
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

    if (newPass !== confirmPass) {
      setProfileFeedback({ type: 'error', message: 'The new passwords do not match.' });
      return;
    }

    setIsProfileSaving(true);
    setProfileFeedback({ type: '', message: '' });

    try {
      const email = normalizeEmail(auth.currentUser?.email) || getAuthenticationEmail(currentUser);
      if (!EMAIL_PATTERN.test(email || '')) throw new Error('EMAIL_REQUIRED');

      let firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        try {
          firebaseUser = (await signInWithEmailAndPassword(auth, email, currentPass)).user;
        } catch (error) {
          const latestSnapshot = await getDoc(doc(db, 'users', currentUser.dbId));
          const legacyPassword = latestSnapshot.data()?.password;
          if (!isInvalidAuthCredential(error) || legacyPassword !== currentPass) throw error;
          firebaseUser = (await createUserWithEmailAndPassword(auth, email, currentPass)).user;
        }
      } else {
        const credential = EmailAuthProvider.credential(email, currentPass);
        await reauthenticateWithCredential(firebaseUser, credential);
      }

      if (currentUser.authUid && currentUser.authUid !== firebaseUser.uid) throw new Error('AUTH_ACCOUNT_MISMATCH');
      await updatePassword(firebaseUser, newPass);
      await updateDoc(doc(db, "users", currentUser.dbId), {
        authUid: firebaseUser.uid,
        authEmail: normalizeEmail(firebaseUser.email),
        pendingAuthEmail: normalizeEmail(firebaseUser.email) === normalizeEmail(currentUser.pendingAuthEmail) ? deleteField() : (currentUser.pendingAuthEmail || deleteField()),
        authMigratedAt: serverTimestamp(),
        password: deleteField(),
        passwordResetStatus: deleteField(),
        passwordResetRequestedAt: deleteField()
      });
      const updatedUser = { ...currentUser, authUid: firebaseUser.uid, authEmail: normalizeEmail(firebaseUser.email) };
      if (normalizeEmail(firebaseUser.email) === normalizeEmail(currentUser.pendingAuthEmail)) delete updatedUser.pendingAuthEmail;
      delete updatedUser.password;
      setCurrentUser(updatedUser);
      localStorage.setItem('hotelUser', JSON.stringify(updatedUser));
      await logSystemAction(currentUser.name, 'PASSWORD_CHANGE', 'Changed their own password');
      form.reset();
      setProfileFeedback({ type: 'success', message: 'Your password has been changed successfully.' });
    } catch (error) {
      console.error('Password change failed:', error);
      const incorrectPassword = isInvalidAuthCredential(error);
      setProfileFeedback({
        type: 'error',
        message: incorrectPassword
          ? 'Your current password is incorrect.'
          : getAuthSetupMessage(error, error.message === 'EMAIL_REQUIRED'
            ? 'Add a valid email address to your profile before changing your password.'
            : 'Unable to change your password. Please try again.')
      });
    } finally {
      setIsProfileSaving(false);
    }
  };

  const handleAdminSendPasswordReset = async (staff) => {
    const email = getAuthenticationEmail(staff);
    if (!EMAIL_PATTERN.test(email || '')) {
      alert(`${staff.name} does not have a valid email address in their profile.`);
      return;
    }
    if (!confirm(`Send a Firebase password reset link to ${email}?`)) return;

    try {
        if (!staff.authUid && staff.password) {
          const provisionedAccount = await provisionLegacyAuthAccount(email, staff.password);
          if (provisionedAccount.created) {
            await updateDoc(doc(db, 'users', staff.dbId), {
              authUid: provisionedAccount.uid,
              authEmail: email,
              authMigratedAt: serverTimestamp(),
              password: deleteField()
            });
          }
        }

        await sendPasswordResetEmail(auth, email);
        await updateDoc(doc(db, "users", staff.dbId), {
          passwordResetStatus: deleteField(),
          passwordResetRequestedAt: deleteField()
        });
        setStaffModal(previous => previous?.dbId === staff.dbId
          ? { ...previous, passwordResetStatus: undefined, passwordResetRequestedAt: undefined }
          : previous
        );
        logSystemAction(currentUser.name, 'PASSWORD_RESET_EMAIL', `Sent a Firebase password reset email to staff: ${staff.name}`);
        alert(`Password reset email sent to ${email}.`);
    } catch (error) {
        console.error('Admin password reset email failed:', error);
        alert(getAuthSetupMessage(error, 'Failed to send the password reset email.'));
    }
  };

  const handleDownloadFullBackup = async () => {
    if (currentUser.role !== 'admin' || isBackupDownloading) return;
    setIsBackupDownloading(true);
    setBackupFeedback({ type: '', message: '' });

    try {
      const collectionEntries = await Promise.all(BACKUP_COLLECTIONS.map(async (collectionName) => {
        try {
          const snapshot = await getDocs(collection(db, collectionName));
          const documents = snapshot.docs.map(documentSnapshot => {
            const documentData = { ...documentSnapshot.data() };
            // Firebase Authentication credentials are not part of Firestore.
            // Never copy any unmigrated legacy plaintext password into a file.
            if (collectionName === 'users') delete documentData.password;
            return {
              id: documentSnapshot.id,
              data: serializeBackupValue(documentData)
            };
          });
          return [collectionName, documents];
        } catch (error) {
          throw new Error(`Unable to read ${collectionName}: ${error.message}`);
        }
      }));

      const collections = Object.fromEntries(collectionEntries);
      const totalDocuments = Object.values(collections).reduce((total, documents) => total + documents.length, 0);
      const createdAt = new Date();
      const backup = {
        format: 'aladdin-dream-hotel-firestore-backup',
        version: 1,
        createdAt: createdAt.toISOString(),
        projectId: db.app.options.projectId,
        createdBy: {
          id: currentUser.dbId,
          userId: currentUser.userid,
          name: currentUser.name,
          role: currentUser.role
        },
        notes: [
          'Firebase Authentication accounts and passwords are not included.',
          'Legacy plaintext password fields are intentionally excluded from users.'
        ],
        documentCount: totalDocuments,
        collections
      };

      const localDate = getLocalIsoDate(createdAt);
      const localTime = `${String(createdAt.getHours()).padStart(2, '0')}-${String(createdAt.getMinutes()).padStart(2, '0')}`;
      const filename = `aladdin-hotel-backup-${localDate}-${localTime}.json`;
      const objectUrl = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
      const downloadLink = document.createElement('a');
      downloadLink.href = objectUrl;
      downloadLink.download = filename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

      await logSystemAction(currentUser.name, 'FULL_BACKUP_DOWNLOAD', `Downloaded ${filename} containing ${totalDocuments} Firestore documents`);
      setBackupFeedback({
        type: 'success',
        message: `${filename} downloaded successfully (${totalDocuments} records). Store it in a secure location.`
      });
    } catch (error) {
      console.error('Full backup download failed:', error);
      setBackupFeedback({ type: 'error', message: `Backup failed. ${error.message}` });
    } finally {
      setIsBackupDownloading(false);
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

  // --- ADMIN-ONLY MONTHLY SAJ / TNB BILLS ---
  const handleSaveUtilityBill = async (e) => {
    e.preventDefault();
    if (currentUser.role !== 'admin' || isUtilityBillSaving) return;

    const form = e.currentTarget;
    const provider = form.provider.value;
    const billingMonth = form.billingMonth.value;
    const amount = Number(form.amount.value);
    if (!['SAJ', 'TNB'].includes(provider) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(billingMonth) || !Number.isFinite(amount) || amount < 0) {
      setUtilityBillFeedback({ type: 'error', message: 'Please enter a valid provider, billing month and amount.' });
      return;
    }

    setIsUtilityBillSaving(true);
    setUtilityBillFeedback({ type: '', message: '' });
    try {
      const recordId = `${billingMonth}-${provider.toLowerCase()}`;
      await setDoc(doc(db, 'utilityBills', recordId), {
        provider,
        billingMonth,
        amount,
        billDate: form.billDate.value || '',
        dueDate: form.dueDate.value || '',
        accountNumber: form.accountNumber.value.trim(),
        status: form.status.value,
        notes: form.notes.value.trim(),
        recordedBy: currentUser.name,
        recordedById: currentUser.dbId,
        updatedAt: serverTimestamp()
      }, { merge: true });
      await logSystemAction(currentUser.name, 'UTILITY_BILL_SAVE', `Saved ${provider} bill for ${monthIsoToDisplay(billingMonth)}: RM${amount.toFixed(2)}`);
      form.reset();
      form.billingMonth.value = getCurrentMonthString();
      setUtilityBillFeedback({ type: 'success', message: `${provider} bill for ${monthIsoToDisplay(billingMonth)} saved successfully.` });
    } catch (error) {
      console.error('Utility bill save failed:', error);
      setUtilityBillFeedback({ type: 'error', message: 'Failed to save the utility bill. Please try again.' });
    } finally {
      setIsUtilityBillSaving(false);
    }
  };

  const handleDeleteUtilityBill = async (bill) => {
    if (currentUser.role !== 'admin') return;
    if (!window.confirm(`Delete the ${bill.provider} bill for ${monthIsoToDisplay(bill.billingMonth)}?`)) return;
    try {
      await deleteDoc(doc(db, 'utilityBills', bill.id));
      await logSystemAction(currentUser.name, 'UTILITY_BILL_DELETE', `Deleted ${bill.provider} bill for ${monthIsoToDisplay(bill.billingMonth)}`);
      setUtilityBillFeedback({ type: 'success', message: 'Utility bill record deleted.' });
    } catch (error) {
      console.error('Utility bill delete failed:', error);
      setUtilityBillFeedback({ type: 'error', message: 'Failed to delete the utility bill.' });
    }
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

  const openPasswordSettings = () => {
    setProfileTab('SECURITY');
    setProfileFeedback({ type: '', message: '' });
    setShowProfileModal(true);
  };

  const handleHelpAction = (action) => {
    if (action === 'SECURITY') {
      openPasswordSettings();
      return;
    }
    if (action === 'PROFILE') {
      openProfilePortal();
      return;
    }
    setView(action);
  };

  const handleLaundryStockInlineChange = (dateKey, item, movementType, value) => {
    if (value !== '' && !/^\d+$/.test(value)) return;
    const entryKey = `${dateKey}|${item}|${movementType}`;
    setLaundryStockInlineEntries(previousEntries => ({ ...previousEntries, [entryKey]: value }));
  };

  const handleSaveLaundryStockRow = async (transactionDate) => {
    if (savingLaundryStockDate) return;

    const entriesToSave = LAUNDRY_STOCK_ITEMS.flatMap(item => ['received', 'given_out'].map(movementType => {
      const entryKey = `${transactionDate}|${item}|${movementType}`;
      return {
        entryKey,
        item,
        movementType,
        quantity: Number.parseInt(laundryStockInlineEntries[entryKey], 10)
      };
    })).filter(entry => Number.isInteger(entry.quantity) && entry.quantity > 0);

    if (entriesToSave.length === 0) {
      setLaundryStockFeedback({ type: 'error', message: `Enter at least one Received or Given Out quantity for day ${Number(transactionDate.slice(-2))}.` });
      return;
    }

    setSavingLaundryStockDate(transactionDate);
    setLaundryStockFeedback({ type: '', message: '' });

    try {
      const movementBatch = writeBatch(db);
      entriesToSave.forEach(entry => {
        const movementRef = doc(collection(db, "laundryStockMovements"));
        movementBatch.set(movementRef, {
          item: entry.item,
          movementType: entry.movementType,
          quantity: entry.quantity,
          transactionDate,
          month: transactionDate.slice(0, 7),
          recordedBy: currentUser.name,
          recordedById: currentUser.userid,
          createdAt: serverTimestamp()
        });
      });
      await movementBatch.commit();
      await logSystemAction(
        currentUser.name,
        'LAUNDRY_STOCK_DAILY_ENTRY',
        `Recorded ${entriesToSave.length} laundry stock movement(s) for ${transactionDate}`
      );
      setLaundryStockInlineEntries(previousEntries => Object.fromEntries(
        Object.entries(previousEntries).filter(([entryKey]) => !entryKey.startsWith(`${transactionDate}|`))
      ));
      setLaundryStockFeedback({ type: 'success', message: `Day ${Number(transactionDate.slice(-2))} stock movements saved successfully.` });
    } catch (error) {
      console.error('Laundry stock movement save failed:', error);
      setLaundryStockFeedback({ type: 'error', message: 'Unable to save the stock movement. Please try again.' });
    } finally {
      setSavingLaundryStockDate('');
    }
  };

  const handleHousekeepingMonthChange = (nextMonth) => {
    if (housekeepingAutoSaveTimerRef.current) clearTimeout(housekeepingAutoSaveTimerRef.current.timerId);
    housekeepingAutoSaveTimerRef.current = null;
    if (housekeepingCustomerAutoSaveTimerRef.current) clearTimeout(housekeepingCustomerAutoSaveTimerRef.current.timerId);
    housekeepingCustomerAutoSaveTimerRef.current = null;
    setHousekeepingMonth(nextMonth);
    setHousekeepingFeedback({ type: '', message: '' });
    setHousekeepingStaffModal(null);
    setHousekeepingAutoSaveStatus('idle');
    setHousekeepingCustomerAutoSaveStatus('idle');
    setHousekeepingActiveCell(null);
  };

  const resolveHousekeepingStaffDocId = (record) => (
    record?.staffDocId || users.find(staff => staff.userid === record?.staffId)?.dbId || ''
  );

  const openHousekeepingStaffModal = (serviceDate, room, existingRecords) => {
    if (housekeepingAutoSaveTimerRef.current) clearTimeout(housekeepingAutoSaveTimerRef.current.timerId);
    housekeepingAutoSaveTimerRef.current = null;
    if (housekeepingCustomerAutoSaveTimerRef.current) clearTimeout(housekeepingCustomerAutoSaveTimerRef.current.timerId);
    housekeepingCustomerAutoSaveTimerRef.current = null;
    const selectedStaffDocIds = [...new Set(existingRecords.map(resolveHousekeepingStaffDocId).filter(Boolean))];
    const customerRecord = housekeepingCustomerInfoMap[`${room.id}|${serviceDate}`];
    setHousekeepingAutoSaveStatus('idle');
    setHousekeepingCustomerAutoSaveStatus('idle');
    setHousekeepingActiveCell({ roomId: String(room.id), serviceDate });
    setHousekeepingStaffModal({
      serviceDate,
      room,
      selectedStaffDocIds,
      customerInfo: [customerRecord?.customerInfo1 || '', customerRecord?.customerInfo2 || ''],
      customerRecordId: customerRecord?.id || ''
    });
  };

  const handleHousekeepingAssignmentsChange = async (serviceDate, room, staffDocIds) => {
    const cellKey = `${room.id}|${serviceDate}`;
    if (Object.prototype.hasOwnProperty.call(housekeepingPendingAssignments, cellKey)) return false;

    const nextStaffDocIds = [...new Set(staffDocIds)];
    const selectedStaff = nextStaffDocIds.map(staffDocId => (
      users.find(user => user.dbId === staffDocId && isUserActive(user))
    ));
    if (selectedStaff.some(staff => !staff)) {
      setHousekeepingFeedback({ type: 'error', message: 'One of the selected staff accounts is no longer active. Please review the selection.' });
      return false;
    }
    setHousekeepingPendingAssignments(previous => ({ ...previous, [cellKey]: nextStaffDocIds }));
    setHousekeepingFeedback({ type: '', message: '' });
    try {
      const existingSnapshot = await getDocs(query(
        collection(db, 'housekeepingDaily'),
        where('serviceDate', '==', serviceDate),
        where('roomId', '==', String(room.id))
      ));
      const existingRecords = existingSnapshot.docs.map(record => ({ id: record.id, ...record.data() }));
      if (nextStaffDocIds.length === 0 && existingRecords.length > 0 && currentUser.role !== 'admin') {
        setHousekeepingFeedback({ type: 'error', message: 'Only an administrator can clear every housekeeping assignment from a cell.' });
        return false;
      }

      const existingByStaffDocId = existingRecords.reduce((recordMap, record) => {
        const staffDocId = resolveHousekeepingStaffDocId(record);
        if (!recordMap.has(staffDocId)) recordMap.set(staffDocId, []);
        recordMap.get(staffDocId).push(record);
        return recordMap;
      }, new Map());
      const currentStaffDocIds = [...existingByStaffDocId.entries()]
        .flatMap(([staffDocId, records]) => records.map(() => staffDocId))
        .filter(Boolean)
        .sort();
      const sortedNextStaffDocIds = [...nextStaffDocIds].sort();
      if (JSON.stringify(currentStaffDocIds) === JSON.stringify(sortedNextStaffDocIds)) return true;

      const batch = writeBatch(db);
      let operationCount = 0;

      existingByStaffDocId.forEach((records, staffDocId) => {
        const recordsToDelete = nextStaffDocIds.includes(staffDocId) ? records.slice(1) : records;
        recordsToDelete.forEach(record => {
          batch.delete(doc(db, 'housekeepingDaily', record.id));
          operationCount += 1;
        });
      });

      selectedStaff.forEach(staff => {
        if ((existingByStaffDocId.get(staff.dbId) || []).length > 0) return;
        const newRecordRef = doc(collection(db, 'housekeepingDaily'));
        batch.set(newRecordRef, {
          serviceDate,
          month: serviceDate.slice(0, 7),
          roomId: String(room.id),
          roomType: room.type || '',
          staffDocId: staff.dbId,
          staffId: staff.userid || '',
          staffName: staff.name || staff.userid || 'Staff',
          recordedBy: currentUser.name,
          recordedById: currentUser.userid,
          createdAt: serverTimestamp()
        });
        operationCount += 1;
      });

      if (operationCount > 0) await batch.commit();
      const staffNames = selectedStaff.map(staff => staff.name || staff.userid || 'Staff');
      await logSystemAction(
        currentUser.name,
        'HOUSEKEEPING_DAILY_MULTI_UPDATE',
        staffNames.length > 0
          ? `Assigned ${staffNames.join(', ')} to housekeeping Room ${room.id} on ${serviceDate}`
          : `Cleared all housekeeping assignments for Room ${room.id} on ${serviceDate}`
      );
      setHousekeepingFeedback({
        type: 'success',
        message: staffNames.length > 0
          ? `Room ${room.id} was assigned to ${staffNames.join(', ')} for ${calendarIsoToDisplay(serviceDate)}.`
          : `Room ${room.id} is now unassigned for ${calendarIsoToDisplay(serviceDate)}.`
      });
      return true;
    } catch (error) {
      console.error('Housekeeping calendar assignment save failed:', error);
      setHousekeepingFeedback({ type: 'error', message: 'Unable to save this housekeeping assignment. Please try again.' });
      return false;
    } finally {
      setHousekeepingPendingAssignments(previous => {
        const next = { ...previous };
        delete next[cellKey];
        return next;
      });
    }
  };

  const handleHousekeepingCustomerInfoSave = async (modal, source = 'manual') => {
    const customerInfo1 = String(modal.customerInfo?.[0] || '').trim().slice(0, 200);
    const customerInfo2 = String(modal.customerInfo?.[1] || '').trim().slice(0, 200);
    const roomId = String(modal.room.id);
    const recordId = modal.customerRecordId || `${modal.serviceDate}_${encodeURIComponent(roomId)}`;

    try {
      await setDoc(doc(db, 'housekeepingCustomerInfo', recordId), {
        serviceDate: modal.serviceDate,
        month: modal.serviceDate.slice(0, 7),
        roomId,
        roomType: modal.room.type || '',
        customerInfo1,
        customerInfo2,
        keyedInBy: currentUser.name,
        keyedInById: currentUser.userid,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setHousekeepingStaffModal(currentModal => (
        currentModal?.serviceDate === modal.serviceDate && String(currentModal.room.id) === roomId
          ? { ...currentModal, customerRecordId: recordId }
          : currentModal
      ));
      await logSystemAction(
        currentUser.name,
        source === 'smart' ? 'HOUSEKEEPING_CUSTOMER_AUTO_KEY_IN' : 'HOUSEKEEPING_CUSTOMER_UPDATE',
        `Updated customer information for Room ${roomId} on ${modal.serviceDate}`
      );
      return true;
    } catch (error) {
      console.error('Housekeeping customer information save failed:', error);
      setHousekeepingFeedback({ type: 'error', message: 'Unable to save customer information. Please try again.' });
      return false;
    }
  };

  const queueHousekeepingCustomerAutoSave = (modal) => {
    if (housekeepingCustomerAutoSaveTimerRef.current) clearTimeout(housekeepingCustomerAutoSaveTimerRef.current.timerId);
    setHousekeepingCustomerAutoSaveStatus('waiting');
    const timerId = setTimeout(async () => {
      housekeepingCustomerAutoSaveTimerRef.current = null;
      setHousekeepingCustomerAutoSaveStatus('saving');
      const saved = await handleHousekeepingCustomerInfoSave(modal);
      setHousekeepingCustomerAutoSaveStatus(saved ? 'saved' : 'error');
    }, 700);
    housekeepingCustomerAutoSaveTimerRef.current = { timerId, modal };
  };

  const queueHousekeepingInlineCustomerSave = (serviceDate, room, customerInfo, customerRecordId) => {
    const cellKey = `${room.id}|${serviceDate}`;
    if (housekeepingInlineCustomerTimersRef.current[cellKey]) {
      clearTimeout(housekeepingInlineCustomerTimersRef.current[cellKey]);
    }
    setHousekeepingPendingCustomerCells(previous => ({ ...previous, [cellKey]: 'waiting' }));
    housekeepingInlineCustomerTimersRef.current[cellKey] = setTimeout(async () => {
      delete housekeepingInlineCustomerTimersRef.current[cellKey];
      setHousekeepingPendingCustomerCells(previous => ({ ...previous, [cellKey]: 'saving' }));
      const saved = await handleHousekeepingCustomerInfoSave({
        serviceDate,
        room,
        customerInfo,
        customerRecordId
      });
      setHousekeepingPendingCustomerCells(previous => ({ ...previous, [cellKey]: saved ? 'saved' : 'error' }));
    }, 700);
  };

  const handleHousekeepingSmartKeyIn = async () => {
    if (housekeepingSmartResult.error || housekeepingSmartResult.entries.length === 0 || isHousekeepingSmartSaving) return;

    setIsHousekeepingSmartSaving(true);
    setHousekeepingFeedback({ type: '', message: '' });
    try {
      const customerBatch = writeBatch(db);
      housekeepingSmartResult.entries.forEach(entry => {
        const cellKey = `${entry.roomId}|${housekeepingSmartResult.serviceDate}`;
        if (housekeepingInlineCustomerTimersRef.current[cellKey]) {
          clearTimeout(housekeepingInlineCustomerTimersRef.current[cellKey]);
          delete housekeepingInlineCustomerTimersRef.current[cellKey];
        }
        const room = housekeepingRooms.find(candidate => String(candidate.id) === entry.roomId);
        if (!room) return;
        const recordId = `${housekeepingSmartResult.serviceDate}_${encodeURIComponent(entry.roomId)}`;
        customerBatch.set(doc(db, 'housekeepingCustomerInfo', recordId), {
          serviceDate: housekeepingSmartResult.serviceDate,
          month: housekeepingSmartResult.serviceDate.slice(0, 7),
          roomId: entry.roomId,
          roomType: room.type || '',
          customerInfo1: String(entry.customerInfo[0] || '').trim().slice(0, 200),
          customerInfo2: String(entry.customerInfo[1] || '').trim().slice(0, 200),
          keyedInBy: currentUser.name,
          keyedInById: currentUser.userid,
          updatedAt: serverTimestamp()
        }, { merge: true });
      });
      await customerBatch.commit();
      await logSystemAction(
        currentUser.name,
        'HOUSEKEEPING_CUSTOMER_AUTO_KEY_IN',
        `Auto keyed in ${housekeepingSmartResult.entries.length} room arrangement entries for ${housekeepingSmartResult.serviceDate}`
      );
      const targetMonth = housekeepingSmartResult.serviceDate.slice(0, 7);
      setHousekeepingMonth(targetMonth);
      setHousekeepingInlineCustomerDrafts(previous => {
        const next = { ...previous };
        housekeepingSmartResult.entries.forEach(entry => delete next[`${entry.roomId}|${housekeepingSmartResult.serviceDate}`]);
        return next;
      });
      setHousekeepingPendingCustomerCells(previous => {
        const next = { ...previous };
        housekeepingSmartResult.entries.forEach(entry => delete next[`${entry.roomId}|${housekeepingSmartResult.serviceDate}`]);
        return next;
      });
      setHousekeepingSmartText('');
      setHousekeepingFeedback({
        type: 'success',
        message: `${housekeepingSmartResult.entries.length} room remarks were keyed in for ${calendarIsoToDisplay(housekeepingSmartResult.serviceDate)}.${housekeepingSmartResult.unknownRooms.length > 0 ? ` Rooms not found and skipped: ${housekeepingSmartResult.unknownRooms.join(', ')}.` : ''}`
      });
    } catch (error) {
      console.error('Housekeeping arrangement auto key in failed:', error);
      setHousekeepingFeedback({ type: 'error', message: 'Unable to key in this room arrangement. Please try again.' });
    } finally {
      setIsHousekeepingSmartSaving(false);
    }
  };

  const queueHousekeepingAutoSave = (modal) => {
    if (housekeepingAutoSaveTimerRef.current) clearTimeout(housekeepingAutoSaveTimerRef.current.timerId);
    setHousekeepingAutoSaveStatus('waiting');
    const timerId = setTimeout(async () => {
      housekeepingAutoSaveTimerRef.current = null;
      setHousekeepingAutoSaveStatus('saving');
      const saved = await handleHousekeepingAssignmentsChange(
        modal.serviceDate,
        modal.room,
        modal.selectedStaffDocIds
      );
      setHousekeepingAutoSaveStatus(saved ? 'saved' : 'error');
    }, 600);
    housekeepingAutoSaveTimerRef.current = { timerId, modal };
  };

  const closeHousekeepingStaffModal = async () => {
    if (housekeepingAutoSaveStatus === 'saving' || housekeepingCustomerAutoSaveStatus === 'saving') return;
    const pendingStaffSave = housekeepingAutoSaveTimerRef.current;
    const pendingCustomerSave = housekeepingCustomerAutoSaveTimerRef.current;
    if (pendingStaffSave) {
      clearTimeout(pendingStaffSave.timerId);
      housekeepingAutoSaveTimerRef.current = null;
      setHousekeepingAutoSaveStatus('saving');
      await handleHousekeepingAssignmentsChange(
        pendingStaffSave.modal.serviceDate,
        pendingStaffSave.modal.room,
        pendingStaffSave.modal.selectedStaffDocIds
      );
    }
    if (pendingCustomerSave) {
      clearTimeout(pendingCustomerSave.timerId);
      housekeepingCustomerAutoSaveTimerRef.current = null;
      setHousekeepingCustomerAutoSaveStatus('saving');
      await handleHousekeepingCustomerInfoSave(pendingCustomerSave.modal);
    }
    setHousekeepingStaffModal(null);
    setHousekeepingAutoSaveStatus('idle');
    setHousekeepingCustomerAutoSaveStatus('idle');
  };

  const handleAddCustomerDetail = async (event) => {
    event.preventDefault();
    if (isCustomerSaving) return;

    const form = event.currentTarget;
    const customerName = form.customerName.value.trim();
    const phoneNumber = form.phoneNumber.value.trim();
    const address = form.address.value.trim();
    const remark = form.remark.value.trim();
    const callTime = customerCallTime;

    if (!CUSTOMER_PHONE_PATTERN.test(phoneNumber)) {
      setCustomerFeedback({ type: 'error', message: 'Please enter a valid phone number (8 to 19 digits, spaces or hyphens).' });
      return;
    }

    setIsCustomerSaving(true);
    setCustomerFeedback({ type: '', message: '' });

    try {
      await addDoc(collection(db, "customerDetails"), {
        customerName,
        phoneNumber,
        address,
        remark,
        callTime,
        keyedInBy: currentUser.name,
        keyedInById: currentUser.userid,
        keyedInByDocId: currentUser.dbId,
        createdAt: serverTimestamp()
      });
      await logSystemAction(currentUser.name, 'CUSTOMER_DETAIL_ADD', `Added customer detail for ${customerName}`);
      form.reset();
      setCustomerCallTime(getLocalTimeValue());
      setCustomerFeedback({ type: 'success', message: 'Customer detail added successfully.' });
    } catch (error) {
      console.error('Customer detail save failed:', error);
      setCustomerFeedback({ type: 'error', message: 'Unable to add the customer detail. Please try again.' });
    } finally {
      setIsCustomerSaving(false);
    }
  };

  const openCustomerEditor = (customer) => {
    setCustomerEditFeedback({ type: '', message: '' });
    setEditingCustomer(customer);
  };

  const closeCustomerEditor = () => {
    if (isCustomerUpdating) return;
    setEditingCustomer(null);
    setCustomerEditFeedback({ type: '', message: '' });
  };

  const handleUpdateCustomerDetail = async (event) => {
    event.preventDefault();
    if (!editingCustomer || isCustomerUpdating) return;

    const form = event.currentTarget;
    const customerName = form.customerName.value.trim();
    const phoneNumber = form.phoneNumber.value.trim();
    const address = form.address.value.trim();
    const remark = form.remark.value.trim();
    const callTime = form.callTime.value;
    if (!CUSTOMER_PHONE_PATTERN.test(phoneNumber)) {
      setCustomerEditFeedback({ type: 'error', message: 'Please enter a valid phone number (8 to 19 digits, spaces or hyphens).' });
      return;
    }

    setIsCustomerUpdating(true);
    setCustomerEditFeedback({ type: '', message: '' });
    try {
      await updateDoc(doc(db, 'customerDetails', editingCustomer.id), {
        customerName,
        phoneNumber,
        address,
        remark,
        callTime,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.name,
        updatedById: currentUser.userid
      });
      await logSystemAction(currentUser.name, 'CUSTOMER_DETAIL_UPDATE', `Updated customer detail for ${customerName}`);
      setEditingCustomer(null);
      setCustomerFeedback({ type: 'success', message: `Customer detail for ${customerName} updated successfully.` });
    } catch (error) {
      console.error('Customer detail update failed:', error);
      setCustomerEditFeedback({ type: 'error', message: 'Unable to update the customer detail. Please try again.' });
    } finally {
      setIsCustomerUpdating(false);
    }
  };

  const handleDeleteCustomerDetail = async (customer) => {
    if (deletingCustomerId || !confirm(`Delete the customer detail for ${customer.customerName || 'this customer'}? This cannot be undone.`)) return;

    setDeletingCustomerId(customer.id);
    setCustomerFeedback({ type: '', message: '' });
    try {
      await deleteDoc(doc(db, 'customerDetails', customer.id));
      await logSystemAction(currentUser.name, 'CUSTOMER_DETAIL_DELETE', `Deleted customer detail for ${customer.customerName || customer.id}`);
      setCustomerFeedback({ type: 'success', message: 'Customer detail deleted successfully.' });
    } catch (error) {
      console.error('Customer detail delete failed:', error);
      setCustomerFeedback({ type: 'error', message: 'Unable to delete the customer detail. Please try again.' });
    } finally {
      setDeletingCustomerId('');
    }
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

  const handleSaveAnnualLeaveBalance = async (staff) => {
    if (currentUser.role !== 'admin' || savingAnnualLeaveStaffId) return;
    const existingBalance = annualLeaveBalances.find(balance => balance.userDocId === staff.dbId);
    const draftValue = annualLeaveDrafts[staff.dbId] ?? existingBalance?.entitlement ?? 0;
    const entitlement = Number(draftValue);
    if (!Number.isFinite(entitlement) || entitlement < 0 || entitlement > 365 || !Number.isInteger(entitlement)) {
      setAnnualLeaveFeedback({ type: 'error', message: 'Annual leave entitlement must be a whole number from 0 to 365 days.' });
      return;
    }

    setSavingAnnualLeaveStaffId(staff.dbId);
    setAnnualLeaveFeedback({ type: '', message: '' });
    try {
      const balanceId = getAnnualLeaveBalanceId(annualLeaveYear, staff.dbId);
      await setDoc(doc(db, 'annualLeaveBalances', balanceId), {
        year: annualLeaveYear,
        userDocId: staff.dbId,
        userId: staff.userid,
        userName: staff.name,
        entitlement,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.name,
        updatedById: currentUser.userid
      }, { merge: true });
      await logSystemAction(
        currentUser.name,
        'ANNUAL_LEAVE_BALANCE_UPDATE',
        `Set ${staff.name} (${staff.userid}) annual leave entitlement to ${entitlement} days for ${annualLeaveYear}`
      );
      setAnnualLeaveDrafts(previous => {
        const next = { ...previous };
        delete next[staff.dbId];
        return next;
      });
      setAnnualLeaveFeedback({ type: 'success', message: `${staff.name}'s ${annualLeaveYear} annual leave entitlement was saved.` });
    } catch (error) {
      console.error('Annual leave balance update failed:', error);
      setAnnualLeaveFeedback({ type: 'error', message: 'Unable to save the annual leave entitlement. Please try again.' });
    } finally {
      setSavingAnnualLeaveStaffId('');
    }
  };

  const handleSubmitMcRequest = async (event) => {
    event.preventDefault();
    if (isMcSubmitting) return;

    const form = event.currentTarget;
    const leaveType = form.leaveType.value;
    const startDate = form.startDate.value;
    const endDate = form.endDate.value;
    const clinicName = form.clinicName.value.trim();
    const remarks = form.remarks.value.trim();

    if (!LEAVE_TYPES.includes(leaveType)) {
      alert('Please select a valid leave type.');
      return;
    }

    if (!startDate || !endDate || endDate < startDate) {
      alert('Please select a valid leave date range.');
      return;
    }

    const overlapsPendingRequest = leaves.some(leave => (
      leave.userId === currentUser.userid &&
      leave.status === 'pending' &&
      startDate <= (leave.endDate || leave.startDate || '') &&
      endDate >= (leave.startDate || leave.endDate || '')
    ));
    if (overlapsPendingRequest) {
      alert('You already have a pending Leave/MC application for this date range.');
      return;
    }

    setIsMcSubmitting(true);
    try {
      if (leaveType === 'Annual leave') {
        const requestedDaysByYear = getAnnualLeaveDaysByYear({ startDate, endDate });
        const requestedYears = Object.keys(requestedDaysByYear).map(Number);
        if (requestedYears.length !== 1) {
          alert('An Annual leave application must stay within one calendar year. Submit separate applications for each year.');
          return;
        }

        const requestYear = requestedYears[0];
        const [balanceSnapshot, leaveSnapshots] = await Promise.all([
          getDoc(doc(db, 'annualLeaveBalances', getAnnualLeaveBalanceId(requestYear, currentUser.dbId))),
          getDocs(query(collection(db, 'leaves'), where('userId', '==', currentUser.userid), limit(500)))
        ]);
        const entitlement = balanceSnapshot.data()?.entitlement || 0;
        const ownLeaves = leaveSnapshots.docs.map(leaveDoc => ({ id: leaveDoc.id, ...leaveDoc.data() }));
        const summary = getAnnualLeaveSummary(ownLeaves, currentUser.userid, requestYear, entitlement);
        const requestedDays = requestedDaysByYear[requestYear];
        if (requestedDays > summary.availableAfterPending) {
          alert(`Insufficient Annual leave balance for ${requestYear}. Available after pending requests: ${Math.max(0, summary.availableAfterPending)} day(s).`);
          return;
        }
      }

      await addDoc(collection(db, 'leaves'), {
        userId: currentUser.userid,
        userDocId: currentUser.dbId,
        userName: currentUser.name,
        type: leaveType,
        startDate,
        endDate,
        clinicName,
        remarks,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      await logSystemAction(
        currentUser.name,
        'LEAVE_REQUEST',
        `Requested ${leaveType} from ${startDate} to ${endDate}${clinicName ? ` (${clinicName})` : ''}`
      );
      form.reset();
      alert('Leave/MC application submitted successfully.');
    } catch (error) {
      console.error('Leave/MC application failed:', error);
      alert('Unable to submit the Leave/MC application. Please try again.');
    } finally {
      setIsMcSubmitting(false);
    }
  };

  const handleWithdrawMcRequest = async (mcRequest) => {
    if (mcRequest.userId !== currentUser.userid || mcRequest.status !== 'pending') return;
    if (!confirm('Withdraw this pending Leave/MC application?')) return;

    try {
      await deleteDoc(doc(db, 'leaves', mcRequest.id));
      await logSystemAction(
        currentUser.name,
        'MC_WITHDRAW',
        `Withdrew Leave/MC application from ${mcRequest.startDate || '-'} to ${mcRequest.endDate || '-'}`
      );
    } catch (error) {
      console.error('Leave/MC withdrawal failed:', error);
      alert('Unable to withdraw this Leave/MC application.');
    }
  };

  const handleReviewMcRequest = async (mcRequest, status) => {
    if (currentUser.role !== 'admin' || !['approved', 'rejected'].includes(status)) return;

    try {
      if (status === 'approved' && mcRequest.type === 'Annual leave') {
        const requestedDaysByYear = getAnnualLeaveDaysByYear(mcRequest);
        const staffDocId = mcRequest.userDocId || users.find(user => user.userid === mcRequest.userId)?.dbId;
        if (!staffDocId) {
          alert('Cannot approve this request because the staff profile could not be matched.');
          return;
        }
        const leaveSnapshots = await getDocs(query(collection(db, 'leaves'), where('userId', '==', mcRequest.userId), limit(500)));
        const staffLeaves = leaveSnapshots.docs.map(leaveDoc => ({ id: leaveDoc.id, ...leaveDoc.data() }));

        for (const [yearText, requestedDays] of Object.entries(requestedDaysByYear)) {
          const year = Number(yearText);
          const balanceSnapshot = await getDoc(doc(db, 'annualLeaveBalances', getAnnualLeaveBalanceId(year, staffDocId)));
          const entitlement = balanceSnapshot.data()?.entitlement || 0;
          const summary = getAnnualLeaveSummary(staffLeaves, mcRequest.userId, year, entitlement, mcRequest.id);
          if (requestedDays > summary.remainingDays) {
            alert(`Cannot approve this request. ${mcRequest.userName} has ${Math.max(0, summary.remainingDays)} Annual leave day(s) remaining for ${year}.`);
            return;
          }
        }
      }

      await updateDoc(doc(db, 'leaves', mcRequest.id), {
        status,
        reviewedAt: serverTimestamp(),
        reviewedBy: currentUser.name
      });
      await logSystemAction(
        currentUser.name,
        status === 'approved' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
        `${status === 'approved' ? 'Approved' : 'Rejected'} ${mcRequest.type || 'MC'} application for ${mcRequest.userName} (${mcRequest.startDate || '-'} to ${mcRequest.endDate || '-'})`
      );
    } catch (error) {
      console.error('Leave/MC review failed:', error);
      alert(`Unable to mark this Leave/MC application as ${status}.`);
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
    const email = f.email.value.trim().toLowerCase();
    const existingUser = users.find(user => user.userid?.toLowerCase() === userId.toLowerCase());
    if (existingUser) {
      alert(isUserActive(existingUser)
        ? `User ID ${userId} already exists.`
        : `User ID ${userId} belongs to an inactive staff account. Reactivate that account instead.`);
      return;
    }

    if (!EMAIL_PATTERN.test(email)) {
      alert('Enter a valid email address for password recovery.');
      return;
    }

    let authCredential = null;
    try {
      authCredential = await createUserWithEmailAndPassword(staffProvisioningAuth, email, f.password.value);
      try {
        await addDoc(collection(db, "users"), {
          userid: userId,
          name: f.name.value.trim(),
          email,
          authEmail: email,
          authUid: authCredential.user.uid,
          role: f.role.value,
          active: true,
          createdAt: serverTimestamp()
        });
      } catch (firestoreError) {
        await deleteUser(authCredential.user).catch(() => {});
        throw firestoreError;
      }
      await logSystemAction(currentUser.name, 'STAFF_CREATE', `Created new staff profile: ${f.name.value.trim()} (${userId})`);
      f.reset();
      alert('User created with Firebase Authentication.');
    } catch (error) {
      console.error('Staff account creation failed:', error);
      const message = error.code === 'auth/email-already-in-use'
        ? 'That email address is already used by another Firebase account.'
        : getAuthSetupMessage(error, 'Unable to create the staff account.');
      alert(message);
    } finally {
      await signOut(staffProvisioningAuth).catch(() => {});
    }
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
  const upcomingBirthdays = currentUser?.role === 'admin' ? getUpcomingBirthdays(users, currentTime, 7) : [];
  const annualLeaveBalanceByStaffDocId = new Map(annualLeaveBalances.map(balance => [balance.userDocId, balance]));
  const getStaffAnnualLeaveSummary = (staff) => {
    const balance = annualLeaveBalanceByStaffDocId.get(staff?.dbId);
    return getAnnualLeaveSummary(leaves, staff?.userid, annualLeaveYear, balance?.entitlement || 0);
  };
  const myAnnualLeaveSummary = getStaffAnnualLeaveSummary(currentUser);
  const annualLeaveYearOptions = Array.from({ length: 5 }, (_, index) => new Date().getFullYear() - 2 + index);

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

  const normalizedCustomerSearch = customerSearch.trim().toLowerCase();
  const filteredCustomerDetails = customerDetails.filter(customer => (
    !normalizedCustomerSearch ||
    (customer.customerName || '').toLowerCase().includes(normalizedCustomerSearch) ||
    (customer.phoneNumber || '').toLowerCase().includes(normalizedCustomerSearch) ||
    (customer.address || '').toLowerCase().includes(normalizedCustomerSearch) ||
    (customer.remark || '').toLowerCase().includes(normalizedCustomerSearch) ||
    (customer.keyedInBy || '').toLowerCase().includes(normalizedCustomerSearch)
  ));

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

  const [laundryStockYear, laundryStockMonthNumber] = laundryStockMonth.split('-').map(Number);
  const laundryStockDaysInMonth = new Date(laundryStockYear, laundryStockMonthNumber, 0).getDate();
  const laundryStockMonthStart = `${laundryStockMonth}-01`;
  const laundryStockMonthEnd = `${laundryStockMonth}-${String(laundryStockDaysInMonth).padStart(2, '0')}`;
  const filteredLaundryStockMovements = filterAndSortLaundryStockMovements(
    laundryStockMovements,
    laundryStockStartDate,
    laundryStockEndDate
  );
  const hasLaundryStockDateFilter = Boolean(laundryStockStartDate || laundryStockEndDate);
  const monthlyLaundryStockSummary = LAUNDRY_STOCK_ITEMS.map(item => {
    const itemMovements = filteredLaundryStockMovements.filter(movement => movement.item === item);
    const received = itemMovements
      .filter(movement => movement.movementType === 'received')
      .reduce((total, movement) => total + (Number(movement.quantity) || 0), 0);
    const givenOut = itemMovements
      .filter(movement => movement.movementType === 'given_out')
      .reduce((total, movement) => total + (Number(movement.quantity) || 0), 0);
    return { item, received, givenOut, net: received - givenOut };
  });
  const monthlyLaundryStockTotals = monthlyLaundryStockSummary.reduce((totals, row) => ({
    received: totals.received + row.received,
    givenOut: totals.givenOut + row.givenOut,
    net: totals.net + row.net
  }), { received: 0, givenOut: 0, net: 0 });
  const laundryStockDailyMovementMap = filteredLaundryStockMovements.reduce((dailyMap, movement) => {
    const dateKey = movement.transactionDate;
    if (!dateKey || !LAUNDRY_STOCK_ITEMS.includes(movement.item)) return dailyMap;
    if (!dailyMap[dateKey]) dailyMap[dateKey] = {};
    if (!dailyMap[dateKey][movement.item]) dailyMap[dateKey][movement.item] = { received: 0, givenOut: 0 };
    if (movement.movementType === 'received') {
      dailyMap[dateKey][movement.item].received += Number(movement.quantity) || 0;
    } else if (movement.movementType === 'given_out') {
      dailyMap[dateKey][movement.item].givenOut += Number(movement.quantity) || 0;
    }
    return dailyMap;
  }, {});
  const laundryStockDailyRows = Array.from({ length: laundryStockDaysInMonth }, (_, index) => {
    const day = index + 1;
    const dateKey = `${laundryStockMonth}-${String(day).padStart(2, '0')}`;
    return { day, dateKey, items: laundryStockDailyMovementMap[dateKey] || {} };
  }).filter(row => {
    if (laundryStockStartDate && row.dateKey < laundryStockStartDate) return false;
    if (laundryStockEndDate && row.dateKey > laundryStockEndDate) return false;
    return true;
  });
  const laundryStockMonthDisplay = monthIsoToDisplay(laundryStockMonth);

  const housekeepingRooms = [...rooms]
    .filter(room => room.type !== 'STORE' && room.floor !== 'Public')
    .sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
  const housekeepingStaff = users
    .filter(user => user.role !== 'admin' && isUserActive(user))
    .sort((a, b) => (a.name || a.userid || '').localeCompare(b.name || b.userid || ''));
  const [housekeepingYear, housekeepingMonthNumber] = housekeepingMonth.split('-').map(Number);
  const housekeepingDaysInMonth = new Date(housekeepingYear, housekeepingMonthNumber, 0).getDate();
  const housekeepingCalendarDays = Array.from({ length: housekeepingDaysInMonth }, (_, index) => {
    const day = index + 1;
    const dateKey = `${housekeepingMonth}-${String(day).padStart(2, '0')}`;
    const date = new Date(`${dateKey}T00:00:00`);
    return {
      day,
      dateKey,
      weekday: date.toLocaleDateString('en-MY', { weekday: 'short' }),
      isWeekend: date.getDay() === 0 || date.getDay() === 6
    };
  });
  const housekeepingCellRecordMap = housekeepingRecords.reduce((cellMap, record) => {
    if (!record.serviceDate || record.roomId === undefined || record.roomId === null) return cellMap;
    const cellKey = `${record.roomId}|${record.serviceDate}`;
    if (!cellMap[cellKey]) cellMap[cellKey] = [];
    cellMap[cellKey].push(record);
    return cellMap;
  }, {});
  Object.values(housekeepingCellRecordMap).forEach(records => records.sort((a, b) => {
    const aCreated = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const bCreated = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return aCreated - bCreated;
  }));
  const housekeepingCustomerInfoMap = housekeepingCustomerRecords.reduce((cellMap, record) => {
    if (!record.serviceDate || record.roomId === undefined || record.roomId === null) return cellMap;
    cellMap[`${record.roomId}|${record.serviceDate}`] = record;
    return cellMap;
  }, {});
  const housekeepingSmartResult = parseHousekeepingArrangementText(housekeepingSmartText, housekeepingRooms, housekeepingMonth);
  const housekeepingUniqueRooms = new Set(housekeepingRecords.map(record => String(record.roomId))).size;
  const housekeepingUniqueStaff = new Set(housekeepingRecords.map(record => record.staffDocId || record.staffId)).size;
  const housekeepingAssignedCells = Object.keys(housekeepingCellRecordMap).length;
  const housekeepingMonthDisplay = monthIsoToDisplay(housekeepingMonth);
  const todayIsoDate = getLocalIsoDate();

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

  if (passwordResetCode) {
    return (
      <div className="app-container">
        <div className="login-container password-reset-page">
          <form className="login-card" onSubmit={handleCompletePasswordReset}>
            <div className="login-icon"><i className="fa-solid fa-key"></i></div>
            <h1>Reset Password</h1>

            {resetLinkState.status === 'checking' && (
              <div className="reset-link-checking" role="status">
                <i className="fa-solid fa-spinner fa-spin"></i>
                <span>Checking your secure reset link...</span>
              </div>
            )}

            {resetLinkState.status === 'ready' && (
              <>
                <p className="forgot-password-instructions">
                  Choose a new password for <strong>{maskEmailAddress(resetLinkState.email)}</strong>.
                </p>
                <label className="login-field-label" htmlFor="reset-new-password">New Password</label>
                <PasswordField
                  wrapperClassName="login-password-field"
                  id="reset-new-password"
                  name="newPassword"
                  toggleLabel="new password"
                  placeholder="Enter new password"
                  autoComplete="new-password"
                  autoFocus
                  required
                />
                <label className="login-field-label" htmlFor="reset-confirm-password">Confirm Password</label>
                <PasswordField
                  wrapperClassName="login-password-field"
                  id="reset-confirm-password"
                  name="confirmPassword"
                  toggleLabel="password confirmation"
                  placeholder="Enter the same password again"
                  autoComplete="new-password"
                  required
                />
              </>
            )}

            {resetLinkState.message && (
              <p className={`reset-feedback ${resetLinkState.status === 'success' ? 'success' : 'error'}`} role="status">
                <i className={`fa-solid ${resetLinkState.status === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
                {resetLinkState.message}
              </p>
            )}

            {resetLinkState.status === 'ready' && (
              <button type="submit" className="btn blue login-submit-btn" disabled={isResetLinkSubmitting}>
                {isResetLinkSubmitting ? <><i className="fa-solid fa-spinner fa-spin"></i> Saving...</> : <><i className="fa-solid fa-floppy-disk"></i> Save New Password</>}
              </button>
            )}

            {['success', 'error'].includes(resetLinkState.status) && (
              <button type="button" className="btn blue login-submit-btn" onClick={leavePasswordResetPage}>
                <i className="fa-solid fa-arrow-left"></i> Return to Login
              </button>
            )}
          </form>
        </div>
      </div>
    );
  }

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
                Enter your User ID. Firebase will email a secure reset link to the address saved in your profile.
              </p>
              <p className="forgot-password-spam-note">
                <i className="fa-solid fa-envelope-open-text"></i>
                Didn&apos;t receive the link? Please check your email Spam or Junk folder.
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
                  {isResetSubmitting ? <><i className="fa-solid fa-spinner fa-spin"></i> Sending...</> : <><i className="fa-solid fa-envelope"></i> Email Reset Link</>}
                </button>
              )}
              <button type="button" className="login-link-btn" onClick={closeForgotPassword}>
                <i className="fa-solid fa-arrow-left"></i> Back to Login
              </button>
            </form>
          ) : (
            <form className="login-card" onSubmit={handleLogin}>
              <div className="login-icon login-monogram" aria-hidden="true"><span>AD</span></div>
              <span className="login-eyebrow">Hotel Management Portal</span>
              <h1>Aladdin Dream Hotel</h1>
              <p className="login-welcome">Welcome back. Sign in to continue.</p>
              <input placeholder="User ID" value={loginId} onChange={e => setLoginId(e.target.value)} autoComplete="username" required />
              <PasswordField
                wrapperClassName="login-password-field"
                toggleLabel="login password"
                placeholder="Password"
                value={loginPass}
                onChange={e => setLoginPass(e.target.value)}
                autoComplete="current-password"
                required
              />
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
    <div className={`app-container ${isDrawerCollapsed ? 'drawer-collapsed' : ''}`}>
      {currentUser.role === 'admin' && (activeAdminAlert || upcomingBirthdays.length > 0) && (
        <div className="admin-alert-stack">
        {activeAdminAlert && <aside className="admin-away-alert" role="alert" aria-live="assertive">
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
        </aside>}
        {upcomingBirthdays.length > 0 && (
          <aside className="admin-birthday-alert" role="status" aria-live="polite">
            <div className="admin-birthday-alert-icon"><i className="fa-solid fa-cake-candles"></i></div>
            <div className="admin-birthday-alert-content">
              <div className="admin-birthday-alert-heading">
                <strong>Upcoming Staff Birthday{upcomingBirthdays.length === 1 ? '' : 's'}</strong>
                <span>Within 7 days</span>
              </div>
              <ul>
                {upcomingBirthdays.map(staff => (
                  <li key={staff.dbId || staff.userid}>
                    <strong>{staff.name || staff.userid}</strong>
                    <span>
                      {staff.nextBirthday.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}
                      {' · '}
                      {staff.daysUntil === 0 ? 'Today' : staff.daysUntil === 1 ? 'Tomorrow' : `In ${staff.daysUntil} days`}
                    </span>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => changeView('ADMIN')}>View Staff</button>
            </div>
          </aside>
        )}
        </div>
      )}
      <button
        type="button"
        className={`drawer-overlay ${isDrawerOpen ? 'visible' : ''}`}
        onClick={() => setIsDrawerOpen(false)}
        aria-label="Close navigation menu"
        tabIndex={isDrawerOpen ? 0 : -1}
      />
      <aside id="app-navigation" className={`app-drawer ${isDrawerOpen ? 'open' : ''}`} aria-label="Main navigation">
        <div className="drawer-brand hotel-brand">
          <span className="brand-icon"><i className="fa-solid fa-hotel"></i></span>
          <div>
            <h1>Aladdin Dream Hotel</h1>
            <span className="brand-subtitle">Hotel Management System</span>
          </div>
          <button type="button" className="drawer-close" onClick={() => setIsDrawerOpen(false)} aria-label="Close navigation menu">
            <i className="fa-solid fa-xmark"></i>
          </button>
          <button type="button" className="drawer-collapse" onClick={() => setIsDrawerCollapsed(true)} aria-label="Hide navigation drawer" title="Hide navigation drawer">
            <i className="fa-solid fa-angles-left"></i>
          </button>
        </div>

        <nav className="drawer-navigation">
          <span className="drawer-section-label">Operations</span>
          {Object.keys(ICONS).map(v => {
            if (v === 'ATT_REPORT' && currentUser.role !== 'admin') return null;
            return (
              <button key={v} className={view === v ? 'active' : ''} onClick={() => changeView(v)} aria-current={view === v ? 'page' : undefined}>
                {v === 'HELP' ? (
                  <span className="help-dialog-icon" aria-hidden="true"><i className="fa-solid fa-comment"></i><b>?</b></span>
                ) : (
                  <i className={ICONS[v].icon}></i>
                )}
                <span>{ICONS[v].label}</span>
                {v === 'REQ' && myPendingRequests > 0 && <span className="nav-badge">{myPendingRequests}</span>}
              </button>
            );
          })}
          {currentUser.role === 'admin' && (
            <>
              <span className="drawer-section-label admin-label">Administration</span>
              <button className={view === 'GUEST_FEEDBACK' ? 'active' : ''} onClick={() => changeView('GUEST_FEEDBACK')} aria-current={view === 'GUEST_FEEDBACK' ? 'page' : undefined}>
                <i className="fa-solid fa-star"></i> <span>Guest Feedback</span>
              </button>
              <button className={view === 'BILLS' ? 'active' : ''} onClick={() => changeView('BILLS')} aria-current={view === 'BILLS' ? 'page' : undefined}>
                <i className="fa-solid fa-bolt"></i> <span>SAJ / TNB Bills</span>
              </button>
              <button className={view === 'ADMIN' ? 'active' : ''} onClick={() => changeView('ADMIN')} aria-current={view === 'ADMIN' ? 'page' : undefined}>
                <i className="fa-solid fa-lock"></i> <span>Admin</span>
                {(pendingLeavesCount + pendingPasswordResetCount + unreadAdminAlerts.length) > 0 && (
                  <span className="nav-badge">{pendingLeavesCount + pendingPasswordResetCount + unreadAdminAlerts.length}</span>
                )}
              </button>
            </>
          )}
        </nav>

        <div className="drawer-account">
          <button type="button" className="drawer-profile" onClick={openProfilePortal} title="Open profile">
            <i className="fa-solid fa-circle-user"></i>
            <span><strong>{currentUser.name}</strong><small>{currentUser.role}</small></span>
            <i className="fa-solid fa-chevron-right"></i>
          </button>
          <button onClick={handleLogout} className="drawer-logout" title="Logout">
            <i className="fa-solid fa-right-from-bracket"></i> <span>Logout</span>
          </button>
        </div>
      </aside>

      <header className="header compact-header">
        <div className="header-content">
          <button
            type="button"
            className="drawer-toggle"
            onClick={() => {
              if (window.matchMedia('(max-width: 768px)').matches) setIsDrawerOpen(open => !open);
              else setIsDrawerCollapsed(false);
            }}
            aria-expanded={isDrawerOpen}
            aria-controls="app-navigation"
            aria-label="Show navigation menu"
          >
            <i className="fa-solid fa-bars"></i>
          </button>
          <div className="current-page-title">
            <span>{['BILLS', 'GUEST_FEEDBACK', 'ADMIN'].includes(view) ? 'Administration' : 'Hotel Operations'}</span>
            <strong>{view === 'BILLS' ? 'SAJ / TNB Bills' : view === 'GUEST_FEEDBACK' ? 'Guest Feedback' : view === 'ADMIN' ? 'Admin' : (ICONS[view]?.label || 'Dashboard')}</strong>
          </div>
          <button type="button" className="header-profile" onClick={openProfilePortal} title="Open profile">
            <i className="fa-solid fa-circle-user"></i>
            <span>{currentUser.name}</span>
          </button>
        </div>
      </header>

      {/* --- VIEW: HELP & USER GUIDE --- */}
      {view === 'HELP' && (() => {
        const normalizedSearch = helpSearch.trim().toLowerCase();
        const visibleTopics = HELP_TOPICS.filter(topic => (
          (topic.audience === 'all' || currentUser.role === topic.audience) &&
          (!normalizedSearch || `${topic.title} ${topic.summary} ${topic.keywords}`.toLowerCase().includes(normalizedSearch))
        ));

        return (
          <main className="help-page">
            <section className="help-hero">
              <div className="help-hero-copy">
                <span className="help-hero-icon" aria-hidden="true"><i className="fa-solid fa-comment"></i><b>?</b></span>
                <div>
                  <p className="help-eyebrow">HELP CENTRE</p>
                  <h2>How can we help?</h2>
                  <p>Find quick, step-by-step guides for the hotel portal.</p>
                </div>
              </div>
              <label className="help-search">
                <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                <input
                  type="search"
                  value={helpSearch}
                  onChange={event => setHelpSearch(event.target.value)}
                  placeholder="Search help, e.g. password"
                  aria-label="Search help guides"
                />
                {helpSearch && (
                  <button type="button" onClick={() => setHelpSearch('')} aria-label="Clear help search">
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                )}
              </label>
            </section>

            {!normalizedSearch && (
              <section className="help-featured" aria-labelledby="help-featured-title">
                <div className="help-featured-icon"><i className="fa-solid fa-key"></i></div>
                <div>
                  <span>Most viewed guide</span>
                  <h3 id="help-featured-title">Need to change your password?</h3>
                  <p>Open your profile, choose Password & Security, then confirm your current and new passwords.</p>
                </div>
                <button type="button" className="btn blue" onClick={openPasswordSettings}>
                  Open settings <i className="fa-solid fa-arrow-right"></i>
                </button>
              </section>
            )}

            <section className="help-guides" aria-labelledby="help-guides-title">
              <div className="help-section-heading">
                <div>
                  <p>STEP-BY-STEP</p>
                  <h3 id="help-guides-title">{normalizedSearch ? 'Search results' : 'Popular guides'}</h3>
                </div>
                <span>{visibleTopics.length} {visibleTopics.length === 1 ? 'guide' : 'guides'}</span>
              </div>

              {visibleTopics.length > 0 ? (
                <div className="help-topic-grid">
                  {visibleTopics.map(topic => (
                    <details className={`help-topic ${topic.featured ? 'featured' : ''}`} key={topic.id} open={topic.featured && !normalizedSearch}>
                      <summary>
                        <span className="help-topic-icon"><i className={topic.icon}></i></span>
                        <span className="help-topic-title">
                          <strong>{topic.title}</strong>
                          <small>{topic.summary}</small>
                        </span>
                        {topic.audience === 'admin' && <span className="help-admin-badge">Admin</span>}
                        <i className="fa-solid fa-chevron-down help-chevron" aria-hidden="true"></i>
                      </summary>
                      <div className="help-topic-body">
                        <ol>
                          {topic.steps.map((step, index) => <li key={step}><span>{index + 1}</span><p>{step}</p></li>)}
                        </ol>
                        {topic.tip && <p className="help-tip"><i className="fa-solid fa-lightbulb"></i><span><strong>Good to know:</strong> {topic.tip}</span></p>}
                        {topic.action && (
                          <button type="button" className="help-topic-action" onClick={() => handleHelpAction(topic.action)}>
                            {topic.actionLabel} <i className="fa-solid fa-arrow-right"></i>
                          </button>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <div className="help-empty-state">
                  <i className="fa-solid fa-magnifying-glass"></i>
                  <h3>No guide found</h3>
                  <p>Try a shorter search such as “password”, “attendance” or “request”.</p>
                  <button type="button" onClick={() => setHelpSearch('')}>Clear search</button>
                </div>
              )}
            </section>

            <aside className="help-support-note">
              <i className="fa-solid fa-circle-info"></i>
              <div><strong>Still need help?</strong><span>Contact an administrator and describe the page, room or staff account involved.</span></div>
            </aside>
          </main>
        );
      })()}

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

      {/* --- VIEW: CUSTOMER DETAILS --- */}
      {view === 'CUSTOMERS' && (
        <div className="dashboard customer-details-page">
          <div className="list-view customer-entry-panel">
            <h2><i className="fa-solid fa-address-card"></i> Add Customer Detail</h2>
            <p className="customer-entry-intro">Record a customer call. Staff and added time are captured automatically.</p>
            <form className="customer-entry-form" onSubmit={handleAddCustomerDetail}>
              <label>
                <span>Customer Name</span>
                <div className="customer-input-wrap">
                  <i className="fa-solid fa-user"></i>
                  <input name="customerName" type="text" placeholder="Enter customer name" autoComplete="name" maxLength="100" required />
                </div>
              </label>
              <label>
                <span>Phone Number</span>
                <div className="customer-input-wrap">
                  <i className="fa-solid fa-phone"></i>
                  <input name="phoneNumber" type="tel" placeholder="e.g. 0123456789" autoComplete="tel" inputMode="tel" maxLength="20" required />
                </div>
              </label>
              <label className="customer-address-field">
                <span>Address <small>Optional</small></span>
                <div className="customer-input-wrap">
                  <i className="fa-solid fa-location-dot"></i>
                  <input name="address" type="text" placeholder="Enter customer address" autoComplete="street-address" maxLength="300" />
                </div>
              </label>
              <label>
                <span>Keyed In By <small>Auto</small></span>
                <div className="customer-input-wrap readonly">
                  <i className="fa-solid fa-id-badge"></i>
                  <input value={`${currentUser.name} (${currentUser.userid})`} readOnly aria-label="Staff recording this customer detail" />
                </div>
              </label>
              <label>
                <span>Call Time</span>
                <div className="customer-input-wrap">
                  <i className="fa-solid fa-phone-volume"></i>
                  <input type="time" lang="en-GB" value={customerCallTime} onChange={event => setCustomerCallTime(event.target.value)} required />
                </div>
              </label>
              <label className="customer-remark-field">
                <span>Remark <small>Optional</small></span>
                <div className="customer-input-wrap customer-textarea-wrap">
                  <i className="fa-solid fa-note-sticky"></i>
                  <textarea name="remark" placeholder="Add any notes about this customer call" rows="3" maxLength="500"></textarea>
                </div>
              </label>
              <div className="customer-form-actions">
                <small><i className="fa-solid fa-clock"></i> Added date and time will be saved automatically.</small>
                <button type="submit" className="btn blue" disabled={isCustomerSaving}>
                  <i className="fa-solid fa-plus"></i> {isCustomerSaving ? 'Saving...' : 'Add Customer'}
                </button>
              </div>
              {customerFeedback.message && (
                <div className={`customer-feedback ${customerFeedback.type}`} role={customerFeedback.type === 'error' ? 'alert' : 'status'}>
                  <i className={`fa-solid ${customerFeedback.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`}></i>
                  {customerFeedback.message}
                </div>
              )}
            </form>
          </div>

          <div className="list-view customer-history-panel">
            <h2 className="customer-history-title">
              <span><i className="fa-solid fa-clock-rotate-left"></i> Customer History</span>
              <input
                className="search-bar"
                type="search"
                placeholder="Search name, phone, address, remark or staff..."
                value={customerSearch}
                onChange={event => setCustomerSearch(event.target.value)}
              />
            </h2>
            <div className="admin-table-container scroll-pane scroll-pane-tall">
              <table className="customer-details-table">
                <thead>
                  <tr><th>Customer Name</th><th>Phone Number</th><th>Address</th><th>Remark</th><th>Keyed In By</th><th>Call Time</th><th>Added At</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {filteredCustomerDetails.length === 0 ? (
                    <tr><td colSpan="8" className="customer-empty-state">{normalizedCustomerSearch ? 'No matching customer details.' : 'No customer details recorded yet.'}</td></tr>
                  ) : filteredCustomerDetails.map(customer => (
                    <tr key={customer.id}>
                      <td><strong>{customer.customerName || '-'}</strong></td>
                      <td><a className="customer-phone-link" href={`tel:${customer.phoneNumber}`}>{customer.phoneNumber || '-'}</a></td>
                      <td className="customer-address-cell">{customer.address || '-'}</td>
                      <td className="customer-remark-cell">{customer.remark || '-'}</td>
                      <td>{customer.keyedInBy || '-'}{customer.keyedInById && <small className="customer-staff-id">{customer.keyedInById}</small>}</td>
                      <td>{formatClockTime(customer.callTime)}</td>
                      <td>{formatDateTime(customer.createdAt)}</td>
                      <td>
                        <div className="customer-row-actions">
                          <button type="button" className="customer-edit-btn" onClick={() => openCustomerEditor(customer)} title="Edit customer detail">
                            <i className="fa-solid fa-pen"></i> Edit
                          </button>
                          <button type="button" className="customer-delete-btn" onClick={() => handleDeleteCustomerDetail(customer)} disabled={deletingCustomerId === customer.id} title="Delete customer detail">
                            <i className={`fa-solid ${deletingCustomerId === customer.id ? 'fa-spinner fa-spin' : 'fa-trash'}`}></i>
                            {deletingCustomerId === customer.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {editingCustomer && (
        <div className="modal-overlay" onClick={closeCustomerEditor}>
          <div className="modal-content customer-edit-modal" onClick={event => event.stopPropagation()}>
            <button type="button" className="profile-close-btn" onClick={closeCustomerEditor} aria-label="Close customer editor" disabled={isCustomerUpdating}>
              <i className="fa-solid fa-xmark"></i>
            </button>
            <div className="customer-edit-modal-heading">
              <span><i className="fa-solid fa-address-card"></i></span>
              <div><p>CUSTOMER DETAILS</p><h2>Edit Customer</h2></div>
            </div>
            <form onSubmit={handleUpdateCustomerDetail}>
              <label>
                <span>Customer Name</span>
                <div className="customer-input-wrap"><i className="fa-solid fa-user"></i><input name="customerName" defaultValue={editingCustomer.customerName || ''} maxLength="100" required autoFocus /></div>
              </label>
              <label>
                <span>Phone Number</span>
                <div className="customer-input-wrap"><i className="fa-solid fa-phone"></i><input name="phoneNumber" type="tel" defaultValue={editingCustomer.phoneNumber || ''} inputMode="tel" maxLength="20" required /></div>
              </label>
              <label>
                <span>Address <small>Optional</small></span>
                <div className="customer-input-wrap"><i className="fa-solid fa-location-dot"></i><input name="address" defaultValue={editingCustomer.address || ''} maxLength="300" /></div>
              </label>
              <label>
                <span>Call Time</span>
                <div className="customer-input-wrap"><i className="fa-solid fa-phone-volume"></i><input name="callTime" type="time" lang="en-GB" defaultValue={editingCustomer.callTime || getLocalTimeValue()} required /></div>
              </label>
              <label className="customer-edit-remark-field">
                <span>Remark <small>Optional</small></span>
                <div className="customer-input-wrap customer-textarea-wrap"><i className="fa-solid fa-note-sticky"></i><textarea name="remark" defaultValue={editingCustomer.remark || ''} rows="3" maxLength="500"></textarea></div>
              </label>
              {customerEditFeedback.message && (
                <div className={`customer-feedback ${customerEditFeedback.type}`} role="alert">
                  <i className="fa-solid fa-circle-exclamation"></i>{customerEditFeedback.message}
                </div>
              )}
              <div className="customer-edit-modal-actions">
                <button type="button" className="btn grey" onClick={closeCustomerEditor} disabled={isCustomerUpdating}>Cancel</button>
                <button type="submit" className="btn blue" disabled={isCustomerUpdating}>
                  {isCustomerUpdating ? <><i className="fa-solid fa-spinner fa-spin"></i> Saving...</> : <><i className="fa-solid fa-floppy-disk"></i> Save Changes</>}
                </button>
              </div>
            </form>
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
          <div className="floor-section laundry-stock-ledger">
            <h2 className="floor-title laundry-stock-title">
              <span><i className="fa-solid fa-arrow-right-arrow-left"></i> Laundry Stock Received &amp; Given Out</span>
              <label className="laundry-stock-month-picker">
                <span>Month / Year</span>
                <MonthYearField
                  key={laundryStockMonth}
                  value={laundryStockMonth}
                  onChange={nextMonth => {
                    const today = getLocalIsoDate();
                    const isCurrentMonth = nextMonth === today.slice(0, 7);
                    setLaundryStockMonth(nextMonth);
                    setLaundryStockInlineEntries({});
                    setLaundryStockStartDate(isCurrentMonth ? today : '');
                    setLaundryStockEndDate(isCurrentMonth ? today : '');
                    setLaundryStockFeedback({ type: '', message: '' });
                  }}
                />
              </label>
            </h2>

            <div className="laundry-stock-summary-heading">
              <div>
                <h3>{laundryStockMonthDisplay} Daily Stock Table</h3>
                <small className="laundry-stock-inline-help">Enter quantities directly in the table, then save that date. Staff is recorded automatically as {currentUser.name}.</small>
              </div>
              <div className="laundry-stock-month-totals">
                <span className="received">Received <b>+{monthlyLaundryStockTotals.received}</b></span>
                <span className="given-out">Given Out <b>-{monthlyLaundryStockTotals.givenOut}</b></span>
                <span className={monthlyLaundryStockTotals.net < 0 ? 'net negative' : 'net'}>Net <b>{monthlyLaundryStockTotals.net > 0 ? '+' : ''}{monthlyLaundryStockTotals.net}</b></span>
              </div>
            </div>
            <div className="laundry-stock-table-filter" role="group" aria-label="Laundry Stock table date filters">
              <label>
                <span>Start Date</span>
                <input
                  type="date"
                  value={laundryStockStartDate}
                  min={laundryStockMonthStart}
                  max={laundryStockEndDate || laundryStockMonthEnd}
                  onChange={event => {
                    const selectedDate = event.target.value;
                    setLaundryStockStartDate(selectedDate);
                    if (selectedDate && (!laundryStockEndDate || laundryStockEndDate < selectedDate)) {
                      setLaundryStockEndDate(selectedDate);
                    }
                  }}
                />
              </label>
              <label>
                <span>End Date</span>
                <input
                  type="date"
                  value={laundryStockEndDate}
                  min={laundryStockStartDate || laundryStockMonthStart}
                  max={laundryStockMonthEnd}
                  onChange={event => {
                    const selectedDate = event.target.value;
                    setLaundryStockEndDate(selectedDate);
                    if (selectedDate && (!laundryStockStartDate || laundryStockStartDate > selectedDate)) {
                      setLaundryStockStartDate(selectedDate);
                    }
                  }}
                />
              </label>
              <button
                type="button"
                className="btn grey laundry-stock-show-all"
                onClick={() => {
                  setLaundryStockStartDate('');
                  setLaundryStockEndDate('');
                }}
                disabled={!hasLaundryStockDateFilter}
              >
                <i className="fa-solid fa-list"></i> Show All
              </button>
              <small>
                {hasLaundryStockDateFilter
                  ? `Showing ${laundryStockDailyRows.length} day(s), earliest to latest.`
                  : `Showing all ${laundryStockDailyRows.length} days, earliest to latest.`}
              </small>
            </div>
            {laundryStockFeedback.message && (
              <div className={`laundry-stock-feedback ${laundryStockFeedback.type}`} role={laundryStockFeedback.type === 'error' ? 'alert' : 'status'}>
                <i className={`fa-solid ${laundryStockFeedback.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`}></i>
                {laundryStockFeedback.message}
              </div>
            )}
            <div className="admin-table-container laundry-stock-month-table-wrap">
              <table className="laundry-stock-month-table">
                <thead>
                  <tr>
                    <th rowSpan="2">Date / Item</th>
                    {LAUNDRY_STOCK_ITEMS.map(item => <th key={item} colSpan="2" className="laundry-stock-item-heading">{item}</th>)}
                    <th rowSpan="2" className="laundry-stock-save-heading">Action</th>
                  </tr>
                  <tr>
                    {LAUNDRY_STOCK_ITEMS.map(item => (
                      <React.Fragment key={item}>
                        <th className="received-subheading">Received</th>
                        <th className="given-out-subheading">Given Out</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {laundryStockDailyRows.map(row => (
                    <tr key={row.dateKey}>
                      <td className="laundry-stock-day"><strong>{row.day}</strong></td>
                      {LAUNDRY_STOCK_ITEMS.map(item => {
                        const dailyTotals = row.items[item] || { received: 0, givenOut: 0 };
                        const receivedEntryKey = `${row.dateKey}|${item}|received`;
                        const givenOutEntryKey = `${row.dateKey}|${item}|given_out`;
                        return (
                          <React.Fragment key={item}>
                            <td className="inline-stock-entry received-entry">
                              <strong>{dailyTotals.received}</strong>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={laundryStockInlineEntries[receivedEntryKey] || ''}
                                onChange={event => handleLaundryStockInlineChange(row.dateKey, item, 'received', event.target.value)}
                                onKeyDown={event => event.key === 'Enter' && handleSaveLaundryStockRow(row.dateKey)}
                                placeholder="+ Qty"
                                aria-label={`${item} received on day ${row.day}`}
                                disabled={savingLaundryStockDate === row.dateKey}
                              />
                            </td>
                            <td className="inline-stock-entry given-out-entry">
                              <strong>{dailyTotals.givenOut}</strong>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={laundryStockInlineEntries[givenOutEntryKey] || ''}
                                onChange={event => handleLaundryStockInlineChange(row.dateKey, item, 'given_out', event.target.value)}
                                onKeyDown={event => event.key === 'Enter' && handleSaveLaundryStockRow(row.dateKey)}
                                placeholder="+ Qty"
                                aria-label={`${item} given out on day ${row.day}`}
                                disabled={savingLaundryStockDate === row.dateKey}
                              />
                            </td>
                          </React.Fragment>
                        );
                      })}
                      <td className="laundry-stock-row-action">
                        <button
                          type="button"
                          className="btn blue"
                          onClick={() => handleSaveLaundryStockRow(row.dateKey)}
                          disabled={Boolean(savingLaundryStockDate)}
                          title={`Save day ${row.day}`}
                        >
                          <i className={`fa-solid ${savingLaundryStockDate === row.dateKey ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`}></i>
                          <span>{savingLaundryStockDate === row.dateKey ? 'Saving' : 'Save'}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="movement-total-row">
                    <td>{hasLaundryStockDateFilter ? 'Filtered In / Out' : 'Monthly In / Out'}</td>
                    {monthlyLaundryStockSummary.map(row => (
                      <React.Fragment key={row.item}>
                        <td>+{row.received}</td>
                        <td>-{row.givenOut}</td>
                      </React.Fragment>
                    ))}
                    <td></td>
                  </tr>
                  <tr className="net-total-row">
                    <td>Final Total</td>
                    {monthlyLaundryStockSummary.map(row => (
                      <td key={row.item} colSpan="2">
                        <strong className={row.net < 0 ? 'negative' : ''}>{row.net > 0 ? '+' : ''}{row.net}</strong>
                        <small>Received − Given Out</small>
                      </td>
                    ))}
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="laundry-stock-mobile-table">
              <div className="mobile-stock-legend">
                <span className="received"><i className="fa-solid fa-arrow-down"></i> Received</span>
                <span className="given-out"><i className="fa-solid fa-arrow-up"></i> Given Out</span>
              </div>
              {laundryStockDailyRows.map(row => {
                const dayReceived = Object.values(row.items).reduce((total, item) => total + item.received, 0);
                const dayGivenOut = Object.values(row.items).reduce((total, item) => total + item.givenOut, 0);
                return (
                  <details className="mobile-stock-day" key={row.dateKey}>
                    <summary>
                      <span className="mobile-stock-date">
                        <strong>{row.day}</strong>
                        <span>{new Date(`${row.dateKey}T00:00:00`).toLocaleDateString('en-MY', { weekday: 'short', month: 'short' })}</span>
                      </span>
                      <span className="mobile-day-totals">
                        <b className="received">+{dayReceived}</b>
                        <b className="given-out">-{dayGivenOut}</b>
                      </span>
                    </summary>
                    <div className="mobile-stock-column-headings"><span>Item</span><span>Received</span><span>Given Out</span></div>
                    {LAUNDRY_STOCK_ITEMS.map(item => {
                      const dailyTotals = row.items[item] || { received: 0, givenOut: 0 };
                      const receivedEntryKey = `${row.dateKey}|${item}|received`;
                      const givenOutEntryKey = `${row.dateKey}|${item}|given_out`;
                      return (
                        <div className="mobile-stock-item-row" key={item}>
                          <strong>{item}</strong>
                          <label className="received">
                            <span>Current {dailyTotals.received}</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={laundryStockInlineEntries[receivedEntryKey] || ''}
                              onChange={event => handleLaundryStockInlineChange(row.dateKey, item, 'received', event.target.value)}
                              onKeyDown={event => event.key === 'Enter' && handleSaveLaundryStockRow(row.dateKey)}
                              placeholder="+ Qty"
                              aria-label={`${item} received on day ${row.day}`}
                              disabled={savingLaundryStockDate === row.dateKey}
                            />
                          </label>
                          <label className="given-out">
                            <span>Current {dailyTotals.givenOut}</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={laundryStockInlineEntries[givenOutEntryKey] || ''}
                              onChange={event => handleLaundryStockInlineChange(row.dateKey, item, 'given_out', event.target.value)}
                              onKeyDown={event => event.key === 'Enter' && handleSaveLaundryStockRow(row.dateKey)}
                              placeholder="+ Qty"
                              aria-label={`${item} given out on day ${row.day}`}
                              disabled={savingLaundryStockDate === row.dateKey}
                            />
                          </label>
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      className="btn blue mobile-stock-save"
                      onClick={() => handleSaveLaundryStockRow(row.dateKey)}
                      disabled={Boolean(savingLaundryStockDate)}
                    >
                      <i className={`fa-solid ${savingLaundryStockDate === row.dateKey ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`}></i>
                      {savingLaundryStockDate === row.dateKey ? 'Saving...' : `Save Day ${row.day}`}
                    </button>
                  </details>
                );
              })}

              <section className="mobile-month-total-card">
                <h4><i className="fa-solid fa-calculator"></i> {hasLaundryStockDateFilter ? 'Filtered' : laundryStockMonthDisplay} Totals</h4>
                <div className="mobile-total-headings"><span>Item</span><span>Received</span><span>Given Out</span><span>Final Total</span></div>
                {monthlyLaundryStockSummary.map(row => (
                  <div className="mobile-total-row" key={row.item}>
                    <strong>{row.item}</strong>
                    <span className="received">+{row.received}</span>
                    <span className="given-out">-{row.givenOut}</span>
                    <span className={row.net < 0 ? 'net negative' : 'net'}>{row.net > 0 ? '+' : ''}{row.net}</span>
                  </div>
                ))}
              </section>
            </div>

            <details className="laundry-stock-records" open>
              <summary>{hasLaundryStockDateFilter ? 'Filtered Records' : 'Monthly Records'} ({filteredLaundryStockMovements.length})</summary>
              <div className="admin-table-container scroll-pane">
                <table className="laundry-stock-records-table">
                  <thead><tr><th>Date</th><th>Item</th><th>Movement</th><th>Quantity</th><th>Recorded By</th><th>Added At</th></tr></thead>
                  <tbody>
                    {filteredLaundryStockMovements.length === 0 ? (
                      <tr><td colSpan="6" className="laundry-stock-empty">No stock movements recorded for the selected date range.</td></tr>
                    ) : filteredLaundryStockMovements.map(movement => (
                      <tr key={movement.id}>
                        <td>{calendarIsoToDisplay(movement.transactionDate) || '-'}</td>
                        <td><strong>{movement.item}</strong></td>
                        <td><span className={`stock-movement-badge ${movement.movementType}`}>{movement.movementType === 'received' ? 'Received' : 'Given Out'}</span></td>
                        <td><strong>{movement.quantity}</strong></td>
                        <td>{movement.recordedBy || '-'}{movement.recordedById && <small className="laundry-stock-staff-id">{movement.recordedById}</small>}</td>
                        <td>{formatDateTime(movement.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>

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

      {/* --- VIEW: DAILY HOUSEKEEPING --- */}
      {view === 'HOUSEKEEPING' && (
        <div className="dashboard housekeeping-page">
          <section className="floor-section housekeeping-entry-panel">
            <div className="housekeeping-title-row">
              <div>
                <p className="housekeeping-eyebrow">ROOM OPERATIONS</p>
                <h2 className="floor-title"><i className="fa-solid fa-calendar-days"></i> Housekeeping Calendar</h2>
                <p className="housekeeping-intro">Open a room and date cell, tick one or more staff members, then save.</p>
              </div>
              <label className="housekeeping-month-picker">
                <span>View month</span>
                <MonthYearField key={housekeepingMonth} value={housekeepingMonth} onChange={handleHousekeepingMonthChange} />
              </label>
            </div>

            <div className="housekeeping-smart-entry">
              <div className="housekeeping-smart-heading">
                <div>
                  <span><i className="fa-solid fa-wand-magic-sparkles"></i> SMART CUSTOMER KEY IN</span>
                  <p>Paste the complete room arrangement list. The heading date, room number and remark after each dash are recognised automatically.</p>
                </div>
                <small>Example: LIST ROOM ARRANGEMENT 10/8/2026 · 1. 101 - Guest remark</small>
              </div>
              <div className="housekeeping-smart-controls">
                <textarea
                  value={housekeepingSmartText}
                  onChange={event => setHousekeepingSmartText(event.target.value)}
                  onKeyDown={event => {
                    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                      event.preventDefault();
                      handleHousekeepingSmartKeyIn();
                    }
                  }}
                  rows="5"
                  maxLength="10000"
                  placeholder="Paste the full LIST ROOM ARRANGEMENT here..."
                  aria-label="Customer information text to recognise and key in"
                ></textarea>
                <button
                  type="button"
                  className="btn blue housekeeping-smart-button"
                  onClick={handleHousekeepingSmartKeyIn}
                  disabled={!housekeepingSmartText.trim() || Boolean(housekeepingSmartResult.error) || housekeepingSmartResult.entries.length === 0 || isHousekeepingSmartSaving}
                >
                  <i className={`fa-solid ${isHousekeepingSmartSaving ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
                  {isHousekeepingSmartSaving ? 'Keying In...' : 'Auto Key In'}
                </button>
              </div>
              {housekeepingSmartText.trim() && (
                <div className={`housekeeping-smart-preview ${housekeepingSmartResult.error ? 'error' : 'ready'}`} role="status">
                  {housekeepingSmartResult.error ? (
                    <><i className="fa-solid fa-circle-exclamation"></i><span>{housekeepingSmartResult.error}</span></>
                  ) : (
                    <>
                      <i className="fa-solid fa-circle-check"></i>
                      <span><strong>Date:</strong> {calendarIsoToDisplay(housekeepingSmartResult.serviceDate)}</span>
                      <span><strong>Rooms recognised:</strong> {housekeepingSmartResult.entries.length}</span>
                      {housekeepingSmartResult.unknownRooms.length > 0 && <span><strong>Not found:</strong> {housekeepingSmartResult.unknownRooms.join(', ')}</span>}
                      <div className="housekeeping-smart-room-preview">
                        {housekeepingSmartResult.entries.map(entry => (
                          <span key={entry.roomId}><strong>{entry.roomId}</strong> — {entry.customerInfo[0] || '(blank)'}</span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {housekeepingStaff.length === 0 && (
              <div className="housekeeping-feedback error" role="alert">
                <i className="fa-solid fa-circle-exclamation"></i> No active staff accounts are available. Ask an administrator to activate or add a staff account.
              </div>
            )}
            {housekeepingFeedback.message && (
              <div className={`housekeeping-feedback ${housekeepingFeedback.type}`} role={housekeepingFeedback.type === 'error' ? 'alert' : 'status'}>
                <i className={`fa-solid ${housekeepingFeedback.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`}></i>
                {housekeepingFeedback.message}
              </div>
            )}

            <div className="housekeeping-summary-grid">
              <div><i className="fa-solid fa-list-check"></i><span><strong>{housekeepingAssignedCells}</strong> assignments</span></div>
              <div><i className="fa-solid fa-door-closed"></i><span><strong>{housekeepingUniqueRooms}</strong> rooms</span></div>
              <div><i className="fa-solid fa-users"></i><span><strong>{housekeepingUniqueStaff}</strong> staff</span></div>
            </div>
          </section>

          <section className="floor-section housekeeping-month-panel">
            <div className="housekeeping-list-heading">
              <div>
                <p>MONTHLY ROOM SCHEDULE</p>
                <h3>{housekeepingMonthDisplay}</h3>
              </div>
              <span><i className="fa-solid fa-arrows-left-right"></i> Scroll sideways to view all {housekeepingDaysInMonth} days</span>
            </div>

            <div className="housekeeping-calendar-wrap">
              {housekeepingRooms.length === 0 ? (
                <div className="housekeeping-calendar-empty"><i className="fa-solid fa-door-closed"></i> No guest rooms are available.</div>
              ) : (
                <table className="housekeeping-calendar-table">
                  <thead>
                    <tr>
                      <th className="housekeeping-room-column"><span>Room</span></th>
                      {housekeepingCalendarDays.map(day => (
                        <th
                          key={day.dateKey}
                          className={`${day.isWeekend ? 'weekend' : ''} ${day.dateKey === todayIsoDate ? 'today' : ''} ${housekeepingActiveCell?.serviceDate === day.dateKey ? 'active-column-header' : ''}`}
                        >
                          <span>{day.weekday}</span>
                          <strong>{day.day}</strong>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {housekeepingRooms.map(room => (
                      <tr key={room.id} className={housekeepingActiveCell?.roomId === String(room.id) ? 'active-housekeeping-row' : ''}>
                        <th className={`housekeeping-room-column ${housekeepingActiveCell?.roomId === String(room.id) ? 'active-row-header' : ''}`} scope="row">
                          <strong>{room.id}</strong>
                          {room.type && <small>{room.type}</small>}
                        </th>
                        {housekeepingCalendarDays.map(day => {
                          const cellKey = `${room.id}|${day.dateKey}`;
                          const cellRecords = housekeepingCellRecordMap[cellKey] || [];
                          const customerRecord = housekeepingCustomerInfoMap[cellKey];
                          const inlineCustomerInfo = housekeepingInlineCustomerDrafts[cellKey] || [customerRecord?.customerInfo1 || '', customerRecord?.customerInfo2 || ''];
                          const customerInfo = inlineCustomerInfo.filter(Boolean);
                          const customerSaveStatus = housekeepingPendingCustomerCells[cellKey] || '';
                          const isPending = Object.prototype.hasOwnProperty.call(housekeepingPendingAssignments, cellKey);
                          const pendingStaffDocIds = housekeepingPendingAssignments[cellKey] || [];
                          const assignedNames = isPending
                            ? pendingStaffDocIds.map(staffDocId => users.find(staff => staff.dbId === staffDocId)?.name).filter(Boolean)
                            : [...new Set(cellRecords.map(record => record.staffName || record.staffId).filter(Boolean))];
                          const isActiveRow = housekeepingActiveCell?.roomId === String(room.id);
                          const isActiveColumn = housekeepingActiveCell?.serviceDate === day.dateKey;
                          const isActiveCell = isActiveRow && isActiveColumn;
                          return (
                            <td
                              key={day.dateKey}
                              className={`${day.isWeekend ? 'weekend' : ''} ${day.dateKey === todayIsoDate ? 'today' : ''} ${assignedNames.length > 0 ? 'assigned' : ''} ${customerInfo.length > 0 ? 'has-customer-info' : ''} ${isActiveRow ? 'active-row-cell' : ''} ${isActiveColumn ? 'active-column-cell' : ''} ${isActiveCell ? 'active-grid-cell' : ''}`}
                            >
                              <div className="housekeeping-calendar-cell">
                                <button
                                  type="button"
                                  className="housekeeping-staff-trigger"
                                  onClick={() => openHousekeepingStaffModal(day.dateKey, room, cellRecords)}
                                  disabled={isPending}
                                  aria-label={`Edit housekeeping details for Room ${room.id} on ${calendarIsoToDisplay(day.dateKey)}`}
                                  title={[assignedNames.length > 0 ? assignedNames.join(', ') : 'Unassigned', ...customerInfo].join(' | ')}
                                >
                                  <span>{assignedNames.length > 0 ? assignedNames.join(' / ') : 'Unassigned'}</span>
                                  <i className="fa-solid fa-pen" aria-hidden="true"></i>
                                </button>
                                <div className="housekeeping-customer-lines">
                                  {[0, 1].map(index => (
                                    <input
                                      key={index}
                                      type="text"
                                      value={inlineCustomerInfo[index]}
                                      maxLength="200"
                                      placeholder={`Remark ${index + 1}`}
                                      aria-label={`Room ${room.id} ${calendarIsoToDisplay(day.dateKey)} remark ${index + 1}`}
                                      onFocus={() => setHousekeepingActiveCell({ roomId: String(room.id), serviceDate: day.dateKey })}
                                      onChange={event => {
                                        const nextCustomerInfo = [...inlineCustomerInfo];
                                        nextCustomerInfo[index] = event.target.value;
                                        setHousekeepingInlineCustomerDrafts(previous => ({ ...previous, [cellKey]: nextCustomerInfo }));
                                        queueHousekeepingInlineCustomerSave(day.dateKey, room, nextCustomerInfo, customerRecord?.id || '');
                                      }}
                                    />
                                  ))}
                                  {customerSaveStatus && (
                                    <i
                                      className={`fa-solid ${customerSaveStatus === 'waiting' ? 'fa-clock' : customerSaveStatus === 'saving' ? 'fa-spinner fa-spin' : customerSaveStatus === 'saved' ? 'fa-circle-check' : 'fa-circle-exclamation'} housekeeping-inline-save-icon ${customerSaveStatus}`}
                                      title={customerSaveStatus === 'error' ? 'Unable to save remarks' : `Remark ${customerSaveStatus}`}
                                      aria-label={customerSaveStatus === 'error' ? 'Unable to save remarks' : `Remark ${customerSaveStatus}`}
                                    ></i>
                                  )}
                                </div>
                                {isPending && <i className="fa-solid fa-spinner fa-spin housekeeping-cell-spinner" aria-hidden="true"></i>}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
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
                  lang="en-GB"
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
                  lang="en-GB"
                  required 
                  style={{flex:'1', minWidth:'130px', cursor:'pointer', margin:0}} 
                  onClick={(e) => e.target.showPicker && e.target.showPicker()}
              />
              <input 
                  name="paymentTime" 
                  type="time" 
                  lang="en-GB"
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

      {/* --- VIEW: APPLY LEAVE / MEDICAL CERTIFICATE --- */}
      {view === 'MC' && (
        <div className="dashboard mc-page">
          <div className="floor-section annual-leave-self-panel">
            <div className="annual-leave-self-heading">
              <div>
                <span>MY ANNUAL LEAVE</span>
                <h2>{annualLeaveYear} Balance</h2>
              </div>
              <i className="fa-solid fa-umbrella-beach"></i>
            </div>
            <div className="annual-leave-summary-grid">
              <div><span>Entitlement</span><strong>{myAnnualLeaveSummary.entitlement}</strong><small>days</small></div>
              <div><span>Approved Used</span><strong>{myAnnualLeaveSummary.approvedDays}</strong><small>days</small></div>
              <div><span>Pending</span><strong>{myAnnualLeaveSummary.pendingDays}</strong><small>days</small></div>
              <div className={myAnnualLeaveSummary.remainingDays < 0 ? 'negative' : 'remaining'}><span>Remaining</span><strong>{myAnnualLeaveSummary.remainingDays}</strong><small>days</small></div>
            </div>
            {myAnnualLeaveSummary.entitlement === 0 && (
              <p className="annual-leave-not-configured"><i className="fa-solid fa-circle-info"></i> Your Annual leave entitlement has not been set for {annualLeaveYear}. Please contact an administrator.</p>
            )}
            {myAnnualLeaveSummary.pendingDays > 0 && (
              <p className="annual-leave-pending-note">Available after pending applications: <strong>{Math.max(0, myAnnualLeaveSummary.availableAfterPending)} days</strong></p>
            )}
            {annualLeaveFeedback.message && <p className={`annual-leave-feedback ${annualLeaveFeedback.type}`}>{annualLeaveFeedback.message}</p>}
          </div>

          <div className="floor-section mc-request-panel">
            <div className="floor-title">
              <span><i className="fa-solid fa-notes-medical"></i> Apply Leave/MC</span>
            </div>
            <p className="mc-intro">Submit your Leave/MC dates and details for Admin review.</p>

            <form className="mc-request-form" onSubmit={handleSubmitMcRequest}>
              <div className="mc-form-grid">
                <label className="mc-field-wide">
                  <span>Leave Type</span>
                  <select name="leaveType" defaultValue="" required>
                    <option value="" disabled>Select leave type</option>
                    {LEAVE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <label>
                  <span>Start Date (DD/MM/YYYY)</span>
                  <CalendarDateField name="startDate" idPrefix="mc-start-date" ariaLabel="Leave start date in day month year format" />
                </label>
                <label>
                  <span>End Date (DD/MM/YYYY)</span>
                  <CalendarDateField name="endDate" idPrefix="mc-end-date" ariaLabel="Leave end date in day month year format" />
                </label>
                <label className="mc-field-wide">
                  <span>Clinic / Hospital Name <small>(Optional)</small></span>
                  <input name="clinicName" type="text" maxLength="100" placeholder="e.g. Klinik Sentosa" />
                </label>
                <label className="mc-field-wide">
                  <span>Reason / Remarks</span>
                  <textarea name="remarks" rows="4" maxLength="500" placeholder="Briefly describe your Leave/MC application..." required></textarea>
                </label>
              </div>
              <button type="submit" className="btn blue mc-submit-btn" disabled={isMcSubmitting}>
                {isMcSubmitting
                  ? <><i className="fa-solid fa-spinner fa-spin"></i> Submitting...</>
                  : <><i className="fa-solid fa-paper-plane"></i> Submit Leave/MC Application</>}
              </button>
            </form>
          </div>

          <div className="floor-section">
            <h2 className="floor-title"><i className="fa-solid fa-clock-rotate-left"></i> My Leave/MC Applications</h2>
            <div className="mc-request-list">
              {leaves.filter(leave => leave.userId === currentUser.userid).length === 0 ? (
                <div className="mc-empty-state">
                  <i className="fa-regular fa-folder-open"></i>
                  <p>No Leave/MC applications submitted yet.</p>
                </div>
              ) : (
                leaves
                  .filter(leave => leave.userId === currentUser.userid)
                  .map(leave => (
                    <article key={leave.id} className={`mc-request-card mc-${leave.status || 'pending'}`}>
                      <div className="mc-request-card-top">
                        <div>
                          <strong>{formatDate(leave.startDate)}{leave.endDate && leave.endDate !== leave.startDate ? ` – ${formatDate(leave.endDate)}` : ''}</strong>
                          <small>Submitted {formatDate(leave.createdAt)} · {formatTime(leave.createdAt)}</small>
                        </div>
                        <span className={`req-status status-${leave.status || 'pending'}`}>{leave.status || 'pending'}</span>
                      </div>
                      <p><strong>Leave Type:</strong> {leave.type || 'MC'}</p>
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
                  lang="en-GB"
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
                  lang="en-GB"
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
                  lang="en-GB"
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

      {/* --- VIEW: ADMIN-ONLY GUEST FEEDBACK --- */}
      {view === 'GUEST_FEEDBACK' && currentUser.role === 'admin' && (() => {
        const normalizedSearch = guestFeedbackSearch.trim().toLowerCase();
        const visibleFeedback = guestFeedback.filter(entry => {
          const displayedSource = entry.source === 'Other' ? (entry.otherSource || 'Other') : (entry.source || 'Unknown');
          const matchesSource = guestFeedbackSource === 'ALL' || entry.source === guestFeedbackSource;
          const matchesSearch = !normalizedSearch || [entry.name, entry.contact, entry.remark, displayedSource]
            .some(value => String(value || '').toLowerCase().includes(normalizedSearch));
          return matchesSource && matchesSearch;
        });
        const sourceCount = source => guestFeedback.filter(entry => entry.source === source).length;

        return (
          <div className="dashboard guest-feedback-admin-page">
            <section className="guest-feedback-admin-hero">
              <div>
                <span className="guest-feedback-admin-eyebrow"><i className="fa-solid fa-shield-halved"></i> Admin only</span>
                <h2>Guest Review &amp; Feedback</h2>
                <p>Review comments submitted through the public guest feedback form.</p>
              </div>
              <div className="guest-feedback-admin-hero-icon"><i className="fa-solid fa-comments"></i></div>
            </section>

            <section className="guest-feedback-admin-summary" aria-label="Feedback source summary">
              <article className="total"><i className="fa-solid fa-inbox"></i><span><small>All feedback</small><strong>{guestFeedback.length}</strong></span></article>
              <article className="booking"><i className="fa-solid fa-b"></i><span><small>Booking.com</small><strong>{sourceCount('Booking.com')}</strong></span></article>
              <article className="ctrip"><i className="fa-solid fa-plane-departure"></i><span><small>Ctrip</small><strong>{sourceCount('Ctrip')}</strong></span></article>
              <article className="agoda"><i className="fa-solid fa-a"></i><span><small>Agoda</small><strong>{sourceCount('Agoda')}</strong></span></article>
              <article className="other"><i className="fa-solid fa-ellipsis"></i><span><small>Other</small><strong>{sourceCount('Other')}</strong></span></article>
            </section>

            <section className="floor-section guest-feedback-admin-list">
              <div className="guest-feedback-admin-heading">
                <div>
                  <span>Guest responses</span>
                  <h2 className="floor-title"><i className="fa-solid fa-clock-rotate-left"></i> Submission History</h2>
                </div>
                <small>{visibleFeedback.length} of {guestFeedback.length} response{guestFeedback.length === 1 ? '' : 's'}</small>
              </div>

              <div className="guest-feedback-admin-toolbar">
                <label className="guest-feedback-admin-search">
                  <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                  <input
                    type="search"
                    value={guestFeedbackSearch}
                    onChange={event => setGuestFeedbackSearch(event.target.value)}
                    placeholder="Search name, contact or remark..."
                    aria-label="Search guest feedback"
                  />
                </label>
                <label className="guest-feedback-admin-filter">
                  <i className="fa-solid fa-filter" aria-hidden="true"></i>
                  <select value={guestFeedbackSource} onChange={event => setGuestFeedbackSource(event.target.value)} aria-label="Filter feedback by source">
                    <option value="ALL">All sources</option>
                    <option value="Booking.com">Booking.com</option>
                    <option value="Ctrip">Ctrip</option>
                    <option value="Agoda">Agoda</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
              </div>

              {guestFeedbackLoadError ? (
                <div className="guest-feedback-admin-state error" role="alert">
                  <i className="fa-solid fa-circle-exclamation"></i>
                  <strong>Feedback could not be loaded</strong>
                  <span>{guestFeedbackLoadError}</span>
                </div>
              ) : visibleFeedback.length === 0 ? (
                <div className="guest-feedback-admin-state">
                  <i className="fa-regular fa-message"></i>
                  <strong>{guestFeedback.length === 0 ? 'No guest feedback yet' : 'No matching feedback'}</strong>
                  <span>{guestFeedback.length === 0 ? 'New public form submissions will appear here.' : 'Try changing the search or source filter.'}</span>
                </div>
              ) : (
                <div className="guest-feedback-admin-grid">
                  {visibleFeedback.map(entry => {
                    const sourceLabel = entry.source === 'Other' ? (entry.otherSource || 'Other') : (entry.source || 'Unknown');
                    const initials = String(entry.name || 'Guest').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
                    const isEmail = EMAIL_PATTERN.test(String(entry.contact || '').trim());
                    return (
                      <article key={entry.id} className="guest-feedback-admin-card">
                        <header>
                          <div className="guest-feedback-admin-avatar" aria-hidden="true">{initials || 'G'}</div>
                          <div className="guest-feedback-admin-guest">
                            <strong>{entry.name || 'Guest'}</strong>
                            <a href={isEmail ? `mailto:${entry.contact}` : `tel:${String(entry.contact || '').replace(/[^+\d]/g, '')}`}>
                              <i className={`fa-solid ${isEmail ? 'fa-envelope' : 'fa-phone'}`}></i>
                              {entry.contact || '-'}
                            </a>
                          </div>
                          <span className={`guest-feedback-admin-source ${String(entry.source || 'unknown').toLowerCase().replace(/[^a-z]+/g, '-')}`}>
                            {sourceLabel}
                          </span>
                        </header>
                        <p className="guest-feedback-admin-remark">{entry.remark || 'No remark provided.'}</p>
                        <footer>
                          <span><i className="fa-regular fa-calendar"></i> {formatDateTime(entry.submittedAt)}</span>
                          {entry.source === 'Other' && <small>Source entered by guest</small>}
                        </footer>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        );
      })()}

      {/* --- VIEW: ADMIN-ONLY SAJ / TNB MONTHLY BILLS --- */}
      {view === 'BILLS' && currentUser.role === 'admin' && (() => {
        const currentYear = String(new Date().getFullYear());
        const yearBills = utilityBills.filter(bill => String(bill.billingMonth || '').startsWith(currentYear));
        const providerTotal = (provider) => yearBills
          .filter(bill => bill.provider === provider)
          .reduce((total, bill) => total + (Number(bill.amount) || 0), 0);
        const formatCurrency = (amount) => Number(amount || 0).toLocaleString('en-MY', {
          style: 'currency', currency: 'MYR', minimumFractionDigits: 2
        });

        return (
          <div className="dashboard utility-bills-page">
            <section className="utility-bills-hero">
              <div>
                <span className="utility-eyebrow"><i className="fa-solid fa-shield-halved"></i> Admin only</span>
                <h2>SAJ / TNB Monthly Bills</h2>
                <p>Record water and electricity bills by billing month. Saving the same provider and month updates the existing record.</p>
              </div>
              <div className="utility-hero-icon"><i className="fa-solid fa-file-invoice-dollar"></i></div>
            </section>

            <div className="utility-summary-grid">
              <article><i className="fa-solid fa-droplet saj"></i><span><small>{currentYear} SAJ</small><strong>{formatCurrency(providerTotal('SAJ'))}</strong></span></article>
              <article><i className="fa-solid fa-bolt tnb"></i><span><small>{currentYear} TNB</small><strong>{formatCurrency(providerTotal('TNB'))}</strong></span></article>
              <article><i className="fa-solid fa-receipt total"></i><span><small>{currentYear} Total</small><strong>{formatCurrency(providerTotal('SAJ') + providerTotal('TNB'))}</strong></span></article>
              <article><i className="fa-solid fa-folder-open records"></i><span><small>All Records</small><strong>{utilityBills.length}</strong></span></article>
            </div>

            <section className="floor-section utility-entry-section">
              <div className="utility-section-heading">
                <div>
                  <span>Monthly entry</span>
                  <h2 className="floor-title"><i className="fa-solid fa-plus-circle"></i> Add or Update Bill</h2>
                </div>
                <small><i className="fa-solid fa-lock"></i> Visible to administrators only</small>
              </div>
              <form className="utility-bill-form" onSubmit={handleSaveUtilityBill}>
                <label>
                  <span>Provider</span>
                  <select name="provider" defaultValue="SAJ" required>
                    <option value="SAJ">SAJ · Water</option>
                    <option value="TNB">TNB · Electricity</option>
                  </select>
                </label>
                <label>
                  <span>Billing Month</span>
                  <input name="billingMonth" type="month" lang="en-GB" defaultValue={getCurrentMonthString()} required />
                </label>
                <label>
                  <span>Amount (RM)</span>
                  <input name="amount" type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00" required />
                </label>
                <label>
                  <span>Bill Date</span>
                  <input name="billDate" type="date" lang="en-GB" />
                </label>
                <label>
                  <span>Due Date</span>
                  <input name="dueDate" type="date" lang="en-GB" />
                </label>
                <label>
                  <span>Account / Reference</span>
                  <input name="accountNumber" placeholder="Optional" />
                </label>
                <label>
                  <span>Payment Status</span>
                  <select name="status" defaultValue="unpaid">
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                  </select>
                </label>
                <label className="utility-notes-field">
                  <span>Notes</span>
                  <input name="notes" placeholder="Optional remarks" />
                </label>
                <button type="submit" className="btn blue utility-save-button" disabled={isUtilityBillSaving}>
                  <i className={`fa-solid ${isUtilityBillSaving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`}></i>
                  {isUtilityBillSaving ? 'Saving...' : 'Save Bill'}
                </button>
              </form>
              {utilityBillFeedback.message && (
                <p className={`utility-bill-feedback ${utilityBillFeedback.type}`} role={utilityBillFeedback.type === 'error' ? 'alert' : 'status'}>
                  <i className={`fa-solid ${utilityBillFeedback.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`}></i>
                  {utilityBillFeedback.message}
                </p>
              )}
            </section>

            <section className="floor-section utility-history-section">
              <div className="utility-section-heading">
                <div>
                  <span>Bill register</span>
                  <h2 className="floor-title"><i className="fa-solid fa-clock-rotate-left"></i> Monthly History</h2>
                </div>
                <small>{utilityBills.length} record{utilityBills.length === 1 ? '' : 's'}</small>
              </div>
              <div className="admin-table-container scroll-pane scroll-pane-tall">
                <table className="utility-bills-table">
                  <thead>
                    <tr><th>Month</th><th>Provider</th><th>Amount</th><th>Bill / Due Date</th><th>Account / Ref.</th><th>Status</th><th>Notes</th><th>Recorded By</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {utilityBills.length === 0 ? (
                      <tr><td colSpan="9" className="utility-empty-cell"><i className="fa-solid fa-file-circle-plus"></i><strong>No bill records yet</strong><span>Add the first SAJ or TNB monthly bill above.</span></td></tr>
                    ) : utilityBills.map(bill => (
                      <tr key={bill.id}>
                        <td><strong>{monthIsoToDisplay(bill.billingMonth) || bill.billingMonth}</strong></td>
                        <td><span className={`utility-provider ${String(bill.provider).toLowerCase()}`}><i className={`fa-solid ${bill.provider === 'SAJ' ? 'fa-droplet' : 'fa-bolt'}`}></i>{bill.provider}</span></td>
                        <td className="utility-amount">{formatCurrency(bill.amount)}</td>
                        <td><span className="utility-date-pair"><small>Bill {bill.billDate ? calendarIsoToDisplay(bill.billDate) : '-'}</small><small>Due {bill.dueDate ? calendarIsoToDisplay(bill.dueDate) : '-'}</small></span></td>
                        <td>{bill.accountNumber || '-'}</td>
                        <td><span className={`utility-status ${bill.status === 'paid' ? 'paid' : 'unpaid'}`}>{bill.status === 'paid' ? 'Paid' : 'Unpaid'}</span></td>
                        <td>{bill.notes || '-'}</td>
                        <td><span className="utility-recorder"><strong>{bill.recordedBy || '-'}</strong><small>{formatTime(bill.updatedAt)}</small></span></td>
                        <td><button type="button" className="btn red utility-delete-button" onClick={() => handleDeleteUtilityBill(bill)} title="Delete bill"><i className="fa-solid fa-trash"></i></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        );
      })()}

      {/* --- VIEW: ADMIN --- */}
      {view === 'ADMIN' && (
        <div className="dashboard">

            {/* MANUAL FIRESTORE DATA BACKUP */}
            <section className="admin-backup-panel">
              <div className="admin-backup-icon"><i className="fa-solid fa-database"></i></div>
              <div className="admin-backup-copy">
                <span>Data protection · Admin only</span>
                <h2>Manual Full Data Backup</h2>
                <p>Download the current Firestore hotel records as one JSON file. This is a read-only operation and does not change live data.</p>
                <small><i className="fa-solid fa-triangle-exclamation"></i> Authentication accounts and passwords are not included. Keep the file private because it contains hotel, staff and customer information.</small>
                {backupFeedback.message && (
                  <p className={`admin-backup-feedback ${backupFeedback.type}`} role={backupFeedback.type === 'error' ? 'alert' : 'status'}>
                    <i className={`fa-solid ${backupFeedback.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`}></i>
                    {backupFeedback.message}
                  </p>
                )}
              </div>
              <button type="button" className="admin-backup-button" onClick={handleDownloadFullBackup} disabled={isBackupDownloading}>
                <i className={`fa-solid ${isBackupDownloading ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-down'}`}></i>
                <span>{isBackupDownloading ? 'Preparing Backup...' : 'Download Full Backup'}</span>
              </button>
            </section>

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
                <input name="email" type="email" placeholder="Email" autoComplete="off" required style={{flex:1.4, minWidth:'190px'}} />
                <PasswordField
                  wrapperClassName="staff-create-password-field"
                  toggleLabel="staff password"
                  name="password"
                  placeholder="Pass"
                  autoComplete="new-password"
                  required
                />
                <select name="role" style={{width:'100px'}}><option value="staff">Staff</option><option value="admin">Admin</option></select>
                <button className="btn green">Add</button>
              </form>
              <div className="admin-table-container scroll-pane scroll-pane-tall">
                <table>
                  <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Approved Device</th><th>Manage</th></tr></thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.dbId} className={`clickable-row ${isUserActive(u) ? '' : 'inactive-staff-row'} ${u.passwordResetStatus === 'pending' ? 'password-reset-row' : ''}`} onClick={() => setStaffModal(u)}>
                        <td>{u.userid}</td><td>{u.name}</td><td>{u.email || <span style={{color:'#b45309'}}>Not set</span>}</td><td>{u.role}</td>
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
                            {EMAIL_PATTERN.test(u.email?.trim() || '') && (
                              <button onClick={() => handleAdminSendPasswordReset(u)} className="btn password-reset-btn" title="Email a secure Firebase password reset link">
                                <i className="fa-solid fa-envelope"></i> Email Reset Link
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

          <div className="floor-section annual-leave-admin-panel" style={{marginTop: '20px'}}>
            <div className="annual-leave-admin-title">
              <div>
                <span>LEAVE ENTITLEMENTS</span>
                <h2><i className="fa-solid fa-calendar-check"></i> Annual Leave Balances</h2>
                <p>Set each staff member's yearly entitlement. Approved Annual leave is deducted automatically.</p>
              </div>
              <label>
                <span>Year</span>
                <select value={annualLeaveYear} onChange={event => {
                  setAnnualLeaveYear(Number(event.target.value));
                  setAnnualLeaveDrafts({});
                  setAnnualLeaveFeedback({ type: '', message: '' });
                }}>
                  {annualLeaveYearOptions.map(year => <option key={year} value={year}>{year}</option>)}
                </select>
              </label>
            </div>
            {annualLeaveFeedback.message && (
              <div className={`annual-leave-feedback ${annualLeaveFeedback.type}`} role={annualLeaveFeedback.type === 'error' ? 'alert' : 'status'}>
                <i className={`fa-solid ${annualLeaveFeedback.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`}></i>
                {annualLeaveFeedback.message}
              </div>
            )}
            <div className="admin-table-container scroll-pane">
              <table className="annual-leave-admin-table">
                <thead><tr><th>Staff</th><th>Year</th><th>Entitlement</th><th>Approved Used</th><th>Pending</th><th>Remaining</th><th>Manage</th></tr></thead>
                <tbody>
                  {users.filter(user => user.role === 'staff').length === 0 ? (
                    <tr><td colSpan="7" className="annual-leave-empty">No staff accounts available.</td></tr>
                  ) : users.filter(user => user.role === 'staff').map(staff => {
                    const balance = annualLeaveBalanceByStaffDocId.get(staff.dbId);
                    const summary = getStaffAnnualLeaveSummary(staff);
                    const inputValue = annualLeaveDrafts[staff.dbId] ?? balance?.entitlement ?? 0;
                    return (
                      <tr key={staff.dbId}>
                        <td><strong>{staff.name}</strong><small>{staff.userid}{isUserActive(staff) ? '' : ' · Inactive'}</small></td>
                        <td>{annualLeaveYear}</td>
                        <td><strong>{summary.entitlement}</strong> days</td>
                        <td>{summary.approvedDays} days</td>
                        <td>{summary.pendingDays} days</td>
                        <td><strong className={summary.remainingDays < 0 ? 'annual-leave-negative' : 'annual-leave-remaining'}>{summary.remainingDays} days</strong></td>
                        <td>
                          <div className="annual-leave-manage-control">
                            <input
                              type="number"
                              min="0"
                              max="365"
                              step="1"
                              value={inputValue}
                              onChange={event => setAnnualLeaveDrafts(previous => ({ ...previous, [staff.dbId]: event.target.value }))}
                              aria-label={`${staff.name} annual leave entitlement for ${annualLeaveYear}`}
                            />
                            <button type="button" className="btn blue" onClick={() => handleSaveAnnualLeaveBalance(staff)} disabled={savingAnnualLeaveStaffId === staff.dbId}>
                              {savingAnnualLeaveStaffId === staff.dbId ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-floppy-disk"></i>}
                              Save
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="floor-section" style={{marginTop: '20px'}}>
            <h2 className="floor-title"><i className="fa-solid fa-notes-medical"></i> Leave / MC Requests</h2>
            <div className="admin-table-container scroll-pane">
               <table>
                   <thead><tr><th>Staff</th><th>Leave Type</th><th>Leave / MC Dates</th><th>Clinic</th><th>Remarks</th><th>Submitted</th><th>Status</th></tr></thead>
                   <tbody>
                       {leaves.length === 0 ? (
                         <tr><td colSpan="7" style={{textAlign:'center', color:'#999'}}>No Leave/MC applications submitted.</td></tr>
                       ) : leaves.map(l => (
                           <tr key={l.id}>
                               <td>{l.userName}</td>
                               <td><strong>{l.type || 'MC'}</strong></td>
                               <td><strong>{formatDate(l.startDate)}</strong>{l.endDate && l.endDate !== l.startDate ? <> – <strong>{formatDate(l.endDate)}</strong></> : ''}</td>
                               <td>{l.clinicName || '-'}</td>
                               <td>{l.remarks}</td>
                               <td>{formatDate(l.createdAt)}</td>
                               <td>
                                   {l.status === 'pending' ? (
                                       <div style={{display:'flex', gap:'5px'}}>
                                           <button onClick={() => handleReviewMcRequest(l, 'approved')} className="btn green" style={{padding:'6px 9px'}} title="Approve request"><i className="fa-solid fa-check"></i></button>
                                           <button onClick={() => handleReviewMcRequest(l, 'rejected')} className="btn red" style={{padding:'6px 9px'}} title="Reject request"><i className="fa-solid fa-xmark"></i></button>
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
                  lang="en-GB"
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
      {housekeepingStaffModal && (
        <div className="modal-overlay" onClick={closeHousekeepingStaffModal}>
          <div
            className="modal-content housekeeping-staff-modal"
            onClick={event => event.stopPropagation()}
          >
            <div className="housekeeping-staff-modal-heading">
              <div>
                <p>HOUSEKEEPING TEAM</p>
                <h2>Room {housekeepingStaffModal.room.id}</h2>
                <span>{calendarIsoToDisplay(housekeepingStaffModal.serviceDate)}</span>
              </div>
              <button
                type="button"
                className="profile-close-btn"
                onClick={closeHousekeepingStaffModal}
                disabled={housekeepingAutoSaveStatus === 'saving' || housekeepingCustomerAutoSaveStatus === 'saving'}
                aria-label="Close staff selector"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <section className="housekeeping-customer-editor">
              <div className="housekeeping-customer-editor-heading">
                <div>
                  <span>CUSTOMER INFORMATION</span>
                  <p>Two remark-style fields for this room and date.</p>
                </div>
                <i className="fa-solid fa-address-card" aria-hidden="true"></i>
              </div>
              <div className="housekeeping-customer-fields">
                {[0, 1].map(index => (
                  <label key={index}>
                    <span>Customer Info {index + 1}</span>
                    <input
                      type="text"
                      value={housekeepingStaffModal.customerInfo[index]}
                      maxLength="200"
                      placeholder={index === 0 ? 'Name, booking or customer note' : 'Second customer detail or remark'}
                      disabled={housekeepingCustomerAutoSaveStatus === 'saving'}
                      onChange={event => {
                        const nextCustomerInfo = [...housekeepingStaffModal.customerInfo];
                        nextCustomerInfo[index] = event.target.value;
                        const nextModal = { ...housekeepingStaffModal, customerInfo: nextCustomerInfo };
                        setHousekeepingStaffModal(nextModal);
                        queueHousekeepingCustomerAutoSave(nextModal);
                      }}
                    />
                  </label>
                ))}
              </div>
              <div className={`housekeeping-customer-save-status ${housekeepingCustomerAutoSaveStatus}`} role="status" aria-live="polite">
                {housekeepingCustomerAutoSaveStatus === 'idle' && <><i className="fa-solid fa-bolt"></i> Customer fields save automatically</>}
                {housekeepingCustomerAutoSaveStatus === 'waiting' && <><i className="fa-solid fa-clock"></i> Customer changes pending...</>}
                {housekeepingCustomerAutoSaveStatus === 'saving' && <><i className="fa-solid fa-spinner fa-spin"></i> Saving customer information...</>}
                {housekeepingCustomerAutoSaveStatus === 'saved' && <><i className="fa-solid fa-circle-check"></i> Customer information saved</>}
                {housekeepingCustomerAutoSaveStatus === 'error' && <><i className="fa-solid fa-circle-exclamation"></i> Unable to save customer information</>}
              </div>
            </section>
            <p className="housekeeping-staff-modal-help">Select every staff member who worked on this room. Changes save automatically.</p>
            <div className="housekeeping-staff-options">
              {housekeepingStaff.map(staff => {
                const isSelected = housekeepingStaffModal.selectedStaffDocIds.includes(staff.dbId);
                return (
                  <label key={staff.dbId} className={isSelected ? 'selected' : ''}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={housekeepingAutoSaveStatus === 'saving'}
                      onChange={() => {
                        const nextModal = {
                          ...housekeepingStaffModal,
                          selectedStaffDocIds: isSelected
                            ? housekeepingStaffModal.selectedStaffDocIds.filter(staffDocId => staffDocId !== staff.dbId)
                            : [...housekeepingStaffModal.selectedStaffDocIds, staff.dbId]
                        };
                        setHousekeepingStaffModal(nextModal);
                        queueHousekeepingAutoSave(nextModal);
                      }}
                    />
                    <span>
                      <strong>{staff.name || staff.userid}</strong>
                      <small>Staff ID: {staff.userid || '-'}</small>
                    </span>
                    <i className={`fa-solid ${isSelected ? 'fa-circle-check' : 'fa-circle'}`} aria-hidden="true"></i>
                  </label>
                );
              })}
            </div>
            {housekeepingStaffModal.selectedStaffDocIds.length > 1 && (
              <div className="housekeeping-team-count"><i className="fa-solid fa-people-group"></i> {housekeepingStaffModal.selectedStaffDocIds.length} staff members selected</div>
            )}
            <div className={`housekeeping-auto-save-status ${housekeepingAutoSaveStatus}`} role="status" aria-live="polite">
              {housekeepingAutoSaveStatus === 'idle' && <><i className="fa-solid fa-bolt"></i> Select staff to save automatically</>}
              {housekeepingAutoSaveStatus === 'waiting' && <><i className="fa-solid fa-clock"></i> Changes pending...</>}
              {housekeepingAutoSaveStatus === 'saving' && <><i className="fa-solid fa-spinner fa-spin"></i> Saving...</>}
              {housekeepingAutoSaveStatus === 'saved' && <><i className="fa-solid fa-circle-check"></i> Saved automatically</>}
              {housekeepingAutoSaveStatus === 'error' && <><i className="fa-solid fa-circle-exclamation"></i> Unable to save. Please try again.</>}
            </div>
          </div>
        </div>
      )}

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
                  <button onClick={() => handleAdminSendPasswordReset(staffModal)} className="btn blue" style={{width:'100%', marginTop:'20px', justifyContent:'center'}} disabled={!EMAIL_PATTERN.test(staffModal.email?.trim() || '')}><i className="fa-solid fa-envelope"></i> Send Password Reset Email</button>
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
                    <PasswordField wrapperClassName="profile-input-wrap" leadingIcon="fa-solid fa-lock" toggleLabel="current password" name="currentPass" autoComplete="current-password" required />
                  </label>
                  <label>
                    <span>New password</span>
                    <PasswordField wrapperClassName="profile-input-wrap" leadingIcon="fa-solid fa-key" toggleLabel="new password" name="newPass" autoComplete="new-password" required />
                  </label>
                  <label>
                    <span>Confirm new password</span>
                    <PasswordField wrapperClassName="profile-input-wrap" leadingIcon="fa-solid fa-check-double" toggleLabel="new password confirmation" name="confirmPass" autoComplete="new-password" required />
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
              <div><label style={{fontSize:'0.85rem', color:'#666'}}>Booking Date</label><input type="date" lang="en-GB" value={claimForm.bookingDate} onChange={e => setClaimForm({...claimForm, bookingDate: e.target.value})} onClick={(e) => e.target.showPicker && e.target.showPicker()} style={{ cursor: 'pointer' }} required /></div>
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
