
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GeneratedFile, Package, Checkpoint } from '../types';
import FileTree from './FileTree';
import CodeViewer from './CodeViewer';
import JSZip from 'jszip';

interface CodeOutputProps {
  selectedPackage: Package | null;
  checkpoints: Checkpoint[];
  generatedCode: GeneratedFile[] | null;
  isLoading: boolean;
  error: string | null;
  changedFilePaths: Set<string>;
  onSaveFile: (path: string, newContent: string) => Promise<void>;
  fileDiffs: Map<string, Set<number>>;
}

const CollapseIcon = ({ isCollapsed }: { isCollapsed: boolean }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        {isCollapsed ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
        ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        )}
    </svg>
);


const CodeOutput: React.FC<CodeOutputProps> = ({ selectedPackage, checkpoints, generatedCode, isLoading, error, changedFilePaths, onSaveFile, fileDiffs }) => {
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null);
  const [isFileTreeCollapsed, setIsFileTreeCollapsed] = useState(false);
  const [fileTreeWidth, setFileTreeWidth] = useState(300);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);

  useEffect(() => {
    if (generatedCode && generatedCode.length > 0) {
      const previouslySelectedPath = selectedFile?.path;
      const fileStillExists = generatedCode.find(f => f.path === previouslySelectedPath);
      
      if (!fileStillExists || !selectedFile) {
        setSelectedFile(generatedCode[0]);
      }
    } else {
      setSelectedFile(null);
    }
  }, [generatedCode]);

  const mouseMoveHandler = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    let newWidth = e.clientX - containerRect.left;

    const minWidth = 200;
    const maxWidth = containerRect.width * 0.6; // Max 60% of container

    if (newWidth < minWidth) newWidth = minWidth;
    if (newWidth > maxWidth) newWidth = maxWidth;
    
    setFileTreeWidth(newWidth);
  }, []);

  const mouseUpHandler = useCallback(() => {
    isResizingRef.current = false;
    window.removeEventListener('mousemove', mouseMoveHandler);
    window.removeEventListener('mouseup', mouseUpHandler);
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  }, [mouseMoveHandler]);

  const mouseDownHandler = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', mouseMoveHandler);
    window.addEventListener('mouseup', mouseUpHandler);
  }, [mouseMoveHandler, mouseUpHandler]);

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', mouseMoveHandler);
      window.removeEventListener('mouseup', mouseUpHandler);
    };
  }, [mouseMoveHandler, mouseUpHandler]);

  const handleDownloadZip = async () => {
    if (!generatedCode || generatedCode.length === 0 || !selectedPackage) return;

    const zip = new JSZip();
    generatedCode.forEach(file => {
      zip.file(file.path, file.content);
    });

    try {
      const projectName = selectedPackage.name.replace(/[^a-zA-Z0-9-]/g, '_').replace(/_+/g, '_');
      const revisionNumber = checkpoints.length;
      
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      
      const fileName = `${projectName}_${revisionNumber}_${dateString}.zip`;

      const blob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error('Failed to create zip file', err);
    }
  };
  
  const handleDownloadJson = () => {
    if (!generatedCode || generatedCode.length === 0 || !selectedPackage) return;
    
    const jsonData = {
      projectName: selectedPackage.name,
      initialRequirements: selectedPackage.initialRequirements,
      files: generatedCode,
    };

    const jsonString = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    const projectName = selectedPackage.name.replace(/[^a-zA-Z0-9-]/g, '_').replace(/_+/g, '_');
    const revisionNumber = checkpoints.length;
    
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    
    const fileName = `${projectName}_${revisionNumber}_${dateString}_files.json`;

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-400">
          <svg className="animate-spin h-10 w-10 text-cyan-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-lg font-semibold">AI is Generating Codebase</p>
          <p className="text-sm">Files will appear here as they are created. This may take a few minutes.</p>
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
      <div ref={containerRef} className="flex h-full">
        {!isFileTreeCollapsed && (
            <>
                <div style={{ width: `${fileTreeWidth}px` }} className="h-full shrink-0">
                    <FileTree
                        files={generatedCode}
                        selectedFile={selectedFile}
                        onSelectFile={setSelectedFile}
                        changedFilePaths={changedFilePaths}
                    />
                </div>
                <div
                    onMouseDown={mouseDownHandler}
                    className="w-1.5 cursor-col-resize flex items-center justify-center bg-gray-800 hover:bg-gray-700 transition-colors group"
                    role="separator"
                    aria-orientation="vertical"
                >
                    <div className="w-0.5 h-8 bg-gray-700 rounded-full group-hover:bg-cyan-500 transition-colors"></div>
                </div>
            </>
        )}
        <div className="flex-grow min-w-0">
          <CodeViewer 
             file={selectedFile} 
             onSave={onSaveFile}
             diff={selectedFile ? fileDiffs.get(selectedFile.path) : undefined}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col bg-gray-800 overflow-hidden h-full">
       <div className="flex justify-between items-center p-4 border-b border-gray-700">
        <div className="flex items-center gap-3">
            <button
                onClick={() => setIsFileTreeCollapsed(!isFileTreeCollapsed)}
                className="p-2 rounded-md hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                title={isFileTreeCollapsed ? "Show File Tree" : "Hide File Tree"}
            >
                <CollapseIcon isCollapsed={isFileTreeCollapsed} />
            </button>
            <div>
              <h2 className="text-xl font-semibold text-white">2. Generated Code</h2>
              <p className="text-sm text-gray-400">Browse, edit, and download your project files.</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <button
                onClick={handleDownloadJson}
                disabled={!generatedCode || generatedCode.length === 0 || isLoading}
                className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700/50 disabled:cursor-not-allowed disabled:text-gray-500 text-gray-200 font-semibold py-2 px-4 rounded-md transition-colors"
                title="Download project state as a JSON file"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                JSON
            </button>
            <button
            onClick={handleDownloadZip}
            disabled={!generatedCode || generatedCode.length === 0 || isLoading}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700/50 disabled:cursor-not-allowed disabled:text-gray-500 text-gray-200 font-semibold py-2 px-4 rounded-md transition-colors"
            >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            .ZIP
            </button>
        </div>
      </div>
      <div className="flex-grow overflow-hidden min-h-0">
        {renderContent()}
      </div>
    </div>
  );
};

export default CodeOutput;