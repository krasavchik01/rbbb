/**
 * МСФО 9 (IFRS 9) - Полнофункциональный модуль расчета ECL
 *
 * Профессиональный инструмент для аудиторов
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  Calculator,
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
  Download,
  Plus,
  Trash2,
  Edit,
  Copy,
  ArrowLeft,
  Building2,
  Wallet,
  Shield,
  Target,
  Calendar,
  RefreshCw,
  Settings,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Percent,
  Activity,
  Layers,
  Info,
  ChevronRight,
  Globe,
  LineChart,
} from 'lucide-react';

import {
  AssetType,
  ASSET_TYPE_LABELS,
  ImpairmentStage,
  STAGE_LABELS,
  ECLModelSettings,
} from '@/types/ifrs9';

import {
  calculateAssetECL,
  createDefaultSettings,
} from '@/lib/ifrs9Calculator';

// ==================== ТИПЫ ====================

interface ECLProject {
  id: string;
  name: string;
  clientName: string;
  clientType: 'bank' | 'mfo' | 'leasing' | 'trading' | 'other';
  reportingDate: string;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'completed';
  assets: SimpleAsset[];
  settings: ECLModelSettings;
  notes: string;
}

interface SimpleAsset {
  id: string;
  name: string;
  type: AssetType;
  segment: string;
  amount: number;
  collateralValue: number;
  collateralType: string;
  daysPastDue: number;
  rating: string;
  interestRate: number;
  maturityDate: string;
  watchList: boolean;
  forbearance: boolean;
  // Рассчитанные поля
  stage?: ImpairmentStage;
  ecl?: number;
  ecl12m?: number;
  eclLifetime?: number;
  pd?: number;
  pdLifetime?: number;
  lgd?: number;
  ead?: number;
  coverage?: number;
}

// ==================== ХРАНИЛИЩЕ ====================

const STORAGE_KEY = 'ifrs9_projects_v2';

const loadProjects = (): ECLProject[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveProjects = (projects: ECLProject[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
};

// ==================== УТИЛИТЫ ====================

const formatPercent = (num: number, decimals: number = 2): string => {
  if (isNaN(num) || !isFinite(num)) return '0%';
  return (num * 100).toFixed(decimals) + '%';
};

const formatCurrency = (num: number): string => {
  if (isNaN(num) || !isFinite(num)) return '0';
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(2) + ' млрд';
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + ' млн';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + ' тыс';
  }
  return num.toLocaleString('ru-RU');
};

const generateId = () => Math.random().toString(36).slice(2, 11);

const stageColors: Record<ImpairmentStage, { bg: string; text: string; border: string }> = {
  stage_1: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  stage_2: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' },
  stage_3: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  poci: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
};

const clientTypeLabels: Record<string, string> = {
  bank: 'Банк',
  mfo: 'МФО',
  leasing: 'Лизинговая компания',
  trading: 'Торговая компания',
  other: 'Прочее',
};

const segmentOptions = [
  'Крупный бизнес',
  'Средний бизнес',
  'Малый бизнес',
  'Микробизнес',
  'Розница',
  'Ипотека',
  'Автокредит',
  'Межбанк',
  'Государство',
  'Прочее',
];

const collateralTypes = [
  'Без обеспечения',
  'Недвижимость',
  'Транспорт',
  'Оборудование',
  'ТМЗ',
  'Дебиторская задолженность',
  'Денежные средства',
  'Ценные бумаги',
  'Гарантия/Поручительство',
  'Прочее',
];

// ==================== КОМПОНЕНТЫ ====================

// Мини-график для визуализации
const MiniBar: React.FC<{ value: number; max: number; color: string }> = ({ value, max, color }) => {
  const width = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`h-full ${color} rounded-full transition-all duration-500`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
};

// Карточка статистики
const StatCard: React.FC<{
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; positive: boolean };
  color?: string;
}> = ({ title, value, subtitle, icon, trend, color = 'blue' }) => (
  <Card className={`border-l-4 border-l-${color}-500`}>
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          {trend && (
            <div className={`flex items-center text-xs mt-1 ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.positive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
              {trend.value.toFixed(1)}%
            </div>
          )}
        </div>
        <div className={`h-12 w-12 rounded-full bg-${color}-100 flex items-center justify-center`}>
          {icon}
        </div>
      </div>
    </CardContent>
  </Card>
);

// ==================== ГЛАВНЫЙ КОМПОНЕНТ ====================

const IFRS9Page: React.FC = () => {
  const { toast } = useToast();

  // Состояния
  const [projects, setProjects] = useState<ECLProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('assets');
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [showAssetDialog, setShowAssetDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'project' | 'asset'; id: string } | null>(null);
  const [editingAsset, setEditingAsset] = useState<SimpleAsset | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Форма проекта
  const [projectForm, setProjectForm] = useState({
    name: '',
    clientName: '',
    clientType: 'other' as ECLProject['clientType'],
    reportingDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Форма актива
  const defaultAssetForm = {
    name: '',
    type: 'corporate_loan' as AssetType,
    segment: 'Средний бизнес',
    amount: 0,
    collateralValue: 0,
    collateralType: 'Без обеспечения',
    daysPastDue: 0,
    rating: 'BBB',
    interestRate: 15,
    maturityDate: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    watchList: false,
    forbearance: false,
  };
  const [assetForm, setAssetForm] = useState<Partial<SimpleAsset>>(defaultAssetForm);

  // Загрузка при старте
  useEffect(() => {
    setProjects(loadProjects());
  }, []);

  // Сохранение при изменении
  useEffect(() => {
    if (projects.length > 0 || localStorage.getItem(STORAGE_KEY)) {
      saveProjects(projects);
    }
  }, [projects]);

  // Текущий проект
  const selectedProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  // ==================== ПРОЕКТЫ ====================

  const createProject = () => {
    if (!projectForm.name || !projectForm.clientName) {
      toast({ title: 'Заполните название и клиента', variant: 'destructive' });
      return;
    }

    const newProject: ECLProject = {
      id: generateId(),
      name: projectForm.name,
      clientName: projectForm.clientName,
      clientType: projectForm.clientType,
      reportingDate: projectForm.reportingDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft',
      assets: [],
      settings: createDefaultSettings(),
      notes: projectForm.notes,
    };

    setProjects([newProject, ...projects]);
    setSelectedProjectId(newProject.id);
    setShowProjectDialog(false);
    setProjectForm({
      name: '',
      clientName: '',
      clientType: 'other',
      reportingDate: new Date().toISOString().split('T')[0],
      notes: '',
    });

    toast({ title: 'Проект создан', description: `Проект "${newProject.name}" готов к работе` });
  };

  const updateProjectSettings = (newSettings: Partial<ECLModelSettings>) => {
    if (!selectedProject) return;

    const updatedProject = {
      ...selectedProject,
      settings: { ...selectedProject.settings, ...newSettings },
      updatedAt: new Date().toISOString(),
    };

    setProjects(projects.map(p => p.id === selectedProject.id ? updatedProject : p));
  };

  const deleteProject = (id: string) => {
    setProjects(projects.filter(p => p.id !== id));
    if (selectedProjectId === id) {
      setSelectedProjectId(null);
    }
    toast({ title: 'Проект удален' });
  };

  const duplicateProject = (project: ECLProject) => {
    const copy: ECLProject = {
      ...project,
      id: generateId(),
      name: `${project.name} (копия)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft',
      assets: project.assets.map(a => ({ ...a, id: generateId(), ecl: undefined, stage: undefined })),
    };
    setProjects([copy, ...projects]);
    toast({ title: 'Проект скопирован' });
  };

  // ==================== АКТИВЫ ====================

  const addAsset = () => {
    if (!selectedProject) return;
    if (!assetForm.name || !assetForm.amount) {
      toast({ title: 'Заполните название и сумму', variant: 'destructive' });
      return;
    }

    const newAsset: SimpleAsset = {
      id: editingAsset?.id || generateId(),
      name: assetForm.name || '',
      type: assetForm.type || 'corporate_loan',
      segment: assetForm.segment || 'Средний бизнес',
      amount: Number(assetForm.amount) || 0,
      collateralValue: Number(assetForm.collateralValue) || 0,
      collateralType: assetForm.collateralType || 'Без обеспечения',
      daysPastDue: Number(assetForm.daysPastDue) || 0,
      rating: assetForm.rating || 'BBB',
      interestRate: Number(assetForm.interestRate) || 15,
      maturityDate: assetForm.maturityDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      watchList: assetForm.watchList || false,
      forbearance: assetForm.forbearance || false,
    };

    const updatedProject = {
      ...selectedProject,
      assets: editingAsset
        ? selectedProject.assets.map(a => a.id === editingAsset.id ? newAsset : a)
        : [...selectedProject.assets, newAsset],
      updatedAt: new Date().toISOString(),
      status: 'draft' as const,
    };

    setProjects(projects.map(p => p.id === selectedProject.id ? updatedProject : p));
    setShowAssetDialog(false);
    setEditingAsset(null);
    setAssetForm(defaultAssetForm);

    toast({ title: editingAsset ? 'Актив обновлен' : 'Актив добавлен' });
  };

  const deleteAsset = (assetId: string) => {
    if (!selectedProject) return;

    const updatedProject = {
      ...selectedProject,
      assets: selectedProject.assets.filter(a => a.id !== assetId),
      updatedAt: new Date().toISOString(),
    };

    setProjects(projects.map(p => p.id === selectedProject.id ? updatedProject : p));
    toast({ title: 'Актив удален' });
  };

  const openEditAsset = (asset: SimpleAsset) => {
    setEditingAsset(asset);
    setAssetForm({
      name: asset.name,
      type: asset.type,
      segment: asset.segment,
      amount: asset.amount,
      collateralValue: asset.collateralValue,
      collateralType: asset.collateralType,
      daysPastDue: asset.daysPastDue,
      rating: asset.rating,
      interestRate: asset.interestRate,
      maturityDate: asset.maturityDate,
      watchList: asset.watchList,
      forbearance: asset.forbearance,
    });
    setShowAssetDialog(true);
  };

  // ==================== РАСЧЁТ ECL ====================

  const runCalculation = useCallback(() => {
    if (!selectedProject || selectedProject.assets.length === 0) {
      toast({ title: 'Добавьте активы для расчёта', variant: 'destructive' });
      return;
    }

    setIsCalculating(true);

    try {
      const calculatedAssets = selectedProject.assets.map(asset => {
        const fullAsset = {
          id: asset.id,
          asset_type: asset.type,
          debtor_name: asset.name,
          debtor_segment: asset.segment,
          contract_date: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          maturity_date: asset.maturityDate,
          currency: 'KZT',
          original_amount: asset.amount,
          current_balance: asset.amount,
          undrawn_commitment: 0,
          interest_rate: asset.interestRate / 100,
          effective_rate: (asset.interestRate + 1) / 100,
          internal_rating: asset.rating,
          days_past_due: asset.daysPastDue,
          collateral_value: asset.collateralValue,
          collateral_type: asset.collateralType,
          watch_list: asset.watchList || asset.daysPastDue > 30,
          forbearance: asset.forbearance,
        };

        const result = calculateAssetECL(fullAsset, selectedProject.settings);

        return {
          ...asset,
          stage: result.stage,
          ecl: result.ecl_final,
          ecl12m: result.ecl_12_month,
          eclLifetime: result.ecl_lifetime,
          pd: result.pd.pd_12_month,
          pdLifetime: result.pd.pd_lifetime,
          lgd: result.lgd.lgd_secured,
          ead: result.ead.current_exposure,
          coverage: result.coverage_ratio,
        };
      });

      const updatedProject = {
        ...selectedProject,
        assets: calculatedAssets,
        status: 'completed' as const,
        updatedAt: new Date().toISOString(),
      };

      setProjects(projects.map(p => p.id === selectedProject.id ? updatedProject : p));

      const totalECL = calculatedAssets.reduce((sum, a) => sum + (a.ecl || 0), 0);
      toast({
        title: 'Расчёт завершен',
        description: `Общий резерв ECL: ${formatCurrency(totalECL)}`,
      });
    } catch (error) {
      console.error('Ошибка расчёта:', error);
      toast({ title: 'Ошибка расчёта', variant: 'destructive' });
    } finally {
      setIsCalculating(false);
    }
  }, [selectedProject, projects, toast]);

  // ==================== СТАТИСТИКА ====================

  const stats = useMemo(() => {
    if (!selectedProject) return null;

    const assets = selectedProject.assets;
    const totalAmount = assets.reduce((sum, a) => sum + a.amount, 0);
    const totalECL = assets.reduce((sum, a) => sum + (a.ecl || 0), 0);
    const totalCollateral = assets.reduce((sum, a) => sum + a.collateralValue, 0);
    const coverage = totalAmount > 0 ? totalECL / totalAmount : 0;
    const collateralCoverage = totalAmount > 0 ? totalCollateral / totalAmount : 0;

    const byStage: Record<string, { count: number; amount: number; ecl: number }> = {
      stage_1: { count: 0, amount: 0, ecl: 0 },
      stage_2: { count: 0, amount: 0, ecl: 0 },
      stage_3: { count: 0, amount: 0, ecl: 0 },
    };

    const byType: Record<string, { count: number; amount: number; ecl: number }> = {};
    const bySegment: Record<string, { count: number; amount: number; ecl: number }> = {};

    assets.forEach(a => {
      const stage = a.stage || 'stage_1';
      if (byStage[stage]) {
        byStage[stage].count++;
        byStage[stage].amount += a.amount;
        byStage[stage].ecl += a.ecl || 0;
      }

      if (!byType[a.type]) byType[a.type] = { count: 0, amount: 0, ecl: 0 };
      byType[a.type].count++;
      byType[a.type].amount += a.amount;
      byType[a.type].ecl += a.ecl || 0;

      if (!bySegment[a.segment]) bySegment[a.segment] = { count: 0, amount: 0, ecl: 0 };
      bySegment[a.segment].count++;
      bySegment[a.segment].amount += a.amount;
      bySegment[a.segment].ecl += a.ecl || 0;
    });

    // Средневзвешенные параметры
    const avgPD = assets.length > 0
      ? assets.reduce((sum, a) => sum + (a.pd || 0) * a.amount, 0) / totalAmount
      : 0;
    const avgLGD = assets.length > 0
      ? assets.reduce((sum, a) => sum + (a.lgd || 0) * a.amount, 0) / totalAmount
      : 0;

    return {
      totalAmount,
      totalECL,
      totalCollateral,
      coverage,
      collateralCoverage,
      assetCount: assets.length,
      byStage,
      byType,
      bySegment,
      avgPD,
      avgLGD,
      hasResults: assets.some(a => a.ecl !== undefined),
    };
  }, [selectedProject]);

  // ==================== ЭКСПОРТ ====================

  const exportToCSV = () => {
    if (!selectedProject) return;

    const headers = [
      'Наименование', 'Тип', 'Сегмент', 'Сумма', 'Залог', 'Тип залога',
      'Просрочка', 'Рейтинг', 'Watch List', 'Forbearance',
      'Стадия', 'PD 12m', 'PD Lifetime', 'LGD', 'EAD', 'ECL 12m', 'ECL Lifetime', 'ECL Итого', 'Покрытие'
    ];

    const rows = selectedProject.assets.map(a => [
      a.name,
      ASSET_TYPE_LABELS[a.type],
      a.segment,
      a.amount,
      a.collateralValue,
      a.collateralType,
      a.daysPastDue,
      a.rating,
      a.watchList ? 'Да' : 'Нет',
      a.forbearance ? 'Да' : 'Нет',
      a.stage ? STAGE_LABELS[a.stage].split(' - ')[0] : '-',
      a.pd ? formatPercent(a.pd) : '-',
      a.pdLifetime ? formatPercent(a.pdLifetime) : '-',
      a.lgd ? formatPercent(a.lgd) : '-',
      a.ead?.toFixed(0) || '-',
      a.ecl12m?.toFixed(0) || '-',
      a.eclLifetime?.toFixed(0) || '-',
      a.ecl?.toFixed(0) || '-',
      a.coverage ? formatPercent(a.coverage) : '-',
    ]);

    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ECL_${selectedProject.clientName}_${selectedProject.reportingDate}.csv`;
    link.click();

    toast({ title: 'Экспорт завершен' });
  };

  // ==================== РЕНДЕР СПИСКА ПРОЕКТОВ ====================

  if (!selectedProject) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              МСФО 9 - Расчёт ECL
            </h1>
            <p className="text-muted-foreground mt-1">
              Профессиональный расчёт ожидаемых кредитных убытков
            </p>
          </div>
          <Button
            onClick={() => setShowProjectDialog(true)}
            className="bg-gradient-to-r from-blue-600 to-purple-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            Новый расчёт
          </Button>
        </div>

        {projects.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="py-16 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                <Calculator className="w-10 h-10 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Начните работу с МСФО 9</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Создайте проект расчёта ECL для вашего клиента.
                Добавьте финансовые активы, настройте параметры модели и получите результат.
              </p>
              <Button onClick={() => setShowProjectDialog(true)} size="lg">
                <Plus className="w-5 h-5 mr-2" />
                Создать первый расчёт
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => {
              const totalECL = project.assets.reduce((s, a) => s + (a.ecl || 0), 0);
              const totalAmount = project.assets.reduce((s, a) => s + a.amount, 0);

              return (
                <Card
                  key={project.id}
                  className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/50 group"
                  onClick={() => setSelectedProjectId(project.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg group-hover:text-primary transition-colors">
                          {project.name}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <Building2 className="w-3 h-3" />
                          {project.clientName}
                          <Badge variant="outline" className="ml-2 text-xs">
                            {clientTypeLabels[project.clientType]}
                          </Badge>
                        </CardDescription>
                      </div>
                      <Badge variant={project.status === 'completed' ? 'default' : 'secondary'}>
                        {project.status === 'completed' ? 'Готов' : 'Черновик'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Дата:</span>
                          <span className="ml-1 font-medium">
                            {new Date(project.reportingDate).toLocaleDateString('ru-RU')}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Активов:</span>
                          <span className="ml-1 font-medium">{project.assets.length}</span>
                        </div>
                      </div>

                      {project.assets.length > 0 && (
                        <>
                          <Separator />
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Портфель:</span>
                              <span className="font-medium">{formatCurrency(totalAmount)}</span>
                            </div>
                            {totalECL > 0 && (
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">ECL:</span>
                                <span className="font-medium text-red-600">{formatCurrency(totalECL)}</span>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex gap-2 mt-4" onClick={e => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => duplicateProject(project)}
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Копия
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          setDeleteTarget({ type: 'project', id: project.id });
                          setShowDeleteDialog(true);
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Диалог создания проекта */}
        <Dialog open={showProjectDialog} onOpenChange={setShowProjectDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Новый расчёт ECL</DialogTitle>
              <DialogDescription>
                Создайте проект для расчёта резерва по МСФО 9
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Название расчёта *</Label>
                <Input
                  placeholder="ECL на 31.12.2024"
                  value={projectForm.name}
                  onChange={e => setProjectForm({ ...projectForm, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Клиент *</Label>
                  <Input
                    placeholder="ТОО 'Компания'"
                    value={projectForm.clientName}
                    onChange={e => setProjectForm({ ...projectForm, clientName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Тип клиента</Label>
                  <Select
                    value={projectForm.clientType}
                    onValueChange={v => setProjectForm({ ...projectForm, clientType: v as ECLProject['clientType'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(clientTypeLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Отчётная дата</Label>
                <Input
                  type="date"
                  value={projectForm.reportingDate}
                  onChange={e => setProjectForm({ ...projectForm, reportingDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Примечания</Label>
                <Textarea
                  placeholder="Комментарии к расчёту..."
                  value={projectForm.notes}
                  onChange={e => setProjectForm({ ...projectForm, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowProjectDialog(false)}>
                Отмена
              </Button>
              <Button onClick={createProject}>Создать</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Диалог удаления */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить проект?</AlertDialogTitle>
              <AlertDialogDescription>
                Это действие нельзя отменить. Все данные расчёта будут удалены.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => {
                  if (deleteTarget?.type === 'project') deleteProject(deleteTarget.id);
                  setShowDeleteDialog(false);
                  setDeleteTarget(null);
                }}
              >
                Удалить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ==================== РЕНДЕР ПРОЕКТА ====================

  return (
    <div className="p-6 space-y-6">
      {/* Шапка */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setSelectedProjectId(null)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{selectedProject.name}</h1>
              <Badge variant={selectedProject.status === 'completed' ? 'default' : 'secondary'}>
                {selectedProject.status === 'completed' ? 'Рассчитан' : 'Черновик'}
              </Badge>
            </div>
            <p className="text-muted-foreground flex items-center gap-2 mt-1">
              <Building2 className="w-4 h-4" />
              {selectedProject.clientName}
              <Badge variant="outline" className="text-xs">{clientTypeLabels[selectedProject.clientType]}</Badge>
              <span className="text-muted-foreground/50">•</span>
              <Calendar className="w-4 h-4" />
              {new Date(selectedProject.reportingDate).toLocaleDateString('ru-RU')}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSettingsDialog(true)}>
            <Settings className="w-4 h-4 mr-2" />
            Параметры
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV} disabled={selectedProject.assets.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Экспорт
          </Button>
          <Button
            onClick={runCalculation}
            disabled={isCalculating || selectedProject.assets.length === 0}
            className="bg-gradient-to-r from-blue-600 to-purple-600"
          >
            {isCalculating ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Calculator className="w-4 h-4 mr-2" />
            )}
            Рассчитать ECL
          </Button>
        </div>
      </div>

      {/* Статистика */}
      {stats && stats.assetCount > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Портфель</p>
                  <p className="text-lg font-bold">{formatCurrency(stats.totalAmount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ECL Резерв</p>
                  <p className="text-lg font-bold text-red-600">{formatCurrency(stats.totalECL)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <Percent className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Покрытие</p>
                  <p className="text-lg font-bold">{formatPercent(stats.coverage)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Stage 1</p>
                  <p className="text-lg font-bold">{stats.byStage.stage_1.count}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Stage 2</p>
                  <p className="text-lg font-bold">{stats.byStage.stage_2.count}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Stage 3</p>
                  <p className="text-lg font-bold">{stats.byStage.stage_3.count}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Вкладки */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="assets" className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            Активы ({selectedProject.assets.length})
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-2" disabled={!stats?.hasResults}>
            <BarChart3 className="w-4 h-4" />
            Анализ
          </TabsTrigger>
          <TabsTrigger value="stages" className="flex items-center gap-2" disabled={!stats?.hasResults}>
            <Layers className="w-4 h-4" />
            Стадии
          </TabsTrigger>
          <TabsTrigger value="macro" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Макро-сценарии
          </TabsTrigger>
        </TabsList>

        {/* Вкладка Активы */}
        <TabsContent value="assets" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Финансовые активы</CardTitle>
                <Button
                  size="sm"
                  onClick={() => {
                    setAssetForm(defaultAssetForm);
                    setEditingAsset(null);
                    setShowAssetDialog(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Добавить
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {selectedProject.assets.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="mb-4">Добавьте финансовые активы для расчёта ECL</p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAssetForm(defaultAssetForm);
                      setEditingAsset(null);
                      setShowAssetDialog(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Добавить первый актив
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Наименование</TableHead>
                        <TableHead>Сегмент</TableHead>
                        <TableHead className="text-right">Сумма</TableHead>
                        <TableHead className="text-right">Залог</TableHead>
                        <TableHead className="text-center">DPD</TableHead>
                        <TableHead className="text-center">Рейтинг</TableHead>
                        <TableHead className="text-center">Стадия</TableHead>
                        <TableHead className="text-right">PD</TableHead>
                        <TableHead className="text-right">LGD</TableHead>
                        <TableHead className="text-right">ECL</TableHead>
                        <TableHead className="text-right">%</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedProject.assets.map(asset => (
                        <TableRow key={asset.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{asset.name}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                {ASSET_TYPE_LABELS[asset.type]}
                                {asset.watchList && <Badge variant="outline" className="text-xs px-1">WL</Badge>}
                                {asset.forbearance && <Badge variant="outline" className="text-xs px-1">FB</Badge>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{asset.segment}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(asset.amount)}</TableCell>
                          <TableCell className="text-right text-sm">{formatCurrency(asset.collateralValue)}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={asset.daysPastDue > 90 ? 'destructive' : asset.daysPastDue > 30 ? 'secondary' : 'outline'}>
                              {asset.daysPastDue}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{asset.rating}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {asset.stage ? (
                              <Badge className={`${stageColors[asset.stage].bg} ${stageColors[asset.stage].text}`}>
                                {asset.stage.replace('stage_', 'S')}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {asset.pd !== undefined ? formatPercent(asset.pd, 2) : '-'}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {asset.lgd !== undefined ? formatPercent(asset.lgd, 0) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium text-red-600">
                            {asset.ecl !== undefined ? formatCurrency(asset.ecl) : '-'}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {asset.coverage !== undefined ? formatPercent(asset.coverage, 1) : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditAsset(asset)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600"
                                onClick={() => {
                                  setDeleteTarget({ type: 'asset', id: asset.id });
                                  setShowDeleteDialog(true);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Вкладка Анализ */}
        <TabsContent value="analysis" className="space-y-4">
          {stats?.hasResults && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* По стадиям */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="w-5 h-5" />
                    Распределение по стадиям
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(['stage_1', 'stage_2', 'stage_3'] as const).map(stage => {
                    const data = stats.byStage[stage];
                    const pct = stats.totalAmount > 0 ? (data.amount / stats.totalAmount) * 100 : 0;
                    const colors = stageColors[stage];

                    return (
                      <div key={stage} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge className={`${colors.bg} ${colors.text}`}>
                              {STAGE_LABELS[stage].split(' - ')[0]}
                            </Badge>
                            <span className="text-sm text-muted-foreground">{data.count} активов</span>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{formatCurrency(data.amount)}</div>
                            <div className="text-xs text-red-600">ECL: {formatCurrency(data.ecl)}</div>
                          </div>
                        </div>
                        <Progress value={pct} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{pct.toFixed(1)}% портфеля</span>
                          <span>Покрытие: {data.amount > 0 ? formatPercent(data.ecl / data.amount, 1) : '0%'}</span>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* По сегментам */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="w-5 h-5" />
                    Распределение по сегментам
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(stats.bySegment)
                      .sort((a, b) => b[1].amount - a[1].amount)
                      .slice(0, 6)
                      .map(([segment, data]) => {
                        const pct = stats.totalAmount > 0 ? (data.amount / stats.totalAmount) * 100 : 0;

                        return (
                          <div key={segment} className="flex items-center gap-3">
                            <div className="w-24 text-sm truncate">{segment}</div>
                            <div className="flex-1">
                              <MiniBar value={data.amount} max={stats.totalAmount} color="bg-blue-500" />
                            </div>
                            <div className="w-20 text-right text-sm font-medium">{formatCurrency(data.amount)}</div>
                            <div className="w-16 text-right text-xs text-muted-foreground">{pct.toFixed(1)}%</div>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>

              {/* Ключевые параметры */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Ключевые параметры риска
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
                      <div className="text-sm text-blue-600 mb-1">Средневзв. PD 12m</div>
                      <div className="text-2xl font-bold text-blue-700">{formatPercent(stats.avgPD, 2)}</div>
                    </div>
                    <div className="p-4 rounded-lg bg-purple-50 border border-purple-100">
                      <div className="text-sm text-purple-600 mb-1">Средневзв. LGD</div>
                      <div className="text-2xl font-bold text-purple-700">{formatPercent(stats.avgLGD, 0)}</div>
                    </div>
                    <div className="p-4 rounded-lg bg-green-50 border border-green-100">
                      <div className="text-sm text-green-600 mb-1">Обеспеченность</div>
                      <div className="text-2xl font-bold text-green-700">{formatPercent(stats.collateralCoverage, 0)}</div>
                    </div>
                    <div className="p-4 rounded-lg bg-red-50 border border-red-100">
                      <div className="text-sm text-red-600 mb-1">Коэф. покрытия ECL</div>
                      <div className="text-2xl font-bold text-red-700">{formatPercent(stats.coverage, 2)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Сводка по ECL */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LineChart className="w-5 h-5" />
                    Структура резерва ECL
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Стадия</TableHead>
                        <TableHead className="text-right">Экспозиция</TableHead>
                        <TableHead className="text-right">ECL</TableHead>
                        <TableHead className="text-right">Покрытие</TableHead>
                        <TableHead className="text-right">Доля ECL</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(['stage_1', 'stage_2', 'stage_3'] as const).map(stage => {
                        const data = stats.byStage[stage];
                        const coverage = data.amount > 0 ? data.ecl / data.amount : 0;
                        const eclShare = stats.totalECL > 0 ? data.ecl / stats.totalECL : 0;
                        const colors = stageColors[stage];

                        return (
                          <TableRow key={stage}>
                            <TableCell>
                              <Badge className={`${colors.bg} ${colors.text}`}>
                                {STAGE_LABELS[stage]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(data.amount)}</TableCell>
                            <TableCell className="text-right text-red-600 font-medium">{formatCurrency(data.ecl)}</TableCell>
                            <TableCell className="text-right">{formatPercent(coverage, 2)}</TableCell>
                            <TableCell className="text-right">{formatPercent(eclShare, 1)}</TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="font-bold bg-muted/50">
                        <TableCell>Итого</TableCell>
                        <TableCell className="text-right">{formatCurrency(stats.totalAmount)}</TableCell>
                        <TableCell className="text-right text-red-600">{formatCurrency(stats.totalECL)}</TableCell>
                        <TableCell className="text-right">{formatPercent(stats.coverage, 2)}</TableCell>
                        <TableCell className="text-right">100%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Вкладка Стадии */}
        <TabsContent value="stages" className="space-y-4">
          {stats?.hasResults && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(['stage_1', 'stage_2', 'stage_3'] as const).map(stage => {
                const data = stats.byStage[stage];
                const colors = stageColors[stage];
                const stageAssets = selectedProject.assets.filter(a => a.stage === stage);
                const coverage = data.amount > 0 ? data.ecl / data.amount : 0;

                return (
                  <Card key={stage} className={`border-2 ${colors.border}`}>
                    <CardHeader className={colors.bg}>
                      <CardTitle className={`flex items-center gap-2 ${colors.text}`}>
                        {stage === 'stage_1' && <CheckCircle className="w-5 h-5" />}
                        {stage === 'stage_2' && <AlertTriangle className="w-5 h-5" />}
                        {stage === 'stage_3' && <Activity className="w-5 h-5" />}
                        {STAGE_LABELS[stage]}
                      </CardTitle>
                      <CardDescription className={colors.text}>
                        {stage === 'stage_1' && '12-месячный ECL'}
                        {stage === 'stage_2' && 'Lifetime ECL (SICR)'}
                        {stage === 'stage_3' && 'Lifetime ECL (Default)'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Количество</p>
                          <p className="text-2xl font-bold">{data.count}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Экспозиция</p>
                          <p className="text-lg font-bold">{formatCurrency(data.amount)}</p>
                        </div>
                      </div>
                      <Separator />
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Резерв ECL</p>
                          <p className="text-lg font-bold text-red-600">{formatCurrency(data.ecl)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Покрытие</p>
                          <p className="text-lg font-bold">{formatPercent(coverage, 2)}</p>
                        </div>
                      </div>
                      {stageAssets.length > 0 && (
                        <>
                          <Separator />
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Топ дебиторы:</p>
                            {stageAssets
                              .sort((a, b) => b.amount - a.amount)
                              .slice(0, 3)
                              .map(asset => (
                                <div key={asset.id} className="flex justify-between text-sm">
                                  <span className="truncate max-w-[150px]">{asset.name}</span>
                                  <span className="font-medium">{formatCurrency(asset.amount)}</span>
                                </div>
                              ))}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Критерии SICR */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ChevronRight className="w-5 h-5" />
                Критерии определения стадий
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2 text-yellow-600">
                    <AlertTriangle className="w-4 h-4" />
                    Stage 1 → Stage 2 (SICR)
                  </h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 mt-0.5 text-yellow-500" />
                      Просрочка более {selectedProject.settings.sicr_dpd_threshold} дней
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 mt-0.5 text-yellow-500" />
                      Увеличение PD более чем на {formatPercent(selectedProject.settings.sicr_pd_threshold_absolute)}
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 mt-0.5 text-yellow-500" />
                      Включение в Watch List
                    </li>
                    <li className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 mt-0.5 text-yellow-500" />
                      Реструктуризация (Forbearance)
                    </li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2 text-red-600">
                    <Activity className="w-4 h-4" />
                    Stage 2 → Stage 3 (Default)
                  </h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 mt-0.5 text-red-500" />
                      Просрочка более {selectedProject.settings.default_definition.dpd_threshold} дней
                    </li>
                    {selectedProject.settings.default_definition.qualitative_indicators.slice(0, 3).map((ind, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <ChevronRight className="w-4 h-4 mt-0.5 text-red-500" />
                        {ind}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Вкладка Макро-сценарии */}
        <TabsContent value="macro" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Макроэкономические сценарии
              </CardTitle>
              <CardDescription>
                Корректировки PD и LGD для учета forward-looking информации
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {selectedProject.settings.macro_scenarios.map((scenario, index) => {
                  const scenarioNames = { base: 'Базовый', optimistic: 'Оптимистичный', pessimistic: 'Пессимистичный' };
                  const scenarioColors = {
                    base: 'blue',
                    optimistic: 'green',
                    pessimistic: 'red'
                  };
                  const color = scenarioColors[scenario.scenario];

                  return (
                    <Card key={index} className={`border-2 border-${color}-200`}>
                      <CardHeader className={`bg-${color}-50`}>
                        <CardTitle className={`text-lg text-${color}-700`}>
                          {scenarioNames[scenario.scenario]}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className={`text-${color}-600 border-${color}-300`}>
                            Вес: {(scenario.weight * 100).toFixed(0)}%
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-4 space-y-4">
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Корректировка PD</span>
                            <span className={`font-bold ${scenario.pd_adjustment >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {scenario.pd_adjustment >= 0 ? '+' : ''}{(scenario.pd_adjustment * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Корректировка LGD</span>
                            <span className={`font-bold ${scenario.lgd_adjustment >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {scenario.lgd_adjustment >= 0 ? '+' : ''}{(scenario.lgd_adjustment * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>

                        <Separator />

                        <div className="space-y-2">
                          <p className="text-sm font-medium text-muted-foreground">Макро-факторы:</p>
                          {scenario.factors.map((factor, fi) => (
                            <div key={fi} className="text-sm">
                              <div className="flex justify-between">
                                <span>{factor.name}</span>
                                <span className="font-medium">
                                  {factor.forecast_values[0]?.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="mt-6 p-4 bg-muted rounded-lg">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium mb-1">Как работают макро-сценарии:</p>
                    <p className="text-muted-foreground">
                      Итоговый ECL = Σ (ECL_сценария × Вес_сценария).
                      Сумма весов всех сценариев должна равняться 100%.
                      Корректировки применяются к базовым параметрам PD и LGD.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Редактирование сценариев */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Настройка сценариев
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {selectedProject.settings.macro_scenarios.map((scenario, index) => {
                  const scenarioNames = { base: 'Базовый', optimistic: 'Оптимистичный', pessimistic: 'Пессимистичный' };

                  return (
                    <div key={index} className="grid grid-cols-4 gap-4 items-end pb-4 border-b last:border-0">
                      <div>
                        <Label className="text-sm">{scenarioNames[scenario.scenario]}</Label>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Вес (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={(scenario.weight * 100).toFixed(0)}
                          onChange={(e) => {
                            const newScenarios = [...selectedProject.settings.macro_scenarios];
                            newScenarios[index] = { ...newScenarios[index], weight: Number(e.target.value) / 100 };
                            updateProjectSettings({ macro_scenarios: newScenarios });
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">PD корр. (%)</Label>
                        <Input
                          type="number"
                          step="5"
                          value={(scenario.pd_adjustment * 100).toFixed(0)}
                          onChange={(e) => {
                            const newScenarios = [...selectedProject.settings.macro_scenarios];
                            newScenarios[index] = { ...newScenarios[index], pd_adjustment: Number(e.target.value) / 100 };
                            updateProjectSettings({ macro_scenarios: newScenarios });
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">LGD корр. (%)</Label>
                        <Input
                          type="number"
                          step="5"
                          value={(scenario.lgd_adjustment * 100).toFixed(0)}
                          onChange={(e) => {
                            const newScenarios = [...selectedProject.settings.macro_scenarios];
                            newScenarios[index] = { ...newScenarios[index], lgd_adjustment: Number(e.target.value) / 100 };
                            updateProjectSettings({ macro_scenarios: newScenarios });
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Диалог добавления/редактирования актива */}
      <Dialog open={showAssetDialog} onOpenChange={setShowAssetDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAsset ? 'Редактирование актива' : 'Добавить актив'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Основная информация */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Основная информация</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Наименование / Дебитор *</Label>
                  <Input
                    placeholder="ТОО 'Компания'"
                    value={assetForm.name}
                    onChange={e => setAssetForm({ ...assetForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Тип актива</Label>
                  <Select
                    value={assetForm.type}
                    onValueChange={v => setAssetForm({ ...assetForm, type: v as AssetType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ASSET_TYPE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Сегмент</Label>
                  <Select
                    value={assetForm.segment}
                    onValueChange={v => setAssetForm({ ...assetForm, segment: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {segmentOptions.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Рейтинг</Label>
                  <Select
                    value={assetForm.rating}
                    onValueChange={v => setAssetForm({ ...assetForm, rating: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-', 'BB+', 'BB', 'BB-', 'B+', 'B', 'B-', 'CCC', 'CC', 'C', 'D'].map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Суммы */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Суммы</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Сумма задолженности *</Label>
                  <Input
                    type="number"
                    placeholder="1000000"
                    value={assetForm.amount || ''}
                    onChange={e => setAssetForm({ ...assetForm, amount: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Стоимость залога</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={assetForm.collateralValue || ''}
                    onChange={e => setAssetForm({ ...assetForm, collateralValue: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Тип залога</Label>
                  <Select
                    value={assetForm.collateralType}
                    onValueChange={v => setAssetForm({ ...assetForm, collateralType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {collateralTypes.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ставка (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="15"
                    value={assetForm.interestRate || ''}
                    onChange={e => setAssetForm({ ...assetForm, interestRate: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Кредитное качество */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Кредитное качество</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Просрочка (дней)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={assetForm.daysPastDue || ''}
                    onChange={e => setAssetForm({ ...assetForm, daysPastDue: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Дата погашения</Label>
                  <Input
                    type="date"
                    value={assetForm.maturityDate}
                    onChange={e => setAssetForm({ ...assetForm, maturityDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <Label className="cursor-pointer">Watch List</Label>
                  <Switch
                    checked={assetForm.watchList}
                    onCheckedChange={v => setAssetForm({ ...assetForm, watchList: v })}
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <Label className="cursor-pointer">Forbearance</Label>
                  <Switch
                    checked={assetForm.forbearance}
                    onCheckedChange={v => setAssetForm({ ...assetForm, forbearance: v })}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAssetDialog(false);
              setEditingAsset(null);
              setAssetForm(defaultAssetForm);
            }}>
              Отмена
            </Button>
            <Button onClick={addAsset}>
              {editingAsset ? 'Сохранить' : 'Добавить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог настроек модели */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Параметры модели ECL</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase">Общие параметры</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Эффективная ставка (%)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={(selectedProject.settings.effective_interest_rate * 100).toFixed(1)}
                    onChange={e => updateProjectSettings({ effective_interest_rate: Number(e.target.value) / 100 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Подход к расчету</Label>
                  <Select
                    value={selectedProject.settings.calculation_approach}
                    onValueChange={v => updateProjectSettings({ calculation_approach: v as 'individual' | 'collective' | 'mixed' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Индивидуальный</SelectItem>
                      <SelectItem value="collective">Коллективный</SelectItem>
                      <SelectItem value="mixed">Смешанный</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase">SICR критерии</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Порог PD абс. (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={(selectedProject.settings.sicr_pd_threshold_absolute * 100).toFixed(1)}
                    onChange={e => updateProjectSettings({ sicr_pd_threshold_absolute: Number(e.target.value) / 100 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Порог PD отн. (%)</Label>
                  <Input
                    type="number"
                    value={selectedProject.settings.sicr_pd_threshold_relative}
                    onChange={e => updateProjectSettings({ sicr_pd_threshold_relative: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Порог DPD (дни)</Label>
                  <Input
                    type="number"
                    value={selectedProject.settings.sicr_dpd_threshold}
                    onChange={e => updateProjectSettings({ sicr_dpd_threshold: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase">Определение дефолта</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Порог DPD (дни)</Label>
                  <Input
                    type="number"
                    value={selectedProject.settings.default_definition.dpd_threshold}
                    onChange={e => updateProjectSettings({
                      default_definition: {
                        ...selectedProject.settings.default_definition,
                        dpd_threshold: Number(e.target.value)
                      }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Кросс-дефолт</Label>
                  <Select
                    value={selectedProject.settings.default_definition.cross_default ? 'yes' : 'no'}
                    onValueChange={v => updateProjectSettings({
                      default_definition: {
                        ...selectedProject.settings.default_definition,
                        cross_default: v === 'yes'
                      }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Да</SelectItem>
                      <SelectItem value="no">Нет</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowSettingsDialog(false)}>Готово</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог удаления */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'asset'
                ? 'Актив будет удален из расчёта.'
                : 'Весь проект будет удален безвозвратно.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleteTarget?.type === 'project') deleteProject(deleteTarget.id);
                else if (deleteTarget?.type === 'asset') deleteAsset(deleteTarget.id);
                setShowDeleteDialog(false);
                setDeleteTarget(null);
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default IFRS9Page;
