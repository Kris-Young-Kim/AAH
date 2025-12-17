import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserInfo } from "../actions";

export default async function AccessPage() {
  const user = await currentUser();
  if (!user) {
    redirect("/sign-in");
  }

  let userInfo;
  try {
    userInfo = await getUserInfo({ clerkUserId: user.id });
  } catch (error: any) {
    // CHECK constraint 위반 시 기본값 사용
    console.error("[access] getUserInfo 실패, 기본값 사용", error);
    userInfo = null;
  }

  // input_mode 값 검증 및 기본값 설정
  const validInputModes = ["eye", "mouse", "switch", "voice"] as const;
  const inputMode = userInfo?.input_mode && validInputModes.includes(userInfo.input_mode as any)
    ? (userInfo.input_mode as "eye" | "mouse" | "switch" | "voice")
    : "mouse";

  // 입력 방식에 따라 해당 페이지로 리다이렉트
  redirect(`/access/${inputMode}`);
}

