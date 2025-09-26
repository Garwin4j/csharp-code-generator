import React, { useState, useEffect } from 'react';
import { GeneratedFile } from '../types';
import FileTree from './FileTree';
import CodeViewer from './CodeViewer';
import JSZip from 'jszip';

interface CodeOutputProps {
  generatedCode: GeneratedFile[] | null;
  isLoading: boolean;
  error: string | null;
}

const CodeOutput: React.FC<CodeOutputProps> = ({ generatedCode, isLoading, error }) => {
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null);

  useEffect(() => {
    if (generatedCode && generatedCode.length > 0) {
      // Try to preserve the selected file if it still exists in the new code
      const previouslySelectedPath = selectedFile?.path;
      const fileStillExists = generatedCode.find(f => f.path === previouslySelectedPath);
      setSelectedFile(fileStillExists || generatedCode[0]);
    } else {
      setSelectedFile(null);
    }
  }, [generatedCode]);

  const handleDownloadZip = async () => {
    if (!generatedCode || generatedCode.length === 0) {
      return;
    }

    const zip = new JSZip();
    generatedCode.forEach(file => {
      zip.file(file.path, file.content);
    });

    try {
      const blob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'Pd.Starter-Generated-Code.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error('Failed to create zip file', err);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-400">
          <svg className="animate-spin h-10 w-10 text-cyan-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-lg">Processing your request...</p>
          <p className="text-sm">This may take a moment.</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-full text-red-400 p-4">
            <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 text-center">
                <h3 className="text-xl font-bold mb-2 text-red-300">Operation Failed</h3>
                <p className="font-mono bg-gray-800 p-2 rounded">{error}</p>
            </div>
        </div>
      );
    }

    if (!generatedCode || generatedCode.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500">
          <p>Your generated code will appear here.</p>
        </div>
      );
    }

    return (
      <div className="flex h-full">
        <FileTree
          files={generatedCode}
          selectedFile={selectedFile}
          onSelectFile={setSelectedFile}
        />
        <CodeViewer file={selectedFile} />
      </div>
    );
  };

  return (
    <div className="flex flex-col bg-gray-800 rounded-lg shadow-lg overflow-hidden h-[85vh]">
       <div className="flex justify-between items-center p-4 border-b border-gray-700">
        <div>
          <h2 className="text-xl font-semibold text-white">2. Generated Code</h2>
          <p className="text-sm text-gray-400">Browse, refine, and download your project files.</p>
        </div>
        <button
          onClick={handleDownloadZip}
          disabled={!generatedCode || generatedCode.length === 0 || isLoading}
          className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700/50 disabled:cursor-not-allowed disabled:text-gray-500 text-gray-200 font-semibold py-2 px-4 rounded-md transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          Download .zip
        </button>
      </div>
      <div className="flex-grow overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
};

export default CodeOutput;