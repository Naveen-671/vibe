// import Image from "next/image";
// import { prisma } from "@/lib/db";
import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Client } from "./client";
import { Suspense } from "react";
export default async function Home() {
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(
    trpc.createAI.queryOptions({
      text: "world Prefetch"
    })
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<p>Loading...</p>}>
        <Client />
      </Suspense>
    </HydrationBoundary>
  );
}
// export default async function Home() {
//   const users = await prisma.user.findMany();

//   return (
//     <div>
//       <div>{JSON.stringify(users, null, 2)}</div>
//       <h1 className="text-4xl font-bold">Welcome to Vibe</h1>

//       <p className="text-lg text-center">
//         This is a simple app to demonstrate the use of Prisma with Next.js.
//       </p>
//     </div>
//   );
// }
