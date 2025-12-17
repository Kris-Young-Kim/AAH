import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { listDevices, getUserInfo, listRoutines } from "../actions";
import AdminClient from "./client";

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) {
    redirect("/sign-in");
  }

  // 모든 데이터베이스 호출을 안전하게 처리
  let devices = [];
  try {
    devices = (await listDevices({ clerkUserId: user.id })) ?? [];
  } catch (error: any) {
    console.error("[admin] listDevices 실패, 빈 배열 사용", error);
    devices = [];
  }

  let userInfo = null;
  try {
    userInfo = await getUserInfo({ clerkUserId: user.id });
  } catch (error: any) {
    // CHECK constraint 위반 시 기본값 사용
    console.error("[admin] getUserInfo 실패, 기본값 사용", error);
    userInfo = null;
  }

  let routines = [];
  try {
    routines = (await listRoutines({ clerkUserId: user.id })) ?? [];
  } catch (error: any) {
    console.error("[admin] listRoutines 실패, 빈 배열 사용", error);
    routines = [];
  }

  // input_mode 값 검증 및 기본값 설정
  const validInputModes = ["eye", "mouse", "switch", "voice"] as const;
  const inputMode = userInfo?.input_mode && validInputModes.includes(userInfo.input_mode as any)
    ? (userInfo.input_mode as "eye" | "mouse" | "switch" | "voice")
    : "mouse";

  return (
    <AdminClient
      clerkUserId={user.id}
      initialDevices={devices}
      currentInputMode={inputMode}
      initialRoutines={(routines as any) ?? []}
    />
  );
}

