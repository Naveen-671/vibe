// import { createUploadthing, type FileRouter } from "uploadthing/next";
// import { getServerSession } from "next-auth";

// const f = createUploadthing();

// export const ourFileRouter = {
//   imageUploader: f({ image: { maxFileSize: "4MB" } })
//     .middleware(async () => {
//       const session = await getServerSession();
//       if (!session) throw new Error("Unauthorized");
//       return { userId: session.user.id };
//     })
//     .onUploadComplete(async ({ metadata, file }) => {
//       console.log("Uploaded file URL:", file.url);
//       return { uploadedBy: metadata.userId, url: file.url };
//     }),
// } satisfies FileRouter;

// export type OurFileRouter = typeof ourFileRouter;

// src/server/uploadthing.ts
// import { createUploadthing, type FileRouter } from "uploadthing/next";
// import { auth } from "@clerk/nextjs/server";

// const f = createUploadthing();

// export const ourFileRouter = {
//   imageUploader: f({
//     image: {
//       maxFileSize: "4MB",
//     },
//   })
//     .middleware(async () => {
//       // Use Clerk server-side helper
//       const session = await auth();

//       if (!session || !session.userId) {
//         throw new Error("Unauthorized");
//       }

//       return { userId: session.userId };
//     })
//     .onUploadComplete(async ({ metadata, file }) => {
//       // file.url is returned by UploadThing (depending on your provider setup)
//       console.log("Uploaded file URL:", file.url);
//       // Return whatever you want the client to receive in onClientUploadComplete
//       return { uploadedBy: metadata.userId, url: file.url };
//     }),
// } satisfies FileRouter;

// export type OurFileRouter = typeof ourFileRouter;


// // src/server/uploadthing.ts
// import { createUploadthing, type FileRouter } from "uploadthing/next";
// import { UploadThingError } from "uploadthing/server";
// import { getAuth } from "@clerk/nextjs/server";

// const f = createUploadthing();

// export const ourFileRouter = {
//   imageUploader: f({
//     image: {
//       maxFileSize: "4MB",
//       maxFileCount: 1,
//     },
//   })
//     .middleware(async ({ req }) => {
//       // Clerk server-side helper returns { userId } among other things.
//       const { userId } = getAuth(req);
//       if (!userId) throw new UploadThingError("Unauthorized");
//       // return metadata for onUploadComplete
//       return { userId };
//     })
//     .onUploadComplete(async ({ metadata, file }) => {
//       // Prefer `ufsUrl` — `url` is deprecated in v9+
//       // `file.ufsUrl` is the UploadThing front-end accessible URL.
//       // store anything you need in your DB here or just return metadata for client callback.
//       console.log("Upload complete for userId:", metadata.userId);
//       console.log("file ufsUrl:", file.ufsUrl, "file url (deprecated):", file.url);
//       return { uploadedBy: metadata.userId, ufsUrl: file.ufsUrl ?? file.url };
//     }),
// } satisfies FileRouter;

// export type OurFileRouter = typeof ourFileRouter;
// src/server/uploadthing.ts
// import { createUploadthing, type FileRouter } from "uploadthing/next";
// import { auth } from "@clerk/nextjs/server";

// const f = createUploadthing();

// export const ourFileRouter = {
//   imageUploader: f({
//     image: {
//       maxFileSize: "4MB",
//       maxFileCount: 1,
//     },
//   })
//     .middleware(async () => {
//       // Clerk server helper - returns a typed object which may contain userId when signed in.
//       const clerkSession = await auth();

//       // Defensive read of userId without assuming other properties exist.
//       const maybe = clerkSession as { userId?: string };
//       const userId = typeof maybe.userId === "string" && maybe.userId.length > 0 ? maybe.userId : undefined;

//       if (!userId) {
//         throw new Error("Unauthorized");
//       }

//       // Return metadata available in onUploadComplete
//       return { userId };
//     })
//     .onUploadComplete(async ({ metadata, file }) => {
//       // UploadThing v9+ uses `ufsUrl`; earlier versions used `url`.
//       // Prefer ufsUrl then fall back to url.
//       const ufsUrl = (file as { ufsUrl?: string }).ufsUrl;
//       const url = (file as { url?: string }).url;
//       const publicUrl = typeof ufsUrl === "string" && ufsUrl.length > 0 ? ufsUrl : url;

//       // Logging is useful for debugging
//       console.log("Upload complete for userId:", metadata.userId);
//       console.log("file ufsUrl:", ufsUrl, "file url (fallback):", url);

//       return { uploadedBy: metadata.userId, url: publicUrl };
//     }),
// } satisfies FileRouter;

// export type OurFileRouter = typeof ourFileRouter;

// // src/server/uploadthing.ts
// import { createUploadthing, type FileRouter } from "uploadthing/next";
// import { getAuth } from "@clerk/nextjs/server";
// import type { NextRequest } from "next/server";

// const f = createUploadthing();

// export const ourFileRouter = {
//   imageUploader: f({
//     image: {
//       maxFileSize: "4MB",
//       maxFileCount: 1,
//     },
//   })
//     .middleware(async ({ req }: { req: NextRequest }) => {
//       // Clerk server helper. getAuth accepts a NextRequest.
//       const auth = getAuth(req);
//       const userId = auth.userId;
//       if (!userId) throw new Error("Unauthorized");
//       return { userId };
//     })
//     .onUploadComplete(
//       async ({
//         metadata,
//         file,
//       }: {
//         metadata: { userId: string };
//         // Minimal typing for the file object from UploadThing: we only use ufsUrl/url
//         file: { ufsUrl?: string | null; url?: string | null };
//       }) => {
//         // prefer ufsUrl (newer), fall back to url
//         const fileUrl = file.ufsUrl ?? file.url ?? "";
//         console.log("Upload complete for userId:", metadata.userId, "fileUrl:", fileUrl);

//         // Return whatever the client callback expects
//         return { uploadedBy: metadata.userId, url: fileUrl };
//       }
//     ),
// } satisfies FileRouter;

// export type OurFileRouter = typeof ourFileRouter;

// src/server/uploadthing.ts
// import { createUploadthing, type FileRouter } from "uploadthing/next";
// import { auth } from "@clerk/nextjs/server";

// const f = createUploadthing();

// export const ourFileRouter = {
//   imageUploader: f({
//     image: {
//       maxFileSize: "4MB",
//       maxFileCount: 1,
//     },
//   })
//     .middleware(async () => {
//       // Use Clerk server helper to get the authenticated user id.
//       // auth() returns an object with userId when signed in.
//       const session = auth();
//       const userId = (await session)?.userId;
//       if (!userId) {
//         throw new Error("Unauthorized");
//       }
//       // returned metadata will be available in onUploadComplete as metadata
//       return { userId };
//     })
//     .onUploadComplete(async ({ metadata, file }) => {
//       // UploadThing will commonly yield `ufsUrl` (preferred) or `url`.
//       // Narrow the type safely without `any`.
//       const fObj = file as { ufsUrl?: string; url?: string };
//       const publicUrl = fObj.ufsUrl ?? fObj.url ?? null;

//       console.log("Upload complete for userId:", metadata.userId, "publicUrl:", publicUrl);

//       // Return the values the client-side UploadButton callback expects.
//       return {
//         uploadedBy: metadata.userId,
//         url: publicUrl,
//       };
//     }),
// } satisfies FileRouter;

// export type OurFileRouter = typeof ourFileRouter;

// src/server/uploadthing.ts
// import { createUploadthing, type FileRouter } from "uploadthing/next";
// import { UploadThingError } from "uploadthing/server";
// import { getAuth } from "@clerk/nextjs/server";

// const f = createUploadthing();

// /**
//  * Safely read a string property from an unknown object.
//  */
// function getStringProp(obj: unknown, prop: string): string | undefined {
//   if (!obj || typeof obj !== "object") return undefined;
//   const rec = obj as Record<string, unknown>;
//   const val = rec[prop];
//   return typeof val === "string" ? val : undefined;
// }

// /**
//  * Extract a usable public URL from the UploadThing file object shapes.
//  * Supports ufsUrl (v9+), url (deprecated but commonly present), fileUrl, and nested file.xyz shapes.
//  */
// function extractFileUrl(file: unknown): string | undefined {
//   if (!file || typeof file !== "object") return undefined;
//   return (
//     getStringProp(file, "ufsUrl") ??
//     getStringProp(file, "url") ??
//     getStringProp(file, "fileUrl") ??
//     // nested 'file' object (some providers return { file: { url: ... } })
//     (typeof (file as Record<string, unknown>).file === "object"
//       ? getStringProp((file as Record<string, unknown>).file, "ufsUrl") ??
//         getStringProp((file as Record<string, unknown>).file, "url") ??
//         getStringProp((file as Record<string, unknown>).file, "fileUrl")
//       : undefined)
//   );
// }

// export const ourFileRouter = {
//   imageUploader: f({
//     image: { maxFileSize: "4MB", maxFileCount: 1 },
//   })
//     .middleware(async ({ req }) => {
//       // Use Clerk's server helper which accepts the Next request
//       const auth = getAuth(req);
//       const userId = auth.userId;
//       if (!userId) {
//         // UploadThing will surface this error to the client
//         throw new UploadThingError("Unauthorized: you must be signed in to upload files.");
//       }
//       // return metadata for onUploadComplete
//       return { userId };
//     })
//     .onUploadComplete(async ({ metadata, file }) => {
//       // file shape can vary across providers and UploadThing versions.
//       const fileUrl = extractFileUrl(file) ?? "";
//       console.log("Upload complete for user:", metadata.userId, "fileUrl:", fileUrl);
//       // Return value is sent to the client in onClientUploadComplete
//       return { uploadedBy: metadata.userId, url: fileUrl };
//     }),
// } satisfies FileRouter;

// export type OurFileRouter = typeof ourFileRouter;

// // src/server/uploadthing.ts
// import { createUploadthing, type FileRouter } from "uploadthing/next";
// import { UploadThingError } from "uploadthing/server";
// import { auth } from "@clerk/nextjs/server";

// /**
//  * Create UploadThing helper
//  */
// const f = createUploadthing();

// /**
//  * Extract a user-facing file url from UploadThing's file object.
//  * Prefer `ufsUrl` (newer UploadThing), fall back to `url` or nested values.
//  */
// function extractFileUrl(file: unknown): string | undefined {
//   if (!file || typeof file !== "object") return undefined;
//   const rec = file as Record<string, unknown>;

//   const ufsUrl = typeof rec.ufsUrl === "string" ? rec.ufsUrl : undefined;
//   if (ufsUrl) return ufsUrl;

//   const url = typeof rec.url === "string" ? rec.url : undefined;
//   if (url) return url;

//   const fileUrl = typeof rec.fileUrl === "string" ? rec.fileUrl : undefined;
//   if (fileUrl) return fileUrl;

//   const nested = rec.file;
//   if (nested && typeof nested === "object") {
//     const nestedRec = nested as Record<string, unknown>;
//     return (
//       (typeof nestedRec.ufsUrl === "string" && nestedRec.ufsUrl) ||
//       (typeof nestedRec.url === "string" && nestedRec.url) ||
//       (typeof nestedRec.fileUrl === "string" && nestedRec.fileUrl) ||
//       undefined
//     );
//   }

//   return undefined;
// }

// /**
//  * File router exported for UploadThing route handler.
//  */
// export const ourFileRouter = {
//   imageUploader: f({
//     image: { maxFileSize: "4MB", maxFileCount: 1 },
//   })
//     .middleware(async () => {
//       // Use Clerk server auth helper (no argument) — avoids Request/NextRequest typing mismatch.
//       const clerkAuth = auth();
//       const userId = (await clerkAuth).userId;
//       if (!userId) {
//         throw new UploadThingError("Unauthorized: sign in to upload files.");
//       }
//       return { userId };
//     })
//     .onUploadComplete(async ({ metadata, file }) => {
//       // prefer ufsUrl for v9+, fallback to url
//       const fileUrl = extractFileUrl(file) ?? "";
//       console.log("Upload complete - user:", metadata.userId, "fileUrl:", fileUrl);
//       // return whatever the client needs in onClientUploadComplete
//       return { uploadedBy: metadata.userId, url: fileUrl };
//     }),
// } satisfies FileRouter;

// export type OurFileRouter = typeof ourFileRouter;

// src/server/uploadthing.ts
// import { createUploadthing, type FileRouter } from "uploadthing/next";
// import { UploadThingError } from "uploadthing/server";
// import { auth } from "@clerk/nextjs/server";

// /**
//  * Create uploadthing instance
//  */
// const f = createUploadthing();

// /**
//  * Safe extraction of file URL from UploadThing file object.
//  * Prefer ufsUrl (v9+), fall back to url/fileUrl, and handle nested file objects.
//  */
// function extractFileUrl(file: unknown): string | undefined {
//   if (!file || typeof file !== "object") return undefined;
//   const rec = file as Record<string, unknown>;

//   if (typeof rec.ufsUrl === "string" && rec.ufsUrl.length > 0) return rec.ufsUrl;
//   if (typeof rec.url === "string" && rec.url.length > 0) return rec.url;
//   if (typeof rec.fileUrl === "string" && rec.fileUrl.length > 0) return rec.fileUrl;

//   const nested = rec.file;
//   if (nested && typeof nested === "object") {
//     const n = nested as Record<string, unknown>;
//     if (typeof n.ufsUrl === "string" && n.ufsUrl.length > 0) return n.ufsUrl;
//     if (typeof n.url === "string" && n.url.length > 0) return n.url;
//     if (typeof n.fileUrl === "string" && n.fileUrl.length > 0) return n.fileUrl;
//   }

//   return undefined;
// }

// /**
//  * UploadThing File Router.
//  * - Uses Clerk server auth() helper (no Request param typing issues).
//  * - Returns a stable `url` (prefer ufsUrl).
//  */
// export const ourFileRouter = {
//   imageUploader: f({
//     image: {
//       maxFileSize: "4MB",
//       maxFileCount: 1,
//     },
//   })
//     .middleware(async () => {
//       // Clerk server helper. No NextRequest required — this avoids the Request -> NextRequest mismatch.
//       const clerkAuth = await auth();
//       const userId = clerkAuth.userId;
//       if (!userId) {
//         // UploadThing's error class gives nicer client message (caught by UploadThing client)
//         throw new UploadThingError("Unauthorized: sign-in required to upload files.");
//       }
//       return { userId };
//     })
//     .onUploadComplete(async ({ metadata, file }) => {
//       const fileUrl = extractFileUrl(file) ?? "";
//       // Log for server debugging — remove in production if you want.
//       console.log("Upload complete:", { uploadedBy: metadata.userId, fileUrl });
//       // Return the fields your client expects in onClientUploadComplete
//       return { uploadedBy: metadata.userId, url: fileUrl };
//     }),
// } satisfies FileRouter;

// export type OurFileRouter = typeof ourFileRouter;

// src/server/uploadthing.ts
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { auth } from "@clerk/nextjs/server";

/**
 * Create UploadThing instance
 */
const f = createUploadthing();

/**
 * Safe extraction of file URL from UploadThing file object.
 * Prefer ufsUrl (v9+), fall back to url/fileUrl, and handle nested file objects.
 */
function extractFileUrl(file: unknown): string | undefined {
  if (!file || typeof file !== "object") return undefined;
  const rec = file as Record<string, unknown>;

  if (typeof rec.ufsUrl === "string" && rec.ufsUrl.trim().length > 0) return rec.ufsUrl;
  if (typeof rec.url === "string" && rec.url.trim().length > 0) return rec.url;
  if (typeof rec.fileUrl === "string" && rec.fileUrl.trim().length > 0) return rec.fileUrl;

  // Some providers return nested file objects
  const nested = rec.file;
  if (nested && typeof nested === "object") {
    const n = nested as Record<string, unknown>;
    if (typeof n.ufsUrl === "string" && n.ufsUrl.trim().length > 0) return n.ufsUrl;
    if (typeof n.url === "string" && n.url.trim().length > 0) return n.url;
    if (typeof n.fileUrl === "string" && n.fileUrl.trim().length > 0) return n.fileUrl;
  }

  return undefined;
}

/**
 * UploadThing File Router.
 * - Uses Clerk server `auth()` helper (no Request param typing issues).
 * - Returns a stable `url` (prefer ufsUrl).
 * - Throws UploadThingError for clear client-facing errors.
 */
export const ourFileRouter = {
  imageUploader: f({
    image: {
      maxFileSize: "4MB",
      maxFileCount: 1,
    },
  })
    .middleware(async () => {
      // Clerk server helper; no NextRequest required here which avoids Request/NextRequest mismatch.
      const clerkAuth = await auth();
      const userId = clerkAuth.userId;
      if (!userId) {
        // Use UploadThingError so the client receives a clear failure message.
        throw new UploadThingError("Unauthorized: sign-in required to upload files.");
      }
      return { userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // Attempt to derive a stable URL for client use
      const fileUrl = extractFileUrl(file);

      if (!fileUrl) {
        // If we can't find a usable URL, fail clearly so the client doesn't get an undefined URL.
        throw new UploadThingError(
          "Upload succeeded but server could not determine file URL. Contact support."
        );
      }

      // Optional: normalize - ensure it's an absolute URL (UploadThing should provide absolute).
      const normalizedUrl = fileUrl;

      // Server-side debug log (safe to remove in production).
      console.log("Upload complete:", { uploadedBy: metadata.userId, url: normalizedUrl });

      // Return the fields the client expects in `onClientUploadComplete`.
      return { uploadedBy: metadata.userId, url: normalizedUrl };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
