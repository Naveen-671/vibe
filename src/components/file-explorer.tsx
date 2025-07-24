// import { CopyCheckIcon, CopyIcon } from "lucide-react";
// import { useState, useMemo, useCallback, Fragment } from "react";

// import { Hint } from "@/components/ui/hint";
// import { Button } from "./ui/button";
// import { CodeView } from "./code-view";
// import {
//   ResizableHandle,
//   ResizablePanel,
//   ResizablePanelGroup
// } from "@/components/ui/resizable";
// import {
//   Breadcrumb,
//   BreadcrumbItem,
//   BreadcrumbList,
//   BreadcrumbPage,
//   BreadcrumbSeparator,
//   BreadcrumbEllipsis
// } from "@/components/ui/breadcrumb";
// import { convertFilesToTreeItems } from "@/lib/utils";
// import { TreeView } from "./tree-view";

// type FileCollection = { [path: string]: string };

// function getLanguageFromExtension(filename: string): string {
//   const extension = filename.split(".").pop()?.toLowerCase();
//   return extension || "text";
// }

// interface FileBreadcrumbProps {
//   filePath: string;
// }

// const FileBreadcrumb = ({ filePath }: FileBreadcrumbProps) => {
//   const pathSegments = filePath.split("/");
//   const maxSegments = 4;

//   const renderBreadcrumbItems = () => {
//     if (pathSegments.length <= maxSegments) {
//       // show all segments if 4 or less
//       return pathSegments.map((segment, index) => {
//         const isLast = index === pathSegments.length - 1;

//         return (
//           <Fragment key={index}>
//             <BreadcrumbItem>
//               {isLast ? (
//                 <BreadcrumbPage className="font-medium">
//                   {segment}
//                 </BreadcrumbPage>
//               ) : (
//                 <span className="text-muted-foreground">{segment}</span>
//               )}
//             </BreadcrumbItem>
//             {!isLast && <BreadcrumbSeparator />}
//           </Fragment>
//         );
//       });
//     } else {
//       const firstSegment = pathSegments[0];
//       const lastSegment = pathSegments[pathSegments.length - 1];

//       return (
//         <>
//           <BreadcrumbItem>
//             <span className="text-muted-foreground">{firstSegment}</span>
//             <BreadcrumbSeparator />
//             <BreadcrumbItem>
//               <BreadcrumbEllipsis />
//             </BreadcrumbItem>
//             <BreadcrumbSeparator />
//             <BreadcrumbItem>
//               <BreadcrumbPage className="font-medium">
//                 {lastSegment}
//               </BreadcrumbPage>
//             </BreadcrumbItem>
//           </BreadcrumbItem>
//         </>
//       );
//     }
//   };

//   return (
//     <Breadcrumb>
//       <BreadcrumbList>{renderBreadcrumbItems()}</BreadcrumbList>
//     </Breadcrumb>
//   );
// };

// interface FileExplorerProps {
//   files: FileCollection;
// }

// export const FileExplorer = ({ files }: FileExplorerProps) => {
//   const [copied, setCopied] = useState(false);
//   const [selectedFile, setSelectedFile] = useState<string | null>(() => {
//     const fileKeys = Object.keys(files);
//     return fileKeys.length > 0 ? fileKeys[0] : null;
//   });

//   const treeData = useMemo(() => {
//     return convertFilesToTreeItems(files);
//   }, [files]);

//   const handleFileSelect = useCallback(
//     (filePath: string) => {
//       if (files[filePath]) {
//         setSelectedFile(filePath);
//       }
//     },
//     [files]
//   );

//   const handleCopy = useCallback(() => {
//     if (selectedFile) {
//       navigator.clipboard.writeText(files[selectedFile]);
//       setCopied(true);
//       setTimeout(() => {
//         setCopied(false);
//       }, 2000);
//     }
//   }, [selectedFile, files]);

//   return (
//     <ResizablePanelGroup direction="horizontal">
//       <ResizablePanel defaultSize={30} minSize={30} className="bg-sidebar">
//         <TreeView
//           data={treeData}
//           value={selectedFile}
//           onSelect={handleFileSelect}
//         />
//       </ResizablePanel>
//       <ResizableHandle className="hover:bg-primary transition-colors" />
//       <ResizablePanel defaultSize={70} minSize={50}>
//         {selectedFile && files[selectedFile] ? (
//           <div className="h-full w-full flex flex-col">
//             <div className="border-b bg-sidebar px-4 py-2 flex justify-between items-center gap-x-2">
//               <FileBreadcrumb filePath={selectedFile} />

//               <Hint text="Copy to clipboard" side="bottom">
//                 <Button
//                   variant="outline"
//                   size="icon"
//                   className="ml-auto"
//                   onClick={handleCopy}
//                   disabled={copied}
//                 >
//                   {copied ? <CopyCheckIcon /> : <CopyIcon />}
//                 </Button>
//               </Hint>
//             </div>
//             <div className="flex-1 overflow-auto">
//               <CodeView
//                 code={files[selectedFile]}
//                 lang={getLanguageFromExtension(selectedFile)}
//               />
//             </div>
//           </div>
//         ) : (
//           <div className="flex h-full items-center justify-center text-muted-foreground">
//             Select a file to view it&apos;s content
//           </div>
//         )}
//       </ResizablePanel>
//     </ResizablePanelGroup>
//   );
// };

// "use client";

// import { CopyCheckIcon, CopyIcon } from "lucide-react";
// import { useState, useMemo, useCallback, Fragment } from "react";
// import { Hint } from "@/components/ui/hint";
// import { Button } from "@/components/ui/button";
// import { CodeView } from "./code-view";
// import {
//   ResizableHandle,
//   ResizablePanel,
//   ResizablePanelGroup
// } from "@/components/ui/resizable";
// import {
//   Breadcrumb,
//   BreadcrumbItem,
//   BreadcrumbList,
//   BreadcrumbPage,
//   BreadcrumbSeparator,
//   BreadcrumbEllipsis
// } from "@/components/ui/breadcrumb";
// import { convertFilesToTreeItems } from "@/lib/utils";
// import { TreeView } from "./tree-view";
// import { ScrollArea } from "@/components/ui/scroll-area";

// type FileCollection = { [path: string]: string };

// function getLanguageFromExtension(filename: string): string {
//   const extension = filename.split(".").pop()?.toLowerCase();
//   return extension || "text";
// }

// interface FileBreadcrumbProps {
//   filePath: string;
// }

// const FileBreadcrumb = ({ filePath }: FileBreadcrumbProps) => {
//   const pathSegments = filePath.split("/");
//   const maxSegments = 4;

//   const renderBreadcrumbItems = () => {
//     if (pathSegments.length <= maxSegments) {
//       return pathSegments.map((segment, index) => {
//         const isLast = index === pathSegments.length - 1;
//         return (
//           <Fragment key={index}>
//             <BreadcrumbItem>
//               {isLast ? (
//                 <BreadcrumbPage className="font-medium">
//                   {segment}
//                 </BreadcrumbPage>
//               ) : (
//                 <span className="text-muted-foreground">{segment}</span>
//               )}
//             </BreadcrumbItem>
//             {!isLast && <BreadcrumbSeparator />}
//           </Fragment>
//         );
//       });
//     } else {
//       const firstSegment = pathSegments[0];
//       const lastSegment = pathSegments[pathSegments.length - 1];
//       return (
//         <>
//           <BreadcrumbItem>
//             <span className="text-muted-foreground">{firstSegment}</span>
//           </BreadcrumbItem>
//           <BreadcrumbSeparator />
//           <BreadcrumbItem>
//             <BreadcrumbEllipsis />
//           </BreadcrumbItem>
//           <BreadcrumbSeparator />
//           <BreadcrumbItem>
//             <BreadcrumbPage className="font-medium">
//               {lastSegment}
//             </BreadcrumbPage>
//           </BreadcrumbItem>
//         </>
//       );
//     }
//   };

//   return (
//     <Breadcrumb>
//       <BreadcrumbList>{renderBreadcrumbItems()}</BreadcrumbList>
//     </Breadcrumb>
//   );
// };

// interface FileExplorerProps {
//   files: FileCollection;
// }

// export const FileExplorer = ({ files }: FileExplorerProps) => {
//   const [copied, setCopied] = useState(false);
//   const [selectedFile, setSelectedFile] = useState<string | null>(() => {
//     const fileKeys = Object.keys(files);
//     return fileKeys.length > 0 ? fileKeys[0] : null;
//   });

//   const treeData = useMemo(() => {
//     return convertFilesToTreeItems(files);
//   }, [files]);

//   const handleFileSelect = useCallback(
//     (filePath: string) => {
//       if (files[filePath]) {
//         setSelectedFile(filePath);
//       }
//     },
//     [files]
//   );

//   const handleCopy = useCallback(() => {
//     if (selectedFile) {
//       navigator.clipboard.writeText(files[selectedFile]);
//       setCopied(true);
//       setTimeout(() => setCopied(false), 2000);
//     }
//   }, [selectedFile, files]);

//   return (
//     <ResizablePanelGroup direction="horizontal">
//       <ResizablePanel defaultSize={30} minSize={20} className="bg-muted">
//         <ScrollArea className="h-full">
//           <TreeView
//             data={treeData}
//             value={selectedFile}
//             onSelect={handleFileSelect}
//           />
//         </ScrollArea>
//       </ResizablePanel>
//       <ResizableHandle className="hover:bg-primary transition-colors" />
//       <ResizablePanel defaultSize={70} minSize={30}>
//         {selectedFile && files[selectedFile] ? (
//           <div className="h-full w-full flex flex-col min-h-0">
//             <div className="border-b bg-muted px-4 py-2 flex justify-between items-center gap-x-2">
//               <FileBreadcrumb filePath={selectedFile} />
//               <Hint text="Copy to clipboard" side="bottom">
//                 <Button
//                   variant="ghost"
//                   size="icon"
//                   className="ml-auto size-7"
//                   onClick={handleCopy}
//                   disabled={copied}
//                 >
//                   {copied ? (
//                     <CopyCheckIcon className="size-4" />
//                   ) : (
//                     <CopyIcon className="size-4" />
//                   )}
//                 </Button>
//               </Hint>
//             </div>
//             {/* FIX: This makes the code view itself scrollable */}
//             <div className="flex-1 min-h-0">
//               <CodeView
//                 code={files[selectedFile]}
//                 lang={getLanguageFromExtension(selectedFile)}
//               />
//             </div>
//           </div>
//         ) : (
//           <div className="flex h-full items-center justify-center text-muted-foreground">
//             Select a file to view its content
//           </div>
//         )}
//       </ResizablePanel>
//     </ResizablePanelGroup>
//   );
// };

"use client";

import { CopyCheckIcon, CopyIcon } from "lucide-react";
import { useState, useMemo, useCallback, Fragment } from "react";
import { Hint } from "@/components/ui/hint";
import { Button } from "@/components/ui/button";
import { CodeView } from "./code-view";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from "@/components/ui/resizable";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis
} from "@/components/ui/breadcrumb";
import { convertFilesToTreeItems } from "@/lib/utils";
import { TreeView } from "./tree-view";
import { ScrollArea } from "@/components/ui/scroll-area";

type FileCollection = { [path: string]: string };

function getLanguageFromExtension(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase();
  return extension || "text";
}

interface FileBreadcrumbProps {
  filePath: string;
}

const FileBreadcrumb = ({ filePath }: FileBreadcrumbProps) => {
  const pathSegments = filePath.split("/");
  const maxSegments = 4;

  const renderBreadcrumbItems = () => {
    if (pathSegments.length <= maxSegments) {
      return pathSegments.map((segment, index) => {
        const isLast = index === pathSegments.length - 1;
        return (
          <Fragment key={index}>
            <BreadcrumbItem>
              {isLast ? (
                <BreadcrumbPage className="font-medium">
                  {segment}
                </BreadcrumbPage>
              ) : (
                <span className="text-muted-foreground">{segment}</span>
              )}
            </BreadcrumbItem>
            {!isLast && <BreadcrumbSeparator />}
          </Fragment>
        );
      });
    } else {
      const firstSegment = pathSegments[0];
      const lastSegment = pathSegments[pathSegments.length - 1];
      return (
        <>
          <BreadcrumbItem>
            <span className="text-muted-foreground">{firstSegment}</span>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbEllipsis />
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="font-medium">
              {lastSegment}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </>
      );
    }
  };

  return (
    <Breadcrumb>
      <BreadcrumbList>{renderBreadcrumbItems()}</BreadcrumbList>
    </Breadcrumb>
  );
};

interface FileExplorerProps {
  files: FileCollection;
}

export const FileExplorer = ({ files }: FileExplorerProps) => {
  const [copied, setCopied] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(() => {
    const fileKeys = Object.keys(files);
    return fileKeys.length > 0 ? fileKeys[0] : null;
  });

  const treeData = useMemo(() => {
    return convertFilesToTreeItems(files);
  }, [files]);

  const handleFileSelect = useCallback(
    (filePath: string) => {
      if (files[filePath]) {
        setSelectedFile(filePath);
      }
    },
    [files]
  );

  const handleCopy = useCallback(() => {
    if (selectedFile) {
      navigator.clipboard.writeText(files[selectedFile]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [selectedFile, files]);

  return (
    <div className="h-full">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel defaultSize={30} minSize={20} className="bg-muted">
          <ScrollArea className="h-full">
            <TreeView
              data={treeData}
              value={selectedFile}
              onSelect={handleFileSelect}
            />
          </ScrollArea>
        </ResizablePanel>
        <ResizableHandle className="hover:bg-primary transition-colors" />
        <ResizablePanel defaultSize={70} minSize={30}>
          {selectedFile && files[selectedFile] ? (
            <div className="h-full flex flex-col">
              {/* Fixed header */}
              <div className="flex-shrink-0 border-b bg-muted px-4 py-2 flex justify-between items-center gap-x-2">
                <FileBreadcrumb filePath={selectedFile} />
                <Hint text="Copy to clipboard" side="bottom">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto size-7"
                    onClick={handleCopy}
                    disabled={copied}
                  >
                    {copied ? (
                      <CopyCheckIcon className="size-4" />
                    ) : (
                      <CopyIcon className="size-4" />
                    )}
                  </Button>
                </Hint>
              </div>
              {/* Scrollable code view */}
              <div className="flex-1 min-h-0 overflow-hidden">
                <ScrollArea className="h-full w-full">
                  <CodeView
                    code={files[selectedFile]}
                    lang={getLanguageFromExtension(selectedFile)}
                  />
                </ScrollArea>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Select a file to view its content
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};
