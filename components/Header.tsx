import React from 'react';
import { User as FirebaseUser } from 'firebase/auth';

interface HeaderProps {
    user: FirebaseUser | null;
    onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  return (
    <header className="bg-gray-800 p-4 shadow-md flex justify-between items-center border-b border-gray-700">
      <div className="text-left">
          <h1 className="text-xl lg:text-2xl font-bold text-cyan-400">
            C# Clean Architecture Code Generator
          </h1>
          <p className="text-xs text-gray-400">
            Powered by Google Gemini
          </p>
      </div>
      {user && (
          <div className="flex items-center gap-4">
              <div className="text-right">
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
          </div>
      )}
    </header>
  );
};

export default Header;
