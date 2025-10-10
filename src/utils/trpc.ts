// // src/utils/trpc.ts
// import { createTRPCReact } from "@trpc/react-query";
// import { createTRPCClient, httpBatchLink } from "@trpc/client";
// import type { AppRouter } from "@/server/api/root";

// export const trpc = createTRPCReact<AppRouter>();

// // raw client (non-hooks, useful outside React)
// export const rawTrpcClient = createTRPCClient<AppRouter>({
//   links: [
//     httpBatchLink({
//       url: "/api/trpc",
//     }),
//   ],
// });
