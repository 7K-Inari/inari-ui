import { BrowserRouter } from "react-router-dom";

import { AuthProvider } from "@/auth/auth-context";
import { PermissionsProvider } from "@/auth/permissions-context";
import { ThemeProvider } from "@/components/theme-provider";
import { AppRoutes } from "@/routes";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PermissionsProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </PermissionsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
