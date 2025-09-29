import React, { useState, useEffect } from 'react';
import { GeneratedFile } from '../types';
import CodeEditor from './CodeEditor';

interface CodeViewerProps {
  file: GeneratedFile | null;
  onSave: (path: string, newContent: string) => Promise<void>;
}

const CodeViewer: React.FC<CodeViewerProps> = ({ file, onSave }) => {
  const [editedContent, setEditedContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [copySuccess, setCopySuccess] = useState('');

  useEffect(() => {
    setEditedContent(file?.content ?? '');
  }, [file]);

  if (!file) {
    return (
      <div className="flex-grow flex items-center justify-center bg-gray-800 text-gray-500">
        <p>Select a file to view its content</p>
      </div>
    );
  }
  
  const hasChanges = editedContent !== file.content;

  const handleSave = async () => {
      if (!hasChanges || !file) return;
      setIsSaving(true);
      try {
          await onSave(file.path, editedContent);
      } finally {
          setIsSaving(false);
      }
  };

  const handleDiscard = () => {
    setEditedContent(file.content);
  };
  
  const handleCopy = () => {
    if (file?.content) {
      navigator.clipboard.writeText(editedContent);
      setCopySuccess('Copied!');
      setTimeout(() => setCopySuccess(''), 2000);
    }
  };

  return (
    <div className="flex-grow flex flex-col h-full bg-gray-800">
      <div className="flex justify-between items-center p-3 bg-gray-900 border-b border-gray-700 flex-wrap gap-2">
        <span className="font-mono text-sm text-gray-400">{file.path}</span>
        <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-semibold py-1 px-3 rounded-md transition-colors"
            >
              {copySuccess || 'Copy'}
            </button>
            {hasChanges && (
                <>
                    <button
                        onClick={handleDiscard}
                        disabled={isSaving}
                        className="bg-gray-600 hover:bg-gray-500 text-white text-xs font-semibold py-1 px-3 rounded-md transition-colors disabled:opacity-50"
                    >
                        Discard
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold py-1 px-3 rounded-md transition-colors disabled:opacity-50 disabled:cursor-wait flex items-center"
                    >
                       {isSaving && (
                           <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                       )}
                        {isSaving ? 'Saving...' : 'Save'}
                    </button>
                </>
            )}
        </div>
      </div>
      <div className="flex-grow overflow-auto relative">
        <CodeEditor value={editedContent} onChange={setEditedContent} />
      </div>
    </div>
  );
};

export default CodeViewer;