import React, { useRef } from 'react';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ value, onChange }) => {
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const lineCount = value.split('\n').length;
  const lines = Array.from({ length: lineCount }, (_, i) => i + 1);

  const handleScroll = () => {
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const { selectionStart, selectionEnd, value } = e.currentTarget;
      const newValue = 
          value.substring(0, selectionStart) + 
          '  ' + // two spaces for tab
          value.substring(selectionEnd);
      
      onChange(newValue);

      setTimeout(() => {
        if (textareaRef.current) {
            textareaRef.current.selectionStart = textareaRef.current.selectionEnd = selectionStart + 2;
        }
      }, 0);
    }
  };

  return (
    <div className="flex-grow flex h-full font-mono text-sm bg-gray-900">
      <div 
        ref={lineNumbersRef}
        className="w-12 text-right text-gray-500 bg-gray-800 p-4 pt-[1rem] leading-6 select-none overflow-hidden"
        aria-hidden="true"
      >
        {lines.map(line => (
          <div key={line}>{line}</div>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        spellCheck="false"
        className="flex-grow p-4 pt-[1rem] bg-transparent text-gray-300 w-full resize-none focus:outline-none leading-6"
        wrap="off"
      />
    </div>
  );
};

export default CodeEditor;