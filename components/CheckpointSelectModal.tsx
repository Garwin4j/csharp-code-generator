
import React from 'react';
import { Checkpoint } from '../types';

interface CheckpointSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkpoints: Checkpoint[];
  onSelect: (checkpoint: Checkpoint) => void;
}

const CheckpointSelectModal: React.FC<CheckpointSelectModalProps> = ({ isOpen, onClose, checkpoints, onSelect }) => {
  if (!isOpen) return null;

  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 animate-fade-in" 
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkpoint-select-title"
    >
      <div 
        className="bg-gray-800 rounded-lg shadow-2xl p-6 border border-cyan-500 max-w-2xl w-full max-h-[80vh] flex flex-col" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
            <div>
                <h2 id="checkpoint-select-title" className="text-xl font-bold text-white">Select Base Checkpoint</h2>
                <p className="text-sm text-gray-400 mt-1">
                    Choose a checkpoint to compare against the current code. A patch file will be generated showing the differences.
                </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
        
        <div className="flex-grow overflow-y-auto space-y-2 mb-6 pr-2 bg-gray-900/50 p-2 rounded-md border border-gray-700">
            {checkpoints.length === 0 ? (
                <div className="text-center py-8 text-gray-500 italic">No checkpoints available to select.</div>
            ) : (
                checkpoints.map(cp => (
                    <button
                        key={cp.id}
                        onClick={() => onSelect(cp)}
                        className="w-full text-left p-3 rounded bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-cyan-500 transition-all flex justify-between items-center group"
                    >
                        <div className="min-w-0">
                            <p className="font-semibold text-gray-200 truncate">{cp.message}</p>
                            <p className="text-xs text-gray-400 mt-1">{cp.createdAt.toLocaleString()}</p>
                        </div>
                        <div className="ml-4 flex-shrink-0 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity text-sm font-medium flex items-center gap-1">
                            <span>Select</span>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </button>
                ))
            )}
        </div>

        <div className="flex justify-end">
            <button
            onClick={onClose}
            className="bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold py-2 px-4 rounded-md transition-colors"
            >
            Cancel
            </button>
        </div>
      </div>
    </div>
  );
};

export default CheckpointSelectModal;
