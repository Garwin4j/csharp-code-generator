import React from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title, 
    message, 
    confirmText = 'Confirm', 
    cancelText = 'Cancel' 
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  }

  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 animate-fade-in" 
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-title"
    >
      <div 
        className="bg-gray-800 rounded-lg shadow-2xl p-8 border border-yellow-500 max-w-md w-full m-4" 
        onClick={e => e.stopPropagation()}
      >
        <h2 id="confirmation-title" className="text-2xl font-bold text-yellow-400 mb-4">{title}</h2>
        <p className="text-gray-400 mb-6">{message}</p>
        <div className="flex justify-end gap-4">
          <button 
            onClick={onClose} 
            className="bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold py-2 px-4 rounded-md transition-colors"
          >
            {cancelText}
          </button>
          <button 
            onClick={handleConfirm} 
            className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-2 px-4 rounded-md transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
