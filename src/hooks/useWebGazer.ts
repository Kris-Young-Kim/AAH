"use client";

import { useCallback, useEffect, useRef } from "react";
import { useStore } from "./useStore";

declare global {
  interface Window {
    webgazer?: {
      setRegression: (model: string) => any;
      setGazeListener: (
        listener: (data: { x: number; y: number } | null) => void
      ) => any;
      begin: () => Promise<void>;
      pause: () => void;
      resume: () => void;
      end: () => Promise<void>;
      saveDataAcrossSessions: boolean;
      showVideoPreview: (flag: boolean) => any;
      showPredictionPoints: (flag: boolean) => any;
    };
  }
}

const WEBGAZER_SRC =
  "https://cdn.jsdelivr.net/npm/webgazer/dist/webgazer.min.js";

export function useWebGazer() {
  const setGaze = useStore((s) => s.setGaze);
  const setSensorReady = useStore((s) => s.setSensorReady);
  const rafRef = useRef<number | null>(null);
  const smoothX = useRef(0);
  const smoothY = useRef(0);

  const applySmoothing = useCallback((x: number, y: number) => {
    const alpha = 0.2; // 이동 평균
    smoothX.current = smoothX.current * (1 - alpha) + x * alpha;
    smoothY.current = smoothY.current * (1 - alpha) + y * alpha;
    setGaze({ x: smoothX.current, y: smoothY.current });
  }, [setGaze]);

  useEffect(() => {
    let mounted = true;
    const script = document.createElement("script");
    script.src = WEBGAZER_SRC;
    script.async = true;
    script.onload = async () => {
      if (!mounted || !window.webgazer) return;
      console.log("[webgazer] loaded");
      window.webgazer.saveDataAcrossSessions = false;
      window.webgazer.showVideoPreview(false);
      window.webgazer.showPredictionPoints(false);
      window.webgazer.setRegression("ridge");
      window.webgazer.setGazeListener((data) => {
        if (!data) return;
        applySmoothing(data.x, data.y);
      });
      await window.webgazer.begin();
      setSensorReady(true);
    };
    script.onerror = (err) => {
      console.error("[webgazer] load error", err);
    };
    document.body.appendChild(script);

    const rafIdOnCleanup = rafRef.current;
    const onVisibilityChange = () => {
      if (!window.webgazer) return;
      if (document.hidden) {
        window.webgazer.pause();
      } else {
        window.webgazer.resume?.();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (rafIdOnCleanup) cancelAnimationFrame(rafIdOnCleanup);
      if (window.webgazer) {
        window.webgazer.pause();
      }
      script.remove();
    };
  }, [applySmoothing, setSensorReady]);
}

