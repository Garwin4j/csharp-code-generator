
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface RequirementInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onGenerate: () => void;
  onGenerateFromJSON: (jsonContent: string) => void;
  isLoading: boolean;
  onBack: () => void;
}

const RequirementInput: React.FC<RequirementInputProps> = ({ value, onChange, onGenerate, onGenerateFromJSON, isLoading, onBack }) => {
  const [creationMode, setCreationMode] = useState<'scratch' | 'json'>('scratch');
  const [writeTab, setWriteTab] = useState<'write' | 'preview'>('write');
  const [uploadedJson, setUploadedJson] = useState<{name: string, content: string} | null>(null);

  const creationTabClasses = (isActive: boolean) =>
    `px-4 py-3 text-sm font-semibold focus:outline-none transition-colors duration-200 flex-grow text-center ${
      isActive
        ? 'bg-gray-800 text-cyan-400 border-b-2 border-cyan-400'
        : 'text-gray-400 hover:text-white bg-gray-900 hover:bg-gray-700/50'
    }`;

  const writeTabClasses = (isActive: boolean) =>
    `px-4 py-2 text-sm font-medium focus:outline-none transition-colors duration-200 ${
      isActive
        ? 'bg-gray-900 text-cyan-400 border-b-2 border-cyan-400'
        : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
    }`;
    
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/json') {
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            setUploadedJson({ name: file.name, content });
        };
        reader.readAsText(file);
    } else {
        setUploadedJson(null);
        alert('Please select a valid JSON file.');
    }
  };
  
  const handleGenerate = () => {
    if (isLoading) return;
    if (creationMode === 'scratch') {
      onGenerate();
    } else if (uploadedJson) {
      onGenerateFromJSON(uploadedJson.content);
    }
  };

  return (
    <div className="flex flex-col bg-gray-800 overflow-hidden flex-grow min-h-0">
      <div className="p-4 border-b border-gray-700 flex justify-between items-center">
        <div>
            <h2 className="text-xl font-semibold text-white">1. Create Your Project</h2>
            <p className="text-sm text-gray-400">Start from scratch with requirements or upload a project JSON file.</p>
        </div>
        <button onClick={onBack} className="text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold py-2 px-4 rounded-md transition-colors">&larr; Back to Home</button>
      </div>
      
      <div className="flex border-b border-gray-700 bg-gray-800">
        <button onClick={() => setCreationMode('scratch')} className={creationTabClasses(creationMode === 'scratch')}>
            From Scratch
        </button>
        <button onClick={() => setCreationMode('json')} className={creationTabClasses(creationMode === 'json')}>
            From JSON File
        </button>
      </div>

      {creationMode === 'scratch' ? (
        <>
          <div className="flex border-b border-gray-700 bg-gray-800">
            <button
              onClick={() => setWriteTab('write')}
              className={writeTabClasses(writeTab === 'write')}
              aria-pressed={writeTab === 'write'}
            >
              Write
            </button>
            <button
              onClick={() => setWriteTab('preview')}
              className={writeTabClasses(writeTab === 'preview')}
              aria-pressed={writeTab === 'preview'}
            >
              Preview
            </button>
          </div>

          {writeTab === 'write' ? (
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
        </>
      ) : (
        <div className="flex-grow p-8 flex flex-col items-center justify-center bg-gray-900 text-center">
            <div className="w-full max-w-lg">
                <p className="text-gray-400 mb-4">Upload a `_files.json` file previously downloaded from this application to restore a project.</p>
                <label htmlFor="json-upload" className="w-full p-8 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-cyan-500 hover:bg-gray-800/50 transition-colors flex flex-col items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    {uploadedJson ? (
                        <>
                            <span className="font-semibold text-cyan-400">{uploadedJson.name}</span>
                            <span className="text-xs text-gray-400 mt-1">Click to choose a different file</span>
                        </>
                    ) : (
                        <span className="font-semibold text-gray-300">Click to upload or drag & drop</span>
                    )}
                </label>
                <input id="json-upload" type="file" accept=".json,application/json" className="hidden" onChange={handleFileChange} />
            </div>
        </div>
      )}


      <div className="p-4 bg-gray-800 border-t border-gray-700">
        <button
          onClick={handleGenerate}
          disabled={isLoading || (creationMode === 'json' && !uploadedJson)}
          className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-md transition-all duration-300 ease-in-out flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {creationMode === 'json' ? 'Creating Project...' : 'Starting Generation...'}
            </>
          ) : (
            creationMode === 'scratch' ? 'Generate Code' : 'Create Project from JSON'
          )}
        </button>
      </div>
    </div>
  );
};

export default RequirementInput;
