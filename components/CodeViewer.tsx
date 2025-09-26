
import React, { useState } from 'react';
import { GeneratedFile } from '../types';

interface CodeViewerProps {
  file: GeneratedFile | null;
}

const CodeViewer: React.FC<CodeViewerProps> = ({ file }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (file?.content) {
      navigator.clipboard.writeText(file.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!file) {
    return (
      <div className="flex-grow flex items-center justify-center bg-gray-800 text-gray-500">
        <p>Select a file to view its content</p>
      </div>
    );
  }

  return (
    <div className="flex-grow flex flex-col h-full bg-gray-800">
      <div className="flex justify-between items-center p-3 bg-gray-900 border-b border-gray-700">
        <span className="font-mono text-sm text-gray-400">{file.path}</span>
        <button
          onClick={handleCopy}
          className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-semibold py-1 px-3 rounded-md transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="flex-grow overflow-auto">
        <pre className="p-4 text-sm">
          <code className="language-csharp">{file.content}</code>
        </pre>
      </div>
    </div>
  );
};

export default CodeViewer;
