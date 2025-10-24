


import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, User as FirebaseUser, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from './firebaseConfig';
import { GeneratedFile, ChatMessage, Package, FilePatch, Checkpoint } from './types';
import * as geminiService from './services/geminiService';
import * as firestoreService from './services/firestoreService';
import { INITIAL_REQUIREMENTS } from './constants';

import Header from './components/Header';
import RequirementInput from './components/RequirementInput';
import CodeOutput from './components/CodeOutput';
import ThinkingProgress from './components/ThinkingProgress';
import ChatInterface from './components/ChatInterface';
import Home from './components/Home';
import ShareKeyModal from './components/ShareKeyModal';
import ResizablePanels from './components/ResizablePanels';
import ConfirmationModal from './components/ConfirmationModal';

type AppState = 'loading' | 'home' | 'generating' | 'chat';
type MobileView = 'left' | 'right';

// --- Diffing Utilities ---

/**
 * Basic implementation of Longest Common Subsequence algorithm.
 * @returns A 2D array with the lengths of LCS.
 */
const lcs = (a: string[], b: string[]) => {
  const matrix = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = 1 + matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
      }
    }
  }
  return matrix;
};

/**
 * Calculates the line numbers of added or changed lines in the new text.
 * @param oldText The original string content.
 * @param newText The updated string content.
 * @returns A Set of line numbers (1-indexed) that are new or modified in newText.
 */
const calculateLineDiff = (oldText: string, newText: string): Set<number> => {
  if (oldText === newText) return new Set();
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const matrix = lcs(oldLines, newLines);
  
  const changedLines = new Set<number>();
  let i = oldLines.length;
  let j = newLines.length;

  while (j > 0) {
    if (i > 0 && oldLines[i - 1] === newLines[j - 1]) {
      // Line is common, move diagonally up-left
      i--;
      j--;
    } else {
      // This line in `newLines` is not common with the corresponding line in `oldLines`.
      // Mark it as changed/added.
      changedLines.add(j); // j is the 1-indexed line number in newLines
      
      // Decide which way to move in the matrix: up or left.
      // Move in the direction of the larger LCS value to stay on the optimal path.
      if (i > 0 && (j === 0 || matrix[i-1][j] >= matrix[i][j-1])) {
          // Corresponds to a deletion in oldLines. Move up.
          i--;
      } else {
          // Corresponds to an addition in newLines. Move left.
          j--;
      }
    }
  }
  return changedLines;
};


const applyCodePatch = (currentCode: GeneratedFile[], patch: FilePatch[]): GeneratedFile[] => {
  // Create a Map for efficient, immutable-style updates.
  const filesMap = new Map(currentCode.map(file => [file.path, file]));

  patch.forEach(operation => {
    switch (operation.op) {
      case 'add':
      case 'update':
        // Add or replace the file in the map with a brand new object.
        filesMap.set(operation.path, { path: operation.path, content: operation.content });
        break;
      case 'delete':
        // Remove the file from the map.
        filesMap.delete(operation.path);
        break;
    }
  });

  // Convert the map of new/updated files back to an array.
  return Array.from(filesMap.values());
};

const findChangedFiles = (oldFiles: GeneratedFile[], newFiles: GeneratedFile[]): Set<string> => {
    const oldFileMap = new Map(oldFiles.map(f => [f.path, f.content]));
    const newFileMap = new Map(newFiles.map(f => [f.path, f.content]));
    const changed = new Set<string>();

    for (const [path, content] of newFileMap.entries()) {
        // A file is considered changed if it's new OR its content is different.
        if (!oldFileMap.has(path) || oldFileMap.get(path) !== content) {
            changed.add(path);
        }
    }
    return changed;
};


const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('loading');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [packageToDelete, setPackageToDelete] = useState<Package | null>(null);
  
  const [requirements, setRequirements] = useState<string>(INITIAL_REQUIREMENTS);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [generatedCode, setGeneratedCode] = useState<GeneratedFile[] | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [checkpointToRevert, setCheckpointToRevert] = useState<Checkpoint | null>(null);
  const [changedFilePaths, setChangedFilePaths] = useState<Set<string>>(new Set());
  const [fileDiffs, setFileDiffs] = useState<Map<string, Set<number>>>(new Map());
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGeneratingDocs, setIsGeneratingDocs] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [thinkingProgress, setThinkingProgress] = useState<string>('');
  const [isThinkingPanelOpen, setIsThinkingPanelOpen] = useState<boolean>(false);

  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1024);
  const [mobileView, setMobileView] = useState<MobileView>('left');

  useEffect(() => {
    // This effect syncs the `selectedPackage` state with real-time updates from the `packages` list.
    // This is crucial for updating the view after a background generation completes, ensuring
    // the app uses the latest, sanitized data from Firestore and preventing circular reference errors.
    if (!selectedPackage?.id) return;

    const updatedPackage = packages.find(p => p.id === selectedPackage.id);

    // If an updated version is found in the main list (e.g., generation finished), sync the state.
    // We use `updatedAt` to prevent infinite re-renders.
    if (updatedPackage && updatedPackage.updatedAt > selectedPackage.updatedAt) {
      setSelectedPackage(updatedPackage);
      if (updatedPackage.files) {
        setGeneratedCode(updatedPackage.files);
      }
    }
  }, [packages, selectedPackage]);

  useEffect(() => {
    const handleResize = () => setIsLargeScreen(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAppState('home');
      if (!currentUser) {
          setPackages([]);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      setIsLoading(true);
      const unsubscribe = firestoreService.onUserPackagesSnapshot(user.uid, (userPackages) => {
        setPackages(userPackages);
        setIsLoading(false);
      });
      return () => unsubscribe();
    }
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged will handle the rest
    } catch (err) {
      console.error("Login failed:", err);
      // You could set an error state here to show in the UI
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setSelectedPackage(null);
    setGeneratedCode(null);
    setChatHistory([]);
    setPackages([]);
    setCheckpoints([]);
    setChangedFilePaths(new Set());
    setFileDiffs(new Map());
    setAppState('home');
  };

  const handleSelectPackage = async (packageId: string) => {
    const pkg = packages.find(p => p.id === packageId) || await firestoreService.getPackage(packageId);
    if (pkg && pkg.files) {
      setIsLoading(true);
      setSelectedPackage(pkg);
      setGeneratedCode(pkg.files);
      setChangedFilePaths(new Set()); // Clear highlights on new selection
      setFileDiffs(new Map());
      const history = await firestoreService.getPackageChatHistory(pkg.id);
      setChatHistory(history);
      const packageCheckpoints = await firestoreService.getCheckpoints(pkg.id);
      setCheckpoints(packageCheckpoints);
      setAppState('chat');
      setIsLoading(false);
    }
  };

  const handleLoadFromKey = async (key: string) => {
    if (!key.trim()) return;
    setIsLoading(true);
    const pkg = await firestoreService.getPackage(key.trim());
    if (pkg) {
        setSelectedPackage(pkg);
        setGeneratedCode(pkg.files);
        setChangedFilePaths(new Set());
        setFileDiffs(new Map());
        const history = await firestoreService.getPackageChatHistory(pkg.id);
        setChatHistory(history);
        const packageCheckpoints = await firestoreService.getCheckpoints(pkg.id);
        setCheckpoints(packageCheckpoints);
        setAppState('chat');
    } else {
        alert("Project key not found.");
    }
    setIsLoading(false);
  };

  const handleNewPackage = () => {
    setSelectedPackage(null);
    setGeneratedCode(null);
    setChatHistory([]);
    setCheckpoints([]);
    setChangedFilePaths(new Set());
    setFileDiffs(new Map());
    setRequirements(INITIAL_REQUIREMENTS);
    setAppState('generating');
  };

  const handleGoHome = () => {
    setSelectedPackage(null);
    setGeneratedCode(null);
    setChatHistory([]);
    setCheckpoints([]);
    setChangedFilePaths(new Set());
    setFileDiffs(new Map());
    setAppState('home');
  };

  const handleGenerateCode = async (baseFiles: GeneratedFile[] | null) => {
    if (!requirements.trim()) return;
    setIsLoading(true);
    setError(null);
    setChangedFilePaths(new Set());
    setFileDiffs(new Map());
  
    try {
      // Create package first, works for guests (user?.uid is undefined) and logged-in users
      const newPackage = await firestoreService.createPackageForGeneration(requirements, user?.uid);
      setSelectedPackage(newPackage);
      setAppState('chat'); // Go directly to chat/generation view
  
      // Fire-and-forget background generation
      geminiService.generateCode(newPackage.id, requirements, baseFiles);
  
    } catch (err) {
      // The 'err' object from a catch block is of type 'unknown'.
      // This ensures we safely handle it before setting the state.
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred while starting generation.';
      setError(errorMessage);
      setAppState('generating');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProjectFromJSON = async (jsonContent: string) => {
    setIsLoading(true);
    setError(null);

    try {
        const data = JSON.parse(jsonContent);

        if (!data.files || !Array.isArray(data.files) || !data.projectName) {
            throw new Error('Invalid JSON format. Must contain "projectName" and a "files" array.');
        }

        const newPackage = await firestoreService.createPackageFromJson(data, user?.uid);
        
        setSelectedPackage(newPackage);
        setGeneratedCode(newPackage.files);
        setChangedFilePaths(new Set()); 
        setFileDiffs(new Map());
        setChatHistory([]); // New project from JSON has no chat history.
        const packageCheckpoints = await firestoreService.getCheckpoints(newPackage.id);
        setCheckpoints(packageCheckpoints);
        setAppState('chat');

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to parse or create project from JSON.';
        setError(errorMessage);
        setAppState('generating'); // Stay on the same page to show error
    } finally {
        setIsLoading(false);
    }
  };


  const handleDeleteRequest = (pkg: Package) => {
    setPackageToDelete(pkg);
  };

  const handleConfirmDelete = async () => {
    if (!packageToDelete) return;
    setIsLoading(true);
    try {
      await firestoreService.deletePackage(packageToDelete.id);
      // The onSnapshot listener will automatically refresh the package list.
    } catch (err) {
      // FIX: The 'err' object from a catch block is of type 'unknown'.
      // Safely handle it by checking if it's an instance of Error before using its message property.
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during deletion.';
      setError(errorMessage); // This error could be shown in a toast/notification
      console.error("Failed to delete package:", errorMessage);
    } finally {
      setIsLoading(false);
      setPackageToDelete(null);
    }
  };

  const handleRenamePackage = async (packageId: string, newName: string) => {
    if (!newName.trim()) return; // Prevent renaming to an empty string
    try {
      await firestoreService.renamePackage(packageId, newName);
      // Firestore's onSnapshot listener will automatically update the local state.
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during rename.';
      setError(errorMessage);
      console.error("Failed to rename package:", errorMessage);
    }
  };


  const handleRevertRequest = (checkpoint: Checkpoint) => {
    setCheckpointToRevert(checkpoint);
  };

  const handleConfirmRevert = async () => {
      if (!checkpointToRevert || !selectedPackage) return;
      
      const oldCode = selectedPackage.files || [];
      const newCode = checkpointToRevert.files;
      const changedPaths = findChangedFiles(oldCode, newCode);
      setChangedFilePaths(changedPaths);

      setIsLoading(true);
      setError(null);
      
      try {
          const newDiffs = new Map<string, Set<number>>();
          const oldFileMap = new Map(oldCode.map(f => [f.path, f.content]));

          newCode.forEach(newFile => {
              const oldContent = oldFileMap.get(newFile.path) ?? '';
              if (newFile.content !== oldContent) {
                  const diff = calculateLineDiff(oldContent, newFile.content);
                  if (diff.size > 0) {
                      newDiffs.set(newFile.path, diff);
                  }
              }
          });
          setFileDiffs(newDiffs);

          await firestoreService.updatePackage(selectedPackage.id, newCode);
          setGeneratedCode(newCode);
          setSelectedPackage(prev => prev ? { ...prev, files: newCode, updatedAt: new Date() } : null);

          const revertMessage: ChatMessage = { role: 'model', content: `Successfully reverted to the version from "${checkpointToRevert.message}".`, timestamp: new Date(), images: [] };
          await firestoreService.addChatMessage(selectedPackage.id, revertMessage);
          setChatHistory(prev => [...prev, revertMessage]);

      } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during revert.';
          setError(errorMessage);
          const errorModelMessage: ChatMessage = { role: 'model', content: `I encountered an error trying to revert: ${errorMessage}`, timestamp: new Date(), images: [] };
          setChatHistory(prev => [...prev, errorModelMessage]);
      } finally {
          setIsLoading(false);
          setCheckpointToRevert(null);
      }
  };
  
  const handleSendMessage = async (message: string, images: { mimeType: string, data: string, name: string }[]) => {
    if ((!message.trim() && images.length === 0) || !generatedCode || !selectedPackage) return;

    const userMessage: ChatMessage = { role: 'user', content: message, images, timestamp: new Date() };
    const newHistory = [...chatHistory, userMessage];
    setChatHistory(newHistory);
    await firestoreService.addChatMessage(selectedPackage.id, userMessage);

    setIsLoading(true);
    setError(null);
    setThinkingProgress('');
    setIsThinkingPanelOpen(true);
    setFileDiffs(new Map()); // Clear previous diffs

    try {
      await firestoreService.createCheckpoint(selectedPackage.id, message || 'Image-based change', generatedCode);
      const updatedCheckpoints = await firestoreService.getCheckpoints(selectedPackage.id);
      setCheckpoints(updatedCheckpoints);
      
      const oldCode = [...generatedCode]; // Capture old state for diffing
      const patch = await geminiService.refineCode(message, generatedCode, setThinkingProgress, images);
      const updatedCode = applyCodePatch(generatedCode, patch);

      // Calculate diffs for changed files
      const newDiffs = new Map<string, Set<number>>();
      patch.forEach(p => {
          if (p.op === 'add' || p.op === 'update') {
              const oldFile = oldCode.find(f => f.path === p.path);
              const oldContent = oldFile ? oldFile.content : '';
              const newContent = p.content;
              const diff = calculateLineDiff(oldContent, newContent);
              if (diff.size > 0) {
                  newDiffs.set(p.path, diff);
              }
          }
      });
      setFileDiffs(newDiffs);
      
      await firestoreService.updatePackage(selectedPackage.id, updatedCode);
      
      setGeneratedCode(updatedCode);
      setSelectedPackage(prev => prev ? { ...prev, files: updatedCode, updatedAt: new Date() } : null);
      setChangedFilePaths(new Set(patch.map(p => p.path)));

      const modelMessage: ChatMessage = { role: 'model', content: "Done! I've updated the code based on your request. Take a look at the changes.", timestamp: new Date(), images: [] };
      await firestoreService.addChatMessage(selectedPackage.id, modelMessage);
      setChatHistory([...newHistory, modelMessage]);

    } catch (err) {
      // FIX: The 'err' object from a catch block is of type 'unknown'. Safely handle it by checking if it's an instance of Error before using its properties.
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(errorMessage);
      setChangedFilePaths(new Set()); // Clear highlights on error
      const errorModelMessage: ChatMessage = { role: 'model', content: `I encountered an error trying to process that: ${errorMessage}`, timestamp: new Date(), images: [] };
      await firestoreService.addChatMessage(selectedPackage.id, errorModelMessage);
      setChatHistory([...newHistory, errorModelMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDownloadDetailedDocs = async () => {
    if (!selectedPackage?.files || isGeneratingDocs) return;

    setIsGeneratingDocs(true);
    setError(null);

    try {
        const markdownContent = await geminiService.generateDetailedDocumentation(
            selectedPackage.name,
            selectedPackage.files,
        );
        const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const projectName = selectedPackage.name.replace(/[^a-zA-Z0-9-]/g, '_').replace(/_+/g, '_');
        link.download = `${projectName}_Detailed_Docs.md`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to generate detailed documentation.';
        setError(errorMessage);
        // This error will be displayed in the CodeOutput panel
    } finally {
        setIsGeneratingDocs(false);
    }
  };


  const handleSaveFile = async (path: string, content: string) => {
    if (!generatedCode || !selectedPackage) return;

    const originalCode = [...generatedCode]; // Keep a copy in case of failure
    const updatedCode = generatedCode.map(f =>
        f.path === path ? { ...f, content } : f
    );
    
    // Optimistically update UI
    setGeneratedCode(updatedCode);
    setSelectedPackage(prev => prev ? { ...prev, files: updatedCode, updatedAt: new Date() } : null);
    setChangedFilePaths(prev => new Set(prev).add(path));
    // A user edit clears the AI-generated diff highlighting for that file
    setFileDiffs(prev => {
        const newDiffs = new Map(prev);
        if (newDiffs.has(path)) {
            newDiffs.delete(path);
            return newDiffs;
        }
        return prev;
    });

    try {
        await firestoreService.updatePackage(selectedPackage.id, updatedCode);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to save file "${path}": ${errorMessage}`);
        // Revert UI on failure
        setGeneratedCode(originalCode);
        setSelectedPackage(prev => prev ? { ...prev, files: originalCode } : null);
    }
  };

  const renderContent = () => {
    switch(appState) {
      case 'home':
        return <Home 
                    user={user}
                    packages={packages}
                    onLogin={handleLogin}
                    onNewPackage={handleNewPackage}
                    onSelectPackage={handleSelectPackage}
                    onLoadFromKey={handleLoadFromKey}
                    onDeletePackage={handleDeleteRequest}
                    onRenamePackage={handleRenamePackage}
                    isLoading={isLoading}
                />;
      case 'generating':
      case 'chat': {
        const leftPanelContent = (
          <div className="flex flex-col h-full">
            {appState === 'generating' ? (
              <RequirementInput
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                onGenerate={handleGenerateCode}
                onGenerateFromJSON={handleCreateProjectFromJSON}
                isLoading={isLoading}
                onBack={handleGoHome}
              />
            ) : (
              <ChatInterface
                chatHistory={chatHistory}
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                onBack={handleGoHome}
                initialRequirements={selectedPackage?.initialRequirements || ''}
                checkpoints={checkpoints}
                onRevert={handleRevertRequest}
                thinkingProgress={thinkingProgress}
                isThinkingPanelOpen={isThinkingPanelOpen}
                onToggleThinkingPanel={() => setIsThinkingPanelOpen(!isThinkingPanelOpen)}
                projectName={selectedPackage?.name || ''}
                onDownloadDetailedDocs={handleDownloadDetailedDocs}
                isGeneratingDocs={isGeneratingDocs}
              />
            )}
          </div>
        );

        const rightPanelContent = (
          <CodeOutput
            selectedPackage={selectedPackage}
            checkpoints={checkpoints}
            generatedCode={generatedCode}
            isLoading={(isLoading && !generatedCode) || selectedPackage?.status === 'generating' && !generatedCode}
            error={error || selectedPackage?.error || null}
            changedFilePaths={changedFilePaths}
            onSaveFile={handleSaveFile}
            fileDiffs={fileDiffs}
          />
        );

        return (
          <main className="flex-grow flex flex-col overflow-hidden">
            {isLargeScreen ? (
              <ResizablePanels left={leftPanelContent} right={rightPanelContent} />
            ) : (
              <div className="flex flex-col h-full">
                <div className="flex border-b border-gray-700 flex-shrink-0">
                  <button
                    onClick={() => setMobileView('left')}
                    className={`flex-1 py-3 px-4 text-center text-sm font-semibold transition-colors focus:outline-none ${
                      mobileView === 'left'
                        ? 'bg-gray-800 text-cyan-400 border-b-2 border-cyan-400'
                        : 'text-gray-400 hover:bg-gray-700'
                    }`}
                    aria-pressed={mobileView === 'left'}
                  >
                    {appState === 'generating' ? 'Requirements' : 'Chat & History'}
                  </button>
                  <button
                    onClick={() => setMobileView('right')}
                    className={`flex-1 py-3 px-4 text-center text-sm font-semibold transition-colors focus:outline-none ${
                      mobileView === 'right'
                        ? 'bg-gray-800 text-cyan-400 border-b-2 border-cyan-400'
                        : 'text-gray-400 hover:bg-gray-700'
                    }`}
                    aria-pressed={mobileView === 'right'}
                  >
                    Code
                  </button>
                </div>
                <div className="flex-grow overflow-y-auto bg-gray-900">
                  {mobileView === 'left' ? leftPanelContent : rightPanelContent}
                </div>
              </div>
            )}
          </main>
        );
      }
      case 'loading':
      default:
        return (
          <div className="flex items-center justify-center h-screen">
            <svg className="animate-spin h-10 w-10 text-cyan-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )
    }
  }

  return (
    <div className="h-screen bg-gray-900 text-gray-200 font-sans flex flex-col overflow-hidden">
       <Header
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onShowKey={() => setIsShareModalOpen(true)}
        isGuest={!user}
        hasActiveProject={!!selectedPackage}
      />
      {renderContent()}
      <ShareKeyModal 
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        shareKey={selectedPackage?.id || ''}
      />
      <ConfirmationModal
        isOpen={!!checkpointToRevert}
        onClose={() => setCheckpointToRevert(null)}
        onConfirm={handleConfirmRevert}
        title="Revert to this Version?"
        message={`Are you sure you want to revert to the state from "${checkpointToRevert?.message}"? Any changes made after this version will be overwritten in your current view.`}
        confirmText="Yes, Revert"
        variant="warning"
      />
      <ConfirmationModal
        isOpen={!!packageToDelete}
        onClose={() => setPackageToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Project?"
        message={`Are you sure you want to permanently delete "${packageToDelete?.name}"? This action cannot be undone.`}
        confirmText="Yes, Delete"
        variant="danger"
      />
    </div>
  );
};

export default App;