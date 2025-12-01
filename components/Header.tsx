
import React from 'react';
import type { User as FirebaseUser } from 'firebase/auth';

interface HeaderProps {
    user: FirebaseUser | null;
    onLogout: () => void;
    onLogin: () => void;
    onShowKey: () => void;
    isGuest: boolean;
    hasActiveProject: boolean;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout, onLogin, onShowKey, isGuest, hasActiveProject }) => {
  return (
    <header className="bg-gray-800 p-4 shadow-md flex justify-between items-center border-b border-gray-700 z-10">
      <div className="text-left">
          <h1 className="text-xl lg:text-2xl font-bold text-cyan-400">
            C# Clean Architecture Code Generator
          </h1>
      </div>
      <div className="flex items-center gap-4">
        {isGuest ? (
          <>
            {hasActiveProject && (
                 <button
                    onClick={onShowKey}
                    className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-2 px-4 rounded-md transition-colors text-sm"
                  >
                    Save/Share Key
                  </button>
            )}
            <button
              onClick={onLogin}
              className="bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold py-2 px-4 rounded-md transition-colors text-sm"
            >
                Login
            </button>
          </>
        ) : user && (
          <>
              <div className="text-right hidden sm:block">
                  <p className="font-semibold text-sm text-white">{user.displayName}</p>
                  <p className="text-xs text-gray-400">{user.email}</p>
              </div>
              <img src={user.photoURL || undefined} alt="User" className="w-10 h-10 rounded-full" />
              <button
                onClick={onLogout}
                className="bg-gray-700 hover:bg-red-600/50 text-gray-300 font-semibold py-2 px-4 rounded-md transition-colors"
              >
                  Logout
              </button>
          </>
        )}
       </div>
    </header>
  );
};

export default Header;
