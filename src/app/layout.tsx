import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import Providers from "@/providers";
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
    <ClerkProvider>
      <html lang="ko" suppressHydrationWarning>
        <body className="antialiased bg-background text-foreground">
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
