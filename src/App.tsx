import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import { SidebarProvider } from '@/components/ui/sidebar';
const Index = lazy(() => import('@/pages/Index'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Projects = lazy(() => import('@/pages/Projects-simple'));
const HR = lazy(() => import('@/pages/HR'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const Settings = lazy(() => import('@/pages/Settings'));
const Employees = lazy(() => import('@/pages/Employees'));
const Timesheets = lazy(() => import('@/pages/Timesheets'));
const Bonuses = lazy(() => import('@/pages/Bonuses'));
const UserManagement = lazy(() => import('@/pages/UserManagement'));
const TemplateEditor = lazy(() => import('@/pages/TemplateEditor'));
const TemplateConstructor = lazy(() => import('@/pages/TemplateConstructor'));
const CreateProjectFromTemplate = lazy(() => import('@/pages/CreateProjectFromTemplate'));
const CreateProjectProcurement = lazy(() => import('@/pages/CreateProjectProcurement'));
const ProjectApproval = lazy(() => import('@/pages/ProjectApproval'));
const ProjectWorkspace = lazy(() => import('@/pages/ProjectWorkspace'));
const SupabaseDiagnostics = lazy(() => import('@/pages/SupabaseDiagnostics'));
const DatabaseTest = lazy(() => import('@/pages/DatabaseTest'));
const TeamManagement = lazy(() => import('@/pages/TeamManagement'));
const Tenders = lazy(() => import('@/pages/Tenders'));
const Calendar = lazy(() => import('@/pages/Calendar'));
const Tasks = lazy(() => import('@/pages/Tasks'));
const Attendance = lazy(() => import('@/pages/Attendance'));
const Notifications = lazy(() => import('@/pages/Notifications'));
const SMTPSettings = lazy(() => import('@/pages/SMTPSettings'));
const MSUKCompliance = lazy(() => import('@/pages/MSUKCompliance'));
const ServiceMemos = lazy(() => import('@/pages/ServiceMemos'));
const TeamEvaluation = lazy(() => import('@/pages/TeamEvaluation'));
const AuditProcedures = lazy(() => import('@/pages/AuditProcedures'));
const DemoUsersManagement = lazy(() => import('@/pages/DemoUsersManagement'));
const RoleManagement = lazy(() => import('@/pages/RoleManagement'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const Register = lazy(() => import('@/pages/Register'));

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
        <SidebarProvider>
          <Suspense fallback={<div style={{padding:16}}>Загрузка...</div>}>
            <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/register" element={<Register />} />
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
                <ProtectedRoute allowedRoles={['hr']}>
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
              path="/calendar"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Calendar />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tasks"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Tasks />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/attendance"
              element={
                <ProtectedRoute allowedRoles={['ceo', 'deputy_director']}>
                  <Layout>
                    <Attendance />
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
              path="/tenders"
              element={
                <ProtectedRoute allowedRoles={['procurement']}>
                  <Layout>
                    <Tenders />
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
                <ProtectedRoute allowedRoles={['admin']}>
                  <Layout>
                    <SupabaseDiagnostics />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/database-test"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Layout>
                    <DatabaseTest />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Notifications />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/smtp-settings"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Layout>
                    <SMTPSettings />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/msuk-compliance"
              element={
                <ProtectedRoute allowedRoles={['partner', 'deputy_director', 'ceo', 'admin']}>
                  <Layout>
                    <MSUKCompliance />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/service-memos"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ServiceMemos />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/team-evaluation"
              element={
                <ProtectedRoute>
                  <Layout>
                    <TeamEvaluation />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/audit-procedures"
              element={
                <ProtectedRoute>
                  <Layout>
                    <AuditProcedures />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/demo-users"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Layout>
                    <DemoUsersManagement />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/role-management"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Layout>
                    <RoleManagement />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route path="/404" element={<NotFound />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
            </Routes>
            <Toaster />
          </Suspense>
        </SidebarProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
