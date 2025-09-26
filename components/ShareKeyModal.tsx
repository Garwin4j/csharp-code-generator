import React, { useState } from 'react';

interface ShareKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareKey: string;
}

const ShareKeyModal: React.FC<ShareKeyModalProps> = ({ isOpen, onClose, shareKey }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-key-title"
    >
      <div 
        className="bg-gray-800 rounded-lg shadow-2xl p-8 border border-cyan-500 max-w-md w-full m-4"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="share-key-title" className="text-2xl font-bold text-cyan-400 mb-4">Your Project Key</h2>
        <p className="text-gray-400 mb-6">
          Save this key! It's the only way to access your project again without logging in.
        </p>
        
        <div className="bg-gray-900 p-4 rounded-md flex items-center justify-between font-mono text-lg text-gray-200">
          <span>{shareKey}</span>
          <button
            onClick={handleCopy}
            className={`text-sm font-semibold py-2 px-4 rounded-md transition-colors ${copied ? 'bg-green-600 text-white' : 'bg-cyan-600 hover:bg-cyan-700 text-white'}`}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-8 bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold py-2 px-4 rounded-md transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default ShareKeyModal;
