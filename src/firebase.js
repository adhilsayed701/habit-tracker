// firebase.js

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBw_ue3SKvxQCNQUwjG4LfN83JVoy4CQpw",
  authDomain: "habit-tracker-a19bc.firebaseapp.com",
  projectId: "habit-tracker-a19bc",
  storageBucket: "habit-tracker-a19bc.firebasestorage.app",
  messagingSenderId: "708409550301",
  appId: "1:708409550301:web:ec6f542a83b947c77fc234",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log("Auth persistence enabled");
  })
  .catch((error) => {
    console.error("Persistence error:", error);
  });