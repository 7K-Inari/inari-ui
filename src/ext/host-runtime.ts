import * as React from "react";
import * as ReactDOM from "react-dom";
import * as ReactDOMClient from "react-dom/client";
import * as ReactRouterDOM from "react-router-dom";
import * as zod from "zod";
import * as UiPluginSDK from "@7k-inari/ui-plugin-sdk";
import { init, type ModuleFederation } from "@module-federation/runtime";

// Module Federation host runtime (§5.8): a single host instance. Remotes are
// registered at runtime from the backend extension registry (no static
// `remotes` map); React/ReactDOM are shared as singletons so extensions use
// the shell's copies.

let instance: ModuleFederation | null = null;

export function getHostRuntime(): ModuleFederation {
  if (instance) return instance;
  instance = init({
    name: "inari-shell",
    remotes: [],
    shared: {
      react: {
        version: React.version,
        scope: "default",
        lib: () => React,
        shareConfig: { singleton: true, requiredVersion: false },
      },
      "react-dom": {
        version: ReactDOM.version,
        scope: "default",
        lib: () => ReactDOM,
        shareConfig: { singleton: true, requiredVersion: false },
      },
      "react-dom/client": {
        scope: "default",
        lib: () => ReactDOMClient,
        shareConfig: { singleton: true, requiredVersion: false },
      },
      "react-router-dom": {
        scope: "default",
        lib: () => ReactRouterDOM,
        shareConfig: { singleton: true, requiredVersion: false },
      },
      zod: {
        scope: "default",
        lib: () => zod,
        shareConfig: { singleton: true, requiredVersion: false },
      },
      "@7k-inari/ui-plugin-sdk": {
        scope: "default",
        lib: () => UiPluginSDK,
        shareConfig: { singleton: true, requiredVersion: false },
      },
    },
  });
  return instance;
}

// Test hook: reset the memoized runtime between test cases.
export function resetHostRuntime(): void {
  instance = null;
}
