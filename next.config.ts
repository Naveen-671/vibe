// import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   /* config options here */
//   // eslint: {
//   //   ignoreDuringBuilds: true
//   // }
// };

// export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // For general-purpose, high-quality stock photos
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "cdn.pixabay.com" },

      // For business and e-commerce focused images
      { protocol: "https", hostname: "burst.shopify.com" },

      // For stock photos, vectors, and illustrations
      { protocol: "https", hostname: "img.freepik.com" },

      // For developer content, like avatars or images in repos
      { protocol: "https", hostname: "raw.githubusercontent.com" }
    ]
  }
  // eslint: {
  //   ignoreDuringBuilds: true
  // }
};

export default nextConfig;
