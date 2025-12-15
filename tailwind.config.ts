import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        // 디자인 시스템 컬러 팔레트 (예시 - 프로젝트에 맞게 수정 필요)
        gray: {
          10: "#FFFFFF",
          20: "#F5F5F5",
          30: "#E5E5E5",
          40: "#D4D4D4",
          50: "#A3A3A3",
          60: "#737373",
          70: "#525252",
          80: "#404040",
          90: "#262626",
          100: "#171717",
        },
        beige: {
          10: "#FEFEFE",
          20: "#F9F9F7",
          30: "#F5F5F0",
          40: "#E8E8E0",
          50: "#D4D4C8",
          60: "#B8B8A8",
          70: "#9C9C88",
          80: "#808068",
          90: "#646448",
          100: "#484828",
        },
      },
      fontSize: {
        "display-1": ["60px", { lineHeight: "1.2", fontWeight: "700" }],
        "display-2": ["44px", { lineHeight: "1.2", fontWeight: "700" }],
        h1: ["40px", { lineHeight: "1.3", fontWeight: "700" }],
        h2: ["32px", { lineHeight: "1.3", fontWeight: "700" }],
        "body-0": ["24px", { lineHeight: "1.5" }],
        "body-1": ["19px", { lineHeight: "1.5" }],
        "body-2": ["17px", { lineHeight: "1.5" }],
        "body-2-bold": ["17px", { lineHeight: "1.5", fontWeight: "700" }],
      },
      borderColor: {
        DEFAULT: "hsl(var(--border))",
        border: "hsl(var(--border))",
      },
    },
  },
  plugins: [],
  darkMode: "class",
};

export default config;
