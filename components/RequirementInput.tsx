import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface RequirementInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onGenerate: () => void;
  isLoading: boolean;
  onBack: () => void;
}

const RequirementInput: React.FC<RequirementInputProps> = ({ value, onChange, onGenerate, isLoading, onBack }) => {
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');

  const tabButtonClasses = (isActive: boolean) =>
    `px-4 py-2 text-sm font-medium focus:outline-none transition-colors duration-200 ${
      isActive
        ? 'bg-gray-900 text-cyan-400 border-b-2 border-cyan-400'
        : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
    }`;

  return (
    <div className="flex flex-col bg-gray-800 overflow-hidden flex-grow min-h-0">
      <div className="p-4 border-b border-gray-700 flex justify-between items-center">
        <div>
            <h2 className="text-xl font-semibold text-white">1. Enter Your Project Requirements</h2>
            <p className="text-sm text-gray-400">Provide the specifications for your new .NET solution. Markdown is supported.</p>
        </div>
        <button onClick={onBack} className="text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold py-2 px-4 rounded-md transition-colors">&larr; Back to Home</button>
      </div>

      <div className="flex border-b border-gray-700 bg-gray-800">
        <button
          onClick={() => setActiveTab('write')}
          className={tabButtonClasses(activeTab === 'write')}
          aria-pressed={activeTab === 'write'}
        >
          Write
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          className={tabButtonClasses(activeTab === 'preview')}
          aria-pressed={activeTab === 'preview'}
        >
          Preview
        </button>
      </div>

      {activeTab === 'write' ? (
        <textarea
          value={value}
          onChange={onChange}
          placeholder="Paste your C# project requirements here..."
          className="flex-grow p-4 bg-gray-900 text-gray-300 w-full resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-sm"
          spellCheck="false"
          aria-label="Project requirements editor"
        />
      ) : (
        <div className="flex-grow p-4 bg-gray-900 text-gray-300 w-full overflow-y-auto prose-styles" aria-label="Project requirements preview">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
        </div>
      )}

      <div className="p-4 bg-gray-800 border-t border-gray-700">
        <button
          onClick={onGenerate}
          disabled={isLoading}
          className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-md transition-all duration-300 ease-in-out flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Starting Generation...
            </>
          ) : (
            'Generate Code'
          )}
        </button>
      </div>
    </div>
  );
};

export default RequirementInput;
