

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
    id: "provider-5/gpt-4o-mini",
    name: "gpt-4o-mini",
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
    description: "gpt-4o-mini — general-purpose multimodal model available via A4F",
  },
  {
    id: "provider-5/gpt-4.1-nano",
    name: "gpt-4.1-nano",
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
  // {
  //   id: "provider-3/gpt-4o-mini",
  //   name: "gpt-4o-mini",
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
  //   description: "Lightweight gpt-4o family model on A4F",
  // },
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
    id: "provider-1/deepcoder-14b-preview",
    name: "deepcoder-14b-preview",
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
    description: "Lightweight deepcoder-14b-preview family model on A4F",
  },
  // {
  //   id: "provider-3/deepseek-v3-0324",
  //   name: "deepseek-v3-0324",
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
  //   description: "DeepSeek v3 (A4F-hosted) — high-end reasoning model",
  // },
  //   {
  //   id: "provider-6/glm-4.5-air",
  //   name: "glm-4.5-air",
  //   provider: "A4F",
  //   providerId: "a4f",
  //   clientEnv: { apiKeyEnv: "OPENAI_A4F_API_KEY", baseUrlEnv: "OPENAI_A4F_BASE_URL" },
  //   capabilities: {
  //     vision: false,
  //     toolCalling: true,
  //     agentic: false,
  //     contextWindow: 128000,
  //     reasoning: "expert",
  //   },
  //   description: "glm-4.5-air (A4F-hosted) — high-end reasoning model",
  // },
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
  //   {
  //   id: "provider-2/qwen3-coder",
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
  // {
  //   id: "provider-6/qwen-3-235b-a22b-2507",
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
    id: "provider-5/gpt-4.1-mini",
    name: "gpt-4.1-mini",
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
    description: "gpt-4.1-mini edition available through A4F",
  },

  // existing entries (kept for backward compatibility)
  {
    id: "provider-5/gpt-5-nano",
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
    id: "nvidia/nemotron-nano-12b-v2-vl",
    name: "Nemotron Nano 12B v2 VL",
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
    description: "Compact vision-language model optimized for speed"
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
    id: "mistralai/ministral-14b-instruct-2512",
    name: "ministral-14b-instruct-2512",
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
    id: "mistralai/mistral-large-3-675b-instruct-2512",
    name: "mistral-large-3-675b-instruct-2512",
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
    id: "mistralai/mistral-medium-3-instruct",
    name: "mistral-medium-3-instruct",
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
    id: "mistralai/devstral-2-123b-instruct-2512",
    name: "devstral-2-123b-instruct-2512",
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
    id: "moonshotai/kimi-k2-thinking",
    name: "kimi-k2-thinking",
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
    id: "mistralai/mistral-large-3-675b-instruct-2512",
    name: "mistral-large-3-675b-instruct-2512",
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
    id: "mistralai/mistral-medium-3-instruct",
    name: "Mistral Medium 3",
    provider: "Mistral",
    providerId: "nvidia",
    clientEnv: { apiKeyEnv: "NVIDIA_API_KEY", baseUrlEnv: "NVIDIA_BASE_URL" },
    capabilities: {
      vision: false,
      toolCalling: true,
      agentic: true,
      contextWindow: 32000,
      reasoning: "advanced"
    },
    description: "Powerful, multimodal language model for enterprise applications"
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
    id: "deepseek-ai/deepseek-v3.1-terminus",
    name: "deepseek-v3.1-terminus",
    provider: "DeepSeek",
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
    id: "groq/compound",
    name: "compound",
    provider: "Groq",
    providerId: "groq",
    clientEnv: { apiKeyEnv: "GROQ_API_KEY", baseUrlEnv: "GROQ_BASE_URL" },
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
    id: "groq/compound-mini",
    name: "compound-mini",
    provider: "Groq",
    providerId: "groq",
    clientEnv: { apiKeyEnv: "GROQ_API_KEY", baseUrlEnv: "GROQ_BASE_URL" },
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
  // Google Models
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "Google",
    providerId: "google",
    clientEnv: { apiKeyEnv: "GEMINI_API_KEY" },
    capabilities: {
      vision: true,
      toolCalling: true,
      agentic: true,
      contextWindow: 1000000,
      reasoning: "advanced"
    },
    description: "Fast, multimodal model for high-frequency tasks"
  },

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
