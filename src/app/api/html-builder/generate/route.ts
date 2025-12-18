
import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are an Elite Senior Frontend Architect and UI/UX Designer. Your mission is to generate a production-grade, single-file HTML application that looks and feels like a premium "shadcn/ui" or "Vercel" style web app.

### CRITICAL: VISUAL STYLE & AESTHETICS
*   **Design System:** Use a sophisticated, modern design language. Think: ample whitespace, subtle borders, glassmorphism (backdrop-filter), and refined typography.
*   **Color Palette:** Use HSL variables for ALL colors.
    *   \`--background\`: 0 0% 100% (Light) / 240 10% 3.9% (Dark)
    *   \`--foreground\`: 240 10% 3.9% (Light) / 0 0% 98% (Dark)
    *   \`--primary\`: 240 5.9% 10% (Light) / 0 0% 98% (Dark)
    *   \`--primary-foreground\`: 0 0% 98% (Light) / 240 5.9% 10% (Dark)
    *   \`--radius\`: 0.5rem
*   **Typography:** Use 'Inter' or 'Plus Jakarta Sans' from Google Fonts. Headings should be tight (track-tight) and bold.
*   **Components:** Buttons should have subtle hover states, scale effects, and proper padding. Cards should have delicate borders (\`1px solid e4e4e7\`) and soft shadows (\`0 1px 3px 0 rgb(0 0 0 / 0.1)\`).

### STRICT OUTPUT RULES
1.  **Single File:** Return ONE \`index.html\` file containing ALL HTML, CSS, and JS.
2.  **No Markdown:** API output must be raw text. DO NOT wrap in \`\`\`html.
3.  **No External CSS/JS Files:** Embed everything in \`<style>\` and \`<script>\`.
4.  **Images:** Use \`https://images.unsplash.com/photo-...\` with specific, high-quality keywords.

### FUNCTIONAL REQUIREMENTS
*   **Interactive:** The app MUST be "alive". Buttons must click, forms must validate, interactions must show feedback (toasts, loading states).
*   **Responsive:** Mobile-first, flexbox/grid layouts.
*   **Dark Mode:** Implement a class-based dark mode toggler if appropriate for the app type.

Generate the "Wow" factor. The user should be impressed by the design quality immediately.`;

// Copying model lists to ensure consistent routing without importing from Inngest files (avoid module resolution issues)
const NVIDIA_MODELS = [
    "qwen/qwen3-coder-480b-a35b-instruct",
    "deepseek-ai/deepseek-v3.1-terminus",
    "moonshotai/kimi-k2-instruct-0905",
    "openai/gpt-oss-120b",
    "meta/llama-3.2-11b-vision-instruct",
    "meta/llama-4-maverick-17b-128e-instruct",
    "meta/codellama-70b",
    "nvidia/llama-3.1-nemotron-nano-4b-v1.1",
    "meta/llama-3.3-70b-instruct",
    "mistralai/mistral-nemotron",
    "mistralai/mistral-small-3.2-24b-instruct",
    "mistralai/codestral-22b-instruct-v01",
    "deepseek-ai/deepseek-r1-0528",
    "deepseek-ai/deepseek-r1-distill-llama-8b",
    "qwen/qwen3-235b-a22b",
    "qwen/qwen2.5-coder-32b-instruct",
    "moonshotai/kimi-k2-instruct",
    "ibm/granite-34b-code-instruct",
    "google/codegemma-1.1-7b-1",
    "google/gemma-3-1b-it",
    "nvidia/llama-3.1-nemotron-ultra-253b-v1",
    "nvidia/llama-3.1-nemotron-70b-instruct",
    "mistralai/mistral-large-3-675b-instruct-2512",
    "mistralai/ministral-14b-instruct-2512",
    "nvidia/nemotron-nano-12b-v2-vl",
    "mistralai/mistral-medium-3-instruct",
    "nvidia/llama-3.3-nemotron-super-49b-v1.5",
] as const;

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { prompt, image, model } = body;

        console.log(`[HTML Builder] Request received for model: ${model}`);

        if (!prompt && !image) {
            return NextResponse.json({ error: "Prompt or image required" }, { status: 400 });
        }

        let apiUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
        let apiKey = process.env.NVIDIA_API_KEY;

        // Routing Logic
        if (model.startsWith("google/") || model.startsWith("gemini-")) {
            // Check for Gemini/Google specific env if needed, or route to A4F if they provide it.
            // Based on functions.ts, Google models use gemini client. 
            // Here we are doing a fetch to an OpenAI-compatible endpoint.
            // If Gemini doesn't support OpenAI compat directly, we might need A4F or skip.
            // Fallback to A4F for now if possible, or error if no key.
            if (process.env.GEMINI_API_KEY) {
                // OpenAI compat for Gemini: https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
                apiUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
                apiKey = process.env.GEMINI_API_KEY;
            }
        }
        else if (model.startsWith("provider-") || model.startsWith("gpt-") || model.includes("gpt-4")) {
            const base = process.env.OPENAI_A4F_BASE_URL || "https://api.a4f.co/v1";
            apiUrl = base.endsWith("/") ? `${base}chat/completions` : `${base}/chat/completions`;
            apiKey = process.env.OPENAI_A4F_API_KEY;
            console.log("[HTML Builder] Routing to A4F/OpenAI provider");
        }
        else if (NVIDIA_MODELS.some(m => model === m) || model.startsWith("nvidia/") || model.startsWith("meta/") || model.startsWith("mistralai/")) {
            apiUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
            apiKey = process.env.NVIDIA_API_KEY;
            console.log("[HTML Builder] Routing to NVIDIA provider");
        }

        if (!apiKey) {
            console.error(`[HTML Builder] Missing API Key for model: ${model}`);
            return NextResponse.json({
                error: `Configuration Error: No API key found for model provider (Model: ${model}). Please check your .env file.`
            }, { status: 500 });
        }

        const headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
        };

        const messages: any[] = [
            { role: "system", content: SYSTEM_PROMPT }
        ];

        const content: any[] = [];
        if (prompt) {
            content.push({ type: "text", text: prompt });
        }
        if (image) {
            // Ensure proper Data URI format if needed or URL
            content.push({ type: "image_url", image_url: { url: image } });
        }

        messages.push({ role: "user", content });

        const payload = {
            model: model,
            messages: messages,
            temperature: 0.2, // Slightly higher for creativity but stable
            max_tokens: 4096,
            stream: false,
        };

        console.log(`[HTML Builder] Sending request to ${apiUrl}`);

        const res = await fetch(apiUrl, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const txt = await res.text();
            console.error(`[HTML Builder] Provider Error (${res.status}): ${txt}`);
            return NextResponse.json({ error: `Provider API Error (${res.status}): ${txt}` }, { status: 500 });
        }

        const data = await res.json();
        const generatedCode = data.choices[0]?.message?.content || "";

        // Cleanup markdown
        const cleanCode = generatedCode.replace(/```html/g, "").replace(/```/g, "").trim();

        console.log("[HTML Builder] Generation successful");
        return NextResponse.json({ code: cleanCode });
    } catch (error: any) {
        console.error("[HTML Builder] Critical Error:", error);
        return NextResponse.json({ error: error.message || "Failed to generate HTML" }, { status: 500 });
    }
}
