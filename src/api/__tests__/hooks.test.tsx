import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useAsyncResource } from "@/api/hooks";

vi.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ token: "test-token" }),
}));

function Harness({ fetcher }: { fetcher: () => Promise<string> }) {
  const { data } = useAsyncResource(fetcher, [], { refetchIntervalMs: 60_000 });
  return <span data-testid="value">{data ?? "none"}</span>;
}

describe("useAsyncResource", () => {
  it("refetches when the tab becomes visible again", async () => {
    let calls = 0;
    const fetcher = vi.fn(() => Promise.resolve(`result-${++calls}`));
    render(<Harness fetcher={fetcher} />);

    expect(await screen.findByText("result-1")).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Long interval: without the visibility listener this would never refetch.
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(await screen.findByText("result-2")).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
