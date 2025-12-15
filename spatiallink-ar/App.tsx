import React, { useState, useEffect } from 'react';
import { ARCanvas } from './components/ARCanvas';
import { CursorOverlay } from './components/CursorOverlay';
import { Anchor, ScreenPoint, InputMode } from './types';
import { Settings, CheckCircle, ScanFace, MousePointer2, Eye } from 'lucide-react';

export default function App() {
  const [appMode, setAppMode] = useState<'setup' | 'control'>('setup');
  const [inputMode, setInputMode] = useState<InputMode>('pointer');
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  
  // Cursor State
  const [cursorPos, setCursorPos] = useState<ScreenPoint>({ x: 0, y: 0 });
  const [snappedAnchorId, setSnappedAnchorId] = useState<string | null>(null);

  // Feedback State
  const [lastAction, setLastAction] = useState<string | null>(null);

  // Hack to allow ARCanvas click handlers to update state (since I hardcoded the JSX in ARCanvas previously)
  // Ideally we pass setInputMode down, but the previous ARCanvas code had the mode buttons inside it.
  // I updated ARCanvas to use (window as any).setInputMode, so let's attach it.
  useEffect(() => {
    (window as any).setInputMode = setInputMode;
  }, []);

  const handleUpdateCursor = (pos: ScreenPoint, snappedId: string | null) => {
    setCursorPos(pos);
    setSnappedAnchorId(snappedId);
  };

  const handleAddAnchor = (anchor: Anchor) => {
    setAnchors([...anchors, anchor]);
    showFeedback(`Added ${anchor.label}`);
  };

  const handleTrigger = (id: string) => {
    const anchor = anchors.find(a => a.id === id);
    if (anchor) {
      showFeedback(`Toggled ${anchor.label}`);
      // In a real app, this would call an IoT API
    }
  };

  const showFeedback = (msg: string) => {
    setLastAction(msg);
    setTimeout(() => setLastAction(null), 2000);
  };

  return (
    <div className="relative w-screen h-screen bg-black text-white font-sans overflow-hidden">
      
      {/* Main AR Interface */}
      <ARCanvas 
        mode={appMode}
        inputMode={inputMode}
        anchors={anchors}
        onAddAnchor={handleAddAnchor}
        onUpdateCursor={handleUpdateCursor}
        onTriggerAnchor={handleTrigger}
      />

      {/* Floating Custom Cursor */}
      <CursorOverlay 
        position={cursorPos} 
        isSnapped={!!snappedAnchorId} 
        mode={inputMode}
      />

      {/* Mode Switcher Sidebar */}
      <div className="absolute top-20 right-4 flex flex-col gap-3">
        <button 
          onClick={() => setAppMode(appMode === 'setup' ? 'control' : 'setup')}
          className={`p-3 rounded-full shadow-xl transition-colors border border-white/20 ${appMode === 'setup' ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-white'}`}
          title="Toggle Setup/Control Mode"
        >
          <Settings size={24} />
        </button>

        {appMode === 'control' && (
          <div className="flex flex-col gap-3 bg-black/50 p-2 rounded-2xl backdrop-blur-sm">
            <button 
              onClick={() => setInputMode('pointer')}
              className={`p-3 rounded-full shadow-xl transition-all border border-white/20 ${inputMode === 'pointer' ? 'bg-indigo-600 scale-110' : 'bg-gray-800'}`}
              title="Pointer Mode"
            >
              <MousePointer2 size={20} />
            </button>
            <button 
              onClick={() => setInputMode('gaze')}
              className={`p-3 rounded-full shadow-xl transition-all border border-white/20 ${inputMode === 'gaze' ? 'bg-indigo-600 scale-110' : 'bg-gray-800'}`}
              title="Gaze Mode (Mouse Dwell)"
            >
              <Eye size={20} />
            </button>
             <button 
              onClick={() => setInputMode('face')}
              className={`p-3 rounded-full shadow-xl transition-all border border-white/20 ${inputMode === 'face' ? 'bg-indigo-600 scale-110' : 'bg-gray-800'}`}
              title="Face/Blink Mode"
            >
              <ScanFace size={20} />
            </button>
          </div>
        )}
      </div>

      {/* Feedback Toast */}
      {lastAction && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-green-500 text-white px-6 py-2 rounded-full shadow-2xl flex items-center gap-2 animate-bounce z-50">
          <CheckCircle size={20} />
          <span className="font-bold">{lastAction}</span>
        </div>
      )}

      {/* Introduction Modal (if no anchors) */}
      {anchors.length === 0 && appMode === 'setup' && (
         <div className="absolute bottom-32 left-4 right-4 md:left-auto md:right-auto md:w-96 bg-gray-900/90 backdrop-blur border border-white/20 p-6 rounded-2xl pointer-events-none">
           <h3 className="text-lg font-bold text-yellow-400 mb-2">Welcome to SpatialLink</h3>
           <p className="text-sm text-gray-300 mb-2">
             1. Point camera at an appliance.<br/>
             2. Click <b>Add Anchor</b>. Gemini will identify it.<br/>
             3. Switch to <b>Control Mode</b>.<br/>
             4. Try <b>Face Mode</b> to click by blinking!
           </p>
         </div>
      )}
    </div>
  );
}