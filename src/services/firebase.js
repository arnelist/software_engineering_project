import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCLzQf_YN-sSHwxcnsBox0IP8ESj7vhv1E",
  authDomain: "coachbooking-2a1bf.firebaseapp.com",
  projectId: "coachbooking-2a1bf",
  storageBucket: "coachbooking-2a1bf.firebasestorage.app",
  messagingSenderId: "32368158060",
  appId: "1:32368158060:web:b1f4b651a467cacf02ff49"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);