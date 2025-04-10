import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAtPlfliB9PMQFpQOhbB7OUqUw1q-hfG2U",
  authDomain: "wasselny-dab30.firebaseapp.com",
  projectId: "wasselny-dab30",
  storageBucket: "wasselny-dab30.firebasestorage.app",
  messagingSenderId: "158972264047",
  appId: "1:158972264047:web:85be2569a607eff25c579a",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);