/**
 * МСФО 9 (IFRS 9) - Модуль расчета ожидаемых кредитных убытков
 *
 * Практичный инструмент для аудиторов
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
  amount: number;
  collateralValue: number;
  daysPastDue: number;
  rating: string;
  interestRate: number;
  maturityDate: string;
  // Рассчитанные поля
  stage?: ImpairmentStage;
  ecl?: number;
  pd?: number;
  lgd?: number;
  coverage?: number;
}

// ==================== ХРАНИЛИЩЕ ====================

const STORAGE_KEY = 'ifrs9_projects';

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

const formatNumber = (num: number): string => {
  if (isNaN(num) || !isFinite(num)) return '0';
  return num.toLocaleString('ru-RU');
};

const formatPercent = (num: number): string => {
  if (isNaN(num) || !isFinite(num)) return '0%';
  return (num * 100).toFixed(2) + '%';
};

const formatCurrency = (num: number): string => {
  if (isNaN(num) || !isFinite(num)) return '0 ₸';
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1) + ' млрд ₸';
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + ' млн ₸';
  }
  return num.toLocaleString('ru-RU') + ' ₸';
};

const generateId = () => Math.random().toString(36).slice(2, 11);

const stageColors: Record<ImpairmentStage, { bg: string; text: string }> = {
  stage_1: { bg: 'bg-green-100', text: 'text-green-700' },
  stage_2: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  stage_3: { bg: 'bg-red-100', text: 'text-red-700' },
  poci: { bg: 'bg-purple-100', text: 'text-purple-700' },
};

// ==================== ГЛАВНЫЙ КОМПОНЕНТ ====================

const IFRS9Page: React.FC = () => {
  const { toast } = useToast();

  // Состояния
  const [projects, setProjects] = useState<ECLProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [showAssetDialog, setShowAssetDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'project' | 'asset'; id: string } | null>(null);
  const [editingAsset, setEditingAsset] = useState<SimpleAsset | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Форма проекта
  const [projectForm, setProjectForm] = useState({
    name: '',
    clientName: '',
    reportingDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Форма актива
  const [assetForm, setAssetForm] = useState<Partial<SimpleAsset>>({
    name: '',
    type: 'corporate_loan',
    amount: 0,
    collateralValue: 0,
    daysPastDue: 0,
    rating: 'BBB',
    interestRate: 12,
    maturityDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

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
    setProjectForm({ name: '', clientName: '', reportingDate: new Date().toISOString().split('T')[0], notes: '' });

    toast({ title: 'Проект создан', description: `Проект "${newProject.name}" готов к работе` });
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
      id: generateId(),
      name: assetForm.name || '',
      type: assetForm.type || 'corporate_loan',
      amount: Number(assetForm.amount) || 0,
      collateralValue: Number(assetForm.collateralValue) || 0,
      daysPastDue: Number(assetForm.daysPastDue) || 0,
      rating: assetForm.rating || 'BBB',
      interestRate: Number(assetForm.interestRate) || 12,
      maturityDate: assetForm.maturityDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };

    const updatedProject = {
      ...selectedProject,
      assets: editingAsset
        ? selectedProject.assets.map(a => a.id === editingAsset.id ? newAsset : a)
        : [...selectedProject.assets, newAsset],
      updatedAt: new Date().toISOString(),
    };

    setProjects(projects.map(p => p.id === selectedProject.id ? updatedProject : p));
    setShowAssetDialog(false);
    setEditingAsset(null);
    resetAssetForm();

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

  const resetAssetForm = () => {
    setAssetForm({
      name: '',
      type: 'corporate_loan',
      amount: 0,
      collateralValue: 0,
      daysPastDue: 0,
      rating: 'BBB',
      interestRate: 12,
      maturityDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
  };

  const openEditAsset = (asset: SimpleAsset) => {
    setEditingAsset(asset);
    setAssetForm({
      name: asset.name,
      type: asset.type,
      amount: asset.amount,
      collateralValue: asset.collateralValue,
      daysPastDue: asset.daysPastDue,
      rating: asset.rating,
      interestRate: asset.interestRate,
      maturityDate: asset.maturityDate,
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
        // Преобразуем в формат для калькулятора
        const fullAsset = {
          id: asset.id,
          asset_type: asset.type,
          debtor_name: asset.name,
          debtor_segment: '',
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
          collateral_type: asset.collateralValue > 0 ? 'Обеспечение' : 'Без обеспечения',
          watch_list: asset.daysPastDue > 30,
          forbearance: false,
        };

        const result = calculateAssetECL(fullAsset, selectedProject.settings);

        return {
          ...asset,
          stage: result.stage,
          ecl: result.ecl_final,
          pd: result.pd.pd_12_month,
          lgd: result.lgd.lgd_secured,
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
    const coverage = totalAmount > 0 ? totalECL / totalAmount : 0;

    const byStage = {
      stage_1: { count: 0, amount: 0, ecl: 0 },
      stage_2: { count: 0, amount: 0, ecl: 0 },
      stage_3: { count: 0, amount: 0, ecl: 0 },
    };

    assets.forEach(a => {
      const stage = a.stage || 'stage_1';
      if (stage !== 'poci') {
        byStage[stage].count++;
        byStage[stage].amount += a.amount;
        byStage[stage].ecl += a.ecl || 0;
      }
    });

    return { totalAmount, totalECL, coverage, byStage, assetCount: assets.length };
  }, [selectedProject]);

  // ==================== ЭКСПОРТ ====================

  const exportToCSV = () => {
    if (!selectedProject) return;

    const headers = ['Наименование', 'Тип', 'Сумма', 'Залог', 'Просрочка', 'Рейтинг', 'Стадия', 'ECL', 'Покрытие'];
    const rows = selectedProject.assets.map(a => [
      a.name,
      ASSET_TYPE_LABELS[a.type],
      a.amount,
      a.collateralValue,
      a.daysPastDue,
      a.rating,
      a.stage ? STAGE_LABELS[a.stage].split(' - ')[0] : '-',
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

  // ==================== РЕНДЕР ====================

  // Если нет выбранного проекта - показываем список проектов
  if (!selectedProject) {
    return (
      <div className="p-6 space-y-6">
        {/* Заголовок */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              МСФО 9 - Расчёт ECL
            </h1>
            <p className="text-muted-foreground mt-1">
              Создайте проект расчёта для клиента
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

        {/* Список проектов */}
        {projects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <Calculator className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Нет расчётов</h3>
              <p className="text-muted-foreground mb-4">
                Создайте первый проект расчёта ECL для клиента
              </p>
              <Button onClick={() => setShowProjectDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Создать расчёт
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => (
              <Card
                key={project.id}
                className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/50"
                onClick={() => setSelectedProjectId(project.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                      <CardDescription className="flex items-center gap-1 mt-1">
                        <Building2 className="w-3 h-3" />
                        {project.clientName}
                      </CardDescription>
                    </div>
                    <Badge variant={project.status === 'completed' ? 'default' : 'secondary'}>
                      {project.status === 'completed' ? 'Готов' : 'Черновик'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Дата отчёта:</span>
                      <span>{new Date(project.reportingDate).toLocaleDateString('ru-RU')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Активов:</span>
                      <span>{project.assets.length}</span>
                    </div>
                    {project.assets.length > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Сумма:</span>
                        <span className="font-medium">
                          {formatCurrency(project.assets.reduce((s, a) => s + a.amount, 0))}
                        </span>
                      </div>
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
            ))}
          </div>
        )}

        {/* Диалог создания проекта */}
        <Dialog open={showProjectDialog} onOpenChange={setShowProjectDialog}>
          <DialogContent>
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
              <div className="space-y-2">
                <Label>Клиент *</Label>
                <Input
                  placeholder="ТОО 'Название компании'"
                  value={projectForm.clientName}
                  onChange={e => setProjectForm({ ...projectForm, clientName: e.target.value })}
                />
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
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowProjectDialog(false)}>
                Отмена
              </Button>
              <Button onClick={createProject}>
                Создать
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Диалог удаления */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить?</AlertDialogTitle>
              <AlertDialogDescription>
                Это действие нельзя отменить. Данные будут удалены безвозвратно.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => {
                  if (deleteTarget?.type === 'project') {
                    deleteProject(deleteTarget.id);
                  }
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
      {/* Шапка проекта */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setSelectedProjectId(null)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{selectedProject.name}</h1>
            <p className="text-muted-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              {selectedProject.clientName}
              <span className="text-muted-foreground/50">•</span>
              <Calendar className="w-4 h-4" />
              {new Date(selectedProject.reportingDate).toLocaleDateString('ru-RU')}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
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
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Всего активов</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</p>
                </div>
                <Wallet className="w-8 h-8 text-blue-500" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{stats.assetCount} позиций</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Резерв ECL</p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalECL)}</p>
                </div>
                <Shield className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{formatPercent(stats.coverage)} покрытие</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Stage 1</p>
                  <p className="text-lg font-bold text-green-600">{stats.byStage.stage_1.count}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{formatCurrency(stats.byStage.stage_1.amount)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Stage 2+3</p>
                  <p className="text-lg font-bold text-yellow-600">
                    {stats.byStage.stage_2.count + stats.byStage.stage_3.count}
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-yellow-500" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(stats.byStage.stage_2.amount + stats.byStage.stage_3.amount)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Таблица активов */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Финансовые активы
            </CardTitle>
            <Button
              size="sm"
              onClick={() => {
                resetAssetForm();
                setEditingAsset(null);
                setShowAssetDialog(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Добавить актив
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {selectedProject.assets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Добавьте финансовые активы для расчёта ECL</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Наименование</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead className="text-right">Сумма</TableHead>
                    <TableHead className="text-right">Залог</TableHead>
                    <TableHead className="text-center">Просрочка</TableHead>
                    <TableHead className="text-center">Рейтинг</TableHead>
                    <TableHead className="text-center">Стадия</TableHead>
                    <TableHead className="text-right">ECL</TableHead>
                    <TableHead className="text-right">Покрытие</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedProject.assets.map(asset => (
                    <TableRow key={asset.id}>
                      <TableCell className="font-medium">{asset.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {ASSET_TYPE_LABELS[asset.type].split(' ')[0]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(asset.amount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(asset.collateralValue)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={asset.daysPastDue > 90 ? 'destructive' : asset.daysPastDue > 30 ? 'secondary' : 'outline'}>
                          {asset.daysPastDue} дн
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{asset.rating}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {asset.stage ? (
                          <Badge className={`${stageColors[asset.stage].bg} ${stageColors[asset.stage].text}`}>
                            {STAGE_LABELS[asset.stage].split(' ')[0]}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium text-red-600">
                        {asset.ecl !== undefined ? formatCurrency(asset.ecl) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {asset.coverage !== undefined ? formatPercent(asset.coverage) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditAsset(asset)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:text-red-700"
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

      {/* Настройки модели */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Параметры модели
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Порог SICR (просрочка)</Label>
              <p className="font-medium">{selectedProject.settings.sicr_dpd_threshold} дней</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Порог дефолта</Label>
              <p className="font-medium">{selectedProject.settings.default_definition.dpd_threshold} дней</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Эффективная ставка</Label>
              <p className="font-medium">{formatPercent(selectedProject.settings.effective_interest_rate)}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Макро-сценарии</Label>
              <div className="flex gap-1">
                {selectedProject.settings.macro_scenarios.map((s, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {s.scenario === 'base' ? 'Базовый' : s.scenario === 'optimistic' ? 'Оптимист' : 'Пессимист'} {(s.weight * 100).toFixed(0)}%
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Диалог добавления/редактирования актива */}
      <Dialog open={showAssetDialog} onOpenChange={setShowAssetDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingAsset ? 'Редактирование актива' : 'Добавить актив'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Наименование / Дебитор *</Label>
              <Input
                placeholder="ТОО 'Компания'"
                value={assetForm.name}
                onChange={e => setAssetForm({ ...assetForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                    {['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D'].map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
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
            <div className="grid grid-cols-3 gap-4">
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
                <Label>Ставка (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="12"
                  value={assetForm.interestRate || ''}
                  onChange={e => setAssetForm({ ...assetForm, interestRate: Number(e.target.value) })}
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAssetDialog(false);
              setEditingAsset(null);
              resetAssetForm();
            }}>
              Отмена
            </Button>
            <Button onClick={addAsset}>
              {editingAsset ? 'Сохранить' : 'Добавить'}
            </Button>
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
                if (deleteTarget?.type === 'project') {
                  deleteProject(deleteTarget.id);
                } else if (deleteTarget?.type === 'asset') {
                  deleteAsset(deleteTarget.id);
                }
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
