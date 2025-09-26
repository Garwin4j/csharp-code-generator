import React, { useState } from 'react';
// FIX: `FirebaseError` is not exported from `firebase/auth`. It should be imported from `firebase/app`.
import { signInWithPopup } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth, googleProvider } from '../firebaseConfig';

const Login: React.FC = () => {
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async () => {
        setError(null);
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (err) {
            console.error("Authentication failed:", err);
            if (err instanceof FirebaseError) {
                if (err.code === 'auth/configuration-not-found') {
                    const hostname = window.location.hostname;
                    setError(`Configuration Not Found. This app is running on '${hostname}'. You MUST add this exact domain to the "Authorized domains" list in your Firebase Authentication settings. Also, ensure the Google Sign-in provider is enabled.`);
                } else if (err.code === 'auth/api-key-not-valid') {
                     setError('Invalid API Key. Please check the values in your firebaseConfig.ts file.');
                } else {
                    setError(`An unexpected error occurred: ${err.message}`);
                }
            } else {
                setError('An unknown authentication error occurred.');
            }
        }
    };

    return (
        <div className="flex items-center justify-center h-screen bg-gray-900">
            <div className="text-center p-10 bg-gray-800 rounded-lg shadow-2xl border border-gray-700 max-w-lg">
                <h1 className="text-3xl font-bold text-cyan-400 mb-2">Welcome to the C# Code Generator</h1>
                <p className="text-gray-400 mb-8">Sign in to begin creating and managing your projects.</p>
                
                {error && (
                    <div className="bg-red-900/30 border border-red-500 text-red-300 p-3 rounded-md mb-6 text-sm text-left">
                        <p className="font-bold">Login Error:</p>
                        <p>{error}</p>
                    </div>
                )}

                <button
                    onClick={handleLogin}
                    className="flex items-center justify-center w-full px-6 py-3 border border-transparent text-base font-medium rounded-md text-gray-800 bg-white hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white transition-all duration-300"
                >
                    <svg className="w-6 h-6 mr-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48px" height="48px"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.618-3.317-11.28-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C42.022,35.244,44,30.036,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path></svg>
                    Sign in with Google
                </button>
            </div>
        </div>
    );
};

export default Login;