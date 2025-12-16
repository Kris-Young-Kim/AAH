/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

/**
 * Lightweight 9-point calibration helper adapted from `WebGazer-master/www/calibration.js`.
 * - Renders 9 calibration points overlay.
 * - Each point requires `requiredClicks` hits (default 5); turns yellow when done.
 * - After all points complete, attempts to read stored points from WebGazer for a simple accuracy metric.
 * - Automatically pauses WebGazer on tab hide.
 *
 * Note: This does not alter the underlying WebGazer model; it provides UI + basic accuracy estimation
 * that can be wired to higher-level flows (e.g., showing a modal to the user).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";

type CalibrationStatus = "idle" | "running" | "completed";

interface CalibrationPoint {
  id: string;
  x: number;
  y: number;
  hits: number;
  done: boolean;
}

interface UseWebGazerCalibrationOptions {
  requiredClicks?: number;
  containerId?: string;
}

export function useWebGazerCalibration(
  options: UseWebGazerCalibrationOptions = {}
) {
  const { requiredClicks = 5, containerId = "webgazer-calibration-overlay" } =
    options;

  const [status, setStatus] = useState<CalibrationStatus>("idle");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const pointsRef = useRef<Record<string, CalibrationPoint>>({});
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const requiredRef = useRef(requiredClicks);

  const basePoints = useMemo<CalibrationPoint[]>(() => {
    const positions = [
      { x: 15, y: 15 },
      { x: 50, y: 15 },
      { x: 85, y: 15 },
      { x: 15, y: 50 },
      { x: 50, y: 50 },
      { x: 85, y: 50 },
      { x: 15, y: 85 },
      { x: 50, y: 85 },
      { x: 85, y: 85 },
    ];
    return positions.map((p, idx) => ({
      id: `pt${idx + 1}`,
      x: p.x,
      y: p.y,
      hits: 0,
      done: false,
    }));
  }, []);

  const resetPoints = useCallback(() => {
    pointsRef.current = Object.fromEntries(
      basePoints.map((p) => [p.id, { ...p }])
    );
  }, [basePoints]);

  const destroyOverlay = useCallback(() => {
    if (overlayRef.current) {
      overlayRef.current.remove();
      overlayRef.current = null;
    }
  }, []);

  const updateAccuracy = useCallback(() => {
    const stored = (window as any).webgazer?.getStoredPoints?.();
    if (!stored || !stored.length) {
      setAccuracy(null);
      return;
    }
    // Simple dispersion metric: average distance from mean.
    const mean =
      stored.reduce(
        (acc: [number, number], p: [number, number]) => [
          acc[0] + p[0],
          acc[1] + p[1],
        ],
        [0, 0]
      ) ?? [0, 0];
    mean[0] /= stored.length;
    mean[1] /= stored.length;
    const avgDist =
      stored.reduce((acc: number, p: [number, number]) => {
        const dx = p[0] - mean[0];
        const dy = p[1] - mean[1];
        return acc + Math.sqrt(dx * dx + dy * dy);
      }, 0) / stored.length;
    const finalAccuracy = Number.isFinite(avgDist) ? avgDist : null;
    setAccuracy(finalAccuracy);
    return finalAccuracy;
  }, []);

  const renderOverlay = useCallback(() => {
    destroyOverlay();
    const overlay = document.createElement("div");
    overlay.id = containerId;
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "9999";
    overlay.style.pointerEvents = "none";

    const points = Object.values(pointsRef.current);
    points.forEach((p) => {
      const btn = document.createElement("button");
      btn.id = p.id;
      btn.style.position = "absolute";
      btn.style.left = `${p.x}%`;
      btn.style.top = `${p.y}%`;
      btn.style.transform = "translate(-50%, -50%)";
      btn.style.width = "32px";
      btn.style.height = "32px";
      btn.style.borderRadius = "9999px";
      btn.style.border = "2px solid #fff";
      btn.style.background = "red";
      btn.style.opacity = "0.6";
      btn.style.pointerEvents = "auto";
      btn.style.cursor = "pointer";
      btn.title = `Calibration point ${p.id}`;

      btn.onclick = () => {
        const next = pointsRef.current[p.id];
        if (!next || next.done) return;
        next.hits += 1;
        if (next.hits >= requiredRef.current) {
          next.done = true;
          btn.style.background = "yellow";
          btn.disabled = true;
          btn.style.opacity = "0.9";
        } else {
          const opacity = 0.2 * next.hits + 0.2;
          btn.style.opacity = opacity.toString();
        }
        const allDone = Object.values(pointsRef.current).every((pt) => pt.done);
        if (allDone) {
          setStatus("completed");
          const pointCount = Object.keys(pointsRef.current).length;
          const finalAccuracy = updateAccuracy();
          // 정확도 이벤트 전송
          trackEvent({
            name: "calibration_completed",
            properties: {
              accuracy: finalAccuracy ?? 0,
              pointCount,
            },
          });
          setTimeout(() => destroyOverlay(), 300);
        }
      };

      overlay.appendChild(btn);
    });

    document.body.appendChild(overlay);
    overlayRef.current = overlay;
  }, [containerId, destroyOverlay, updateAccuracy]);

  const startCalibration = useCallback(() => {
    resetPoints();
    setAccuracy(null);
    setStatus("running");
    renderOverlay();
    trackEvent({
      name: "calibration_started",
      properties: {},
    });
  }, [renderOverlay, resetPoints]);

  const reset = useCallback(() => {
    resetPoints();
    setAccuracy(null);
    setStatus("idle");
    destroyOverlay();
  }, [destroyOverlay, resetPoints]);

  // Pause WebGazer when the tab is hidden, resume on show.
  useEffect(() => {
    const onVisibilityChange = () => {
      const wg = (window as any).webgazer;
      if (!wg) return;
      if (document.hidden) {
        wg.pause?.();
      } else {
        wg.resume?.();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return {
    status,
    accuracy,
    startCalibration,
    resetCalibration: reset,
  };
}

