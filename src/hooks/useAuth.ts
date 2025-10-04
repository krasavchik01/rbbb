import React, { useState, useEffect, createContext, useContext } from 'react';
import { UserRole, hasPermission, getRoleInfo, ROLES } from '@/types/roles';

interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  checkPermission: (permission: string) => boolean;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  getUserRole: () => UserRole | null;
  getRoleInfo: () => any;
  switchRole: (newRole: UserRole) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    // Симуляция загрузки пользователя
    const loadUser = async () => {
      try {
        // В реальном приложении здесь был бы запрос к API
        const mockUser: User = {
          id: '1',
          email: 'demo@rbpartners.com',
          name: 'Демо Пользователь',
          role: 'admin', // Можно изменить на 'admin', 'manager', 'employee'
          avatar: undefined,
        };

        setAuthState({
          user: mockUser,
          isAuthenticated: true,
          isLoading: false,
        });
      } catch (error) {
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    };

    loadUser();
  }, []);

  const checkPermission = (permission: string): boolean => {
    if (!authState.user) return false;
    return hasPermission(authState.user.role, permission);
  };

  const hasRole = (role: UserRole): boolean => {
    return authState.user?.role === role;
  };

  const hasAnyRole = (roles: UserRole[]): boolean => {
    return authState.user ? roles.includes(authState.user.role) : false;
  };

  const getUserRole = (): UserRole | null => {
    return authState.user?.role || null;
  };

  const switchRole = (newRole: UserRole) => {
    if (authState.user) {
      setAuthState(prev => ({
        ...prev,
        user: {
          ...prev.user!,
          role: newRole
        }
      }));
    }
  };

  const getRoleInfo = () => {
    if (!authState.user) return null;
    return ROLES[authState.user.role];
  };

  const logout = () => {
    setAuthState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  };

  const value: AuthContextType = {
    ...authState,
    checkPermission,
    hasRole,
    hasAnyRole,
    getUserRole,
    getRoleInfo,
    switchRole,
    logout,
  };

  return React.createElement(
    AuthContext.Provider,
    { value },
    children
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

