// import React, { useState, useRef, useEffect } from "react";
// import { Check, ChevronUp, Crown } from "lucide-react";
// import { cn } from "@/lib/utils";

// /**
//  * Full model list (kept as in your previous file).
//  * Adjust/add models as needed.
//  */
// export const allModels = [
//   // NVIDIA Models
//   {
//     id: "nvidia/llama-3.3-nemotron-super-49b-v1.5",
//     name: "Nemotron-Super 49B",
//     provider: "NVIDIA",
//   },
//   {
//     id: "mistralai/mistral-nemotron",
//     name: "mistral-nemotron",
//     provider: "NVIDIA",
//   },
//   {
//     id: "nvidia/llama-3.1-nemotron-nano-4b-v1.1",
//     name: "llama-3.1-nemotron-nano-4b-v1.1",
//     provider: "NVIDIA",
//   },
//     {
//     id: "nvidia/llama-3.1-nemotron-ultra-253b-v1",
//     name: "llama-3.1-nemotron-ultra-253b",
//     provider: "NVIDIA",
//   },
//   {
//     id: "meta/llama-3.3-70b-instruct",
//     name: "llama-3.3-70b-instruct",
//     provider: "NVIDIA",
//   },

//   // OpenAI / misc
//   {
//     id: "gpt-4.1-mini",
//     name: "GPT-4.1 Mini",
//     provider: "OpenAI",
//   },

//   // A4F / provider examples
//   {
//     id: "provider-3/gpt-4o-mini",
//     name: "gpt-4o-mini",
//     provider: "A4F",
//   },
//   {
//     id: "provider-3/deepseek-v3-0324",
//     name: "deepseek-v3-0324",
//     provider: "A4F",
//   },
//   {
//     id: "provider-6/gpt-4o",
//     name: "gpt-4o",
//     provider: "A4F",
//   },
//   {
//     id: "provider-6/gpt-4.1-mini",
//     name: "gpt-4.1-mini",
//     provider: "A4F",
//   },
//   {
//     id: "provider-3/deepseek-v3",
//     name: "deepseek-v3",
//     provider: "A4F",
//   },
//     {
//     id: "deepseek-r1-distill-llama-70b",
//     name: "deepseek-r1",
//     provider: "Groq",
//   },
//     {
//     id: "qwen/qwen3-32b",
//     name: "qwen3-32b",
//     provider: "Groq",
//   },
//     {
//     id: "llama-3.1-8b-instant",
//     name: "llama-3.1-8b",
//     provider: "Groq",
//   },
//    {
//     id: "meta-llama/llama-4-scout-17b-16e-instruct",
//     name: "llama-4-scout-17b",
//     provider: "Groq",
//   },
//      {
//     id: "meta-llama/llama-4-maverick-17b-128e-instruct",
//     name: "llama-4-maverick-17b-128e-instruct",
//     provider: "Groq",
//   },
//       {
//     id: "openai/gpt-oss-120b",
//     name: "gpt-oss-120b",
//     provider: "Groq",
//   },
//   {
//     id: "provider-6/llama-4-scout",
//     name: "llama-4-scout",
//     provider: "A4F",
//     isPro: true,
//   },

//   {
//     id: "provider-2/gpt-5-nano",
//     name: "gpt-5-nano",
//     provider: "A4F",
//     isDefault: true,
//   },
//   {
//     id: "provider-6/llama-4-maverick",
//     name: "llama-4-maverick",
//     provider: "A4F",
//   },
//   {
//     id: "provider-6/qwen3-coder-480b-a35b",
//     name: "qwen3-coder",
//     provider: "A4F",
//   },
//   {
//     id: "provider-6/kimi-k2-instruct",
//     name: "kimi-k2-instruct",
//     provider: "A4F",
//   },
//   {
//     id: "provider-6/o4-mini-medium",
//     name: "o4-mini-medium",
//     provider: "A4F",
//   },
//   {
//     id: "provider-6/gemini-2.5-flash-thinking",
//     name: "gemini-2.5-flash-thinking",
//     provider: "A4F",
//   },
//   // {
//   //   id: "provider-6/gemini-2.5-flash",
//   //   name: "gemini-2.5-flash",
//   //   provider: "A4F",
//   // },

//   // NVIDIA / other long model name example
//   // {
//   //   id: "openai/gpt-oss-120b",
//   //   name: "GPT-OSS 120B",
//   //   provider: "NVIDIA",
//   // },
// ];

// interface ModelSelectorProps {
//   selectedModel: string;
//   onModelChange: (modelId: string) => void;
//   isPremium?: boolean;
// }

// /**
//  * ModelSelector
//  * - Slightly wider dropdown (w-80)
//  * - Nudged 3px from the right edge of the parent/panel
//  * - Scrollable model list with thin scrollbar and limited height
//  * - Premium selection logic: pro models are selectable when isPremium === true
//  *   and non-premium users get a friendly alert (buttons are NOT truly disabled so
//  *   pro users can always click).
//  */
// export const ModelSelector: React.FC<ModelSelectorProps> = ({
//   selectedModel,
//   onModelChange,
//   isPremium = false,
// }) => {
//   const [isOpen, setIsOpen] = useState(false);
//   const buttonRef = useRef<HTMLButtonElement | null>(null);
//   const menuRef = useRef<HTMLDivElement | null>(null);

//   // group by provider: Record<string, typeof allModels[number][]>
//   const groupedModels = allModels.reduce((acc, model) => {
//     (acc[model.provider] = acc[model.provider] || []).push(model);
//     return acc;
//   }, {} as Record<string, typeof allModels[number][]>);

//   useEffect(() => {
//     const handleClickOutside = (event: MouseEvent) => {
//       if (
//         menuRef.current &&
//         !menuRef.current.contains(event.target as Node) &&
//         buttonRef.current &&
//         !buttonRef.current.contains(event.target as Node)
//       ) {
//         setIsOpen(false);
//       }
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   /**
//    * Centralized selection handler:
//    * - If the model is pro and the user is not premium, show an upgrade alert and don't select.
//    * - Otherwise select and close.
//    *
//    * IMPORTANT: we intentionally do NOT use the native disabled attribute on the buttons
//    * so that premium users are never blocked by any accidental disabled state. Visual
//    * disabled styling is still applied for non-premium users.
//    */
//   const handleModelSelect = (modelId: string, isPro: boolean) => {
//     if (isPro && !isPremium) {
//       // replace with a nicer UI if desired
//       alert("This is a premium model. Please upgrade to use it.");
//       return;
//     }
//     onModelChange(modelId);
//     setIsOpen(false);
//   };

//   const selectedModelInfo =
//     allModels.find((m) => m.id === selectedModel) ||
//     allModels.find((m) => m.isDefault) ||
//     allModels[0];

//   return (
//     <div className="relative inline-block">
//       {/* Thin scrollbar CSS (WebKit + Firefox) */}
//       <style>{`
//         /* WebKit */
//         .model-scroll::-webkit-scrollbar { height: 8px; width: 8px; }
//         .model-scroll::-webkit-scrollbar-thumb { background: rgba(100,100,100,0.35); border-radius: 999px; }
//         .model-scroll::-webkit-scrollbar-track { background: transparent; }
//         /* Firefox */
//         .model-scroll { scrollbar-width: thin; scrollbar-color: rgba(100,100,100,0.35) transparent; }
//       `}</style>

//       <button
//         ref={buttonRef}
//         onClick={() => setIsOpen((s) => !s)}
//         className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
//         aria-haspopup="listbox"
//         aria-expanded={isOpen}
//       >
//         <span className="truncate max-w-[12rem]">{selectedModelInfo?.name}</span>
//         <ChevronUp
//           className="h-4 w-4 text-muted-foreground transition-transform duration-200"
//           style={{ transform: isOpen ? "rotate(0deg)" : "rotate(180deg)" }}
//         />
//       </button>

//       {isOpen && (
//         <div
//           ref={menuRef}
//           className="absolute bottom-full mb-2 w-80 origin-bottom-right rounded-xl border bg-background shadow-xl z-50"
//           style={{ right: 3 }}
//         >
//           <div className="p-2">
//             {Object.entries(groupedModels).map(([provider, models]) => (
//               <div key={provider} className="mt-2 first:mt-0">
//                 <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
//                   {provider}
//                 </div>

//                 <div
//                   className="mt-1 space-y-1 model-scroll overflow-y-auto max-h-56 pr-2"
//                   role="listbox"
//                   aria-label={`${provider} models`}
//                 >
//                   {models.map((model) => {
//                     const isPro = Boolean(model.isPro);
//                     const notAllowed = isPro && !isPremium;

//                     return (
//                       <button
//                         key={model.id}
//                         onClick={() => handleModelSelect(model.id, isPro)}
//                         // We DO NOT set the native `disabled` attribute here so premium users are never blocked.
//                         // Use aria-disabled for accessibility and visual styles to indicate restriction.
//                         aria-disabled={notAllowed}
//                         className={cn(
//                           "w-full flex items-center justify-between text-left rounded-md p-2 text-sm text-foreground transition-colors",
//                           notAllowed ? "opacity-50" : "hover:bg-accent",
//                           selectedModel === model.id ? "bg-accent" : ""
//                         )}
//                       >
//                         <div className="flex items-center gap-2">
//                           <span className="font-medium truncate max-w-[14.5rem]">
//                             {model.name}
//                           </span>
//                           {model.isPro && (
//                             <Crown className="h-4 w-4 text-amber-500" />
//                           )}
//                         </div>

//                         {selectedModel === model.id && <Check className="h-4 w-4" />}
//                       </button>
//                     );
//                   })}
//                 </div>
//               </div>
//             ))}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };


// // src/modules/projects/ui/components/model-selector.tsx
// import React, { useState, useRef, useEffect } from "react";
// import { Check, ChevronUp, Crown, Image as ImageIcon } from "lucide-react";
// import { cn } from "@/lib/utils";

// type ModelItem = {
//   id: string;
//   name: string;
//   provider: string;
//   vision?: boolean;
//   isPro?: boolean;
//   isDefault?: boolean;
// };

// export const allModels: ModelItem[] = [
//   // NVIDIA Models
//   {
//     id: "nvidia/llama-3.3-nemotron-super-49b-v1.5",
//     name: "Nemotron-Super 49B",
//     provider: "NVIDIA",
//     vision: true,
//   },
//   {
//     id: "mistralai/mistral-nemotron",
//     name: "mistral-nemotron",
//     provider: "Mistral",
//     vision: false,
//   },
//   {
//     id: "nvidia/llama-3.1-nemotron-nano-4b-v1.1",
//     name: "llama-3.1-nemotron-nano-4b-v1.1",
//     provider: "NVIDIA",
//     vision: false,
//   },
//   {
//     id: "nvidia/llama-3.1-nemotron-ultra-253b-v1",
//     name: "llama-3.1-nemotron-ultra-253b",
//     provider: "NVIDIA",
//     vision: true,
//   },
//   {
//     id: "meta/llama-3.3-70b-instruct",
//     name: "llama-3.3-70b-instruct",
//     provider: "Meta",
//     vision: false,
//   },

//   // OpenAI / misc
//   {
//     id: "gpt-4.1-mini",
//     name: "GPT-4.1 Mini",
//     provider: "OpenAI",
//     vision: true,
//   },

//   // A4F / provider examples
//   {
//     id: "provider-3/gpt-4o-mini",
//     name: "gpt-4o-mini",
//     provider: "A4F",
//     vision: true,
//   },
//   {
//     id: "provider-3/deepseek-v3-0324",
//     name: "deepseek-v3-0324",
//     provider: "A4F",
//     vision: true,
//   },
//   {
//     id: "provider-6/gpt-4o",
//     name: "gpt-4o",
//     provider: "A4F",
//     vision: true,
//   },
//   {
//     id: "provider-6/gpt-4.1-mini",
//     name: "gpt-4.1-mini",
//     provider: "A4F",
//     vision: true,
//   },

//   // Groq examples
//   {
//     id: "deepseek-r1-distill-llama-70b",
//     name: "deepseek-r1",
//     provider: "Groq",
//     vision: true,
//   },

//   {
//     id: "provider-2/gpt-5-nano",
//     name: "gpt-5-nano",
//     provider: "A4F",
//     isDefault: true,
//     vision: false,
//   },
//   {
//     id: "provider-6/llama-4-maverick",
//     name: "llama-4-maverick",
//     provider: "A4F",
//     vision: false,
//   },
//   {
//     id: "provider-6/qwen3-coder-480b-a35b",
//     name: "qwen3-coder",
//     provider: "A4F",
//     vision: true,
//   },
//   {
//     id: "provider-6/kimi-k2-instruct",
//     name: "kimi-k2-instruct",
//     provider: "A4F",
//     vision: false,
//   },
//   {
//     id: "provider-6/o4-mini-medium",
//     name: "o4-mini-medium",
//     provider: "A4F",
//     vision: false,
//   },
//   {
//     id: "provider-6/gemini-2.5-flash-thinking",
//     name: "gemini-2.5-flash-thinking",
//     provider: "A4F",
//     vision: false,
//   },
// ];

// interface ModelSelectorProps {
//   selectedModel: string;
//   onModelChange: (modelId: string) => void;
//   isPremium?: boolean;
// }

// export const ModelSelector: React.FC<ModelSelectorProps> = ({ selectedModel, onModelChange, isPremium = false }) => {
//   const [isOpen, setIsOpen] = useState(false);
//   const buttonRef = useRef<HTMLButtonElement | null>(null);
//   const menuRef = useRef<HTMLDivElement | null>(null);

//   const groupedModels = allModels.reduce<Record<string, ModelItem[]>>((acc, model) => {
//     (acc[model.provider] = acc[model.provider] || []).push(model);
//     return acc;
//   }, {});

//   useEffect(() => {
//     const handleClickOutside = (event: MouseEvent) => {
//       if (menuRef.current && !menuRef.current.contains(event.target as Node) && buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
//         setIsOpen(false);
//       }
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   const handleModelSelect = (modelId: string, isPro: boolean) => {
//     if (isPro && !isPremium) {
//       alert("This is a premium model. Please upgrade to use it.");
//       return;
//     }
//     onModelChange(modelId);
//     setIsOpen(false);
//   };

//   const selectedModelInfo = allModels.find((m) => m.id === selectedModel) || allModels.find((m) => m.isDefault) || allModels[0];

//   return (
//     <div className="relative inline-block">
//       <style>{`
//         .model-scroll::-webkit-scrollbar { height: 8px; width: 8px; }
//         .model-scroll::-webkit-scrollbar-thumb { background: rgba(100,100,100,0.35); border-radius: 999px; }
//         .model-scroll::-webkit-scrollbar-track { background: transparent; }
//         .model-scroll { scrollbar-width: thin; scrollbar-color: rgba(100,100,100,0.35) transparent; }
//       `}</style>

//       <button
//         ref={buttonRef}
//         onClick={() => setIsOpen((s) => !s)}
//         className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
//         aria-haspopup="listbox"
//         aria-expanded={isOpen}
//       >
//         <span className="truncate max-w-[12rem]">{selectedModelInfo?.name}</span>
//         {selectedModelInfo?.vision && <ImageIcon className="h-4 w-4 text-muted-foreground ml-1" />}
//         <ChevronUp className="h-4 w-4 text-muted-foreground transition-transform duration-200" style={{ transform: isOpen ? "rotate(0deg)" : "rotate(180deg)" }} />
//       </button>

//       {isOpen && (
//         <div ref={menuRef} className="absolute bottom-full mb-2 w-80 origin-bottom-right rounded-xl border bg-background shadow-xl z-50" style={{ right: 3 }}>
//           <div className="p-2">
//             {Object.entries(groupedModels).map(([provider, models]) => (
//               <div key={provider} className="mt-2 first:mt-0">
//                 <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">{provider}</div>

//                 <div className="mt-1 space-y-1 model-scroll overflow-y-auto max-h-56 pr-2" role="listbox" aria-label={`${provider} models`}>
//                   {models.map((model) => {
//                     const isPro = Boolean(model.isPro);
//                     const notAllowed = isPro && !isPremium;

//                     return (
//                       <button
//                         key={model.id}
//                         onClick={() => handleModelSelect(model.id, isPro)}
//                         aria-disabled={notAllowed}
//                         className={cn(
//                           "w-full flex items-center justify-between text-left rounded-md p-2 text-sm text-foreground transition-colors",
//                           notAllowed ? "opacity-50" : "hover:bg-accent",
//                           selectedModel === model.id ? "bg-accent" : ""
//                         )}
//                       >
//                         <div className="flex items-center gap-2">
//                           <span className="font-medium truncate max-w-[14.5rem]">{model.name}</span>
//                           {model.isPro && <Crown className="h-4 w-4 text-amber-500" />}
//                           {model.vision && <ImageIcon className="h-4 w-4 text-muted-foreground" />}
//                         </div>

//                         {selectedModel === model.id && <Check className="h-4 w-4" />}
//                       </button>
//                     );
//                   })}
//                 </div>
//               </div>
//             ))}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// // src/modules/projects/ui/components/model-selector.tsx
// import React, { useEffect, useRef, useState } from "react";
// import { Check, ChevronUp, Crown, Image as ImageIcon } from "lucide-react";
// import { cn } from "@/lib/utils";

// type ModelItem = {
//   id: string;
//   name: string;
//   provider: string;
//   vision: boolean;
//   isPro?: boolean;
//   isDefault?: boolean;
// };

// export const allModels: ModelItem[] = [
//   // NVIDIA / vision-capable examples
//   { id: "nvidia/llama-3.3-nemotron-super-49b-v1.5", name: "Nemotron-Super 49B", provider: "NVIDIA", vision: true },
//   { id: "mistralai/mistral-nemotron", name: "mistral-nemotron", provider: "NVIDIA", vision: true },
//   { id: "nvidia/llama-3.1-nemotron-nano-4b-v1.1", name: "llama-3.1-nemotron-nano-4b-v1.1", provider: "NVIDIA", vision: true },
//   { id: "nvidia/llama-3.1-nemotron-ultra-253b-v1", name: "llama-3.1-nemotron-ultra-253b", provider: "NVIDIA", vision: true },
//   { id: "meta/llama-3.3-70b-instruct", name: "llama-3.3-70b-instruct", provider: "NVIDIA", vision: false },

//   // OpenAI / misc
//   { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", provider: "OpenAI", vision: true },

//   // A4F / examples
//   { id: "provider-3/gpt-4o-mini", name: "gpt-4o-mini", provider: "A4F", vision: false },
//   { id: "provider-3/deepseek-v3-0324", name: "deepseek-v3-0324", provider: "A4F", vision: false },
//   { id: "provider-6/gpt-4o", name: "gpt-4o", provider: "A4F", vision: false },
//   { id: "provider-6/gpt-4.1-mini", name: "gpt-4.1-mini", provider: "A4F", vision: true },
//   { id: "provider-3/deepseek-v3", name: "deepseek-v3", provider: "A4F", vision: false },

//   // Groq / examples
//   { id: "deepseek-r1-distill-llama-70b", name: "deepseek-r1", provider: "Groq", vision: true },
//   { id: "qwen/qwen3-32b", name: "qwen3-32b", provider: "Groq", vision: true },
//   { id: "llama-3.1-8b-instant", name: "llama-3.1-8b", provider: "Groq", vision: false },
//   { id: "meta-llama/llama-4-scout-17b-16e-instruct", name: "llama-4-scout-17b", provider: "Groq", vision: false },
//   { id: "meta-llama/llama-4-maverick-17b-128e-instruct", name: "llama-4-maverick-17b-128e-instruct", provider: "Groq", vision: false },
//   { id: "openai/gpt-oss-120b", name: "gpt-oss-120b", provider: "Groq", vision: false },

//   // extras
//   { id: "provider-6/llama-4-scout", name: "llama-4-scout", provider: "A4F", vision: false, isPro: true },
//   { id: "provider-2/gpt-5-nano", name: "gpt-5-nano", provider: "A4F", vision: true, isDefault: true },
//   { id: "provider-6/llama-4-maverick", name: "llama-4-maverick", provider: "A4F", vision: false },
//   { id: "provider-6/qwen3-coder-480b-a35b", name: "qwen3-coder", provider: "A4F", vision: false },
//   { id: "provider-6/kimi-k2-instruct", name: "kimi-k2-instruct", provider: "A4F", vision: false },
//   { id: "provider-6/o4-mini-medium", name: "o4-mini-medium", provider: "A4F", vision: false },
//   { id: "provider-6/gemini-2.5-flash-thinking", name: "gemini-2.5-flash-thinking", provider: "A4F", vision: true },
// ];

// interface ModelSelectorProps {
//   selectedModel: string;
//   onModelChange: (modelId: string) => void;
//   isPremium?: boolean;
// }

// export const ModelSelector: React.FC<ModelSelectorProps> = ({ selectedModel, onModelChange, isPremium = false }) => {
//   const [isOpen, setIsOpen] = useState(false);
//   const buttonRef = useRef<HTMLButtonElement | null>(null);
//   const menuRef = useRef<HTMLDivElement | null>(null);

//   const grouped = allModels.reduce<Record<string, ModelItem[]>>((acc, m) => {
//     (acc[m.provider] = acc[m.provider] || []).push(m);
//     return acc;
//   }, {});

//   useEffect(() => {
//     const handler = (e: MouseEvent) => {
//       if (menuRef.current && !menuRef.current.contains(e.target as Node) && buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
//         setIsOpen(false);
//       }
//     };
//     document.addEventListener("mousedown", handler);
//     return () => document.removeEventListener("mousedown", handler);
//   }, []);

//   const handleSelect = (id: string, modelItem: ModelItem) => {
//     if (modelItem.isPro && !isPremium) {
//       alert("This is a premium model. Please upgrade to use it.");
//       return;
//     }
//     onModelChange(id);
//     setIsOpen(false);
//   };

//   const selectedInfo = allModels.find((m) => m.id === selectedModel) || allModels.find((m) => m.isDefault) || allModels[0];

//   return (
//     <div className="relative inline-block">
//       <style>{`
//         .model-scroll::-webkit-scrollbar { height: 8px; width: 8px; }
//         .model-scroll::-webkit-scrollbar-thumb { background: rgba(100,100,100,0.35); border-radius: 999px; }
//         .model-scroll::-webkit-scrollbar-track { background: transparent; }
//         .model-scroll { scrollbar-width: thin; scrollbar-color: rgba(100,100,100,0.35) transparent; }
//       `}</style>

//       <button
//         ref={buttonRef}
//         onClick={() => setIsOpen((s) => !s)}
//         className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
//         aria-haspopup="listbox"
//         aria-expanded={isOpen}
//       >
//         <span className="truncate max-w-[14rem]">{selectedInfo?.name}</span>
//         {selectedInfo?.vision && <ImageIcon className="h-4 w-4 text-sky-500" />}
//         <ChevronUp className="h-4 w-4" style={{ transform: isOpen ? "rotate(0deg)" : "rotate(180deg)" }} />
//       </button>

//       {isOpen && (
//         <div ref={menuRef} className="absolute z-50 right-0 mt-2 w-96 origin-top-right rounded-xl border bg-background shadow-xl" style={{ maxHeight: "60vh" }}>
//           <div className="p-3 space-y-3">
//             {Object.entries(grouped).map(([provider, models]) => (
//               <div key={provider} className="space-y-2">
//                 <div className="px-1 text-xs font-semibold text-muted-foreground">{provider}</div>
//                 <div role="listbox" aria-label={`${provider} models`} className="model-scroll max-h-56 overflow-y-auto pr-2 space-y-1">
//                   {models.map((model) => {
//                     const notAllowed = model.isPro === true && !isPremium;
//                     return (
//                       <button
//                         key={model.id}
//                         onClick={() => handleSelect(model.id, model)}
//                         aria-disabled={notAllowed}
//                         className={cn(
//                           "w-full flex items-center justify-between rounded-md px-2 py-1 text-sm text-foreground transition-colors",
//                           notAllowed ? "opacity-50" : "hover:bg-accent",
//                           selectedModel === model.id ? "bg-accent" : ""
//                         )}
//                       >
//                         <div className="flex items-center gap-2 min-w-0">
//                           <div className="flex gap-2 items-center truncate">
//                             <span className="font-medium truncate max-w-[18rem]">{model.name}</span>
//                             {model.vision && (
//                               <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-sky-100 text-sky-700">
//                                 <ImageIcon className="h-3 w-3" />Vision
//                               </span>
//                             )}
//                             {model.isPro && <Crown className="h-4 w-4 text-amber-500" />}
//                           </div>
//                         </div>
//                         {selectedModel === model.id && <Check className="h-4 w-4" />}
//                       </button>
//                     );
//                   })}
//                 </div>
//               </div>
//             ))}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// // src/modules/projects/ui/components/model-selector.tsx
// import React, { useState, useRef, useEffect } from "react";
// import { Check, ChevronUp, Crown, Eye } from "lucide-react";
// import { cn } from "@/lib/utils";

// export type ModelDescriptor = {
//   id: string;
//   name: string;
//   provider: string;
//   vision?: boolean;
//   isPro?: boolean;
//   isDefault?: boolean;
// };

// export const allModels: ModelDescriptor[] = [

//   { id: "nvidia/llama-3.1-nemotron-ultra-253b-v1", name: "llama-3.1-nemotron-ultra-253b", provider: "NVIDIA", vision: true },
//   { id: "meta/llama-3.3-70b-instruct", name: "llama-3.3-70b-instruct", provider: "NVIDIA", vision: false },
//   // Keep your full list here — shortened example entries shown
//   { id: "nvidia/llama-3.3-nemotron-super-49b-v1.5", name: "Nemotron-Super 49B", provider: "NVIDIA", vision: true },
//   { id: "mistralai/mistral-nemotron", name: "mistral-nemotron", provider: "NVIDIA", vision: false },
//   { id: "nvidia/llama-3.1-nemotron-nano-4b-v1.1", name: "llama-3.1-nano-4b", provider: "NVIDIA", vision: false },
//   { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", provider: "OpenAI", vision: false },
//   { id: "provider-2/gpt-5-nano", name: "gpt-5-nano", provider: "A4F", vision: false, isDefault: true },
//   // ...add all models you had previously (do not remove)
// ];

// interface ModelSelectorProps {
//   selectedModel: string;
//   onModelChange: (modelId: string) => void;
//   isPremium?: boolean;
// }

// /**
//  * ModelSelector
//  * - Keeps your existing layout largely unchanged
//  * - Per-provider list becomes scrollable when > 4 models
//  * - Shows Crown + small Pro badge for pro models
//  * - Shows Eye icon (vision) without passing invalid `title` prop to Lucide
//  */
// export const ModelSelector: React.FC<ModelSelectorProps> = ({
//   selectedModel,
//   onModelChange,
//   isPremium = false,
// }) => {
//   const [isOpen, setIsOpen] = useState(false);
//   const buttonRef = useRef<HTMLButtonElement | null>(null);
//   const menuRef = useRef<HTMLDivElement | null>(null);

//   const groupedModels = allModels.reduce((acc, model) => {
//     (acc[model.provider] = acc[model.provider] || []).push(model);
//     return acc;
//   }, {} as Record<string, ModelDescriptor[]>);

//   useEffect(() => {
//     const handleClickOutside = (event: MouseEvent) => {
//       if (
//         menuRef.current &&
//         !menuRef.current.contains(event.target as Node) &&
//         buttonRef.current &&
//         !buttonRef.current.contains(event.target as Node)
//       ) {
//         setIsOpen(false);
//       }
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   const handleModelSelect = (modelId: string, isPro?: boolean) => {
//     if (isPro && !isPremium) {
//       alert("This is a premium model. Please upgrade to use it.");
//       return;
//     }
//     onModelChange(modelId);
//     setIsOpen(false);
//   };

//   const selectedModelInfo =
//     allModels.find((m) => m.id === selectedModel) ||
//     allModels.find((m) => m.isDefault) ||
//     allModels[0];

//   return (
//     <div className="relative inline-block">
//       {/* Thin scrollbar CSS (WebKit + Firefox) */}
//       <style>{`
//         /* WebKit */
//         .model-scroll::-webkit-scrollbar { height: 8px; width: 8px; }
//         .model-scroll::-webkit-scrollbar-thumb { background: rgba(100,100,100,0.35); border-radius: 999px; }
//         .model-scroll::-webkit-scrollbar-track { background: transparent; }
//         /* Firefox */
//         .model-scroll { scrollbar-width: thin; scrollbar-color: rgba(100,100,100,0.35) transparent; }
//       `}</style>

//       <button
//         ref={buttonRef}
//         onClick={() => setIsOpen((s) => !s)}
//         className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
//         aria-haspopup="listbox"
//         aria-expanded={isOpen}
//       >
//         <span className="truncate max-w-[12rem]">{selectedModelInfo?.name}</span>
//         <ChevronUp
//           className="h-4 w-4 text-muted-foreground transition-transform duration-200"
//           style={{ transform: isOpen ? "rotate(0deg)" : "rotate(180deg)" }}
//         />
//       </button>

//       {isOpen && (
//         <div
//           ref={menuRef}
//           className="absolute bottom-full mb-2 w-80 origin-bottom-right rounded-xl border bg-background shadow-xl z-50"
//           style={{ right: 3 }}
//         >
//           <div className="p-2">
//             {Object.entries(groupedModels).map(([provider, models]) => {
//               // If > 4 items, limit to 4 visible and make scrollable
//               const shouldScroll = models.length > 4;
//               // Use an estimated item height of 2.5rem (~40px); 4 * 2.5rem = 10rem
//               const listStyle: React.CSSProperties | undefined = shouldScroll
//                 ? { maxHeight: "10rem" } // 4 items visible, scrollbar thereafter
//                 : undefined;

//               return (
//                 <div key={provider} className="mt-2 first:mt-0">
//                   <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
//                     {provider}
//                   </div>

//                   <div
//                     className={cn(
//                       "mt-1 space-y-1 model-scroll overflow-y-auto pr-2",
//                       // if not scrolling, let content size naturally
//                       shouldScroll ? "overflow-y-auto" : ""
//                     )}
//                     role="listbox"
//                     aria-label={`${provider} models`}
//                     style={listStyle}
//                   >
//                     {models.map((model) => {
//                       const isPro = Boolean(model.isPro);
//                       const notAllowed = isPro && !isPremium;

//                       return (
//                         <button
//                           key={model.id}
//                           onClick={() => handleModelSelect(model.id, model.isPro)}
//                           aria-disabled={notAllowed}
//                           className={cn(
//                             "w-full flex items-center justify-between text-left rounded-md p-2 text-sm text-foreground transition-colors",
//                             notAllowed ? "opacity-50" : "hover:bg-accent",
//                             selectedModel === model.id ? "bg-accent" : ""
//                           )}
//                         >
//                           <div className="flex items-center gap-2">
//                             <span className="font-medium truncate max-w-[12rem]">{model.name}</span>

//                             {/* Vision indicator (no `title` prop passed to Icon) */}
//                             {model.vision && (
//                               <span className="inline-flex items-center gap-1 text-xs text-sky-600">
//                                 <Eye className="h-4 w-4" aria-hidden="true" />
//                                 <span className="sr-only">Vision-capable model</span>
//                               </span>
//                             )}

//                             {/* Pro indicator */}
//                             {model.isPro && (
//                               <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
//                                 <Crown className="h-3 w-3" aria-hidden="true" />
//                                 <span>Pro</span>
//                               </span>
//                             )}
//                           </div>

//                           {selectedModel === model.id && <Check className="h-4 w-4" />}
//                         </button>
//                       );
//                     })}
//                   </div>
//                 </div>
//               );
//             })}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };


// // src/modules/projects/ui/components/model-selector.tsx
// import React, { useState, useRef, useEffect } from "react";
// import { Check, ChevronUp, Crown, Eye, Wrench, Sparkles } from "lucide-react";
// import { cn } from "@/lib/utils";

// export type ModelCapabilities = {
//   vision?: boolean;
//   toolCalling?: boolean;
//   agentic?: boolean;
//   contextWindow?: number;
//   reasoning?: "basic" | "advanced" | "expert";
// };

// export type ModelDescriptor = {
//   id: string;
//   name: string;
//   provider: string;
//   isPro?: boolean;
//   isDefault?: boolean;
//   capabilities: ModelCapabilities;
//   description?: string;
// };

// export const allModels: ModelDescriptor[] = [
//   // NVIDIA Nemotron Family - Best for Agentic AI
//   //   {
// //     id: "provider-6/gpt-4o",
// //     name: "gpt-4o",
// //     provider: "A4F",
// //     vision: true,
// //   },
// //     id: "provider-6/gpt-4.1-mini",
// //     name: "gpt-4.1-mini",
// //     provider: "A4F",
// //     vision: true,

// //   // A4F / provider examples
// //   {
// //     id: "provider-3/gpt-4o-mini",
// //     name: "gpt-4o-mini",
// //     provider: "A4F",
// //     vision: true,
// //   },
// //   {
// //     id: "provider-3/deepseek-v3-0324",
// //     name: "deepseek-v3-0324",
// //     provider: "A4F",
// //     vision: true,
// //   },
// //   {
// //     id: "provider-6/qwen3-coder-480b-a35b",
// //     name: "qwen3-coder",
// //     provider: "A4F",
// //     vision: true,
// //   },
//   {
//     id: "provider-2/gpt-5-nano",
//     name: "gpt-5-nano",
//     provider: "A4F",
//     isDefault: true,
//     capabilities: {
//       vision: true,
//       toolCalling: true,
//       agentic: true,
//       contextWindow: 128000,
//       reasoning: "expert"
//     },
//     description: "Top-tier model for complex reasoning, tool calling, and visual tasks"

//   },
//   {
//     id: "nvidia/llama-3.1-nemotron-ultra-253b-v1",
//     name: "Nemotron Ultra 253B",
//     provider: "NVIDIA",
//     isPro: true,
//     capabilities: {
//       vision: true,
//       toolCalling: true,
//       agentic: true,
//       contextWindow: 128000,
//       reasoning: "expert"
//     },
//     description: "Top-tier model for complex reasoning, tool calling, and visual tasks"
//   },
//   {
//     id: "nvidia/llama-3.3-nemotron-super-49b-v1.5",
//     name: "Nemotron Super 49B v1.5",
//     provider: "NVIDIA",
//     capabilities: {
//       vision: true,
//       toolCalling: true,
//       agentic: true,
//       contextWindow: 128000,
//       reasoning: "advanced"
//     },
//     description: "Balanced performance for agentic workflows with vision support"
//   },
//   //   "openai/gpt-oss-120b",
// //   "nvidia/llama-3.1-nemotron-nano-4b-v1.1",
// //   "meta/llama-3.3-70b-instruct",
// //   "mistralai/mistral-nemotron",
// //   "nvidia/llama-3.3-nemotron-super-49b-v1.5",
// //   "nvidia/llama-3.1-nemotron-ultra-253b-v1",
//   {
//     id: "nvidia/llama-3.1-nemotron-70b-instruct",
//     name: "Nemotron 70B Instruct",
//     provider: "NVIDIA",
//     capabilities: {
//       vision: false,
//       toolCalling: true,
//       agentic: true,
//       contextWindow: 128000,
//       reasoning: "advanced"
//     },
//     description: "Optimized for helpfulness and instruction following"
//   },
//   {
//     id: "nvidia/llama-3.1-nemotron-nano-vl-8b-v1",
//     name: "Nemotron Nano VL 8B",
//     provider: "NVIDIA",
//     capabilities: {
//       vision: true,
//       toolCalling: true,
//       agentic: false,
//       contextWindow: 32000,
//       reasoning: "basic"
//     },
//     description: "Lightweight vision-language model for OCR and document processing"
//   },
//   {
//     id: "nvidia/llama-3.1-nemotron-nano-4b-v1.1",
//     name: "Nemotron Nano 4B",
//     provider: "NVIDIA",
//     // isDefault: true,
//     capabilities: {
//       vision: false,
//       toolCalling: true,
//       agentic: false,
//       contextWindow: 16000,
//       reasoning: "basic"
//     },
//     description: "Efficient small model for basic tasks"
//   },

//   // Meta Llama Models
//   {
//     id: "meta/llama-3.3-70b-instruct",
//     name: "Llama 3.3 70B Instruct",
//     provider: "Meta",
//     capabilities: {
//       vision: false,
//       toolCalling: true,
//       agentic: true,
//       contextWindow: 128000,
//       reasoning: "advanced"
//     },
//     description: "Latest Llama model with strong reasoning capabilities"
//   },
//   {
//     id: "meta/llama-3.2-11b-vision-instruct",
//     name: "Llama 3.2 11B Vision",
//     provider: "Meta",
//     capabilities: {
//       vision: true,
//       toolCalling: true,
//       agentic: false,
//       contextWindow: 128000,
//       reasoning: "basic"
//     },
//     description: "Vision-language model for multimodal tasks"
//   },
//   {
//     id: "meta/llama-4-maverick-17b-128e-instruct",
//     name: "Llama 4 Maverick 17B",
//     provider: "Meta",
//     // isPro: true,
//     capabilities: {
//       vision: true,
//       toolCalling: true,
//       agentic: true,
//       contextWindow: 128000,
//       reasoning: "advanced"
//     },
//     description: "Next-gen model with enhanced capabilities"
//   },
//   {
//     id: "meta/codellama-70b",
//     name: "CodeLlama 70B",
//     provider: "Meta",
//     capabilities: {
//       vision: false,
//       toolCalling: true,
//       agentic: false,
//       contextWindow: 100000,
//       reasoning: "advanced"
//     },
//     description: "Specialized for code generation and analysis"
//   },

//   // Mistral Models
//   {
//     id: "mistralai/mistral-nemotron",
//     name: "Mistral Nemotron",
//     provider: "Mistral",
//     capabilities: {
//       vision: false,
//       toolCalling: true,
//       agentic: true,
//       contextWindow: 128000,
//       reasoning: "advanced"
//     },
//     description: "Mistral's collaboration with NVIDIA for enhanced performance"
//   },
//   {
//     id: "mistralai/mistral-small-3.2-24b-instruct",
//     name: "Mistral Small 3.2 24B",
//     provider: "Mistral",
//     capabilities: {
//       vision: true,
//       toolCalling: true,
//       agentic: true,
//       contextWindow: 128000,
//       reasoning: "advanced"
//     },
//     description: "Supports multiple tools and forced tool usage"
//   },
//   {
//     id: "mistralai/codestral-22b-instruct-v01",
//     name: "Codestral 22B",
//     provider: "Mistral",
//     capabilities: {
//       vision: false,
//       toolCalling: true,
//       agentic: false,
//       contextWindow: 32000,
//       reasoning: "advanced"
//     },
//     description: "Code-focused model with tool support"
//   },

//   // DeepSeek Models
//   {
//     id: "deepseek-ai/deepseek-r1-0528",
//     name: "DeepSeek R1 0528",
//     provider: "DeepSeek",
//     // isPro: true,
//     capabilities: {
//       vision: false,
//       toolCalling: true,
//       agentic: true,
//       contextWindow: 128000,
//       reasoning: "expert"
//     },
//     description: "State-of-the-art reasoning model"
//   },
//   {
//     id: "deepseek-ai/deepseek-r1-distill-llama-8b",
//     name: "DeepSeek R1 Distill 8B",
//     provider: "DeepSeek",
//     capabilities: {
//       vision: false,
//       toolCalling: true,
//       agentic: true,
//       contextWindow: 128000,
//       reasoning: "advanced"
//     },
//     description: "Distilled version with preserved reasoning capabilities"
//   },

//   // Qwen Models
//   {
//     id: "qwen/qwen3-235b-a22b",
//     name: "Qwen3 235B",
//     provider: "Qwen",
//     // isPro: true,
//     capabilities: {
//       vision: false,
//       toolCalling: true,
//       agentic: true,
//       contextWindow: 128000,
//       reasoning: "expert"
//     },
//     description: "Large-scale model for complex tasks"
//   },
//   {
//     id: "qwen/qwen2.5-coder-32b-instruct",
//     name: "Qwen2.5 Coder 32B",
//     provider: "Qwen",
//     capabilities: {
//       vision: false,
//       toolCalling: true,
//       agentic: false,
//       contextWindow: 128000,
//       reasoning: "advanced"
//     },
//     description: "Specialized for coding with tool integration"
//   },

//   // Moonshot AI Models
//   {
//     id: "moonshotai/kimi-k2-instruct",
//     name: "Kimi K2 Instruct",
//     provider: "Moonshot",
//     capabilities: {
//       vision: false,
//       toolCalling: true,
//       agentic: true,
//       contextWindow: 256000,
//       reasoning: "advanced"
//     },
//     description: "Extended context window for long documents"
//   },

//   // IBM Models
//   {
//     id: "ibm/granite-34b-code-instruct",
//     name: "Granite 34B Code",
//     provider: "IBM",
//     capabilities: {
//       vision: false,
//       toolCalling: true,
//       agentic: false,
//       contextWindow: 32000,
//       reasoning: "advanced"
//     },
//     description: "Enterprise-focused code generation"
//   },

//   // OpenAI Models
//   {
//     id: "openai/gpt-oss-120b",
//     name: "GPT OSS 120B",
//     provider: "OpenAI",
//     capabilities: {
//       vision: false,
//       toolCalling: true,
//       agentic: true,
//       contextWindow: 128000,
//       reasoning: "advanced"
//     },
//     description: "Open-source GPT variant"
//   },

//   // Google Models
//   {
//     id: "google/codegemma-1.1-7b-1",
//     name: "CodeGemma 1.1 7B",
//     provider: "Google",
//     capabilities: {
//       vision: false,
//       toolCalling: true,
//       agentic: false,
//       contextWindow: 8192,
//       reasoning: "basic"
//     },
//     description: "Lightweight code model"
//   },
//   {
//     id: "google/gemma-3-1b-it",
//     name: "Gemma 3 1B",
//     provider: "Google",
//     capabilities: {
//       vision: false,
//       toolCalling: false,
//       agentic: false,
//       contextWindow: 8192,
//       reasoning: "basic"
//     },
//     description: "Ultra-lightweight model for simple tasks"
//   }
// ];

// interface ModelSelectorProps {
//   selectedModel: string;
//   onModelChange: (modelId: string) => void;
//   isPremium?: boolean;
//   filterCapabilities?: Partial<ModelCapabilities>;
// }

// export const ModelSelector: React.FC<ModelSelectorProps> = ({
//   selectedModel,
//   onModelChange,
//   isPremium = false,
//   filterCapabilities,
// }) => {
//   const [isOpen, setIsOpen] = useState(false);
//   const [searchQuery, setSearchQuery] = useState("");
//   const buttonRef = useRef<HTMLButtonElement | null>(null);
//   const menuRef = useRef<HTMLDivElement | null>(null);

//   // Filter models based on capabilities if specified
//   const filteredModels = filterCapabilities
//     ? allModels.filter(model => {
//         if (filterCapabilities.vision && !model.capabilities.vision) return false;
//         if (filterCapabilities.toolCalling && !model.capabilities.toolCalling) return false;
//         if (filterCapabilities.agentic && !model.capabilities.agentic) return false;
//         return true;
//       })
//     : allModels;

//   // Further filter by search query
//   const searchedModels = searchQuery
//     ? filteredModels.filter(model =>
//         model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
//         model.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
//         model.description?.toLowerCase().includes(searchQuery.toLowerCase())
//       )
//     : filteredModels;

//   const groupedModels = searchedModels.reduce((acc, model) => {
//     (acc[model.provider] = acc[model.provider] || []).push(model);
//     return acc;
//   }, {} as Record<string, ModelDescriptor[]>);

//   useEffect(() => {
//     const handleClickOutside = (event: MouseEvent) => {
//       if (
//         menuRef.current &&
//         !menuRef.current.contains(event.target as Node) &&
//         buttonRef.current &&
//         !buttonRef.current.contains(event.target as Node)
//       ) {
//         setIsOpen(false);
//         setSearchQuery("");
//       }
//     };

//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   const handleModelSelect = (modelId: string, isPro?: boolean) => {
//     if (isPro && !isPremium) {
//       alert("This is a premium model. Please upgrade to use it.");
//       return;
//     }
//     onModelChange(modelId);
//     setIsOpen(false);
//     setSearchQuery("");
//   };

//   const selectedModelInfo = allModels.find((m) => m.id === selectedModel) ||
//     allModels.find((m) => m.isDefault) ||
//     allModels[0];

//   const getCapabilityBadges = (capabilities: ModelCapabilities) => {
//     const badges = [];
    
//     if (capabilities.vision) {
//       badges.push(
//         <span key="vision" className="inline-flex items-center gap-1 text-xs text-sky-600">
//           <Eye className="h-3 w-3" />
//           <span>Vision</span>
//         </span>
//       );
//     }
    
//     if (capabilities.toolCalling) {
//       badges.push(
//         <span key="tool" className="inline-flex items-center gap-1 text-xs text-green-600">
//           <Wrench className="h-3 w-3" />
//           <span>Tools</span>
//         </span>
//       );
//     }
    
//     if (capabilities.agentic) {
//       badges.push(
//         <span key="agent" className="inline-flex items-center gap-1 text-xs text-purple-600">
//           <Sparkles className="h-3 w-3" />
//           <span>Agentic</span>
//         </span>
//       );
//     }
    
//     return badges;
//   };

//   return (
//     <div className="relative inline-block">
//       <style>{`
//         .model-scroll::-webkit-scrollbar {
//           height: 8px;
//           width: 8px;
//         }
//         .model-scroll::-webkit-scrollbar-thumb {
//           background: rgba(100,100,100,0.35);
//           border-radius: 999px;
//         }
//         .model-scroll::-webkit-scrollbar-track {
//           background: transparent;
//         }
//         .model-scroll {
//           scrollbar-width: thin;
//           scrollbar-color: rgba(100,100,100,0.35) transparent;
//         }
//       `}</style>

//       <button
//         ref={buttonRef}
//         onClick={() => setIsOpen((s) => !s)}
//         className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
//         aria-haspopup="listbox"
//         aria-expanded={isOpen}
//       >
//         <span className="truncate max-w-[14rem]">{selectedModelInfo?.name}</span>
//         <div className="flex items-center gap-1">
//           {selectedModelInfo && getCapabilityBadges(selectedModelInfo.capabilities)}
//         </div>
//         <ChevronUp
//           className="h-4 w-4 text-muted-foreground transition-transform duration-200"
//           style={{ transform: isOpen ? "rotate(0deg)" : "rotate(180deg)" }}
//         />
//       </button>

//       {isOpen && (
//         <div
//           ref={menuRef}
//           className="absolute bottom-full mb-2 w-96 origin-bottom-right rounded-xl border bg-background shadow-xl z-50"
//           style={{ right: 0 }}
//         >
//           {/* Search Input */}
//           <div className="p-3 border-b">
//             <input
//               type="text"
//               placeholder="Search models..."
//               value={searchQuery}
//               onChange={(e) => setSearchQuery(e.target.value)}
//               className="w-full px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
//               autoFocus
//             />
//           </div>

//           {/* Capability Filters (Optional) */}
//           <div className="px-3 py-2 border-b flex gap-2 text-xs">
//             <span className="text-muted-foreground">Filter:</span>
//             <button
//               onClick={() => setSearchQuery("vision")}
//               className="hover:text-primary transition-colors"
//             >
//               Vision
//             </button>
//             <button
//               onClick={() => setSearchQuery("tool")}
//               className="hover:text-primary transition-colors"
//             >
//               Tools
//             </button>
//             <button
//               onClick={() => setSearchQuery("agent")}
//               className="hover:text-primary transition-colors"
//             >
//               Agentic
//             </button>
//           </div>

//           <div className="p-2 max-h-96 overflow-y-auto model-scroll">
//             {Object.entries(groupedModels).length === 0 ? (
//               <div className="px-4 py-8 text-center text-sm text-muted-foreground">
//                 No models found matching your criteria
//               </div>
//             ) : (
//               Object.entries(groupedModels).map(([provider, models]) => {
//                 const shouldScroll = models.length > 4;
//                 const listStyle: React.CSSProperties | undefined = shouldScroll
//                   ? { maxHeight: "10rem" }
//                   : undefined;

//                 return (
//                   <div key={provider} className="mt-3 first:mt-0">
//                     <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
//                       {provider} ({models.length})
//                     </div>
//                     <div
//                       className={cn(
//                         "mt-1 space-y-1 model-scroll pr-2",
//                         shouldScroll ? "overflow-y-auto" : ""
//                       )}
//                       role="listbox"
//                       aria-label={`${provider} models`}
//                       style={listStyle}
//                     >
//                       {models.map((model) => {
//                         const isPro = Boolean(model.isPro);
//                         const notAllowed = isPro && !isPremium;
                        
//                         return (
//                           <button
//                             key={model.id}
//                             onClick={() => handleModelSelect(model.id, model.isPro)}
//                             aria-disabled={notAllowed}
//                             className={cn(
//                               "w-full text-left rounded-md p-2 text-sm transition-colors",
//                               notAllowed ? "opacity-50" : "hover:bg-accent",
//                               selectedModel === model.id ? "bg-accent" : ""
//                             )}
//                           >
//                             <div className="flex items-center justify-between">
//                               <div className="flex-1">
//                                 <div className="flex items-center gap-2">
//                                   <span className="font-medium">{model.name}</span>
//                                   {model.isPro && (
//                                     <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
//                                       <Crown className="h-3 w-3" />
//                                       <span>Pro</span>
//                                     </span>
//                                   )}
//                                 </div>
//                                 <div className="mt-1 flex items-center gap-2">
//                                   {getCapabilityBadges(model.capabilities)}
//                                   {model.capabilities.contextWindow && (
//                                     <span className="text-[10px] text-muted-foreground">
//                                       {Math.floor(model.capabilities.contextWindow / 1000)}K ctx
//                                     </span>
//                                   )}
//                                 </div>
//                                 {model.description && (
//                                   <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
//                                     {model.description}
//                                   </div>
//                                 )}
//                               </div>
//                               {selectedModel === model.id && (
//                                 <Check className="h-4 w-4 ml-2 flex-shrink-0" />
//                               )}
//                             </div>
//                           </button>
//                         );
//                       })}
//                     </div>
//                   </div>
//                 );
//               })
//             )}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

import React, { useState, useRef, useEffect } from "react";
import { Check, ChevronUp, Crown, Eye, Wrench, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type ModelCapabilities = {
  vision?: boolean;
  toolCalling?: boolean;
  agentic?: boolean;
  contextWindow?: number;
  reasoning?: "basic" | "advanced" | "expert";
};

export type ClientEnvConfig = {
  apiKeyEnv?: string; // name of the env var that contains the API key for this provider
  baseUrlEnv?: string; // name of the env var that contains an optional base url override
};

export type ModelDescriptor = {
  id: string;
  name: string;
  provider: string; // human-friendly provider name (e.g. "A4F", "NVIDIA")
  providerId?: string; // machine provider id (optional, e.g. "a4f", "nvidia")
  isPro?: boolean;
  isDefault?: boolean;
  capabilities: ModelCapabilities;
  description?: string;
  clientEnv?: ClientEnvConfig; // optional hint for backends about env var names to use
};

export const allModels: ModelDescriptor[] = [
  // A4F Models (added from https://www.a4f.co/models)
  {
    id: "provider-6/gpt-4o",
    name: "gpt-4o",
    provider: "A4F",
    providerId: "a4f",
    clientEnv: { apiKeyEnv: "OPENAI_A4F_API_KEY", baseUrlEnv: "OPENAI_A4F_BASE_URL" },
    capabilities: {
      vision: true,
      toolCalling: true,
      agentic: true,
      contextWindow: 128000,
      reasoning: "advanced",
    },
    description: "gpt-4o — general-purpose multimodal model available via A4F",
  },
  {
    id: "provider-6/gpt-4.1-mini",
    name: "gpt-4.1-mini",
    provider: "A4F",
    providerId: "a4f",
    clientEnv: { apiKeyEnv: "OPENAI_A4F_API_KEY", baseUrlEnv: "OPENAI_A4F_BASE_URL" },
    capabilities: {
      vision: true,
      toolCalling: true,
      agentic: false,
      contextWindow: 64000,
      reasoning: "basic",
    },
    description: "Smaller/generic multimodal variant (A4F)",
  },
  {
    id: "provider-3/gpt-4o-mini",
    name: "gpt-4o-mini",
    provider: "A4F",
    providerId: "a4f",
    clientEnv: { apiKeyEnv: "OPENAI_A4F_API_KEY", baseUrlEnv: "OPENAI_A4F_BASE_URL" },
    capabilities: {
      vision: true,
      toolCalling: true,
      agentic: false,
      contextWindow: 32000,
      reasoning: "basic",
    },
    description: "Lightweight gpt-4o family model on A4F",
  },
  //   {
  //   id: "provider-6/gemini-2.5-flash-thinking",
  //   name: "gemini-2.5-flash-thinking",
  //   provider: "A4F",
  //   providerId: "a4f",
  //   clientEnv: { apiKeyEnv: "OPENAI_A4F_API_KEY", baseUrlEnv: "OPENAI_A4F_BASE_URL" },
  //   capabilities: {
  //     vision: true,
  //     toolCalling: true,
  //     agentic: false,
  //     contextWindow: 128000,
  //     reasoning: "advanced",
  //   },
  //   description: "Lightweight gemini-2.5-flash-thinking family model on A4F",
  // },
  //   {
  //   id: "provider-6/o3-medium",
  //   name: "o3-medium",
  //   provider: "A4F",
  //   providerId: "a4f",
  //   clientEnv: { apiKeyEnv: "OPENAI_A4F_API_KEY", baseUrlEnv: "OPENAI_A4F_BASE_URL" },
  //   capabilities: {
  //     vision: true,
  //     toolCalling: true,
  //     agentic: false,
  //     contextWindow: 32000,
  //     reasoning: "basic",
  //   },
  //   description: "Lightweight o3-medium family model on A4F",
  // },
    {
    id: "provider-6/llama-4-scout",
    name: "llama-4-scout",
    provider: "A4F",
    providerId: "a4f",
    clientEnv: { apiKeyEnv: "OPENAI_A4F_API_KEY", baseUrlEnv: "OPENAI_A4F_BASE_URL" },
    capabilities: {
      vision: true,
      toolCalling: true,
      agentic: false,
      contextWindow: 128000,
      reasoning: "expert",
    },
    description: "Lightweight llama-4-scout family model on A4F",
  },
  {
    id: "provider-3/deepseek-v3-0324",
    name: "deepseek-v3-0324",
    provider: "A4F",
    providerId: "a4f",
    clientEnv: { apiKeyEnv: "OPENAI_A4F_API_KEY", baseUrlEnv: "OPENAI_A4F_BASE_URL" },
    capabilities: {
      vision: true,
      toolCalling: true,
      agentic: true,
      contextWindow: 128000,
      reasoning: "expert",
    },
    description: "DeepSeek v3 (A4F-hosted) — high-end reasoning model",
  },
    {
    id: "provider-6/glm-4.5-air",
    name: "glm-4.5-air",
    provider: "A4F",
    providerId: "a4f",
    clientEnv: { apiKeyEnv: "OPENAI_A4F_API_KEY", baseUrlEnv: "OPENAI_A4F_BASE_URL" },
    capabilities: {
      vision: false,
      toolCalling: true,
      agentic: false,
      contextWindow: 128000,
      reasoning: "expert",
    },
    description: "glm-4.5-air (A4F-hosted) — high-end reasoning model",
  },
  // {
  //   id: "provider-6/qwen3-coder-480b-a35b",
  //   name: "qwen3-coder",
  //   provider: "A4F",
  //   providerId: "a4f",
  //   clientEnv: { apiKeyEnv: "OPENAI_A4F_API_KEY", baseUrlEnv: "OPENAI_A4F_BASE_URL" },
  //   capabilities: {
  //     vision: true,
  //     toolCalling: true,
  //     agentic: true,
  //     contextWindow: 128000,
  //     reasoning: "expert",
  //   },
  //   description: "Qwen3 coder edition available through A4F",
  // },
    {
    id: "provider-2/qwen3-coder",
    name: "qwen3-coder",
    provider: "A4F",
    providerId: "a4f",
    clientEnv: { apiKeyEnv: "OPENAI_A4F_API_KEY", baseUrlEnv: "OPENAI_A4F_BASE_URL" },
    capabilities: {
      vision: true,
      toolCalling: true,
      agentic: true,
      contextWindow: 128000,
      reasoning: "expert",
    },
    description: "Qwen3 coder edition available through A4F",
  },
  //  {
  //   id: "provider-3/qwen-3-235b-a22b-2507",
  //   name: "qwen-3-235b",
  //   provider: "A4F",
  //   providerId: "a4f",
  //   clientEnv: { apiKeyEnv: "OPENAI_A4F_API_KEY", baseUrlEnv: "OPENAI_A4F_BASE_URL" },
  //   capabilities: {
  //     vision: false,
  //     toolCalling: true,
  //     agentic:false,
  //     contextWindow: 128000,
  //     reasoning: "expert",
  //   },
  //   description: "Qwen3 coder edition available through A4F",
  // },
  {
    id: "provider-6/qwen-3-235b-a22b-2507",
    name: "qwen-3-235b",
    provider: "A4F",
    providerId: "a4f",
    clientEnv: { apiKeyEnv: "OPENAI_A4F_API_KEY", baseUrlEnv: "OPENAI_A4F_BASE_URL" },
    capabilities: {
      vision: false,
      toolCalling: true,
      agentic:false,
      contextWindow: 128000,
      reasoning: "expert",
    },
    description: "Qwen3 coder edition available through A4F",
  },
   {
    id: "provider-6/qwen3-coder-480b-a35b",
    name: "qwen3-coder-480b",
    provider: "A4F",
    providerId: "a4f",
    clientEnv: { apiKeyEnv: "OPENAI_A4F_API_KEY", baseUrlEnv: "OPENAI_A4F_BASE_URL" },
    capabilities: {
      vision: false,
      toolCalling: true,
      agentic:false,
      contextWindow: 128000,
      reasoning: "expert",
    },
    description: "Qwen3 coder edition available through A4F",
  },
    {
    id: "provider-6/llama-4-maverick",
    name: "llama-4-maverick",
    provider: "A4F",
    providerId: "a4f",
    clientEnv: { apiKeyEnv: "OPENAI_A4F_API_KEY", baseUrlEnv: "OPENAI_A4F_BASE_URL" },
    capabilities: {
      vision: true,
      toolCalling: true,
      agentic: false,
      contextWindow: 128000,
      reasoning: "expert",
    },
    description: "llama-4-maverick edition available through A4F",
  },

  // existing entries (kept for backward compatibility)
  {
    id: "provider-2/gpt-5-nano",
    name: "gpt-5-nano",
    provider: "A4F",
    providerId: "a4f",
    isDefault: true,
    clientEnv: { apiKeyEnv: "OPENAI_A4F_API_KEY", baseUrlEnv: "OPENAI_A4F_BASE_URL" },
    capabilities: {
      vision: true,
      toolCalling: true,
      agentic: true,
      contextWindow: 128000,
      reasoning: "expert"
    },
    description: "Top-tier model for complex reasoning, tool calling, and visual tasks"
  },
    {
    id: "provider-6/gpt-5-nano",
    name: "gpt-5-nano",
    provider: "A4F",
    providerId: "a4f",
    isDefault: true,
    clientEnv: { apiKeyEnv: "OPENAI_A4F_API_KEY", baseUrlEnv: "OPENAI_A4F_BASE_URL" },
    capabilities: {
      vision: true,
      toolCalling: true,
      agentic: true,
      contextWindow: 128000,
      reasoning: "expert"
    },
    description: "Top-tier model for complex reasoning, tool calling, and visual tasks"
  },
  {
    id: "nvidia/llama-3.1-nemotron-ultra-253b-v1",
    name: "Nemotron Ultra 253B",
    provider: "NVIDIA",
    providerId: "nvidia",
    // isPro: true,
    clientEnv: { apiKeyEnv: "NVIDIA_API_KEY", baseUrlEnv: "NVIDIA_BASE_URL" },
    capabilities: {
      vision: true,
      toolCalling: true,
      agentic: true,
      contextWindow: 128000,
      reasoning: "expert"
    },
    description: "Top-tier model for complex reasoning, tool calling, and visual tasks"
  },
  {
    id: "nvidia/llama-3.3-nemotron-super-49b-v1.5",
    name: "Nemotron Super 49B v1.5",
    provider: "NVIDIA",
    providerId: "nvidia",
    clientEnv: { apiKeyEnv: "NVIDIA_API_KEY", baseUrlEnv: "NVIDIA_BASE_URL" },
    capabilities: {
      vision: true,
      toolCalling: true,
      agentic: true,
      contextWindow: 128000,
      reasoning: "advanced"
    },
    description: "Balanced performance for agentic workflows with vision support"
  },
  {
    id: "nvidia/llama-3.1-nemotron-70b-instruct",
    name: "Nemotron 70B Instruct",
    provider: "NVIDIA",
    providerId: "nvidia",
    clientEnv: { apiKeyEnv: "NVIDIA_API_KEY", baseUrlEnv: "NVIDIA_BASE_URL" },
    capabilities: {
      vision: false,
      toolCalling: true,
      agentic: true,
      contextWindow: 128000,
      reasoning: "advanced"
    },
    description: "Optimized for helpfulness and instruction following"
  },
  {
    id: "nvidia/llama-3.1-nemotron-nano-vl-8b-v1",
    name: "Nemotron Nano VL 8B",
    provider: "NVIDIA",
    providerId: "nvidia",
    clientEnv: { apiKeyEnv: "NVIDIA_API_KEY", baseUrlEnv: "NVIDIA_BASE_URL" },
    capabilities: {
      vision: true,
      toolCalling: true,
      agentic: false,
      contextWindow: 32000,
      reasoning: "basic"
    },
    description: "Lightweight vision-language model for OCR and document processing"
  },
  {
    id: "nvidia/llama-3.1-nemotron-nano-4b-v1.1",
    name: "Nemotron Nano 4B",
    provider: "NVIDIA",
    providerId: "nvidia",
    clientEnv: { apiKeyEnv: "NVIDIA_API_KEY", baseUrlEnv: "NVIDIA_BASE_URL" },
    // isDefault: true,
    capabilities: {
      vision: false,
      toolCalling: true,
      agentic: false,
      contextWindow: 16000,
      reasoning: "basic"
    },
    description: "Efficient small model for basic tasks"
  },

  // Meta Llama Models
  {
    id: "meta/llama-3.3-70b-instruct",
    name: "Llama 3.3 70B Instruct",
    provider: "Meta",
    providerId: "nvidia",
    clientEnv: { apiKeyEnv: "NVIDIA_API_KEY", baseUrlEnv: "NVIDIA_BASE_URL" },
    capabilities: {
      vision: false,
      toolCalling: true,
      agentic: true,
      contextWindow: 128000,
      reasoning: "advanced"
    },
    description: "Latest Llama model with strong reasoning capabilities"
  },
  {
    id: "meta/llama-3.2-11b-vision-instruct",
    name: "Llama 3.2 11B Vision",
    provider: "Meta",
    providerId: "nvidia",
    clientEnv: { apiKeyEnv: "NVIDIA_API_KEY", baseUrlEnv: "NVIDIA_BASE_URL" },
    capabilities: {
      vision: true,
      toolCalling: true,
      agentic: false,
      contextWindow: 128000,
      reasoning: "basic"
    },
    description: "Vision-language model for multimodal tasks"
  },
  {
    id: "meta/llama-4-maverick-17b-128e-instruct",
    name: "Llama 4 Maverick 17B",
    provider: "Meta",
    providerId: "nvidia",
    clientEnv: { apiKeyEnv: "NVIDIA_API_KEY", baseUrlEnv: "NVIDIA_BASE_URL" },
    // isPro: true,
    capabilities: {
      vision: true,
      toolCalling: true,
      agentic: true,
      contextWindow: 128000,
      reasoning: "advanced"
    },
    description: "Next-gen model with enhanced capabilities"
  },
  // {
  //   id: "meta/codellama-70b",
  //   name: "CodeLlama 70B",
  //   provider: "Meta",
  //   providerId: "nvidia",
  //   clientEnv: { apiKeyEnv: "NVIDIA_API_KEY", baseUrlEnv: "NVIDIA_BASE_URL" },
  //   capabilities: {
  //     vision: false,
  //     toolCalling: true,
  //     agentic: false,
  //     contextWindow: 100000,
  //     reasoning: "advanced"
  //   },
  //   description: "Specialized for code generation and analysis"
  // },
  //   {
  //   id: "microsoft/phi-4-mini-instruct",
  //   name: "phi-4-mini",
  //   provider: "Microsoft",
  //   providerId: "nvidia",
  //   clientEnv: { apiKeyEnv: "NVIDIA_API_KEY", baseUrlEnv: "NVIDIA_BASE_URL" },
  //   capabilities: {
  //     vision: false,
  //     toolCalling: true,
  //     agentic: false,
  //     contextWindow: 128000,
  //     reasoning: "advanced"
  //   },
  //   description: "Specialized for code generation and analysis"
  // },
  //     {
  //   id: "tiiuae/falcon3-7b-instruct",
  //   name: "falcon3-7b",
  //   provider: "Microsoft",
  //   providerId: "nvidia",
  //   clientEnv: { apiKeyEnv: "NVIDIA_API_KEY", baseUrlEnv: "NVIDIA_BASE_URL" },
  //   capabilities: {
  //     vision: false,
  //     toolCalling: true,
  //     agentic: false,
  //     contextWindow: 32000,
  //     reasoning: "advanced"
  //   },
  //   description: "Specialized for code generation and analysis"
  // },
        {
    id: "meta/llama-3.3-70b-instruct",
    name: "llama-3.3-70b",
    provider: "Meta",
    providerId: "nvidia",
    clientEnv: { apiKeyEnv: "NVIDIA_API_KEY", baseUrlEnv: "NVIDIA_BASE_URL" },
    capabilities: {
      vision: false,
      toolCalling: true,
      agentic: false,
      contextWindow: 32000,
      reasoning: "advanced"
    },
    description: "Specialized for code generation and analysis"
  },

  // Mistral Models
  {
    id: "mistralai/mistral-nemotron",
    name: "Mistral Nemotron",
    provider: "Mistral",
    providerId: "nvidia",
    clientEnv: { apiKeyEnv: "NVIDIA_API_KEY", baseUrlEnv: "NVIDIA_BASE_URL" },
    capabilities: {
      vision: false,
      toolCalling: true,
      agentic: true,
      contextWindow: 128000,
      reasoning: "advanced"
    },
    description: "Mistral's collaboration with NVIDIA for enhanced performance"
  },
  {
    id: "mistralai/mistral-small-3.2-24b-instruct",
    name: "Mistral Small 3.2 24B",
    provider: "Mistral",
    providerId: "nvidia",
    clientEnv: { apiKeyEnv: "NVIDIA_API_KEY", baseUrlEnv: "NVIDIA_BASE_URL" },
    capabilities: {
      vision: true,
      toolCalling: true,
      agentic: true,
      contextWindow: 128000,
      reasoning: "advanced"
    },
    description: "Supports multiple tools and forced tool usage"
  },
  {
    id: "mistralai/codestral-22b-instruct-v01",
    name: "Codestral 22B",
    provider: "Mistral",
    providerId: "nvidia",
    clientEnv: { apiKeyEnv: "NVIDIA_API_KEY", baseUrlEnv: "NVIDIA_BASE_URL" },
    capabilities: {
      vision: false,
      toolCalling: true,
      agentic: false,
      contextWindow: 32000,
      reasoning: "advanced"
    },
    description: "Code-focused model with tool support"
  },

  // DeepSeek Models
  {
    id: "deepseek-ai/deepseek-r1-0528",
    name: "DeepSeek R1 0528",
    provider: "DeepSeek",
    providerId: "nvidia",
    clientEnv: { apiKeyEnv: "NVIDIA_API_KEY", baseUrlEnv: "NVIDIA_BASE_URL" },
    // isPro: true,
    capabilities: {
      vision: false,
      toolCalling: true,
      agentic: true,
      contextWindow: 128000,
      reasoning: "expert"
    },
    description: "State-of-the-art reasoning model"
  },
  {
    id: "deepseek-ai/deepseek-v3.1",
    name: "deepseek-v3.1",
    provider: "DeepSeek",
    providerId: "nvidia",
    clientEnv: { apiKeyEnv: "NVIDIA_API_KEY", baseUrlEnv: "NVIDIA_BASE_URL" },
    // isPro: true,
    capabilities: {
      vision: false,
      toolCalling: true,
      agentic: true,
      contextWindow: 128000,
      reasoning: "expert"
    },
    description: "State-of-the-art reasoning model"
  },
  {
    id: "deepseek-ai/deepseek-r1-distill-llama-8b",
    name: "DeepSeek R1 Distill 8B",
    provider: "DeepSeek",
    providerId: "nvidia",
    clientEnv: { apiKeyEnv: "NVIDIA_API_KEY", baseUrlEnv: "NVIDIA_BASE_URL" },
    capabilities: {
      vision: false,
      toolCalling: true,
      agentic: true,
      contextWindow: 128000,
      reasoning: "advanced"
    },
    description: "Distilled version with preserved reasoning capabilities"
  },

  // Qwen Models
  {
    id: "qwen/qwen3-235b-a22b",
    name: "Qwen3 235B",
    provider: "Qwen",
    providerId: "nvidia",
    clientEnv: { apiKeyEnv: "NVIDIA_API_KEY", baseUrlEnv: "NVIDIA_BASE_URL" },
    // isPro: true,
    capabilities: {
      vision: false,
      toolCalling: true,
      agentic: true,
      contextWindow: 128000,
      reasoning: "expert"
    },
    description: "Large-scale model for complex tasks"
  },
    {
    id: "qwen/qwen3-coder-480b-a35b-instruct",
    name: "qwen3-coder-480b",
    provider: "Qwen",
    providerId: "nvidia",
    clientEnv: { apiKeyEnv: "NVIDIA_API_KEY", baseUrlEnv: "NVIDIA_BASE_URL" },
    // isPro: true,
    capabilities: {
      vision: false,
      toolCalling: true,
      agentic: true,
      contextWindow: 128000,
      reasoning: "expert"
    },
    description: "Large-scale model for complex tasks"
  },
  {
    id: "qwen/qwen2.5-coder-32b-instruct",
    name: "Qwen2.5 Coder 32B",
    provider: "Qwen",
    providerId: "nvidia",
    clientEnv: { apiKeyEnv: "NVIDIA_API_KEY", baseUrlEnv: "NVIDIA_BASE_URL" },
    capabilities: {
      vision: false,
      toolCalling: true,
      agentic: false,
      contextWindow: 128000,
      reasoning: "advanced"
    },
    description: "Specialized for coding with tool integration"
  },

  // Moonshot AI Models
  {
    id: "moonshotai/kimi-k2-instruct",
    name: "Kimi K2 Instruct",
    provider: "Moonshot",
    providerId: "nvidia",
    clientEnv: { apiKeyEnv: "NVIDIA_API_KEY", baseUrlEnv: "NVIDIA_BASE_URL" },
    capabilities: {
      vision: false,
      toolCalling: true,
      agentic: true,
      contextWindow: 256000,
      reasoning: "advanced"
    },
    description: "Extended context window for long documents"
  },

  // IBM Models
  {
    id: "ibm/granite-34b-code-instruct",
    name: "Granite 34B Code",
    provider: "IBM",
    providerId: "nvidia",
    clientEnv: { apiKeyEnv: "NVIDIA_API_KEY", baseUrlEnv: "NVIDIA_BASE_URL" },
    capabilities: {
      vision: false,
      toolCalling: true,
      agentic: false,
      contextWindow: 32000,
      reasoning: "advanced"
    },
    description: "Enterprise-focused code generation"
  },
  {
    id: "ibm/granite-3.3-8b-instruct",
    name: "granite-3.3-8b",
    provider: "IBM",
    providerId: "nvidia",
    clientEnv: { apiKeyEnv: "NVIDIA_API_KEY", baseUrlEnv: "NVIDIA_BASE_URL" },
    capabilities: {
      vision: false,
      toolCalling: true,
      agentic: false,
      contextWindow: 128000,
      reasoning: "advanced"
    },
    description: "Enterprise-focused code generation"
  },

  // OpenAI Models
  {
    id: "openai/gpt-oss-120b",
    name: "GPT OSS 120B",
    provider: "OpenAI",
    providerId: "nvidia",
    clientEnv: { apiKeyEnv: "NVIDIA_API_KEY", baseUrlEnv: "NVIDIA_BASE_URL" },
    capabilities: {
      vision: false,
      toolCalling: true,
      agentic: true,
      contextWindow: 128000,
      reasoning: "advanced"
    },
    description: "Open-source GPT variant"
  },

  // Google Models
  // {
  //   id: "google/codegemma-1.1-7b-1",
  //   name: "CodeGemma 1.1 7B",
  //   provider: "Google",
  //   providerId: "nvidia",
  //   clientEnv: { apiKeyEnv: "NVIDIA_API_KEY", baseUrlEnv: "NVIDIA_BASE_URL" },
  //   capabilities: {
  //     vision: false,
  //     toolCalling: true,
  //     agentic: false,
  //     contextWindow: 8192,
  //     reasoning: "basic"
  //   },
  //   description: "Lightweight code model"
  // },
  // {
  //   id: "google/gemma-3-1b-it",
  //   name: "Gemma 3 1B",
  //   provider: "Google",
  //   providerId: "nvidia",
  //   clientEnv: { apiKeyEnv: "NVIDIA_API_KEY", baseUrlEnv: "NVIDIA_BASE_URL" },
  //   capabilities: {
  //     vision: false,
  //     toolCalling: false,
  //     agentic: false,
  //     contextWindow: 8192,
  //     reasoning: "basic"
  //   },
  //   description: "Ultra-lightweight model for simple tasks"
  // }
];

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  isPremium?: boolean;
  filterCapabilities?: Partial<ModelCapabilities>;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onModelChange,
  isPremium = false,
  filterCapabilities,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Filter models based on capabilities if specified
  const filteredModels = filterCapabilities
    ? allModels.filter(model => {
        if (filterCapabilities.vision && !model.capabilities.vision) return false;
        if (filterCapabilities.toolCalling && !model.capabilities.toolCalling) return false;
        if (filterCapabilities.agentic && !model.capabilities.agentic) return false;
        return true;
      })
    : allModels;

  // Further filter by search query
  const searchedModels = searchQuery
    ? filteredModels.filter(model =>
        model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : filteredModels;

  const groupedModels = searchedModels.reduce((acc, model) => {
    (acc[model.provider] = acc[model.provider] || []).push(model);
    return acc;
  }, {} as Record<string, ModelDescriptor[]>);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleModelSelect = (modelId: string, isPro?: boolean) => {
    if (isPro && !isPremium) {
      alert("This is a premium model. Please upgrade to use it.");
      return;
    }
    onModelChange(modelId);
    setIsOpen(false);
    setSearchQuery("");
  };

  const selectedModelInfo = allModels.find((m) => m.id === selectedModel) ||
    allModels.find((m) => m.isDefault) ||
    allModels[0];

  const getCapabilityBadges = (capabilities: ModelCapabilities) => {
    const badges = [];
    
    if (capabilities.vision) {
      badges.push(
        <span key="vision" className="inline-flex items-center gap-1 text-xs text-sky-600">
          <Eye className="h-3 w-3" />
          <span>Vision</span>
        </span>
      );
    }
    
    if (capabilities.toolCalling) {
      badges.push(
        <span key="tool" className="inline-flex items-center gap-1 text-xs text-green-600">
          <Wrench className="h-3 w-3" />
          <span>Tools</span>
        </span>
      );
    }
    
    if (capabilities.agentic) {
      badges.push(
        <span key="agent" className="inline-flex items-center gap-1 text-xs text-purple-600">
          <Sparkles className="h-3 w-3" />
          <span>Agentic</span>
        </span>
      );
    }
    
    return badges;
  };

  return (
    <div className="relative inline-block">
      <style>{`
        .model-scroll::-webkit-scrollbar {
          height: 8px;
          width: 8px;
        }
        .model-scroll::-webkit-scrollbar-thumb {
          background: rgba(100,100,100,0.35);
          border-radius: 999px;
        }
        .model-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .model-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(100,100,100,0.35) transparent;
        }
      `}</style>

      <button
        ref={buttonRef}
        onClick={() => setIsOpen((s) => !s)}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate max-w-[14rem]">{selectedModelInfo?.name}</span>
        <div className="flex items-center gap-1">
          {selectedModelInfo && getCapabilityBadges(selectedModelInfo.capabilities)}
        </div>
        <ChevronUp
          className="h-4 w-4 text-muted-foreground transition-transform duration-200"
          style={{ transform: isOpen ? "rotate(0deg)" : "rotate(180deg)" }}
        />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className="absolute bottom-full mb-2 w-96 origin-bottom-right rounded-xl border bg-background shadow-xl z-50"
          style={{ right: 0 }}
        >
          {/* Search Input */}
          <div className="p-3 border-b">
            <input
              type="text"
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
          </div>

          {/* Capability Filters (Optional) */}
          <div className="px-3 py-2 border-b flex gap-2 text-xs">
            <span className="text-muted-foreground">Filter:</span>
            <button
              onClick={() => setSearchQuery("vision")}
              className="hover:text-primary transition-colors"
            >
              Vision
            </button>
            <button
              onClick={() => setSearchQuery("tool")}
              className="hover:text-primary transition-colors"
            >
              Tools
            </button>
            <button
              onClick={() => setSearchQuery("agent")}
              className="hover:text-primary transition-colors"
            >
              Agentic
            </button>
          </div>

          <div className="p-2 max-h-96 overflow-y-auto model-scroll">
            {Object.entries(groupedModels).length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No models found matching your criteria
              </div>
            ) : (
              Object.entries(groupedModels).map(([provider, models]) => {
                const shouldScroll = models.length > 4;
                const listStyle: React.CSSProperties | undefined = shouldScroll
                  ? { maxHeight: "10rem" }
                  : undefined;

                return (
                  <div key={provider} className="mt-3 first:mt-0">
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                      {provider} ({models.length})
                    </div>
                    <div
                      className={cn(
                        "mt-1 space-y-1 model-scroll pr-2",
                        shouldScroll ? "overflow-y-auto" : ""
                      )}
                      role="listbox"
                      aria-label={`${provider} models`}
                      style={listStyle}
                    >
                      {models.map((model) => {
                        const isPro = Boolean(model.isPro);
                        const notAllowed = isPro && !isPremium;
                        
                        return (
                          <button
                            key={model.id}
                            onClick={() => handleModelSelect(model.id, model.isPro)}
                            aria-disabled={notAllowed}
                            className={cn(
                              "w-full text-left rounded-md p-2 text-sm transition-colors",
                              notAllowed ? "opacity-50" : "hover:bg-accent",
                              selectedModel === model.id ? "bg-accent" : ""
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{model.name}</span>
                                  {model.isPro && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                                      <Crown className="h-3 w-3" />
                                      <span>Pro</span>
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1 flex items-center gap-2">
                                  {getCapabilityBadges(model.capabilities)}
                                  {model.capabilities.contextWindow && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {Math.floor(model.capabilities.contextWindow / 1000)}K ctx
                                    </span>
                                  )}
                                </div>
                                {model.description && (
                                  <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                                    {model.description}
                                  </div>
                                )}
                              </div>
                              {selectedModel === model.id && (
                                <Check className="h-4 w-4 ml-2 flex-shrink-0" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
