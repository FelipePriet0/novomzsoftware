
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedLayout from "@/layouts/ProtectedLayout";
import { AuthProvider } from "@/context/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import RequireAuth from "@/routes/RequireAuth";
import Index from "./pages/Index";
import Agendamento from "./pages/Agendamento";
import Historico from "./pages/Historico";
import Tarefas from "./pages/Tarefas";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import Avisos from "./pages/Avisos";
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Não tentar novamente para erros 4xx (client errors)
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        // Tentar até 3 vezes para outros erros
        return failureCount < 3;
      },
      staleTime: 0, // SEMPRE buscar dados frescos (evita cache antigo)
      cacheTime: 1000 * 30, // Cache por apenas 30 segundos
      refetchOnWindowFocus: true, // Recarregar ao voltar para aba
      refetchOnMount: true, // Sempre recarregar ao montar componente
    },
    mutations: {
      retry: false, // Não tentar novamente para mutations
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />

              <Route element={<RequireAuth />}>
                <Route element={<ProtectedLayout />}>
                  <Route path="/" element={<Index />} />
                  <Route path="/inicio" element={<Index />} />
                  <Route path="/tarefas" element={<Tarefas />} />
                  <Route path="/agendamento" element={<Agendamento />} />
                  <Route path="/historico" element={<Historico />} />
                  <Route path="/avisos" element={<Avisos />} />
                  <Route path="/dashboard/all" element={<Index />} />
                  <Route path="/dashboard/:company" element={<Index />} />
                  <Route path="/perfil" element={<Profile />} />
                </Route>
              </Route>

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
