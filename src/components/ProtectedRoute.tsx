import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@/types/roles';
import { Card } from '@/components/ui/card';
import { Shield, AlertTriangle } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  permission?: string;
  allowedRoles?: UserRole[];
  fallback?: ReactNode;
}

export function ProtectedRoute({ 
  children, 
  permission, 
  allowedRoles, 
  fallback 
}: ProtectedRouteProps) {
  const { user, isAuthenticated, checkPermission, hasAnyRole } = useAuth();

  // Проверяем аутентификацию
  if (!isAuthenticated || !user) {
    return <Navigate to="/" replace />;
  }

  // Проверяем роли
  if (allowedRoles && !hasAnyRole(allowedRoles)) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Доступ запрещен</h2>
          <p className="text-muted-foreground mb-4">
            У вас нет прав для доступа к этой странице.
          </p>
          <p className="text-sm text-muted-foreground">
            Требуемые роли: {allowedRoles.join(', ')}
          </p>
        </Card>
      </div>
    );
  }

  // Проверяем разрешения
  if (permission && !checkPermission(permission)) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-yellow-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Недостаточно прав</h2>
          <p className="text-muted-foreground mb-4">
            У вас нет разрешения для выполнения этого действия.
          </p>
          <p className="text-sm text-muted-foreground">
            Требуемое разрешение: {permission}
          </p>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

