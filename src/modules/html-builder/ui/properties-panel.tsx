
"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline, Palette, Type, Layout, Box } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";

interface PropertiesPanelProps {
    tagName: string;
    styles: Record<string, string>;
    content: string;
    onStyleChange: (property: string, value: string) => void;
    onContentChange: (content: string) => void;
}

const COMMON_FONTS = [
    "Inter", "Roboto", "Open Sans", "Poppins", "Lato", "Montserrat", "Oswald", "Raleway", "Playfair Display", "Merriweather"
];

export const PropertiesPanel = ({ tagName, styles, content, onStyleChange, onContentChange }: PropertiesPanelProps) => {

    const handleColorChange = (prop: string, e: React.ChangeEvent<HTMLInputElement>) => {
        onStyleChange(prop, e.target.value);
    };

    return (
        <div className="h-full flex flex-col bg-background">
            <div className="p-4 border-b bg-muted/20">
                <h3 className="font-semibold text-sm flex items-center gap-2 uppercase tracking-wide text-muted-foreground">
                    <Box className="w-4 h-4" />
                    {tagName || "Element"} Properties
                </h3>
            </div>

            <div className="flex-1 overflow-y-auto">
                <Tabs defaultValue="style" className="w-full">
                    <TabsList className="w-full grid grid-cols-3 rounded-none bg-muted/10 border-b p-0 h-10">
                        <TabsTrigger value="style" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"><Palette className="w-4 h-4 mr-2" /> Style</TabsTrigger>
                        <TabsTrigger value="type" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"><Type className="w-4 h-4 mr-2" /> Text</TabsTrigger>
                        <TabsTrigger value="layout" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"><Layout className="w-4 h-4 mr-2" /> Layout</TabsTrigger>
                    </TabsList>

                    <TabsContent value="style" className="p-4 space-y-6 m-0">
                        {/* Background */}
                        <div className="space-y-4">
                            <Label className="text-xs uppercase text-muted-foreground font-semibold">Background</Label>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs">Color</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="color"
                                            className="w-8 h-8 p-0 border-none rounded-full overflow-hidden shrink-0 cursor-pointer"
                                            value={styles.backgroundColor || "#ffffff"}
                                            onChange={(e) => handleColorChange("backgroundColor", e)}
                                        />
                                        <Input
                                            value={styles.backgroundColor || ""}
                                            onChange={(e) => onStyleChange("backgroundColor", e.target.value)}
                                            className="h-8 text-xs font-mono"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">Opacity</Label>
                                    <Slider
                                        defaultValue={[100]}
                                        max={100}
                                        step={1}
                                        onValueChange={(v) => onStyleChange("opacity", (v[0] / 100).toString())}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Border */}
                        <div className="space-y-4">
                            <Label className="text-xs uppercase text-muted-foreground font-semibold">Border</Label>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs">Radius</Label>
                                    <div className="flex items-center gap-1">
                                        <Input
                                            placeholder="0px"
                                            className="h-8 text-xs"
                                            value={styles.borderRadius}
                                            onChange={(e) => onStyleChange("borderRadius", e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">Width</Label>
                                    <Input
                                        placeholder="0px"
                                        className="h-8 text-xs"
                                        value={styles.borderWidth}
                                        onChange={(e) => onStyleChange("borderWidth", e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs">Color</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="color"
                                        className="w-full h-8 p-0 border-none"
                                        value={styles.borderColor || "#000000"}
                                        onChange={(e) => handleColorChange("borderColor", e)}
                                    />
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="type" className="p-4 space-y-6 m-0">
                        {/* Content Edit */}
                        <div className="space-y-2">
                            <Label className="text-xs uppercase text-muted-foreground font-semibold">Content</Label>
                            <Input
                                value={content}
                                onChange={(e) => onContentChange(e.target.value)}
                                className="font-mono text-sm"
                            />
                        </div>

                        {/* Typography */}
                        <div className="space-y-4">
                            <Label className="text-xs uppercase text-muted-foreground font-semibold">Typography</Label>

                            <div className="space-y-2">
                                <Label className="text-xs">Font Family</Label>
                                <Select onValueChange={(v) => onStyleChange("fontFamily", v)} value={styles.fontFamily?.replace(/['"]/g, "")}>
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="Select font" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {COMMON_FONTS.map(font => (
                                            <SelectItem key={font} value={font} style={{ fontFamily: font }}>{font}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs">Size</Label>
                                    <Input
                                        value={styles.fontSize}
                                        onChange={(e) => onStyleChange("fontSize", e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">Weight</Label>
                                    <Select onValueChange={(v) => onStyleChange("fontWeight", v)} value={styles.fontWeight}>
                                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Normal" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="300">Light</SelectItem>
                                            <SelectItem value="400">Normal</SelectItem>
                                            <SelectItem value="600">SemiBold</SelectItem>
                                            <SelectItem value="700">Bold</SelectItem>
                                            <SelectItem value="900">Black</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs">Color</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="color"
                                        className="w-8 h-8 p-0 border-none rounded-full overflow-hidden shrink-0 cursor-pointer"
                                        value={styles.color || "#000000"}
                                        onChange={(e) => handleColorChange("color", e)}
                                    />
                                    <Input
                                        value={styles.color || ""}
                                        onChange={(e) => onStyleChange("color", e.target.value)}
                                        className="h-8 text-xs font-mono"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs">Alignment</Label>
                                <ToggleGroup type="single" value={styles.textAlign} onValueChange={(v) => v && onStyleChange("textAlign", v)}>
                                    <ToggleGroupItem value="left" size="sm"><AlignLeft className="w-3 h-3" /></ToggleGroupItem>
                                    <ToggleGroupItem value="center" size="sm"><AlignCenter className="w-3 h-3" /></ToggleGroupItem>
                                    <ToggleGroupItem value="right" size="sm"><AlignRight className="w-3 h-3" /></ToggleGroupItem>
                                </ToggleGroup>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs">Style</Label>
                                <div className="flex gap-2">
                                    <Button
                                        variant={styles.fontWeight === "700" ? "secondary" : "outline"}
                                        size="sm"
                                        className="flex-1"
                                        onClick={() => onStyleChange("fontWeight", styles.fontWeight === "700" ? "400" : "700")}
                                    >
                                        <Bold className="w-3 h-3" />
                                    </Button>
                                    <Button
                                        variant={styles.fontStyle === "italic" ? "secondary" : "outline"}
                                        size="sm"
                                        className="flex-1"
                                        onClick={() => onStyleChange("fontStyle", styles.fontStyle === "italic" ? "normal" : "italic")}
                                    >
                                        <Italic className="w-3 h-3" />
                                    </Button>
                                    <Button
                                        variant={styles.textDecoration === "underline" ? "secondary" : "outline"}
                                        size="sm"
                                        className="flex-1"
                                        onClick={() => onStyleChange("textDecoration", styles.textDecoration === "underline" ? "none" : "underline")}
                                    >
                                        <Underline className="w-3 h-3" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="layout" className="p-4 space-y-6 m-0">
                        <div className="space-y-4">
                            <Label className="text-xs uppercase text-muted-foreground font-semibold">Dimensions</Label>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs">Width</Label>
                                    <Input
                                        value={styles.width}
                                        onChange={(e) => onStyleChange("width", e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">Height</Label>
                                    <Input
                                        value={styles.height}
                                        onChange={(e) => onStyleChange("height", e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Label className="text-xs uppercase text-muted-foreground font-semibold">Spacing</Label>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs">Padding</Label>
                                    <Input
                                        value={styles.padding}
                                        onChange={(e) => onStyleChange("padding", e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">Margin</Label>
                                    <Input
                                        value={styles.margin}
                                        onChange={(e) => onStyleChange("margin", e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Label className="text-xs uppercase text-muted-foreground font-semibold">Display</Label>
                            <Select onValueChange={(v) => onStyleChange("display", v)} value={styles.display}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="block" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="block">Block</SelectItem>
                                    <SelectItem value="flex">Flex</SelectItem>
                                    <SelectItem value="grid">Grid</SelectItem>
                                    <SelectItem value="inline-block">Inline Block</SelectItem>
                                    <SelectItem value="none">None</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
};
