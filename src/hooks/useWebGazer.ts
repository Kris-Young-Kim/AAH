"use client";

/**
 * WebGazer 훅: 시선 추적 기능
 * 
 * 보안: 시선 데이터는 클라이언트 메모리 내에서만 처리되며 서버로 전송되지 않습니다.
 * 모든 데이터는 로컬 상태(useStore)에만 저장되며, 네트워크를 통해 전송되지 않습니다.
 */

import { useCallback, useEffect, useRef } from "react";
import { useStore } from "./useStore";

// 캘리브레이션 상태를 확인하기 위한 전역 상태
let isCalibrating = false;
export function setCalibrationMode(calibrating: boolean) {
  isCalibrating = calibrating;
}

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
  const webgazerLoadedRef = useRef(false);
  const webgazerInitializedRef = useRef(false);

  const applySmoothing = useCallback((x: number, y: number) => {
    // 초기값이 0이면 바로 설정 (스무딩 없이)
    if (smoothX.current === 0 && smoothY.current === 0) {
      smoothX.current = x;
      smoothY.current = y;
      setGaze({ x: smoothX.current, y: smoothY.current });
      return;
    }
    
    // 캘리브레이션 중일 때는 더 강한 스무딩 적용 (부드러움)
    // 일반 모드에서는 빠른 반응성 유지
    const alpha = isCalibrating ? 0.08 : 0.4; // 캘리브레이션: 0.08 (매우 부드러움), 일반: 0.4 (빠른 반응)
    
    smoothX.current = smoothX.current * (1 - alpha) + x * alpha;
    smoothY.current = smoothY.current * (1 - alpha) + y * alpha;
    
    setGaze({ x: smoothX.current, y: smoothY.current });
  }, [setGaze]);

  const startWebGazer = useCallback(async () => {
    if (!window.webgazer) {
      console.warn("[webgazer] 아직 로드되지 않았습니다.");
      return false;
    }

    if (webgazerInitializedRef.current) {
      console.log("[webgazer] 이미 초기화되었습니다.");
      return true;
    }

    try {
      console.log("[webgazer] 초기화 시작");
      window.webgazer.saveDataAcrossSessions = false;
      // 디버깅을 위해 비디오 프리뷰와 예측 포인트 표시 (선택적)
      window.webgazer.showVideoPreview(false);
      window.webgazer.showPredictionPoints(false);
      // ridge 회귀 모델 사용 (더 정확함)
      window.webgazer.setRegression("ridge");
      
      // gaze listener 설정
      window.webgazer.setGazeListener((data) => {
        if (!data) {
          return;
        }
        // 스무딩 적용하여 부드러운 추적
        applySmoothing(data.x, data.y);
      });
      
      await window.webgazer.begin();
      webgazerInitializedRef.current = true;
      setSensorReady(true);
      console.log("[webgazer] 시작 완료");
      return true;
    } catch (err: any) {
      console.error("[webgazer] 시작 실패", err);
      if (err.name === "NotAllowedError") {
        console.error("[webgazer] 웹캠 권한이 거부되었습니다.");
        throw new Error("웹캠 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.");
      }
      setSensorReady(false);
      throw err;
    }
  }, [applySmoothing, setSensorReady]);

  useEffect(() => {
    let mounted = true;
    const script = document.createElement("script");
    script.src = WEBGAZER_SRC;
    script.async = true;
    // Lazy load: 스크립트 로드만 하고 시작하지 않음
    script.onload = () => {
      if (!mounted || !window.webgazer) return;
      console.log("[webgazer] 스크립트 로드 완료 (시작 대기 중)");
      webgazerLoadedRef.current = true;
      // 자동 시작하지 않음 - 사용자가 버튼을 클릭할 때까지 대기
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
      if (window.webgazer && webgazerInitializedRef.current) {
        window.webgazer.pause();
      }
      script.remove();
    };
  }, [applySmoothing, setSensorReady]);

  return {
    startWebGazer,
    isLoaded: webgazerLoadedRef.current,
    isReady: webgazerInitializedRef.current,
  };
}

