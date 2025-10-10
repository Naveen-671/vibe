// // src/modules/projects/ui/components/image-uploader.tsx
// "use client";

// import { useState } from "react";
// import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
// import { Button } from "@/components/ui/button";
// import Dropzone from "react-dropzone";
// import { Cloud, Image as ImageIcon, Loader2, Paperclip } from "lucide-react";
// import { useTRPC } from "@/trpc/client";

// interface ImageUploaderProps {
//   onImageReady: (imageUrl: string) => void;
// }

// export const ImageUploadButton = ({ onImageReady }: ImageUploaderProps) => {
//   const [isOpen, setIsOpen] = useState(false);
//   const [isConverting, setIsConverting] = useState(false);
//   const trpc = useTRPC();

//   const handleFileDrop = async (acceptedFiles: File[]) => {
//     const file = acceptedFiles[0];
//     if (!file) return;

//     // Optional: client-side size/type quick checks
//     const MAX_BYTES = 5 * 1024 * 1024;
//     if (file.size > MAX_BYTES) {
//       alert("File is too large. Please upload an image smaller than 5MB.");
//       return;
//     }
//     if (!file.type.startsWith("image/")) {
//       alert("Please upload a valid image file (PNG, JPEG, WEBP).");
//       return;
//     }

//     setIsConverting(true);

//     try {
//       // 1) Request presigned URL from server
//       const { uploadUrl, fileUrl } = await trpc.messages.createPresignedUrl.mutateAsync({
//         filename: file.name,
//         contentType: file.type,
//       });

//       // 2) Upload directly to S3 using the presigned PUT URL
//       const res = await fetch(uploadUrl, {
//         method: "PUT",
//         headers: {
//           "Content-Type": file.type,
//         },
//         body: file,
//       });

//       if (!res.ok) {
//         throw new Error(`Upload failed with status ${res.status}`);
//       }

//       // 3) Notify parent that the image URL is ready
//       onImageReady(fileUrl);

//       setIsConverting(false);
//       setIsOpen(false);
//     } catch (e) {
//       console.error("Upload failed", e);
//       setIsConverting(false);
//       alert("Image upload failed. Please try again.");
//     }
//   };

//   return (
//     <Dialog open={isOpen} onOpenChange={setIsOpen}>
//       <DialogTrigger asChild>
//         <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
//           <Paperclip className="h-4 w-4" />
//         </Button>
//       </DialogTrigger>
//       <DialogContent>
//         <DialogTitle>Upload an image</DialogTitle>
//         <Dropzone multiple={false} accept={{ "image/*": [".png", ".jpeg", ".jpg", ".webp"] }} onDrop={handleFileDrop}>
//           {({ getRootProps, getInputProps, acceptedFiles }) => (
//             <div {...getRootProps()} className="border h-64 m-4 border-dashed border-gray-300 rounded-lg cursor-pointer">
//               <div className="flex items-center justify-center h-full w-full">
//                 <label className="flex flex-col items-center justify-center w-full h-full rounded-lg bg-gray-50 hover:bg-gray-100">
//                   {isConverting ? (
//                     <div className="flex flex-col items-center justify-center text-center">
//                       <Loader2 className="h-6 w-6 text-zinc-500 mb-2 animate-spin" />
//                       <p className="text-sm text-zinc-700">Uploading image...</p>
//                     </div>
//                   ) : (
//                     <div className="flex flex-col items-center justify-center pt-5 pb-6">
//                       <Cloud className="h-6 w-6 text-zinc-500 mb-2" />
//                       <p className="mb-2 text-sm text-zinc-700">
//                         <span className="font-semibold">Click to upload</span> or drag and drop
//                       </p>
//                       <p className="text-xs text-zinc-500">PNG, JPG, JPEG, or WEBP (max 5MB)</p>
//                     </div>
//                   )}

//                   {acceptedFiles?.[0] && !isConverting && (
//                     <div className="max-w-xs bg-white flex items-center rounded-md overflow-hidden outline outline-1 outline-zinc-200 divide-x divide-zinc-200">
//                       <div className="px-3 py-2 h-full grid place-items-center">
//                         <ImageIcon className="h-4 w-4 text-blue-500" />
//                       </div>
//                       <div className="px-3 py-2 h-full text-sm truncate">
//                         {acceptedFiles[0].name}
//                       </div>
//                     </div>
//                   )}

//                   <input {...getInputProps()} type="file" className="hidden" />
//                 </label>
//               </div>
//             </div>
//           )}
//         </Dropzone>
//       </DialogContent>
//     </Dialog>
//   );
// };

// src/modules/projects/ui/components/image-uploader.tsx
// "use client";

// import { useState } from "react";
// import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
// import { Button } from "@/components/ui/button";
// import { Loader2, Paperclip } from "lucide-react";
// import { UploadButton } from "@/utils/uploadthing"; // typed helper you already made

// interface ImageUploaderProps {
//   onImageReady: (fileUrl: string) => void;
// }

// /**
//  * Safely get a string property from an unknown value.
//  * Returns the string when present and of correct type, otherwise undefined.
//  */
// function getStringProp(obj: unknown, prop: string): string | undefined {
//   if (!obj || typeof obj !== "object") return undefined;
//   const record = obj as Record<string, unknown>;
//   const val = record[prop];
//   return typeof val === "string" ? val : undefined;
// }

// /**
//  * Extract URL from known UploadThing shapes without using `any`.
//  * Supported shapes:
//  *  - { url: string }
//  *  - { fileUrl: string }
//  *  - { file: { url: string } }
//  */
// function extractUrl(item: Record<string, unknown> | undefined): string | undefined {
//   if (!item) return undefined;

//   // Try `url`
//   const url1 = getStringProp(item, "url");
//   if (url1) return url1;

//   // Try `fileUrl`
//   const url2 = getStringProp(item, "fileUrl");
//   if (url2) return url2;

//   // Try nested file.url
//   const fileVal = item["file"];
//   if (fileVal && typeof fileVal === "object") {
//     const nestedUrl = getStringProp(fileVal, "url");
//     if (nestedUrl) return nestedUrl;
//     // Also check if UploadThing returns nested.fileUrl inside file object
//     const nestedFileUrl = getStringProp(fileVal, "fileUrl");
//     if (nestedFileUrl) return nestedFileUrl;
//   }

//   return undefined;
// }

// export const ImageUploadButton = ({ onImageReady }: ImageUploaderProps) => {
//   const [isOpen, setIsOpen] = useState(false);
//   const [isUploading, setIsUploading] = useState(false);

//   return (
//     <Dialog
//       open={isOpen}
//       onOpenChange={(open) => {
//         setIsOpen(open);
//         if (!open) setIsUploading(false);
//       }}
//     >
//       <DialogTrigger asChild>
//         <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
//           <Paperclip className="h-4 w-4" />
//         </Button>
//       </DialogTrigger>

//       <DialogContent>
//         <DialogTitle>Upload an image</DialogTitle>

//         <div className="p-2">
//           <UploadButton
//             endpoint="imageUploader"
//             onClientUploadComplete={(res: unknown[]) => {
//               // Upload finished (successful). Turn off uploading indicator.
//               setIsUploading(false);

//               if (!Array.isArray(res) || res.length === 0) {
//                 console.error("Upload finished but no file data returned:", res);
//                 alert("Upload finished but no file data returned.");
//                 return;
//               }

//               const first = res[0] as Record<string, unknown> | undefined;
//               if (!first) {
//                 console.error("Unexpected UploadThing response:", res);
//                 alert("Unexpected upload response. Check console.");
//                 return;
//               }

//               const urlCandidate = extractUrl(first);

//               if (!urlCandidate) {
//                 console.error("Could not find file URL in UploadThing response:", first);
//                 alert("Upload returned no accessible URL. Check console for details.");
//                 return;
//               }

//               onImageReady(urlCandidate);
//               setIsOpen(false);
//             }}
//             onUploadError={(error: unknown) => {
//               setIsUploading(false);
//               console.error("UploadThing upload error:", error);
//               alert("Upload failed. Check console for details.");
//             }}
//           />

//           <div className="mt-3">
//             {isUploading ? (
//               <div className="flex items-center gap-2">
//                 <Loader2 className="h-5 w-5 animate-spin" />
//                 <span>Uploading…</span>
//               </div>
//             ) : (
//               <div className="text-sm text-muted-foreground">PNG, JPG, JPEG, or WEBP (max 4MB)</div>
//             )}
//           </div>

//           {/* 
//             Small helper: mark "uploading" when user clicks the dialog area.
//             This is a UX hint only — UploadButton controls the actual upload lifecycle.
//           */}
//           <div
//             onClick={() => setIsUploading(true)}
//             role="button"
//             aria-hidden
//             className="mt-2 w-full h-6"
//           />
//         </div>
//       </DialogContent>
//     </Dialog>
//   );
// };


// src/modules/projects/ui/components/image-uploader.tsx
// "use client";

// import { useState } from "react";
// import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
// import { Button } from "@/components/ui/button";
// import { Loader2, Paperclip } from "lucide-react";
// import { UploadButton } from "@/utils/uploadthing"; // typed helper (no `any`)

// interface ImageUploaderProps {
//   onImageReady: (fileUrl: string) => void;
// }

// /**
//  * Safely get a string property from an unknown value.
//  * Returns the string when present and of correct type, otherwise undefined.
//  */
// function getStringProp(obj: unknown, prop: string): string | undefined {
//   if (!obj || typeof obj !== "object") return undefined;
//   const record = obj as Record<string, unknown>;
//   const val = record[prop];
//   return typeof val === "string" ? val : undefined;
// }

// /**
//  * Extract URL from known UploadThing shapes without using `any`.
//  * Supported shapes:
//  *  - { url: string }
//  *  - { fileUrl: string }
//  *  - { file: { url: string } }
//  *  - { ufsUrl: string }
//  */
// function extractUrl(item: Record<string, unknown> | undefined): string | undefined {
//   if (!item) return undefined;

//   // Try `url`
//   const url1 = getStringProp(item, "url");
//   if (url1) return url1;

//   // Try `fileUrl`
//   const url2 = getStringProp(item, "fileUrl");
//   if (url2) return url2;

//   // Try `ufsUrl` (some versions)
//   const url3 = getStringProp(item, "ufsUrl");
//   if (url3) return url3;

//   // Try nested file.url or file.fileUrl
//   const fileVal = item["file"];
//   if (fileVal && typeof fileVal === "object") {
//     const nestedUrl = getStringProp(fileVal, "url");
//     if (nestedUrl) return nestedUrl;
//     const nestedFileUrl = getStringProp(fileVal, "fileUrl");
//     if (nestedFileUrl) return nestedFileUrl;
//     const nestedUfs = getStringProp(fileVal, "ufsUrl");
//     if (nestedUfs) return nestedUfs;
//   }

//   return undefined;
// }

// export const ImageUploadButton = ({ onImageReady }: ImageUploaderProps) => {
//   const [isOpen, setIsOpen] = useState(false);
//   const [isUploading, setIsUploading] = useState(false);

//   return (
//     <Dialog
//       open={isOpen}
//       onOpenChange={(open) => {
//         setIsOpen(open);
//         if (!open) setIsUploading(false);
//       }}
//     >
//       <DialogTrigger asChild>
//         <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
//           <Paperclip className="h-4 w-4" />
//         </Button>
//       </DialogTrigger>

//       <DialogContent>
//         <DialogTitle>Upload an image</DialogTitle>

//         <div className="p-2">
//           <UploadButton
//             endpoint="imageUploader"
//             // UploadButton provides a typed onClientUploadComplete, but keep the param as unknown[] and narrow safely
//             onClientUploadComplete={(res: unknown[]) => {
//               // Upload finished (successful). Turn off uploading indicator.
//               setIsUploading(false);

//               if (!Array.isArray(res) || res.length === 0) {
//                 console.error("Upload finished but no file data returned:", res);
//                 // user-friendly message
//                 void alert("Upload finished but no file data returned.");
//                 return;
//               }

//               const first = res[0] as Record<string, unknown> | undefined;
//               if (!first) {
//                 console.error("Unexpected UploadThing response:", res);
//                 void alert("Unexpected upload response. Check console.");
//                 return;
//               }

//               const urlCandidate = extractUrl(first);

//               if (!urlCandidate) {
//                 console.error("Could not find file URL in UploadThing response:", first);
//                 void alert("Upload returned no accessible URL. Check console for details.");
//                 return;
//               }

//               onImageReady(urlCandidate);
//               setIsOpen(false);
//             }}
//             onUploadError={(error: unknown) => {
//               setIsUploading(false);
//               console.error("UploadThing upload error:", error);
//               void alert("Upload failed. Check console for details.");
//             }}
//           />

//           <div className="mt-3">
//             {isUploading ? (
//               <div className="flex items-center gap-2">
//                 <Loader2 className="h-5 w-5 animate-spin" />
//                 <span>Uploading…</span>
//               </div>
//             ) : (
//               <div className="text-sm text-muted-foreground">PNG, JPG, JPEG, or WEBP (max 4MB)</div>
//             )}
//           </div>

//           {/* 
//             Small helper: mark "uploading" when user clicks the dialog area.
//             This is a UX hint only — UploadButton controls the actual upload lifecycle.
//           */}
//           <div
//             onClick={() => setIsUploading(true)}
//             role="button"
//             aria-hidden
//             className="mt-2 w-full h-6"
//           />
//         </div>
//       </DialogContent>
//     </Dialog>
//   );
// };

// src/modules/projects/ui/components/image-uploader.tsx
// "use client";

// import { useState } from "react";
// import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
// import { Button } from "@/components/ui/button";
// import { Loader2, Paperclip } from "lucide-react";
// import { UploadButton } from "@/utils/uploadthing"; // typed helper you already made

// interface ImageUploaderProps {
//   onImageReady: (fileUrl: string) => void;
// }

// /**
//  * Safely get a string property from an unknown value.
//  * Returns the string when present and of correct type, otherwise undefined.
//  */
// function getStringProp(obj: unknown, prop: string): string | undefined {
//   if (!obj || typeof obj !== "object") return undefined;
//   const record = obj as Record<string, unknown>;
//   const val = record[prop];
//   return typeof val === "string" ? val : undefined;
// }

// /**
//  * Extract URL from known UploadThing shapes without using `any`.
//  * Supported shapes:
//  *  - { url: string }
//  *  - { fileUrl: string }
//  *  - { file: { url: string } }
//  */
// function extractUrl(item: Record<string, unknown> | undefined): string | undefined {
//   if (!item) return undefined;

//   // Try `url`
//   const url1 = getStringProp(item, "url");
//   if (url1) return url1;

//   // Try `fileUrl`
//   const url2 = getStringProp(item, "fileUrl");
//   if (url2) return url2;

//   // Try nested file.url
//   const fileVal = item["file"];
//   if (fileVal && typeof fileVal === "object") {
//     const nestedUrl = getStringProp(fileVal, "url");
//     if (nestedUrl) return nestedUrl;
//     const nestedFileUrl = getStringProp(fileVal, "fileUrl");
//     if (nestedFileUrl) return nestedFileUrl;
//   }

//   return undefined;
// }

// export const ImageUploadButton = ({ onImageReady }: ImageUploaderProps) => {
//   const [isOpen, setIsOpen] = useState(false);
//   const [isUploading, setIsUploading] = useState(false);

//   return (
//     <Dialog
//       open={isOpen}
//       onOpenChange={(open) => {
//         setIsOpen(open);
//         if (!open) setIsUploading(false);
//       }}
//     >
//       <DialogTrigger asChild>
//         <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
//           <Paperclip className="h-4 w-4" />
//         </Button>
//       </DialogTrigger>

//       <DialogContent>
//         <DialogTitle>Upload an image</DialogTitle>

//         <div className="p-2">
//           <UploadButton
//             endpoint="imageUploader"
//             onClientUploadComplete={(res: unknown[]) => {
//               // Upload finished (successful). Turn off uploading indicator.
//               setIsUploading(false);

//               if (!Array.isArray(res) || res.length === 0) {
//                 console.error("Upload finished but no file data returned:", res);
//                 alert("Upload finished but no file data returned.");
//                 return;
//               }

//               const first = res[0] as Record<string, unknown> | undefined;
//               if (!first) {
//                 console.error("Unexpected UploadThing response:", res);
//                 alert("Unexpected upload response. Check console.");
//                 return;
//               }

//               const urlCandidate = extractUrl(first);

//               if (!urlCandidate) {
//                 console.error("Could not find file URL in UploadThing response:", first);
//                 alert("Upload returned no accessible URL. Check console for details.");
//                 return;
//               }

//               onImageReady(urlCandidate);
//               setIsOpen(false);
//             }}
//             onUploadError={(error: unknown) => {
//               setIsUploading(false);
//               console.error("UploadThing upload error:", error);
//               alert("Upload failed. Check console for details.");
//             }}
//           />

//           <div className="mt-3">
//             {isUploading ? (
//               <div className="flex items-center gap-2">
//                 <Loader2 className="h-5 w-5 animate-spin" />
//                 <span>Uploading…</span>
//               </div>
//             ) : (
//               <div className="text-sm text-muted-foreground">PNG, JPG, JPEG, or WEBP (max 4MB)</div>
//             )}
//           </div>

//           {/* UX hint area to mark "uploading" on click */}
//           <div
//             onClick={() => setIsUploading(true)}
//             role="button"
//             aria-hidden
//             className="mt-2 w-full h-6"
//           />
//         </div>
//       </DialogContent>
//     </Dialog>
//   );
// };

// src/modules/projects/ui/components/image-uploader.tsx
// "use client";

// import { useState } from "react";
// import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
// import { Button } from "@/components/ui/button";
// import { Loader2, Paperclip } from "lucide-react";
// import { UploadButton } from "@/utils/uploadthing"; // typed helper you already made

// interface ImageUploaderProps {
//   onImageReady: (fileUrl: string) => void;
// }

// /**
//  * Safely get a string property from an unknown value.
//  * Returns the string when present and of correct type, otherwise undefined.
//  */
// function getStringProp(obj: unknown, prop: string): string | undefined {
//   if (!obj || typeof obj !== "object") return undefined;
//   const record = obj as Record<string, unknown>;
//   const val = record[prop];
//   return typeof val === "string" ? val : undefined;
// }

// /**
//  * Extract URL from known UploadThing shapes without using `any`.
//  * Supported shapes (checked in order):
//  *  - { ufsUrl: string }         // preferred (UploadThing v9+)
//  *  - { url: string }            // legacy
//  *  - { fileUrl: string }        // some variants
//  *  - { file: { ufsUrl|url|fileUrl } } // nested
//  */
// function extractUrl(item: Record<string, unknown> | undefined): string | undefined {
//   if (!item) return undefined;

//   // Prefer ufsUrl (the new recommended field)
//   const ufs = getStringProp(item, "ufsUrl");
//   if (ufs) return ufs;

//   // Try legacy `url`
//   const url1 = getStringProp(item, "url");
//   if (url1) return url1;

//   // Try `fileUrl`
//   const url2 = getStringProp(item, "fileUrl");
//   if (url2) return url2;

//   // Try nested file object
//   const fileVal = item["file"];
//   if (fileVal && typeof fileVal === "object") {
//     const nested = fileVal as Record<string, unknown>;
//     const nestedUfs = getStringProp(nested, "ufsUrl");
//     if (nestedUfs) return nestedUfs;
//     const nestedUrl = getStringProp(nested, "url");
//     if (nestedUrl) return nestedUrl;
//     const nestedFileUrl = getStringProp(nested, "fileUrl");
//     if (nestedFileUrl) return nestedFileUrl;
//   }

//   return undefined;
// }

// export const ImageUploadButton = ({ onImageReady }: ImageUploaderProps) => {
//   const [isOpen, setIsOpen] = useState(false);
//   const [isUploading, setIsUploading] = useState(false);

//   return (
//     <Dialog
//       open={isOpen}
//       onOpenChange={(open) => {
//         setIsOpen(open);
//         if (!open) setIsUploading(false);
//       }}
//     >
//       <DialogTrigger asChild>
//         <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
//           <Paperclip className="h-4 w-4" />
//         </Button>
//       </DialogTrigger>

//       <DialogContent>
//         <DialogTitle>Upload an image</DialogTitle>

//         <div className="p-2">
//           <UploadButton
//             endpoint="imageUploader"
//             onClientUploadComplete={(res: unknown[]) => {
//               // Upload finished — turn off uploading indicator.
//               setIsUploading(false);

//               if (!Array.isArray(res) || res.length === 0) {
//                 console.error("Upload finished but no file data returned:", res);
//                 alert("Upload finished but no file data returned.");
//                 return;
//               }

//               const first = res[0] as Record<string, unknown> | undefined;
//               if (!first) {
//                 console.error("Unexpected UploadThing response:", res);
//                 alert("Unexpected upload response. Check console.");
//                 return;
//               }

//               const urlCandidate = extractUrl(first);

//               if (!urlCandidate) {
//                 console.error("Could not find file URL in UploadThing response:", first);
//                 alert("Upload returned no accessible URL. Check console for details.");
//                 return;
//               }

//               onImageReady(urlCandidate);
//               setIsOpen(false);
//             }}
//             onUploadError={(error: unknown) => {
//               setIsUploading(false);
//               console.error("UploadThing upload error:", error);
//               alert("Upload failed. Check console for details.");
//             }}
//           />

//           <div className="mt-3">
//             {isUploading ? (
//               <div className="flex items-center gap-2">
//                 <Loader2 className="h-5 w-5 animate-spin" />
//                 <span>Uploading…</span>
//               </div>
//             ) : (
//               <div className="text-sm text-muted-foreground">PNG, JPG, JPEG, or WEBP (max 4MB)</div>
//             )}
//           </div>

//           {/* Small helper: set uploading when user clicks the area. */}
//           <div
//             onClick={() => setIsUploading(true)}
//             role="button"
//             aria-hidden
//             className="mt-2 w-full h-6"
//           />
//         </div>
//       </DialogContent>
//     </Dialog>
//   );
// };
// src/modules/projects/ui/components/image-uploader.tsx
// "use client";

// import { useState } from "react";
// import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
// import { Button } from "@/components/ui/button";
// import { Loader2, Paperclip } from "lucide-react";
// import { UploadButton } from "@/utils/uploadthing"; // typed helper you already made

// interface ImageUploaderProps {
//   onImageReady: (fileUrl: string) => void;
// }

// /** Safe helper: return string prop if present */
// function getStringProp(obj: unknown, prop: string): string | undefined {
//   if (!obj || typeof obj !== "object") return undefined;
//   const record = obj as Record<string, unknown>;
//   const val = record[prop];
//   return typeof val === "string" ? val : undefined;
// }

// /**
//  * Extract URL from known UploadThing shapes without using `any`.
//  * Supports:
//  *  - { ufsUrl: string } (v9+)
//  *  - { url: string }
//  *  - { fileUrl: string }
//  *  - { file: { ufsUrl?: string, url?: string, fileUrl?: string } }
//  */
// function extractUrl(item: Record<string, unknown> | undefined): string | undefined {
//   if (!item) return undefined;

//   // v9+ preferred field
//   const ufs = getStringProp(item, "ufsUrl");
//   if (ufs) return ufs;

//   // older fields
//   const url1 = getStringProp(item, "url");
//   if (url1) return url1;

//   const url2 = getStringProp(item, "fileUrl");
//   if (url2) return url2;

//   // nested file object
//   const fileVal = item["file"];
//   if (fileVal && typeof fileVal === "object") {
//     const nested = fileVal as Record<string, unknown>;
//     const nUfs = getStringProp(nested, "ufsUrl");
//     if (nUfs) return nUfs;
//     const nUrl = getStringProp(nested, "url");
//     if (nUrl) return nUrl;
//     const nFileUrl = getStringProp(nested, "fileUrl");
//     if (nFileUrl) return nFileUrl;
//   }

//   return undefined;
// }

// export const ImageUploadButton = ({ onImageReady }: ImageUploaderProps) => {
//   const [isOpen, setIsOpen] = useState(false);
//   const [isUploading, setIsUploading] = useState(false);

//   return (
//     <Dialog
//       open={isOpen}
//       onOpenChange={(open) => {
//         setIsOpen(open);
//         if (!open) setIsUploading(false);
//       }}
//     >
//       <DialogTrigger asChild>
//         <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
//           <Paperclip className="h-4 w-4" />
//         </Button>
//       </DialogTrigger>

//       <DialogContent>
//         <DialogTitle>Upload an image</DialogTitle>

//         <div className="p-2">
//           <UploadButton
//             endpoint="imageUploader"
//             onClientUploadComplete={(res: unknown[]) => {
//               // Upload finished (successful). Turn off uploading indicator.
//               setIsUploading(false);

//               if (!Array.isArray(res) || res.length === 0) {
//                 console.error("Upload finished but no file data returned:", res);
//                 alert("Upload finished but no file data returned.");
//                 return;
//               }

//               const first = res[0] as Record<string, unknown> | undefined;
//               if (!first) {
//                 console.error("Unexpected UploadThing response:", res);
//                 alert("Unexpected upload response. Check console.");
//                 return;
//               }

//               const urlCandidate = extractUrl(first);

//               if (!urlCandidate) {
//                 console.error("Could not find file URL in UploadThing response:", first);
//                 alert("Upload returned no accessible URL. Check console for details.");
//                 return;
//               }

//               onImageReady(urlCandidate);
//               setIsOpen(false);
//             }}
//             onUploadError={(error: unknown) => {
//               setIsUploading(false);
//               console.error("UploadThing upload error:", error);
//               alert("Upload failed. Check console for details.");
//             }}
//           />

//           <div className="mt-3">
//             {isUploading ? (
//               <div className="flex items-center gap-2">
//                 <Loader2 className="h-5 w-5 animate-spin" />
//                 <span>Uploading…</span>
//               </div>
//             ) : (
//               <div className="text-sm text-muted-foreground">PNG, JPG, JPEG, or WEBP (max 4MB)</div>
//             )}
//           </div>

//           {/* UX hint click area — mark uploading when user clicks the dialog */}
//           <div
//             onClick={() => setIsUploading(true)}
//             role="button"
//             aria-hidden
//             className="mt-2 w-full h-6"
//           />
//         </div>
//       </DialogContent>
//     </Dialog>
//   );
// };


// src/modules/projects/ui/components/image-uploader.tsx
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Paperclip } from "lucide-react";
import { UploadButton } from "@/utils/uploadthing"; // typed helper you already made

interface ImageUploaderProps {
  onImageReady: (fileUrl: string) => void;
}

/**
 * Safely get a string property from an unknown value.
 * Returns the string when present and of correct type, otherwise undefined.
 */
function getStringProp(obj: unknown, prop: string): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const record = obj as Record<string, unknown>;
  const val = record[prop];
  return typeof val === "string" ? val : undefined;
}

/**
 * Extract URL from known UploadThing shapes without using `any`.
 * Supported shapes:
 *  - { url: string }
 *  - { fileUrl: string }
 *  - { file: { url: string } }
 *  - { ufsUrl: string } (UploadThing v9+)
 */
function extractUrl(item: Record<string, unknown> | undefined): string | undefined {
  if (!item) return undefined;

  // Try `ufsUrl` (preferred)
  const ufs = getStringProp(item, "ufsUrl");
  if (ufs) return ufs;

  // Try `url`
  const url1 = getStringProp(item, "url");
  if (url1) return url1;

  // Try `fileUrl`
  const url2 = getStringProp(item, "fileUrl");
  if (url2) return url2;

  // Try nested file.url or file.fileUrl
  const fileVal = item["file"];
  if (fileVal && typeof fileVal === "object") {
    const nestedUrl = getStringProp(fileVal, "url");
    if (nestedUrl) return nestedUrl;
    const nestedFileUrl = getStringProp(fileVal, "fileUrl");
    if (nestedFileUrl) return nestedFileUrl;
    const nestedUfs = getStringProp(fileVal, "ufsUrl");
    if (nestedUfs) return nestedUfs;
  }

  return undefined;
}

export const ImageUploadButton = ({ onImageReady }: ImageUploaderProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) setIsUploading(false);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
          <Paperclip className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogTitle>Upload an image</DialogTitle>

        <div className="p-2">
          <UploadButton
            endpoint="imageUploader"
            onClientUploadComplete={(res: unknown[]) => {
              // Upload finished (successful). Turn off uploading indicator.
              setIsUploading(false);

              if (!Array.isArray(res) || res.length === 0) {
                console.error("Upload finished but no file data returned:", res);
                alert("Upload finished but no file data returned.");
                return;
              }

              const first = res[0] as Record<string, unknown> | undefined;
              if (!first) {
                console.error("Unexpected UploadThing response:", res);
                alert("Unexpected upload response. Check console.");
                return;
              }

              const urlCandidate = extractUrl(first);

              if (!urlCandidate) {
                console.error("Could not find file URL in UploadThing response:", first);
                alert("Upload returned no accessible URL. Check console for details.");
                return;
              }

              onImageReady(urlCandidate);
              setIsOpen(false);
            }}
            onUploadError={(error: unknown) => {
              setIsUploading(false);
              console.error("UploadThing upload error:", error);
              alert("Upload failed. Check console for details.");
            }}
          />

          <div className="mt-3">
            {isUploading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Uploading…</span>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">PNG, JPG, JPEG, or WEBP (max 4MB)</div>
            )}
          </div>

          {/* Small helper: mark "uploading" when user clicks the dialog area. */}
          <div
            onClick={() => setIsUploading(true)}
            role="button"
            aria-hidden
            className="mt-2 w-full h-6"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
