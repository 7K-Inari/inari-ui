import { beforeEach, describe, expect, it, vi } from "vitest";

const loginMock = vi.hoisted(() => vi.fn());

vi.mock("keycloak-js", () => ({
  default: class MockKeycloak {
    login = loginMock;
    tokenParsed: Record<string, unknown> | undefined = {
      organization: { acme: { name: "Acme" }, globex: {} },
    };
  },
}));

import {
  consumePendingOrg,
  handleAuthInitFailure,
  peekPendingOrg,
  switchOrganization,
} from "@/auth/keycloak";

describe("switchOrganization", () => {
  beforeEach(() => {
    sessionStorage.clear();
    loginMock.mockClear();
  });

  it("starts a silent re-authentication scoped to the requested org", () => {
    expect(switchOrganization("globex")).toBe(true);
    expect(loginMock).toHaveBeenCalledWith({
      prompt: "none",
      scope: "openid organization:globex",
    });
    expect(peekPendingOrg()).toBe("globex");
  });

  it("refuses to switch to an org that is not in the token", () => {
    expect(switchOrganization("evilcorp")).toBe(false);
    expect(loginMock).not.toHaveBeenCalled();
    expect(peekPendingOrg()).toBeNull();
  });
});

describe("consumePendingOrg", () => {
  beforeEach(() => {
    sessionStorage.clear();
    loginMock.mockClear();
  });

  it("returns the pending org once, then clears it", () => {
    switchOrganization("acme");
    expect(consumePendingOrg()).toBe("acme");
    expect(consumePendingOrg()).toBeNull();
  });
});

describe("handleAuthInitFailure", () => {
  beforeEach(() => {
    sessionStorage.clear();
    loginMock.mockClear();
  });

  it("does nothing when no org switch is pending", () => {
    expect(handleAuthInitFailure()).toBe(false);
    expect(loginMock).not.toHaveBeenCalled();
  });

  it("falls back to interactive login when a silent switch failed", () => {
    switchOrganization("globex");
    loginMock.mockClear();
    expect(handleAuthInitFailure()).toBe(true);
    expect(loginMock).toHaveBeenCalledWith({
      scope: "openid organization:globex",
    });
  });

  it("gives up after one interactive fallback attempt", () => {
    switchOrganization("globex");
    expect(handleAuthInitFailure()).toBe(true);
    loginMock.mockClear();
    expect(handleAuthInitFailure()).toBe(false);
    expect(loginMock).not.toHaveBeenCalled();
    expect(peekPendingOrg()).toBeNull();
  });

  it("resets the fallback guard when the pending org is consumed", () => {
    switchOrganization("globex");
    expect(handleAuthInitFailure()).toBe(true);
    switchOrganization("acme");
    expect(consumePendingOrg()).toBe("acme");
    switchOrganization("globex");
    expect(handleAuthInitFailure()).toBe(true);
  });
});
