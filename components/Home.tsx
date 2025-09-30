
import React, { useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { Package } from '../types';
import PackageSelector from './PackageSelector';

interface HomeProps {
    user: FirebaseUser | null;
    packages: Package[];
    onSelectPackage: (packageId: string) => void;
    onNewPackage: () => void;
    onLoadFromKey: (key: string) => void;
    onLogin: () => void;
    onDeletePackage: (pkg: Package) => void;
    isLoading: boolean;
}

const GoogleIcon = () => (
    <svg className="w-6 h-6 mr-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48px" height="48px"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.618-3.317-11.28-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C42.022,35.244,44,30.036,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path></svg>
);


const GuestHome: React.FC<{ onNewPackage: () => void; onLoadFromKey: (key: string) => void; onLogin: () => void; }> = ({ onNewPackage, onLoadFromKey, onLogin }) => {
    const [key, setKey] = useState('');

    const handleLoadSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onLoadFromKey(key);
    };

    return (
        <div className="flex items-center justify-center min-h-[80vh]">
            <div className="text-center p-10 bg-gray-800/50 rounded-lg shadow-2xl border border-gray-700 max-w-4xl w-full grid md:grid-cols-2 gap-8 items-center">
                {/* Left Side: Start New */}
                <div className="p-6 border-r-0 md:border-r border-gray-700">
                    <h2 className="text-2xl font-bold text-cyan-400 mb-4">Start Fresh</h2>
                    <p className="text-gray-400 mb-6">Begin a new C# project from scratch. No account needed to get started.</p>
                    <button
                        onClick={onNewPackage}
                        className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-4 rounded-md transition-colors"
                    >
                        + New Project
                    </button>
                </div>
                {/* Right Side: Load or Login */}
                <div className="p-6">
                     <h2 className="text-2xl font-bold text-gray-300 mb-4">Continue Your Work</h2>
                     <p className="text-gray-400 mb-6">Have a project key? Enter it here to resume your session.</p>
                    <form onSubmit={handleLoadSubmit} className="flex gap-2 mb-8">
                        <input
                            type="text"
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            placeholder="Enter your project key..."
                            className="flex-grow p-3 bg-gray-900 text-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                        />
                        <button type="submit" className="bg-gray-700 hover:bg-gray-600 text-white font-bold p-3 rounded-md transition-colors">
                            Load
                        </button>
                    </form>
                    <div className="border-t border-gray-700 pt-8">
                        <p className="text-gray-400 mb-4">Or log in to see all your saved projects.</p>
                        <button
                            onClick={onLogin}
                            className="flex items-center justify-center w-full px-6 py-3 border border-transparent text-base font-medium rounded-md text-gray-800 bg-white hover:bg-gray-200"
                        >
                           <GoogleIcon />
                           Sign in with Google
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

const LoggedInHome: React.FC<{ packages: Package[], onSelectPackage: (id: string) => void, onNewPackage: () => void, isLoading: boolean, onDeletePackage: (pkg: Package) => void }> = ({ packages, onSelectPackage, onNewPackage, isLoading, onDeletePackage }) => {
    return (
        <div className="container mx-auto p-4 lg:p-8">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-white">Your Projects</h2>
                <button
                onClick={onNewPackage}
                className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
                >
                + New Project
                </button>
            </div>
            <PackageSelector packages={packages} onSelect={onSelectPackage} onDelete={onDeletePackage} isLoading={isLoading} />
        </div>
    );
};


const Home: React.FC<HomeProps> = (props) => {
    if (props.user) {
        return <LoggedInHome 
                    packages={props.packages} 
                    onSelectPackage={props.onSelectPackage} 
                    onNewPackage={props.onNewPackage}
                    onDeletePackage={props.onDeletePackage}
                    isLoading={props.isLoading}
                />;
    }
    return <GuestHome 
                onNewPackage={props.onNewPackage}
                onLoadFromKey={props.onLoadFromKey}
                onLogin={props.onLogin}
            />;
};

export default Home;
