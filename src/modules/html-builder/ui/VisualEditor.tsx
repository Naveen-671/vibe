
"use client";

import { useEffect, useRef, useState } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Copy, Download, Eye, Code as CodeIcon, Monitor, Smartphone, Tablet, MousePointer2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PropertiesPanel } from "@/modules/html-builder/ui/properties-panel";
import { toast } from "sonner";

interface VisualEditorProps {
    initialHtml: string;
    onUpdate: (html: string) => void;
}

export const VisualEditor = ({ initialHtml, onUpdate }: VisualEditorProps) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
    const [selectedStyles, setSelectedStyles] = useState<Record<string, string>>({});
    const [selectedContent, setSelectedContent] = useState("");
    const [selectedTag, setSelectedTag] = useState("");
    const [viewMode, setViewMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
    const [tab, setTab] = useState<"visual" | "code">("visual");
    const [isDesignMode, setIsDesignMode] = useState(false);

    // Inject interaction script
    useEffect(() => {
        if (!iframeRef.current || !initialHtml) return;

        const doc = iframeRef.current.contentDocument;
        if (!doc) return;

        const scriptContent = `
            try {
                // Interaction Script
                console.log("Vibe Editor: Script Injected");
                let hoveredEl = null;

                window.__DESIGN_MODE__ = false;
                
                document.body.addEventListener('mouseover', e => {
                    if (!window.__DESIGN_MODE__) return;
                    e.stopPropagation();
                    if (hoveredEl) hoveredEl.style.outline = '';
                    hoveredEl = e.target;
                    if (e.target !== document.body) {
                        e.target.style.outline = '2px dashed #3b82f6';
                        e.target.style.cursor = 'pointer';
                    }
                });
                
                document.body.addEventListener('mouseout', e => {
                    if (hoveredEl) hoveredEl.style.outline = '';
                });
                
                document.body.addEventListener('click', e => {
                    if (e.target === document.body) return;

                    // CHECK DESIGN MODE
                    if (!window.__DESIGN_MODE__) return;
                    
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Ensure ID
                    if (!el.getAttribute('data-vibe-id')) {
                        el.setAttribute('data-vibe-id', 'vibe-' + Math.random().toString(36).substr(2, 9));
                    }
                    
                    const styles = window.getComputedStyle(el);
                    const styleObj = {
                        color: styles.color,
                        backgroundColor: styles.backgroundColor,
                        fontSize: styles.fontSize,
                        fontWeight: styles.fontWeight,
                        padding: styles.padding,
                        margin: styles.margin,
                        border: styles.border,
                        textAlign: styles.textAlign,
                        fontFamily: styles.fontFamily,
                        width: styles.width,
                        height: styles.height,
                        display: styles.display
                    };

                    window.parent.postMessage({
                        type: 'ELEMENT_SELECTED',
                        id: el.getAttribute('data-vibe-id'),
                        tagName: el.tagName,
                        innerText: el.innerText,
                        styles: styleObj
                    }, '*');
                });

                window.addEventListener('message', e => {
                    if (e.data.type === 'UPDATE_ELEMENT') {
                        const el = document.querySelector('[data-vibe-id="' + e.data.id + '"]');
                        if (el) {
                            if (e.data.styles) {
                                Object.assign(el.style, e.data.styles);
                            }
                            if (e.data.content !== undefined) {
                                el.innerText = e.data.content;
                            }
                        }
                    }
                    }
                });

                window.addEventListener('message', e => {
                    if (e.data.type === 'TOGGLE_DESIGN_MODE') {
                        window.__DESIGN_MODE__ = e.data.enabled;
                        console.log("Vibe Editor: Design Mode", e.data.enabled);
                        
                        // Clear highlighting if disabled
                        if (!e.data.enabled && hoveredEl) {
                           hoveredEl.style.outline = '';
                           hoveredEl = null;
                        }
                    }
                });
            } catch (err) {
                console.error("Vibe Editor: Script Error", err);
            }
        `;

        doc.open();
        // Robust injection: try to put before body end, else append
        let htmlWithScript = initialHtml;
        if (htmlWithScript.includes('</body>')) {
            htmlWithScript = htmlWithScript.replace('</body>', `<script>${scriptContent}</script></body>`);
        } else {
            htmlWithScript += `<script>${scriptContent}</script>`;
        }

        doc.write(htmlWithScript);
        doc.close();

    }, [initialHtml]);

    // Handle messages from iframe
    useEffect(() => {
        const handleMessage = (e: MessageEvent) => {
            if (e.data.type === 'ELEMENT_SELECTED') {
                setSelectedElementId(e.data.id);
                setSelectedTag(e.data.tagName);
                setSelectedContent(e.data.innerText);
                setSelectedStyles(e.data.styles);
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // Toggle Design Mode
    useEffect(() => {
        if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({
                type: 'TOGGLE_DESIGN_MODE',
                enabled: isDesignMode
            }, '*');
        }
    }, [isDesignMode, initialHtml]);

    const handleStyleChange = (property: string, value: string) => {
        if (!selectedElementId || !iframeRef.current) return;

        // Update local state
        setSelectedStyles(prev => ({ ...prev, [property]: value }));

        // Send to iframe
        iframeRef.current.contentWindow?.postMessage({
            type: 'UPDATE_ELEMENT',
            id: selectedElementId,
            styles: { [property]: value }
        }, '*');

        syncCode();
    };

    const handleContentChange = (content: string) => {
        if (!selectedElementId || !iframeRef.current) return;

        setSelectedContent(content);
        iframeRef.current.contentWindow?.postMessage({
            type: 'UPDATE_ELEMENT',
            id: selectedElementId,
            content: content
        }, '*');

        syncCode();
    };

    const syncCode = () => {
        if (iframeRef.current?.contentDocument) {
            let html = iframeRef.current.contentDocument.documentElement.outerHTML;
            html = html.replace(/<script>[\s\S]*?<\/script>/, '');
            html = html.replace(/\s*data-vibe-id="[^"]*"/g, '');
            html = html.replace(/\s*style="outline:[^;]*;"/g, '');
            onUpdate(html);
        }
    };

    const containerWidth = viewMode === "mobile" ? "375px" : viewMode === "tablet" ? "768px" : "100%";

    return (
        <div className="h-full flex flex-col">
            <div className="border-b p-2 flex items-center justify-between bg-muted/20">
                <div className="flex bg-muted rounded p-1">
                    <Button variant={viewMode === "desktop" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("desktop")}><Monitor className="h-4 w-4" /></Button>
                    <Button variant={viewMode === "tablet" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("tablet")}><Tablet className="h-4 w-4" /></Button>
                    <Button variant={viewMode === "mobile" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("mobile")}><Smartphone className="h-4 w-4" /></Button>
                </div>

                {/* Design Mode Toggle */}
                {tab === "visual" && (
                    <div className="flex items-center">
                        <Button
                            size="sm"
                            variant={isDesignMode ? "default" : "outline"}
                            className={isDesignMode ? "bg-blue-600 hover:bg-blue-700 text-white gap-2" : "gap-2 text-muted-foreground"}
                            onClick={() => setIsDesignMode(!isDesignMode)}
                        >
                            <MousePointer2 className="h-3.5 w-3.5" />
                            {isDesignMode ? "Design Mode On" : "Design Mode Off"}
                        </Button>
                    </div>
                )}

                <div className="flex gap-2">
                    <Tabs value={tab} onValueChange={(v: any) => setTab(v)}>
                        <TabsList>
                            <TabsTrigger value="visual"><Eye className="h-4 w-4 mr-2" /> Visual</TabsTrigger>
                            <TabsTrigger value="code"><CodeIcon className="h-4 w-4 mr-2" /> Code</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(initialHtml); toast("Copied!"); }}><Copy className="h-4 w-4 mr-1" /> Copy</Button>
                    <Button size="sm" variant="outline" onClick={() => {
                        const blob = new Blob([initialHtml], { type: 'text/html' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'index.html';
                        a.click();
                        URL.revokeObjectURL(url);
                    }}><Download className="h-4 w-4 mr-1" /> Download</Button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex relative">
                <ResizablePanelGroup direction="horizontal">
                    <ResizablePanel defaultSize={75} className="bg-muted/50 p-4 flex justify-center overflow-auto relative">
                        {/* Visual Tab Content (Always mounted, hidden if not active) */}
                        <div className={tab === "visual" ? "w-full h-full flex justify-center" : "hidden"}>
                            {initialHtml ? (
                                <iframe
                                    ref={iframeRef}
                                    className="bg-white shadow-lg transition-all duration-300 origin-top"
                                    style={{ width: containerWidth, height: "100%", border: "none" }}
                                    title="Preview"
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                    Generated content will appear here
                                </div>
                            )}
                        </div>

                        {/* Code Tab Content */}
                        {tab === "code" && (
                            <div className="absolute inset-0 p-4 bg-muted/90 overflow-auto z-10">
                                <pre className="text-xs font-mono p-4 bg-black text-green-400 rounded-md whitespace-pre-wrap h-full overflow-auto">
                                    {initialHtml}
                                </pre>
                            </div>
                        )}
                    </ResizablePanel>

                    <ResizableHandle />

                    <ResizablePanel defaultSize={25} minSize={20} className="bg-background border-l z-20">
                        {selectedElementId ? (
                            <PropertiesPanel
                                tagName={selectedTag}
                                styles={selectedStyles}
                                content={selectedContent}
                                onStyleChange={handleStyleChange}
                                onContentChange={handleContentChange}
                            />
                        ) : (
                            <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                                <div className="p-3 bg-muted rounded-full">
                                    <Eye className="w-6 h-6 opacity-20" />
                                </div>
                                <p>Select an element on the canvas to edit its properties.</p>
                                <p className="text-xs opacity-50">Click on any text, image, or box.</p>
                            </div>
                        )}
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
        </div>
    );
};
