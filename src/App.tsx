import { BrowserRouter } from "react-router-dom";

import { AuthProvider } from "@/auth/auth-context";
import { ThemeProvider } from "@/components/theme-provider";
import { AppRoutes } from "@/routes";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
