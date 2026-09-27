import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ExtensionAuthErrorNotice } from "@/components/extension-auth-error";
import { ExtensionAuthError } from "@/ext/sso-session";

describe("ExtensionAuthErrorNotice", () => {
  it("renders an actionable downstream permission message without retry", () => {
    render(
      <ExtensionAuthErrorNotice
        error={new ExtensionAuthError("downstream-denied", "rbac: permission denied", 403)}
        extensionName="ArgoCD"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/doesn't have permission/i);
    expect(screen.getByRole("alert")).toHaveTextContent(/ArgoCD/);
    expect(screen.getByRole("alert")).toHaveTextContent(/rbac: permission denied/);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders Inari policy denials with remediation guidance", () => {
    render(
      <ExtensionAuthErrorNotice
        error={new ExtensionAuthError("policy", "denied by policy", 403, "request an exception")}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/blocked by platform policy/i);
    expect(screen.getByRole("alert")).toHaveTextContent(/request an exception/);
  });

  it("offers a retry for session bootstrap failures", async () => {
    const onRetry = vi.fn();
    render(
      <ExtensionAuthErrorNotice
        error={new ExtensionAuthError("session", "could not establish session", 401)}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/couldn't sign you in/i);
    await userEvent.click(screen.getByRole("button", { name: /retry sign-in/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders a generic failure for unknown errors", () => {
    render(<ExtensionAuthErrorNotice error={new ExtensionAuthError("unknown", "boom")} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/went wrong/i);
  });
});
