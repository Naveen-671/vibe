// src/trpc/rawClient.ts
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "./routers/_app";

export const rawTrpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: typeof window === "undefined"
        ? `${process.env.NEXT_PUBLIC_APP_URL
          ? (process.env.NEXT_PUBLIC_APP_URL.startsWith("http")
            ? process.env.NEXT_PUBLIC_APP_URL
            : `https://${process.env.NEXT_PUBLIC_APP_URL}`)
          : "http://localhost:3000"}/api/trpc`
        : "/api/trpc",
      transformer: superjson,
    }),
  ],
});
