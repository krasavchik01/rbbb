import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompanyBadge } from "@/components/CompanyBadge";
import { DepartmentBadge } from "@/components/DepartmentBadge";
import { KPIIndicator } from "@/components/KPIIndicator";
import { COMPANIES, DEPARTMENTS, Employee } from "@/types";
import { 
  Plus, 
  Search, 
  Filter, 
  Mail,
  MapPin,
  Calendar,
  FileText,
  User,
  AlertTriangle,
  Coffee,
  Building2,
  Users,
  TrendingUp,
  Award,
  Clock,
  Briefcase,
  Target,
  Star,
  Download,
  Upload,
  Edit,
  Trash2,
  Eye,
  Send,
  Phone,
  Video,
  MessageSquare,
  BarChart3,
  PieChart,
  Settings,
  UserPlus,
  UserMinus,
  CalendarDays,
  FileCheck,
  Shield,
  DollarSign,
  GraduationCap,
  Heart,
  Zap,
  BookOpen,
  CheckCircle,
  XCircle,
  Info
} from "lucide-react";

interface DetailedEmployee extends Employee {
  achievements: {
    title: string;
    description: string;
    date: string;
    type: 'award' | 'certification' | 'project' | 'performance';
  }[];
  skills: string[];
  languages: { name: string; level: 'beginner' | 'intermediate' | 'advanced' | 'native' }[];
  education: {
    degree: string;
    institution: string;
    year: number;
  }[];
  salary: {
    base: number;
    bonus: number;
    total: number;
  };
  vacation: {
    total: number;
    used: number;
    remaining: number;
  };
  documents: {
    name: string;
    type: string;
    status: 'active' | 'expired' | 'pending';
    expiryDate?: string;
  }[];
  performance: {
    quarter: string;
    rating: number;
    goals: string[];
    feedback: string;
  }[];
}

export default function HR() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [activeTab, setActiveTab] = useState("overview");

  const employees: DetailedEmployee[] = [
    {
      id: "1",
      name: "Анна Иванова",
      email: "anna.ivanova@rbpartners.kz",
      avatar: "АИ",
      company: COMPANIES[0],
      department: DEPARTMENTS[1],
      role: "Партнёр",
      kpi: 95,
      bonuses: "₽125,000",
      engagement: 92,
      projects: [
        { name: "Аудит ИТ SafetyFirst", role: "Партнёр" },
        { name: "Внедрение МСФО TechCorp", role: "Консультант" }
      ],
      location: "Алматы",
      hireDate: "2020-03-15",
      status: "active",
      hrNotes: "Высокий потенциал, рассмотреть для повышения",
      achievements: [
        {
          title: "Лучший аудитор года",
          description: "Награда за выдающиеся результаты в области ИТ-аудита",
          date: "2023-12-15",
          type: "award"
        },
        {
          title: "Сертификация CISA",
          description: "Certified Information Systems Auditor",
          date: "2023-08-20",
          type: "certification"
        }
      ],
      skills: ["ИТ-аудит", "МСФО", "Управление проектами", "Лидерство"],
      languages: [
        { name: "Русский", level: "native" },
        { name: "Английский", level: "advanced" },
        { name: "Казахский", level: "intermediate" }
      ],
      education: [
        {
          degree: "Магистр экономики",
          institution: "КазНУ им. аль-Фараби",
          year: 2018
        }
      ],
      salary: {
        base: 450000,
        bonus: 125000,
        total: 575000
      },
      vacation: {
        total: 30,
        used: 15,
        remaining: 15
      },
      documents: [
        { name: "Трудовой договор", type: "contract", status: "active" },
        { name: "Медицинская книжка", type: "medical", status: "active" },
        { name: "Справка о доходах", type: "income", status: "active" }
      ],
      performance: [
        {
          quarter: "Q4 2023",
          rating: 4.8,
          goals: ["Повысить эффективность аудита на 20%", "Обучить 2 новых сотрудников"],
          feedback: "Отличная работа! Продолжайте в том же духе."
        }
      ]
    },
    {
      id: "2",
      name: "Михаил Петров",
      email: "mikhail.petrov@rbpartners.kz",
      avatar: "МП",
      company: COMPANIES[1],
      department: DEPARTMENTS[2],
      role: "Руководитель проекта",
      kpi: 88,
      bonuses: "₽85,000",
      engagement: 87,
      projects: [
        { name: "Построение BI Dashboard", role: "Руководитель" }
      ],
      location: "Астана",
      hireDate: "2021-08-20",
      status: "active",
      achievements: [
        {
          title: "Успешное внедрение BI системы",
          description: "Руководство проектом по внедрению системы бизнес-аналитики",
          date: "2023-11-30",
          type: "project"
        }
      ],
      skills: ["Управление проектами", "BI/Аналитика", "SQL", "Python"],
      languages: [
        { name: "Русский", level: "native" },
        { name: "Английский", level: "intermediate" }
      ],
      education: [
        {
          degree: "Бакалавр информатики",
          institution: "Евразийский национальный университет",
          year: 2020
        }
      ],
      salary: {
        base: 350000,
        bonus: 85000,
        total: 435000
      },
      vacation: {
        total: 28,
        used: 10,
        remaining: 18
      },
      documents: [
        { name: "Трудовой договор", type: "contract", status: "active" },
        { name: "Медицинская книжка", type: "medical", status: "active" }
      ],
      performance: [
        {
          quarter: "Q4 2023",
          rating: 4.2,
          goals: ["Завершить проект BI Dashboard", "Улучшить процессы команды"],
          feedback: "Хорошая работа над проектом. Есть потенциал для роста."
        }
      ]
    },
    {
      id: "3",
      name: "Елена Сидорова",
      email: "elena.sidorova@rbpartners.kz",
      avatar: "ЕС",
      company: COMPANIES[0],
      department: DEPARTMENTS[4],
      role: "Старший аудитор",
      kpi: 82,
      bonuses: "₽45,000",
      engagement: 85,
      projects: [
        { name: "Аудит ИТ SafetyFirst", role: "Супервайзер 1" }
      ],
      location: "Алматы",
      hireDate: "2023-11-01",
      status: "trial",
      hrNotes: "Испытательный срок до 1 февраля 2024",
      achievements: [
        {
          title: "Быстрая адаптация в команде",
          description: "Показала отличные результаты в первые месяцы работы",
          date: "2023-12-01",
          type: "performance"
        }
      ],
      skills: ["Аудит", "МСФО", "Excel", "Анализ данных"],
      languages: [
        { name: "Русский", level: "native" },
        { name: "Английский", level: "intermediate" }
      ],
      education: [
        {
          degree: "Магистр бухгалтерского учета",
          institution: "Алматинский университет энергетики и связи",
          year: 2023
        }
      ],
      salary: {
        base: 200000,
        bonus: 45000,
        total: 245000
      },
      vacation: {
        total: 24,
        used: 0,
        remaining: 24
      },
      documents: [
        { name: "Трудовой договор", type: "contract", status: "active" },
        { name: "Медицинская книжка", type: "medical", status: "pending" }
      ],
      performance: [
        {
          quarter: "Q4 2023",
          rating: 3.8,
          goals: ["Изучить процессы компании", "Показать результаты в аудите"],
          feedback: "Хорошее начало! Продолжайте развиваться."
        }
      ]
    },
    {
      id: "4",
      name: "Дмитрий Козлов",
      email: "dmitry.kozlov@rbpartners.kz",
      avatar: "ДК",
      company: COMPANIES[3],
      department: DEPARTMENTS[3],
      role: "ИТ-аудитор",
      kpi: 35,
      bonuses: "₽15,000",
      engagement: 45,
      projects: [],
      location: "Шымкент",
      hireDate: "2022-05-10",
      status: "active",
      hrNotes: "Низкая производительность, требует attention",
      achievements: [],
      skills: ["ИТ-аудит", "Сетевые технологии", "Безопасность"],
      languages: [
        { name: "Русский", level: "native" },
        { name: "Английский", level: "beginner" }
      ],
      education: [
        {
          degree: "Бакалавр информационных технологий",
          institution: "Южно-Казахстанский университет",
          year: 2021
        }
      ],
      salary: {
        base: 180000,
        bonus: 15000,
        total: 195000
      },
      vacation: {
        total: 24,
        used: 5,
        remaining: 19
      },
      documents: [
        { name: "Трудовой договор", type: "contract", status: "active" },
        { name: "Медицинская книжка", type: "medical", status: "expired", expiryDate: "2023-12-31" }
      ],
      performance: [
        {
          quarter: "Q4 2023",
          rating: 2.1,
          goals: ["Повысить производительность", "Улучшить коммуникацию"],
          feedback: "Требуется улучшение в работе. Необходим план развития."
        }
      ]
    },
    {
      id: "5",
      name: "Ольга Морозова",
      email: "olga.morozova@rbpartners.kz",
      avatar: "ОМ",
      company: COMPANIES[2],
      department: DEPARTMENTS[5],
      role: "Налоговый консультант",
      kpi: 91,
      bonuses: "₽72,000",
      engagement: 89,
      projects: [
        { name: "Налоговое планирование GreenTech", role: "Налоговик 1" }
      ],
      location: "Алматы",
      hireDate: "2023-12-01",
      status: "vacation",
      hrNotes: "В отпуске до 15 января 2024",
      achievements: [
        {
          title: "Эксперт по налоговому планированию",
          description: "Сертификация по налоговому планированию для IT-компаний",
          date: "2023-10-15",
          type: "certification"
        }
      ],
      skills: ["Налоговое планирование", "Налоговое право", "Консультирование", "Excel"],
      languages: [
        { name: "Русский", level: "native" },
        { name: "Английский", level: "advanced" },
        { name: "Казахский", level: "intermediate" }
      ],
      education: [
        {
          degree: "Магистр права",
          institution: "Казахский национальный университет",
          year: 2022
        }
      ],
      salary: {
        base: 280000,
        bonus: 72000,
        total: 352000
      },
      vacation: {
        total: 28,
        used: 20,
        remaining: 8
      },
      documents: [
        { name: "Трудовой договор", type: "contract", status: "active" },
        { name: "Медицинская книжка", type: "medical", status: "active" },
        { name: "Сертификат налогового консультанта", type: "certificate", status: "active" }
      ],
      performance: [
        {
          quarter: "Q4 2023",
          rating: 4.6,
          goals: ["Развить экспертизу в IT-налогообложении", "Обучить команду"],
          feedback: "Отличная работа! Ценный специалист для команды."
        }
      ]
    }
  ];

  const getStatusBadge = (status: Employee['status']) => {
    switch (status) {
      case 'active':
        return <Badge variant="secondary" className="text-green-400">Активен</Badge>;
      case 'trial':
        return <Badge variant="secondary" className="text-yellow-400">Испытательный</Badge>;
      case 'vacation':
        return <Badge variant="secondary" className="text-blue-400">В отпуске</Badge>;
      case 'terminated':
        return <Badge variant="secondary" className="text-red-400">Уволен</Badge>;
      default:
        return null;
    }
  };

  const getHireStatus = (hireDate: string) => {
    const hire = new Date(hireDate);
    const now = new Date();
    const diffInDays = (now.getTime() - hire.getTime()) / (1000 * 3600 * 24);
    
    if (diffInDays < 30) {
      return { isNew: true, days: Math.floor(diffInDays) };
    }
    return { isNew: false, days: 0 };
  };

  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.role.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCompany = selectedCompany === "all" || employee.company.name === selectedCompany;
    const matchesDepartment = selectedDepartment === "all" || employee.department.name === selectedDepartment;
    const matchesStatus = selectedStatus === "all" || employee.status === selectedStatus;
    
    return matchesSearch && matchesCompany && matchesDepartment && matchesStatus;
  });

  const employeesByCompany = filteredEmployees.reduce((acc, employee) => {
    const companyName = employee.company.name;
    if (!acc[companyName]) {
      acc[companyName] = [];
    }
    acc[companyName].push(employee);
    return acc;
  }, {} as Record<string, DetailedEmployee[]>);

  const getAchievementIcon = (type: string) => {
    switch (type) {
      case 'award': return <Award className="w-4 h-4 text-yellow-500" />;
      case 'certification': return <Shield className="w-4 h-4 text-blue-500" />;
      case 'project': return <Briefcase className="w-4 h-4 text-green-500" />;
      case 'performance': return <Star className="w-4 h-4 text-purple-500" />;
      default: return <Award className="w-4 h-4 text-gray-500" />;
    }
  };

  const handleExportData = () => {
    console.log('Exporting HR data...');
    // TODO: Implement actual export functionality
    alert('Экспорт данных в разработке');
  };

  const handleAddEmployee = () => {
    console.log('Adding new employee...');
    // TODO: Implement add employee functionality
    alert('Добавление сотрудника в разработке');
  };

  const handleViewProfile = (employeeId: string) => {
    console.log('Viewing profile for:', employeeId);
    // TODO: Navigate to employee profile page
    alert(`Просмотр профиля сотрудника ${employeeId}`);
  };

  const handleEditEmployee = (employeeId: string) => {
    console.log('Editing employee:', employeeId);
    // TODO: Open edit employee modal
    alert(`Редактирование сотрудника ${employeeId}`);
  };

  const handleSendEmail = (email: string) => {
    console.log('Sending email to:', email);
    // TODO: Open email client or compose email
    alert(`Отправка email на ${email}`);
  };

  const handleDownloadReport = (reportType: string) => {
    console.log('Downloading report:', reportType);
    // TODO: Generate and download report
    alert(`Скачивание отчета: ${reportType}`);
  };

  const getLanguageLevel = (level: string) => {
    switch (level) {
      case 'native': return { text: 'Родной', color: 'text-green-500' };
      case 'advanced': return { text: 'Продвинутый', color: 'text-blue-500' };
      case 'intermediate': return { text: 'Средний', color: 'text-yellow-500' };
      case 'beginner': return { text: 'Начальный', color: 'text-red-500' };
      default: return { text: level, color: 'text-gray-500' };
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            HR Управление
          </h1>
          <p className="text-muted-foreground mt-1">Комплексное управление персоналом RB Partners Group</p>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline"
            onClick={handleExportData}
          >
            <Download className="w-4 h-4 mr-2" />
            Экспорт
          </Button>
          <Button 
            className="btn-gradient"
            onClick={handleAddEmployee}
          >
            <Plus className="w-4 h-4 mr-2" />
            Добавить сотрудника
          </Button>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="glass-card p-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold">{employees.filter(e => e.status === 'active').length}</p>
              <p className="text-sm text-muted-foreground">Активных сотрудников</p>
            </div>
          </div>
        </Card>
        
        <Card className="glass-card p-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold">{Math.round(employees.reduce((acc, e) => acc + e.kpi, 0) / employees.length)}%</p>
              <p className="text-sm text-muted-foreground">Средний KPI</p>
            </div>
          </div>
        </Card>
        
        <Card className="glass-card p-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold">{employees.filter(e => getHireStatus(e.hireDate).isNew).length}</p>
              <p className="text-sm text-muted-foreground">Новых сотрудников</p>
            </div>
          </div>
        </Card>
        
        <Card className="glass-card p-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-red-600 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold">{employees.filter(e => e.kpi < 50).length}</p>
              <p className="text-sm text-muted-foreground">Низкий KPI</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="glass-card p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Поиск сотрудников..." 
              className="pl-10 glass border-glass-border"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <Select value={selectedCompany} onValueChange={setSelectedCompany}>
            <SelectTrigger className="glass border-glass-border">
              <SelectValue placeholder="Компания" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все компании</SelectItem>
              {COMPANIES.map((company) => (
                <SelectItem key={company.id} value={company.name}>{company.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="glass border-glass-border">
              <SelectValue placeholder="Отдел" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все отделы</SelectItem>
              {DEPARTMENTS.map((dept) => (
                <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="glass border-glass-border">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              <SelectItem value="active">Активен</SelectItem>
              <SelectItem value="trial">Испытательный</SelectItem>
              <SelectItem value="vacation">В отпуске</SelectItem>
              <SelectItem value="terminated">Уволен</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            className="btn-glass"
            onClick={() => {
              setSearchTerm("");
              setSelectedCompany("all");
              setSelectedDepartment("all");
              setSelectedStatus("all");
            }}
          >
            <Filter className="w-4 h-4 mr-2" />
            Сбросить
          </Button>
        </div>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="companies">По компаниям</TabsTrigger>
          <TabsTrigger value="analytics">Аналитика</TabsTrigger>
          <TabsTrigger value="reports">Отчеты</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredEmployees.map((employee) => {
              const hireStatus = getHireStatus(employee.hireDate);
              
              return (
            <Card key={employee.id} className="glass-card p-6 hover:scale-[1.02] transition-all duration-300 border border-border/20">
              {/* Employee Header */}
              <div className="flex items-start space-x-4 mb-6">
                <div className="relative">
                  <div className="w-16 h-16 bg-gradient-to-r from-primary to-secondary rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-lg font-bold text-primary-foreground">{employee.avatar}</span>
                  </div>
                  {hireStatus.isNew && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center shadow-md">
                      <span className="text-xs text-black font-bold">Н</span>
                    </div>
                  )}
                  {employee.kpi < 50 && (
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-md">
                      <AlertTriangle className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-xl font-bold text-foreground">{employee.name}</h3>
                    {getStatusBadge(employee.status)}
                  </div>
                  <p className="text-base text-muted-foreground mb-3 font-medium">{employee.role}</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <CompanyBadge company={employee.company} />
                    <DepartmentBadge department={employee.department} />
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center space-x-2">
                      <Mail className="w-4 h-4" />
                      <span>{employee.email}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-4 h-4" />
                      <span>{employee.location}</span>
                    </div>
                  </div>
                </div>
              </div>

                  {/* Detailed Info */}
                  <div className="space-y-6">
                    {/* KPI and Performance */}
                    <div className="flex items-center justify-between p-3 bg-secondary/5 rounded-lg border border-border/10">
                      <span className="text-sm font-medium text-muted-foreground">KPI</span>
                      <KPIIndicator value={employee.kpi} size="sm" />
                    </div>

                    {/* Salary and Vacation Info */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-green-900/30 border border-green-500/30 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <DollarSign className="w-4 h-4 text-green-400" />
                          <span className="text-sm font-medium text-green-100">Зарплата</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-green-50">₽{employee.salary.total.toLocaleString()}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-blue-900/30 border border-blue-500/30 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <CalendarDays className="w-4 h-4 text-blue-400" />
                          <span className="text-sm font-medium text-blue-100">Отпуск</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-blue-50">{employee.vacation.remaining}/{employee.vacation.total}</p>
                        </div>
                      </div>
                    </div>

                    {/* Skills */}
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">Навыки</h4>
                      <div className="flex flex-wrap gap-2">
                        {employee.skills.slice(0, 3).map((skill, index) => (
                          <Badge key={index} variant="secondary" className="text-xs bg-secondary text-secondary-foreground">
                            {skill}
                          </Badge>
                        ))}
                        {employee.skills.length > 3 && (
                          <Badge variant="secondary" className="text-xs bg-secondary text-secondary-foreground">
                            +{employee.skills.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Recent Achievements */}
                    {employee.achievements.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Последние достижения</h4>
                        <div className="space-y-3">
                          {employee.achievements.slice(0, 2).map((achievement, index) => (
                            <div key={index} className="flex items-start space-x-3 p-3 bg-secondary/10 rounded-lg border border-border/20">
                              <div className="flex-shrink-0 mt-0.5">
                                {getAchievementIcon(achievement.type)}
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-foreground">{achievement.title}</p>
                                <p className="text-xs text-muted-foreground mt-1">{achievement.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* HR Notes */}
                    {employee.hrNotes && (
                      <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                        <div className="flex items-start space-x-2">
                          <FileText className="w-4 h-4 text-warning mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-warning">HR Заметка</p>
                            <p className="text-xs text-muted-foreground mt-1">{employee.hrNotes}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-2 mt-4">
                    <Button 
                      size="sm" 
                      className="btn-gradient flex-1"
                      onClick={() => handleViewProfile(employee.id)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Профиль
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="btn-glass"
                      onClick={() => handleEditEmployee(employee.id)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="btn-glass"
                      onClick={() => handleSendEmail(employee.email)}
                    >
                      <Mail className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Companies Tab */}
        <TabsContent value="companies" className="space-y-6">
          {Object.entries(employeesByCompany).map(([companyName, companyEmployees]) => (
            <Card key={companyName} className="glass-card p-6">
              <div className="flex items-center space-x-3 mb-6">
                <Building2 className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-semibold">{companyName}</h2>
                <Badge variant="outline">{companyEmployees.length} сотрудников</Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {companyEmployees.map((employee) => (
                  <Card key={employee.id} className="p-4 hover:scale-[1.02] transition-all duration-300">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-primary to-secondary rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold text-primary-foreground">{employee.avatar}</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{employee.name}</h3>
                        <p className="text-sm text-muted-foreground">{employee.role}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">KPI</span>
                        <KPIIndicator value={employee.kpi} size="sm" />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Зарплата</span>
                        <span className="text-sm font-medium">₽{employee.salary.total.toLocaleString()}</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Отпуск</span>
                        <span className="text-sm font-medium">{employee.vacation.remaining}/{employee.vacation.total}</span>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2 mt-3">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => handleViewProfile(employee.id)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Профиль
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleSendEmail(employee.email)}
                      >
                        <Mail className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          ))}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="glass-card p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                KPI по отделам
              </h3>
              <div className="space-y-4">
                {DEPARTMENTS.map((dept) => {
                  const deptEmployees = employees.filter(e => e.department.id === dept.id);
                  const avgKPI = deptEmployees.length > 0 
                    ? Math.round(deptEmployees.reduce((acc, e) => acc + e.kpi, 0) / deptEmployees.length)
                    : 0;
                  
                  return (
                    <div key={dept.id} className="flex items-center justify-between">
                      <span className="text-sm">{dept.name}</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-secondary rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full" 
                            style={{ width: `${avgKPI}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-12 text-right">{avgKPI}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
            
            <Card className="glass-card p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <PieChart className="w-5 h-5 mr-2" />
                Распределение по статусам
              </h3>
              <div className="space-y-3">
                {['active', 'trial', 'vacation', 'terminated'].map((status) => {
                  const count = employees.filter(e => e.status === status).length;
                  const percentage = Math.round((count / employees.length) * 100);
                  const statusLabels = {
                    active: 'Активен',
                    trial: 'Испытательный',
                    vacation: 'В отпуске',
                    terminated: 'Уволен'
                  };
                  
                  return (
                    <div key={status} className="flex items-center justify-between">
                      <span className="text-sm">{statusLabels[status as keyof typeof statusLabels]}</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-secondary rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full" 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-12 text-right">{count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="glass-card p-6 hover:scale-[1.02] transition-all duration-300 cursor-pointer">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold">Отчет по зарплатам</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Детальный анализ зарплат по отделам и компаниям
              </p>
              <Button 
                className="w-full"
                onClick={() => handleDownloadReport('Отчет по зарплатам')}
              >
                <Download className="w-4 h-4 mr-2" />
                Скачать отчет
              </Button>
            </Card>
            
            <Card className="glass-card p-6 hover:scale-[1.02] transition-all duration-300 cursor-pointer">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold">KPI отчет</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Анализ производительности сотрудников
              </p>
              <Button 
                className="w-full"
                onClick={() => handleDownloadReport('KPI отчет')}
              >
                <Download className="w-4 h-4 mr-2" />
                Скачать отчет
              </Button>
            </Card>
            
            <Card className="glass-card p-6 hover:scale-[1.02] transition-all duration-300 cursor-pointer">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold">Отчет по отпускам</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Планирование и использование отпусков
              </p>
              <Button 
                className="w-full"
                onClick={() => handleDownloadReport('Отчет по отпускам')}
              >
                <Download className="w-4 h-4 mr-2" />
                Скачать отчет
              </Button>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}