import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCw414Si-ZQbgs1J9xgLZ6RqlleOGHL5xk",
  authDomain: "school-attendence-app-28c41.firebaseapp.com",
  databaseURL: "https://school-attendence-app-28c41-default-rtdb.firebaseio.com",
  projectId: "school-attendence-app-28c41",
  storageBucket: "school-attendence-app-28c41.firebasestorage.app",
  messagingSenderId: "31823148498",
  appId: "1:31823148498:web:0fb5f914833cfb8304840b"
};


const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);