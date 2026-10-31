import type { PropsWithChildren } from "react";

import QueryProviders from "./query-client.provider";
import ThemeProvider from "./theme.provider";
import StoreProvider from "./store.provider";

export default function Provider({ children }: PropsWithChildren) {
  return (
    <StoreProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
        enableColorScheme
      >
        <QueryProviders>{children}</QueryProviders>
      </ThemeProvider>
    </StoreProvider>
  );
}
