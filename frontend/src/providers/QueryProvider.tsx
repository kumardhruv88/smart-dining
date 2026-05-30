/**
 * src/providers/QueryProvider.tsx
 *
 * TanStack React Query provider with sensible defaults for the dining app.
 * Wraps children with QueryClientProvider and includes DevTools in development.
 */

"use client";

import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

// ─────────────────────────────────────────────────────────────────────────────
// QueryClient factory — called once per component mount
// ─────────────────────────────────────────────────────────────────────────────
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 60 seconds
        staleTime: 60 * 1000,
        // Keep cached data for 5 minutes after component unmounts
        gcTime: 5 * 60 * 1000,
        // Retry failed requests twice before surfacing the error
        retry: 2,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
        // Refetch on window focus for real-time data (order status)
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: 1,
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────
interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  // Use useState so each request gets its own QueryClient on the server
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
