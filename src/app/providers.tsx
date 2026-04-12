"use client";

import React from "react";
import { ThemeProvider } from "next-themes";
import {
  createNearConnectorService,
  createNearStore,
  createMainnetClient,
  NearProvider,
} from "react-near-ts";

const nearStore = createNearStore({
  networkId: "mainnet",
  clientCreator: createMainnetClient,
  serviceCreator: createNearConnectorService({}),
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <NearProvider nearStore={nearStore}>{children}</NearProvider>
    </ThemeProvider>
  );
}
