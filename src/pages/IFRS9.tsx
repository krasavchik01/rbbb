/**
 * МСФО 9 (IFRS 9) - Модуль расчета ожидаемых кредитных убытков
 *
 * Полнофункциональный модуль для расчета ECL в соответствии с МСФО 9
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  Calculator,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
  Download,
  Upload,
  Plus,
  Trash2,
  Edit,
  Eye,
  BarChart3,
  PieChart,
  Activity,
  Database,
  Settings,
  RefreshCw,
  FileText,
  Building2,
  Wallet,
  CreditCard,
  Shield,
  Target,
  Percent,
  DollarSign,
  Calendar,
  AlertCircle,
  Info,
  HelpCircle,
  ChevronRight,
  Layers,
  GitBranch,
  Zap,
} from 'lucide-react';

import {
  IFRS9Project,
  FinancialAssetData,
  AssetType,
  ASSET_TYPE_LABELS,
  ImpairmentStage,
  STAGE_LABELS,
  ECLModelSettings,
  PortfolioECLCalculation,
  ECLResult,
  ProvisionMatrix,
} from '@/types/ifrs9';

import {
  IFRS9Utils,
  calculateAssetECL,
  calculatePortfolioECL,
  createDefaultSettings,
  createDefaultProvisionMatrix,
  createDefaultMacroScenarios,
} from '@/lib/ifrs9Calculator';

// Форматирование чисел
const formatNumber = (num: number, decimals: number = 0): string => {
  if (isNaN(num) || !isFinite(num)) return '0';
  return num.toLocaleString('ru-RU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

const formatPercent = (num: number): string => {
  if (isNaN(num) || !isFinite(num)) return '0%';
  return (num * 100).toFixed(2) + '%';
};

const formatCurrency = (num: number): string => {
  if (isNaN(num) || !isFinite(num)) return '0 ₸';
  return num.toLocaleString('ru-RU', {
    style: 'currency',
    currency: 'KZT',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
};

// Цвета для стадий
const stageColors: Record<ImpairmentStage, { bg: string; text: string; border: string }> = {
  stage_1: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
  stage_2: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  stage_3: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
  poci: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
};

// Демо данные для примера
const createDemoAssets = (): FinancialAssetData[] => [
  {
    id: 'asset_1',
    external_id: 'CORP-001',
    asset_type: 'corporate_loan',
    debtor_name: 'ТОО "КазМунайГаз"',
    debtor_segment: 'Крупный бизнес',
    contract_date: '2022-01-15',
    maturity_date: '2027-01-15',
    currency: 'KZT',
    original_amount: 500000000,
    current_balance: 420000000,
    undrawn_commitment: 0,
    interest_rate: 0.14,
    effective_rate: 0.145,
    internal_rating: 'BBB',
    days_past_due: 0,
    collateral_value: 600000000,
    collateral_type: 'Недвижимость',
    watch_list: false,
    forbearance: false,
  },
  {
    id: 'asset_2',
    external_id: 'CORP-002',
    asset_type: 'corporate_loan',
    debtor_name: 'АО "Казахтелеком"',
    debtor_segment: 'Крупный бизнес',
    contract_date: '2023-03-01',
    maturity_date: '2028-03-01',
    currency: 'KZT',
    original_amount: 300000000,
    current_balance: 280000000,
    undrawn_commitment: 50000000,
    interest_rate: 0.15,
    effective_rate: 0.155,
    internal_rating: 'BBB+',
    days_past_due: 0,
    collateral_value: 350000000,
    collateral_type: 'Оборудование',
    watch_list: false,
    forbearance: false,
  },
  {
    id: 'asset_3',
    external_id: 'SME-001',
    asset_type: 'corporate_loan',
    debtor_name: 'ТОО "СтройМаркет"',
    debtor_segment: 'МСБ',
    contract_date: '2021-06-01',
    maturity_date: '2025-06-01',
    currency: 'KZT',
    original_amount: 50000000,
    current_balance: 35000000,
    undrawn_commitment: 0,
    interest_rate: 0.18,
    effective_rate: 0.19,
    internal_rating: 'BB',
    days_past_due: 45,
    collateral_value: 40000000,
    collateral_type: 'Товары в обороте',
    watch_list: true,
    forbearance: false,
  },
  {
    id: 'asset_4',
    external_id: 'SME-002',
    asset_type: 'corporate_loan',
    debtor_name: 'ИП Смирнов',
    debtor_segment: 'МСБ',
    contract_date: '2020-09-01',
    maturity_date: '2024-09-01',
    currency: 'KZT',
    original_amount: 15000000,
    current_balance: 8000000,
    undrawn_commitment: 0,
    interest_rate: 0.20,
    effective_rate: 0.21,
    internal_rating: 'B',
    days_past_due: 120,
    collateral_value: 5000000,
    collateral_type: 'Транспорт',
    watch_list: true,
    forbearance: true,
  },
  {
    id: 'asset_5',
    external_id: 'RET-001',
    asset_type: 'retail_loan',
    debtor_name: 'Иванов И.И.',
    debtor_segment: 'Розница',
    contract_date: '2023-01-01',
    maturity_date: '2028-01-01',
    currency: 'KZT',
    original_amount: 5000000,
    current_balance: 4500000,
    undrawn_commitment: 0,
    interest_rate: 0.22,
    effective_rate: 0.23,
    days_past_due: 0,
    collateral_value: 0,
    collateral_type: 'Без обеспечения',
    watch_list: false,
    forbearance: false,
  },
  {
    id: 'asset_6',
    external_id: 'MORT-001',
    asset_type: 'mortgage',
    debtor_name: 'Петров П.П.',
    debtor_segment: 'Ипотека',
    contract_date: '2022-05-01',
    maturity_date: '2042-05-01',
    currency: 'KZT',
    original_amount: 35000000,
    current_balance: 32000000,
    undrawn_commitment: 0,
    interest_rate: 0.07,
    effective_rate: 0.072,
    days_past_due: 0,
    collateral_value: 50000000,
    collateral_type: 'Жилая недвижимость',
    watch_list: false,
    forbearance: false,
  },
  {
    id: 'asset_7',
    external_id: 'TRADE-001',
    asset_type: 'trade_receivable',
    debtor_name: 'ТОО "Оптовик"',
    debtor_segment: 'Торговля',
    contract_date: '2024-01-01',
    maturity_date: '2024-04-01',
    currency: 'KZT',
    original_amount: 25000000,
    current_balance: 25000000,
    undrawn_commitment: 0,
    interest_rate: 0,
    effective_rate: 0.12,
    days_past_due: 15,
    collateral_value: 0,
    collateral_type: 'Без обеспечения',
    watch_list: false,
    forbearance: false,
  },
];

// Главный компонент
const IFRS9Page: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedProject, setSelectedProject] = useState<IFRS9Project | null>(null);
  const [assets, setAssets] = useState<FinancialAssetData[]>(createDemoAssets());
  const [settings, setSettings] = useState<ECLModelSettings>(createDefaultSettings());
  const [calculationResults, setCalculationResults] = useState<ECLResult[]>([]);
  const [portfolioResult, setPortfolioResult] = useState<PortfolioECLCalculation | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showAssetDialog, setShowAssetDialog] = useState(false);
  const [editingAsset, setEditingAsset] = useState<FinancialAssetData | null>(null);

  // Расчет ECL для всех активов
  const runCalculation = useCallback(() => {
    setIsCalculating(true);

    try {
      // Расчет для каждого актива
      const results = assets.map(asset => calculateAssetECL(asset, settings));
      setCalculationResults(results);

      // Обновляем активы со стадиями
      const updatedAssets = assets.map((asset, index) => ({
        ...asset,
        stage: results[index].stage,
        ecl_result: results[index],
      }));
      setAssets(updatedAssets);

      // Расчет портфеля
      const project: IFRS9Project = {
        id: 'demo_project',
        name: 'Демо расчет ECL',
        client_id: 'demo_client',
        client_name: 'Демо Клиент',
        reporting_date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        created_by: 'system',
        status: 'in_progress',
        settings,
        assets: updatedAssets,
        audit_trail: [],
        review_notes: [],
      };

      const portfolio = calculatePortfolioECL(project);
      setPortfolioResult(portfolio);

      toast({
        title: 'Расчет завершен',
        description: `Рассчитан ECL для ${results.length} активов. Общий резерв: ${formatCurrency(portfolio.total_ecl)}`,
      });
    } catch (error) {
      console.error('Ошибка расчета:', error);
      toast({
        title: 'Ошибка расчета',
        description: 'Произошла ошибка при расчете ECL',
        variant: 'destructive',
      });
    } finally {
      setIsCalculating(false);
    }
  }, [assets, settings, toast]);

  // Статистика по стадиям
  const stageStats = useMemo(() => {
    const stats = {
      stage_1: { count: 0, amount: 0, ecl: 0 },
      stage_2: { count: 0, amount: 0, ecl: 0 },
      stage_3: { count: 0, amount: 0, ecl: 0 },
      poci: { count: 0, amount: 0, ecl: 0 },
    };

    calculationResults.forEach((result, index) => {
      const asset = assets[index];
      stats[result.stage].count++;
      stats[result.stage].amount += asset.current_balance;
      stats[result.stage].ecl += result.ecl_final;
    });

    return stats;
  }, [calculationResults, assets]);

  // Общие показатели
  const totals = useMemo(() => {
    const totalExposure = assets.reduce((sum, a) => sum + a.current_balance, 0);
    const totalECL = calculationResults.reduce((sum, r) => sum + r.ecl_final, 0);
    const coverageRatio = totalExposure > 0 ? totalECL / totalExposure : 0;

    return { totalExposure, totalECL, coverageRatio };
  }, [assets, calculationResults]);

  return (
    <div className="p-6 space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            МСФО 9 - Расчет ECL
          </h1>
          <p className="text-muted-foreground mt-1">
            Модуль расчета ожидаемых кредитных убытков
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Upload className="w-4 h-4 mr-2" />
            Импорт
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Экспорт
          </Button>
          <Button
            onClick={runCalculation}
            disabled={isCalculating}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
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

      {/* Сводные показатели */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Всего активов</p>
                <p className="text-2xl font-bold">{formatCurrency(totals.totalExposure)}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-sm text-muted-foreground">
              <Database className="w-4 h-4 mr-1" />
              {assets.length} позиций
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Резерв ECL</p>
                <p className="text-2xl font-bold">{formatCurrency(totals.totalECL)}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <Shield className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-sm">
              {totals.coverageRatio > 0.05 ? (
                <TrendingUp className="w-4 h-4 mr-1 text-red-500" />
              ) : (
                <TrendingDown className="w-4 h-4 mr-1 text-green-500" />
              )}
              <span className={totals.coverageRatio > 0.05 ? 'text-red-500' : 'text-green-500'}>
                {formatPercent(totals.coverageRatio)} покрытие
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Stage 2 + 3</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(stageStats.stage_2.amount + stageStats.stage_3.amount)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-sm text-muted-foreground">
              <Activity className="w-4 h-4 mr-1" />
              {stageStats.stage_2.count + stageStats.stage_3.count} проблемных
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Stage 1</p>
                <p className="text-2xl font-bold">{formatCurrency(stageStats.stage_1.amount)}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-sm text-muted-foreground">
              <Target className="w-4 h-4 mr-1" />
              {stageStats.stage_1.count} работающих
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Основной контент */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <PieChart className="w-4 h-4" />
            Обзор
          </TabsTrigger>
          <TabsTrigger value="assets" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            Активы
          </TabsTrigger>
          <TabsTrigger value="stages" className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Стадии
          </TabsTrigger>
          <TabsTrigger value="parameters" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Параметры
          </TabsTrigger>
          <TabsTrigger value="matrix" className="flex items-center gap-2">
            <GitBranch className="w-4 h-4" />
            Матрица
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Отчеты
          </TabsTrigger>
        </TabsList>

        {/* Вкладка Обзор */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Распределение по стадиям */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-blue-500" />
                  Распределение по стадиям
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(['stage_1', 'stage_2', 'stage_3', 'poci'] as ImpairmentStage[]).map((stage) => {
                    const stat = stageStats[stage];
                    const percentage = totals.totalExposure > 0
                      ? (stat.amount / totals.totalExposure) * 100
                      : 0;
                    const colors = stageColors[stage];

                    return (
                      <div key={stage} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge className={`${colors.bg} ${colors.text}`}>
                              {STAGE_LABELS[stage].split(' - ')[0]}
                            </Badge>
                            <span className="text-sm">{stat.count} активов</span>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{formatCurrency(stat.amount)}</div>
                            <div className="text-xs text-muted-foreground">
                              ECL: {formatCurrency(stat.ecl)}
                            </div>
                          </div>
                        </div>
                        <Progress
                          value={percentage}
                          className={`h-2 ${colors.bg}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* ECL по типам активов */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-purple-500" />
                  ECL по типам активов
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {portfolioResult?.segments.map((segment) => (
                    <div key={segment.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{segment.name}</span>
                        <div className="text-right">
                          <div className="font-medium">{formatCurrency(segment.ecl)}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatPercent(segment.coverage_ratio)} покрытие
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1 h-2">
                        <div
                          className="bg-green-500 rounded-l"
                          style={{
                            width: `${segment.gross_carrying_amount > 0
                              ? (segment.stage_distribution.stage_1.amount / segment.gross_carrying_amount) * 100
                              : 0}%`
                          }}
                        />
                        <div
                          className="bg-yellow-500"
                          style={{
                            width: `${segment.gross_carrying_amount > 0
                              ? (segment.stage_distribution.stage_2.amount / segment.gross_carrying_amount) * 100
                              : 0}%`
                          }}
                        />
                        <div
                          className="bg-red-500 rounded-r"
                          style={{
                            width: `${segment.gross_carrying_amount > 0
                              ? (segment.stage_distribution.stage_3.amount / segment.gross_carrying_amount) * 100
                              : 0}%`
                          }}
                        />
                      </div>
                    </div>
                  )) || (
                    <div className="text-center text-muted-foreground py-8">
                      Нажмите "Рассчитать ECL" для получения результатов
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Макро-сценарии */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  Макроэкономические сценарии
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {settings.macro_scenarios.map((scenario, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border ${
                        scenario.scenario === 'base' ? 'border-blue-200 bg-blue-50' :
                        scenario.scenario === 'optimistic' ? 'border-green-200 bg-green-50' :
                        'border-red-200 bg-red-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium capitalize">
                          {scenario.scenario === 'base' ? 'Базовый' :
                           scenario.scenario === 'optimistic' ? 'Оптимистичный' :
                           'Пессимистичный'}
                        </span>
                        <Badge variant="outline">{(scenario.weight * 100).toFixed(0)}%</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">PD корр.:</span>{' '}
                          <span className={scenario.pd_adjustment >= 0 ? 'text-red-600' : 'text-green-600'}>
                            {scenario.pd_adjustment >= 0 ? '+' : ''}{(scenario.pd_adjustment * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">LGD корр.:</span>{' '}
                          <span className={scenario.lgd_adjustment >= 0 ? 'text-red-600' : 'text-green-600'}>
                            {scenario.lgd_adjustment >= 0 ? '+' : ''}{(scenario.lgd_adjustment * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Ключевые параметры */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-gray-500" />
                  Ключевые параметры модели
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Эффективная ставка</span>
                    <span className="font-medium">{formatPercent(settings.effective_interest_rate)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Порог SICR (абсолютный)</span>
                    <span className="font-medium">{formatPercent(settings.sicr_pd_threshold_absolute)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Порог SICR (относительный)</span>
                    <span className="font-medium">{settings.sicr_pd_threshold_relative}%</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Порог просрочки SICR</span>
                    <span className="font-medium">{settings.sicr_dpd_threshold} дней</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground">Порог дефолта</span>
                    <span className="font-medium">{settings.default_definition.dpd_threshold} дней</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Вкладка Активы */}
        <TabsContent value="assets" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Портфель финансовых активов</CardTitle>
                <Button size="sm" onClick={() => setShowAssetDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Добавить актив
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Дебитор</TableHead>
                      <TableHead>Тип</TableHead>
                      <TableHead className="text-right">Баланс</TableHead>
                      <TableHead className="text-center">Просрочка</TableHead>
                      <TableHead className="text-center">Рейтинг</TableHead>
                      <TableHead className="text-center">Стадия</TableHead>
                      <TableHead className="text-right">ECL</TableHead>
                      <TableHead className="text-right">Покрытие</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assets.map((asset, index) => {
                      const result = calculationResults[index];
                      const stage = result?.stage || 'stage_1';
                      const colors = stageColors[stage];

                      return (
                        <TableRow key={asset.id}>
                          <TableCell className="font-mono text-sm">{asset.external_id}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{asset.debtor_name}</div>
                              <div className="text-xs text-muted-foreground">{asset.debtor_segment}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{ASSET_TYPE_LABELS[asset.asset_type]}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(asset.current_balance)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={asset.days_past_due > 90 ? 'destructive' :
                                       asset.days_past_due > 30 ? 'secondary' : 'outline'}
                            >
                              {asset.days_past_due} дн.
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{asset.internal_rating || '-'}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={`${colors.bg} ${colors.text}`}>
                              {STAGE_LABELS[stage].split(' - ')[0]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-red-600">
                            {result ? formatCurrency(result.ecl_final) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {result ? formatPercent(result.coverage_ratio) : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Просмотр деталей</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => {
                                        setEditingAsset(asset);
                                        setShowAssetDialog(true);
                                      }}
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Редактировать</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Вкладка Стадии */}
        <TabsContent value="stages" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['stage_1', 'stage_2', 'stage_3'] as ImpairmentStage[]).map((stage) => {
              const stat = stageStats[stage];
              const colors = stageColors[stage];
              const stageAssets = assets.filter((_, i) => calculationResults[i]?.stage === stage);
              const coverageRatio = stat.amount > 0 ? stat.ecl / stat.amount : 0;

              return (
                <Card key={stage} className={`border-2 ${colors.border}`}>
                  <CardHeader className={colors.bg}>
                    <CardTitle className={`flex items-center gap-2 ${colors.text}`}>
                      {stage === 'stage_1' && <CheckCircle className="w-5 h-5" />}
                      {stage === 'stage_2' && <AlertTriangle className="w-5 h-5" />}
                      {stage === 'stage_3' && <AlertCircle className="w-5 h-5" />}
                      {STAGE_LABELS[stage]}
                    </CardTitle>
                    <CardDescription>
                      {stage === 'stage_1' && '12-месячный ECL'}
                      {stage === 'stage_2' && 'Lifetime ECL (SICR)'}
                      {stage === 'stage_3' && 'Lifetime ECL (Дефолт)'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Количество</p>
                          <p className="text-2xl font-bold">{stat.count}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Экспозиция</p>
                          <p className="text-lg font-bold">{formatCurrency(stat.amount)}</p>
                        </div>
                      </div>
                      <Separator />
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Резерв ECL</p>
                          <p className="text-lg font-bold text-red-600">{formatCurrency(stat.ecl)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Покрытие</p>
                          <p className="text-lg font-bold">{formatPercent(coverageRatio)}</p>
                        </div>
                      </div>
                      <Separator />
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Топ дебиторы:</p>
                        {stageAssets.slice(0, 3).map((asset) => (
                          <div key={asset.id} className="flex justify-between text-sm">
                            <span className="truncate max-w-[150px]">{asset.debtor_name}</span>
                            <span className="font-medium">{formatCurrency(asset.current_balance)}</span>
                          </div>
                        ))}
                        {stageAssets.length === 0 && (
                          <p className="text-sm text-muted-foreground">Нет активов</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Движение между стадиями */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="w-5 h-5" />
                Критерии перехода между стадиями
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-yellow-500" />
                    Stage 1 → Stage 2 (SICR)
                  </h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 text-yellow-500" />
                      Просрочка более {settings.sicr_dpd_threshold} дней
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 text-yellow-500" />
                      Увеличение PD более чем на {formatPercent(settings.sicr_pd_threshold_absolute)} (абс.)
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 text-yellow-500" />
                      Увеличение PD более чем на {settings.sicr_pd_threshold_relative}% (относ.)
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 text-yellow-500" />
                      Включение в watch-list
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 text-yellow-500" />
                      Реструктуризация (forbearance)
                    </li>
                  </ul>
                </div>
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-red-500" />
                    Stage 2 → Stage 3 (Дефолт)
                  </h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 text-red-500" />
                      Просрочка более {settings.default_definition.dpd_threshold} дней
                    </li>
                    {settings.default_definition.qualitative_indicators.map((indicator, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 mt-0.5 text-red-500" />
                        {indicator}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Вкладка Параметры */}
        <TabsContent value="parameters" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Общие параметры</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Эффективная ставка (%)</Label>
                    <Input
                      type="number"
                      value={(settings.effective_interest_rate * 100).toFixed(1)}
                      onChange={(e) => setSettings({
                        ...settings,
                        effective_interest_rate: parseFloat(e.target.value) / 100
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Подход к расчету</Label>
                    <Select
                      value={settings.calculation_approach}
                      onValueChange={(v: 'individual' | 'collective' | 'mixed') =>
                        setSettings({ ...settings, calculation_approach: v })
                      }
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Параметры SICR</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Порог PD (абс.) %</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={(settings.sicr_pd_threshold_absolute * 100).toFixed(1)}
                      onChange={(e) => setSettings({
                        ...settings,
                        sicr_pd_threshold_absolute: parseFloat(e.target.value) / 100
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Порог PD (отн.) %</Label>
                    <Input
                      type="number"
                      value={settings.sicr_pd_threshold_relative}
                      onChange={(e) => setSettings({
                        ...settings,
                        sicr_pd_threshold_relative: parseInt(e.target.value)
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Порог просрочки (дней)</Label>
                    <Input
                      type="number"
                      value={settings.sicr_dpd_threshold}
                      onChange={(e) => setSettings({
                        ...settings,
                        sicr_dpd_threshold: parseInt(e.target.value)
                      })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Определение дефолта</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Порог просрочки (дней)</Label>
                    <Input
                      type="number"
                      value={settings.default_definition.dpd_threshold}
                      onChange={(e) => setSettings({
                        ...settings,
                        default_definition: {
                          ...settings.default_definition,
                          dpd_threshold: parseInt(e.target.value)
                        }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Кросс-дефолт</Label>
                    <Select
                      value={settings.default_definition.cross_default ? 'yes' : 'no'}
                      onValueChange={(v) => setSettings({
                        ...settings,
                        default_definition: {
                          ...settings.default_definition,
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
                <div className="space-y-2">
                  <Label>Качественные индикаторы</Label>
                  <div className="flex flex-wrap gap-2">
                    {settings.default_definition.qualitative_indicators.map((ind, i) => (
                      <Badge key={i} variant="secondary">{ind}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Упрощенный подход</CardTitle>
                <CardDescription>Для торговой дебиторской задолженности</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Использовать матрицу резервирования</Label>
                  <Button
                    variant={settings.simplified_approach_enabled ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSettings({
                      ...settings,
                      simplified_approach_enabled: !settings.simplified_approach_enabled
                    })}
                  >
                    {settings.simplified_approach_enabled ? 'Включено' : 'Выключено'}
                  </Button>
                </div>
                {settings.simplified_approach_enabled && settings.provision_matrix && (
                  <div className="space-y-2">
                    <Label>Бакеты просрочки</Label>
                    <div className="grid grid-cols-4 gap-2 text-sm">
                      <div className="font-medium">Бакет</div>
                      <div className="font-medium">Дней от</div>
                      <div className="font-medium">Дней до</div>
                      <div className="font-medium">Ставка %</div>
                      {settings.provision_matrix.aging_buckets.map((bucket, i) => (
                        <React.Fragment key={i}>
                          <div>{bucket.name}</div>
                          <div>{bucket.days_from}</div>
                          <div>{bucket.days_to ?? '∞'}</div>
                          <div>{(bucket.provision_rate * 100).toFixed(0)}%</div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Вкладка Матрица */}
        <TabsContent value="matrix" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="w-5 h-5" />
                Матрица миграции рейтингов
              </CardTitle>
              <CardDescription>
                Переходные вероятности между рейтинговыми категориями (1 год)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">От / К</TableHead>
                      <TableHead className="text-center">AAA</TableHead>
                      <TableHead className="text-center">AA</TableHead>
                      <TableHead className="text-center">A</TableHead>
                      <TableHead className="text-center">BBB</TableHead>
                      <TableHead className="text-center">BB</TableHead>
                      <TableHead className="text-center">B</TableHead>
                      <TableHead className="text-center">CCC</TableHead>
                      <TableHead className="text-center bg-red-50">D</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      ['AAA', 90.81, 8.33, 0.68, 0.06, 0.12, 0.00, 0.00, 0.00],
                      ['AA', 0.70, 90.65, 7.79, 0.64, 0.06, 0.14, 0.02, 0.00],
                      ['A', 0.09, 2.27, 91.05, 5.52, 0.74, 0.26, 0.01, 0.06],
                      ['BBB', 0.02, 0.33, 5.95, 86.93, 5.30, 1.17, 0.12, 0.18],
                      ['BB', 0.03, 0.14, 0.67, 7.73, 80.53, 8.84, 1.00, 1.06],
                      ['B', 0.00, 0.11, 0.24, 0.43, 6.48, 83.46, 4.07, 5.20],
                      ['CCC', 0.22, 0.00, 0.22, 1.30, 2.38, 11.24, 64.86, 19.79],
                    ].map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row[0]}</TableCell>
                        {row.slice(1).map((val, j) => (
                          <TableCell
                            key={j}
                            className={`text-center text-sm ${
                              j === 7 ? 'bg-red-50 text-red-700 font-medium' :
                              i === j ? 'bg-blue-50 font-medium' : ''
                            }`}
                          >
                            {typeof val === 'number' ? val.toFixed(2) : val}%
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 flex gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-50 border rounded"></div>
                  <span>Диагональ (стабильность)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-50 border rounded"></div>
                  <span>Дефолт (PD)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>PD по рейтинговым категориям</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { rating: 'AAA', pd: 0.01 },
                    { rating: 'AA', pd: 0.02 },
                    { rating: 'A', pd: 0.06 },
                    { rating: 'BBB', pd: 0.18 },
                    { rating: 'BB', pd: 1.06 },
                    { rating: 'B', pd: 5.20 },
                    { rating: 'CCC', pd: 19.79 },
                  ].map((item) => (
                    <div key={item.rating} className="flex items-center gap-3">
                      <Badge variant="outline" className="w-12 justify-center">{item.rating}</Badge>
                      <Progress value={Math.min(item.pd * 5, 100)} className="flex-1 h-2" />
                      <span className="w-16 text-right text-sm font-medium">{item.pd.toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>LGD по типам обеспечения</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { type: 'Недвижимость', lgd: 20 },
                    { type: 'Оборудование', lgd: 35 },
                    { type: 'Транспорт', lgd: 40 },
                    { type: 'ТМЗ', lgd: 50 },
                    { type: 'Дебиторка', lgd: 55 },
                    { type: 'Без обеспечения', lgd: 70 },
                  ].map((item) => (
                    <div key={item.type} className="flex items-center gap-3">
                      <span className="w-32 text-sm">{item.type}</span>
                      <Progress value={item.lgd} className="flex-1 h-2" />
                      <span className="w-12 text-right text-sm font-medium">{item.lgd}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Вкладка Отчеты */}
        <TabsContent value="reports" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <FileSpreadsheet className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Сводный отчет ECL</h3>
                  <p className="text-sm text-muted-foreground">Итоговые данные по портфелю</p>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <Layers className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Движение резерва</h3>
                  <p className="text-sm text-muted-foreground">Roll-forward ECL за период</p>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <GitBranch className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Движение стадий</h3>
                  <p className="text-sm text-muted-foreground">Stage transfers</p>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Качество портфеля</h3>
                  <p className="text-sm text-muted-foreground">Credit quality analysis</p>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                  <Activity className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Анализ чувствительности</h3>
                  <p className="text-sm text-muted-foreground">Sensitivity analysis</p>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Раскрытия МСФО 7</h3>
                  <p className="text-sm text-muted-foreground">IFRS 7 Disclosures</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Предпросмотр сводного отчета */}
          {portfolioResult && (
            <Card>
              <CardHeader>
                <CardTitle>Сводный отчет по ECL</CardTitle>
                <CardDescription>
                  Отчетная дата: {portfolioResult.calculation_date}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Показатель</TableHead>
                      <TableHead className="text-right">Stage 1</TableHead>
                      <TableHead className="text-right">Stage 2</TableHead>
                      <TableHead className="text-right">Stage 3</TableHead>
                      <TableHead className="text-right">Итого</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Валовая балансовая стоимость</TableCell>
                      <TableCell className="text-right">{formatCurrency(portfolioResult.stage_1_exposure)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(portfolioResult.stage_2_exposure)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(portfolioResult.stage_3_exposure)}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(portfolioResult.total_gross_exposure)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Резерв под ECL</TableCell>
                      <TableCell className="text-right text-red-600">{formatCurrency(portfolioResult.stage_1_ecl)}</TableCell>
                      <TableCell className="text-right text-red-600">{formatCurrency(portfolioResult.stage_2_ecl)}</TableCell>
                      <TableCell className="text-right text-red-600">{formatCurrency(portfolioResult.stage_3_ecl)}</TableCell>
                      <TableCell className="text-right font-bold text-red-600">{formatCurrency(portfolioResult.total_ecl)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Коэффициент покрытия</TableCell>
                      <TableCell className="text-right">
                        {portfolioResult.stage_1_exposure > 0
                          ? formatPercent(portfolioResult.stage_1_ecl / portfolioResult.stage_1_exposure)
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {portfolioResult.stage_2_exposure > 0
                          ? formatPercent(portfolioResult.stage_2_ecl / portfolioResult.stage_2_exposure)
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {portfolioResult.stage_3_exposure > 0
                          ? formatPercent(portfolioResult.stage_3_ecl / portfolioResult.stage_3_exposure)
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right font-bold">{formatPercent(portfolioResult.total_coverage_ratio)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Чистая балансовая стоимость</TableCell>
                      <TableCell className="text-right">{formatCurrency(portfolioResult.stage_1_exposure - portfolioResult.stage_1_ecl)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(portfolioResult.stage_2_exposure - portfolioResult.stage_2_ecl)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(portfolioResult.stage_3_exposure - portfolioResult.stage_3_ecl)}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(portfolioResult.total_gross_exposure - portfolioResult.total_ecl)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Скачать Excel
                  </Button>
                  <Button variant="outline" size="sm">
                    <FileText className="w-4 h-4 mr-2" />
                    Скачать PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Диалог добавления/редактирования актива */}
      <Dialog open={showAssetDialog} onOpenChange={setShowAssetDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingAsset ? 'Редактирование актива' : 'Добавление нового актива'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Тип актива</Label>
              <Select defaultValue="corporate_loan">
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
              <Label>Наименование дебитора</Label>
              <Input defaultValue={editingAsset?.debtor_name} />
            </div>
            <div className="space-y-2">
              <Label>Сумма задолженности</Label>
              <Input type="number" defaultValue={editingAsset?.current_balance} />
            </div>
            <div className="space-y-2">
              <Label>Просрочка (дней)</Label>
              <Input type="number" defaultValue={editingAsset?.days_past_due || 0} />
            </div>
            <div className="space-y-2">
              <Label>Внутренний рейтинг</Label>
              <Select defaultValue={editingAsset?.internal_rating || 'BBB'}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C'].map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Стоимость залога</Label>
              <Input type="number" defaultValue={editingAsset?.collateral_value || 0} />
            </div>
            <div className="space-y-2">
              <Label>Дата погашения</Label>
              <Input type="date" defaultValue={editingAsset?.maturity_date} />
            </div>
            <div className="space-y-2">
              <Label>Процентная ставка (%)</Label>
              <Input type="number" step="0.1" defaultValue={(editingAsset?.interest_rate || 0.12) * 100} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAssetDialog(false);
              setEditingAsset(null);
            }}>
              Отмена
            </Button>
            <Button onClick={() => {
              toast({ title: 'Актив сохранен' });
              setShowAssetDialog(false);
              setEditingAsset(null);
            }}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IFRS9Page;
