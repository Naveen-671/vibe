
"use client";

import { useState, useEffect } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Loader2, Wand2, Image as ImageIcon, Trash2, EyeIcon, CodeIcon, Copy, Download, History, MessageSquare, RefreshCw, Layout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModelSelector, allModels } from "@/modules/projects/ui/components/model-selector";
import { VisualEditor } from "./VisualEditor";
import { toast } from "sonner";
import { ImageUploadButton } from "@/modules/projects/ui/components/image-uploader";
import { cn } from "@/lib/utils";
import TextareaAutoSize from "react-textarea-autosize";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

// Mimic local chat state
interface Message {
    role: "user" | "assistant";
    content: string;
    image?: string;
    isGenerating?: boolean;
    type?: "text" | "artifact";
    code?: string;
}

interface HistoryItem {
    id: string;
    title: string;
    prompt: string;
    code: string;
    createdAt: string;
}

export const HTMLBuilderDashboard = () => {

    // --- Chat / Input State ---
    const [messages, setMessages] = useState<Message[]>([]);
    const [prompt, setPrompt] = useState("");
    const [image, setImage] = useState<string | null>(null);
    const [selectedModel, setSelectedModel] = useState(allModels[0]?.id || "gpt-4o");
    const [isGenerating, setIsGenerating] = useState(false);

    // --- Editor State ---
    const [htmlCode, setHtmlCode] = useState("");

    // --- History State ---
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [leftTab, setLeftTab] = useState<"chat" | "history">("chat");
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    // Fetch History on Mount
    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        setIsLoadingHistory(true);
        try {
            const res = await fetch("/api/html-builder/history");
            if (res.ok) {
                const data = await res.json();
                setHistory(data.history || []);
            }
        } catch (e) {
            console.error("Failed to fetch history", e);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const handleGenerate = async () => {
        if (!prompt.trim() && !image) {
            toast.error("Please provide a prompt or an image.");
            return;
        }

        // Switch to chat tab if not active
        setLeftTab("chat");

        // Add User Message
        const userMsg: Message = { role: "user", content: prompt, image: image || undefined, type: "text" };
        setMessages(prev => [...prev, userMsg]);

        // Add Assistant Placeholder
        setMessages(prev => [...prev, { role: "assistant", content: "", isGenerating: true, type: "text" }]);

        // Keep reference to inputs
        const currentPrompt = prompt;
        const currentImage = image;

        // Reset Input
        setPrompt("");
        setImage(null);
        setIsGenerating(true);

        try {
            // 1. Generate Code
            const res = await fetch("/api/html-builder/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: currentPrompt, image: currentImage, model: selectedModel }),
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            const generatedHtml = data.code;
            setHtmlCode(generatedHtml);

            // Update Chat
            setMessages(prev => {
                const newHistory = [...prev];
                const last = newHistory[newHistory.length - 1];
                if (last.role === "assistant") {
                    last.content = "Project generated successfully.";
                    last.type = "artifact";
                    last.code = generatedHtml;
                    last.isGenerating = false;
                }
                return newHistory;
            });

            // 2. Save to History
            await fetch("/api/html-builder/history", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: generatedHtml, prompt: currentPrompt || "Generated from image" })
            });

            // Refresh history list silently
            fetchHistory();

            toast.success("Generation complete!");
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Generation failed");

            setMessages(prev => {
                const newHistory = [...prev];
                const last = newHistory[newHistory.length - 1];
                if (last.role === "assistant") {
                    last.content = `Error: ${e.message || "Failed to generate"}`;
                    last.isGenerating = false;
                    last.type = "text";
                }
                return newHistory;
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const loadHistoryItem = (item: HistoryItem) => {
        setHtmlCode(item.code);
        setMessages(prev => [
            ...prev,
            { role: "assistant", content: `Loaded version: "${item.title || "Untitled"}"`, type: "text" }
        ]);

        toast("Restored previous version");
    };

    return (
        <div className="h-[calc(100vh-57px)] flex flex-col bg-background">
            <ResizablePanelGroup direction="horizontal" className="flex-1">

                {/* Left Panel: Chat & History */}
                <ResizablePanel defaultSize={35} minSize={25} maxSize={60} className="flex flex-col border-r h-full">

                    {/* Header */}
                    <div className="flex-shrink-0 h-14 border-b bg-background z-10 flex items-center px-4 justify-between">
                        <span className="font-semibold flex items-center gap-2">
                            <Wand2 className="w-4 h-4 text-purple-600" />
                            HTML Builder
                        </span>
                        <Tabs value={leftTab} onValueChange={(v: any) => setLeftTab(v)} className="h-8">
                            <TabsList className="h-8 p-0 bg-muted/50 gap-1">
                                <TabsTrigger value="chat" className="h-7 text-xs px-2"><MessageSquare className="w-3 h-3 mr-1" /> Chat</TabsTrigger>
                                <TabsTrigger value="history" className="h-7 text-xs px-2"><History className="w-3 h-3 mr-1" /> History</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 min-h-0 overflow-hidden relative bg-muted/5">
                        {leftTab === "chat" ? (
                            <ScrollArea className="h-full p-4">
                                <div className="space-y-6 pb-4">
                                    {messages.length === 0 && (
                                        <div className="text-center text-muted-foreground mt-10">
                                            <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                                                <Wand2 className="w-6 h-6 text-purple-600" />
                                            </div>
                                            <h3 className="font-semibold text-foreground">Start Building</h3>
                                            <p className="text-sm">Describe the UI you want to create.</p>
                                        </div>
                                    )}

                                    {messages.map((msg, i) => (
                                        <div key={i} className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
                                            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-purple-600 text-white")}>
                                                {msg.role === "user" ? "U" : <Wand2 className="w-4 h-4" />}
                                            </div>

                                            {msg.type === "artifact" && !msg.isGenerating ? (
                                                <div className="w-full max-w-[85%]">
                                                    <div className="bg-background border rounded-xl overflow-hidden shadow-sm group cursor-pointer hover:border-purple-500/50 transition-colors" onClick={() => {
                                                        if (msg.code) {
                                                            setHtmlCode(msg.code);
                                                            toast("Loaded generated project");
                                                        }
                                                    }}>
                                                        <div className="h-2 bg-gradient-to-r from-purple-500 to-pink-500" />
                                                        <div className="p-4">
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                                                                    <Layout className="w-5 h-5" />
                                                                </div>
                                                                <div>
                                                                    <h4 className="font-semibold text-sm">Generated UI Project</h4>
                                                                    <p className="text-xs text-muted-foreground">Click to view details</p>
                                                                </div>
                                                            </div>
                                                            <Button size="sm" className="w-full h-8 text-xs font-medium" variant="secondary">
                                                                View Preview
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className={cn("rounded-2xl px-4 py-2.5 max-w-[85%] text-sm shadow-sm", msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-background border")}>
                                                    {msg.image && (
                                                        <img src={msg.image} alt="User upload" className="max-h-40 rounded-lg mb-2 border border-white/20" />
                                                    )}
                                                    {msg.isGenerating ? (
                                                        <div className="flex items-center gap-2">
                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                            <span>Generating code...</span>
                                                        </div>
                                                    ) : (
                                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        ) : (
                            <ScrollArea className="h-full">
                                <div className="p-4 space-y-2">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-semibold text-muted-foreground">Recent Builds</h3>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={fetchHistory} disabled={isLoadingHistory}>
                                            <RefreshCw className={cn("w-3 h-3", isLoadingHistory && "animate-spin")} />
                                        </Button>
                                    </div>

                                    {history.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-8">No history yet.</p>
                                    ) : (
                                        history.map(item => (
                                            <button
                                                key={item.id}
                                                onClick={() => loadHistoryItem(item)}
                                                className="w-full text-left p-3 rounded-lg border bg-background hover:bg-accent transition-colors group relative"
                                            >
                                                <div className="font-medium text-sm truncate pr-6">{item.title || "Untitled"}</div>
                                                <div className="text-xs text-muted-foreground mt-1 flex justify-between">
                                                    <span>{format(new Date(item.createdAt), "MMM d, h:mm a")}</span>
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </ScrollArea>
                        )}
                    </div>

                    {/* Input Area (Only visible in Chat tab or always? Let's keep it generally visible but maybe disable in history? No, user might want to generate new from history tab context. Actually, let's keep it visible always for quick access) */}
                    <div className="flex-shrink-0 border-t bg-background p-4 z-10">
                        <div className="flex items-center justify-between mb-3 px-1">
                            <span className="text-xs font-medium text-muted-foreground">AI Model</span>
                            <div className="relative">
                                <ModelSelector selectedModel={selectedModel} onModelChange={setSelectedModel} />
                            </div>
                        </div>

                        <div className="relative border rounded-xl bg-muted/30 focus-within:ring-1 focus-within:ring-primary/20 transition-all overflow-hidden border-input shadow-sm">
                            {image && (
                                <div className="px-3 pt-3 flex">
                                    <div className="relative group">
                                        <img src={image} className="h-14 w-14 object-cover rounded-md border" />
                                        <button onClick={() => setImage(null)} className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            <TextareaAutoSize
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="Describe your website..."
                                className="w-full bg-transparent border-none focus:ring-0 resize-none px-4 py-3 min-h-[50px] max-h-[200px] text-sm"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        handleGenerate();
                                    }
                                }}
                            />

                            <div className="flex items-center justify-between px-3 pb-3 pt-1">
                                <div className="flex items-center gap-2">
                                    <ImageUploadButton onImageReady={setImage} />
                                </div>
                                <Button
                                    disabled={isGenerating || (!prompt && !image)}
                                    onClick={handleGenerate}
                                    size="icon"
                                    className="h-8 w-8 rounded-full"
                                >
                                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                                </Button>
                            </div>
                        </div>
                    </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Right Panel: Preview */}
                <ResizablePanel defaultSize={65} className="flex flex-col bg-muted/10 h-full">
                    {htmlCode ? (
                        <VisualEditor initialHtml={htmlCode} onUpdate={setHtmlCode} />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center bg-muted/5">
                            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                                <EyeIcon className="w-8 h-8 opacity-20" />
                            </div>
                            <h3 className="font-medium mb-1">Preview Area</h3>
                            <p className="text-xs max-w-xs opacity-70">Your generated HTML page will appear here instantly.</p>
                        </div>
                    )}
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
};
