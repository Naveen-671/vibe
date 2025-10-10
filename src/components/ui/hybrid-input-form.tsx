// src/components/ui/hybrid-input-form.tsx
"use client";

import React, { useState } from "react";
import { ModelSelector, allModels } from "@/modules/projects/ui/components/model-selector"; // Ensure 'allModels' is exported from model-selector.tsx
import type { CodeAgentRunEventData } from "@/inngest/schema";

interface HybridInputFormProps {
  // Pass the relevant project ID to the form
  projectId: string;
}

export const HybridInputForm: React.FC<HybridInputFormProps> = ({ projectId }) => {
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [model, setModel] = useState(() => allModels.find(m => m.isDefault)?.id || "provider-2/gpt-5-nano");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setImage(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text && !image) {
      alert("Please provide a prompt or an image.");
      return;
    }
    setIsGenerating(true);

    // This payload strictly matches the Zod schema we defined.
    const eventPayload: { name: string; data: CodeAgentRunEventData } = {
      name: "code-agent/run",
      data: {
        projectId,
        model,
        text: text || undefined, // Send undefined if the string is empty
        image: image || undefined, // Send undefined if the image is null
      },
    };

    try {
      // The Inngest client handles sending this event.
      await fetch('/api/inngest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventPayload),
      });
      // TODO: Add logic to handle the response, e.g., navigating to a results page.
      alert("Generation started! You will be notified upon completion.");

    } catch (error) {
      console.error("Failed to trigger code generation:", error);
      alert("An error occurred while starting the generation. Please check the console.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto space-y-4 p-4 border rounded-lg bg-gray-900 text-white">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Describe the website you want to build, or provide context for your image..."
        className="w-full h-24 p-2 border rounded-md bg-gray-800 border-gray-700 focus:ring-2 focus:ring-blue-500"
        disabled={isGenerating}
      />
      
      <input
        id="image-upload"
        type="file"
        accept="image/png, image/jpeg, image/webp"
        onChange={handleFileChange}
        className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-700 file:text-gray-200 hover:file:bg-gray-600"
        disabled={isGenerating}
      />
      
      {image && <img src={image} alt="Preview" className="max-w-xs rounded-md border border-gray-700" />}

      <div className="flex items-center justify-between pt-2">
        <ModelSelector selectedModel={model} onModelChange={setModel} isPremium={false} />
        <button
          type="submit"
          disabled={isGenerating || (!text && !image)}
          className="px-6 py-2 bg-blue-600 text-white rounded-md font-semibold transition-colors hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
          {isGenerating ? "Generating..." : "Generate"}
        </button>
      </div>
    </form>
  );
};