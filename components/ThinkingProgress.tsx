import React, { useEffect, useRef } from 'react';

interface ThinkingProgressProps {
  progress: string;
  isOpen: boolean;
  onToggle: () => void;
}

const ChevronIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 flex-shrink-0 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

const ThinkingProgress: React.FC<ThinkingProgressProps> = ({ progress, isOpen, onToggle }) => {
  const contentRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    // Auto-scroll to the bottom of the progress content
    if (isOpen && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [progress, isOpen]);

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden animate-fade-in">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 bg-gray-700/50 hover:bg-gray-700 transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex items-center">
          <ChevronIcon isOpen={isOpen} />
          <h3 className="text-md font-semibold text-white ml-2">Model Progress</h3>
        </div>
        <div className="flex items-center text-xs text-cyan-400">
          <span className="relative flex h-2 w-2 mr-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
          </span>
          Streaming...
        </div>
      </button>
      {isOpen && (
        <div className="bg-gray-900 p-2 max-h-48 overflow-y-auto">
          <pre
            ref={contentRef}
            className="text-xs text-gray-400 font-mono whitespace-pre-wrap break-all"
          >
            {progress || 'Waiting for model response...'}
          </pre>
        </div>
      )}
    </div>
  );
};

export default ThinkingProgress;
