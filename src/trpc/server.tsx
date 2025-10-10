// import "server-only"; // <-- ensure this file cannot be imported from the client
// import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
// import { cache } from "react";
// import { createTRPCContext } from "./init";
// import { makeQueryClient } from "./query-client";
// import { appRouter } from "./routers/_app";
// // IMPORTANT: Create a stable getter for the query client that
// //            will return the same client during the same request.
// export const getQueryClient = cache(makeQueryClient);
// export const trpc = createTRPCOptionsProxy({
//   ctx: createTRPCContext,
//   router: appRouter,
//   queryClient: getQueryClient
// });
// export const caller = appRouter.createCaller(createTRPCContext);


// // src/trpc/server.tsx
// import "server-only";
// import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
// import { cache } from "react";
// import { createTRPCContext } from "./init";
// import { makeQueryClient } from "./query-client";
// import { appRouter } from "./routers/_app";

// // IMPORTANT:
// // - This file is server-only and provides a server-side proxy (not React hooks).
// // - We export it as `serverTrpc` to avoid confusion with the client hook object.
// export const getQueryClient = cache(makeQueryClient);

// // server-side proxy (for use on the server)
// export const serverTrpc = createTRPCOptionsProxy({
//   ctx: createTRPCContext,
//   router: appRouter,
//   queryClient: getQueryClient,
// });

// // an easy-to-use caller for server-only contexts
// export const trpcCaller = appRouter.createCaller(createTRPCContext);

// // src/trpc/server.ts
// import type { QueryClient } from "@tanstack/react-query";
// import { makeQueryClient } from "./query-client";
// import { appRouter } from "./routers/_app";
// import { createTRPCContext } from "./init";

// /**
//  * Return a fresh QueryClient for server-side rendering / dehydration.
//  */
// export function getQueryClient(): QueryClient {
//   return makeQueryClient();
// }

// /**
//  * Type of a server-side caller instance for your AppRouter.
//  */
// export type TRPCCaller = ReturnType<typeof appRouter.createCaller>;

// /**
//  * Server-side TRPC helpers for RSC/SSR.
//  *
//  * - createCaller(): builds a typed caller bound to the server context (auth, etc).
//  * - call(path, input): convenience dynamic caller (path like "messages.getMany").
//  */
// export const trpc = {
//   /**
//    * Create a typed caller for server-side usage.
//    */
//   async createCaller(): Promise<TRPCCaller> {
//     const ctx = await createTRPCContext();
//     return appRouter.createCaller(ctx);
//   },

//   /**
//    * Convenience dynamic-call helper.
//    * `path` is the dotted procedure path, e.g. "messages.getMany".
//    *
//    * Returns the raw result as unknown. Cast to the right type at call-site if needed.
//    */
//   async call(path: string, input?: unknown): Promise<unknown> {
//     const caller = await trpc.createCaller();

//     const parts = path.split(".");
//     if (parts.length === 0) {
//       throw new Error("Invalid path for trpc.call");
//     }

//     // Walk the object to resolve the final procedure function
//     let current: unknown = caller as unknown;
//     for (const p of parts) {
//       if (current && typeof current === "object" && p in (current as Record<string, unknown>)) {
//         current = (current as Record<string, unknown>)[p];
//       } else {
//         throw new Error(`Procedure path "${path}" does not exist on caller.`);
//       }
//     }

//     // Ensure we have a callable value with a concrete signature
//     if (typeof current !== "function") {
//       throw new Error(`Procedure path "${path}" is not callable.`);
//     }

//     // Narrow to a concrete function signature to avoid using the global `Function` type.
//     // The procedure call can be synchronous or async depending on the procedure; normalize by wrapping in Promise.resolve.
//     const fn = current as (...args: unknown[]) => unknown;
//     const result = fn(input);
//     // If the function returned a Promise-like, await it; otherwise wrap in Promise.resolve
//     return Promise.resolve(result as unknown);
//   },
// };

// export default trpc;

// src/trpc/server.ts
import type { QueryClient } from "@tanstack/react-query";
import { makeQueryClient } from "./query-client";
import { appRouter } from "./routers/_app";
import { createTRPCContext } from "./init";

/**
 * Return a fresh QueryClient for server-side rendering / dehydration.
 */
export function getQueryClient(): QueryClient {
  return makeQueryClient();
}

/**
 * A small typed shape returned for each procedure to make it consumable by
 * react-query prefetchQuery / fetchQuery helpers on the server.
 */
type QueryOptionsShape = {
  queryKey: readonly unknown[];
  queryFn: () => Promise<unknown>;
};

/**
 * trpc server helper: provides trpc.<router>.<procedure>.queryOptions(input)
 * which returns an object acceptable to QueryClient.prefetchQuery().
 *
 * This is implemented using a proxy so you don't need to list all router/procedure
 * names here — it will attempt to call the procedure on the server-side caller
 * created with createTRPCContext().
 */
export const trpc: Record<string, Record<string, { queryOptions: (input?: unknown) => QueryOptionsShape }>> =
  new Proxy(
    {},
    {
      get(_, routerName): Record<string, { queryOptions: (input?: unknown) => QueryOptionsShape }> {
        const routerStr = String(routerName);
        return new Proxy(
          {},
          {
            get(_, procName) {
              const procStr = String(procName);
              return {
                queryOptions: (input?: unknown): QueryOptionsShape => {
                  const queryKey = [routerStr, procStr, input] as const;

                  // queryFn will create a caller with server context and call the procedure.
                  const queryFn = async (): Promise<unknown> => {
                    // create server-side context (auth, etc.)
                    const ctx = await createTRPCContext();
                    const caller = appRouter.createCaller(ctx);

                    // access the router and procedure dynamically
                    const routerObj = (caller as unknown) as Record<string, unknown>;
                    const procObj = routerObj[routerStr];

                    if (!procObj || typeof procObj !== "object") {
                      throw new Error(`TRPC server helper: router "${routerStr}" not found on caller.`);
                    }

                    const proc = (procObj as Record<string, unknown>)[procStr];
                    if (!proc || typeof proc !== "function") {
                      throw new Error(`TRPC server helper: procedure "${routerStr}.${procStr}" not found or not callable.`);
                    }

                    // Call the procedure. Procedures in tRPC server callers often have `.call` signature depending on router shape,
                    // but typically each procedure is a function accepting input. We call it and normalize with Promise.resolve.
                    const result = (proc as (...args: unknown[]) => unknown)(input);
                    return Promise.resolve(result);
                  };

                  return { queryKey, queryFn };
                },
              };
            },
          }
        ) as Record<string, { queryOptions: (input?: unknown) => QueryOptionsShape }>;
      },
    }
  ) as Record<string, Record<string, { queryOptions: (input?: unknown) => QueryOptionsShape }>>;

/**
 * Export a default for convenience imports if some files were importing default earlier.
 */
export default trpc;
