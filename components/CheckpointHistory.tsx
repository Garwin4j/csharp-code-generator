import React from 'react';
import { Checkpoint } from '../types';

interface CheckpointHistoryProps {
  checkpoints: Checkpoint[];
  onRevert: (checkpoint: Checkpoint) => void;
}

const timeAgo = (date: Date): string => {
  if (!date) return '';
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 5) return "just now";

  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes ago";
  return Math.floor(seconds) + " seconds ago";
};

const RevertIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
    </svg>
);


const CheckpointHistory: React.FC<CheckpointHistoryProps> = ({ checkpoints, onRevert }) => {
  if (checkpoints.length === 0) {
    return <div className="flex-grow p-4 text-center text-gray-500 flex items-center justify-center">No history yet.</div>;
  }
  return (
    <div className="flex-grow p-4 overflow-y-auto space-y-3 bg-gray-900">
      {checkpoints.map(cp => (
        <div key={cp.id} className="bg-gray-800 p-3 rounded-lg flex justify-between items-center border border-gray-700 hover:border-cyan-600 transition-colors">
          <div className="flex-grow overflow-hidden mr-4">
            <p className="text-xs text-gray-400">{timeAgo(cp.createdAt)}</p>
            <p className="text-sm text-gray-200 truncate" title={cp.message}>{cp.message}</p>
          </div>
          <button 
            onClick={() => onRevert(cp)} 
            className="flex-shrink-0 flex items-center text-sm bg-gray-600 hover:bg-yellow-600 text-white font-semibold py-2 px-3 rounded-md transition-colors"
            title="Revert to this version"
          >
            <RevertIcon />
            Revert
          </button>
        </div>
      ))}
    </div>
  );
};

export default CheckpointHistory;
