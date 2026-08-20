import * as React from "react";
import * as ReactDOM from "react-dom";
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
    },
  });
  return instance;
}

// Test hook: reset the memoized runtime between test cases.
export function resetHostRuntime(): void {
  instance = null;
}
