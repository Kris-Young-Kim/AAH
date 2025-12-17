"use client";

import Link from "next/link";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex justify-between items-center p-6">
        <div className="flex items-center gap-2 text-body-2-bold">
          <span className="text-h2">All-Access Home</span>
        </div>
        <div className="flex items-center gap-3">
          <SignedOut>
            <SignInButton>
              <button className="h-10 px-4 rounded-full border border-gray-300 hover:bg-gray-100 transition">
                로그인
              </button>
            </SignInButton>
            <SignUpButton>
              <button className="h-10 px-4 rounded-full bg-black text-white hover:opacity-90 transition">
                회원가입
              </button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </div>
      </header>

      <main className="flex-1 px-6 md:px-10 pb-10 flex flex-col gap-8">
        <section className="max-w-3xl space-y-3">
          <h1 className="text-display-2">공간을 읽고, 당신의 자립을 켜다</h1>
          <p className="text-body-1 text-gray-600 dark:text-gray-300">
            고가의 장비 없이 웹캠과 센서만으로 가전을 제어하는 보조공학 플랫폼입니다.
            보호자가 버튼을 배치하면, 사용자는 시선, 마우스, 스위치, 음성 등 자신에게 맞는 방법으로 제어할 수 있습니다.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 max-w-4xl">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-3">
            <h3 className="text-h2">관리자 모드</h3>
            <p className="text-body-2 text-gray-600 dark:text-gray-300">
              카메라를 비추며 기기(전등, TV 등) 위치에 가상 버튼을 배치하세요.
              저장하면 실시간으로 사용자 화면에 반영됩니다.
            </p>
            <Link
              href="/admin"
              className="inline-flex h-11 items-center justify-center rounded-full bg-black text-white px-4 hover:opacity-90 transition"
            >
              /admin 열기
            </Link>
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-3">
            <h3 className="text-h2">사용자 모드</h3>
            <p className="text-body-2 text-gray-600 dark:text-gray-300">
              공간에 배치된 버튼을 시선, 마우스, 스위치, 음성 등 자신에게 맞는 방법으로 제어합니다.
              간단한 설정만으로 시작할 수 있습니다.
            </p>
            <Link
              href="/access"
              className="inline-flex h-11 items-center justify-center rounded-full border border-gray-400 px-4 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              /access 열기
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
