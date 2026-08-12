// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// PASTE YOUR CONFIG FROM FIREBASE CONSOLE HERE
const firebaseConfig = {
  apiKey: "AIzaSyCXBESP_6RiK863eCabD02YLKYW_bajkBg",
  authDomain: "new-portal-14fcc.firebaseapp.com",
  projectId: "new-portal-14fcc",
  storageBucket: "new-portal-14fcc.firebasestorage.app",
  messagingSenderId: "168705166984",
  appId: "1:168705166984:web:46cca45eb346b8b481193d",
  measurementId: "G-2HCGCSRVG3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Initialize the Database (Firestore)
export const db = getFirestore(app);
export const auth = getAuth(app);

// Creating an Auth user signs that Auth instance in as the new account. Admins
// therefore provision staff through a separate instance so their own session is
// not replaced.
const staffProvisioningApp = initializeApp(firebaseConfig, 'staff-provisioning');
export const staffProvisioningAuth = getAuth(staffProvisioningApp);
