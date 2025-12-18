import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Eye, EyeOff, UserPlus, ArrowLeft, Building2, Shield, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { UserRole, ROLE_LABELS } from '@/types/roles';
import { Database } from '@/integrations/supabase/types';

type DbAppRole = Database['public']['Enums']['app_role'];
type DbEmployeeLevel = Database['public']['Enums']['employee_level'];

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '' as UserRole | '',
    phone: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const availableRoles: { value: UserRole; label: string }[] = [
    { value: 'assistant_1', label: ROLE_LABELS.assistant_1 },
    { value: 'assistant_2', label: ROLE_LABELS.assistant_2 },
    { value: 'assistant_3', label: ROLE_LABELS.assistant_3 },
    { value: 'supervisor_1', label: ROLE_LABELS.supervisor_1 },
    { value: 'supervisor_2', label: ROLE_LABELS.supervisor_2 },
    { value: 'supervisor_3', label: ROLE_LABELS.supervisor_3 },
    { value: 'manager_1', label: ROLE_LABELS.manager_1 },
    { value: 'manager_2', label: ROLE_LABELS.manager_2 },
    { value: 'manager_3', label: ROLE_LABELS.manager_3 },
    { value: 'tax_specialist_1', label: ROLE_LABELS.tax_specialist_1 },
    { value: 'tax_specialist_2', label: ROLE_LABELS.tax_specialist_2 },
    { value: 'accountant', label: ROLE_LABELS.accountant },
    { value: 'contractor', label: ROLE_LABELS.contractor },
  ];

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) return 'Введите ваше имя';
    if (!formData.email.trim()) return 'Введите email';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return 'Введите корректный email';
    if (!formData.password) return 'Введите пароль';
    if (formData.password.length < 6) return 'Пароль должен быть не менее 6 символов';
    if (formData.password !== formData.confirmPassword) return 'Пароли не совпадают';
    if (!formData.role) return 'Выберите роль';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);

    try {
      const { data: existingUser } = await supabase
        .from('employees')
        .select('id')
        .eq('email', formData.email.trim().toLowerCase())
        .maybeSingle();

      if (existingUser) {
        setError('Пользователь с таким email уже существует');
        setIsLoading(false);
        return;
      }

      let level: '1' | '2' | '3' = '1';
      if (formData.role.includes('_1')) level = '1';
      else if (formData.role.includes('_2')) level = '2';
      else if (formData.role.includes('_3')) level = '3';

      const roleMapping: Record<string, DbAppRole> = {
        'assistant_1': 'assistant',
        'assistant_2': 'assistant',
        'assistant_3': 'assistant',
        'supervisor_1': 'manager',
        'supervisor_2': 'manager',
        'supervisor_3': 'manager',
        'manager_1': 'manager',
        'manager_2': 'manager',
        'manager_3': 'manager',
        'tax_specialist_1': 'tax_specialist',
        'tax_specialist_2': 'tax_specialist',
        'accountant': 'employee',
        'contractor': 'employee',
      };

      const dbRole: DbAppRole = roleMapping[formData.role] || 'employee';

      const { error: insertError } = await supabase
        .from('employees')
        .insert({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          role: dbRole,
          level: level as DbEmployeeLevel,
          whatsapp: formData.phone || null,
        });

      if (insertError) {
        console.error('Registration error:', insertError);
        setError('Ошибка при регистрации. Попробуйте позже.');
        setIsLoading(false);
        return;
      }

      setSuccess('Регистрация успешна! Теперь вы можете войти в систему.');
      setFormData({ name: '', email: '', password: '', confirmPassword: '', role: '', phone: '' });

      setTimeout(() => navigate('/'), 2000);

    } catch (error) {
      console.error('Registration error:', error);
      setError('Произошла ошибка при регистрации');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      <div className="flex min-h-screen">
        {/* Левая часть - Информация */}
        <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 flex-col justify-center p-8 xl:p-16 bg-gradient-to-br from-green-900/30 to-slate-900/50">
          <div className="max-w-2xl">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-700 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/30">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white">RB Partners Suite</h1>
                <p className="text-green-300">Регистрация нового сотрудника</p>
              </div>
            </div>

            <p className="text-xl text-slate-300 mb-12">
              Присоединяйтесь к команде и получите доступ к системе управления проектами
            </p>

            <div className="space-y-6">
              <div className="flex items-start gap-4 bg-slate-800/40 backdrop-blur rounded-xl p-6 border border-slate-700/50">
                <CheckCircle className="w-8 h-8 text-green-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Быстрая регистрация</h3>
                  <p className="text-slate-400">Заполните форму и сразу получите доступ к системе</p>
                </div>
              </div>

              <div className="flex items-start gap-4 bg-slate-800/40 backdrop-blur rounded-xl p-6 border border-slate-700/50">
                <Shield className="w-8 h-8 text-blue-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Безопасность данных</h3>
                  <p className="text-slate-400">Ваши данные защищены современными методами шифрования</p>
                </div>
              </div>

              <div className="flex items-start gap-4 bg-slate-800/40 backdrop-blur rounded-xl p-6 border border-slate-700/50">
                <Clock className="w-8 h-8 text-purple-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Доступ 24/7</h3>
                  <p className="text-slate-400">Работайте в системе в любое удобное время с любого устройства</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Правая часть - Форма */}
        <div className="w-full lg:w-1/2 xl:w-2/5 flex flex-col justify-center p-4 sm:p-8 overflow-y-auto">
          <div className="w-full max-w-md mx-auto space-y-6">
            {/* Мобильный логотип */}
            <div className="lg:hidden text-center mb-6">
              <div className="mx-auto w-14 h-14 bg-gradient-to-br from-green-500 to-green-700 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/30 mb-3">
                <Building2 className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-xl font-bold text-white">RB Partners Suite</h1>
            </div>

            <Card className="border-green-500/20 bg-slate-900/80 backdrop-blur-lg">
              <CardHeader className="space-y-2 text-center pb-4">
                <div className="mx-auto w-12 h-12 bg-gradient-to-br from-green-500 via-green-600 to-green-800 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/50">
                  <UserPlus className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-xl font-bold text-white">Регистрация</CardTitle>
                <CardDescription className="text-slate-400 text-sm">
                  Создайте аккаунт для работы в системе
                </CardDescription>
              </CardHeader>
              <CardContent>
                {error && (
                  <Alert variant="destructive" className="mb-4 border-red-500/50 bg-red-900/20">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {success && (
                  <Alert className="mb-4 border-green-500/50 bg-green-900/20">
                    <AlertDescription className="text-green-400">{success}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-slate-200 text-sm">ФИО *</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Иванов Иван Иванович"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      required
                      disabled={isLoading}
                      className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 h-10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-slate-200 text-sm">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      required
                      disabled={isLoading}
                      className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 h-10"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="password" className="text-slate-200 text-sm">Пароль *</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Мин. 6 симв."
                          value={formData.password}
                          onChange={(e) => handleChange('password', e.target.value)}
                          required
                          disabled={isLoading}
                          className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 pr-9 h-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-2 hover:bg-transparent text-slate-400 hover:text-white"
                          onClick={() => setShowPassword(!showPassword)}
                          disabled={isLoading}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="confirmPassword" className="text-slate-200 text-sm">Повторите *</Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Повторите"
                          value={formData.confirmPassword}
                          onChange={(e) => handleChange('confirmPassword', e.target.value)}
                          required
                          disabled={isLoading}
                          className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 pr-9 h-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-2 hover:bg-transparent text-slate-400 hover:text-white"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          disabled={isLoading}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="role" className="text-slate-200 text-sm">Должность *</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value) => handleChange('role', value)}
                      disabled={isLoading}
                    >
                      <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white h-10">
                        <SelectValue placeholder="Выберите должность" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 max-h-[250px]">
                        {availableRoles.map((role) => (
                          <SelectItem
                            key={role.value}
                            value={role.value}
                            className="text-white hover:bg-slate-700"
                          >
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500">
                      Админ. роли назначает только администратор
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-slate-200 text-sm">Телефон (WhatsApp)</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+7 (XXX) XXX-XX-XX"
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      disabled={isLoading}
                      className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 h-10"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold h-10 mt-4"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Регистрация...
                      </>
                    ) : (
                      'Зарегистрироваться'
                    )}
                  </Button>

                  <div className="text-center pt-3 border-t border-slate-700">
                    <Link
                      to="/"
                      className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors text-sm"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Уже есть аккаунт? Войти
                    </Link>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
