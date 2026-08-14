import * as React from "react";
import { LogOut, Menu } from "lucide-react";

import { useAuth } from "@/auth/auth-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/theme-provider";
import { SidebarNav } from "@/layout/sidebar";
import { TenantSwitcher } from "@/layout/tenant-switcher";

export function Header() {
  const { parsedToken, logout } = useAuth();
  const name =
    (parsedToken?.["name"] as string | undefined) ??
    (parsedToken?.["preferred_username"] as string | undefined) ??
    "User";
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const [navOpen, setNavOpen] = React.useState(false);

  return (
    <header className="flex h-14 items-center gap-3 border-b bg-background px-4">
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open navigation"
          >
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarNav onNavigate={() => setNavOpen(false)} />
        </SheetContent>
      </Sheet>
      <TenantSwitcher />
      <div className="flex-1" />
      <ModeToggle />
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="User menu">
          <Avatar>
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => logout()}>
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
