import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from 'firebase/storage';

// ⚙️ CONFIGURACIÓN DE TU PROYECTO FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyBlfKwKBkHBqxcT11Bkjqdt5dmEJL54LCY",
  authDomain: "villa-hermosa-lotes.firebaseapp.com",
  projectId: "villa-hermosa-lotes",
  storageBucket: "villa-hermosa-lotes.firebasestorage.app",
  messagingSenderId: "198410031009",
  appId: "1:198410031009:web:882500ac28ae119a3f45e0",
};

// 🔥 Inicializar Firebase
const app = initializeApp(firebaseConfig);

// 👥 Autenticación y Base de Datos
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
