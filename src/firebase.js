// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// PASTE YOUR CONFIG FROM FIREBASE CONSOLE HERE
const firebaseConfig = {
  apiKey: "AIzaSyA2B9FPumPp_KFKxp-71l_osXvbd_qiKXg",
  authDomain: "hotel-ops-system.firebaseapp.com",
  projectId: "hotel-ops-system",
  storageBucket: "hotel-ops-system.firebasestorage.app",
  messagingSenderId: "83606842421",
  appId: "1:83606842421:web:0d1a4057a83f9f4a23957c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Initialize the Database (Firestore)
export const db = getFirestore(app);