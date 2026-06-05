import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserRole, hasPermission, normalizeUserRole } from '@/types/roles';
import { supabase } from '@/integrations/supabase/client';
import { getUserAllowedCompanyIds } from '@/lib/userCompanyAccess';

interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companyId?: string;
  department?: string;
  position?: string;
  avatar?: string;
  allowedCompanyIds?: string[] | null; // null = без ограничений
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  isLoading: boolean;
  checkPermission: (permission: string) => boolean;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Обогащает пользователя данными о доступе к компаниям из Supabase
async function enrichUserWithAccess(user: User): Promise<User> {
  const allowedIds = await getUserAllowedCompanyIds(user.id);
  return { ...user, allowedCompanyIds: allowedIds };
}

function normalizeAuthUser(user: User): User {
  return {
    ...user,
    role: normalizeUserRole(user.role),
  };
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Проверка сохраненной сессии
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const parsed = normalizeAuthUser(JSON.parse(savedUser));
        // Загружаем доступ к компаниям из Supabase
        enrichUserWithAccess(parsed).then(enriched => {
          setUser(enriched);
          setIsLoading(false);
        });
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('user');
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    // Проверяем только реальных сотрудников из базы данных.
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

      // Проверяем пароль если он установлен в БД
      if ((employeeData as any).password && (employeeData as any).password !== password) {
        console.error('❌ Wrong password for:', employeeData.email);
        return false;
      }

      // Создаём Supabase Auth session, если для сотрудника уже есть Auth-аккаунт.
      // Пока не валим legacy-вход, чтобы не заблокировать действующих пользователей
      // до полной миграции аккаунтов; backend strict JWT mode включать только после
      // этой миграции.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        console.warn('⚠️ Supabase Auth session was not created for employee login:', signInError.message);
      }

      console.log('✅ Employee found:', employeeData.name);
      
      // Создаем объект пользователя из данных сотрудника
      const employee = employeeData as typeof employeeData & {
        company_id?: string | null;
        position?: string | null;
        department?: string | null;
      };

      const user: User = {
        id: employeeData.id,
        name: employeeData.name,
        email: employeeData.email || '',
        role: normalizeUserRole(employeeData.role, employeeData.level),
        companyId: employee.company_id || undefined,
        position: employee.position || '',
        department: employee.department || '',
        avatar: employeeData.name ? employeeData.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : 'UN'
      };

      const enriched = await enrichUserWithAccess(user);
      setUser(enriched);
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
    void supabase.auth.signOut();
  };

  const updateUser = async (updates: Partial<User>) => {
    if (!user) return;
    const merged = normalizeAuthUser({ ...user, ...updates } as User);
    // Если allowedCompanyIds передали явно — используем их, иначе подгружаем из Supabase
    const updated = updates.allowedCompanyIds !== undefined
      ? merged
      : await enrichUserWithAccess(merged);
    setUser(updated);
    // Сохраняем базовые поля (без allowedCompanyIds — они берутся из Supabase)
    const { allowedCompanyIds: _, ...baseUser } = updated;
    localStorage.setItem('user', JSON.stringify(baseUser));
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
    <AuthContext.Provider value={{ user, login, logout, updateUser, isLoading, checkPermission, hasRole, hasAnyRole }}>
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
