/**
 * Единая страница управления аудитом по МСА
 * Объединяет: МСУК Compliance, Процедуры, Методологию
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  Search,
  BookOpen,
  Shield,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronRight,
  Plus,
  Filter,
  BarChart3,
  Users,
  Target,
  Briefcase,
  Calculator,
  Eye,
  MessageCircle,
  RefreshCw,
  TrendingUp,
  Building2,
  Banknote,
  Package,
  Truck,
  CreditCard,
  Receipt,
  Scale,
  FileCheck,
  ClipboardCheck,
  Star,
  Info,
} from 'lucide-react';
import {
  AuditStage,
  AuditArea,
  AuditProcedureType,
  RiskLevel,
  AUDIT_STAGES,
  AUDIT_AREAS,
  PROCEDURE_TYPES,
  ISA_STANDARDS,
} from '@/types/audit';
import {
  ALL_PROCEDURE_TEMPLATES,
  getProceduresByStage,
  getProceduresByArea,
  getRequiredProcedures,
  calculateTotalHours,
} from '@/lib/auditProceduresLibrary';

// Иконки для типов процедур
const PROCEDURE_TYPE_ICONS: Record<AuditProcedureType, React.ComponentType<{ className?: string }>> = {
  inspection: Search,
  observation: Eye,
  inquiry: MessageCircle,
  confirmation: CheckCircle,
  recalculation: Calculator,
  reperformance: RefreshCw,
  analytical: TrendingUp,
};

// Иконки для областей
const AREA_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  assets: Building2,
  liabilities: CreditCard,
  equity: Scale,
  income: Banknote,
  expenses: Receipt,
  special: AlertTriangle,
};

// Цвета для уровней риска
const RISK_COLORS: Record<RiskLevel, string> = {
  low: 'bg-green-100 text-green-800 border-green-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  very_high: 'bg-red-100 text-red-800 border-red-300',
};

const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  very_high: 'Очень высокий',
};

export default function Audit() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'overview' | 'stages' | 'procedures' | 'standards'>('overview');
  const [selectedStage, setSelectedStage] = useState<AuditStage | 'all'>('all');
  const [selectedArea, setSelectedArea] = useState<AuditArea | 'all'>('all');
  const [selectedType, setSelectedType] = useState<AuditProcedureType | 'all'>('all');
  const [selectedRisk, setSelectedRisk] = useState<RiskLevel | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyRequired, setShowOnlyRequired] = useState(false);
  const [selectedProcedures, setSelectedProcedures] = useState<string[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Фильтрация процедур
  const filteredProcedures = useMemo(() => {
    return ALL_PROCEDURE_TEMPLATES.filter(p => {
      if (selectedStage !== 'all' && p.stage !== selectedStage) return false;
      if (selectedArea !== 'all' && p.area !== selectedArea) return false;
      if (selectedType !== 'all' && p.procedureType !== selectedType) return false;
      if (selectedRisk !== 'all' && p.riskLevel !== selectedRisk) return false;
      if (showOnlyRequired && !p.isRequired) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.code.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [selectedStage, selectedArea, selectedType, selectedRisk, showOnlyRequired, searchQuery]);

  // Статистика
  const stats = useMemo(() => {
    const total = ALL_PROCEDURE_TEMPLATES.length;
    const required = getRequiredProcedures().length;
    const byStage = AUDIT_STAGES.map(stage => ({
      stage: stage.id,
      count: getProceduresByStage(stage.id).length,
    }));
    const totalHours = calculateTotalHours(ALL_PROCEDURE_TEMPLATES);
    const highRisk = ALL_PROCEDURE_TEMPLATES.filter(p => p.riskLevel === 'high' || p.riskLevel === 'very_high').length;

    return { total, required, byStage, totalHours, highRisk };
  }, []);

  // Группировка процедур по этапам
  const proceduresByStage = useMemo(() => {
    const grouped: Record<AuditStage, typeof ALL_PROCEDURE_TEMPLATES> = {} as any;
    AUDIT_STAGES.forEach(stage => {
      grouped[stage.id] = filteredProcedures.filter(p => p.stage === stage.id);
    });
    return grouped;
  }, [filteredProcedures]);

  // Группировка по областям
  const proceduresByArea = useMemo(() => {
    const categories = ['assets', 'liabilities', 'equity', 'income', 'expenses', 'special'] as const;
    return categories.map(cat => ({
      category: cat,
      label: {
        assets: 'Активы',
        liabilities: 'Обязательства',
        equity: 'Капитал',
        income: 'Доходы',
        expenses: 'Расходы',
        special: 'Специальные области',
      }[cat],
      areas: Object.entries(AUDIT_AREAS)
        .filter(([_, info]) => info.category === cat)
        .map(([area, info]) => ({
          area: area as AuditArea,
          ...info,
          procedures: filteredProcedures.filter(p => p.area === area),
        }))
        .filter(a => a.procedures.length > 0),
    })).filter(c => c.areas.length > 0);
  }, [filteredProcedures]);

  const toggleProcedure = (code: string) => {
    setSelectedProcedures(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const handleAddToProject = () => {
    if (selectedProcedures.length === 0) {
      toast({
        title: 'Выберите процедуры',
        description: 'Отметьте хотя бы одну процедуру для добавления',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Процедуры добавлены',
      description: `Добавлено ${selectedProcedures.length} процедур в текущий проект`,
    });

    setSelectedProcedures([]);
    setIsAddDialogOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-primary" />
            Аудит по МСА
          </h1>
          <p className="text-muted-foreground mt-1">
            Единая система аудита по Международным Стандартам Аудита (ISA/МСА)
          </p>
        </div>

        <div className="flex gap-2">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg">
                <Plus className="w-4 h-4 mr-2" />
                Добавить в проект
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Добавить процедуры в проект</DialogTitle>
                <DialogDescription>
                  Выбрано {selectedProcedures.length} процедур.
                  Расчётное время: {calculateTotalHours(
                    ALL_PROCEDURE_TEMPLATES.filter(p => selectedProcedures.includes(p.code))
                  )} часов
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="max-h-[400px]">
                <div className="space-y-2">
                  {selectedProcedures.map(code => {
                    const proc = ALL_PROCEDURE_TEMPLATES.find(p => p.code === code);
                    if (!proc) return null;
                    return (
                      <div key={code} className="flex items-center justify-between p-2 bg-muted rounded">
                        <div>
                          <span className="font-mono text-sm text-muted-foreground mr-2">{proc.code}</span>
                          <span>{proc.name}</span>
                        </div>
                        <Badge variant="outline">{proc.estimatedHours}ч</Badge>
                      </div>
                    );
                  })}
                  {selectedProcedures.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      Выберите процедуры на вкладке "Процедуры"
                    </p>
                  )}
                </div>
              </ScrollArea>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Отмена
                </Button>
                <Button onClick={handleAddToProject} disabled={selectedProcedures.length === 0}>
                  Добавить ({selectedProcedures.length})
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Всего процедур</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.required}</p>
              <p className="text-xs text-muted-foreground">Обязательных</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.highRisk}</p>
              <p className="text-xs text-muted-foreground">Высокий риск</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalHours}</p>
              <p className="text-xs text-muted-foreground">Часов (всего)</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Star className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{selectedProcedures.length}</p>
              <p className="text-xs text-muted-foreground">Выбрано</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Обзор
          </TabsTrigger>
          <TabsTrigger value="stages" className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            Этапы (7)
          </TabsTrigger>
          <TabsTrigger value="procedures" className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4" />
            Процедуры
          </TabsTrigger>
          <TabsTrigger value="standards" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Стандарты МСА
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* 7 Stages Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                7 этапов аудита по методологии Russell Bedford
              </CardTitle>
              <CardDescription>
                Полный цикл аудита от принятия клиента до выпуска заключения
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {AUDIT_STAGES.map((stage, index) => {
                  const stageProcs = getProceduresByStage(stage.id);
                  const required = stageProcs.filter(p => p.isRequired).length;
                  const hours = calculateTotalHours(stageProcs);

                  return (
                    <div
                      key={stage.id}
                      className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedStage(stage.id);
                        setActiveTab('procedures');
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: stage.color }}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold">{stage.nameRu}</h4>
                        <p className="text-sm text-muted-foreground">{stage.description}</p>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-center">
                          <p className="font-bold">{stageProcs.length}</p>
                          <p className="text-xs text-muted-foreground">процедур</p>
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-green-600">{required}</p>
                          <p className="text-xs text-muted-foreground">обязат.</p>
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-purple-600">{hours}ч</p>
                          <p className="text-xs text-muted-foreground">часов</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* ISA 500 Procedure Types */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="w-5 h-5" />
                7 типов аудиторских процедур (ISA 500)
              </CardTitle>
              <CardDescription>
                Методы получения аудиторских доказательств согласно Международному стандарту аудита 500
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(PROCEDURE_TYPES).map(([type, info]) => {
                  const Icon = PROCEDURE_TYPE_ICONS[type as AuditProcedureType];
                  const count = ALL_PROCEDURE_TEMPLATES.filter(p => p.procedureType === type).length;

                  return (
                    <div
                      key={type}
                      className="p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedType(type as AuditProcedureType);
                        setActiveTab('procedures');
                      }}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold">{info.nameRu}</h4>
                          <p className="text-xs text-muted-foreground">{info.nameEn}</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{info.description}</p>
                      <Badge variant="secondary">{count} процедур</Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Areas by Category */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Области аудита по статьям отчетности
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {proceduresByArea.map(category => {
                  const Icon = AREA_ICONS[category.category];
                  return (
                    <div key={category.category} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Icon className="w-5 h-5 text-muted-foreground" />
                        <h4 className="font-semibold">{category.label}</h4>
                      </div>
                      <div className="space-y-2">
                        {category.areas.map(area => (
                          <div
                            key={area.area}
                            className="flex items-center justify-between p-2 rounded border hover:bg-muted/50 cursor-pointer"
                            onClick={() => {
                              setSelectedArea(area.area);
                              setActiveTab('procedures');
                            }}
                          >
                            <span className="text-sm">{area.nameRu}</span>
                            <Badge variant="outline">{area.procedures.length}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stages Tab */}
        <TabsContent value="stages" className="space-y-6 mt-6">
          <Accordion type="single" collapsible className="space-y-4">
            {AUDIT_STAGES.map((stage, index) => {
              const stageProcs = proceduresByStage[stage.id] || [];
              const required = stageProcs.filter(p => p.isRequired).length;

              return (
                <AccordionItem key={stage.id} value={stage.id} className="border rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 hover:bg-muted/50">
                    <div className="flex items-center gap-4 w-full">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                        style={{ backgroundColor: stage.color }}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1 text-left">
                        <h4 className="font-semibold">{stage.nameRu}</h4>
                        <p className="text-sm text-muted-foreground">{stage.nameEn}</p>
                      </div>
                      <div className="flex gap-2 mr-4">
                        {stage.relatedISA.slice(0, 3).map(isa => (
                          <Badge key={isa} variant="outline" className="text-xs">
                            {isa.replace('ISA_', 'ISA ')}
                          </Badge>
                        ))}
                        {stage.relatedISA.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{stage.relatedISA.length - 3}
                          </Badge>
                        )}
                      </div>
                      <div className="text-right mr-4">
                        <p className="font-bold">{stageProcs.length}</p>
                        <p className="text-xs text-muted-foreground">{required} обязат.</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <p className="text-muted-foreground mb-4">{stage.description}</p>

                    <div className="mb-4">
                      <h5 className="text-sm font-medium mb-2">Требуемые роли:</h5>
                      <div className="flex gap-2">
                        {stage.requiredRoles.map(role => (
                          <Badge key={role} variant="secondary">
                            {role === 'partner' && 'Партнёр'}
                            {role === 'manager' && 'Менеджер'}
                            {role === 'senior' && 'Старший аудитор'}
                            {role === 'assistant' && 'Ассистент'}
                            {role === 'specialist' && 'Специалист'}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {stageProcs.length > 0 ? (
                      <div className="space-y-2">
                        <h5 className="text-sm font-medium">Процедуры этапа:</h5>
                        {stageProcs.map(proc => {
                          const Icon = PROCEDURE_TYPE_ICONS[proc.procedureType];
                          return (
                            <div
                              key={proc.code}
                              className="flex items-center gap-3 p-3 rounded border hover:bg-muted/50"
                            >
                              <Checkbox
                                checked={selectedProcedures.includes(proc.code)}
                                onCheckedChange={() => toggleProcedure(proc.code)}
                              />
                              <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs text-muted-foreground">{proc.code}</span>
                                  <span className="font-medium">{proc.name}</span>
                                  {proc.isRequired && (
                                    <Badge variant="destructive" className="text-xs">Обязат.</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">{proc.description}</p>
                              </div>
                              <Badge className={RISK_COLORS[proc.riskLevel]}>
                                {RISK_LABELS[proc.riskLevel]}
                              </Badge>
                              <span className="text-sm text-muted-foreground">{proc.estimatedHours}ч</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">
                        Нет процедур по выбранным фильтрам
                      </p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </TabsContent>

        {/* Procedures Tab */}
        <TabsContent value="procedures" className="space-y-6 mt-6">
          {/* Filters */}
          <Card className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Поиск процедур..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <Select value={selectedStage} onValueChange={(v) => setSelectedStage(v as AuditStage | 'all')}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Этап" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все этапы</SelectItem>
                  {AUDIT_STAGES.map(stage => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.order}. {stage.nameRu}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedType} onValueChange={(v) => setSelectedType(v as AuditProcedureType | 'all')}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Тип" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все типы (ISA 500)</SelectItem>
                  {Object.entries(PROCEDURE_TYPES).map(([type, info]) => (
                    <SelectItem key={type} value={type}>
                      {info.nameRu}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedRisk} onValueChange={(v) => setSelectedRisk(v as RiskLevel | 'all')}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Риск" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все риски</SelectItem>
                  <SelectItem value="low">Низкий</SelectItem>
                  <SelectItem value="medium">Средний</SelectItem>
                  <SelectItem value="high">Высокий</SelectItem>
                  <SelectItem value="very_high">Очень высокий</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="required"
                  checked={showOnlyRequired}
                  onCheckedChange={(v) => setShowOnlyRequired(!!v)}
                />
                <Label htmlFor="required" className="text-sm cursor-pointer">
                  Только обязательные
                </Label>
              </div>
            </div>
          </Card>

          {/* Results Info */}
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground">
              Найдено: <span className="font-bold text-foreground">{filteredProcedures.length}</span> процедур
              {selectedProcedures.length > 0 && (
                <span className="ml-2">
                  • Выбрано: <span className="font-bold text-primary">{selectedProcedures.length}</span>
                </span>
              )}
            </p>
            {selectedProcedures.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setSelectedProcedures([])}>
                Сбросить выбор
              </Button>
            )}
          </div>

          {/* Procedures List */}
          <div className="space-y-3">
            {filteredProcedures.map(proc => {
              const Icon = PROCEDURE_TYPE_ICONS[proc.procedureType];
              const stage = AUDIT_STAGES.find(s => s.id === proc.stage);
              const areaInfo = AUDIT_AREAS[proc.area];

              return (
                <Card key={proc.code} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={selectedProcedures.includes(proc.code)}
                      onCheckedChange={() => toggleProcedure(proc.code)}
                      className="mt-1"
                    />
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: stage?.color + '20' }}
                    >
                      <Icon className="w-5 h-5" style={{ color: stage?.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-sm text-muted-foreground">{proc.code}</span>
                        <h4 className="font-semibold">{proc.name}</h4>
                        {proc.isRequired && (
                          <Badge variant="destructive" className="text-xs">Обязательная</Badge>
                        )}
                        {proc.isSamplingBased && (
                          <Badge variant="outline" className="text-xs">Выборка (ISA 530)</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{proc.description}</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="text-xs">
                          Этап {stage?.order}: {stage?.nameRu}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {areaInfo?.nameRu}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {PROCEDURE_TYPES[proc.procedureType].nameRu}
                        </Badge>
                        {proc.relatedISA.slice(0, 2).map(isa => (
                          <Badge key={isa} variant="outline" className="text-xs font-mono">
                            {isa.replace('ISA_', 'ISA ')}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <Badge className={RISK_COLORS[proc.riskLevel]}>
                        {RISK_LABELS[proc.riskLevel]}
                      </Badge>
                      <div className="mt-2 text-sm">
                        <span className="text-muted-foreground">Время: </span>
                        <span className="font-bold">{proc.estimatedHours}ч</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {proc.requiredRole === 'partner' && 'Партнёр'}
                        {proc.requiredRole === 'manager' && 'Менеджер'}
                        {proc.requiredRole === 'senior' && 'Ст. аудитор'}
                        {proc.requiredRole === 'assistant' && 'Ассистент'}
                        {proc.requiredRole === 'specialist' && 'Специалист'}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}

            {filteredProcedures.length === 0 && (
              <Card className="p-12 text-center">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Нет процедур по выбранным фильтрам</p>
                <Button variant="link" onClick={() => {
                  setSelectedStage('all');
                  setSelectedType('all');
                  setSelectedRisk('all');
                  setSearchQuery('');
                  setShowOnlyRequired(false);
                }}>
                  Сбросить фильтры
                </Button>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Standards Tab */}
        <TabsContent value="standards" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Международные стандарты аудита (ISA)
              </CardTitle>
              <CardDescription>
                Справочник стандартов согласно IAASB Handbook 2023-2024
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                {[
                  { category: 'general', label: 'Общие принципы и обязанности (ISA 200-299)' },
                  { category: 'planning', label: 'Планирование аудита (ISA 300-399)' },
                  { category: 'controls', label: 'Внутренний контроль (ISA 400-499)' },
                  { category: 'evidence', label: 'Аудиторские доказательства (ISA 500-599)' },
                  { category: 'others_work', label: 'Использование работы других лиц (ISA 600-699)' },
                  { category: 'reporting', label: 'Аудиторское заключение (ISA 700-799)' },
                  { category: 'special', label: 'Специальные аудиты (ISA 800-899)' },
                ].map(cat => {
                  const standards = Object.values(ISA_STANDARDS).filter(s => s.category === cat.category);
                  return (
                    <AccordionItem key={cat.category} value={cat.category}>
                      <AccordionTrigger className="hover:bg-muted/50 px-4 rounded">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{cat.label}</span>
                          <Badge variant="outline">{standards.length}</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4">
                        <div className="space-y-3">
                          {standards.map(std => {
                            const relatedProcs = ALL_PROCEDURE_TEMPLATES.filter(p =>
                              p.relatedISA.includes(std.code)
                            ).length;

                            return (
                              <div key={std.code} className="p-3 rounded border hover:bg-muted/50">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge className="font-mono">ISA {std.number}</Badge>
                                  <span className="font-medium">{std.nameRu}</span>
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">{std.description}</p>
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-muted-foreground">{std.nameEn}</span>
                                  {relatedProcs > 0 && (
                                    <Badge variant="secondary">{relatedProcs} процедур</Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          </Card>

          {/* ISA 500 Reference */}
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <Info className="w-5 h-5" />
                ISA 500: Аудиторские доказательства
              </CardTitle>
            </CardHeader>
            <CardContent className="text-blue-900">
              <p className="mb-4">
                Большинство работы аудитора по формированию мнения состоит в получении и оценке аудиторских доказательств.
                Аудиторские процедуры для получения доказательств включают:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(PROCEDURE_TYPES).map(([type, info]) => {
                  const Icon = PROCEDURE_TYPE_ICONS[type as AuditProcedureType];
                  return (
                    <div key={type} className="flex items-start gap-3 p-3 bg-white rounded border">
                      <Icon className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="font-medium">{info.nameRu}</p>
                        <p className="text-sm text-muted-foreground">{info.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
