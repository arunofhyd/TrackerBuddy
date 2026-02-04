import { initializeApp } from "firebase/app";
import { REGION } from '../constants.js';

const firebaseConfig = {
    apiKey: "AIzaSyC3HKpNpDCMTlARevbpCarZGdOJJGUJ0Vc",
    authDomain: "trackerbuddyaoh.firebaseapp.com",
    projectId: "trackerbuddyaoh",
    storageBucket: "trackerbuddyaoh.firebasestorage.app",
    messagingSenderId: "612126230828",
    appId: "1:612126230828:web:763ef43baec1046d3b0489"
};

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);

// Globals for Firebase modules (exported as live bindings)
export let auth, db;
export let getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail;
export let getFirestore, doc, setDoc, deleteDoc, onSnapshot, collection, query, where, getDocs, updateDoc, getDoc, writeBatch, addDoc, deleteField, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, enableNetwork, disableNetwork, waitForPendingWrites, serverTimestamp;

let firebaseLoadedPromise = null;

export async function loadFirebaseModules() {
    if (firebaseLoadedPromise) return firebaseLoadedPromise;
    firebaseLoadedPromise = (async () => {
        const authModule = await import("firebase/auth");
        // Update exported bindings
        ({ getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } = authModule);

        const firestoreModule = await import("firebase/firestore");
        // Update exported bindings
        ({ getFirestore, doc, setDoc, deleteDoc, onSnapshot, collection, query, where, getDocs, updateDoc, getDoc, writeBatch, addDoc, deleteField, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, enableNetwork, disableNetwork, waitForPendingWrites, serverTimestamp } = firestoreModule);

        auth = getAuth(app);
        db = initializeFirestore(app, {
            localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        });
    })();
    return firebaseLoadedPromise;
}

let _functionsInstance = null;
export async function getFunctionsInstance() {
    if (_functionsInstance) return _functionsInstance;
    const { getFunctions, httpsCallable } = await import("firebase/functions");
    _functionsInstance = {
        functions: getFunctions(app, REGION),
        httpsCallable
    };
    return _functionsInstance;
}

export { app };
