const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { HttpsError, onCall } = require('firebase-functions/v2/https');

initializeApp();
const hotelRecordsApp = initializeApp({ projectId: 'hotel-ops-system' }, 'hotel-records');
const hotelDb = getFirestore(hotelRecordsApp);

const getActiveAdmin = async (authUid) => {
  const snapshot = await hotelDb.collection('users').where('authUid', '==', authUid).limit(2).get();
  if (snapshot.size !== 1) return null;

  const adminDoc = snapshot.docs[0];
  const admin = adminDoc.data();
  return admin.role === 'admin' && admin.active !== false ? { id: adminDoc.id, ...admin } : null;
};

exports.setStaffPassword = onCall({ region: 'asia-southeast1' }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in as an administrator and try again.');

  const staffDocId = typeof request.data?.staffDocId === 'string' ? request.data.staffDocId.trim() : '';
  const password = typeof request.data?.password === 'string' ? request.data.password : '';
  if (!staffDocId || staffDocId.includes('/') || password.length < 6 || password.length > 4096) {
    throw new HttpsError('invalid-argument', 'A staff account and a password of at least 6 characters are required.');
  }

  const admin = await getActiveAdmin(request.auth.uid);
  if (!admin) throw new HttpsError('permission-denied', 'Only an active administrator can set staff passwords.');

  const staffRef = hotelDb.collection('users').doc(staffDocId);
  const staffSnapshot = await staffRef.get();
  if (!staffSnapshot.exists) throw new HttpsError('not-found', 'The staff account was not found.');

  const staff = staffSnapshot.data();
  if (staff.role !== 'staff') throw new HttpsError('permission-denied', 'Only staff passwords can be changed here.');

  const auth = getAuth();
  const email = String(staff.authEmail || staff.email || '').trim().toLowerCase();
  if (!email) throw new HttpsError('failed-precondition', 'Add an email address to this staff profile first.');

  let authUser = null;
  if (staff.authUid) {
    try {
      authUser = await auth.getUser(staff.authUid);
    } catch (error) {
      if (error.code !== 'auth/user-not-found') throw error;
    }
  }
  if (!authUser) {
    try {
      authUser = await auth.getUserByEmail(email);
    } catch (error) {
      if (error.code !== 'auth/user-not-found') throw error;
    }
  }
  try {
    authUser = authUser
      ? await auth.updateUser(authUser.uid, { password })
      : await auth.createUser({ email, password, displayName: staff.name || staff.userid || undefined });
  } catch (error) {
    console.error('Unable to create or update staff auth account:', error);
    throw new HttpsError('internal', 'Unable to update the staff authentication account.');
  }

  await auth.revokeRefreshTokens(authUser.uid);
  const batch = hotelDb.batch();
  batch.update(staffRef, {
    authUid: authUser.uid,
    authEmail: authUser.email || staff.authEmail || staff.email,
    authMigratedAt: FieldValue.serverTimestamp(),
    password: FieldValue.delete(),
    passwordResetStatus: FieldValue.delete(),
    passwordResetRequestedAt: FieldValue.delete()
  });
  batch.set(hotelDb.collection('auditLogs').doc(), {
    user: admin.name || admin.userid || request.auth.uid,
    action: 'ADMIN_PASSWORD_SET',
    details: `Set a new password for staff: ${staff.name || staff.userid || staffDocId} (${staff.userid || staffDocId})`,
    timestamp: FieldValue.serverTimestamp()
  });
  await batch.commit();

  return { success: true };
});
