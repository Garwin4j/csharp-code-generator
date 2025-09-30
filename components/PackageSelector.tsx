
import React, { useState, useEffect, useRef } from 'react';
import { Package } from '../types';

interface PackageSelectorProps {
  packages: Package[];
  onSelect: (packageId: string) => void;
  onDelete: (pkg: Package) => void;
  onRename: (packageId: string, newName: string) => void;
  isLoading: boolean;
}

interface EditableTitleProps {
    pkg: Package;
    isEditing: boolean;
    onStartEdit: (pkg: Package) => void;
    onCancelEdit: () => void;
    onSave: (newName: string) => void;
    className: string;
}

const EditableTitle: React.FC<EditableTitleProps> = ({ pkg, isEditing, onStartEdit, onCancelEdit, onSave, className }) => {
    const [name, setName] = useState(pkg.name);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);
    
    // Ensure input field updates if underlying package name changes from props
    useEffect(() => {
        setName(pkg.name);
    }, [pkg.name]);

    const handleSave = () => {
        if (name.trim() && name.trim() !== pkg.name) {
            onSave(name.trim());
        }
        onCancelEdit(); // This will exit edit mode
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            onCancelEdit();
        }
    };
    
    if (isEditing) {
        return (
            <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                className="w-full bg-gray-700 text-white p-1 -m-1 rounded-md text-xl font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
        );
    }
    
    return (
        <div className="flex items-center gap-2 group min-w-0" onClick={() => onStartEdit(pkg)}>
            <h3 className={`${className} truncate cursor-pointer`}>{pkg.name}</h3>
            <button 
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 text-gray-400 hover:text-white"
                aria-label={`Rename project ${pkg.name}`}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                    <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                </svg>
            </button>
        </div>
    );
};

const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const GeneratingPackageCard: React.FC<{ 
    pkg: Package; 
    onDelete: (pkg: Package) => void; 
    editableTitleProps: Omit<EditableTitleProps, 'pkg' | 'className'>
}> = ({ pkg, onDelete, editableTitleProps }) => {
    const [elapsedTime, setElapsedTime] = useState(0);

    useEffect(() => {
        const calculateElapsedTime = () => {
            const now = new Date();
            const start = pkg.createdAt;
            if (start instanceof Date) {
                setElapsedTime((now.getTime() - start.getTime()) / 1000);
            }
        };

        calculateElapsedTime();
        const intervalId = setInterval(calculateElapsedTime, 1000);

        return () => clearInterval(intervalId);
    }, [pkg.createdAt]);

    let progressText = "Initializing model...";
    if (pkg.generationLog && pkg.generationLog.length > 20) {
        // A simple heuristic to parse the last file path from the streaming JSON
        try {
            const partialJson = pkg.generationLog;
            const lastFileMatch = partialJson.match(/"path":\s*"([^"]+)"/g);
            if (lastFileMatch) {
                const lastPath = lastFileMatch[lastFileMatch.length - 1];
                const justThePath = lastPath.substring(lastPath.indexOf('"') + 1, lastPath.lastIndexOf('"'));
                progressText = `Creating: ${justThePath.split('"').pop() || 'file...'}`;
            }
        } catch (e) {
            progressText = 'Streaming response...';
        }
    }

    return (
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 flex flex-col justify-between border border-cyan-700 animate-pulse">
            <div>
                <EditableTitle
                    pkg={pkg}
                    {...editableTitleProps}
                    className="text-xl font-semibold text-cyan-400"
                />
                <div className="mt-4 flex items-center text-sm text-cyan-300">
                     <svg className="animate-spin h-5 w-5 mr-3 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                     <span>Generating code... ({formatDuration(elapsedTime)})</span>
                </div>
                <p className="text-xs text-gray-400 mt-2 font-mono truncate" title={progressText}>{progressText}</p>
            </div>
            <div className="mt-6">
                <p className="text-xs text-gray-500">Started: {pkg.createdAt.toLocaleString()}</p>
                <div className="flex items-center gap-2 mt-2">
                    <button
                        disabled
                        className="w-full bg-gray-700/50 text-gray-500 font-semibold py-2 px-4 rounded-md cursor-not-allowed"
                    >
                      Processing...
                    </button>
                    <button
                        onClick={() => onDelete(pkg)}
                        className="p-2 rounded-md bg-gray-700 hover:bg-red-600/80 text-gray-400 hover:text-white transition-colors"
                        title="Delete Project"
                        aria-label={`Delete project ${pkg.name}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

const FailedPackageCard: React.FC<{ 
    pkg: Package; 
    onDelete: (pkg: Package) => void; 
    editableTitleProps: Omit<EditableTitleProps, 'pkg' | 'className'>
}> = ({ pkg, onDelete, editableTitleProps }) => {
    return (
        <div className="bg-red-900/20 rounded-lg shadow-lg p-6 flex flex-col justify-between border border-red-500">
             <div>
                <EditableTitle
                    pkg={pkg}
                    {...editableTitleProps}
                    className="text-xl font-semibold text-red-300"
                />
                <p className="text-sm text-red-400 mt-2 font-bold">Generation Failed</p>
                <p className="text-xs text-gray-300 mt-2 bg-gray-800/50 p-2 rounded font-mono line-clamp-3">
                  {pkg.error || 'An unknown error occurred.'}
                </p>
              </div>
              <div className="mt-6">
                <p className="text-xs text-gray-500">Failed at: {pkg.updatedAt.toLocaleString()}</p>
                <button
                  onClick={() => onDelete(pkg)}
                  className="w-full mt-2 bg-red-800 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                >
                  Delete Project
                </button>
              </div>
        </div>
    );
};

const PackageSelector: React.FC<PackageSelectorProps> = ({ packages, onSelect, onDelete, onRename, isLoading }) => {
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);

  const handleStartEdit = (pkg: Package) => {
      setEditingPackageId(pkg.id);
  };

  const handleCancelEdit = () => {
      setEditingPackageId(null);
  };

  const handleSaveRename = (packageId: string, newName: string) => {
      onRename(packageId, newName);
      setEditingPackageId(null);
  };
  
  const editableTitleProps = {
    isEditing: false, // will be overridden per item
    onStartEdit: handleStartEdit,
    onCancelEdit: handleCancelEdit,
    onSave: (newName: string) => {}, // will be overridden per item
  };

  return (
    <>
      {isLoading && packages.length === 0 ? (
        <div className="text-center text-gray-400">Loading projects...</div>
      ) : packages.length === 0 ? (
        <div className="text-center py-16 px-6 bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-700">
            <h3 className="text-xl font-semibold text-white">No projects yet!</h3>
            <p className="text-gray-400 mt-2">Click "New Project" to get started with your first C# Clean Architecture solution.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages.map((pkg) => {
            const currentEditableTitleProps = {
                ...editableTitleProps,
                isEditing: editingPackageId === pkg.id,
                onSave: (newName: string) => handleSaveRename(pkg.id, newName),
            };

            if (pkg.status === 'generating') {
                return <GeneratingPackageCard key={pkg.id} pkg={pkg} onDelete={onDelete} editableTitleProps={currentEditableTitleProps} />;
            }
            if (pkg.status === 'failed') {
                return <FailedPackageCard key={pkg.id} pkg={pkg} onDelete={onDelete} editableTitleProps={currentEditableTitleProps} />;
            }
            return (
                <div key={pkg.id} className="bg-gray-800 rounded-lg shadow-lg p-6 flex flex-col justify-between border border-gray-700 hover:border-cyan-500 transition-all duration-300">
                  <div>
                    <EditableTitle
                        pkg={pkg}
                        {...currentEditableTitleProps}
                        className="text-xl font-semibold text-cyan-400"
                    />
                    <p className="text-sm text-gray-400 mt-2 line-clamp-3">
                      {pkg.initialRequirements}
                    </p>
                  </div>
                  <div className="mt-6">
                    <p className="text-xs text-gray-500">Last updated: {pkg.updatedAt.toLocaleString()}</p>
                    <div className="flex items-center gap-2 mt-2">
                        <button
                            onClick={() => onSelect(pkg.id)}
                            disabled={!pkg.files}
                            className="w-full bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700/50 disabled:cursor-not-allowed disabled:text-gray-500 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                        >
                            Open Project
                        </button>
                        <button
                            onClick={() => onDelete(pkg)}
                            className="p-2 rounded-md bg-gray-700 hover:bg-red-600/80 text-gray-400 hover:text-white transition-colors"
                            title="Delete Project"
                            aria-label={`Delete project ${pkg.name}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                  </div>
                </div>
            )
          })}
        </div>
      )}
    </>
  );
};

export default PackageSelector;
