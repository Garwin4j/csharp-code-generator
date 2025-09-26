import React from 'react';
import { Package } from '../types';

interface PackageSelectorProps {
  packages: Package[];
  onSelect: (packageId: string) => void;
  onNew: () => void;
  isLoading: boolean;
}

const PackageSelector: React.FC<PackageSelectorProps> = ({ packages, onSelect, onNew, isLoading }) => {
  return (
    <div className="container mx-auto p-4 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-white">Your Projects</h2>
        <button
          onClick={onNew}
          className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
        >
          + New Project
        </button>
      </div>

      {isLoading ? (
        <div className="text-center text-gray-400">Loading projects...</div>
      ) : packages.length === 0 ? (
        <div className="text-center py-16 px-6 bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-700">
            <h3 className="text-xl font-semibold text-white">No projects yet!</h3>
            <p className="text-gray-400 mt-2">Click "New Project" to get started with your first C# Clean Architecture solution.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages.map((pkg) => (
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
                  className="w-full mt-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                >
                  Open Project
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PackageSelector;
