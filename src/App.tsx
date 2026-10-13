import { BrowserRouter } from "react-router-dom";

import { AuthProvider } from "@/auth/auth-context";
import { PermissionsProvider } from "@/auth/permissions-context";
import { ThemeProvider, ProjectProvider } from "7k-design-system/react";
import { ErrorBoundary } from "@/components/error-boundary";
import { AppRoutes } from "@/routes";

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <ProjectProvider defaultProject="inari">
      <AuthProvider>
        <PermissionsProvider>
          <BrowserRouter>
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </BrowserRouter>
        </PermissionsProvider>
      </AuthProvider>
      </ProjectProvider>
    </ThemeProvider>
  );
}
