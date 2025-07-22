import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDjMUEHFjYJ3J3ncWZhVI7KvErwD0JlGiA",
  authDomain: "nextjs-teste-9c06c.firebaseapp.com",
  projectId: "nextjs-teste-9c06c",
  storageBucket: "nextjs-teste-9c06c.firebasestorage.app",
  messagingSenderId: "532623484087",
  appId: "1:532623484087:web:6b38c2a87c3ea60d1c5932"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);