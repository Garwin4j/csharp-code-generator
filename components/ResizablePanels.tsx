import React, { useState, useRef, useCallback, useEffect } from 'react';

interface ResizablePanelsProps {
  left: React.ReactNode;
  right: React.ReactNode;
}

const ResizablePanels: React.FC<ResizablePanelsProps> = ({ left, right }) => {
  const [leftWidth, setLeftWidth] = useState(50); // Initial width in percentage
  const containerRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);

  const mouseMoveHandler = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current || !containerRef.current) {
      return;
    }
    const containerRect = containerRef.current.getBoundingClientRect();
    let newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

    const minWidth = 25; // 25% min width for a panel
    const maxWidth = 75; // 75% max width

    if (newLeftWidth < minWidth) newLeftWidth = minWidth;
    if (newLeftWidth > maxWidth) newLeftWidth = maxWidth;
    
    setLeftWidth(newLeftWidth);
  }, []);

  const mouseUpHandler = useCallback(() => {
    isResizingRef.current = false;
    window.removeEventListener('mousemove', mouseMoveHandler);
    window.removeEventListener('mouseup', mouseUpHandler);
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  }, [mouseMoveHandler]);

  const mouseDownHandler = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', mouseMoveHandler);
    window.addEventListener('mouseup', mouseUpHandler);
  }, [mouseMoveHandler, mouseUpHandler]);
  
  // Cleanup effect in case component unmounts while resizing
  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', mouseMoveHandler);
      window.removeEventListener('mouseup', mouseUpHandler);
    };
  }, [mouseMoveHandler, mouseUpHandler]);

  return (
    <div ref={containerRef} className="flex h-full w-full">
      <div className="shrink-0" style={{ width: `${leftWidth}%` }}>
        <div className="h-full w-full overflow-hidden">
            {left}
        </div>
      </div>
      <div
        onMouseDown={mouseDownHandler}
        className="w-2 cursor-col-resize flex items-center justify-center bg-gray-900 hover:bg-gray-700 transition-colors group"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panels"
      >
        <div className="w-0.5 h-8 bg-gray-700 rounded-full group-hover:bg-cyan-500 transition-colors"></div>
      </div>
      <div className="flex-grow min-w-0">
         <div className="h-full w-full overflow-hidden">
            {right}
        </div>
      </div>
    </div>
  );
};

export default ResizablePanels;
