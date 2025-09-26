import React, { useState, useEffect } from 'react';
import { Package } from '../types';

interface PackageSelectorProps {
  packages: Package[];
  onSelect: (packageId: string) => void;
  isLoading: boolean;
}

const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const GeneratingPackageCard: React.FC<{ pkg: Package }> = ({ pkg }) => {
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
                <h3 className="text-xl font-semibold text-cyan-400 truncate">{pkg.name}</h3>
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
                <button
                    disabled
                    className="w-full mt-2 bg-gray-700/50 text-gray-500 font-semibold py-2 px-4 rounded-md cursor-not-allowed"
                >
                  Processing...
                </button>
            </div>
        </div>
    );
};

const FailedPackageCard: React.FC<{ pkg: Package }> = ({ pkg }) => {
    return (
        <div className="bg-red-900/20 rounded-lg shadow-lg p-6 flex flex-col justify-between border border-red-500">
             <div>
                <h3 className="text-xl font-semibold text-red-300 truncate">{pkg.name}</h3>
                <p className="text-sm text-red-400 mt-2 font-bold">Generation Failed</p>
                <p className="text-xs text-gray-300 mt-2 bg-gray-800/50 p-2 rounded font-mono line-clamp-3">
                  {pkg.error || 'An unknown error occurred.'}
                </p>
              </div>
              <div className="mt-6">
                <p className="text-xs text-gray-500">Failed at: {pkg.updatedAt.toLocaleString()}</p>
                <button
                  disabled
                  className="w-full mt-2 bg-gray-700/50 text-gray-500 font-semibold py-2 px-4 rounded-md cursor-not-allowed"
                >
                  Failed
                </button>
              </div>
        </div>
    );
};

const PackageSelector: React.FC<PackageSelectorProps> = ({ packages, onSelect, isLoading }) => {
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
            if (pkg.status === 'generating') {
                return <GeneratingPackageCard key={pkg.id} pkg={pkg} />;
            }
            if (pkg.status === 'failed') {
                return <FailedPackageCard key={pkg.id} pkg={pkg} />;
            }
            return (
                <div key={pkg.id} className="bg-gray-800 rounded-lg shadow-lg p-6 flex flex-col justify-between border border-gray-700 hover:border-cyan-500 transition-all duration-300">
                  <div>
                    <h3 className="text-xl font-semibold text-cyan-400 truncate">{pkg.name}</h3>
                    <p className="text-sm text-gray-400 mt-2 line-clamp-3">
                      {pkg.initialRequirements}
                    </p>
                  </div>
                  <div className="mt-6">
                    <p className="text-xs text-gray-500">Last updated: {pkg.updatedAt.toLocaleString()}</p>
                    <button
                      onClick={() => onSelect(pkg.id)}
                      disabled={!pkg.files}
                      className="w-full mt-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700/50 disabled:cursor-not-allowed disabled:text-gray-500 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                    >
                      Open Project
                    </button>
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