import React, { useRef, useMemo } from 'react';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  diff?: Set<number>; // 1-indexed line numbers
}

const CodeEditor: React.FC<CodeEditorProps> = ({ value, onChange, diff }) => {
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlighterRef = useRef<HTMLDivElement>(null);

  const lines = useMemo(() => value.split('\n'), [value]);
  const lineCount = lines.length;

  const handleScroll = () => {
    if (lineNumbersRef.current && textareaRef.current && highlighterRef.current) {
      const scrollTop = textareaRef.current.scrollTop;
      lineNumbersRef.current.scrollTop = scrollTop;
      highlighterRef.current.scrollTop = scrollTop;
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
        className="w-12 text-right text-gray-500 bg-gray-800 p-4 pt-[1rem] leading-6 select-none shrink-0"
        aria-hidden="true"
      >
        {/* We render a div with a fixed height to avoid reflow, and let the parent scroll it via scrollTop */}
        <div className="relative">
            {Array.from({ length: lineCount }, (_, i) => i + 1).map(lineNum => (
                <div key={lineNum}>{lineNum}</div>
            ))}
        </div>
      </div>
      <div className="relative flex-grow">
        <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            spellCheck="false"
            className="absolute inset-0 p-4 pt-[1rem] bg-transparent text-gray-300 w-full h-full resize-none focus:outline-none leading-6 z-10"
            wrap="off"
        />
        <div
            ref={highlighterRef}
            className="absolute inset-0 p-4 pt-[1rem] leading-6 overflow-hidden pointer-events-none"
            aria-hidden="true"
        >
            {lines.map((_, index) => {
                const lineNumber = index + 1;
                const isChanged = diff?.has(lineNumber);
                // Using a non-breaking space to ensure the div has height.
                return <div key={index} className={isChanged ? 'bg-green-900/40 rounded-sm -mx-2 px-2' : ''}>&nbsp;</div>;
            })}
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;