// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA4maF5vv9uSTsDK3o2uXu3H7A09SBTI_Y",
  authDomain: "video-calling-e6fe8.firebaseapp.com",
  projectId: "video-calling-e6fe8",
  storageBucket: "video-calling-e6fe8.firebasestorage.app",
  messagingSenderId: "739734383017",
  appId: "1:739734383017:web:ee00c81f3a6986f2a33cb8",
  measurementId: "G-DBDZRR3FR1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);