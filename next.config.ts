
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // domains is the simplest and most reliable way
    domains: [
      "images.unsplash.com",
      "images.pexels.com",
      "cdn.pixabay.com",
      "burst.shopify.com",
      "img.freepik.com",
      "raw.githubusercontent.com"
    ],
    // keep remotePatterns too if you used them earlier
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "cdn.pixabay.com" },
      { protocol: "https", hostname: "burst.shopify.com" },
      { protocol: "https", hostname: "img.freepik.com" },
      { protocol: "https", hostname: "raw.githubusercontent.com" }
    ],
    // optional: during dev only, you can allow Next to skip optimization (see alt below)
    // unoptimized: false
  }
};

module.exports = nextConfig;
