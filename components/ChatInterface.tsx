import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage } from '../types';

interface ChatInterfaceProps {
  chatHistory: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  onBack: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ chatHistory, onSendMessage, isLoading, onBack }) => {
  const [message, setMessage] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom when new messages are added
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      onSendMessage(message);
      setMessage('');
    }
  };

  return (
    <div className="flex flex-col bg-gray-800 rounded-lg shadow-lg overflow-hidden h-[85vh]">
      <div className="p-4 border-b border-gray-700 flex justify-between items-center">
        <div>
            <h2 className="text-xl font-semibold text-white">Refine Your Project</h2>
            <p className="text-sm text-gray-400">Chat with the AI to make changes to the generated code.</p>
        </div>
        <button onClick={onBack} className="text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold py-2 px-4 rounded-md transition-colors">&larr; Back to Projects</button>
      </div>

      <div ref={chatContainerRef} className="flex-grow p-4 overflow-y-auto space-y-4">
        {chatHistory.map((chat, index) => (
          <div key={index} className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`rounded-lg px-4 py-2 max-w-lg ${chat.role === 'user' ? 'bg-cyan-800 text-white' : 'bg-gray-700 text-gray-200'}`}>
                <div className="prose-styles text-white">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{chat.content}</ReactMarkdown>
                </div>
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

      <div className="p-4 bg-gray-800 border-t border-gray-700">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="e.g., 'Add a Description property to the User entity.'"
            className="flex-grow p-3 bg-gray-900 text-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500 font-sans text-sm"
            rows={2}
            disabled={isLoading}
            aria-label="Chat input for code refinement"
          />
          <button
            type="submit"
            disabled={isLoading || !message.trim()}
            className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-5 rounded-md transition-all duration-300 ease-in-out flex items-center justify-center"
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
  );
};

export default ChatInterface;