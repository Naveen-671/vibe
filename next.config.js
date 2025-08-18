
// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   images: {
//     // domains is the simplest and most reliable way
//     domains: [
//       "images.unsplash.com",
//       "images.pexels.com",
//       "cdn.pixabay.com",
//       "burst.shopify.com",
//       "img.freepik.com",
//       "raw.githubusercontent.com"
//     ],
//     // keep remotePatterns too if you used them earlier
//     remotePatterns: [
//       { protocol: "https", hostname: "images.unsplash.com" },
//       { protocol: "https", hostname: "images.pexels.com" },
//       { protocol: "https", hostname: "cdn.pixabay.com" },
//       { protocol: "https", hostname: "burst.shopify.com" },
//       { protocol: "https", hostname: "img.freepik.com" },
//       { protocol: "https", hostname: "raw.githubusercontent.com" }
//     ],
//     // optional: during dev only, you can allow Next to skip optimization (see alt below)
//     // unoptimized: false
//   }
// };

// module.exports = nextConfig;

// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   images: {
//     // Use remotePatterns with URL objects (recommended for Next >= 15.3.0)
//     remotePatterns: [
//       new URL("https://images.unsplash.com/**"),
//       new URL("https://images.pexels.com/**"),
//       new URL("https://cdn.pixabay.com/**"),
//       new URL("https://burst.shopify.com/**"),
//       new URL("https://img.freepik.com/**"),
//       new URL("https://raw.githubusercontent.com/**")
//     ]
//     // alternatively you can also include `domains: [...]` for older compatibility
//     // domains: ["images.unsplash.com", "images.pexels.com", ...]
//   }
// };

// // module.exports = nextConfig;
// export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // keep `domains` for simplicity + `remotePatterns` for stricter matching
    domains: [
      "images.unsplash.com",
      "images.pexels.com",
      "cdn.pixabay.com",
      "burst.shopify.com",
      "img.freepik.com",
      "raw.githubusercontent.com"
    ],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "images.pexels.com", pathname: "/**" },
      { protocol: "https", hostname: "cdn.pixabay.com", pathname: "/**" },
      { protocol: "https", hostname: "burst.shopify.com", pathname: "/**" },
      { protocol: "https", hostname: "img.freepik.com", pathname: "/**" },
      { protocol: "https", hostname: "raw.githubusercontent.com", pathname: "/**" }
    ]
  }
};

module.exports = nextConfig;
