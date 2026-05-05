import { useState, useEffect } from 'react';

export function useDraggable() {
  const [isDragging, setIsDragging] = useState(false);
  const [initialPosition, setInitialPosition] = useState({ x: 0, y: 0 });
  const [currentPosition, setCurrentPosition] = useState({ x: 0, y: 0 });

  const startDrag = (event) => {
    setIsDragging(true);
    setInitialPosition({ x: event.clientX, y: event.clientY });
  };

  const stopDrag = () => {
    setIsDragging(false);
  };

  const onMouseMove = (event) => {
    if (!isDragging) return;

    const deltaX = event.clientX - initialPosition.x;
    const deltaY = event.clientY - initialPosition.y;

    setCurrentPosition({ x: deltaX, y: deltaY });
  };

  useEffect(() => {
    if (isDragging) {
      const handleMouseMove = (event) => onMouseMove(event);
      const handleMouseUp = () => stopDrag();

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, onMouseMove, stopDrag]);

  return { isDragging, startDrag, stopDrag, onMouseMove };
}