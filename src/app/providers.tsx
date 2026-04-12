"use client";

import React from "react";
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
  return <NearProvider nearStore={nearStore}>{children}</NearProvider>;
}
