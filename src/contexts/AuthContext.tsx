import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserRole, hasPermission } from '@/types/roles';

interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companyId?: string;
  department?: string;
  position?: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  checkPermission: (permission: string) => boolean;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Демо пользователи с новыми ролями
const DEMO_USERS: Record<string, { password: string; user: User }> = {
  // CEO - Генеральный директор (главный босс)
  'ceo@rbpartners.com': {
    password: 'ceo',
    user: {
      id: 'ceo_1',
      email: 'ceo@rbpartners.com',
      name: 'Генеральный Директор',
      role: 'ceo',
      position: 'Генеральный директор (CEO)',
    },
  },
  
  // Заместитель ген. директора
  'deputy@mak.kz': {
    password: 'deputy',
    user: {
      id: 'deputy_1',
      email: 'deputy@mak.kz',
      name: 'Заместитель ген. директора МАК',
      role: 'deputy_director',
      companyId: 'mak',
      position: 'Заместитель генерального директора',
    },
  },
  
  // Отдел закупок
  'procurement@rbpartners.com': {
    password: 'procurement',
    user: {
      id: 'procurement_1',
      email: 'procurement@rbpartners.com',
      name: 'Отдел Закупок',
      role: 'procurement',
      department: 'Закупки',
      position: 'Специалист отдела закупок',
    },
  },
  
  // Партнер
  'partner@rbpartners.com': {
    password: 'partner',
    user: {
      id: 'partner_1',
      email: 'partner@rbpartners.com',
      name: 'Партнер Иванов',
      role: 'partner',
      companyId: 'mak',
      position: 'Партнер',
    },
  },
  
  // Руководитель проекта
  'manager@rbpartners.com': {
    password: 'manager',
    user: {
      id: 'manager_1',
      email: 'manager@rbpartners.com',
      name: 'Петров П.П.',
      role: 'project_manager',
      department: 'Проекты',
      position: 'Руководитель проекта',
    },
  },
  
  // Супервайзер
  'supervisor@rbpartners.com': {
    password: 'supervisor',
    user: {
      id: 'supervisor_1',
      email: 'supervisor@rbpartners.com',
      name: 'Сидоров С.С.',
      role: 'supervisor_3',
      department: 'Аудит',
      position: 'Супервайзер',
    },
  },
  
  // Ассистент
  'assistant@rbpartners.com': {
    password: 'assistant',
    user: {
      id: 'assistant_1',
      email: 'assistant@rbpartners.com',
      name: 'Ассистент Кузнецов',
      role: 'assistant_3',
      department: 'Аудит',
      position: 'Ассистент',
    },
  },
  
  // Старый admin для совместимости
  'admin': {
    password: 'admin',
    user: {
      id: 'admin_1',
      email: 'admin@rbpartners.com',
      name: 'Администратор',
      role: 'admin',
      department: 'IT',
      position: 'Системный администратор',
    },
  },
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Проверка сохраненной сессии
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    const userRecord = DEMO_USERS[email];
    
    if (userRecord && userRecord.password === password) {
      setUser(userRecord.user);
      localStorage.setItem('user', JSON.stringify(userRecord.user));
      return true;
    }
    
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const checkPermission = (permission: string): boolean => {
    if (!user) return false;
    return hasPermission(user.role, permission);
  };

  const hasRole = (role: UserRole): boolean => {
    return user?.role === role;
  };

  const hasAnyRole = (roles: UserRole[]): boolean => {
    return user ? roles.includes(user.role) : false;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, checkPermission, hasRole, hasAnyRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
