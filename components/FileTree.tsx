

import React, { useState, useMemo, useEffect } from 'react';
import { GeneratedFile } from '../types';

// --- Type definitions for the tree structure ---
interface FileNode {
  type: 'file';
  name: string;
  file: GeneratedFile;
  path: string;
  isChanged: boolean;
}

interface FolderNode {
  type: 'folder';
  name: string;
  path: string;
  children: TreeNode[];
  isChanged: boolean;
}

type TreeNode = FileNode | FolderNode;


// --- Helper function to build the tree ---
const buildTree = (files: GeneratedFile[], changedFilePaths: Set<string>): FolderNode => {
    const root: FolderNode = { type: 'folder', name: 'root', path: '', children: [], isChanged: false };
    
    files.forEach(file => {
        let currentNode = root;
        const parts = file.path.split('/');
        
        parts.forEach((part, index) => {
            if (!part) return; // Skip empty parts from paths like "folder//file.cs"
            const isFile = index === parts.length - 1;
            const currentPath = parts.slice(0, index + 1).join('/');
            
            if (isFile) {
                // Ensure file doesn't already exist to avoid duplicates
                if (!currentNode.children.some(child => child.path === file.path)) {
                    currentNode.children.push({
                        type: 'file',
                        name: part,
                        file,
                        path: file.path,
                        isChanged: changedFilePaths.has(file.path),
                    });
                }
            } else { // It's a folder
                let folderNode = currentNode.children.find(
                    child => child.type === 'folder' && child.path === currentPath
                ) as FolderNode | undefined;
                
                if (!folderNode) {
                    folderNode = { type: 'folder', name: part, path: currentPath, children: [], isChanged: false };
                    currentNode.children.push(folderNode);
                }
                currentNode = folderNode;
            }
        });
    });

    // Propagate the 'isChanged' status up to parent folders
    const propagateChanges = (node: FolderNode): boolean => {
        let hasChangedDescendant = false;
        for (const child of node.children) {
            if (child.type === 'folder') {
                if (propagateChanges(child)) { // Recursively check subfolders
                    hasChangedDescendant = true;
                }
            } else if (child.isChanged) { // Check files
                hasChangedDescendant = true;
            }
        }
        node.isChanged = hasChangedDescendant;
        return hasChangedDescendant;
    };
    propagateChanges(root);

    // Recursive sort function to order children (folders first, then alphabetically)
    const sortChildren = (node: FolderNode) => {
        node.children.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === 'folder' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });
        node.children.forEach(child => {
            if (child.type === 'folder') {
                sortChildren(child);
            }
        });
    };

    sortChildren(root);
    return root;
};


// --- SVG Icon Components ---
const FolderIcon = ({ isOpen }: { isOpen: boolean }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12.75v-7.5a2.25 2.25 0 012.25-2.25h4.5l2.25 2.25h6.75a2.25 2.25 0 012.25 2.25v6.75a2.25 2.25 0 01-2.25-2.25H6a2.25 2.25 0 01-2.25-2.25z" />
        ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
        )}
    </svg>
);

const FileIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
);

const ChevronIcon = ({ isOpen }: { isOpen: boolean }) => (
     <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 mr-1 flex-shrink-0 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
);


// --- Recursive Tree Node Renderer ---
interface TreeNodeComponentProps {
    node: TreeNode;
    selectedFile: GeneratedFile | null;
    onSelectFile: (file: GeneratedFile) => void;
    expandedFolders: Record<string, boolean>;
    onToggleFolder: (path: string) => void;
    depth: number;
}

const TreeNodeComponent: React.FC<TreeNodeComponentProps> = ({ node, selectedFile, onSelectFile, expandedFolders, onToggleFolder, depth }) => {
    const paddingLeft = `${depth * 20}px`; 

    if (node.type === 'folder') {
        const isExpanded = !!expandedFolders[node.path];
        return (
            <div className="text-sm">
                <button
                    onClick={() => onToggleFolder(node.path)}
                    className={`w-full text-left py-1.5 rounded-md transition-colors duration-150 flex items-center text-gray-300 hover:bg-gray-700/50 focus:outline-none focus:bg-gray-700 ${node.isChanged ? 'bg-green-900/40' : ''}`}
                    style={{ paddingLeft }}
                    aria-expanded={isExpanded}
                >
                    <ChevronIcon isOpen={isExpanded} />
                    <FolderIcon isOpen={isExpanded} />
                    <span className="truncate font-sans">{node.name}</span>
                </button>
                {isExpanded && (
                    <div>
                        {node.children.map(child => (
                            <TreeNodeComponent
                                key={child.path}
                                node={child}
                                selectedFile={selectedFile}
                                onSelectFile={onSelectFile}
                                expandedFolders={expandedFolders}
                                onToggleFolder={onToggleFolder}
                                depth={depth + 1}
                            />
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // It's a file
    const isSelected = selectedFile?.path === node.path;
    return (
        <button
            onClick={() => onSelectFile(node.file)}
            className={`w-full text-left py-1.5 rounded-md text-sm transition-colors duration-150 flex items-center font-mono ${
                isSelected
                  ? 'bg-cyan-600/30 text-cyan-300'
                  : node.isChanged 
                    ? 'bg-green-900/40 text-gray-200 hover:bg-green-800/50'
                    : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
              }`}
            style={{ paddingLeft }}
            aria-current={isSelected ? 'page' : undefined}
        >
            <span className="w-4 mr-1 flex-shrink-0"></span> {/* Spacer for alignment */}
            <FileIcon />
            <span className="truncate">{node.name}</span>
        </button>
    );
};


// --- Main FileTree Component ---
interface FileTreeProps {
  files: GeneratedFile[];
  selectedFile: GeneratedFile | null;
  onSelectFile: (file: GeneratedFile) => void;
  changedFilePaths: Set<string>;
}

const FileTree: React.FC<FileTreeProps> = ({ files, selectedFile, onSelectFile, changedFilePaths }) => {
    const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

    const fileTree = useMemo(() => buildTree(files, changedFilePaths), [files, changedFilePaths]);
    
    // Automatically expand the first level of folders when files are loaded
    useEffect(() => {
        if (fileTree.children.length > 0) {
            const initialExpanded: Record<string, boolean> = {};
            const expandChildren = (node: FolderNode, depth: number) => {
                if (depth > 1) return; // Only expand top two levels
                 if (node.type === 'folder') {
                    initialExpanded[node.path] = true;
                    node.children.forEach(child => {
                        if (child.type === 'folder') {
                            expandChildren(child, depth + 1);
                        }
                    });
                 }
            }
            fileTree.children.forEach(child => {
                if (child.type === 'folder') {
                    expandChildren(child, 0);
                }
            });
            setExpandedFolders(initialExpanded);
        }
    }, [files]); // Only run when the file list itself changes, not on highlight changes

    const handleToggleFolder = (path: string) => {
        setExpandedFolders(prev => ({
            ...prev,
            [path]: !prev[path],
        }));
    };

  return (
    <div className="bg-gray-900 h-full overflow-y-auto border-r border-gray-700">
      <div className="p-2">
        {fileTree.children.map((node) => (
          <TreeNodeComponent
            key={node.path}
            node={node}
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
            expandedFolders={expandedFolders}
            onToggleFolder={handleToggleFolder}
            depth={0}
          />
        ))}
      </div>
    </div>
  );
};

export default FileTree;