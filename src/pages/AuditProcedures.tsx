import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  AuditProcedure,
  MSA_PROCEDURES,
  ProcedureStatus,
  RiskLevel,
  AuditArea,
  AuditProcedureCategory,
  AuditClassification,
} from '@/types/audit-procedures';
import {
  CheckCircle,
  Clock,
  AlertCircle,
  Plus,
  Edit,
  Trash2,
  FileText,
  Users,
  Zap,
  BookOpen,
} from 'lucide-react';

const STATUS_COLORS = {
  planned: 'bg-blue-500',
  in_progress: 'bg-yellow-500',
  completed: 'bg-green-500',
  on_hold: 'bg-orange-500',
  cancelled: 'bg-gray-500',
};

const STATUS_LABELS = {
  planned: 'Запланирована',
  in_progress: 'В процессе',
  completed: 'Завершена',
  on_hold: 'Приостановлена',
  cancelled: 'Отменена',
};

const RISK_COLORS = {
  low: 'bg-green-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  very_high: 'bg-red-500',
};

const RISK_LABELS = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  very_high: 'Очень высокий',
};

const AREAS: { value: AuditArea; label: string }[] = [
  { value: 'revenue', label: 'Доход' },
  { value: 'expenses', label: 'Расходы' },
  { value: 'assets', label: 'Активы' },
  { value: 'liabilities', label: 'Обязательства' },
  { value: 'equity', label: 'Капитал' },
  { value: 'cash_flow', label: 'Денежные потоки' },
  { value: 'payroll', label: 'Зарплата' },
  { value: 'inventory', label: 'ТМЦ' },
  { value: 'receivables', label: 'Дебиторская задолж.' },
  { value: 'payables', label: 'Кредиторская задолж.' },
  { value: 'fixed_assets', label: 'Основные средства' },
  { value: 'investments', label: 'Инвестиции' },
  { value: 'bank_reconciliation', label: 'Выверка банка' },
  { value: 'accounts_reconciliation', label: 'Выверка счётов' },
  { value: 'consolidation', label: 'Консолидация' },
];

const CATEGORIES: { value: AuditProcedureCategory; label: string }[] = [
  { value: 'inspection', label: 'Проверка документов' },
  { value: 'observation', label: 'Наблюдение' },
  { value: 'inquiry', label: 'Опрос' },
  { value: 'confirmation', label: 'Подтверждение' },
  { value: 'recalculation', label: 'Пересчёт' },
  { value: 'reperformance', label: 'Повторное выполнение' },
  { value: 'analytical_procedure', label: 'Аналитические процедуры' },
  { value: 'tracing', label: 'Отслеживание' },
  { value: 'walkthrough', label: 'Пошаговое прохождение' },
  { value: 'sampling', label: 'Выборка' },
];

export default function AuditProcedures() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [procedures, setProcedures] = useState<AuditProcedure[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedProcedure, setSelectedProcedure] = useState<AuditProcedure | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [filterArea, setFilterArea] = useState<AuditArea | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<AuditProcedureCategory | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    templateId: '',
    assignedTo: [] as string[],
    status: 'planned' as ProcedureStatus,
  });

  // Функция для добавления процедуры из шаблона
  const addProcedureFromTemplate = async () => {
    if (!formData.templateId) {
      toast({
        title: 'Ошибка',
        description: 'Выберите шаблон процедуры',
        variant: 'destructive',
      });
      return;
    }

    const template = MSA_PROCEDURES.find(p => p.id === formData.templateId);
    if (!template) return;

    const newProcedure: AuditProcedure = {
      id: `proc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      projectId: 'proj-current', // TODO: заменить на текущий проект
      code: `AP-${procedures.length + 1}`,
      name: template.name,
      description: template.description,
      classification: 'financial_audit',
      category: template.category,
      area: template.area,
      riskLevel: template.riskLevel,
      estimatedHours: template.estimatedHours,
      assignedTo: formData.assignedTo,
      assignedToNames: formData.assignedTo, // TODO: разрешить реальные имена
      status: formData.status,
      documentationRequired: true,
      findingsCount: 0,
      issuesFound: [],
      createdBy: user?.id || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isaReference: template.isaReference,
      evidenceRequired: template.evidenceRequired,
    };

    setProcedures([...procedures, newProcedure]);

    toast({
      title: 'Процедура добавлена',
      description: `Процедура "${template.name}" добавлена в проект`,
    });

    setFormData({ templateId: '', assignedTo: [], status: 'planned' });
    setDialogOpen(false);
  };

  // Фильтрация процедур
  const filteredProcedures = useMemo(() => {
    return procedures.filter(proc => {
      const matchesSearch = proc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           proc.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesArea = filterArea === 'all' || proc.area === filterArea;
      const matchesCategory = filterCategory === 'all' || proc.category === filterCategory;
      const matchesTab =
        activeTab === 'all' ||
        (activeTab === 'planned' && proc.status === 'planned') ||
        (activeTab === 'in_progress' && proc.status === 'in_progress') ||
        (activeTab === 'completed' && proc.status === 'completed') ||
        (activeTab === 'high_risk' && proc.riskLevel === 'high') ||
        (activeTab === 'very_high_risk' && proc.riskLevel === 'very_high');

      return matchesSearch && matchesArea && matchesCategory && matchesTab;
    });
  }, [procedures, searchTerm, filterArea, filterCategory, activeTab]);

  // Статистика
  const stats = {
    total: procedures.length,
    planned: procedures.filter(p => p.status === 'planned').length,
    inProgress: procedures.filter(p => p.status === 'in_progress').length,
    completed: procedures.filter(p => p.status === 'completed').length,
    highRisk: procedures.filter(p => p.riskLevel === 'high' || p.riskLevel === 'very_high').length,
    totalHours: procedures.reduce((sum, p) => sum + p.estimatedHours, 0),
  };

  const updateProcedureStatus = (procId: string, newStatus: ProcedureStatus) => {
    setProcedures(
      procedures.map(p =>
        p.id === procId
          ? {
              ...p,
              status: newStatus,
              completedAt: newStatus === 'completed' ? new Date().toISOString() : p.completedAt,
              updatedAt: new Date().toISOString(),
            }
          : p
      )
    );
  };

  const deleteProcedure = (procId: string) => {
    if (!confirm('Удалить процедуру?')) return;
    setProcedures(procedures.filter(p => p.id !== procId));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookOpen className="w-8 h-8 text-blue-600" />
            Аудиторские процедуры (МСА)
          </h1>
          <p className="text-muted-foreground mt-1">
            Система управления процедурами согласно Международным стандартам аудита
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Добавить процедуру
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Добавить аудиторскую процедуру</DialogTitle>
              <DialogDescription>
                Выберите процедуру из библиотеки МСА процедур
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Процедура (из библиотеки МСА)</Label>
                <Select value={formData.templateId} onValueChange={(v) =>
                  setFormData({ ...formData, templateId: v })
                }>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите процедуру..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[400px]">
                    {MSA_PROCEDURES.map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        <div className="flex items-center gap-2">
                          <span>{template.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {template.isaReference}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Статус</Label>
                <Select value={formData.status} onValueChange={(v: any) =>
                  setFormData({ ...formData, status: v })
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Отмена
              </Button>
              <Button onClick={addProcedureFromTemplate} className="bg-blue-600">
                Добавить
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-primary" />
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Всего</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{stats.planned}</p>
              <p className="text-xs text-muted-foreground">Запланирована</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{stats.inProgress}</p>
              <p className="text-xs text-muted-foreground">В процессе</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{stats.completed}</p>
              <p className="text-xs text-muted-foreground">Завершена</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">{stats.highRisk}</p>
              <p className="text-xs text-muted-foreground">Высокий риск</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">{stats.totalHours}ч</p>
              <p className="text-xs text-muted-foreground">Часов</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Фильтры */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Поиск</Label>
          <Input
            placeholder="Поиск по названию или коду..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div>
          <Label>Область аудита</Label>
          <Select value={filterArea} onValueChange={(v: any) => setFilterArea(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все области</SelectItem>
              {AREAS.map(area => (
                <SelectItem key={area.value} value={area.value}>
                  {area.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Тип процедуры</Label>
          <Select value={filterCategory} onValueChange={(v: any) => setFilterCategory(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все типы</SelectItem>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Процедуры по статусам */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="all">Все ({stats.total})</TabsTrigger>
          <TabsTrigger value="planned">Планы ({stats.planned})</TabsTrigger>
          <TabsTrigger value="in_progress">Процесс ({stats.inProgress})</TabsTrigger>
          <TabsTrigger value="completed">Готово ({stats.completed})</TabsTrigger>
          <TabsTrigger value="high_risk">
            <AlertCircle className="w-4 h-4 mr-1" />
            Риск ({stats.highRisk})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4 mt-4">
          {filteredProcedures.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Нет процедур по выбранным критериям</p>
            </Card>
          ) : (
            filteredProcedures.map(proc => (
              <Card key={proc.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-sm text-muted-foreground">
                          {proc.code}
                        </span>
                        <h3 className="text-lg font-semibold">{proc.name}</h3>
                        <Badge className={`${STATUS_COLORS[proc.status]} text-white`}>
                          {STATUS_LABELS[proc.status]}
                        </Badge>
                        <Badge className={`${RISK_COLORS[proc.riskLevel]} text-white`}>
                          {RISK_LABELS[proc.riskLevel]}
                        </Badge>
                      </div>

                      <p className="text-sm text-muted-foreground mb-3">{proc.description}</p>

                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span>Область: {AREAS.find(a => a.value === proc.area)?.label}</span>
                        <span>МСА: {proc.isaReference}</span>
                        <span>Часов: {proc.estimatedHours}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedProcedure(proc);
                          setDetailsDialogOpen(true);
                        }}
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => deleteProcedure(proc.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Evidence Required */}
                  {proc.evidenceRequired.length > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Требуемые доказательства:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {proc.evidenceRequired.map((evidence, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {evidence}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Status Controls */}
                  <div className="pt-2 border-t flex gap-2">
                    {proc.status !== 'completed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const nextStatus: Record<ProcedureStatus, ProcedureStatus> = {
                            planned: 'in_progress',
                            in_progress: 'completed',
                            completed: 'completed',
                            on_hold: 'in_progress',
                            cancelled: 'planned',
                          };
                          updateProcedureStatus(proc.id, nextStatus[proc.status]);
                        }}
                      >
                        {proc.status === 'planned' && 'Начать'}
                        {proc.status === 'in_progress' && 'Завершить'}
                        {proc.status === 'on_hold' && 'Возобновить'}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* МСА Справочник */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-4">
          <BookOpen className="w-6 h-6 text-blue-600 mt-1" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">МСА Справочная информация</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>МСА 200:</strong> Общие цели независимого аудитора</li>
              <li>• <strong>МСА 315:</strong> Выявление и оценка рисков значительного искажения</li>
              <li>• <strong>МСА 330:</strong> Ответные меры аудитора на оценённые риски</li>
              <li>• <strong>МСА 500:</strong> Аудиторские доказательства</li>
              <li>• <strong>МСА 505:</strong> Внешние подтверждения</li>
              <li>• <strong>МСА 530:</strong> Аудиторская выборка</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
