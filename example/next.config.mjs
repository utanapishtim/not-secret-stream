/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  webpack: (config, { isServer }) => {
      config.resolve.alias = {
        ...config.resolve.alias,
        'sodium-native': 'sodium-javascript',
      }
    return config
  },
}

export default nextConfig;
