import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import Index from '@/pages/Index';
import Dashboard from '@/pages/Dashboard';
import Projects from '@/pages/Projects';
import HR from '@/pages/HR';
import Analytics from '@/pages/Analytics';
import Settings from '@/pages/Settings';
import Employees from '@/pages/Employees';
import Timesheets from '@/pages/Timesheets';
import Bonuses from '@/pages/Bonuses';
import UserManagement from '@/pages/UserManagement';
import TemplateEditor from '@/pages/TemplateEditor';
import TemplateConstructor from '@/pages/TemplateConstructor';
import CreateProjectFromTemplate from '@/pages/CreateProjectFromTemplate';
import CreateProjectProcurement from '@/pages/CreateProjectProcurement';
import ProjectApproval from '@/pages/ProjectApproval';
import ProjectWorkspace from '@/pages/ProjectWorkspace';
import SupabaseDiagnostics from '@/pages/SupabaseDiagnostics';
import DatabaseTest from '@/pages/DatabaseTest';
import TeamManagement from '@/pages/TeamManagement';
import NotFound from '@/pages/NotFound';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
            <Route path="/" element={<Index />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Projects />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr"
              element={
                <ProtectedRoute>
                  <Layout>
                    <HR />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Analytics />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/employees"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Employees />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/timesheets"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Timesheets />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/bonuses"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Bonuses />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Settings />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/user-management"
              element={
                <ProtectedRoute adminOnly>
                  <Layout>
                    <UserManagement />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/template-editor"
              element={
                <ProtectedRoute>
                  <Layout>
                    <TemplateEditor />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/template-constructor/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <TemplateConstructor />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/create-project"
              element={
                <ProtectedRoute>
                  <Layout>
                    <CreateProjectFromTemplate />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/create-project-procurement"
              element={
                <ProtectedRoute>
                  <Layout>
                    <CreateProjectProcurement />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/project-approval"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ProjectApproval />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/team-management"
              element={
                <ProtectedRoute>
                  <Layout>
                    <TeamManagement />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/project/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ProjectWorkspace />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/diagnostics"
              element={
                <ProtectedRoute>
                  <Layout>
                    <SupabaseDiagnostics />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/database-test"
              element={
                <ProtectedRoute allowedRoles={['admin', 'ceo']}>
                  <Layout>
                    <DatabaseTest />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route path="/404" element={<NotFound />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
          <Toaster />
        </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
