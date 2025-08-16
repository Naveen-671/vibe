import React, { useState, useRef, useEffect } from "react";
import { Check, ChevronUp, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

// A single, comprehensive list of all models, including NVIDIA's and Hugging Face's.
export const allModels = [
  // NVIDIA Models
  {
    id: "nvidia/llama-3.3-nemotron-super-49b-v1.5",
    name: "Nemotron-Super 49B",
    provider: "NVIDIA",
 
  },
  // Hugging Face Models
  {
    id: "CohereForAI/c4ai-command-r-plus",
    name: "Command R+ (HF)",
    provider: "Hugging Face",
    isPro: true

  },
  // OpenAI Models
  {
    id: "gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    provider: "OpenAI",
    
  },
  // Samurai Models
  {
    id: "free-rotation/hf/CohereLabs/c4ai-command-r-v01:cohere",
    name: "CohereLabs/c4ai-command-r-v01",
    provider: "Samurai"
  },
    {
    id: "provider-3/gpt-4o-mini",
    name: "gpt-4o-mini",
    provider: "A4F"
  },
    {
    id: "provider-6/gpt-4o",
    name: "gpt-4o",
    provider: "A4F"
  },
    {
    id: "provider-6/gpt-4.1-mini",
    name: "gpt-4.1-mini",
    provider: "A4F"
  },
    {
    id: "provider-3/deepseek-v3",
    name: "deepseek-v3",
    provider: "A4F"
  },
      {
    id: "provider-6/llama-4-scout",
    name: "llama-4-scout",
    provider: "A4F"
  },
  {
    id: "provider-2/gpt-5-nano",
    name: "gpt-5-nano",
    provider: "A4F",
    isDefault: true
  },
  // Openrouter Models (Existing examples)
  {
    id: "provider-6/llama-4-maverick",
    name: "llama-4-maverick",
    provider: "A4F"
  },
  {
    id: "provider-6/qwen3-coder-480b-a35b",
    name: "qwen3-coder",
    provider: "A4F"
  },
    {
    id: "provider-6/qwen-3-235b-a22b-2507",
    name: "qwen-3-235b",
    provider: "A4F"
  },
      {
    id: "provider-6/kimi-k2-instruct",
    name: "kimi-k2-instruct",
    provider: "A4F"
  },
  {
    id: "provider-6/gemini-2.5-flash-thinking",
    name: "gemini-2.5-flash-thinking",
    provider: "A4F"
  },
  // Hugging Face Models (continued)
  {
    id: "openai/gpt-oss-120b",
    name: "GPT-OSS 120B",
    provider: "NVIDIA",

  },
];

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  isPremium?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onModelChange,
  isPremium = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const groupedModels = allModels.reduce((acc, model) => {
    (acc[model.provider] = acc[model.provider] || []).push(model);
    return acc;
  }, {} as Record<string, typeof allModels>);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleModelSelect = (modelId: string, isPro: boolean) => {
    if (isPro && !isPremium) {
      alert("This is a premium model. Please upgrade to use it.");
      return;
    }
    onModelChange(modelId);
    setIsOpen(false);
  };

  const selectedModelInfo =
    allModels.find((m) => m.id === selectedModel) ||
    allModels.find((m) => m.isDefault);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <span>{selectedModelInfo?.name}</span>
        <ChevronUp
          className="h-4 w-4 text-muted-foreground transition-transform duration-200"
          style={{ transform: isOpen ? "rotate(0deg)" : "rotate(180deg)" }}
        />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className="absolute bottom-full mb-2 w-72 origin-bottom-left rounded-xl border bg-background shadow-xl z-50"
        >
          <div className="p-2">
            {Object.entries(groupedModels).map(([provider, models]) => (
              <div key={provider} className="mt-2 first:mt-0">
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                  {provider}
                </div>
                <div className="mt-1 space-y-1">
                  {models.map((model) => (
                    <button
                      key={model.id}
                      onClick={() =>
                        handleModelSelect(model.id, model.isPro || false)
                      }
                      disabled={model.isPro && !isPremium}
                      className={cn(
                        "w-full flex items-center justify-between text-left rounded-md p-2 text-sm text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed",
                        selectedModel === model.id && "bg-accent"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{model.name}</span>
                        {model.isPro && (
                          <Crown className="h-4 w-4 text-amber-500" />
                        )}
                      </div>
                      {selectedModel === model.id && (
                        <Check className="h-4 w-4" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};