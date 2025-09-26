import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth } from './firebaseConfig';
import { GeneratedFile, ChatMessage, Package, FilePatch } from './types';
import { generateCode, refineCode } from './services/geminiService';
import * as firestoreService from './services/firestoreService';
import { INITIAL_REQUIREMENTS } from './constants';

import Header from './components/Header';
import RequirementInput from './components/RequirementInput';
import CodeOutput from './components/CodeOutput';
import ThinkingProgress from './components/ThinkingProgress';
import ChatInterface from './components/ChatInterface';
import Login from './components/Login';
import PackageSelector from './components/PackageSelector';

type AppState = 'loading' | 'login' | 'package_selection' | 'generating' | 'chat';

const applyCodePatch = (currentCode: GeneratedFile[], patch: FilePatch[]): GeneratedFile[] => {
  let newCode = [...currentCode];

  patch.forEach(operation => {
    const fileIndex = newCode.findIndex(f => f.path === operation.path);
    const fileExists = fileIndex !== -1;

    switch (operation.op) {
      case 'add':
        if (fileExists) {
          // If file exists, treat add as an update
          newCode[fileIndex].content = operation.content;
        } else {
          // Otherwise, add the new file
          newCode.push({ path: operation.path, content: operation.content });
        }
        break;
      case 'update':
        if (fileExists) {
          // If file exists, update it
          newCode[fileIndex].content = operation.content;
        } else {
          // If not, treat update as an add
          newCode.push({ path: operation.path, content: operation.content });
        }
        break;
      case 'delete':
        if (fileExists) {
          // Remove the file if it exists
          newCode.splice(fileIndex, 1);
        }
        // If it doesn't exist, do nothing
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setAppState('package_selection');
      } else {
        setAppState('login');
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

  const handleLogout = async () => {
    await signOut(auth);
    setSelectedPackage(null);
    setGeneratedCode(null);
    setChatHistory([]);
    setPackages([]);
  };

  const handleSelectPackage = async (packageId: string) => {
    const pkg = packages.find(p => p.id === packageId);
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

  const handleNewPackage = () => {
    setSelectedPackage(null);
    setGeneratedCode(null);
    setChatHistory([]);
    setRequirements(INITIAL_REQUIREMENTS);
    setAppState('generating');
  };

  const handleBackToSelector = () => {
    setSelectedPackage(null);
    setGeneratedCode(null);
    setChatHistory([]);
    setAppState('package_selection');
  };

  const handleGenerateCode = async () => {
    if (!requirements.trim() || !user) return;
    setIsLoading(true);
    setError(null);
  
    try {
      const newPackage = await firestoreService.createPackageForGeneration(user.uid, requirements);
      setAppState('package_selection');
  
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
    if (!message.trim() || !generatedCode || !selectedPackage || !user) return;

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
      case 'login':
        return <Login />;
      case 'package_selection':
        return <PackageSelector packages={packages} onSelect={handleSelectPackage} onNew={handleNewPackage} isLoading={isLoading} />;
      case 'generating':
      case 'chat':
        return (
          <main className="flex-grow grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 lg:p-6">
            <div className="flex flex-col gap-4">
              {appState === 'generating' ? (
                <RequirementInput
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  onGenerate={handleGenerateCode}
                  isLoading={isLoading}
                  onBack={handleBackToSelector}
                />
              ) : (
                 <ChatInterface 
                    chatHistory={chatHistory} 
                    onSendMessage={handleSendMessage} 
                    isLoading={isLoading}
                    onBack={handleBackToSelector}
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
            <CodeOutput
              generatedCode={generatedCode}
              isLoading={isLoading && !generatedCode}
              error={error}
            />
          </main>
        );
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
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans flex flex-col">
      <Header user={user} onLogout={handleLogout} />
      {renderContent()}
    </div>
  );
};

export default App;
