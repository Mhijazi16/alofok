import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

import { store } from "@/store";
import { createIDBPersister } from "@/lib/queryPersister";
import { PERSIST_QUERY_KEYS } from "@/hooks/useCacheSync";
import App from "./App";
import "./i18n";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      retry: 1,
    },
  },
});

const persister = createIDBPersister();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 1000 * 60 * 60 * 24, // 24 hours
          dehydrateOptions: {
            shouldDehydrateQuery: (query) => {
              if (query.state.status !== "success") return false;
              const key = query.queryKey[0];
              return (
                typeof key === "string" &&
                (PERSIST_QUERY_KEYS as readonly string[]).includes(key)
              );
            },
          },
        }}
      >
        <App />
      </PersistQueryClientProvider>
    </Provider>
  </React.StrictMode>
);
