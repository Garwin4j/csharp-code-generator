// FIX: Changed import to a namespace import to resolve potential module resolution errors.
import * as firebaseApp from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// ====================================================================================
// --- TROUBLESHOOTING FIREBASE AUTHENTICATION ERRORS ---
//
// If you are seeing 'auth/configuration-not-found':
// This is a common error and means your Firebase project is not configured to allow
// logins from the domain where this app is running.
//
// HOW TO FIX:
// 1. Go to the Firebase Console: https://console.firebase.google.com/
// 2. Select your project ("csharp-generator").
// 3. In the left menu, go to "Build" -> "Authentication".
// 4. Click the "Settings" tab.
// 5. Under "Authorized domains", click "Add domain".
// 6. NOTE: The Login screen will now display the exact domain it detects in the
//    error message. Enter that domain here. For example, if the error message
//    shows the domain is '12345.googleusercontent.com', you might need to add
//    'googleusercontent.com' or the full domain to the list.
// 7. ALSO, click the "Sign-in method" tab. Ensure that "Google" is listed as
//    an enabled provider. If not, click "Add new provider" and enable it.
//
//
// If you are seeing 'auth/api-key-not-valid':
// This means the configuration values below are incorrect.
//
// HOW TO FIX:
// 1. In your Firebase project settings (Gear icon -> Project settings), scroll
//    down to "Your apps".
// 2. Select your web app and find the "SDK setup and configuration" section.
// 3. Choose the "Config" option and copy the entire `firebaseConfig` object.
// 4. Paste it below, replacing the existing `firebaseConfig` object.
// ====================================================================================

  const firebaseConfig = {
    apiKey: "AIzaSyAfspUAReGbEK2lnA1I6gmCYiLQhQxyfD0", // This should be your Web API Key
    authDomain: "csharp-generator.firebaseapp.com",
    projectId: "csharp-generator",
    storageBucket: "csharp-generator.firebasestorage.app",
    messagingSenderId: "1074357957805",
    appId: "1:1074357957805:web:cd031a3890b22790fb8224",
    measurementId: "G-J0G9Y5RFW4"
  };

// Initialize Firebase
const app = firebaseApp.initializeApp(firebaseConfig);

// Initialize and export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
