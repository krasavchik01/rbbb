import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AIErrorBoundary } from '@/components/AIErrorBoundary';
import { WidgetErrorBoundary } from '@/components/WidgetErrorBoundary';
import { ROLE_GROUPS } from '@/lib/roleAccess';
import Projects from '@/pages/Projects';
const Index = lazy(() => import('@/pages/Index'));
const HR = lazy(() => import('@/pages/HR'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const Settings = lazy(() => import('@/pages/Settings'));
const Employees = lazy(() => import('@/pages/Employees'));
const Timesheets = lazy(() => import('@/pages/Timesheets'));
const AssignPartners = lazy(() => import('@/pages/AssignPartners'));
const Bonuses = lazy(() => import('@/pages/Bonuses'));
const UserManagement = lazy(() => import('@/pages/UserManagement'));
const CreateProjectProcurement = lazy(() => import('@/pages/CreateProjectProcurement'));
const ProjectApproval = lazy(() => import('@/pages/ProjectApproval'));
const ProjectWorkspace = lazy(() => import('@/pages/ProjectWorkspace'));
const SupabaseDiagnostics = lazy(() => import('@/pages/SupabaseDiagnostics'));
const DatabaseTest = lazy(() => import('@/pages/DatabaseTest'));
const Tenders = lazy(() => import('@/pages/Tenders'));
const Attendance = lazy(() => import('@/pages/Attendance'));
const Notifications = lazy(() => import('@/pages/Notifications'));
const SMTPSettings = lazy(() => import('@/pages/SMTPSettings'));
// Audit и IFRS9 удалены из навигации по решению юзера (2026-05-21):
// «усложнил с аудитом и процедурами МСФО, нагружает систему, убрать».
// Файлы src/pages/Audit.tsx и src/pages/IFRS9.tsx сохранены на случай восстановления.
const RoleManagement = lazy(() => import('@/pages/RoleManagement'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const Register = lazy(() => import('@/pages/Register'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const SettingsDiagnostics = lazy(() => import('@/pages/SettingsDiagnostics'));
const AIChat = lazy(() => import('@/pages/AIChat'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

// Редирект для legacy-уведомлений: /projects/:id → /project/:id.
function RedirectToProject() {
  const { id } = useParams();
  return <Navigate to={`/project/${id}`} replace />;
}

function IndexRoute() {
  const location = useLocation();
  const hash = location.hash || (typeof window !== 'undefined' ? window.location.hash : '');
  if (hash.includes('access_token=') && (hash.includes('type=recovery') || hash.includes('refresh_token='))) {
    return <Navigate to={{ pathname: '/reset-password', hash }} replace />;
  }
  return <Index />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SidebarProvider>
          <Suspense fallback={<div style={{padding:16}}>Загрузка...</div>}>
            <WidgetErrorBoundary fullPage label="приложение">
            <Routes>
            <Route path="/" element={<IndexRoute />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<Navigate to="/projects" replace />} />
            <Route path="/project-command-center" element={<Navigate to="/projects" replace />} />
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
                <ProtectedRoute allowedRoles={ROLE_GROUPS.hrManagement}>
                  <Layout>
                    <HR />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute allowedRoles={ROLE_GROUPS.executive}>
                  <Layout>
                    <Analytics />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/employees"
              element={
                <ProtectedRoute allowedRoles={ROLE_GROUPS.hrManagement}>
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
            <Route path="/timesheet-approval" element={<Navigate to="/projects" replace />} />
            <Route
              path="/assign-partners"
              element={
                <ProtectedRoute allowedRoles={ROLE_GROUPS.management}>
                  <Layout>
                    <AssignPartners />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/bonuses"
              element={
                <ProtectedRoute allowedRoles={ROLE_GROUPS.executive}>
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
            <Route path="/calendar" element={<Navigate to="/projects" replace />} />
            <Route path="/tasks" element={<Navigate to="/projects" replace />} />
            <Route path="/my-tasks" element={<Navigate to="/projects" replace />} />
            {/* Legacy survey/questionnaire/import workflows removed from the product UI.
                Keep redirects so old saved links do not 404. */}
            <Route path="/survey" element={<Navigate to="/projects" replace />} />
            <Route path="/project-survey" element={<Navigate to="/projects" replace />} />
            <Route path="/project-survey-results" element={<Navigate to="/projects" replace />} />
            <Route path="/import-timesheet" element={<Navigate to="/timesheets" replace />} />
            <Route
              path="/attendance"
              element={
                <ProtectedRoute>
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
            {/* Legacy template constructor removed from the product UI.
                Procurement project creation is the active supported workflow. */}
            <Route path="/template-constructor/:id" element={<Navigate to="/create-project-procurement" replace />} />
            <Route path="/create-project" element={<Navigate to="/create-project-procurement" replace />} />
            <Route
              path="/create-project-procurement"
              element={
                <ProtectedRoute allowedRoles={ROLE_GROUPS.procurementAdmin}>
                  <Layout>
                    <CreateProjectProcurement />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/project-approval"
              element={
                <ProtectedRoute allowedRoles={ROLE_GROUPS.management}>
                  <Layout>
                    <WidgetErrorBoundary fullPage label="Утверждение проектов">
                      <ProjectApproval />
                    </WidgetErrorBoundary>
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tenders"
              element={
                <ProtectedRoute allowedRoles={ROLE_GROUPS.procurement}>
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
                <ProtectedRoute allowedRoles={ROLE_GROUPS.admin}>
                  <Layout>
                    <SupabaseDiagnostics />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/database-test"
              element={
                <ProtectedRoute allowedRoles={ROLE_GROUPS.admin}>
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
                <ProtectedRoute allowedRoles={ROLE_GROUPS.admin}>
                  <Layout>
                    <SMTPSettings />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route path="/msuk-compliance" element={<Navigate to="/projects" replace />} />
            <Route path="/service-memos" element={<Navigate to="/projects" replace />} />
            {/* /audit удалён по решению юзера. Redirect на главную, чтобы старые ссылки не падали. */}
            <Route path="/audit" element={<Navigate to="/" replace />} />
            <Route path="/demo-users" element={<Navigate to="/404" replace />} />
            <Route
              path="/role-management"
              element={
                <ProtectedRoute allowedRoles={ROLE_GROUPS.admin}>
                  <Layout>
                    <RoleManagement />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings-diagnostics"
              element={
                <ProtectedRoute allowedRoles={ROLE_GROUPS.admin}>
                  <Layout>
                    <SettingsDiagnostics />
                  </Layout>
                </ProtectedRoute>
              }
            />
            {/* /ifrs9 удалён по решению юзера. Redirect на главную. */}
            <Route path="/ifrs9" element={<Navigate to="/" replace />} />
            <Route
              path="/ai"
              element={
                <ProtectedRoute allowedRoles={ROLE_GROUPS.ai}>
                  <Layout>
                    <AIErrorBoundary>
                      <AIChat />
                    </AIErrorBoundary>
                  </Layout>
                </ProtectedRoute>
              }
            />
            {/* /my-tasks — теперь redirect → /tasks?tab=mine (определён выше). */}
            {/* Legacy-уведомления писались с url /projects/:id (с «s») — в БД
                таких ~150 штук, продолжают всплывать после клика по бейджу
                уведомлений. Текущий код пишет /project/:id. Редирект чинит
                старые уведомления без миграции данных. */}
            <Route path="/projects/:id" element={<RedirectToProject />} />
            <Route path="/404" element={<NotFound />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
            </Routes>
            </WidgetErrorBoundary>
            <Toaster />
          </Suspense>
        </SidebarProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
