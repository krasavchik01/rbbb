import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEmployees } from "@/hooks/useSupabaseData";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/contexts/AuthContext";
import { supabaseDataStore } from "@/lib/supabaseDataStore";
import { useToast } from "@/hooks/use-toast";
import { sendWelcomeEmail } from "@/lib/emailService";
import * as XLSX from 'xlsx';
import {
  Plus,
  Search,
  Download,
  Upload,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Users,
  AlertCircle,
  CheckCircle,
  BarChart3,
  TrendingUp,
  Clock,
  Target,
  Building,
  Edit
} from "lucide-react";

export default function HR() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { employees = [], loading, refresh } = useEmployees();
  const { projects = [] } = useProjects();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [filterRole, setFilterRole] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    email: "",
    company: "",
    role: "",
    phone: "",
    department: "",
    position: "",
    category: "auditors", // auditors | other
    subcategory: "",
    customRole: "",
  });
  const [editEmployee, setEditEmployee] = useState({
    id: "",
    name: "",
    email: "",
    company: "",
    role: "",
    phone: "",
    department: "",
    position: "",
    category: "auditors", // auditors | other
    subcategory: "",
    customRole: "",
  });
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<Array<{
    name: string;
    email: string;
    status: 'success' | 'error';
    message: string;
    originalRole?: string;
    correctedRole?: string;
    canRetry?: boolean;
    employeeId?: string;
    editableCategory?: 'auditors' | 'other';
    editableRole?: string; // for auditors
    editableDepartment?: string; // for other
    editableCustomRole?: string; // for other
    editableSubcategory?: string; // shared as position
  }>>([]);
  const [showImportResults, setShowImportResults] = useState(false);
  const [retryingEmployee, setRetryingEmployee] = useState<string | null>(null);

  // РОЛИ ДЛЯ АУДИТОРСКОЙ КОМПАНИИ (СООТВЕТСТВУЮТ PROJECT_ROLES)
  const roles = [
    { value: 'partner', label: 'Партнер' },
    { value: 'manager_1', label: 'Менеджер 1' },
    { value: 'manager_2', label: 'Менеджер 2' },
    { value: 'manager_3', label: 'Менеджер 3' },
    { value: 'supervisor_3', label: 'Супервайзер 3' },
    { value: 'supervisor_2', label: 'Супервайзер 2' },
    { value: 'supervisor_1', label: 'Супервайзер 1' },
    { value: 'tax_specialist_1', label: 'Налоговый специалист 1' },
    { value: 'tax_specialist_2', label: 'Налоговый специалист 2' },
    { value: 'assistant_3', label: 'Ассистент 3' },
    { value: 'assistant_2', label: 'Ассистент 2' },
    { value: 'assistant_1', label: 'Ассистент 1' },
    { value: 'contractor', label: 'ГПХ (Подрядчик)' },
    { value: 'hr', label: 'HR специалист' },
    { value: 'accountant', label: 'Бухгалтер' },
    { value: 'admin', label: 'Администратор' }
  ];

  // Категории сотрудников
  const categories = [
    { value: 'auditors', label: 'Аудиторы' },
    { value: 'other', label: 'Другая' },
  ];

  // РОЛИ ДЛЯ РУКОВОДСТВА (ДОПОЛНИТЕЛЬНЫЕ)
  const leadershipRoles = [
    { value: 'partner', label: 'Генеральный директор' },
    { value: 'deputy_director', label: 'Заместитель директора' }
  ];

  // МАППИНГ РУССКИХ НАЗВАНИЙ НА СУЩЕСТВУЮЩИЕ ENUM ЗНАЧЕНИЯ
  const roleMapping: Record<string, string> = {
    // Руководство
    'Генеральный директор': 'partner',
    'Генеральный Директор': 'partner',
    'Ген. директор': 'partner',
    'Заместитель директора': 'deputy_director',
    'Заместитель Директора': 'deputy_director',
    'Зам. директора': 'deputy_director',
    'Зам. Директора': 'deputy_director',
    // Основные роли
    'Партнер': 'partner',
    'Партнёр': 'partner',
    'Менеджер 1': 'manager_1',
    'Менеджер 2': 'manager_2',
    'Менеджер 3': 'manager_3',
    'Руководитель проекта': 'manager_1',
    'РП': 'manager_1',
    'Супервайзер 3': 'supervisor_3',
    'Супервайзер 2': 'supervisor_2',
    'Супервайзер 1': 'supervisor_1',
    'Супервайзер 3 уровня': 'supervisor_3',
    'Супервайзер 2 уровня': 'supervisor_2',
    'Супервайзер 1 уровня': 'supervisor_1',
    'Специалист по Налогам 1': 'tax_specialist_1',
    'Специалист по Налогам 2': 'tax_specialist_2',
    'Налоговик 1': 'tax_specialist_1',
    'Налоговик 2': 'tax_specialist_2',
    'Налоговик 1 уровня': 'tax_specialist_1',
    'Налоговик 2 уровня': 'tax_specialist_2',
    'Ассистент 3': 'assistant_3',
    'Ассистент 2': 'assistant_2',
    'Ассистент 1': 'assistant_1',
    'Ассистент 3 уровня': 'assistant_3',
    'Ассистент 2 уровня': 'assistant_2',
    'Ассистент 1 уровня': 'assistant_1',
    'ГПХ': 'contractor',
    // Дополнительные варианты
    'Менеджер': 'manager_1',
    'Админ': 'admin',
    'Сотрудник': 'contractor'
  };

  // СПИСОК КОМПАНИЙ
  const companies = [
    { value: 'rb_partners', label: 'RB Partners' },
    { value: 'rb_audit', label: 'RB Audit' },
    { value: 'rb_consulting', label: 'RB Consulting' },
    { value: 'rb_legal', label: 'RB Legal' },
    { value: 'rb_tax', label: 'RB Tax' }
  ];

  const isAdmin = user?.role === 'admin' || user?.role === 'ceo';
  const isManagement = user?.role === 'ceo' || user?.role === 'deputy_director';

  // Фильтрация сотрудников
  const filteredEmployees = employees.filter((emp: any) => {
    const matchesSearch = emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = filterDepartment === "all" || emp.department === filterDepartment;
    const matchesRole = filterRole === "all" || emp.role === filterRole;
    return matchesSearch && matchesDept && matchesRole;
  });

  // Получаем уникальные отделы и роли
  const uniqueDepartments = Array.from(new Set(employees.map((e: any) => e.department).filter(Boolean)));
  const uniqueRoles = Array.from(new Set(employees.map((e: any) => e.role).filter(Boolean)));

  // Добавление сотрудника
  const handleAddEmployee = async () => {
    if (isAddingEmployee) return; // Предотвращаем повторные нажатия
    
    setIsAddingEmployee(true);
    
    try {
      // Генерируем временный пароль
      const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase();
      
      // Создаем сотрудника
      const finalRole = newEmployee.category === 'auditors' 
        ? newEmployee.role 
        : (newEmployee.customRole || 'employee');

      await supabaseDataStore.createEmployee({
        name: newEmployee.name,
        email: newEmployee.email,
        role: finalRole,
        level: '1', // По умолчанию уровень 1
        whatsapp: newEmployee.phone || '',
        department: newEmployee.category === 'auditors' ? 'Аудит' : (newEmployee.department || newEmployee.category),
        position: newEmployee.subcategory || newEmployee.position || '',
        phone: newEmployee.phone,
        companyId: newEmployee.company,
        password: tempPassword
      });
      
      await refresh();
      
      // Пытаемся отправить email (не критично, если не настроен SMTP)
      try {
        const emailResult = await sendWelcomeEmail(
          newEmployee.name, 
          newEmployee.email, 
          tempPassword
        );
        
        if (emailResult.success) {
          toast({
            title: "✅ Успех!",
            description: `Сотрудник добавлен. Email с паролем отправлен на ${newEmployee.email}`,
          });
        } else {
          // SMTP не настроен - показываем пароль в toast
          toast({
            title: "⚠️ Сотрудник добавлен",
            description: `Email не отправлен (настройте SMTP).\n\nПАРОЛЬ: ${tempPassword}\n\n📋 Нажмите на пароль чтобы скопировать!`,
            duration: Infinity, // Не закрывается автоматически!
            action: (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(tempPassword);
                  toast({
                    title: "✅ Скопировано!",
                    description: "Пароль скопирован в буфер обмена",
                    duration: 2000
                  });
                }}
              >
                📋 Копировать пароль
              </Button>
            )
          });
        }
      } catch (emailError) {
        // Если ошибка отправки - не проблема, показываем пароль
        toast({
          title: "⚠️ Сотрудник добавлен",
          description: `Email не отправлен.\n\nПАРОЛЬ: ${tempPassword}\n\n📋 Нажмите на пароль чтобы скопировать!`,
          duration: Infinity, // Не закрывается автоматически!
          action: (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(tempPassword);
                toast({
                  title: "✅ Скопировано!",
                  description: "Пароль скопирован в буфер обмена",
                  duration: 2000
                });
              }}
            >
              📋 Копировать пароль
            </Button>
          )
        });
      }
      
      setIsAddDialogOpen(false);
      setNewEmployee({ name: "", email: "", company: "", role: "", phone: "", department: "", position: "", category: 'auditors', subcategory: "", customRole: "" });
      
    } catch (error: any) {
      console.error('Error adding employee:', error);
      toast({
        title: "Ошибка",
        description: error?.message || "Не удалось добавить сотрудника",
        variant: "destructive",
      });
    } finally {
      setIsAddingEmployee(false);
    }
  };

  // Редактирование сотрудника
  const handleEditEmployee = async () => {
    if (!editEmployee.id) return;

    try {
      const finalRole = editEmployee.category === 'auditors'
        ? editEmployee.role
        : (editEmployee.customRole || 'employee');

      await supabaseDataStore.updateEmployee(editEmployee.id, {
        name: editEmployee.name,
        email: editEmployee.email,
        role: finalRole,
        whatsapp: editEmployee.phone || '',
        department: editEmployee.category === 'auditors' ? 'Аудит' : (editEmployee.department || editEmployee.category),
        position: editEmployee.subcategory || editEmployee.position || '',
        phone: editEmployee.phone,
        companyId: editEmployee.company,
      });

      await refresh();

      toast({
        title: "✅ Успех!",
        description: `Сотрудник ${editEmployee.name} обновлён`,
      });

      setIsEditDialogOpen(false);
      setEditEmployee({
        id: "", name: "", email: "", company: "", role: "", phone: "",
        department: "", position: "", category: "auditors", subcategory: "", customRole: ""
      });

    } catch (error: any) {
      console.error('Error updating employee:', error);
      toast({
        title: "Ошибка",
        description: error?.message || "Не удалось обновить сотрудника",
        variant: "destructive",
      });
    }
  };

  // Удаление сотрудника (только для админа)
  const handleDeleteEmployee = async () => {
    if (!isAdmin) {
      toast({
        title: "Доступ запрещен",
        description: "Только администратор может удалять сотрудников",
        variant: "destructive",
      });
      return;
    }

    try {
      await supabaseDataStore.deleteEmployee(selectedEmployee.id);
      await refresh();
      setIsDeleteDialogOpen(false);
      setSelectedEmployee(null);
      toast({
        title: "Успех!",
        description: "Сотрудник удален",
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить сотрудника",
        variant: "destructive",
      });
    }
  };

  // Скачать шаблон Excel
  const handleDownloadTemplate = () => {
    const template = [
      {
        "ФИО": "Иванов Иван Иванович",
        "Имя": "Иванов Иван Иванович", // Альтернативное название
        "Email": "ivanov@company.kz",
        "Роль": "Партнер", // Может быть на русском
        "Должность": "Специалист",
        "Отдел": "IT",
        "Телефон": "+7 777 123 4567"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Сотрудники");
    XLSX.writeFile(wb, "template_employees.xlsx");

    toast({
      title: "Шаблон скачан",
      description: "Заполните шаблон и импортируйте обратно",
    });
  };

  // Импорт из Excel
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportProgress(0);
    setImportResults([]);
    setShowImportResults(false);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        let successCount = 0;
        const importedEmployees: Array<{id: string, name: string, email: string, tempPassword: string}> = [];
        const results: Array<{name: string, email: string, status: 'success' | 'error', message: string}> = [];
        
        // Обрабатываем каждого сотрудника
        for (let i = 0; i < data.length; i++) {
          const row: any = data[i];
          
          // Ищем ФИО в разных вариантах названий колонок (с учетом регистра и пробелов)
          // Получаем все ключи колонок и их значения
          const allKeys = Object.keys(row);
          const allValues = Object.values(row).map(v => v?.toString().trim() || '').filter(v => v.length > 0);
          
          // Приоритетный список названий колонок для ФИО
          const namePriorityList = [
            'фио', 'имя', 'name', 'fullname', 'full_name', 'фамилия имя отчество',
            'фио сотрудника', 'имя сотрудника', 'полное имя', 'full name',
            'фамилия', 'surname', 'lastname', 'last name',
            'сотрудник', 'employee name', 'имя и фамилия'
          ];
          
          // Ищем колонку по приоритету
          let employeeName = '';
          let foundKey = '';
          
          // 1. Ищем точное совпадение (с учетом регистра и пробелов)
          for (const key of allKeys) {
            const lowerKey = key.toLowerCase().trim();
            if (namePriorityList.some(priority => lowerKey === priority || lowerKey.includes(priority))) {
              const value = row[key]?.toString().trim();
              if (value && value.length > 0 && value !== 'undefined' && value !== 'null') {
                employeeName = value;
                foundKey = key;
                break;
              }
            }
          }
          
          // 2. Если не нашли - ищем по частичному совпадению
          if (!employeeName) {
            for (const key of allKeys) {
              const lowerKey = key.toLowerCase().trim();
              if (lowerKey.includes('фио') || lowerKey.includes('имя') || lowerKey.includes('name')) {
                if (!lowerKey.includes('email') && !lowerKey.includes('почта') && !lowerKey.includes('mail')) {
                  const value = row[key]?.toString().trim();
                  if (value && value.length > 0 && value !== 'undefined' && value !== 'null') {
                    employeeName = value;
                    foundKey = key;
                    break;
                  }
                }
              }
            }
          }
          
          // 3. Если все еще не нашли - пробуем найти колонку с самым длинным текстовым значением (скорее всего это ФИО)
          if (!employeeName && allValues.length > 0) {
            // Ищем самое длинное значение, которое похоже на имя (содержит пробелы, буквы)
            const longestValue = allValues
              .filter(v => v.length > 3 && /[а-яА-Яa-zA-Z]/.test(v) && v.includes(' '))
              .sort((a, b) => b.length - a.length)[0];
            
            if (longestValue) {
              // Находим ключ для этого значения
              for (const key of allKeys) {
                if (row[key]?.toString().trim() === longestValue) {
                  employeeName = longestValue;
                  foundKey = key;
                  break;
                }
              }
            }
          }
          
          // 4. Если все еще не нашли - пробуем стандартные варианты
          if (!employeeName) {
            const standardKeys = ['ФИО', 'Имя', 'Name', 'Фамилия Имя Отчество', 'fullName', 'Full Name'];
            for (const key of standardKeys) {
              const value = row[key]?.toString().trim();
              if (value && value.length > 0) {
                employeeName = value;
                foundKey = key;
                break;
              }
            }
          }
          
          // 5. Последний fallback - используем первую непустую текстовую колонку (кроме email)
          if (!employeeName) {
            for (const key of allKeys) {
              const lowerKey = key.toLowerCase().trim();
              if (!lowerKey.includes('email') && !lowerKey.includes('почта') && 
                  !lowerKey.includes('mail') && !lowerKey.includes('телефон') && 
                  !lowerKey.includes('phone') && !lowerKey.includes('роль') && 
                  !lowerKey.includes('role') && !lowerKey.includes('отдел') && 
                  !lowerKey.includes('department') && !lowerKey.includes('должность') && 
                  !lowerKey.includes('position')) {
                const value = row[key]?.toString().trim();
                if (value && value.length > 2 && /[а-яА-Яa-zA-Z]/.test(value)) {
                  employeeName = value;
                  foundKey = key;
                  break;
                }
              }
            }
          }
          
          // Если все еще пусто - используем fallback
          if (!employeeName || employeeName === '') {
            employeeName = `Сотрудник ${i + 1}`;
          }
          
          // Ищем email
          const emailKeys = Object.keys(row).filter(key => {
            const lowerKey = key.toLowerCase().trim();
            return lowerKey === 'email' || lowerKey.includes('email') || lowerKey === 'почта' || lowerKey === 'e-mail';
          });
          
          let employeeEmail = '';
          if (emailKeys.length > 0) {
            employeeEmail = row[emailKeys[0]]?.toString().trim() || '';
          }
          if (!employeeEmail) {
            employeeEmail = (row['Email'] || row['email'] || row['Email '] || '').toString().trim();
          }
          
          console.log(`📋 Импорт строки ${i + 1}:`, {
            доступныеКолонки: allKeys,
            найденнаяКолонкаИмени: foundKey || 'не найдено',
            найденныеКолонкиEmail: emailKeys,
            найденноеИмя: employeeName,
            найденныйEmail: employeeEmail,
            всеЗначения: allValues,
            всеДанные: row
          });
          
          // Если имя не найдено - предупреждаем с подробной информацией
          if (!employeeName || employeeName === `Сотрудник ${i + 1}` || employeeName.trim() === '') {
            console.warn(`⚠️ Строка ${i + 1}: ФИО не найдено!`, {
              доступныеКолонки: allKeys,
              всеЗначения: allValues,
              всеДанные: row
            });
          }
          
          try {
            const russianRole = row['Роль'] || row['Role'] || row['role'] || 'employee';
            let mappedRole = roleMapping[russianRole] || 'employee';
            
            // Если роль не определилась, но это не employee - используем employee как fallback
            // Это предотвратит ошибки при создании
            const validRoles = ['partner', 'manager_1', 'manager_2', 'manager_3', 'supervisor_3', 'supervisor_2', 'supervisor_1', 
                               'tax_specialist_1', 'tax_specialist_2', 'assistant_3', 'assistant_2', 'assistant_1',
                               'contractor', 'hr', 'accountant', 'admin', 'manager', 'employee', 'it_admin',
                               'assistant', 'tax_specialist', 'designer', 'it_auditor', 'ceo', 'deputy_director'];
            
            if (!validRoles.includes(mappedRole)) {
              console.warn(`⚠️ Роль "${mappedRole}" не найдена в ENUM, используем "employee"`);
              mappedRole = 'employee';
            }
            
            const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase();
            
            // Проверяем что имя не пустое
            if (!employeeName || employeeName.trim() === '' || employeeName === `Сотрудник ${i + 1}`) {
              const availableColumns = Object.keys(row).join(', ');
              throw new Error(`ФИО не найдено в строке ${i + 1}. Доступные колонки: ${availableColumns}. Проверьте названия колонок в Excel.`);
            }
            
            const created = await supabaseDataStore.createEmployee({
              name: employeeName.trim(), // Используем найденное имя (обязательно обрезаем пробелы)
              email: employeeEmail.trim(),
              role: mappedRole,
              level: '1', // По умолчанию уровень 1
              whatsapp: (row['Телефон'] || row['Phone'] || row['phone'] || '').toString().trim(),
              position: (row['Должность'] || row['Position'] || row['position'] || '').toString().trim(),
              department: (row['Отдел'] || row['Department'] || row['department'] || '').toString().trim(),
              phone: (row['Телефон'] || row['Phone'] || row['phone'] || '').toString().trim(),
              password: tempPassword
            });
            
            // Добавляем в массив для рассылки
            importedEmployees.push({
              id: created.id,
              name: employeeName,
              email: employeeEmail,
              tempPassword: tempPassword
            });
            
            // Если роль не определилась (осталась employee) - оставляем пустой для ручного выбора
            const finalRole = mappedRole !== 'employee' && mappedRole !== 'contractor' ? mappedRole : undefined;
            
            const result: typeof importResults[0] = {
              name: employeeName.trim(), // Сохраняем обрезанное имя
              email: employeeEmail.trim(),
              status: 'success' as const,
              message: 'Успешно добавлен',
              originalRole: finalRole, // Только если определилась
              correctedRole: mappedRole,
              employeeId: created.id,
              editableCategory: 'auditors',
              editableRole: finalRole, // Если роль не определилась - undefined для ручного выбора
              editableDepartment: (row['Отдел'] || row['Department'] || row['department'] || '').toString().trim(),
              editableCustomRole: '',
              editableSubcategory: (row['Должность'] || row['Position'] || row['position'] || '').toString().trim()
            };
            results.push(result);
            
            successCount++;
          } catch (err: any) {
            console.error('Ошибка добавления сотрудника:', err);
            results.push({
              name: employeeName,
              email: employeeEmail,
              status: 'error',
              message: err?.message || 'Ошибка создания записи'
            });
          }
          
          // Обновляем прогресс
          setImportProgress(Math.round(((i + 1) / data.length) * 50)); // 50% за создание сотрудников
        }

        // Рассылка email всем добавленным сотрудникам
        let emailSentCount = 0;
        if (importedEmployees.length > 0) {
          for (let i = 0; i < importedEmployees.length; i++) {
            const employee = importedEmployees[i];
            try {
              const emailResult = await sendWelcomeEmail(employee.name, employee.email, employee.tempPassword);
              if (emailResult.success) {
                emailSentCount++;
                // Обновляем результат для успешной отправки email
                const resultIndex = results.findIndex(r => r.email === employee.email);
                if (resultIndex !== -1) {
                  results[resultIndex].message += ' + Email отправлен';
                }
              } else {
                const resultIndex = results.findIndex(r => r.email === employee.email);
                if (resultIndex !== -1) {
                  results[resultIndex].message += ' + Email не отправлен';
                }
              }
            } catch (emailError) {
              console.error(`Не удалось отправить email для ${employee.email}:`, emailError);
              const resultIndex = results.findIndex(r => r.email === employee.email);
              if (resultIndex !== -1) {
                results[resultIndex].message += ' + Email не отправлен';
              }
            }
            
            // Обновляем прогресс для email
            setImportProgress(50 + Math.round(((i + 1) / importedEmployees.length) * 50));
          }
        }

        setImportResults(results);
        setShowImportResults(true);
        await refresh();
        
        toast({
          title: "Импорт завершен!",
          description: `Добавлено сотрудников: ${successCount} из ${data.length}. Email отправлен: ${emailSentCount} из ${importedEmployees.length}`,
        });
      } catch (error) {
        toast({
          title: "Ошибка импорта",
          description: "Проверьте формат файла",
          variant: "destructive",
        });
      } finally {
        setIsImporting(false);
        setImportProgress(100);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Повторное добавление сотрудника с исправленной ролью
  const handleRetryEmployee = async (employeeEmail: string, correctedRole: string) => {
    setRetryingEmployee(employeeEmail);
    
    try {
      // Находим сотрудника в результатах
      const employee = importResults.find(r => r.email === employeeEmail);
      if (!employee) return;

      const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase();
      
      // Создаем сотрудника с исправленной ролью
      await supabaseDataStore.createEmployee({
        name: employee.name,
        email: employee.email,
        role: correctedRole,
        level: '1', // По умолчанию уровень 1
        whatsapp: (employee as any).phone || '',
        position: '',
        department: '',
        phone: '',
        password: tempPassword
      });

      // Отправляем email
      try {
        await sendWelcomeEmail(employee.name, employee.email, tempPassword);
      } catch (emailError) {
        console.error(`Не удалось отправить email для ${employee.email}:`, emailError);
      }

      // Обновляем результат
      setImportResults(prev => prev.map(r => 
        r.email === employeeEmail 
          ? { ...r, status: 'success', message: 'Успешно добавлен (исправлено)', correctedRole }
          : r
      ));

      await refresh();
      
      toast({
        title: "Сотрудник добавлен!",
        description: `${employee.name} успешно добавлен с исправленной ролью`,
      });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error?.message || "Не удалось добавить сотрудника",
        variant: "destructive",
      });
    } finally {
      setRetryingEmployee(null);
    }
  };

  // Обновление роли/категории для успешно импортированного сотрудника
  const handleUpdateImported = async (res: any) => {
    if (!res.employeeId) {
      toast({ title: 'Ошибка', description: 'ID сотрудника не найден', variant: 'destructive' });
      return;
    }
    
    if (!res.editableRole && (res.editableCategory || 'auditors') === 'auditors') {
      toast({ title: 'Ошибка', description: 'Необходимо выбрать роль', variant: 'destructive' });
      return;
    }
    
    try {
      const isAuditor = (res.editableCategory || 'auditors') === 'auditors';
      const updates: any = {
        role: isAuditor ? (res.editableRole || 'employee') : (res.editableCustomRole || 'employee'),
        department: isAuditor ? 'Аудит' : (res.editableDepartment || ''),
        position: res.editableSubcategory || ''
      };
      await supabaseDataStore.updateEmployee(res.employeeId, updates);
      setImportResults(prev => prev.map(r => r.email === res.email ? { ...r, ...res, message: 'Обновлено' } : r));
      toast({ title: 'Обновлено', description: `${res.name}: роль и категория сохранены` });
      await refresh(); // Обновляем список сотрудников
    } catch (e: any) {
      toast({ title: 'Ошибка обновления', description: e?.message || 'Не удалось обновить', variant: 'destructive' });
    }
  };

  // Экспорт в Excel
  const handleExportExcel = () => {
    const exportData = employees.map((emp: any) => ({
      "Имя": emp.name,
      "Email": emp.email,
      "Роль": emp.role,
      "Должность": emp.position,
      "Отдел": emp.department,
      "Телефон": emp.phone,
      "Дата добавления": emp.created_at ? new Date(emp.created_at).toLocaleDateString() : ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Сотрудники");
    XLSX.writeFile(wb, `employees_${new Date().toISOString().split('T')[0]}.xlsx`);

    toast({
      title: "Экспорт завершен",
      description: `Экспортировано сотрудников: ${employees.length}`,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Загрузка сотрудников...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">👥 Управление персоналом</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Центр управления сотрудниками</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Шаблон</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => document.getElementById('excel-import')?.click()}>
            <Upload className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Импорт</span>
          </Button>
          <input
            id="excel-import"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleImportExcel}
            style={{ display: 'none' }}
          />
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Экспорт</span>
          </Button>
          <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Добавить</span>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="employees" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="employees" className="flex items-center space-x-2">
            <Users className="w-4 h-4" />
            <span>Сотрудники</span>
          </TabsTrigger>
          {isManagement && (
            <TabsTrigger value="analytics" className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4" />
              <span>Аналитика</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="employees" className="space-y-6">
          {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-primary" />
            <div>
              <p className="text-2xl font-bold">{employees.length}</p>
              <p className="text-sm text-muted-foreground">Всего сотрудников</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <Briefcase className="w-5 h-5 text-success" />
            <div>
              <p className="text-2xl font-bold">{uniqueDepartments.length}</p>
              <p className="text-sm text-muted-foreground">Отделов</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-warning" />
            <div>
              <p className="text-2xl font-bold">{filteredEmployees.length}</p>
              <p className="text-sm text-muted-foreground">Найдено</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <div>
              <p className="text-2xl font-bold">
                {user?.role === 'ceo' ? 'CEO' : 
                 user?.role === 'deputy_director' ? 'Зам. директора' :
                 user?.role === 'partner' ? 'Партнёр' :
                 user?.role === 'manager_1' || user?.role === 'manager_2' || user?.role === 'manager_3' ? 'Менеджер' :
                 user?.role === 'procurement' ? 'Закупки' :
                 user?.role === 'admin' ? 'Админ' : 'Пользователь'}
              </p>
              <p className="text-sm text-muted-foreground">Ваша роль</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input 
              placeholder="Поиск по имени или email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterDepartment} onValueChange={setFilterDepartment}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Отдел" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все отделы</SelectItem>
              {uniqueDepartments.map((dept: string) => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Роль" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все роли</SelectItem>
              {uniqueRoles.map((role: string) => (
                <SelectItem key={role} value={role}>{role}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Employee List */}
      {filteredEmployees.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map((employee: any) => (
            <Card key={employee.id} className="p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                    <span className="text-lg font-bold text-primary">
                      {employee.name ? employee.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2) : 'UN'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold">{employee.name || 'Без имени'}</h3>
                    <p className="text-sm text-muted-foreground">{employee.position || employee.role}</p>
                    </div>
                  </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        // Заполняем форму редактирования данными сотрудника
                        const isAuditor = ['partner','manager_1','manager_2','manager_3','supervisor_3','supervisor_2','supervisor_1','tax_specialist_1','tax_specialist_2','assistant_3','assistant_2','assistant_1'].includes(employee.role);
                        setEditEmployee({
                          id: employee.id,
                          name: employee.name || '',
                          email: employee.email || '',
                          company: employee.company || '',
                          role: isAuditor ? employee.role : '',
                          phone: employee.phone || '',
                          department: employee.department || '',
                          position: employee.position || '',
                          category: isAuditor ? 'auditors' : 'other',
                          subcategory: employee.position || '',
                          customRole: isAuditor ? '' : employee.role,
                        });
                        setIsEditDialogOpen(true);
                      }}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedEmployee(employee);
                        setIsDeleteDialogOpen(true);
                      }}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
        </div>
              <div className="mt-4 space-y-2">
                {employee.email && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Mail className="w-4 h-4 mr-2" />
                    {employee.email}
                  </div>
                  )}
                {employee.phone && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Phone className="w-4 h-4 mr-2" />
                    {employee.phone}
                    </div>
                  )}
                {employee.department && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Briefcase className="w-4 h-4 mr-2" />
                    {employee.department}
                    </div>
                  )}
                </div>
                  </Card>
                          ))}
                  </div>
      ) : (
        <Card className="p-12 text-center">
          <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2">Нет сотрудников</h3>
          <p className="text-muted-foreground mb-6">
            Добавьте сотрудников вручную или импортируйте из Excel
          </p>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Добавить первого сотрудника
          </Button>
            </Card>
      )}
        </TabsContent>

        {isManagement && (
          <TabsContent value="analytics" className="space-y-6">
            {/* Analytics Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Employee Stats */}
              <Card className="p-6">
                <div className="flex items-center space-x-3">
                  <Users className="w-8 h-8 text-primary" />
                          <div>
                    <h3 className="text-lg font-semibold">Сотрудники по компаниям</h3>
                    <div className="mt-4 space-y-2">
                      {companies.map(company => {
                        const count = employees.filter((emp: any) => emp.company === company.value).length;
                        return (
                          <div key={company.value} className="flex justify-between">
                            <span className="text-sm">{company.label}</span>
                            <Badge variant="secondary">{count}</Badge>
                  </div>
                        );
                      })}
                    </div>
                    </div>
                  </div>
                </Card>

              {/* Project Load */}
              <Card className="p-6">
                <div className="flex items-center space-x-3">
                  <Target className="w-8 h-8 text-success" />
                  <div>
                    <h3 className="text-lg font-semibold">Загрузка по проектам</h3>
                    <div className="mt-4 space-y-2">
                      {projects.slice(0, 5).map((project: any) => (
                        <div key={project.id} className="flex justify-between">
                          <span className="text-sm truncate">{project.name}</span>
                          <Badge variant="outline">{project.status}</Badge>
                </div>
                      ))}
              </div>
                    </div>
                    </div>
              </Card>

              {/* Performance */}
              <Card className="p-6">
                <div className="flex items-center space-x-3">
                  <TrendingUp className="w-8 h-8 text-warning" />
                  <div>
                    <h3 className="text-lg font-semibold">Эффективность</h3>
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Активных проектов</span>
                        <Badge variant="secondary">{projects.filter((p: any) => p.status === 'in_progress').length}</Badge>
                        </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Завершенных</span>
                        <Badge variant="secondary">{projects.filter((p: any) => p.status === 'completed').length}</Badge>
                        </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Всего сотрудников</span>
                        <Badge variant="secondary">{employees.length}</Badge>
                      </div>
                        </div>
                        </div>
                      </div>
            </Card>
                    </div>

            {/* Detailed Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Роли сотрудников</h3>
                <div className="space-y-3">
                  {roles.map(role => {
                    const count = employees.filter((emp: any) => emp.role === role.value).length;
                    if (count === 0) return null;
                  return (
                      <div key={role.value} className="flex items-center justify-between">
                        <span className="text-sm">{role.label}</span>
                      <div className="flex items-center space-x-2">
                          <div className="w-20 bg-secondary rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full" 
                              style={{ width: `${(count / employees.length) * 100}%` }}
                            ></div>
                      </div>
                          <span className="text-sm font-medium">{count}</span>
                    </div>
                    </div>
                  );
                })}
              </div>
            </Card>
            
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Статусы проектов</h3>
                        <div className="space-y-3">
                  {['in_progress', 'completed', 'on_hold', 'cancelled'].map(status => {
                    const count = projects.filter((p: any) => p.status === status).length;
                    if (count === 0) return null;
                    const statusLabels: Record<string, string> = {
                      'in_progress': 'В работе',
                      'completed': 'Завершен',
                      'on_hold': 'Приостановлен',
                      'cancelled': 'Отменен'
                    };
                  return (
                    <div key={status} className="flex items-center justify-between">
                        <span className="text-sm">{statusLabels[status]}</span>
                      <div className="flex items-center space-x-2">
                          <div className="w-20 bg-secondary rounded-full h-2">
                            <div 
                              className="bg-success h-2 rounded-full" 
                              style={{ width: `${(count / projects.length) * 100}%` }}
                            ></div>
                              </div>
                          <span className="text-sm font-medium">{count}</span>
                              </div>
                            </div>
                  );
                })}
                        </div>
            </Card>
                      </div>
        </TabsContent>
        )}
      </Tabs>

      {/* Import Progress Dialog */}
      <Dialog open={isImporting} onOpenChange={() => {}}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
              <span>Импорт сотрудников</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Прогресс</span>
                <span>{importProgress}%</span>
                          </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${importProgress}%` }}
                ></div>
                        </div>
                      </div>
            <p className="text-sm text-muted-foreground text-center">
              {importProgress < 50 ? 'Создание сотрудников...' : 'Отправка email...'}
            </p>
                  </div>
        </DialogContent>
      </Dialog>

      {/* Import Results Dialog */}
      <Dialog open={showImportResults} onOpenChange={setShowImportResults}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-success" />
              <span>Результаты импорта</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Статистика */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-success" />
                  <div>
                    <p className="text-2xl font-bold text-success">
                      {importResults.filter(r => r.status === 'success').length}
                    </p>
                    <p className="text-sm text-muted-foreground">Успешно добавлено</p>
                  </div>
                  </div>
                </Card>
              <Card className="p-4">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="text-2xl font-bold text-destructive">
                      {importResults.filter(r => r.status === 'error').length}
                    </p>
                    <p className="text-sm text-muted-foreground">Ошибки</p>
          </div>
                </div>
              </Card>
              </div>
              
            {/* Список результатов */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {importResults.map((result, index) => (
                <div 
                  key={index}
                  className={`p-4 rounded-lg border ${
                    result.status === 'success' 
                      ? 'bg-success/10 border-success/20' 
                      : 'bg-destructive/10 border-destructive/20'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {result.status === 'success' ? (
                        <CheckCircle className="h-5 w-5 text-success" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-destructive" />
                      )}
                      </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium">{result.name}</p>
                          <p className="text-sm text-muted-foreground">{result.email}</p>
                      </div>
                        <Badge 
                          variant={result.status === 'success' ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {result.status === 'success' ? 'Успех' : 'Ошибка'}
                        </Badge>
                    </div>
                      
                      {/* Управление для успешных записей */}
                      {result.status === 'success' && (
                        <div className="space-y-3 mb-2">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <Label className="text-xs">Категория</Label>
                              <Select
                                value={result.editableCategory || 'auditors'}
                                onValueChange={(v) => setImportResults(prev => prev.map(r => r.email === result.email ? { ...r, editableCategory: v as any } : r))}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="auditors">Аудиторы</SelectItem>
                                  <SelectItem value="other">Другая</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {(result.editableCategory || 'auditors') === 'auditors' ? (
                              <div>
                                <Label className="text-xs">Роль</Label>
                                <Select
                                  value={result.editableRole || ''}
                                  onValueChange={(v) => setImportResults(prev => prev.map(r => r.email === result.email ? { ...r, editableRole: v } : r))}
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder={result.editableRole ? undefined : "Выберите роль"} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {roles.filter(r => ['partner','manager_1','manager_2','manager_3','supervisor_3','supervisor_2','supervisor_1','tax_specialist_1','tax_specialist_2','assistant_3','assistant_2','assistant_1'].includes(r.value)).map(role => (
                                      <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ) : (
                              <>
                                <div>
                                  <Label className="text-xs">Категория</Label>
                                  <Input className="h-8" value={result.editableDepartment || ''} onChange={(e) => setImportResults(prev => prev.map(r => r.email === result.email ? { ...r, editableDepartment: e.target.value } : r))} placeholder="Отдел" />
                                </div>
                                <div>
                                  <Label className="text-xs">Роль</Label>
                                  <Input className="h-8" value={result.editableCustomRole || ''} onChange={(e) => setImportResults(prev => prev.map(r => r.email === result.email ? { ...r, editableCustomRole: e.target.value } : r))} placeholder="Роль" />
                                </div>
                              </>
                            )}
                            <div>
                              <Label className="text-xs">Подкатегория</Label>
                              <Input className="h-8" value={result.editableSubcategory || ''} onChange={(e) => setImportResults(prev => prev.map(r => r.email === result.email ? { ...r, editableSubcategory: e.target.value } : r))} placeholder="например, IT-аудит" />
                            </div>
                          </div>
                          <div>
                            <Button size="sm" variant="outline" onClick={() => handleUpdateImported(result)} disabled={!result.employeeId}>Сохранить изменения</Button>
                          </div>
                        </div>
                      )}

                      {/* Детали для ошибок с возможностью исправления */}
                      {result.status === 'error' && (
                        <div className="space-y-3">
                          <div className="text-sm text-muted-foreground">
                            <span className="font-medium">Ошибка:</span> {result.message}
                      </div>
                      
                          {/* Выбор роли для исправления */}
                          <div className="flex items-center space-x-2">
                            <Select
                              value={result.correctedRole || ''}
                              onValueChange={(value) => {
                                setImportResults(prev => prev.map(r => 
                                  r.email === result.email 
                                    ? { ...r, correctedRole: value, canRetry: true }
                                    : r
                                ));
                              }}
                            >
                              <SelectTrigger className="w-48">
                                <SelectValue placeholder="Выберите роль" />
                              </SelectTrigger>
                              <SelectContent>
                                {roles.map(role => (
                                  <SelectItem key={role.value} value={role.value}>
                                    {role.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            
                      <Button 
                        size="sm" 
                              onClick={() => result.correctedRole && handleRetryEmployee(result.email, result.correctedRole)}
                              disabled={!result.correctedRole || retryingEmployee === result.email}
                            >
                              {retryingEmployee === result.email ? (
                                <>
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                                  Добавление...
                                </>
                              ) : (
                                'Добавить'
                              )}
                      </Button>
                    </div>
              </div>
                      )}
                        </div>
                      </div>
                    </div>
              ))}
              </div>

            {/* Детали ошибок */}
            {importResults.some(r => r.status === 'error') && (
              <div className="space-y-2">
                <h4 className="font-semibold text-destructive">Детали ошибок:</h4>
                <div className="space-y-1">
                  {importResults
                    .filter(r => r.status === 'error')
                    .map((result, index) => (
                      <div key={index} className="text-sm text-muted-foreground">
                        <span className="font-medium">{result.name}:</span> {result.message}
                        </div>
                    ))
                  }
                      </div>
                    </div>
            )}
              </div>
          <DialogFooter>
            <Button onClick={() => setShowImportResults(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Employee Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить сотрудника</DialogTitle>
          </DialogHeader>
              <div className="space-y-4">
            <div>
              <Label>Имя *</Label>
              <Input
                value={newEmployee.name}
                onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                placeholder="Иванов Иван Иванович"
                          />
                </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={newEmployee.email}
                onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                placeholder="ivanov@company.kz"
                          />
              </div>
            <div>
              <Label>Компания</Label>
              <Select
                value={newEmployee.company}
                onValueChange={(value) => setNewEmployee({ ...newEmployee, company: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите компанию" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map(company => (
                    <SelectItem key={company.value} value={company.value}>
                      {company.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
                </div>
            <div>
              <Label>Категория</Label>
              <Select
                value={newEmployee.category}
                onValueChange={(value) => setNewEmployee({ ...newEmployee, category: value, role: '', customRole: '', subcategory: '', department: '' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите категорию" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {newEmployee.category === 'auditors' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Роль (Аудиторы)</Label>
                  <Select
                    value={newEmployee.role}
                    onValueChange={(value) => setNewEmployee({ ...newEmployee, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Партнёр, РП, Супервайзер, ..." />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.filter(r => ['partner','manager_1','manager_2','manager_3','supervisor_3','supervisor_2','supervisor_1','tax_specialist_1','tax_specialist_2','assistant_3','assistant_2','assistant_1'].includes(r.value)).map(role => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Подкатегория (опционально)</Label>
                  <Input
                    placeholder="Например: Аудит, IT-аудит"
                    value={newEmployee.subcategory}
                    onChange={(e) => setNewEmployee({ ...newEmployee, subcategory: e.target.value })}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Новая категория</Label>
                    <Input
                      placeholder="Например: Отдел продаж"
                      value={newEmployee.department}
                      onChange={(e) => setNewEmployee({ ...newEmployee, department: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Подкатегория</Label>
                    <Input
                      placeholder="Например: B2B"
                      value={newEmployee.subcategory}
                      onChange={(e) => setNewEmployee({ ...newEmployee, subcategory: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Роль (кастомная)</Label>
                  <Input
                    placeholder="Введите роль сотрудника"
                    value={newEmployee.customRole}
                    onChange={(e) => setNewEmployee({ ...newEmployee, customRole: e.target.value })}
                  />
                </div>
              </div>
            )}
            <div>
              <Label>Телефон</Label>
              <Input
                value={newEmployee.phone}
                onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
                placeholder="+7 777 123 4567"
                          />
              </div>
                      </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Отмена
            </Button>
              <Button 
              onClick={handleAddEmployee} 
              disabled={!newEmployee.name || !newEmployee.email || isAddingEmployee}
            >
              {isAddingEmployee ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Добавление...
                </>
              ) : (
                "Добавить"
              )}
              </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Employee Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Редактировать сотрудника</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Имя *</Label>
              <Input
                value={editEmployee.name}
                onChange={(e) => setEditEmployee({ ...editEmployee, name: e.target.value })}
                placeholder="Иванов Иван Иванович"
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={editEmployee.email}
                onChange={(e) => setEditEmployee({ ...editEmployee, email: e.target.value })}
                placeholder="ivanov@company.kz"
              />
            </div>
            <div>
              <Label>Компания</Label>
              <Select
                value={editEmployee.company}
                onValueChange={(value) => setEditEmployee({ ...editEmployee, company: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите компанию" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map(company => (
                    <SelectItem key={company.value} value={company.value}>
                      {company.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Категория</Label>
              <Select
                value={editEmployee.category}
                onValueChange={(value) => setEditEmployee({ ...editEmployee, category: value, role: '', customRole: '', subcategory: '', department: '' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите категорию" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {editEmployee.category === 'auditors' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Роль (Аудиторы) *</Label>
                  <Select
                    value={editEmployee.role}
                    onValueChange={(value) => setEditEmployee({ ...editEmployee, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Партнёр, РП, Супервайзер, ..." />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.filter(r => ['partner','manager_1','manager_2','manager_3','supervisor_3','supervisor_2','supervisor_1','tax_specialist_1','tax_specialist_2','assistant_3','assistant_2','assistant_1'].includes(r.value)).map(role => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    ⚠️ Выберите правильную роль, чтобы сотрудник отображался при назначении на проекты
                  </p>
                </div>
                <div>
                  <Label>Подкатегория (опционально)</Label>
                  <Input
                    placeholder="Например: Аудит, IT-аудит"
                    value={editEmployee.subcategory}
                    onChange={(e) => setEditEmployee({ ...editEmployee, subcategory: e.target.value })}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Новая категория</Label>
                    <Input
                      placeholder="Например: Отдел продаж"
                      value={editEmployee.department}
                      onChange={(e) => setEditEmployee({ ...editEmployee, department: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Подкатегория</Label>
                    <Input
                      placeholder="Например: B2B"
                      value={editEmployee.subcategory}
                      onChange={(e) => setEditEmployee({ ...editEmployee, subcategory: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Роль (кастомная)</Label>
                  <Input
                    placeholder="Введите роль сотрудника"
                    value={editEmployee.customRole}
                    onChange={(e) => setEditEmployee({ ...editEmployee, customRole: e.target.value })}
                  />
                </div>
              </div>
            )}
            <div>
              <Label>Телефон</Label>
              <Input
                value={editEmployee.phone}
                onChange={(e) => setEditEmployee({ ...editEmployee, phone: e.target.value })}
                placeholder="+7 777 123 4567"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleEditEmployee}
              disabled={!editEmployee.name || !editEmployee.email}
            >
              Сохранить изменения
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Employee Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить сотрудника?</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить сотрудника {selectedEmployee?.name}?
              Это действие нельзя отменить.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Отмена
              </Button>
            <Button variant="destructive" onClick={handleDeleteEmployee}>
              <Trash2 className="w-4 h-4 mr-2" />
              Удалить
              </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
