// import { getQueryClient, trpc } from "@/trpc/server";
// import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
// import ProjectView from "../../../modules/projects/ui/views/project-view";
// import { Suspense } from "react";

// interface Props {
//   params: Promise<{
//     projectId: string;
//   }>;
// }

// const Page = async ({ params }: Props) => {
//   const { projectId } = await params;

//   const queryClient = getQueryClient();
//   void queryClient.prefetchQuery(
//     trpc.messages.getMany.queryOptions({
//       projectId
//     })
//   );
//   void queryClient.prefetchQuery(
//     trpc.projects.getOne.queryOptions({
//       id: projectId
//     })
//   );

//   const dehydratedState = dehydrate(queryClient);

//   // ADD THIS LOG:
//   console.log(
//     "DEHYDRATED STATE FROM SERVER:",
//     JSON.stringify(dehydratedState, null, 2)
//   );

//   return (
//     <HydrationBoundary state={dehydrate(queryClient)}>
//       <Suspense fallback={<div>Loading...</div>}>
//         <ProjectView projectId={projectId} />
//       </Suspense>
//     </HydrationBoundary>
//   );
// };

// export default Page;

// import { getQueryClient, trpc } from "@/trpc/server";
// import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
// import { Suspense } from "react";
// // Make sure this import path is correct for your project structure
// import { ProjectView } from "../../../modules/projects/ui/views/project-view";

// interface Props {
//   params: {
//     projectId: string;
//   };
// }

// // The component MUST be async to use await
// const Page = async ({ params }: Props) => {
//   const { projectId } = params;
//   const queryClient = getQueryClient();

//   // FIX: We explicitly wait for both prefetch calls to complete
//   await Promise.all([
//     queryClient.prefetchQuery(
//       trpc.projects.getOne.queryOptions({
//         id: projectId
//       })
//     ),
//     queryClient.prefetchQuery(
//       trpc.messages.getMany.queryOptions({
//         projectId
//       })
//     )
//   ]);

//   return (
//     <HydrationBoundary state={dehydrate(queryClient)}>
//       <Suspense fallback={<div>Loading Project...</div>}>
//         <ProjectView projectId={projectId} />
//       </Suspense>
//     </HydrationBoundary>
//   );
// };

// export default Page;

import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import { ProjectView } from "../../../modules/projects/ui/views/project-view";

interface Props {
  params: {
    projectId: string;
  };
}

// The component MUST be async to use await
const Page = async ({ params }: Props) => {
  const { projectId } = params;
  const queryClient = getQueryClient();

  // We explicitly wait for both prefetch calls to complete
  await Promise.all([
    queryClient.prefetchQuery(
      trpc.projects.getOne.queryOptions({
        id: projectId
      })
    ),
    queryClient.prefetchQuery(
      trpc.messages.getMany.queryOptions({
        projectId
      })
    )
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<div>Loading Project...</div>}>
        <ProjectView projectId={projectId} />
      </Suspense>
    </HydrationBoundary>
  );
};

export default Page;
