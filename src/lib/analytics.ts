/**
 * Analytics 유틸리티
 * 
 * 주요 액션 이벤트를 추적합니다.
 * 현재는 콘솔 로깅을 사용하며, 향후 Google Analytics, PostHog, Vercel Analytics 등으로 확장 가능합니다.
 */

export type AnalyticsEvent =
  | {
      name: "user_synced";
      properties: {
        clerkUserId: string;
        isNewUser: boolean;
      };
    }
  | {
      name: "device_saved";
      properties: {
        deviceName: string;
        iconType: string;
        position: { x: number; y: number; z: number };
      };
    }
  | {
      name: "device_toggled";
      properties: {
        deviceId: string;
        deviceName: string;
        isActive: boolean;
      };
    }
  | {
      name: "device_deleted";
      properties: {
        deviceId: string;
        deviceName: string;
      };
    }
  | {
      name: "calibration_completed";
      properties: {
        accuracy: number;
        pointCount: number;
      };
    }
  | {
      name: "calibration_started";
      properties: {};
    }
  | {
      name: "device_clicked";
      properties: {
        deviceId: string;
        deviceName: string;
        method: "dwell" | "manual";
      };
    };

/**
 * Analytics 이벤트 전송
 * 
 * @param event 이벤트 이름 및 속성
 */
export function trackEvent(event: AnalyticsEvent): void {
  // 콘솔 로깅 (개발 환경)
  if (process.env.NODE_ENV === "development") {
    console.log("[analytics]", event.name, event.properties);
  }

  // 향후 확장: Google Analytics, PostHog, Vercel Analytics 등
  // 예시:
  // if (window.gtag) {
  //   window.gtag("event", event.name, event.properties);
  // }
  // if (window.posthog) {
  //   window.posthog.capture(event.name, event.properties);
  // }
}

