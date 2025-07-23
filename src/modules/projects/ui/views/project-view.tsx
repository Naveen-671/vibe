"use client";

import { useState, Suspense } from "react";
import { Fragment } from "@/generated/prisma";
// import { useTRPC } from "@/trpc/client";
// import { useSuspenseQuery } from "@tanstack/react-query";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from "@/components/ui/resizable";
import { MessagesContainer } from "../components/messages-container";
import { ProjectHeader } from "../components/project-header";
// import { MessagesContainer } from "./components/messages-container";

interface Props {
  projectId: string;
}

export const ProjectView = ({ projectId }: Props) => {
  // const trpc = useTRPC();

  // const { data: project } = useSuspenseQuery(
  //   trpc.projects.getOne.queryOptions({
  //     id: projectId
  //   })
  // );
  const [activeFragment, setActiveFragment] = useState<Fragment | null>(null);

  return (
    <div className="h-screen">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel
          defaultSize={35}
          minSize={20}
          className="flex flex-col min-h-0"
        >
          <Suspense fallback={<p>Loading Project...</p>}>
            <ProjectHeader projectId={projectId} />
          </Suspense>

          <Suspense fallback={<div>Loading Messages...</div>}>
            <MessagesContainer
              activeFragment={activeFragment}
              setActiveFragment={setActiveFragment}
              projectId={projectId}
            />
          </Suspense>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={65} minSize={50}>
          TODO: Preview
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};
export default ProjectView;
