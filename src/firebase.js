// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Hotel records and email/password accounts use the same Firebase project.
const firestoreConfig = {
  apiKey: "AIzaSyCXBESP_6RiK863eCabD02YLKYW_bajkBg",
  authDomain: "new-portal-14fcc.firebaseapp.com",
  projectId: "new-portal-14fcc",
  storageBucket: "new-portal-14fcc.firebasestorage.app",
  messagingSenderId: "168705166984",
  appId: "1:168705166984:web:46cca45eb346b8b481193d",
  measurementId: "G-2HCGCSRVG3"
};

// Email/password accounts and password-reset emails use this project too.
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
