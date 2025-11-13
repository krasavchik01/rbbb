import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserRole, hasPermission } from '@/types/roles';
import { supabase } from '@/integrations/supabase/client';

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
      role: 'manager_1',
      department: 'Проекты',
      position: 'Менеджер 1',
    },
  },
  
  // Супервайзер 3
  'supervisor@rbpartners.com': {
    password: 'supervisor',
    user: {
      id: 'supervisor_3',
      email: 'supervisor@rbpartners.com',
      name: 'Сидоров С.С.',
      role: 'supervisor_3',
      department: 'Аудит',
      position: 'Супервайзер 3',
    },
  },
  
  // Ассистент 3
  'assistant@rbpartners.com': {
    password: 'assistant',
    user: {
      id: 'assistant_3',
      email: 'assistant@rbpartners.com',
      name: 'Ассистент Кузнецов',
      role: 'assistant_3',
      department: 'Аудит',
      position: 'Ассистент 3',
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
  
  // Дополнительные роли для полного цикла проекта
  
  // Менеджер проекта 2
  'manager2@rbpartners.com': {
    password: 'manager2',
    user: {
      id: 'manager_2',
      email: 'manager2@rbpartners.com',
      name: 'Менеджер 2 Смирнов',
      role: 'manager_2',
      department: 'Проекты',
      position: 'Менеджер 2',
    },
  },
  
  // Менеджер проекта 3
  'manager3@rbpartners.com': {
    password: 'manager3',
    user: {
      id: 'manager_3',
      email: 'manager3@rbpartners.com',
      name: 'Менеджер 3 Козлов',
      role: 'manager_3',
      department: 'Проекты',
      position: 'Менеджер 3',
    },
  },
  
  // Супервайзер 1
  'supervisor1@rbpartners.com': {
    password: 'supervisor1',
    user: {
      id: 'supervisor_1',
      email: 'supervisor1@rbpartners.com',
      name: 'Супервайзер 1 Волков',
      role: 'supervisor_1',
      department: 'Аудит',
      position: 'Супервайзер 1',
    },
  },
  
  // Супервайзер 2
  'supervisor2@rbpartners.com': {
    password: 'supervisor2',
    user: {
      id: 'supervisor_2',
      email: 'supervisor2@rbpartners.com',
      name: 'Супервайзер 2 Новиков',
      role: 'supervisor_2',
      department: 'Аудит',
      position: 'Супервайзер 2',
    },
  },
  
  // Ассистент 1
  'assistant1@rbpartners.com': {
    password: 'assistant1',
    user: {
      id: 'assistant_1',
      email: 'assistant1@rbpartners.com',
      name: 'Ассистент 1 Лебедев',
      role: 'assistant_1',
      department: 'Аудит',
      position: 'Ассистент 1',
    },
  },
  
  // Ассистент 2
  'assistant2@rbpartners.com': {
    password: 'assistant2',
    user: {
      id: 'assistant_2',
      email: 'assistant2@rbpartners.com',
      name: 'Ассистент 2 Соколов',
      role: 'assistant_2',
      department: 'Аудит',
      position: 'Ассистент 2',
    },
  },
  
  // Налоговик
  'tax@rbpartners.com': {
    password: 'tax',
    user: {
      id: 'tax_1',
      email: 'tax@rbpartners.com',
      name: 'Налоговик Орлов',
      role: 'tax_specialist',
      department: 'Налоги',
      position: 'Налоговый специалист',
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
    // Сначала проверяем демо-пользователей
    const userRecord = DEMO_USERS[email];
    
    if (userRecord && userRecord.password === password) {
      setUser(userRecord.user);
      localStorage.setItem('user', JSON.stringify(userRecord.user));
      return true;
    }
    
    // Если не найден в демо-пользователях, проверяем сотрудников из базы данных
    try {
      // Получаем данные сотрудника из таблицы employees (берем первую запись если несколько)
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('*')
        .eq('email', email)
        .order('created_at', { ascending: false }) // Берем самую новую запись
        .limit(1)
        .single();

      if (employeeError) {
        console.error('❌ Employee not found in database:', employeeError);
        return false;
      }

      if (!employeeData) {
        console.error('❌ No employee data found');
        return false;
      }

      // Проверяем пароль (пока что просто проверяем что сотрудник существует)
      // TODO: Добавить хеширование паролей в будущем
      console.log('✅ Employee found:', employeeData.name);
      
      // Создаем объект пользователя из данных сотрудника
      const user: User = {
        id: employeeData.id,
        name: employeeData.name,
        email: employeeData.email,
        role: employeeData.role as UserRole,
        companyId: employeeData.company_id || undefined,
        position: employeeData.position || '',
        department: employeeData.department || '',
        avatar: employeeData.name ? employeeData.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : 'UN'
      };

      setUser(user);
      localStorage.setItem('user', JSON.stringify(user));
      return true;
    } catch (error) {
      console.error('❌ Database error:', error);
    }
    
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const checkPermission = (permission: string): boolean => {
    if (!user) return false;
    try {
      return hasPermission(user.role, permission as any);
    } catch (e) {
      console.error('Error checking permission:', permission, e);
      return false;
    }
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
