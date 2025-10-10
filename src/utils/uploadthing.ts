// import {
//   generateUploadButton,
//   generateUploadDropzone,
// } from "@uploadthing/react";

// import type { OurFileRouter } from "@/app/api/uploadthing/core";

// export const UploadButton = generateUploadButton<OurFileRouter>();
// export const UploadDropzone = generateUploadDropzone<OurFileRouter>();

// src/utils/uploadthing.ts
import { generateUploadButton } from "@uploadthing/react";
import type { OurFileRouter } from "@/server/uploadthing";

// The import above is a type-only import, so it won't include server runtime.
// This gives us a typed UploadButton for the client code.
export const UploadButton = generateUploadButton<OurFileRouter>();
