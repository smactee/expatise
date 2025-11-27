// components/DragScrollRow.tsx
import React, { useRef } from 'react';

type DragScrollRowProps = {
  children: React.ReactNode;
  className?: string; // e.g. styles.testModeRow
};

export default function DragScrollRow({
  children,
  className,
}: DragScrollRowProps) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!rowRef.current) return;
    isDraggingRef.current = true;

    startXRef.current = e.pageX - rowRef.current.offsetLeft;
    scrollLeftRef.current = rowRef.current.scrollLeft;
  };

  const handleMouseLeave = () => {
    isDraggingRef.current = false;
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !rowRef.current) return;

    e.preventDefault();
    const x = e.pageX - rowRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5; // tweak factor if you want
    rowRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  return (
    <div
      ref={rowRef}
      className={className}
      onMouseDown={handleMouseDown}
      onMouseLeave={handleMouseLeave}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
    >
      {children}
    </div>
  );
}
