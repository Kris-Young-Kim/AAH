"use client";

/**
 * WebGazer 훅: 시선 추적 기능
 * 
 * 보안: 시선 데이터는 클라이언트 메모리 내에서만 처리되며 서버로 전송되지 않습니다.
 * 모든 데이터는 로컬 상태(useStore)에만 저장되며, 네트워크를 통해 전송되지 않습니다.
 */

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

// WebGazer 로드: CDN 또는 로컬 파일 선택 가능
// 로컬 파일 사용 시: "/docs/webgaze.js" 또는 빌드된 경로 사용
const WEBGAZER_SRC =
  "https://cdn.jsdelivr.net/npm/webgazer/dist/webgazer.min.js";
// 로컬 파일 사용 시 주석 해제:
// const WEBGAZER_SRC = "/docs/webgaze.js";

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
    // Lazy load: 스크립트 로드 지연
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
    // 탭 비활성 시 pause 처리: 성능 최적화 및 배터리 절약
    const onVisibilityChange = () => {
      if (!window.webgazer) return;
      if (document.hidden) {
        window.webgazer.pause();
        console.log("[webgazer] 탭 비활성, pause");
      } else {
        window.webgazer.resume?.();
        console.log("[webgazer] 탭 활성, resume");
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

