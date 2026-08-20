// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Existing hotel records remain in the original Firestore project.
const firestoreConfig = {
  apiKey: "AIzaSyA2B9FPumPp_KFKxp-71l_osXvbd_qiKXg",
  authDomain: "hotel-ops-system.firebaseapp.com",
  projectId: "hotel-ops-system",
  storageBucket: "hotel-ops-system.firebasestorage.app",
  messagingSenderId: "83606842421",
  appId: "1:83606842421:web:0d1a4057a83f9f4a23957c"
};

// Email/password accounts and password-reset emails use the new Auth project.
const authConfig = {
  apiKey: "AIzaSyCXBESP_6RiK863eCabD02YLKYW_bajkBg",
  authDomain: "new-portal-14fcc.firebaseapp.com",
  projectId: "new-portal-14fcc",
  storageBucket: "new-portal-14fcc.firebasestorage.app",
  messagingSenderId: "168705166984",
  appId: "1:168705166984:web:46cca45eb346b8b481193d",
  measurementId: "G-2HCGCSRVG3"
};

const firestoreApp = initializeApp(firestoreConfig);
const authApp = initializeApp(authConfig, 'hotel-auth');

export const db = getFirestore(firestoreApp);
export const auth = getAuth(authApp);

// Creating an Auth user signs that Auth instance in as the new account. Admins
// therefore provision staff through a separate instance so their own session is
// not replaced.
const staffProvisioningApp = initializeApp(authConfig, 'staff-provisioning');
export const staffProvisioningAuth = getAuth(staffProvisioningApp);
