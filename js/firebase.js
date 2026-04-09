// Import Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCOQB7-fkTuuTXOoABRAHW0o9Tel5i3-JM",
  authDomain: "hospitalqueuesysetm.firebaseapp.com",
  projectId: "hospitalqueuesysetm",
  storageBucket: "hospitalqueuesysetm.firebasestorage.app",
  messagingSenderId: "677416589134",
  appId: "1:677416589134:web:7d4c65d9b531f9a0d9f01f",
  measurementId: "G-0ZCVP6V0MG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

// Export db for use in other files
export { db };