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
  // spatiallink-ar 폴더는 별도 프로젝트이므로 빌드에서 제외
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        '**/spatiallink-ar/**',
        '**/WebGazer-master/**',
        '**/docs/three.js-master/**',
        // Windows 시스템 파일 제외 (Watchpack 오류 방지)
        // 참고: 이 파일들은 프로젝트 외부에 있지만 Watchpack이 접근 시도함
        '**/DumpStack.log.tmp',
        '**/hiberfil.sys',
        '**/pagefile.sys',
        '**/swapfile.sys',
      ],
    };
    return config;
  },
  // TypeScript 컴파일에서 제외
  typescript: {
    ignoreBuildErrors: false,
  },
}

module.exports = nextConfig
