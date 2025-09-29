import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, User as FirebaseUser, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from './firebaseConfig';
import { GeneratedFile, ChatMessage, Package, FilePatch, Checkpoint } from './types';
import { generateCode, refineCode } from './services/geminiService';
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

const applyCodePatch = (currentCode: GeneratedFile[], patch: FilePatch[]): GeneratedFile[] => {
  let newCode = [...currentCode];

  patch.forEach(operation => {
    const fileIndex = newCode.findIndex(f => f.path === operation.path);
    const fileExists = fileIndex !== -1;

    switch (operation.op) {
      case 'add':
        if (fileExists) {
          newCode[fileIndex].content = operation.content;
        } else {
          newCode.push({ path: operation.path, content: operation.content });
        }
        break;
      case 'update':
        if (fileExists) {
          newCode[fileIndex].content = operation.content;
        } else {
          newCode.push({ path: operation.path, content: operation.content });
        }
        break;
      case 'delete':
        if (fileExists) {
          newCode.splice(fileIndex, 1);
        }
        break;
    }
  });

  return newCode;
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('loading');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  
  const [requirements, setRequirements] = useState<string>(INITIAL_REQUIREMENTS);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [generatedCode, setGeneratedCode] = useState<GeneratedFile[] | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [checkpointToRevert, setCheckpointToRevert] = useState<Checkpoint | null>(null);
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
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
    setAppState('home');
  };

  const handleSelectPackage = async (packageId: string) => {
    const pkg = packages.find(p => p.id === packageId) || await firestoreService.getPackage(packageId);
    if (pkg && pkg.files) {
      setIsLoading(true);
      setSelectedPackage(pkg);
      setGeneratedCode(pkg.files);
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
    setRequirements(INITIAL_REQUIREMENTS);
    setAppState('generating');
  };

  const handleGoHome = () => {
    setSelectedPackage(null);
    setGeneratedCode(null);
    setChatHistory([]);
    setCheckpoints([]);
    setAppState('home');
  };

  const handleGenerateCode = async () => {
    if (!requirements.trim()) return;
    setIsLoading(true);
    setError(null);
  
    try {
      // Create package first, works for guests (user?.uid is undefined) and logged-in users
      const newPackage = await firestoreService.createPackageForGeneration(requirements, user?.uid);
      setSelectedPackage(newPackage);
      setAppState('chat'); // Go directly to chat/generation view
  
      // Fire-and-forget background generation
      generateCode(newPackage.id, requirements);
  
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred while starting generation.');
      setAppState('generating');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevertRequest = (checkpoint: Checkpoint) => {
    setCheckpointToRevert(checkpoint);
  };

  const handleConfirmRevert = async () => {
      if (!checkpointToRevert || !selectedPackage) return;

      setIsLoading(true);
      setError(null);
      
      try {
          await firestoreService.updatePackage(selectedPackage.id, checkpointToRevert.files);
          setGeneratedCode(checkpointToRevert.files);
          setSelectedPackage(prev => prev ? { ...prev, files: checkpointToRevert.files, updatedAt: new Date() } : null);

          const revertMessage: ChatMessage = { role: 'model', content: `Successfully reverted to the version from "${checkpointToRevert.message}".` };
          await firestoreService.addChatMessage(selectedPackage.id, revertMessage);
          setChatHistory(prev => [...prev, revertMessage]);

      } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during revert.';
          setError(errorMessage);
          const errorModelMessage: ChatMessage = { role: 'model', content: `I encountered an error trying to revert: ${errorMessage}` };
          setChatHistory(prev => [...prev, errorModelMessage]);
      } finally {
          setIsLoading(false);
          setCheckpointToRevert(null);
      }
  };
  
  const handleSendMessage = async (message: string) => {
    if (!message.trim() || !generatedCode || !selectedPackage) return;

    const userMessage: ChatMessage = { role: 'user', content: message };
    const newHistory = [...chatHistory, userMessage];
    setChatHistory(newHistory);
    await firestoreService.addChatMessage(selectedPackage.id, userMessage);

    setIsLoading(true);
    setError(null);
    setThinkingProgress('');
    setIsThinkingPanelOpen(true);

    try {
      await firestoreService.createCheckpoint(selectedPackage.id, message, generatedCode);
      const updatedCheckpoints = await firestoreService.getCheckpoints(selectedPackage.id);
      setCheckpoints(updatedCheckpoints);
      
      const patch = await refineCode(message, generatedCode, setThinkingProgress);
      const updatedCode = applyCodePatch(generatedCode, patch);

      await firestoreService.updatePackage(selectedPackage.id, updatedCode);
      
      setGeneratedCode(updatedCode);
      setSelectedPackage(prev => prev ? { ...prev, files: updatedCode, updatedAt: new Date() } : null);

      const modelMessage: ChatMessage = { role: 'model', content: "Done! I've updated the code based on your request. Take a look at the changes." };
      await firestoreService.addChatMessage(selectedPackage.id, modelMessage);
      setChatHistory([...newHistory, modelMessage]);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(errorMessage);
      const errorModelMessage: ChatMessage = { role: 'model', content: `I encountered an error trying to process that: ${errorMessage}` };
      await firestoreService.addChatMessage(selectedPackage.id, errorModelMessage);
      setChatHistory([...newHistory, errorModelMessage]);
    } finally {
      setIsLoading(false);
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
                    isLoading={isLoading}
                />;
      case 'generating':
      case 'chat': {
        const leftPanelContent = (
          <div className="flex flex-col gap-4 h-full">
            {appState === 'generating' ? (
              <RequirementInput
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                onGenerate={handleGenerateCode}
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
              />
            )}

            {isLoading && appState === 'chat' && (
              <ThinkingProgress
                progress={thinkingProgress}
                isOpen={isThinkingPanelOpen}
                onToggle={() => setIsThinkingPanelOpen(!isThinkingPanelOpen)}
              />
            )}
          </div>
        );

        const rightPanelContent = (
          <CodeOutput
            generatedCode={generatedCode}
            isLoading={(isLoading && !generatedCode) || selectedPackage?.status === 'generating' && !generatedCode}
            error={error || selectedPackage?.error || null}
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
      />
    </div>
  );
};

export default App;