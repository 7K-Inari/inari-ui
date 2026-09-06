import { BrowserRouter } from "react-router-dom";

import { AuthProvider } from "@/auth/auth-context";
import { PermissionsProvider } from "@/auth/permissions-context";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { AppRoutes } from "@/routes";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PermissionsProvider>
          <BrowserRouter>
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </BrowserRouter>
        </PermissionsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
