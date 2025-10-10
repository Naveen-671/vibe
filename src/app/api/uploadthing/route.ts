// import { createRouteHandler } from "uploadthing/next";

// import { ourFileRouter } from "./core";

// // Export routes for Next App Router
// export const { GET, POST } = createRouteHandler({
//   router: ourFileRouter,

//   // Apply an (optional) custom config:
//   // config: { ... },
// });


// src/app/api/uploadthing/route.ts
import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "@/server/uploadthing";

/**
 * Expose UploadThing handlers at /api/uploadthing.
 * NOTE: do not pass unknown config keys to createRouteHandler (that caused earlier TS errors).
 */
export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
});
