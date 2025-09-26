import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, User as FirebaseUser, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from './firebaseConfig';
import { GeneratedFile, ChatMessage, Package, FilePatch } from './types';
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

type AppState = 'loading' | 'home' | 'generating' | 'chat';

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
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [thinkingProgress, setThinkingProgress] = useState<string>('');
  const [isThinkingPanelOpen, setIsThinkingPanelOpen] = useState<boolean>(false);

  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1024);

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
    setRequirements(INITIAL_REQUIREMENTS);
    setAppState('generating');
  };

  const handleGoHome = () => {
    setSelectedPackage(null);
    setGeneratedCode(null);
    setChatHistory([]);
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
          <main className="flex-grow p-4 lg:p-6 overflow-hidden">
            <div className="h-full w-full">
              {isLargeScreen ? (
                <ResizablePanels left={leftPanelContent} right={rightPanelContent} />
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="h-[80vh]">
                    {leftPanelContent}
                  </div>
                  <div className="h-[80vh]">
                    {rightPanelContent}
                  </div>
                </div>
              )}
            </div>
          </main>
        );
      }
      case 'loading':
      default:
        return (
          <div className="flex items-center justify-center h-screen">
            <svg className="animate-spin h-10 w-10 text-cyan-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8_0_018-8V0C5.373_0_0_5.373_0_12h4zm2_5.291A7.962_7.962_0_014_12H0c0_3.042_1.135_5.824_3_7.938l3-2.647z"></path>
            </svg>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans flex flex-col">
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
    </div>
  );
};

export default App;