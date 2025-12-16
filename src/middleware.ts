import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher(["/admin(.*)", "/access(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  // HTTP 431 오류 방지: handshake 토큰이 쿼리 파라미터로 전달되는 경우 즉시 처리
  // URL 길이 체크 없이 handshake 토큰이 있으면 무조건 제거 (431 오류 예방)
  const url = req.nextUrl.clone();
  const hasHandshake = url.searchParams.has("__clerk_handshake");
  
  if (hasHandshake) {
    // handshake 토큰을 쿼리 파라미터에서 제거
    // Clerk는 쿠키를 통해 인증을 처리하므로 쿼리 파라미터가 없어도 작동함
    url.searchParams.delete("__clerk_handshake");
    
    // 무한 리다이렉트 방지: 리다이렉트 헤더에 플래그 추가
    const response = NextResponse.redirect(url);
    
    // 리다이렉트가 이미 발생했는지 확인하기 위한 쿠키 설정
    // (무한 루프 방지)
    const redirectCount = req.cookies.get("__clerk_redirect_count")?.value || "0";
    const count = parseInt(redirectCount, 10);
    
    if (count < 3) {
      // 최대 3번까지만 리다이렉트 허용
      response.cookies.set("__clerk_redirect_count", String(count + 1), {
        httpOnly: true,
        maxAge: 10, // 10초 후 만료
        path: "/",
      });
      return response;
    } else {
      // 리다이렉트가 너무 많이 발생하면 쿠키 삭제하고 루트로 이동
      response.cookies.delete("__clerk_redirect_count");
      const rootUrl = new URL("/", req.url);
      return NextResponse.redirect(rootUrl);
    }
  }

  // 리다이렉트 카운터 초기화 (handshake가 없으면 정상 요청)
  if (req.cookies.has("__clerk_redirect_count")) {
    const response = NextResponse.next();
    response.cookies.delete("__clerk_redirect_count");
    if (isProtectedRoute(req)) {
      await auth.protect();
    }
    return response;
  }

  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};