import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher(["/admin(.*)", "/access(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const url = req.nextUrl.clone();
  const searchParams = new URLSearchParams(url.search);
  
  // HTTP 431 오류 방지: URL이 너무 길거나 handshake 토큰이 있으면 처리
  const urlLength = req.url.length;
  const hasHandshake = searchParams.has("__clerk_handshake");
  const MAX_URL_LENGTH = 2000; // 안전한 URL 길이 제한
  
  // URL이 너무 길거나 handshake 토큰이 있으면 쿼리 파라미터 제거
  if (urlLength > MAX_URL_LENGTH || hasHandshake) {
    // 모든 쿼리 파라미터 제거 (handshake 포함)
    url.search = "";
    
    // 무한 리다이렉트 방지
    const redirectCount = req.cookies.get("__clerk_redirect_count")?.value || "0";
    const count = parseInt(redirectCount, 10);
    
    if (count < 2) {
      // 최대 2번까지만 리다이렉트 허용
      const response = NextResponse.redirect(url);
      response.cookies.set("__clerk_redirect_count", String(count + 1), {
        httpOnly: true,
        maxAge: 5, // 5초 후 만료
        path: "/",
      });
      return response;
    } else {
      // 리다이렉트가 너무 많이 발생하면 쿠키 삭제하고 루트로 이동
      const rootUrl = new URL("/", req.url);
      const response = NextResponse.redirect(rootUrl);
      response.cookies.delete("__clerk_redirect_count");
      return response;
    }
  }

  // 리다이렉트 카운터 초기화 (정상 요청)
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