// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAtPlfliB9PMQFpQOhbB7OUqUw1q-hfG2U",
  authDomain: "wasselny-dab30.firebaseapp.com",
  projectId: "wasselny-dab30",
  storageBucket: "wasselny-dab30.firebasestorage.app",
  messagingSenderId: "158972264047",
  appId: "1:158972264047:web:85be2569a607eff25c579a",
  measurementId: "G-STSCE02TG7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);