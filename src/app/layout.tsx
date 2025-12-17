import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import Providers from "@/providers";
import SyncUser from "@/components/sync-user";
import "./globals.css";

export const metadata: Metadata = {
  title: "All-Access Home",
  description:
    "시선·멀티모달 입력으로 공간을 제어하는 All-Access Home MVP (Next.js 15)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      // HTTP 431 오류 방지: handshake를 쿠키로만 처리하도록 설정
      // 쿼리 파라미터로 handshake를 전달하지 않도록 함
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      // Clock skew 허용: 시스템 시계가 약간 불일치해도 허용 (개발 환경)
      // 5분(300초)까지 허용
      clockSkewInMs={300000}
    >
      <html lang="ko" suppressHydrationWarning>
        <body className="antialiased bg-background text-foreground">
          <Providers>
            <SyncUser />
            {children}
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
