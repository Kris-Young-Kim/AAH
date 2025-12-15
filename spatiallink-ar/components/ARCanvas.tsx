import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Anchor, ViewState, ScreenPoint } from '../types';
import { Plus, Zap, MousePointer2, Eye, Move, ScanFace } from 'lucide-react';
import { identifyAppliance } from '../services/geminiService';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

interface ARCanvasProps {
  mode: 'setup' | 'control';
  inputMode: 'pointer' | 'gaze' | 'switch' | 'face';
  anchors: Anchor[];
  onAddAnchor: (anchor: Anchor) => void;
  onUpdateCursor: (pos: ScreenPoint, snappedId: string | null) => void;
  onTriggerAnchor: (id: string) => void;
}

const FOV = 60; // Field of view in degrees

// Helper: Calculate relative position of Iris (0..1) inside the Eye box
// 0.5 is center, <0.5 is one side, >0.5 is other side.
const getEyeGazeRatio = (landmarks: any[], irisId: number, cornerIds: number[]) => {
  const iris = landmarks[irisId];
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  cornerIds.forEach(id => {
    const p = landmarks[id];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });

  const width = maxX - minX;
  const height = maxY - minY;
  
  // Safe guard division by zero
  if (width === 0 || height === 0) return { x: 0.5, y: 0.5 };

  // Calculate ratio (0 to 1)
  // Mirroring note: Since we mirror the video (scaleX -1), the "left" in image might be "right" visually.
  // We will handle coordinate mapping in the main loop.
  const xRatio = (iris.x - minX) / width;
  const yRatio = (iris.y - minY) / height;

  return { x: xRatio, y: yRatio };
};

export const ARCanvas: React.FC<ARCanvasProps> = ({ 
  mode, 
  inputMode, 
  anchors, 
  onAddAnchor, 
  onUpdateCursor,
  onTriggerAnchor
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); 
  
  // Simulated Camera Pose (SLAM State)
  const [viewState, setViewState] = useState<ViewState>({ yaw: 0, pitch: 0 });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cursorPos, setCursorPos] = useState<ScreenPoint>({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  
  // For Interaction
  const [hoveredAnchorId, setHoveredAnchorId] = useState<string | null>(null);
  const dwellTimeoutRef = useRef<number | null>(null);
  const dwellIntervalRef = useRef<number | null>(null);
  const [dwellProgress, setDwellProgress] = useState(0);

  // MediaPipe State
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const requestRef = useRef<number | null>(null);
  const [isFaceModelLoading, setIsFaceModelLoading] = useState(false);
  const blinkStartTimeRef = useRef<number | null>(null);
  const lastCursorRef = useRef<ScreenPoint>({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  // Initialize Camera
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera access denied:", err);
      }
    };
    startCamera();
  }, []);

  // Initialize MediaPipe Face Landmarker
  useEffect(() => {
    if (inputMode === 'face' && !faceLandmarkerRef.current && !isFaceModelLoading) {
      const initFaceLandmarker = async () => {
        setIsFaceModelLoading(true);
        try {
          const filesetResolver = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
          );
          faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
              modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
              delegate: "GPU"
            },
            outputFaceBlendshapes: true,
            runningMode: "VIDEO",
            numFaces: 1
          });
          console.log("Face Landmarker loaded");
        } catch (e) {
          console.error("Failed to load face landmarker", e);
        } finally {
          setIsFaceModelLoading(false);
        }
      };
      initFaceLandmarker();
    }
  }, [inputMode, isFaceModelLoading]);

  // Face/Eye Tracking Loop
  const predictWebcam = useCallback(() => {
    const video = videoRef.current;
    const landmarker = faceLandmarkerRef.current;
    
    if (inputMode === 'face' && video && landmarker && video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const startTimeMs = performance.now();
      
      const result = landmarker.detectForVideo(video, startTimeMs);

      // 1. Blink Detection Logic (Interaction)
      let isBlinking = false;
      if (result.faceBlendshapes && result.faceBlendshapes.length > 0) {
        const categories = result.faceBlendshapes[0].categories;
        const blinkLeft = categories.find(c => c.categoryName === 'eyeBlinkLeft')?.score || 0;
        const blinkRight = categories.find(c => c.categoryName === 'eyeBlinkRight')?.score || 0;

        // Threshold 0.5 is standard, 0.4 is slightly more responsive
        const BLINK_THRESHOLD = 0.4;
        isBlinking = blinkLeft > BLINK_THRESHOLD && blinkRight > BLINK_THRESHOLD;

        if (isBlinking) {
          if (!blinkStartTimeRef.current) {
            blinkStartTimeRef.current = Date.now();
          } else {
            const elapsed = Date.now() - blinkStartTimeRef.current;
            const BLINK_REQUIRED_TIME = 2000; // 2 Seconds
            
            // Visual feedback
            const progress = Math.min(100, (elapsed / BLINK_REQUIRED_TIME) * 100);
            setDwellProgress(progress);

            if (elapsed > BLINK_REQUIRED_TIME) {
              // ACTION TRIGGERED
              if (hoveredAnchorId) {
                 onTriggerAnchor(hoveredAnchorId);
              }
              // Reset
              blinkStartTimeRef.current = null; 
              setDwellProgress(0);
            }
          }
        } else {
          // Reset if eyes open
          blinkStartTimeRef.current = null;
          setDwellProgress(0);
        }
      }

      // 2. Eye Gaze Tracking Logic (Cursor)
      // Only move cursor if NOT blinking to prevent jitter
      if (!isBlinking && result.faceLandmarks && result.faceLandmarks.length > 0) {
        const landmarks = result.faceLandmarks[0];

        // Right Eye Indices (User's Right)
        const rightIrisId = 473;
        const rightEyeCorners = [33, 133, 160, 159, 158, 144, 145, 153];
        
        // Left Eye Indices (User's Left)
        const leftIrisId = 468;
        const leftEyeCorners = [362, 263, 387, 386, 385, 373, 374, 380];

        // Get relative ratios (0..1)
        const rightRatio = getEyeGazeRatio(landmarks, rightIrisId, rightEyeCorners);
        const leftRatio = getEyeGazeRatio(landmarks, leftIrisId, leftEyeCorners);

        // Average both eyes
        const avgRatioX = (rightRatio.x + leftRatio.x) / 2;
        const avgRatioY = (rightRatio.y + leftRatio.y) / 2;

        // --- MAPPING LOGIC ---
        // Eye movements are subtle. We need high gain.
        // Center is roughly 0.5, but varies by person. 
        // We assume 0.5 is "center screen".
        
        // Horizontal: Mirror it! (Looking left in mirror image = cursor left)
        // Ratio 0 = Left side of eye box (User's right). 
        // If I look to my left, iris moves to left side of eye box (ratio -> 0).
        // Since video is mirrored, left is left.
        
        const SENSITIVITY_X = 5.0; // High gain for subtle eye movements
        const SENSITIVITY_Y = 6.0; // Vertical is even harder
        
        // Center offsets (calibrate to average human eye)
        const CENTER_X = 0.5; 
        const CENTER_Y = 0.45; // Eyes usually sit slightly above center of iris box when looking straight

        // Apply gain
        // If avgRatioX is 0.4 (looking left), delta is -0.1. * 4 = -0.4. Screen X = 0.5 + (-0.4) = 0.1 (Left)
        let normalizedX = 0.5 + (avgRatioX - CENTER_X) * SENSITIVITY_X;
        let normalizedY = 0.5 + (avgRatioY - CENTER_Y) * SENSITIVITY_Y;

        // To make it usable, we blend it with Head Pose (Nose) slightly for stability
        // purely eye tracking on webcam is jittery.
        const nose = landmarks[1];
        const headX = 1 - nose.x; // Mirror head
        const headY = nose.y;

        // Mix: 70% Eye, 30% Head for stability + control
        const finalX = (normalizedX * 0.7 + headX * 0.3) * window.innerWidth;
        const finalY = (normalizedY * 0.7 + headY * 0.3) * window.innerHeight;

        // Clamp
        const clampedX = Math.max(0, Math.min(window.innerWidth, finalX));
        const clampedY = Math.max(0, Math.min(window.innerHeight, finalY));

        // Smooth (Low-pass filter)
        const SMOOTHING = 0.15;
        const smoothX = lastCursorRef.current.x + (clampedX - lastCursorRef.current.x) * SMOOTHING;
        const smoothY = lastCursorRef.current.y + (clampedY - lastCursorRef.current.y) * SMOOTHING;
        
        lastCursorRef.current = { x: smoothX, y: smoothY };
        setCursorPos({ x: smoothX, y: smoothY });
      }
    }
    requestRef.current = requestAnimationFrame(predictWebcam);
  }, [inputMode, hoveredAnchorId, onTriggerAnchor]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(predictWebcam);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [predictWebcam]);


  // Simulate SLAM Tracking via Mouse/Touch Drag
  const handleViewMove = useCallback((dx: number, dy: number) => {
    setViewState(prev => ({
      yaw: prev.yaw - dx * 0.1,
      pitch: Math.max(-45, Math.min(45, prev.pitch - dy * 0.1))
    }));
  }, []);

  // Handle Input Movement (The Cursor)
  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (inputMode === 'face') return; // Face mode overrides mouse for cursor

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
      
      // If right mouse button down, move camera (Simulate Head Movement)
      if ((e as React.MouseEvent).buttons === 2) {
        handleViewMove((e as React.MouseEvent).movementX, (e as React.MouseEvent).movementY);
      }
    }
    
    setCursorPos({ x: clientX, y: clientY });
  };

  // Prevent context menu for right-click navigation
  useEffect(() => {
    const preventContext = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', preventContext);
    return () => document.removeEventListener('contextmenu', preventContext);
  }, []);

  // Core SLAM Projection Logic: World (Yaw/Pitch) -> Screen (X/Y)
  const projectAnchor = useCallback((anchor: Anchor): ScreenPoint | null => {
    if (!containerRef.current) return null;
    
    const { width, height } = containerRef.current.getBoundingClientRect();
    const pixelsPerDegree = width / FOV;
    
    // Calculate relative angles
    let deltaYaw = anchor.yaw - viewState.yaw;
    let deltaPitch = anchor.pitch - viewState.pitch;
    
    // Wrap yaw to -180 to 180
    while (deltaYaw > 180) deltaYaw -= 360;
    while (deltaYaw < -180) deltaYaw += 360;

    // If out of FOV, don't render (or render off-screen)
    if (Math.abs(deltaYaw) > FOV / 1.5 || Math.abs(deltaPitch) > FOV / 1.5) {
      return null; 
    }

    const x = (width / 2) + (deltaYaw * pixelsPerDegree);
    const y = (height / 2) + (deltaPitch * pixelsPerDegree);
    
    return { x, y };
  }, [viewState]);

  // Snap Targeting & Hover Logic
  useEffect(() => {
    let bestDist = 1000;
    let snappedId: string | null = null;
    const SNAP_THRESHOLD = 80; // Pixels

    anchors.forEach(anchor => {
      const pos = projectAnchor(anchor);
      if (pos) {
        const dist = Math.sqrt(Math.pow(pos.x - cursorPos.x, 2) + Math.pow(pos.y - cursorPos.y, 2));
        if (dist < SNAP_THRESHOLD && dist < bestDist) {
          bestDist = dist;
          snappedId = anchor.id;
        }
      }
    });

    onUpdateCursor(cursorPos, snappedId);
    setHoveredAnchorId(snappedId);

    // Gaze (Time-based) Dwell Logic
    if (inputMode === 'gaze') {
      if (snappedId) {
        if (!dwellTimeoutRef.current) {
          setDwellProgress(0);
          const startTime = Date.now();
          const DWELL_TIME = 1500;
          
          const interval = window.setInterval(() => {
            const elapsed = Date.now() - startTime;
            setDwellProgress(Math.min(100, (elapsed / DWELL_TIME) * 100));
          }, 50);
          dwellIntervalRef.current = interval;

          dwellTimeoutRef.current = window.setTimeout(() => {
             if (dwellIntervalRef.current) {
                 clearInterval(dwellIntervalRef.current);
                 dwellIntervalRef.current = null;
             }
             onTriggerAnchor(snappedId!);
             setDwellProgress(0);
             dwellTimeoutRef.current = null;
          }, DWELL_TIME);
        }
      } else {
        if (dwellTimeoutRef.current) {
          if (dwellIntervalRef.current) {
              clearInterval(dwellIntervalRef.current);
              dwellIntervalRef.current = null;
          }
          clearTimeout(dwellTimeoutRef.current);
          dwellTimeoutRef.current = null;
          setDwellProgress(0);
        }
      }
    }

  }, [cursorPos, anchors, projectAnchor, inputMode, onUpdateCursor, onTriggerAnchor]);


  // Add Anchor Handler
  const handleAddAnchor = async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);

    let label = "Device";
    
    // Capture Frame for Gemini
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const base64 = canvasRef.current.toDataURL('image/jpeg', 0.6);
        label = await identifyAppliance(base64);
      }
    }

    const newAnchor: Anchor = {
      id: Math.random().toString(36).substr(2, 9),
      label: label,
      yaw: viewState.yaw, // Place at center of current view
      pitch: viewState.pitch,
      color: `hsl(${Math.random() * 360}, 70%, 50%)`
    };
    
    onAddAnchor(newAnchor);
    setIsAnalyzing(false);
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-gray-900 overflow-hidden cursor-none select-none"
      onMouseMove={handlePointerMove}
      onTouchMove={handlePointerMove}
      onClick={(e) => {
        if (hoveredAnchorId && inputMode !== 'gaze' && inputMode !== 'face') {
          onTriggerAnchor(hoveredAnchorId);
        }
      }}
    >
      {/* Video Feed */}
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${inputMode === 'face' ? 'opacity-100' : 'opacity-80'}`}
        style={{ transform: 'scaleX(-1)' }} // Mirror the video for natural interaction
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Grid Overlay to emphasize SLAM mapping */}
      <div className="absolute inset-0 pointer-events-none opacity-20" 
           style={{
             backgroundImage: 'linear-gradient(rgba(0, 255, 255, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 255, 0.3) 1px, transparent 1px)',
             backgroundSize: '100px 100px',
             backgroundPosition: `${-viewState.yaw * 10}px ${-viewState.pitch * 10}px` // Parallax effect
           }} 
      />

      {/* Render Anchors */}
      {anchors.map(anchor => {
        const pos = projectAnchor(anchor);
        if (!pos) return null;
        
        const isHovered = hoveredAnchorId === anchor.id;

        return (
          <div
            key={anchor.id}
            className={`absolute flex flex-col items-center justify-center transition-transform duration-200 ${isHovered ? 'scale-125 z-10' : 'scale-100 z-0'}`}
            style={{ 
              left: pos.x, 
              top: pos.y, 
              transform: 'translate(-50%, -50%)' 
            }}
          >
            {/* Snap Magnetic Field Visual */}
            <div className={`absolute rounded-full border-2 transition-all duration-300 ${isHovered ? 'w-24 h-24 border-white opacity-100' : 'w-16 h-16 border-white/30 opacity-0'}`} />
            
            {/* The Button Itself */}
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.5)] border-2 border-white"
              style={{ backgroundColor: anchor.color }}
            >
              <Zap className="text-white w-6 h-6" />
            </div>
            
            {/* Label */}
            <div className="mt-2 bg-black/60 px-3 py-1 rounded-full backdrop-blur-md border border-white/20">
              <span className="text-white text-xs font-bold uppercase tracking-wider">{anchor.label}</span>
            </div>

            {/* Gaze/Blink Dwell Indicator */}
            {((isHovered && inputMode === 'gaze') || (inputMode === 'face' && dwellProgress > 0)) && (
              <svg className="absolute w-28 h-28 -rotate-90 pointer-events-none">
                <circle
                  cx="56" cy="56" r="50"
                  fill="none"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="4"
                />
                <circle
                  cx="56" cy="56" r="50"
                  fill="none"
                  stroke={inputMode === 'face' ? '#4f46e5' : 'white'} // Purple for blink, White for gaze
                  strokeWidth="4"
                  strokeDasharray="314"
                  strokeDashoffset={314 - (314 * dwellProgress) / 100}
                  className="transition-all duration-100 ease-linear"
                />
              </svg>
            )}
          </div>
        );
      })}

      {/* Setup Mode Overlay */}
      {mode === 'setup' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 border-2 border-dashed border-yellow-400 rounded-full opacity-50 flex items-center justify-center">
            <Plus className="text-yellow-400 w-6 h-6 animate-pulse" />
          </div>
          <div className="absolute bottom-32 bg-black/70 text-white px-4 py-2 rounded-lg text-sm backdrop-blur">
            {isAnalyzing ? "Analyzing scene with Gemini..." : "Center appliance & tap 'Add Anchor'"}
          </div>
        </div>
      )}

      {/* Controls Overlay */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4 px-4 pointer-events-auto">
        {mode === 'setup' ? (
          <button 
            onClick={handleAddAnchor}
            disabled={isAnalyzing}
            className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black px-8 py-4 rounded-2xl shadow-lg font-bold text-lg disabled:opacity-50 transition-all active:scale-95"
          >
            {isAnalyzing ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <Plus className="w-6 h-6" />
            )}
            Add Anchor
          </button>
        ) : (
          <div className="bg-black/80 backdrop-blur-md p-2 rounded-2xl flex gap-2 border border-white/10 overflow-x-auto">
            <div 
              onClick={() => (onUpdateCursor({x:0,y:0}, null), (window as any).setInputMode?.('pointer'))} 
              className={`cursor-pointer px-4 py-2 rounded-xl text-white font-medium text-sm flex items-center gap-2 whitespace-nowrap ${inputMode === 'pointer' ? 'bg-indigo-600' : 'opacity-50'}`}
            >
              <MousePointer2 size={16} /> Pointer
            </div>
            <div 
              onClick={() => (window as any).setInputMode?.('gaze')}
              className={`cursor-pointer px-4 py-2 rounded-xl text-white font-medium text-sm flex items-center gap-2 whitespace-nowrap ${inputMode === 'gaze' ? 'bg-indigo-600' : 'opacity-50'}`}
            >
              <Eye size={16} /> Gaze (Time)
            </div>
             <div 
              onClick={() => (window as any).setInputMode?.('face')}
              className={`cursor-pointer px-4 py-2 rounded-xl text-white font-medium text-sm flex items-center gap-2 whitespace-nowrap ${inputMode === 'face' ? 'bg-indigo-600' : 'opacity-50'}`}
            >
              {isFaceModelLoading ? <span className="animate-spin text-xs">⌛</span> : <ScanFace size={16} />} 
              Face + Blink
            </div>
          </div>
        )}
      </div>

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent pointer-events-auto">
        <div>
          <h1 className="text-white font-bold text-xl tracking-tight">SpatialLink <span className="text-indigo-400">AR</span></h1>
          <p className="text-white/60 text-xs">Simulated SLAM • Gemini Powered</p>
        </div>
        <div className="flex gap-2">
           {/* Hint for Desktop simulation */}
           <div className="hidden md:flex items-center gap-1 bg-white/10 px-2 py-1 rounded text-xs text-white/70 mr-2">
              <Move size={12} />
              <span>Right-Click + Drag to Rotate View</span>
           </div>
        </div>
      </div>
    </div>
  );
};