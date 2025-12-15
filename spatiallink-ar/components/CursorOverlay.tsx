import React from 'react';
import { ScreenPoint } from '../types';

interface CursorOverlayProps {
  position: ScreenPoint;
  isSnapped: boolean;
  mode: 'pointer' | 'gaze' | 'switch' | 'face';
}

export const CursorOverlay: React.FC<CursorOverlayProps> = ({ position, isSnapped, mode }) => {
  return (
    <div 
      className="custom-cursor fixed pointer-events-none"
      style={{ 
        left: position.x, 
        top: position.y,
        transform: 'translate(-50%, -50%)'
      }}
    >
      {/* Main Cursor Body */}
      <div className={`
        relative flex items-center justify-center transition-all duration-200
        ${isSnapped ? 'scale-150' : 'scale-100'}
      `}>
        {/* Core Dot */}
        <div className={`
          w-4 h-4 rounded-full border-2 shadow-sm
          ${isSnapped ? 'bg-indigo-500 border-white' : 'bg-transparent border-red-500'}
          ${mode === 'face' ? 'border-indigo-400' : ''}
        `} />
        
        {/* Outer Ring for Gaze Mode */}
        {mode === 'gaze' && (
          <div className="absolute w-10 h-10 border-2 border-red-500/30 rounded-full animate-pulse" />
        )}

        {/* Outer Ring for Face Mode */}
        {mode === 'face' && (
          <div className="absolute w-12 h-12 border-2 border-dashed border-indigo-400/50 rounded-full animate-spin-slow" />
        )}
        
        {/* Crosshair lines */}
        <div className={`absolute w-8 h-[2px] bg-red-500/50 ${isSnapped ? 'opacity-0' : 'opacity-100'}`} />
        <div className={`absolute w-[2px] h-8 bg-red-500/50 ${isSnapped ? 'opacity-0' : 'opacity-100'}`} />
      </div>
    </div>
  );
};