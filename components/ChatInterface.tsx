
import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage, Checkpoint } from '../types';
import { consolidateRequirements } from '../services/geminiService';
import CheckpointHistory from './CheckpointHistory';
import ThinkingProgress from './ThinkingProgress';

interface ChatInterfaceProps {
  chatHistory: ChatMessage[];
  onSendMessage: (message: string, images: { mimeType: string; data: string; name: string }[]) => void;
  isLoading: boolean;
  onBack: () => void;
  initialRequirements: string;
  checkpoints: Checkpoint[];
  onRevert: (checkpoint: Checkpoint) => void;
  thinkingProgress: string;
  isThinkingPanelOpen: boolean;
  onToggleThinkingPanel: () => void;
  projectName: string;
  onDownloadDetailedDocs: () => void;
  isGeneratingDocs: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
    chatHistory, 
    onSendMessage, 
    isLoading, 
    onBack, 
    initialRequirements, 
    checkpoints, 
    onRevert,
    thinkingProgress,
    isThinkingPanelOpen,
    onToggleThinkingPanel,
    projectName,
    onDownloadDetailedDocs,
    isGeneratingDocs,
}) => {
  const [message, setMessage] = useState('');
  const [images, setImages] = useState<{ file: File; previewUrl: string; base64: string; mimeType: string }[]>([]);
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'history'>('chat');
  const [inputTab, setInputTab] = useState<'write' | 'preview'>('write');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Scroll to bottom when new messages are added
    if (activeTab === 'chat' && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, activeTab]);

  const handleImageUpload = (files: FileList | null) => {
    if (!files || images.length >= 5) return; // Limit to 5 images for now

    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    imageFiles.slice(0, 5 - images.length).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        const previewUrl = URL.createObjectURL(file);
        setImages(prev => [
          ...prev, 
          { file, previewUrl, base64: base64String, mimeType: file.type }
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleImageUpload(e.target.files);
    if (e.target) e.target.value = ''; // Reset to allow selecting same file again
  };

  const removeImage = (index: number) => {
    const imageToRemove = images[index];
    URL.revokeObjectURL(imageToRemove.previewUrl);
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleImageUpload(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((message.trim() || images.length > 0) && !isLoading && !isGeneratingDocs) {
      const imagesToSend = images.map(img => ({
        mimeType: img.mimeType,
        data: img.base64,
        name: img.file.name,
      }));
      onSendMessage(message, imagesToSend);
      setMessage('');
      images.forEach(img => URL.revokeObjectURL(img.previewUrl)); // Clean up object URLs
      setImages([]);
    }
  };

  const handleDownloadPrompt = async () => {
    setIsConsolidating(true);
    try {
        const consolidatedText = await consolidateRequirements(initialRequirements, chatHistory);
        const blob = new Blob([consolidatedText], { type: 'text/markdown;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'Consolidated-Requirements.md';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    } catch (error) {
        console.error("Failed to download consolidated prompt:", error);
    } finally {
        setIsConsolidating(false);
    }
  };

  const tabButtonClasses = (isActive: boolean) =>
    `px-4 py-2 text-sm font-medium focus:outline-none transition-colors duration-200 ${
      isActive
        ? 'bg-gray-900 text-cyan-400 border-b-2 border-cyan-400'
        : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
    }`;
    
  const inputTabButtonClasses = (isActive: boolean) =>
    `px-3 py-1.5 text-xs font-medium focus:outline-none transition-colors duration-200 ${
      isActive
        ? 'bg-gray-700/50 text-cyan-400'
        : 'text-gray-400 hover:text-white'
    }`;


  return (
    <div className="flex flex-col bg-gray-800 overflow-hidden flex-grow min-h-0">
      <div className="p-4 border-b border-gray-700 flex justify-between items-center flex-wrap gap-2">
        <div>
            <h2 className="text-xl font-semibold text-white">Refine: <span className="text-cyan-400">{projectName}</span></h2>
            <p className="text-sm text-gray-400">Chat with the AI to make changes or view version history.</p>
        </div>
        <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPrompt}
              disabled={isConsolidating || isLoading || isGeneratingDocs}
              className="text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold py-2 px-4 rounded-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConsolidating ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Building...</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  <span>Download Prompt</span>
                </>
              )}
            </button>
             <button
              onClick={onDownloadDetailedDocs}
              disabled={isGeneratingDocs || isLoading || isConsolidating}
              className="text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold py-2 px-4 rounded-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingDocs ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                    <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                  </svg>
                  <span>Download Docs</span>
                </>
              )}
            </button>
            <button onClick={onBack} className="text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold py-2 px-4 rounded-md transition-colors">&larr; Back to Home</button>
        </div>
      </div>

       <div className="flex border-b border-gray-700 bg-gray-800">
        <button
          onClick={() => setActiveTab('chat')}
          className={tabButtonClasses(activeTab === 'chat')}
          aria-pressed={activeTab === 'chat'}
        >
          Chat
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={tabButtonClasses(activeTab === 'history')}
          aria-pressed={activeTab === 'history'}
        >
          History ({checkpoints.length})
        </button>
      </div>

      {activeTab === 'chat' && (
        <div className="flex flex-col flex-grow min-h-0">
          <div ref={chatContainerRef} className="flex-grow p-4 overflow-y-auto space-y-4">
            {chatHistory.map((chat, index) => (
              <div key={index} className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex flex-col ${chat.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`rounded-lg px-4 py-2 max-w-lg ${chat.role === 'user' ? 'bg-cyan-800 text-white' : 'bg-gray-700 text-gray-200'}`}>
                        {chat.images && chat.images.length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-2">
                                {chat.images.map((img, imgIndex) => (
                                    <img 
                                        key={imgIndex}
                                        src={`data:${img.mimeType};base64,${img.data}`}
                                        alt={img.name}
                                        className="max-w-xs max-h-48 rounded-md object-cover"
                                    />
                                ))}
                            </div>
                        )}
                        <div className="prose-styles text-white">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{chat.content}</ReactMarkdown>
                        </div>
                    </div>
                    {chat.timestamp && (
                        <p className="text-xs text-gray-500 mt-1 px-1">
                            {chat.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    )}
                </div>
              </div>
            ))}
            {isLoading && chatHistory[chatHistory.length - 1]?.role === 'user' && (
                <div className="flex justify-start">
                    <div className="rounded-lg px-4 py-2 max-w-lg bg-gray-700 text-gray-200 animate-pulse">
                        Thinking...
                    </div>
                </div>
            )}
          </div>
          {isLoading && (
            <div className="flex-shrink-0 p-4 border-t border-gray-700">
                <ThinkingProgress 
                    progress={thinkingProgress}
                    isOpen={isThinkingPanelOpen}
                    onToggle={onToggleThinkingPanel}
                />
            </div>
          )}
          <div className="p-4 bg-gray-800 border-t border-gray-700">
            {images.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2 p-2 bg-gray-900/50 rounded-md">
                    {images.map((img, index) => (
                        <div key={index} className="relative">
                            <img src={img.previewUrl} alt={img.file.name} className="h-20 w-20 object-cover rounded-md" />
                            <button onClick={() => removeImage(index)} className="absolute -top-1 -right-1 bg-gray-800 text-white rounded-full p-0.5 hover:bg-red-500">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}
            <div className="bg-gray-900 rounded-md border border-gray-700 focus-within:ring-2 focus-within:ring-cyan-500">
              <div className="flex justify-end px-2 pt-1">
                 <div className="flex items-center gap-1 bg-gray-800 rounded-full p-0.5">
                    <button onClick={() => setInputTab('write')} className={inputTabButtonClasses(inputTab === 'write')}>Write</button>
                    <button onClick={() => setInputTab('preview')} className={inputTabButtonClasses(inputTab === 'preview')}>Preview</button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="flex gap-2 p-2 items-end">
                  {inputTab === 'write' ? (
                     <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit(e);
                          }
                        }}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        placeholder="e.g., 'Add a Description property to the User entity.'"
                        className="flex-grow p-2 bg-transparent text-gray-300 w-full resize-none focus:outline-none font-sans text-sm"
                        rows={3}
                        disabled={isLoading || isGeneratingDocs}
                        aria-label="Chat input for code refinement"
                      />
                  ) : (
                    <div className="flex-grow p-2 w-full min-h-[76px] max-h-48 overflow-y-auto prose-styles">
                       <ReactMarkdown remarkPlugins={[remarkGfm]}>{message || "Nothing to preview"}</ReactMarkdown>
                    </div>
                  )}

                  <input type="file" ref={fileInputRef} onChange={handleImageSelect} multiple accept="image/*" className="hidden" />
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoading || isGeneratingDocs} className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors disabled:opacity-50">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || isGeneratingDocs || (!message.trim() && images.length === 0)}
                    className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold p-3 rounded-md transition-all duration-300 ease-in-out flex items-center justify-center self-end"
                    aria-label="Send message"
                  >
                    {isLoading ? (
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    )}
                  </button>
              </form>
            </div>
          </div>
        </div>
      )}
       {activeTab === 'history' && (
          <CheckpointHistory checkpoints={checkpoints} onRevert={onRevert} />
       )}
    </div>
  );
};

export default ChatInterface;
