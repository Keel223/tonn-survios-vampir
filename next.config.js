/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  
  // МАГИЯ ЗДЕСЬ: Эта настройка говорит Next.js, что '@/' означает корень проекта
  experimental: {
    typedRoutes: true,
  },
}

module.exports = nextConfig
