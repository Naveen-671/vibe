// "use client";

// import { useTRPC } from "@/trpc/client";
// import { useSuspenseQuery } from "@tanstack/react-query";
// import { MessageCard } from "./message-card";
// import { MessageForm } from "./message-form";
// import { ScrollArea } from "@/components/ui/scroll-area";
// import { useEffect, useRef } from "react";
// import type { Fragment } from "@/generated/prisma";
// import { MessageLoading } from "./message-loading";

// interface Props {
//   projectId: string;
//   activeFragment: Fragment | null;
//   setActiveFragment: (fragment: Fragment | null) => void;
// }

// export const MessagesContainer = ({
//   projectId,
//   activeFragment,
//   setActiveFragment
// }: Props) => {
//   const bottomRef = useRef<HTMLDivElement>(null);
//   const lastAssistantMessageIdRef = useRef<string | null>(null);

//   const trpc = useTRPC();
//   const { data: messages } = useSuspenseQuery(
//     trpc.messages.getMany.queryOptions(
//       {
//         projectId: projectId
//       },
//       {
//         refetchInterval: 5000
//       }
//     )
//   );

//   useEffect(() => {
//     const lastAssistantMessage = messages.findLast(
//       (message) => message.role === "ASSISTANT"
//     );

//     if (
//       lastAssistantMessage?.fragment &&
//       lastAssistantMessage.id !== lastAssistantMessageIdRef.current
//     ) {
//       setActiveFragment(lastAssistantMessage.fragment);
//       lastAssistantMessageIdRef.current = lastAssistantMessage.id;
//     }
//   }, [messages, setActiveFragment]);

//   useEffect(() => {
//     bottomRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [messages.length]);

//   const lastMessage = messages[messages.length - 1];
//   const isLastMessageUser = lastMessage?.role === "USER";

//   return (
//     // FIX: This flex structure ensures the ScrollArea has a defined space to occupy
//     <div className="flex flex-col flex-1 min-h-0 h-full">
//       <ScrollArea className="flex-1">
//         <div className="p-4">
//           {messages.map((message) => (
//             <MessageCard
//               key={message.id}
//               content={message.content}
//               role={message.role}
//               fragment={message.fragment}
//               createdAt={message.createdAt}
//               onFragmentClick={() => {
//                 if (message.fragment) {
//                   setActiveFragment(message.fragment);
//                 }
//               }}
//               type={message.type}
//               isActiveFragment={activeFragment?.id === message.fragment?.id}
//             />
//           ))}
//           {isLastMessageUser && <MessageLoading />}
//           <div ref={bottomRef} />
//         </div>
//       </ScrollArea>
//       <div className="relative p-3 pt-1 border-t">
//         <div className="absolute -top-6 left-0 right-0 h-6 bg-gradient-to-b from-transparent to-background pointer-events-none" />
//         <MessageForm projectId={projectId} />
//       </div>
//     </div>
//   );
// };

"use client";

import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { MessageCard } from "./message-card";
import { MessageForm } from "./message-form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useRef } from "react";
import type { Fragment } from "@/generated/prisma";
import { MessageLoading } from "./message-loading";

interface Props {
  projectId: string;
  activeFragment: Fragment | null;
  setActiveFragment: (fragment: Fragment | null) => void;
}

export const MessagesContainer = ({
  projectId,
  activeFragment,
  setActiveFragment
}: Props) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastAssistantMessageIdRef = useRef<string | null>(null);

  const trpc = useTRPC();
  const { data: messages } = useSuspenseQuery(
    trpc.messages.getMany.queryOptions(
      {
        projectId: projectId
      },
      {
        refetchInterval: 5000
      }
    )
  );

  useEffect(() => {
    const lastAssistantMessage = messages.findLast(
      (message) => message.role === "ASSISTANT"
    );

    if (
      lastAssistantMessage?.fragment &&
      lastAssistantMessage.id !== lastAssistantMessageIdRef.current
    ) {
      setActiveFragment(lastAssistantMessage.fragment);
      lastAssistantMessageIdRef.current = lastAssistantMessage.id;
    }
  }, [messages, setActiveFragment]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const lastMessage = messages[messages.length - 1];
  const isLastMessageUser = lastMessage?.role === "USER";

  return (
    <div className="flex flex-col h-full">
      {/* Messages scroll area - Key fix: explicit height */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[300px] text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Start a conversation
                  </p>
                  <p className="text-xs text-muted-foreground max-w-[200px]">
                    Ask me to create components, pages, or entire applications
                  </p>
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <MessageCard
                    key={message.id}
                    content={message.content}
                    role={message.role}
                    fragment={message.fragment}
                    createdAt={message.createdAt}
                    onFragmentClick={() => {
                      if (message.fragment) {
                        setActiveFragment(message.fragment);
                      }
                    }}
                    type={message.type}
                    isActiveFragment={
                      activeFragment?.id === message.fragment?.id
                    }
                  />
                ))}
                {isLastMessageUser && <MessageLoading />}
                <div ref={bottomRef} className="h-1" />
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Message form - Fixed at bottom */}
      <div className="flex-shrink-0 border-t bg-background relative">
        <div className="absolute -top-6 left-0 right-0 h-6 bg-gradient-to-b from-transparent to-background pointer-events-none" />
        <div className="p-3 pt-1">
          <MessageForm projectId={projectId} />
        </div>
      </div>
    </div>
  );
};
