import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'employee';
  department?: string;
  position?: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Демо пользователи
const DEMO_USERS: Record<string, { password: string; user: User }> = {
  'admin@rbpartners.com': {
    password: 'admin123',
    user: {
      id: '1',
      email: 'admin@rbpartners.com',
      name: 'Администратор',
      role: 'admin',
      department: 'Управление',
      position: 'Директор',
    },
  },
  'manager@rbpartners.com': {
    password: 'manager123',
    user: {
      id: '2',
      email: 'manager@rbpartners.com',
      name: 'Менеджер',
      role: 'manager',
      department: 'Проекты',
      position: 'Руководитель проектов',
    },
  },
  'employee@rbpartners.com': {
    password: 'employee123',
    user: {
      id: '3',
      email: 'employee@rbpartners.com',
      name: 'Сотрудник',
      role: 'employee',
      department: 'Разработка',
      position: 'Разработчик',
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

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
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

