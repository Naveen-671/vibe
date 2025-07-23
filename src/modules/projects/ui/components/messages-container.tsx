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
  // const [activeFragmentId, setActiveFragmentId] = useState<string | null>(null);

  const trpc = useTRPC();
  const { data: messages } = useSuspenseQuery(
    trpc.messages.getMany.queryOptions(
      {
        projectId: projectId
      },
      {
        // TODO: Temporary live message update
        refetchInterval: 5000
      }
    )
  );

  // Set the last fragment as active by default when messages load
  // useEffect(() => {
  //   const lastFragment = messages.findLast(
  //     (message) => message.fragment
  //   )?.fragment;
  //   if (lastFragment) {
  //     setActiveFragmentId(lastFragment.id);
  //   }
  // }, [messages]);
// TODO: This is causing problems
  // useEffect(() => {
  //   const lastAssistantMessageWithFragment = messages.findLast(
  //     (message) => message.role === "ASSISTANT" && !!message.fragment
  //   );
  //   // If there's a last assistant message, set its fragment as active
  //   if (lastAssistantMessageWithFragment) {
  //     setActiveFragment(lastAssistantMessageWithFragment.fragment);
  //   }
  // }, [messages, setActiveFragment]);

  // Scroll to the bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const lastMessage = messages[messages.length - 1];
  const isLastMessageUser = lastMessage?.role === "USER";

  // const handleFragmentClick = (fragment: Fragment) => {
  //   setActiveFragmentId(fragment.id);
  // };

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      <ScrollArea className="flex-1 p-4">
        <div className="flex flex-col gap-y-2">
          {messages.map((message) => (
            <MessageCard
              key={message.id}
              content={message.content}
              role={message.role}
              fragment={message.fragment}
              createdAt={message.createdAt}
              onFragmentClick={() => setActiveFragment(message.fragment)}
              type={message.type}
              isActiveFragment={activeFragment?.id === message.fragment?.id}
            />
          ))}
          {isLastMessageUser && <MessageLoading />}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      <div className="relative p-3 pt-1">
        <div className="absolute -top-6 left-0 right-0 h-6 bg-gradient-to-b from-transparent to-background pointer-events-none" />
        <MessageForm projectId={projectId} />
      </div>
    </div>
  );
};

// import { useSuspenseQuery } from "@tanstack/react-query";
// import { useTRPC } from "@/trpc/client";
// import { MessageCard } from "./message-card";
// import { MessageForm } from "./message-form";
// import { useRef, useEffect } from "react";
// interface Props {
//   projectId: string;
// }

// export const MessagesContainer = ({ projectId }: Props) => {
//   const bottomRef = useRef<HTMLDivElement>(null);
//   const trpc = useTRPC();

//   const { data: messages } = useSuspenseQuery(
//     trpc.messages.getMany.queryOptions({
//       projectId: projectId
//     })
//   );

//   useEffect(() => {
//     const lastAssistantMessage = messages.findLast(
//       (message) => message.role === "ASSISTANT"
//     );

//     if (lastAssistantMessage) {
//       // TODO: set Active Fragment
//     }
//   }, [messages]);

//   useEffect(() => {
//     bottomRef.current?.scrollIntoView();
//   }, [messages.length]);

//   return (
//     <div className="flex flex-col flex-1 min-h-0">
//       <div className="flex-1 min-h-0 overflow-y-auto">
//         <div className="pt-2 pr-1">
//           {messages.map((message) => (
//             <MessageCard
//               key={message.id}
//               content={message.content}
//               role={message.role}
//               fragment={message.fragment}
//               createdAt={message.createdAt}
//               onFragmentClick={() => {}}
//               type={message.type}
//               isActiveFragment={false}
//             />
//           ))}
//           <div ref={bottomRef} />
//         </div>
//       </div>
//       <div className="relative p-3 pt-1">
//         <div className="absolute -top-6 left-0 right-0 h-6 bg-gradient-to-b from-transparent to-background pointer-events-none" />
//         <MessageForm projectId={projectId} />
//       </div>
//     </div>
//   );
// };

// src/modules/projects/ui/components/messages-container.tsx

// "use client";

// import { useTRPC } from "@/trpc/client";
// import { useSuspenseQuery } from "@tanstack/react-query";
// import { MessageCard } from "./message-card";
// import { MessageForm } from "./message-form";
// import { ScrollArea } from "@/components/ui/scroll-area";
// import { useState } from "react";
// import type { Fragment } from "@/generated/prisma";

// interface Props {
//   projectId: string;
// }

// export const MessagesContainer = ({ projectId }: Props) => {
//   // 1. This state will track which code fragment is currently selected.
//   const [activeFragmentId, setActiveFragmentId] = useState<string | null>(null);

//   const trpc = useTRPC();
//   const { data: messages } = useSuspenseQuery(
//     trpc.messages.getMany.queryOptions({
//       projectId
//     })
//   );

//   console.log("DATA RECEIVED IN MESSAGES CONTAINER:", messages);

//   // 2. This function will be passed down to handle clicks.
//   const handleFragmentClick = (fragment: Fragment) => {
//     setActiveFragmentId(fragment.id);
//     // You can add more logic here later, e.g., to show the code in the preview panel.
//     console.log("Active Fragment ID:", fragment.id);
//   };

//   return (
//     <div className="flex flex-col h-full">
//       <ScrollArea className="flex-1 p-4">
//         <div className="flex flex-col gap-y-2">
//           {messages.map((message) => (
//             <MessageCard
//               key={message.id}
//               // Pass all the data from the message object
//               content={message.content}
//               role={message.role}
//               type={message.type}
//               createdAt={message.createdAt}
//               fragment={message.fragment}
//               // 3. Pass the required state and handler props down
//               onFragmentClick={handleFragmentClick}
//               isActiveFragment={message.fragment?.id === activeFragmentId}
//             />
//           ))}
//         </div>
//       </ScrollArea>
//       <div className="p-4">
//         <MessageForm projectId={projectId} />
//       </div>
//     </div>
//   );
// };
