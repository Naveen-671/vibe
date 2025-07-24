"use client";

import { useState, Suspense, useEffect } from "react";
import type { Fragment } from "@/generated/prisma";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from "@/components/ui/resizable";
import { MessagesContainer } from "../components/messages-container";
import { ProjectHeader } from "../components/project-header";
import { FragmentWeb } from "../components/fragment-web";
import { FileExplorer } from "@/components/file-explorer";
import { CodeIcon, EyeIcon, CrownIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { UserControl } from "@/components/user-control";

interface Props {
  projectId: string;
}

// Hook to check sandbox status
const useSandboxStatus = () => {
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    // Check if we can reach the sandbox
    const checkSandboxStatus = async () => {
      try {
        const response = await fetch("/api/sandbox/status", {
          method: "HEAD",
          cache: "no-cache"
        });
        setIsActive(response.ok);
      } catch {
        setIsActive(false);
      }
    };

    // Check immediately
    checkSandboxStatus();

    // Check every 30 seconds
    const interval = setInterval(checkSandboxStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  return isActive;
};

export const ProjectView = ({ projectId }: Props) => {
  const [tabState, setTabState] = useState<"preview" | "code">("preview");
  const [activeFragment, setActiveFragment] = useState<Fragment | null>(null);
  const isSandboxActive = useSandboxStatus();

  return (
    <div className="h-screen flex flex-col bg-background">
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Left Panel - Messages */}
        <ResizablePanel
          defaultSize={35}
          minSize={25}
          maxSize={60}
          className="flex flex-col"
        >
          {/* Fixed Project Header */}
          <div className="flex-shrink-0 border-b bg-background z-10">
            <Suspense
              fallback={
                <div className="p-4 h-[57px] flex items-center bg-muted/30">
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 bg-muted-foreground/20 rounded animate-pulse" />
                    <div className="w-24 h-4 bg-muted-foreground/20 rounded animate-pulse" />
                  </div>
                </div>
              }
            >
              <ProjectHeader projectId={projectId} />
            </Suspense>
          </div>

          {/* Messages Container with proper height */}
          <div className="flex-1 min-h-0">
            <Suspense fallback={<div className="p-4">Loading messages...</div>}>
              <MessagesContainer
                activeFragment={activeFragment}
                setActiveFragment={setActiveFragment}
                projectId={projectId}
              />
            </Suspense>
          </div>
        </ResizablePanel>

        <ResizableHandle
          withHandle
          className="w-1 bg-border hover:bg-border/80 transition-colors"
        />

        {/* Right Panel - Preview/Code */}
        <ResizablePanel defaultSize={65} minSize={40} className="flex flex-col">
          {activeFragment ? (
            <Tabs
              className="h-full flex flex-col"
              defaultValue="preview"
              value={tabState}
              onValueChange={(value) =>
                setTabState(value as "preview" | "code")
              }
            >
              {/* Enhanced Tab Header - Fixed at top */}
              <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b bg-background z-10">
                <div className="flex items-center space-x-3">
                  <TabsList className="h-8 p-1 bg-muted/50">
                    <TabsTrigger
                      value="preview"
                      className="h-6 px-2.5 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                    >
                      <EyeIcon className="w-3 h-3 mr-1" />
                      Demo
                    </TabsTrigger>
                    <TabsTrigger
                      value="code"
                      className="h-6 px-2.5 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                    >
                      <CodeIcon className="w-3 h-3 mr-1" />
                      Code
                    </TabsTrigger>
                  </TabsList>

                  {activeFragment.title && (
                    <div className="flex items-center space-x-2">
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSandboxActive
                            ? "bg-green-500 animate-pulse"
                            : "bg-red-500"
                        }`}
                      />
                      <span className="text-sm font-medium text-foreground truncate max-w-[200px]">
                        {activeFragment.title}
                      </span>
                      <Badge
                        variant={isSandboxActive ? "default" : "destructive"}
                        className="text-xs h-5 px-1.5"
                      >
                        {isSandboxActive ? "Live" : "Offline"}
                      </Badge>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    asChild
                    size="sm"
                    variant="tertiary"
                    className="h-7 px-2.5 text-xs"
                  >
                    <Link
                      href="/pricing"
                      className="flex items-center space-x-1"
                    >
                      <CrownIcon className="w-3 h-3" />
                      <span>Upgrade</span>
                    </Link>
                  </Button>
                  <UserControl />
                </div>
              </div>

              {/* Tab Content with proper scrolling */}
              <div className="flex-1 min-h-0">
                <TabsContent
                  value="preview"
                  className="h-full m-0 data-[state=active]:flex data-[state=active]:flex-col"
                >
                  <div className="flex-1 bg-white overflow-hidden">
                    <FragmentWeb data={activeFragment} />
                  </div>
                </TabsContent>

                <TabsContent
                  value="code"
                  className="h-full m-0 data-[state=active]:flex data-[state=active]:flex-col"
                >
                  <div className="flex-1 bg-muted/30 overflow-hidden">
                    <FileExplorer
                      files={activeFragment.files as { [path: string]: string }}
                    />
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          ) : (
            /* Empty State */
            <div className="flex flex-col items-center justify-center h-full bg-muted/20">
              <div className="text-center space-y-4 max-w-md">
                <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center">
                  <SparklesIcon className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">
                    Ready to create something amazing?
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Start a conversation to generate components, pages, or
                    entire applications. Your code will appear here with live
                    preview.
                  </p>
                </div>

                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  <Badge variant="outline" className="text-xs">
                    React Components
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Next.js Pages
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Tailwind CSS
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      isSandboxActive
                        ? "border-green-500 text-green-700"
                        : "border-red-500 text-red-700"
                    }`}
                  >
                    {isSandboxActive ? "Live Preview" : "Preview Offline"}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default ProjectView;
