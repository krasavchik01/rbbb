import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState, useEffect } from "react";
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects-simple";
import Employees from "./pages/Employees";
import HR from "./pages/HR";
import Timesheets from "./pages/Timesheets";
import Bonuses from "./pages/Bonuses";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import UserManagement from "./pages/UserManagement";

const queryClient = new QueryClient();

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Загрузка...</h1>
        </div>
      </div>
    );
  }

  // For demo purposes, we'll create a mock user if none exists but we're loading
  const mockUser = user || {
    id: 'demo-user',
    email: 'demo@rbpartners.com',
    app_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    user_metadata: {
      name: 'Демо Пользователь',
      role: 'Партнёр'
    }
  } as User;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          {!user && !loading ? (
            <Auth />
          ) : (
            <Layout user={mockUser}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/employees" element={<Employees />} />
                <Route path="/hr" element={<HR />} />
                <Route path="/timesheets" element={<Timesheets />} />
                <Route path="/bonuses" element={<Bonuses />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/user-management" element={<UserManagement />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>
          )}
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
