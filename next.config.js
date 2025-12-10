
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

// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   images: {
//     // keep `domains` for simplicity + `remotePatterns` for stricter matching
//     domains: [
//       "images.unsplash.com",
//       "images.pexels.com",
//       "cdn.pixabay.com",
//       "burst.shopify.com",
//       "img.freepik.com",
//       "raw.githubusercontent.com"
//     ],
//     remotePatterns: [
//       { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
//       { protocol: "https", hostname: "images.pexels.com", pathname: "/**" },
//       { protocol: "https", hostname: "cdn.pixabay.com", pathname: "/**" },
//       { protocol: "https", hostname: "burst.shopify.com", pathname: "/**" },
//       { protocol: "https", hostname: "img.freepik.com", pathname: "/**" },
//       { protocol: "https", hostname: "raw.githubusercontent.com", pathname: "/**" }
//     ]
//   }
// };

// module.exports = nextConfig;

// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   images: {
//     // keep `domains` for simplicity + `remotePatterns` for stricter matching
//     domains: [
//       "images.unsplash.com",
//       "images.pexels.com",
//       "cdn.pixabay.com",
//       "burst.shopify.com",
//       "img.freepik.com",
//       "raw.githubusercontent.com",
//       // UploadThing host (add your actual app-id host here)
//       "ry3iz5q2f6.ufs.sh"
//     ],
//     remotePatterns: [
//       { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
//       { protocol: "https", hostname: "images.pexels.com", pathname: "/**" },
//       { protocol: "https", hostname: "cdn.pixabay.com", pathname: "/**" },
//       { protocol: "https", hostname: "burst.shopify.com", pathname: "/**" },
//       { protocol: "https", hostname: "img.freepik.com", pathname: "/**" },
//       { protocol: "https", hostname: "raw.githubusercontent.com", pathname: "/**" },
//       // allow UploadThing UFS host
//       { protocol: "https", hostname: "ry3iz5q2f6.ufs.sh", pathname: "/**" }
//     ]
//   }
// };

// module.exports = nextConfig;

// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   images: {
//     domains: [
//       "images.unsplash.com",
//       "images.pexels.com",
//       "cdn.pixabay.com",
//       "burst.shopify.com",
//       "img.freepik.com",
//       "raw.githubusercontent.com",
//       "ry3iz5q2f6.ufs.sh" // <-- add this for UploadThing (ufs)
//     ],
//     remotePatterns: [
//       { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
//       { protocol: "https", hostname: "images.pexels.com", pathname: "/**" },
//       { protocol: "https", hostname: "cdn.pixabay.com", pathname: "/**" },
//       { protocol: "https", hostname: "burst.shopify.com", pathname: "/**" },
//       { protocol: "https", hostname: "img.freepik.com", pathname: "/**" },
//       { protocol: "https", hostname: "raw.githubusercontent.com", pathname: "/**" },
//       { protocol: "https", hostname: "ry3iz5q2f6.ufs.sh", pathname: "/**" } // <-- add this
//     ],
//   },
// };

// module.exports = nextConfig;
// next.config.js
/** @type {import('next').NextConfig} */
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Get __dirname equivalent in ESM
const __dirname = dirname(fileURLToPath(import.meta.url));

// Add webpack resolve aliases for certain inngest deep imports that are
// present on disk but not exported via the package's "exports" map.
// This resolves deep import errors from @inngest/agent-kit
const nextConfig = {
  images: {
    // keep `domains` for simplicity + `remotePatterns` for stricter matching
    domains: [
      "images.unsplash.com",
      "images.pexels.com",
      "cdn.pixabay.com",
      "burst.shopify.com",
      "img.freepik.com",
      "raw.githubusercontent.com",
      // Add your UploadThing UFS hostname here:
      "ry3iz5q2f6.ufs.sh"
    ],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "images.pexels.com", pathname: "/**" },
      { protocol: "https", hostname: "cdn.pixabay.com", pathname: "/**" },
      { protocol: "https", hostname: "burst.shopify.com", pathname: "/**" },
      { protocol: "https", hostname: "img.freepik.com", pathname: "/**" },
      { protocol: "https", hostname: "raw.githubusercontent.com", pathname: "/**" },
      // Remote pattern for UploadThing UFS host
      { protocol: "https", hostname: "ry3iz5q2f6.ufs.sh", pathname: "/**" }
    ]
  },

  // Ensure the bundler can resolve some deep imports used by
  // @inngest/agent-kit (they import 'inngest/components/...' etc.)
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};

    // Map specific inngest deep imports to their actual files inside node_modules
    config.resolve.fallback = config.resolve.fallback || {};
    
    // Add fallbacks for the specific inngest deep imports
    config.resolve.alias["inngest/components/InngestFunction"] = resolve(
      __dirname,
      "node_modules/inngest/components/InngestFunction"
    );
    config.resolve.alias["inngest/helpers/errors"] = resolve(
      __dirname,
      "node_modules/inngest/helpers/errors"
    );
    
    // Try both .js and directory resolution
    config.resolve.extensions = config.resolve.extensions || ['.js', '.json', '.ts'];
    config.resolve.mainFiles = config.resolve.mainFiles || ['index', 'index.js'];
    
    // Map the base paths as modules
    config.resolve.alias["inngest/components"] = resolve(
      __dirname,
      "node_modules/inngest/components"
    );
    config.resolve.alias["inngest/helpers"] = resolve(
      __dirname,
      "node_modules/inngest/helpers"
    );
    
    // Add inngest and its subpaths to module resolution
    config.resolve.modules = [
      'node_modules',
      resolve(__dirname, 'node_modules/inngest'),
      ...(config.resolve.modules || [])
    ];

    return config;
  }
};

export default nextConfig;
