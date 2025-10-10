// import { useForm } from "react-hook-form";
// import { zodResolver } from "@hookform/resolvers/zod";
// import { z } from "zod";
// import { toast } from "sonner";
// import { useState } from "react";
// import { cn } from "@/lib/utils";
// import { useTRPC } from "@/trpc/client";
// import { Button } from "@/components/ui/button";
// import { ArrowUp, Loader2 } from "lucide-react";
// import TextareaAutoSize from "react-textarea-autosize";
// import { Form, FormField, FormControl } from "@/components/ui/form";
// import { Usage } from "./usage";
// import { ModelSelector, allModels } from "@/modules/projects/ui/components/model-selector"
// import { useRouter } from "next/navigation";
// import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// interface Props {
//   projectId: string;
//   isPremium?: boolean; // Add this prop
// }

// const formSchema = z.object({
//   value: z.string().min(1, { message: "Value is required" })
// });

// export const MessageForm = ({ projectId, isPremium = false}: Props) => {
//   const router = useRouter();
//   const trpc = useTRPC();
//   const queryClient = useQueryClient();

//   const defaultModel = allModels.find((m) => m.isDefault) || allModels[0];
//   const [selectedModel, setSelectedModel] = useState<string>(defaultModel.id);
//   const [isFocused, setIsFocused] = useState(false);

//   const { data: usage } = useQuery(trpc.usage.status.queryOptions());
//   const showUsage = !!usage;

//   const form = useForm<z.infer<typeof formSchema>>({
//     resolver: zodResolver(formSchema),
//     defaultValues: { value: "" }
//   });

//   const createMessage = useMutation(
//     trpc.messages.create.mutationOptions({
//       onSuccess: () => {
//         form.reset();
//         queryClient.invalidateQueries(
//           trpc.messages.getMany.queryOptions({ projectId })
//         );
//         queryClient.invalidateQueries(trpc.usage.status.queryOptions());
//       },
//       onError: (error) => {
//         toast.error(error.message);
//         if (error.data?.code === "TOO_MANY_REQUESTS") {
//           router.push("/pricing");
//         }
//       }
//     })
//   );

//   const onSubmit = async (values: z.infer<typeof formSchema>) => {
//     await createMessage.mutateAsync({
//       value: values.value,
//       projectId,
//       model: selectedModel
//     });
//   };

//   const isPending = createMessage.isPending;
//   const isButtonDisabled = isPending || !form.formState.isValid;

//   return (
//     <div>
//       {showUsage && usage && (
//         <Usage
//           points={usage.remainingPoints}
//           msBeforeNext={usage.msBeforeNext}
//         />
//       )}

//       <Form {...form}>
//         <div
//           className={cn(
//             "border-x border-t rounded-t-xl bg-sidebar dark:bg-sidebar px-4 py-3",
//             showUsage && "border-t-0 rounded-t-none"
//           )}
//         >
//           <div className="flex items-center justify-between">
//             <span className="text-sm font-medium text-muted-foreground">
//               AI Model
//             </span>
//             <ModelSelector
//               selectedModel={selectedModel}
//               onModelChange={setSelectedModel}
//               isPremium={isPremium}
//             />
//           </div>
//         </div>

//         <form
//           onSubmit={form.handleSubmit(onSubmit)}
//           className={cn(
//             "relative border border-t-0 p-4 pt-1 rounded-b-xl bg-sidebar dark:bg-sidebar transition-all",
//             isFocused && "shadow-xs"
//           )}
//         >
//           <FormField
//             control={form.control}
//             name="value"
//             render={({ field }) => (
//               <FormControl>
//                 <TextareaAutoSize
//                   {...field}
//                   disabled={isPending}
//                   placeholder="What would you like to build?"
//                   className="w-full pt-4 resize-none border-none outline-none bg-transparent"
//                   minRows={2}
//                   maxRows={6}
//                   onFocus={() => setIsFocused(true)}
//                   onBlur={() => setIsFocused(false)}
//                   onKeyDown={(e) => {
//                     if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
//                       e.preventDefault();
//                       form.handleSubmit(onSubmit)();
//                     }
//                   }}
//                 />
//               </FormControl>
//             )}
//           />
//           <div className="flex gap-x-2 items-end justify-between pt-2">
//             <div className="text-[10px] text-muted-foreground font-mono">
//               <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
//                 <span>&#8984;</span>Enter
//               </kbd>
//               &nbsp;to submit
//             </div>
//             <Button
//               type="submit"
//               disabled={isButtonDisabled}
//               className={cn(
//                 "size-8 rounded-full",
//                 isButtonDisabled && "bg-muted-foreground border"
//               )}
//             >
//               {isPending ? (
//                 <Loader2 className="size-4 animate-spin" />
//               ) : (
//                 <ArrowUp className="size-4" />
//               )}
//             </Button>
//           </div>
//         </form>
//       </Form>
//     </div>
//   );
// };

// src/modules/projects/ui/components/message-form.tsx
// "use client";

// import Image from "next/image";
// import { useForm } from "react-hook-form";
// import { zodResolver } from "@hookform/resolvers/zod";
// import { z } from "zod";
// import { toast } from "sonner";
// import { useEffect, useState } from "react";
// import { cn } from "@/lib/utils";
// import { Button } from "@/components/ui/button";
// import { ArrowUp, Loader2, X } from "lucide-react";
// import TextareaAutoSize from "react-textarea-autosize";
// import { Form, FormField, FormControl } from "@/components/ui/form";
// import { Usage } from "./usage";
// import { ModelSelector, allModels } from "./model-selector";
// import { useRouter } from "next/navigation";
// import { useQueryClient } from "@tanstack/react-query";
// import { ImageUploadButton } from "./image-uploader";

// interface Props {
//   projectId: string;
//   isPremium?: boolean;
// }

// const formSchema = z
//   .object({
//     value: z.string().optional(),
//     image: z.string().optional(),
//   })
//   .refine((data) => !!(data.value && data.value.trim()) || !!data.image, {
//     message: "A prompt or an image is required.",
//     path: ["value"],
//   });

// type FormValues = z.infer<typeof formSchema>;

// interface UsageResponse {
//   remainingPoints: number;
//   msBeforeNext: number;
// }

// type UsageShape = UsageResponse | null;

// // --- Type guards ---
// function isUsageResponse(data: unknown): data is UsageResponse {
//   return (
//     typeof data === "object" &&
//     data !== null &&
//     "remainingPoints" in data &&
//     "msBeforeNext" in data &&
//     typeof (data as { remainingPoints: unknown }).remainingPoints === "number" &&
//     typeof (data as { msBeforeNext: unknown }).msBeforeNext === "number"
//   );
// }

// function hasMessage(err: unknown): err is { message: string } {
//   return (
//     typeof err === "object" &&
//     err !== null &&
//     "message" in err &&
//     typeof (err as { message: unknown }).message === "string"
//   );
// }

// function hasDataCode(err: unknown): err is { data: { code?: string } } {
//   return (
//     typeof err === "object" &&
//     err !== null &&
//     "data" in err &&
//     typeof (err as { data: unknown }).data === "object" &&
//     (err as { data: { code?: unknown } }).data.code !== undefined
//   );
// }

// export const MessageForm = ({ projectId, isPremium = false }: Props) => {
//   const router = useRouter();
//   const queryClient = useQueryClient();

//   const defaultModel = allModels.find((m) => m.isDefault) || allModels[0];
//   const [selectedModel, setSelectedModel] = useState<string>(defaultModel.id);
//   const [isFocused, setIsFocused] = useState(false);
//   const [imagePreview, setImagePreview] = useState<string | null>(null);

//   const [usage, setUsage] = useState<UsageShape>(null);
//   const [isLoading, setIsLoading] = useState(false);

//   // Fetch usage on mount
//   useEffect(() => {
//     let mounted = true;
//     (async () => {
//       try {
//         const res = await fetch("/api/rpc/usage/status");
//         if (!res.ok) {
//           console.error("usage.status fetch failed", await res.text());
//           return;
//         }
//         const data: unknown = await res.json();
//         if (isUsageResponse(data)) {
//           if (mounted) setUsage(data);
//         } else {
//           if (mounted) setUsage(null);
//         }
//       } catch (e) {
//         console.error("Failed to fetch usage.status", e);
//       }
//     })();
//     return () => {
//       mounted = false;
//     };
//   }, []);

//   const showUsage = usage !== null;

//   const form = useForm<FormValues>({
//     resolver: zodResolver(formSchema),
//     defaultValues: { value: "", image: undefined },
//     mode: "onChange",
//   });

//   const onSubmit = async (values: FormValues) => {
//     setIsLoading(true);
//     const payload = {
//       value: values.value ?? "",
//       image: values.image,
//       projectId,
//       model: selectedModel,
//     };

//     try {
//       const res = await fetch("/api/rpc/messages/create", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(payload),
//       });
//       if (!res.ok) {
//         const text = await res.text();
//         toast.error(`Server error: ${text}`);
//         setIsLoading(false);
//         return;
//       }
//       const body: unknown = await res.json();

//       // If backend returns error
//       if (
//         typeof body === "object" &&
//         body !== null &&
//         "error" in body &&
//         typeof (body as { error: unknown }).error === "string"
//       ) {
//         toast.error((body as { error: string }).error);
//         setIsLoading(false);
//         return;
//       }

//       // success: invalidate queries
//       queryClient.invalidateQueries({ queryKey: ["messages", projectId] });
//       queryClient.invalidateQueries({ queryKey: ["usage", "status"] });

//       try {
//         const r2 = await fetch("/api/rpc/usage/status");
//         if (r2.ok) {
//           const d2: unknown = await r2.json();
//           if (isUsageResponse(d2)) {
//             setUsage(d2);
//           }
//         }
//       } catch {
//         // ignore refresh errors
//       }

//       // Reset form
//       form.reset();
//       setImagePreview(null);
//     } catch (err: unknown) {
//       if (hasMessage(err)) toast.error(err.message);
//       else toast.error(String(err));
//       if (hasDataCode(err) && err.data.code === "TOO_MANY_REQUESTS") {
//         void router.push("/pricing");
//       }
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const handleImageReady = (url: string) => {
//     setImagePreview(url);
//     form.setValue("image", url, { shouldValidate: true, shouldDirty: true });
//   };

//   const removeImage = () => {
//     setImagePreview(null);
//     form.setValue("image", undefined, { shouldValidate: true, shouldDirty: true });
//   };

//   const isButtonDisabled = isLoading || !form.formState.isValid;

//   return (
//     <div>
//       {showUsage && usage && (
//         <Usage points={usage.remainingPoints} msBeforeNext={usage.msBeforeNext} />
//       )}

//       <Form {...form}>
//         <div
//           className={cn(
//             "border-x border-t rounded-t-xl bg-sidebar dark:bg-sidebar px-4 py-3",
//             showUsage && "border-t-0 rounded-t-none"
//           )}
//         >
//           <div className="flex items-center justify-between">
//             <span className="text-sm font-medium text-muted-foreground">
//               AI Model
//             </span>
//             <ModelSelector
//               selectedModel={selectedModel}
//               onModelChange={setSelectedModel}
//               isPremium={isPremium}
//             />
//           </div>
//         </div>

//         <form
//           onSubmit={form.handleSubmit(onSubmit)}
//           className={cn(
//             "relative border border-t-0 p-4 pt-1 rounded-b-xl bg-sidebar dark:bg-sidebar transition-all",
//             isFocused && "shadow-xs"
//           )}
//         >
//           {imagePreview && (
//             <div className="relative w-fit mb-2">
//               <div className="rounded-md overflow-hidden border">
//                 <Image
//                   src={imagePreview}
//                   alt="Preview"
//                   width={320}
//                   height={160}
//                   style={{ objectFit: "contain" }}
//                 />
//               </div>
//               <button
//                 type="button"
//                 onClick={removeImage}
//                 className="absolute top-0 right-0 -mt-2 -mr-2 bg-rose-500 text-white rounded-full p-0.5"
//               >
//                 <X className="h-3 w-3" />
//               </button>
//             </div>
//           )}

//           <FormField
//             control={form.control}
//             name="value"
//             render={({ field }) => (
//               <FormControl>
//                 <TextareaAutoSize
//                   {...field}
//                   disabled={isLoading}
//                   placeholder="What would you like to build? You can also upload an image..."
//                   className="w-full pt-4 resize-none border-none outline-none bg-transparent"
//                   minRows={2}
//                   maxRows={6}
//                   onFocus={() => setIsFocused(true)}
//                   onBlur={() => setIsFocused(false)}
//                   onKeyDown={(e) => {
//                     if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
//                       e.preventDefault();
//                       void form.handleSubmit(onSubmit)();
//                     }
//                   }}
//                 />
//               </FormControl>
//             )}
//           />

//           <div className="flex gap-x-2 items-end justify-between pt-2">
//             <div className="flex items-center gap-x-2">
//               <ImageUploadButton onImageReady={handleImageReady} />
//               <div className="text-[10px] text-muted-foreground font-mono">
//                 <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
//                   <span>&#8984;</span>Enter
//                 </kbd>
//                 &nbsp;to submit
//               </div>
//             </div>

//             <Button
//               type="submit"
//               disabled={isButtonDisabled}
//               className={cn(
//                 "size-8 rounded-full",
//                 isButtonDisabled && "bg-muted-foreground border"
//               )}
//             >
//               {isLoading ? (
//                 <Loader2 className="size-4 animate-spin" />
//               ) : (
//                 <ArrowUp className="size-4" />
//               )}
//             </Button>
//           </div>
//         </form>
//       </Form>
//     </div>
//   );
// };

// // src/modules/projects/ui/components/message-form.tsx
// "use client";

// import Image from "next/image";
// import { useForm } from "react-hook-form";
// import { zodResolver } from "@hookform/resolvers/zod";
// import { z } from "zod";
// import { toast } from "sonner";
// import { useEffect, useState } from "react";
// import { cn } from "@/lib/utils";
// import { Button } from "@/components/ui/button";
// import { ArrowUp, Loader2, X } from "lucide-react";
// import TextareaAutoSize from "react-textarea-autosize";
// import { Form, FormField, FormControl } from "@/components/ui/form";
// import { Usage } from "./usage";
// import { ModelSelector, allModels } from "./model-selector";
// import { useRouter } from "next/navigation";
// import { useQueryClient } from "@tanstack/react-query";
// import { ImageUploadButton } from "./image-uploader";

// interface Props {
//   projectId: string;
//   isPremium?: boolean;
// }

// const formSchema = z
//   .object({
//     value: z.string().optional(),
//     image: z.string().optional(),
//   })
//   .refine((data) => !!(data.value && data.value.trim()) || !!data.image, {
//     message: "A prompt or an image is required.",
//     path: ["value"],
//   });

// type FormValues = z.infer<typeof formSchema>;

// interface UsageResponse {
//   remainingPoints: number;
//   msBeforeNext: number;
// }

// type UsageShape = UsageResponse | null;

// function isUsageResponse(data: unknown): data is UsageResponse {
//   return (
//     typeof data === "object" &&
//     data !== null &&
//     "remainingPoints" in data &&
//     "msBeforeNext" in data &&
//     typeof (data as { remainingPoints: unknown }).remainingPoints === "number" &&
//     typeof (data as { msBeforeNext: unknown }).msBeforeNext === "number"
//   );
// }

// function hasMessage(err: unknown): err is { message: string } {
//   return (
//     typeof err === "object" &&
//     err !== null &&
//     "message" in err &&
//     typeof (err as { message: unknown }).message === "string"
//   );
// }

// function hasDataCode(err: unknown): err is { data: { code?: string } } {
//   return (
//     typeof err === "object" &&
//     err !== null &&
//     "data" in err &&
//     typeof (err as { data: unknown }).data === "object" &&
//     (err as { data: { code?: unknown } }).data.code !== undefined
//   );
// }

// export const MessageForm = ({ projectId, isPremium = false }: Props) => {
//   const router = useRouter();
//   const queryClient = useQueryClient();

//   const defaultModel = allModels.find((m) => m.isDefault) || allModels[0];
//   const [selectedModel, setSelectedModel] = useState<string>(defaultModel.id);
//   const [isFocused, setIsFocused] = useState(false);
//   const [imagePreview, setImagePreview] = useState<string | null>(null);

//   const [usage, setUsage] = useState<UsageShape>(null);
//   const [isLoading, setIsLoading] = useState(false);

//   // Fetch usage on mount
//   useEffect(() => {
//     let mounted = true;
//     (async () => {
//       try {
//         const res = await fetch("/api/rpc/usage/status");
//         if (!res.ok) {
//           console.error("usage.status fetch failed", await res.text());
//           return;
//         }
//         const data: unknown = await res.json();
//         if (isUsageResponse(data)) {
//           if (mounted) setUsage(data);
//         } else {
//           if (mounted) setUsage(null);
//         }
//       } catch (e) {
//         console.error("Failed to fetch usage.status", e);
//       }
//     })();
//     return () => {
//       mounted = false;
//     };
//   }, []);

//   const showUsage = usage !== null;

//   const form = useForm<FormValues>({
//     resolver: zodResolver(formSchema),
//     defaultValues: { value: "", image: undefined },
//     mode: "onChange",
//   });

//   const onSubmit = async (values: FormValues) => {
//     setIsLoading(true);
//     const payload = {
//       value: values.value ?? "",
//       image: values.image,
//       projectId,
//       model: selectedModel,
//     };

//     try {
//       const res = await fetch("/api/rpc/messages/create", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(payload),
//       });
//       if (!res.ok) {
//         const text = await res.text();
//         toast.error(`Server error: ${text}`);
//         setIsLoading(false);
//         return;
//       }
//       const body: unknown = await res.json();

//       // If backend returns error
//       if (
//         typeof body === "object" &&
//         body !== null &&
//         "error" in body &&
//         typeof (body as { error: unknown }).error === "string"
//       ) {
//         toast.error((body as { error: string }).error);
//         setIsLoading(false);
//         return;
//       }

//       // success: invalidate queries
//       queryClient.invalidateQueries({ queryKey: ["messages", projectId] });
//       queryClient.invalidateQueries({ queryKey: ["usage", "status"] });

//       // try to refresh usage
//       try {
//         const r2 = await fetch("/api/rpc/usage/status");
//         if (r2.ok) {
//           const d2: unknown = await r2.json();
//           if (isUsageResponse(d2)) {
//             setUsage(d2);
//           }
//         }
//       } catch {
//         // ignore refresh errors
//       }

//       // Reset form
//       form.reset();
//       setImagePreview(null);
//     } catch (err: unknown) {
//       if (hasMessage(err)) toast.error(err.message);
//       else toast.error(String(err));
//       if (hasDataCode(err) && err.data.code === "TOO_MANY_REQUESTS") {
//         void router.push("/pricing");
//       }
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const handleImageReady = (url: string) => {
//     setImagePreview(url);
//     form.setValue("image", url, { shouldValidate: true, shouldDirty: true });
//   };

//   const removeImage = () => {
//     setImagePreview(null);
//     form.setValue("image", undefined, { shouldValidate: true, shouldDirty: true });
//   };

//   const isButtonDisabled = isLoading || !form.formState.isValid;

//   return (
//     <div>
//       {showUsage && usage && (
//         <Usage points={usage.remainingPoints} msBeforeNext={usage.msBeforeNext} />
//       )}

//       <Form {...form}>
//         <div
//           className={cn(
//             "border-x border-t rounded-t-xl bg-sidebar dark:bg-sidebar px-4 py-3",
//             showUsage && "border-t-0 rounded-t-none"
//           )}
//         >
//           <div className="flex items-center justify-between">
//             <span className="text-sm font-medium text-muted-foreground">AI Model</span>
//             <ModelSelector
//               selectedModel={selectedModel}
//               onModelChange={setSelectedModel}
//               isPremium={isPremium}
//             />
//           </div>
//         </div>

//         <form
//           onSubmit={form.handleSubmit(onSubmit)}
//           className={cn(
//             "relative border border-t-0 p-4 pt-1 rounded-b-xl bg-sidebar dark:bg-sidebar transition-all",
//             isFocused && "shadow-xs"
//           )}
//         >
//           {imagePreview && (
//             <div className="relative w-fit mb-2">
//               <div className="rounded-md overflow-hidden border">
//                 <Image
//                   src={imagePreview}
//                   alt="Preview"
//                   width={320}
//                   height={160}
//                   style={{ objectFit: "contain" }}
//                 />
//               </div>
//               <button
//                 type="button"
//                 onClick={removeImage}
//                 className="absolute top-0 right-0 -mt-2 -mr-2 bg-rose-500 text-white rounded-full p-0.5"
//               >
//                 <X className="h-3 w-3" />
//               </button>
//             </div>
//           )}

//           <FormField
//             control={form.control}
//             name="value"
//             render={({ field }) => (
//               <FormControl>
//                 <TextareaAutoSize
//                   {...field}
//                   disabled={isLoading}
//                   placeholder="What would you like to build? You can also upload an image..."
//                   className="w-full pt-4 resize-none border-none outline-none bg-transparent"
//                   minRows={2}
//                   maxRows={6}
//                   onFocus={() => setIsFocused(true)}
//                   onBlur={() => setIsFocused(false)}
//                   onKeyDown={(e) => {
//                     if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
//                       e.preventDefault();
//                       void form.handleSubmit(onSubmit)();
//                     }
//                   }}
//                 />
//               </FormControl>
//             )}
//           />

//           <div className="flex gap-x-2 items-end justify-between pt-2">
//             <div className="flex items-center gap-x-2">
//               <ImageUploadButton onImageReady={handleImageReady} />
//               <div className="text-[10px] text-muted-foreground font-mono">
//                 <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
//                   <span>&#8984;</span>Enter
//                 </kbd>
//                 &nbsp;to submit
//               </div>
//             </div>

//             <Button
//               type="submit"
//               disabled={isButtonDisabled}
//               className={cn("size-8 rounded-full", isButtonDisabled && "bg-muted-foreground border")}
//             >
//               {isLoading ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
//             </Button>
//           </div>
//         </form>
//       </Form>
//     </div>
//   );
// };
// src/modules/projects/ui/components/message-form.tsx
// "use client";

// import Image from "next/image";
// import { useForm } from "react-hook-form";
// import { zodResolver } from "@hookform/resolvers/zod";
// import { z } from "zod";
// import { toast } from "sonner";
// import { useState } from "react";
// import { cn } from "@/lib/utils";
// import { Button } from "@/components/ui/button";
// import { ArrowUp, Loader2, X } from "lucide-react";
// import TextareaAutoSize from "react-textarea-autosize";
// import { Form, FormField, FormControl } from "@/components/ui/form";
// import { Usage } from "./usage";
// import { ModelSelector, allModels } from "./model-selector";
// import { useRouter } from "next/navigation";
// import { useQueryClient } from "@tanstack/react-query";
// import { ImageUploadButton } from "./image-uploader";
// import { useTRPC } from "@/trpc/client";

// interface Props {
//   projectId: string;
//   isPremium?: boolean;
// }

// /**
//  * Form schema: either `value` text or an `image` url is required.
//  */
// const formSchema = z
//   .object({
//     value: z.string().optional(),
//     image: z.string().optional(),
//   })
//   .refine((data) => !!(data.value && data.value.trim()) || !!data.image, {
//     message: "A prompt or an image is required.",
//     path: ["value"],
//   });

// type FormValues = z.infer<typeof formSchema>;

// /**
//  * Minimal error shape guard to show error.message when present.
//  */
// function hasMessage(err: unknown): err is { message: string } {
//   return typeof err === "object" && err !== null && "message" in (err as Record<string, unknown>) && typeof (err as Record<string, unknown>).message === "string";
// }

// export const MessageForm = ({ projectId, isPremium = false }: Props) => {
//   const router = useRouter();
//   const queryClient = useQueryClient();
//   const trpc = useTRPC(); // must import from client (not server proxy)

//   const defaultModel = allModels.find((m) => m.isDefault) ?? allModels[0];
//   const [selectedModel, setSelectedModel] = useState<string>(defaultModel.id);
//   const [isFocused, setIsFocused] = useState(false);
//   const [imagePreview, setImagePreview] = useState<string | null>(null);

//   // usage via tRPC hook (typed by your AppRouter)
//   const usageQuery = trpc.usage.status.useQuery(undefined, { staleTime: 30_000 });
//   const usage = usageQuery.data ?? null;
//   const showUsage = usage !== null;

//   const form = useForm<FormValues>({
//     resolver: zodResolver(formSchema),
//     defaultValues: { value: "", image: undefined },
//     mode: "onChange",
//   });

//   // create message mutation (typed)
//   const createMessageMutation = trpc.messages.create.useMutation({
//     onSuccess: () => {
//       void queryClient.invalidateQueries({ queryKey: ["messages", projectId] });
//       void queryClient.invalidateQueries({ queryKey: ["usage", "status"] });
//       form.reset();
//       setImagePreview(null);
//     },
//     onError: (err) => {
//       if (hasMessage(err)) toast.error(err.message);
//       else toast.error(String(err ?? "Unknown error"));

//       // if server returned a tRPC "TOO_MANY_REQUESTS" style code, route user to pricing
//       // (this check is conservative because exact error shape may differ)
//       const maybeCode = (err as any)?.data?.code;
//       if (maybeCode === "TOO_MANY_REQUESTS") {
//         void router.push("/pricing");
//       }
//     },
//   });

//   const onSubmit = async (values: FormValues) => {
//     // Build payload consistent with server: `value`, `image`, `projectId`, `model`
//     const payload = {
//       value: values.value ?? "",
//       image: values.image,
//       projectId,
//       model: selectedModel,
//     };

//     try {
//       // use the typed mutateAsync
//       await createMessageMutation.mutateAsync(payload);
//     } catch (err) {
//       // onError runs for mutation errors, but catch still helpful for unexpected rejections
//       if (hasMessage(err)) toast.error(err.message);
//       else toast.error(String(err ?? "Unknown error"));
//     }
//   };

//   const handleImageReady = (url: string) => {
//     setImagePreview(url);
//     form.setValue("image", url, { shouldValidate: true, shouldDirty: true });
//   };

//   const removeImage = () => {
//     setImagePreview(null);
//     form.setValue("image", undefined, { shouldValidate: true, shouldDirty: true });
//   };

//   const isLoading = createMessageMutation.isLoading;
//   const isButtonDisabled = isLoading || !form.formState.isValid;

//   return (
//     <div>
//       {showUsage && usage && <Usage points={usage.remainingPoints} msBeforeNext={usage.msBeforeNext} />}

//       <Form {...form}>
//         <div className={cn("border-x border-t rounded-t-xl bg-sidebar dark:bg-sidebar px-4 py-3", showUsage && "border-t-0 rounded-t-none")}>
//           <div className="flex items-center justify-between">
//             <span className="text-sm font-medium text-muted-foreground">AI Model</span>
//             <ModelSelector selectedModel={selectedModel} onModelChange={setSelectedModel} isPremium={isPremium} />
//           </div>
//         </div>

//         <form onSubmit={form.handleSubmit(onSubmit)} className={cn("relative border border-t-0 p-4 pt-1 rounded-b-xl bg-sidebar dark:bg-sidebar transition-all", isFocused && "shadow-xs")}>
//           {imagePreview && (
//             <div className="relative w-fit mb-2">
//               <div className="rounded-md overflow-hidden border">
//                 <Image src={imagePreview} alt="Preview" width={320} height={160} style={{ objectFit: "contain" }} />
//               </div>
//               <button type="button" onClick={removeImage} className="absolute top-0 right-0 -mt-2 -mr-2 bg-rose-500 text-white rounded-full p-0.5">
//                 <X className="h-3 w-3" />
//               </button>
//             </div>
//           )}

//           <FormField control={form.control} name="value" render={({ field }) => (
//             <FormControl>
//               <TextareaAutoSize
//                 {...field}
//                 disabled={isLoading}
//                 placeholder="What would you like to build? You can also upload an image..."
//                 className="w-full pt-4 resize-none border-none outline-none bg-transparent"
//                 minRows={2}
//                 maxRows={6}
//                 onFocus={() => setIsFocused(true)}
//                 onBlur={() => setIsFocused(false)}
//                 onKeyDown={(e) => {
//                   if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
//                     e.preventDefault();
//                     void form.handleSubmit(onSubmit)();
//                   }
//                 }}
//               />
//             </FormControl>
//           )} />

//           <div className="flex gap-x-2 items-end justify-between pt-2">
//             <div className="flex items-center gap-x-2">
//               <ImageUploadButton onImageReady={handleImageReady} />
//               <div className="text-[10px] text-muted-foreground font-mono">
//                 <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
//                   <span>&#8984;</span>Enter
//                 </kbd>
//                 &nbsp;to submit
//               </div>
//             </div>

//             <Button type="submit" disabled={isButtonDisabled} className={cn("size-8 rounded-full", isButtonDisabled && "bg-muted-foreground border")}>
//               {isLoading ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
//             </Button>
//           </div>
//         </form>
//       </Form>
//     </div>
//   );
// };

// // src/modules/projects/ui/components/message-form.tsx
// "use client";

// import Image from "next/image";
// import { useForm } from "react-hook-form";
// import { zodResolver } from "@hookform/resolvers/zod";
// import { z } from "zod";
// import { toast } from "sonner";
// import { useState } from "react";
// import { cn } from "@/lib/utils";
// import { Button } from "@/components/ui/button";
// import { ArrowUp, Loader2, X } from "lucide-react";
// import TextareaAutoSize from "react-textarea-autosize";
// import { Form, FormField, FormControl } from "@/components/ui/form";
// import { Usage } from "./usage";
// import { ModelSelector, allModels } from "./model-selector";
// import { useRouter } from "next/navigation";
// import { useQueryClient } from "@tanstack/react-query";
// import { ImageUploadButton } from "./image-uploader";
// import { useTRPC } from "@/trpc/client";

// interface Props {
//   projectId: string;
//   isPremium?: boolean;
// }

// /**
//  * Form schema: either `value` text or an `image` url is required.
//  */
// const formSchema = z
//   .object({
//     value: z.string().optional(),
//     image: z.string().optional(),
//   })
//   .refine((data) => !!(data.value && data.value.trim()) || !!data.image, {
//     message: "A prompt or an image is required.",
//     path: ["value"],
//   });

// type FormValues = z.infer<typeof formSchema>;

// /**
//  * Minimal error shape guard to show error.message when present.
//  */
// function hasMessage(err: unknown): err is { message: string } {
//   return (
//     typeof err === "object" &&
//     err !== null &&
//     "message" in (err as Record<string, unknown>) &&
//     typeof (err as Record<string, unknown>).message === "string"
//   );
// }

// /**
//  * Safely extract `data.code` if present on some error shapes coming from tRPC / server.
//  */
// function getErrorCode(err: unknown): string | undefined {
//   if (typeof err !== "object" || err === null) return undefined;
//   const e = err as Record<string, unknown>;
//   const data = e.data;
//   if (typeof data !== "object" || data === null) return undefined;
//   const d = data as Record<string, unknown>;
//   const code = d.code;
//   return typeof code === "string" ? code : undefined;
// }

// export const MessageForm = ({ projectId, isPremium = false }: Props) => {
//   const router = useRouter();
//   const queryClient = useQueryClient();
//   // NOTE: cast to `any` to avoid editor/ts complaints about missing .useQuery/.useMutation
//   // This is a pragmatic local fix — if you prefer a full typed solution we can adjust
//   // your tRPC client exports / AppRouter typing so TypeScript recognizes the hooks.
//   const trpc = useTRPC() as any;

//   const defaultModel = allModels.find((m) => m.isDefault) ?? allModels[0];
//   const [selectedModel, setSelectedModel] = useState<string>(defaultModel.id);
//   const [isFocused, setIsFocused] = useState(false);
//   const [imagePreview, setImagePreview] = useState<string | null>(null);

//   // usage via tRPC hook
//   const usageQuery = trpc.usage.status.useQuery?.(undefined, { staleTime: 30_000 }) ?? { data: null };
//   const usage = usageQuery.data ?? null;
//   const showUsage = usage !== null;

//   const form = useForm<FormValues>({
//     resolver: zodResolver(formSchema),
//     defaultValues: { value: "", image: undefined },
//     mode: "onChange",
//   });

//   // create message mutation (typed if your client types are wired up; otherwise cast above)
//   const createMessageMutation = trpc.messages.create.useMutation({
//     onSuccess: () => {
//       void queryClient.invalidateQueries({ queryKey: ["messages", projectId] });
//       void queryClient.invalidateQueries({ queryKey: ["usage", "status"] });
//       form.reset();
//       setImagePreview(null);
//     },
//     onError: (err: unknown) => {
//       if (hasMessage(err)) toast.error(err.message);
//       else toast.error(String(err ?? "Unknown error"));

//       const code = getErrorCode(err);
//       if (code === "TOO_MANY_REQUESTS") {
//         void router.push("/pricing");
//       }
//     },
//   });

//   const onSubmit = async (values: FormValues) => {
//     const payload = {
//       value: values.value ?? "",
//       image: values.image,
//       projectId,
//       model: selectedModel,
//     };

//     try {
//       await createMessageMutation.mutateAsync(payload);
//     } catch (err: unknown) {
//       // mutation onError already handles toast/navigation, but handle fallback here too
//       if (hasMessage(err)) toast.error(err.message);
//       else toast.error(String(err ?? "Unknown error"));
//       const code = getErrorCode(err);
//       if (code === "TOO_MANY_REQUESTS") void router.push("/pricing");
//     }
//   };

//   const handleImageReady = (url: string) => {
//     setImagePreview(url);
//     form.setValue("image", url, { shouldValidate: true, shouldDirty: true });
//   };

//   const removeImage = () => {
//     setImagePreview(null);
//     form.setValue("image", undefined, { shouldValidate: true, shouldDirty: true });
//   };

//   const isLoading = createMessageMutation.isLoading;
//   const isButtonDisabled = isLoading || !form.formState.isValid;

//   return (
//     <div>
//       {showUsage && usage && <Usage points={usage.remainingPoints} msBeforeNext={usage.msBeforeNext} />}

//       <Form {...form}>
//         <div className={cn("border-x border-t rounded-t-xl bg-sidebar dark:bg-sidebar px-4 py-3", showUsage && "border-t-0 rounded-t-none")}>
//           <div className="flex items-center justify-between">
//             <span className="text-sm font-medium text-muted-foreground">AI Model</span>
//             <ModelSelector selectedModel={selectedModel} onModelChange={setSelectedModel} isPremium={isPremium} />
//           </div>
//         </div>

//         <form onSubmit={form.handleSubmit(onSubmit)} className={cn("relative border border-t-0 p-4 pt-1 rounded-b-xl bg-sidebar dark:bg-sidebar transition-all", isFocused && "shadow-xs")}>
//           {imagePreview && (
//             <div className="relative w-fit mb-2">
//               <div className="rounded-md overflow-hidden border">
//                 <Image src={imagePreview} alt="Preview" width={320} height={160} style={{ objectFit: "contain" }} />
//               </div>
//               <button type="button" onClick={removeImage} className="absolute top-0 right-0 -mt-2 -mr-2 bg-rose-500 text-white rounded-full p-0.5">
//                 <X className="h-3 w-3" />
//               </button>
//             </div>
//           )}

//           <FormField control={form.control} name="value" render={({ field }) => (
//             <FormControl>
//               <TextareaAutoSize
//                 {...field}
//                 disabled={isLoading}
//                 placeholder="What would you like to build? You can also upload an image..."
//                 className="w-full pt-4 resize-none border-none outline-none bg-transparent"
//                 minRows={2}
//                 maxRows={6}
//                 onFocus={() => setIsFocused(true)}
//                 onBlur={() => setIsFocused(false)}
//                 onKeyDown={(e) => {
//                   if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
//                     e.preventDefault();
//                     void form.handleSubmit(onSubmit)();
//                   }
//                 }}
//               />
//             </FormControl>
//           )} />

//           <div className="flex gap-x-2 items-end justify-between pt-2">
//             <div className="flex items-center gap-x-2">
//               <ImageUploadButton onImageReady={handleImageReady} />
//               <div className="text-[10px] text-muted-foreground font-mono">
//                 <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
//                   <span>&#8984;</span>Enter
//                 </kbd>
//                 &nbsp;to submit
//               </div>
//             </div>

//             <Button type="submit" disabled={isButtonDisabled} className={cn("size-8 rounded-full", isButtonDisabled && "bg-muted-foreground border")}>
//               {isLoading ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
//             </Button>
//           </div>
//         </form>
//       </Form>
//     </div>
//   );
// };
// src/modules/projects/ui/components/message-form.tsx
// "use client";

// import Image from "next/image";
// import { useForm } from "react-hook-form";
// import { zodResolver } from "@hookform/resolvers/zod";
// import { z } from "zod";
// import { toast } from "sonner";
// import { useState, useEffect } from "react";
// import { cn } from "@/lib/utils";
// import { Button } from "@/components/ui/button";
// import { ArrowUp, Loader2, X } from "lucide-react";
// import TextareaAutoSize from "react-textarea-autosize";
// import { Form, FormField, FormControl } from "@/components/ui/form";
// import { Usage } from "./usage";
// import { ModelSelector, allModels } from "./model-selector";
// import { useQueryClient } from "@tanstack/react-query";
// import { ImageUploadButton } from "./image-uploader";

// interface Props {
//   projectId: string;
//   isPremium?: boolean;
// }

// /**
//  * Client form schema: either `value` text or an `image` url is required.
//  */
// const formSchema = z
//   .object({
//     value: z.string().optional(),
//     image: z.string().optional(),
//   })
//   .refine((data) => !!(data.value && data.value.trim()) || !!data.image, {
//     message: "A prompt or an image is required.",
//     path: ["value"],
//   });

// type FormValues = z.infer<typeof formSchema>;

// interface UsageResponse {
//   remainingPoints: number;
//   msBeforeNext: number;
// }

// type UsageShape = UsageResponse | null;

// function hasMessage(err: unknown): err is { message: string } {
//   return (
//     typeof err === "object" &&
//     err !== null &&
//     "message" in (err as Record<string, unknown>) &&
//     typeof (err as Record<string, unknown>).message === "string"
//   );
// }

// export const MessageForm = ({ projectId, isPremium = false }: Props) => {
//   const queryClient = useQueryClient();

//   const defaultModel = allModels.find((m) => m.isDefault) ?? allModels[0];
//   const [selectedModel, setSelectedModel] = useState<string>(defaultModel.id);
//   const [isFocused, setIsFocused] = useState(false);
//   const [imagePreview, setImagePreview] = useState<string | null>(null);

//   const [usage, setUsage] = useState<UsageShape>(null);
//   const [isLoading, setIsLoading] = useState(false);

//   // Fetch usage on mount (GET /api/usage/status)
//   useEffect(() => {
//     let mounted = true;
//     (async () => {
//       try {
//         const res = await fetch("/api/usage/status");
//         if (!res.ok) {
//           console.error("usage.status fetch failed", await res.text());
//           if (mounted) setUsage(null);
//           return;
//         }
//         const data: unknown = await res.json();
//         if (
//           data &&
//           typeof data === "object" &&
//           "remainingPoints" in data &&
//           "msBeforeNext" in data &&
//           typeof (data as Record<string, unknown>).remainingPoints === "number" &&
//           typeof (data as Record<string, unknown>).msBeforeNext === "number"
//         ) {
//           if (mounted)
//             setUsage({
//               remainingPoints: (data as UsageResponse).remainingPoints,
//               msBeforeNext: (data as UsageResponse).msBeforeNext,
//             });
//         } else {
//           if (mounted) setUsage(null);
//         }
//       } catch (e) {
//         console.error("Failed to fetch usage.status", e);
//         if (mounted) setUsage(null);
//       }
//     })();
//     return () => {
//       mounted = false;
//     };
//   }, []);

//   const showUsage = usage !== null;

//   const form = useForm<FormValues>({
//     resolver: zodResolver(formSchema),
//     defaultValues: { value: "", image: undefined },
//     mode: "onChange",
//   });

//   const onSubmit = async (values: FormValues) => {
//     setIsLoading(true);

//     const payload = {
//       value: values.value ?? "",
//       image: values.image,
//       projectId,
//       model: selectedModel,
//     };

//     try {
//       const res = await fetch("/api/messages/create", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(payload),
//       });

//       if (res.status === 401) {
//         toast.error("You must be signed in to perform this action.");
//         setIsLoading(false);
//         return;
//       }

//       if (!res.ok) {
//         const text = await res.text();
//         toast.error(`Server error: ${text}`);
//         setIsLoading(false);
//         return;
//       }

//       // success
//       void queryClient.invalidateQueries({ queryKey: ["messages", projectId] });

//       // refresh usage
//       try {
//         const r2 = await fetch("/api/usage/status");
//         if (r2.ok) {
//           const d2: unknown = await r2.json();
//           if (
//             d2 &&
//             typeof d2 === "object" &&
//             "remainingPoints" in d2 &&
//             "msBeforeNext" in d2 &&
//             typeof (d2 as Record<string, unknown>).remainingPoints === "number" &&
//             typeof (d2 as Record<string, unknown>).msBeforeNext === "number"
//           ) {
//             setUsage({
//               remainingPoints: (d2 as UsageResponse).remainingPoints,
//               msBeforeNext: (d2 as UsageResponse).msBeforeNext,
//             });
//           }
//         }
//       } catch {
//         // ignore
//       }

//       form.reset();
//       setImagePreview(null);
//     } catch (err: unknown) {
//       if (hasMessage(err)) toast.error(err.message);
//       else toast.error(String(err ?? "Unknown error"));
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const handleImageReady = (url: string) => {
//     setImagePreview(url);
//     form.setValue("image", url, { shouldValidate: true, shouldDirty: true });
//   };

//   const removeImage = () => {
//     setImagePreview(null);
//     form.setValue("image", undefined, { shouldValidate: true, shouldDirty: true });
//   };

//   const isButtonDisabled = isLoading || !form.formState.isValid;

//   return (
//     <div>
//       {showUsage && usage && <Usage points={usage.remainingPoints} msBeforeNext={usage.msBeforeNext} />}

//       <Form {...form}>
//         <div className={cn("border-x border-t rounded-t-xl bg-sidebar dark:bg-sidebar px-4 py-3", showUsage && "border-t-0 rounded-t-none")}>
//           <div className="flex items-center justify-between">
//             <span className="text-sm font-medium text-muted-foreground">AI Model</span>
//             <ModelSelector selectedModel={selectedModel} onModelChange={setSelectedModel} isPremium={isPremium} />
//           </div>
//         </div>

//         <form onSubmit={form.handleSubmit(onSubmit)} className={cn("relative border border-t-0 p-4 pt-1 rounded-b-xl bg-sidebar dark:bg-sidebar transition-all", isFocused && "shadow-xs")}>
//           {imagePreview && (
//             <div className="relative w-fit mb-2">
//               <div className="rounded-md overflow-hidden border">
//                 <Image src={imagePreview} alt="Preview" width={320} height={160} style={{ objectFit: "contain" }} />
//               </div>
//               <button type="button" onClick={removeImage} className="absolute top-0 right-0 -mt-2 -mr-2 bg-rose-500 text-white rounded-full p-0.5">
//                 <X className="h-3 w-3" />
//               </button>
//             </div>
//           )}

//           <FormField control={form.control} name="value" render={({ field }) => (
//             <FormControl>
//               <TextareaAutoSize
//                 {...field}
//                 disabled={isLoading}
//                 placeholder="What would you like to build? You can also upload an image..."
//                 className="w-full pt-4 resize-none border-none outline-none bg-transparent"
//                 minRows={2}
//                 maxRows={6}
//                 onFocus={() => setIsFocused(true)}
//                 onBlur={() => setIsFocused(false)}
//                 onKeyDown={(e) => {
//                   if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
//                     e.preventDefault();
//                     void form.handleSubmit(onSubmit)();
//                   }
//                 }}
//               />
//             </FormControl>
//           )} />

//           <div className="flex gap-x-2 items-end justify-between pt-2">
//             <div className="flex items-center gap-x-2">
//               <ImageUploadButton onImageReady={handleImageReady} />
//               <div className="text-[10px] text-muted-foreground font-mono">
//                 <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
//                   <span>&#8984;</span>Enter
//                 </kbd>
//                 &nbsp;to submit
//               </div>
//             </div>

//             <Button type="submit" disabled={isButtonDisabled} className={cn("size-8 rounded-full", isButtonDisabled && "bg-muted-foreground border")}>
//               {isLoading ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
//             </Button>
//           </div>
//         </form>
//       </Form>
//     </div>
//   );
// };


// src/modules/projects/ui/components/message-form.tsx
// "use client";

// import Image from "next/image";
// import { useForm } from "react-hook-form";
// import { zodResolver } from "@hookform/resolvers/zod";
// import { z } from "zod";
// import { toast } from "sonner";
// import { useState, useEffect } from "react";
// import { cn } from "@/lib/utils";
// import { Button } from "@/components/ui/button";
// import { ArrowUp, Loader2, X } from "lucide-react";
// import TextareaAutoSize from "react-textarea-autosize";
// import { Form, FormField, FormControl } from "@/components/ui/form";
// import { Usage } from "./usage";
// import { ModelSelector, allModels } from "./model-selector";
// import { useQueryClient } from "@tanstack/react-query";
// import { ImageUploadButton } from "./image-uploader";

// interface Props {
//   projectId: string;
//   isPremium?: boolean;
// }

// /**
//  * Client form schema: either `value` text or an `image` url is required.
//  */
// const formSchema = z
//   .object({
//     value: z.string().optional(),
//     image: z.string().optional(),
//   })
//   .refine((data) => !!(data.value && data.value.trim()) || !!data.image, {
//     message: "A prompt or an image is required.",
//     path: ["value"],
//   });

// type FormValues = z.infer<typeof formSchema>;

// interface UsageResponse {
//   remainingPoints: number;
//   msBeforeNext: number;
// }

// type UsageShape = UsageResponse | null;

// /** Type-guard for usage response received from the server. */
// function isUsageResponse(data: unknown): data is UsageResponse {
//   return (
//     typeof data === "object" &&
//     data !== null &&
//     "remainingPoints" in data &&
//     "msBeforeNext" in data &&
//     typeof (data as Record<string, unknown>).remainingPoints === "number" &&
//     typeof (data as Record<string, unknown>).msBeforeNext === "number"
//   );
// }

// /** Minimal error shape guard to show `error.message` when present. */
// function hasMessage(err: unknown): err is { message: string } {
//   return (
//     typeof err === "object" &&
//     err !== null &&
//     "message" in (err as Record<string, unknown>) &&
//     typeof (err as Record<string, unknown>).message === "string"
//   );
// }

// export const MessageForm = ({ projectId, isPremium = false }: Props) => {
//   const queryClient = useQueryClient();

//   const defaultModel = allModels.find((m) => m.isDefault) ?? allModels[0];
//   const [selectedModel, setSelectedModel] = useState<string>(defaultModel.id);
//   const [isFocused, setIsFocused] = useState(false);
//   const [imagePreview, setImagePreview] = useState<string | null>(null);

//   const [usage, setUsage] = useState<UsageShape>(null);
//   const [isLoading, setIsLoading] = useState(false);

//   // Fetch usage on mount (GET /api/usage/status)
//   useEffect(() => {
//     let mounted = true;
//     (async () => {
//       try {
//         const res = await fetch("/api/usage/status");
//         if (!res.ok) {
//           console.error("usage.status fetch failed", await res.text());
//           if (mounted) setUsage(null);
//           return;
//         }
//         const data: unknown = await res.json();
//         if (isUsageResponse(data)) {
//           if (mounted) setUsage(data);
//         } else {
//           if (mounted) setUsage(null);
//         }
//       } catch (e) {
//         console.error("Failed to fetch usage.status", e);
//         if (mounted) setUsage(null);
//       }
//     })();
//     return () => {
//       mounted = false;
//     };
//   }, []);

//   const showUsage = usage !== null;

//   const form = useForm<FormValues>({
//     resolver: zodResolver(formSchema),
//     defaultValues: { value: "", image: undefined },
//     mode: "onChange",
//   });

//   const onSubmit = async (values: FormValues) => {
//     setIsLoading(true);

//     const payload = {
//       value: values.value ?? "",
//       image: values.image,
//       projectId,
//       model: selectedModel,
//     };

//     try {
//       const res = await fetch("/api/messages/create", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(payload),
//       });

//       if (res.status === 401) {
//         toast.error("You must be signed in to perform this action.");
//         setIsLoading(false);
//         return;
//       }

//       if (!res.ok) {
//         const text = await res.text();
//         toast.error(`Server error: ${text}`);
//         setIsLoading(false);
//         return;
//       }

//       // success
//       void queryClient.invalidateQueries({ queryKey: ["messages", projectId] });

//       // refresh usage
//       try {
//         const r2 = await fetch("/api/usage/status");
//         if (r2.ok) {
//           const d2: unknown = await r2.json();
//           if (isUsageResponse(d2)) {
//             setUsage(d2);
//           }
//         }
//       } catch {
//         // ignore refresh errors
//       }

//       form.reset();
//       setImagePreview(null);
//     } catch (err: unknown) {
//       if (hasMessage(err)) toast.error(err.message);
//       else toast.error(String(err ?? "Unknown error"));
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const handleImageReady = (url: string) => {
//     setImagePreview(url);
//     form.setValue("image", url, { shouldValidate: true, shouldDirty: true });
//   };

//   const removeImage = () => {
//     setImagePreview(null);
//     form.setValue("image", undefined, { shouldValidate: true, shouldDirty: true });
//   };

//   const isButtonDisabled = isLoading || !form.formState.isValid;

//   return (
//     <div>
//       {showUsage && usage && <Usage points={usage.remainingPoints} msBeforeNext={usage.msBeforeNext} />}

//       <Form {...form}>
//         <div
//           className={cn(
//             "border-x border-t rounded-t-xl bg-sidebar dark:bg-sidebar px-4 py-3",
//             showUsage && "border-t-0 rounded-t-none"
//           )}
//         >
//           <div className="flex items-center justify-between">
//             <span className="text-sm font-medium text-muted-foreground">AI Model</span>
//             <ModelSelector selectedModel={selectedModel} onModelChange={setSelectedModel} isPremium={isPremium} />
//           </div>
//         </div>

//         <form
//           onSubmit={form.handleSubmit(onSubmit)}
//           className={cn(
//             "relative border border-t-0 p-4 pt-1 rounded-b-xl bg-sidebar dark:bg-sidebar transition-all",
//             isFocused && "shadow-xs"
//           )}
//         >
//           {imagePreview && (
//             <div className="relative w-fit mb-2">
//               <div className="rounded-md overflow-hidden border">
//                 <Image src={imagePreview} alt="Preview" width={320} height={160} style={{ objectFit: "contain" }} />
//               </div>
//               <button
//                 type="button"
//                 onClick={removeImage}
//                 className="absolute top-0 right-0 -mt-2 -mr-2 bg-rose-500 text-white rounded-full p-0.5"
//                 aria-label="Remove image"
//               >
//                 <X className="h-3 w-3" />
//               </button>
//             </div>
//           )}

//           <FormField
//             control={form.control}
//             name="value"
//             render={({ field }) => (
//               <FormControl>
//                 <TextareaAutoSize
//                   {...field}
//                   disabled={isLoading}
//                   placeholder="What would you like to build? You can also upload an image..."
//                   className="w-full pt-4 resize-none border-none outline-none bg-transparent"
//                   minRows={2}
//                   maxRows={6}
//                   onFocus={() => setIsFocused(true)}
//                   onBlur={() => setIsFocused(false)}
//                   onKeyDown={(e) => {
//                     if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
//                       e.preventDefault();
//                       void form.handleSubmit(onSubmit)();
//                     }
//                   }}
//                 />
//               </FormControl>
//             )}
//           />

//           <div className="flex gap-x-2 items-end justify-between pt-2">
//             <div className="flex items-center gap-x-2">
//               <ImageUploadButton onImageReady={handleImageReady} />
//               <div className="text-[10px] text-muted-foreground font-mono">
//                 <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
//                   <span>&#8984;</span>Enter
//                 </kbd>
//                 &nbsp;to submit
//               </div>
//             </div>

//             <Button type="submit" disabled={isButtonDisabled} className={cn("size-8 rounded-full", isButtonDisabled && "bg-muted-foreground border")}>
//               {isLoading ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
//             </Button>
//           </div>
//         </form>
//       </Form>
//     </div>
//   );
// };


// // src/modules/projects/ui/components/message-form.tsx
// "use client";

// import Image from "next/image";
// import { useForm } from "react-hook-form";
// import { zodResolver } from "@hookform/resolvers/zod";
// import { z } from "zod";
// import { toast } from "sonner";
// import { useState, useEffect } from "react";
// import { cn } from "@/lib/utils";
// import { Button } from "@/components/ui/button";
// import { ArrowUp, Loader2, X } from "lucide-react";
// import TextareaAutoSize from "react-textarea-autosize";
// import { Form, FormField, FormControl } from "@/components/ui/form";
// import { Usage } from "./usage";
// import { ModelSelector, allModels } from "./model-selector";
// import { useQueryClient } from "@tanstack/react-query";
// import { ImageUploadButton } from "./image-uploader";

// interface Props {
//   projectId: string;
//   isPremium?: boolean;
// }

// /**
//  * Client form schema: either `value` text or an `image` url is required.
//  */
// const formSchema = z
//   .object({
//     value: z.string().optional(),
//     image: z.string().optional(),
//   })
//   .refine((data) => !!(data.value && data.value.trim()) || !!data.image, {
//     message: "A prompt or an image is required.",
//     path: ["value"],
//   });

// type FormValues = z.infer<typeof formSchema>;

// interface UsageResponse {
//   remainingPoints: number;
//   msBeforeNext: number;
// }

// type UsageShape = UsageResponse | null;

// /** Type-guard for usage response received from the server. */
// function isUsageResponse(data: unknown): data is UsageResponse {
//   return (
//     typeof data === "object" &&
//     data !== null &&
//     "remainingPoints" in data &&
//     "msBeforeNext" in data &&
//     typeof (data as Record<string, unknown>).remainingPoints === "number" &&
//     typeof (data as Record<string, unknown>).msBeforeNext === "number"
//   );
// }

// /** Minimal error shape guard to show `error.message` when present. */
// function hasMessage(err: unknown): err is { message: string } {
//   return (
//     typeof err === "object" &&
//     err !== null &&
//     "message" in (err as Record<string, unknown>) &&
//     typeof (err as Record<string, unknown>).message === "string"
//   );
// }

// export const MessageForm = ({ projectId, isPremium = false }: Props) => {
//   const queryClient = useQueryClient();

//   const defaultModel = allModels.find((m) => m.isDefault) ?? allModels[0];
//   const [selectedModel, setSelectedModel] = useState<string>(defaultModel.id);
//   const [isFocused, setIsFocused] = useState(false);
//   const [imagePreview, setImagePreview] = useState<string | null>(null);

//   const [usage, setUsage] = useState<UsageShape>(null);
//   const [isLoading, setIsLoading] = useState(false);

//   // Fetch usage on mount (GET /api/usage/status)
//   useEffect(() => {
//     let mounted = true;
//     (async () => {
//       try {
//         const res = await fetch("/api/usage/status");
//         if (!res.ok) {
//           console.error("usage.status fetch failed", await res.text());
//           if (mounted) setUsage(null);
//           return;
//         }
//         const data: unknown = await res.json();
//         if (isUsageResponse(data)) {
//           if (mounted) setUsage(data);
//         } else {
//           if (mounted) setUsage(null);
//         }
//       } catch (e) {
//         console.error("Failed to fetch usage.status", e);
//         if (mounted) setUsage(null);
//       }
//     })();
//     return () => {
//       mounted = false;
//     };
//   }, []);

//   const showUsage = usage !== null;

//   const form = useForm<FormValues>({
//     resolver: zodResolver(formSchema),
//     defaultValues: { value: "", image: undefined },
//     mode: "onChange",
//   });

//   const onSubmit = async (values: FormValues) => {
//     setIsLoading(true);

//     const payload = {
//       value: values.value ?? "",
//       image: values.image,
//       projectId,
//       model: selectedModel,
//     };

//     try {
//       const res = await fetch("/api/messages/create", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(payload),
//       });

//       if (res.status === 401) {
//         toast.error("You must be signed in to perform this action.");
//         setIsLoading(false);
//         return;
//       }

//       if (!res.ok) {
//         const text = await res.text();
//         toast.error(`Server error: ${text}`);
//         setIsLoading(false);
//         return;
//       }

//       // success
//       void queryClient.invalidateQueries({ queryKey: ["messages", projectId] });

//       // refresh usage
//       try {
//         const r2 = await fetch("/api/usage/status");
//         if (r2.ok) {
//           const d2: unknown = await r2.json();
//           if (isUsageResponse(d2)) {
//             setUsage(d2);
//           }
//         }
//       } catch {
//         // ignore refresh errors
//       }

//       form.reset();
//       setImagePreview(null);
//     } catch (err: unknown) {
//       if (hasMessage(err)) toast.error(err.message);
//       else toast.error(String(err ?? "Unknown error"));
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const handleImageReady = (url: string) => {
//     setImagePreview(url);
//     form.setValue("image", url, { shouldValidate: true, shouldDirty: true });
//   };

//   const removeImage = () => {
//     setImagePreview(null);
//     form.setValue("image", undefined, { shouldValidate: true, shouldDirty: true });
//   };

//   const isButtonDisabled = isLoading || !form.formState.isValid;

//   return (
//     <div>
//       {showUsage && usage && <Usage points={usage.remainingPoints} msBeforeNext={usage.msBeforeNext} />}

//       <Form {...form}>
//         <div
//           className={cn(
//             "border-x border-t rounded-t-xl bg-sidebar dark:bg-sidebar px-4 py-3",
//             showUsage && "border-t-0 rounded-t-none"
//           )}
//         >
//           <div className="flex items-center justify-between">
//             <span className="text-sm font-medium text-muted-foreground">AI Model</span>

//             {/* NEW: upload button placed left of the model selector with spacing */}
//             <div className="flex items-center gap-x-3">
//               <ImageUploadButton onImageReady={handleImageReady} />
//               <ModelSelector selectedModel={selectedModel} onModelChange={setSelectedModel} isPremium={isPremium} />
//             </div>
//           </div>
//         </div>

//         <form
//           onSubmit={form.handleSubmit(onSubmit)}
//           className={cn(
//             "relative border border-t-0 p-4 pt-1 rounded-b-xl bg-sidebar dark:bg-sidebar transition-all",
//             isFocused && "shadow-xs"
//           )}
//         >
//           {imagePreview && (
//             <div className="relative w-fit mb-2">
//               <div className="rounded-md overflow-hidden border">
//                 <Image src={imagePreview} alt="Preview" width={320} height={160} style={{ objectFit: "contain" }} />
//               </div>
//               <button
//                 type="button"
//                 onClick={removeImage}
//                 className="absolute top-0 right-0 -mt-2 -mr-2 bg-rose-500 text-white rounded-full p-0.5"
//                 aria-label="Remove image"
//               >
//                 <X className="h-3 w-3" />
//               </button>
//             </div>
//           )}

//           <FormField
//             control={form.control}
//             name="value"
//             render={({ field }) => (
//               <FormControl>
//                 <TextareaAutoSize
//                   {...field}
//                   disabled={isLoading}
//                   placeholder="What would you like to build? You can also upload an image..."
//                   className="w-full pt-4 resize-none border-none outline-none bg-transparent"
//                   minRows={2}
//                   maxRows={6}
//                   onFocus={() => setIsFocused(true)}
//                   onBlur={() => setIsFocused(false)}
//                   onKeyDown={(e) => {
//                     if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
//                       e.preventDefault();
//                       void form.handleSubmit(onSubmit)();
//                     }
//                   }}
//                 />
//               </FormControl>
//             )}
//           />

//           <div className="flex gap-x-2 items-end justify-between pt-2">
//             {/* small keyboard hint on the left (upload button moved to header) */}
//             <div className="flex items-center gap-x-2">
//               <div className="text-[10px] text-muted-foreground font-mono">
//                 <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
//                   <span>&#8984;</span>Enter
//                 </kbd>
//                 &nbsp;to submit
//               </div>
//             </div>

//             <Button type="submit" disabled={isButtonDisabled} className={cn("size-8 rounded-full", isButtonDisabled && "bg-muted-foreground border")}>
//               {isLoading ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
//             </Button>
//           </div>
//         </form>
//       </Form>
//     </div>
//   );
// };


// src/modules/projects/ui/components/message-form.tsx
"use client";

import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowUp, Loader2, X } from "lucide-react";
import TextareaAutoSize from "react-textarea-autosize";
import { Form, FormField, FormControl } from "@/components/ui/form";
import { Usage } from "./usage";
import { ModelSelector, allModels } from "./model-selector";
import { useQueryClient } from "@tanstack/react-query";
import { ImageUploadButton } from "./image-uploader";

interface Props {
  projectId: string;
  isPremium?: boolean;
}

/**
 * Client form schema: either `value` text or an `image` url is required.
 */
const formSchema = z
  .object({
    value: z.string().optional(),
    image: z.string().optional(),
  })
  .refine((data) => !!(data.value && data.value.trim()) || !!data.image, {
    message: "A prompt or an image is required.",
    path: ["value"],
  });

type FormValues = z.infer<typeof formSchema>;

interface UsageResponse {
  remainingPoints: number;
  msBeforeNext: number;
}

type UsageShape = UsageResponse | null;

/** Type-guard for usage response received from the server. */
function isUsageResponse(data: unknown): data is UsageResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "remainingPoints" in data &&
    "msBeforeNext" in data &&
    typeof (data as Record<string, unknown>).remainingPoints === "number" &&
    typeof (data as Record<string, unknown>).msBeforeNext === "number"
  );
}

/** Minimal error shape guard to show `error.message` when present. */
function hasMessage(err: unknown): err is { message: string } {
  return (
    typeof err === "object" &&
    err !== null &&
    "message" in (err as Record<string, unknown>) &&
    typeof (err as Record<string, unknown>).message === "string"
  );
}

export const MessageForm = ({ projectId, isPremium = false }: Props) => {
  const queryClient = useQueryClient();

  const defaultModel = allModels.find((m) => m.isDefault) ?? allModels[0];
  const [selectedModel, setSelectedModel] = useState<string>(defaultModel.id);
  const [isFocused, setIsFocused] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [usage, setUsage] = useState<UsageShape>(null);

  // Counter of concurrent client requests in-flight.
  const [activeRequests, setActiveRequests] = useState<number>(0);

  // Fetch usage on mount (GET /api/usage/status)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/usage/status");
        if (!res.ok) {
          // do not render HTML to UI; just log
          console.error("usage.status fetch failed", await res.text());
          if (mounted) setUsage(null);
          return;
        }
        const data: unknown = await res.json();
        if (isUsageResponse(data)) {
          if (mounted) setUsage(data);
        } else {
          if (mounted) setUsage(null);
        }
      } catch (e) {
        console.error("Failed to fetch usage.status", e);
        if (mounted) setUsage(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const showUsage = usage !== null;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { value: "", image: undefined },
    mode: "onChange",
  });

  // Whether any requests are in flight (used only to show spinner)
  const isLoading = activeRequests > 0;

  /**
   * Note: we DO NOT disable the submit button while requests are in flight,
   * so multiple requests can be sent concurrently. We still disable it when
   * the form is invalid.
   */
  const isButtonDisabled = !form.formState.isValid;

  const onSubmit = async (values: FormValues) => {
    // increase active request count immediately
    setActiveRequests((c) => c + 1);

    const payload = {
      value: values.value ?? "",
      image: values.image,
      projectId,
      model: selectedModel,
    };

    try {
      const res = await fetch("/api/messages/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // If API returned 401, handle explicitly
      if (res.status === 401) {
        toast.error("You must be signed in to perform this action.");
        return;
      }

      // On non-OK responses, parse based on content-type safely and toast
      if (!res.ok) {
        let msg = `Server returned status ${res.status}`;
        try {
          const ct = (res.headers.get("content-type") ?? "").toLowerCase();
          if (ct.includes("application/json")) {
            const json = await res.json();

            if (typeof json === "string") {
              msg = json;
            } else if (typeof json === "object" && json !== null) {
              // Prefer an "error" property if present and serializable
              if ("error" in json) {
                const eVal = (json as Record<string, unknown>).error;
                if (typeof eVal === "string") msg = eVal;
                else msg = JSON.stringify(eVal);
              } else {
                msg = JSON.stringify(json);
              }
            } else {
              msg = String(json);
            }
          } else {
            // treat everything else as plain text (this avoids injecting HTML into the page)
            const text = await res.text();
            // trim and shorten long HTML responses so we don't accidentally dump the whole dev page
            msg = text.length > 400 ? text.slice(0, 400) + "…" : text;
          }
        } catch (parseErr) {
          console.error("Failed to parse error response:", parseErr);
        }
        toast.error(`Server error: ${msg}`);
        return;
      }

      // success: invalidate queries and reset the form
      void queryClient.invalidateQueries({ queryKey: ["messages", projectId] });

      // refresh usage (best-effort)
      try {
        const r2 = await fetch("/api/usage/status");
        if (r2.ok) {
          const d2: unknown = await r2.json();
          if (isUsageResponse(d2)) {
            setUsage(d2);
          }
        }
      } catch {
        // ignore refresh errors
      }

      form.reset();
      setImagePreview(null);
    } catch (err: unknown) {
      if (hasMessage(err)) toast.error(err.message);
      else toast.error(String(err ?? "Unknown error"));
    } finally {
      // decrement active request count
      setActiveRequests((c) => Math.max(0, c - 1));
    }
  };

  const handleImageReady = (url: string) => {
    setImagePreview(url);
    form.setValue("image", url, { shouldValidate: true, shouldDirty: true });
  };

  const removeImage = () => {
    setImagePreview(null);
    form.setValue("image", undefined, { shouldValidate: true, shouldDirty: true });
  };

  return (
    <div>
      {showUsage && usage && <Usage points={usage.remainingPoints} msBeforeNext={usage.msBeforeNext} />}

      <Form {...form}>
        <div
          className={cn(
            "border-x border-t rounded-t-xl bg-sidebar dark:bg-sidebar px-4 py-3",
            showUsage && "border-t-0 rounded-t-none"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">AI Model</span>

            {/* Upload button placed left of the model selector with spacing */}
            <div className="flex items-center gap-x-3">
              <ImageUploadButton onImageReady={handleImageReady} />
              <ModelSelector selectedModel={selectedModel} onModelChange={setSelectedModel} isPremium={isPremium} />
            </div>
          </div>
        </div>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className={cn(
            "relative border border-t-0 p-4 pt-1 rounded-b-xl bg-sidebar dark:bg-sidebar transition-all",
            isFocused && "shadow-xs"
          )}
        >
          {imagePreview && (
            <div className="relative w-fit mb-2">
              <div className="rounded-md overflow-hidden border">
                <Image
                  src={imagePreview}
                  alt="Preview"
                  width={320}
                  height={160}
                  style={{ objectFit: "contain", width: "auto", height: "auto" }}
                />
              </div>
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-0 right-0 -mt-2 -mr-2 bg-rose-500 text-white rounded-full p-0.5"
                aria-label="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          <FormField
            control={form.control}
            name="value"
            render={({ field }) => (
              <FormControl>
                <TextareaAutoSize
                  {...field}
                  disabled={false}
                  placeholder="What would you like to build? You can also upload an image..."
                  className="w-full pt-4 resize-none border-none outline-none bg-transparent"
                  minRows={2}
                  maxRows={6}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      void form.handleSubmit(onSubmit)();
                    }
                  }}
                />
              </FormControl>
            )}
          />

          <div className="flex gap-x-2 items-end justify-between pt-2">
            <div className="flex items-center gap-x-2">
              {/* keyboard hint */}
              <div className="text-[10px] text-muted-foreground font-mono">
                <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  <span>&#8984;</span>Enter
                </kbd>
                &nbsp;to submit
              </div>
            </div>

            <Button
              type="submit"
              disabled={isButtonDisabled}
              className={cn("size-8 rounded-full", isButtonDisabled && "bg-muted-foreground border")}
              aria-label="Send prompt"
            >
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};
