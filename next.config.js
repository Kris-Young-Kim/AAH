/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
    remotePatterns: [],
  },
  // HTTP 헤더 크기 제한 관련 설정
  // Next.js는 기본적으로 헤더 크기 제한이 있지만, 개발 환경에서 Clerk handshake 토큰이
  // 쿼리 파라미터로 전달될 때 URL이 너무 길어질 수 있습니다.
  // 이 문제는 주로 브라우저 쿠키를 삭제하거나 개발 서버를 재시작하면 해결됩니다.
  experimental: {
    // 서버 컴포넌트 최적화
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

module.exports = nextConfig
