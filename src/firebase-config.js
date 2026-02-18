// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDOUMLwOpQLLh8YrDNIwc1ht7qQpURFEVM",
    authDomain: "msc-korea-erp.firebaseapp.com",
    projectId: "msc-korea-erp",
    storageBucket: "msc-korea-erp.firebasestorage.app",
    messagingSenderId: "556473236618",
    appId: "1:556473236618:web:d6ff2e4e2337d8e0be4173",
    measurementId: "G-5GZ6C5TXHQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
