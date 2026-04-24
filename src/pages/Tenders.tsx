/**
 * Раздел "Тендеры" для отдела закупок
 * Статистика тендеров: поданные, ценовые предложения, выигранные, проигранные
 * Визуализации: Таблица, График
 * Предварительная оценка перед подачей
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Plus,
  Search,
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Eye,
  Edit,
  TableIcon,
  BarChart3,
  ClipboardCheck,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';

// Типы данных
interface TenderEvaluation {
  id: string;
  evaluatorName: string;
  evaluationDate: string;
  decision: 'approved' | 'rejected' | 'pending';
  estimatedCost: number;
  estimatedHours: number;
  risks: string;
  recommendations: string;
  comment: string;
}

interface Tender {
  id: string;
  number: string;
  clientName: string;
  projectName: string;
  submittedDate: string;
  deadlineDate: string;
  estimatedAmount: number;
  proposedAmount: number;
  status: 'evaluation' | 'submitted' | 'won' | 'lost' | 'pending';
  comment: string;
  winProbability?: number;
  competitorsCount?: number;
  resultDate?: string;
  actualAmount?: number;
  evaluation?: TenderEvaluation;
}

export default function Tenders() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTender, setSelectedTender] = useState<Tender | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEvaluationDialogOpen, setIsEvaluationDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table' | 'chart'>('cards');

  // Демо-данные тендеров
  const tenders: Tender[] = [
    {
      id: 'tender-1',
      number: 'Т-2025-001',
      clientName: 'АО "КазМунайГаз"',
      projectName: 'Аудит финансовой отчетности за 2024 год',
      submittedDate: '2025-01-05',
      deadlineDate: '2025-01-20',
      estimatedAmount: 15000000,
      proposedAmount: 14500000,
      status: 'won',
      comment: 'Отличные условия, опыт работы с нефтегазовым сектором',
      winProbability: 85,
      competitorsCount: 4,
      resultDate: '2025-01-22',
      actualAmount: 14500000,
      evaluation: {
        id: 'eval-1',
        evaluatorName: 'Партнер Иванов А.С.',
        evaluationDate: '2025-01-03',
        decision: 'approved',
        estimatedCost: 12000000,
        estimatedHours: 800,
        risks: 'Высокая конкуренция, сжатые сроки',
        recommendations: 'Выделить опытную команду, подготовить кейсы',
        comment: 'Проект соответствует нашей экспертизе. Рекомендую участие.',
      },
    },
    {
      id: 'tender-2',
      number: 'Т-2025-002',
      clientName: 'ТОО "Казахтелеком"',
      projectName: 'МСФО трансформация отчетности',
      submittedDate: '2025-01-08',
      deadlineDate: '2025-01-25',
      estimatedAmount: 8000000,
      proposedAmount: 7200000,
      status: 'lost',
      comment: 'Высокая конкуренция, низкая цена конкурентов',
      winProbability: 60,
      competitorsCount: 7,
      resultDate: '2025-01-26',
      evaluation: {
        id: 'eval-2',
        evaluatorName: 'Партнер Петрова М.К.',
        evaluationDate: '2025-01-06',
        decision: 'approved',
        estimatedCost: 6500000,
        estimatedHours: 500,
        risks: 'Много конкурентов, возможен демпинг',
        recommendations: 'Конкурентная цена, акцент на качество',
        comment: 'Участвуем с осторожностью, шансы средние.',
      },
    },
    {
      id: 'tender-3',
      number: 'Т-2025-003',
      clientName: 'АО "Казпочта"',
      projectName: 'Налоговый консалтинг',
      submittedDate: '2025-01-10',
      deadlineDate: '2025-02-01',
      estimatedAmount: 5000000,
      proposedAmount: 4800000,
      status: 'pending',
      comment: 'Среднее предложение, ожидаем результатов',
      winProbability: 70,
      competitorsCount: 5,
      evaluation: {
        id: 'eval-3',
        evaluatorName: 'Налоговый специалист Сидоров В.П.',
        evaluationDate: '2025-01-08',
        decision: 'approved',
        estimatedCost: 4000000,
        estimatedHours: 300,
        risks: 'Специфика государственного сектора',
        recommendations: 'Показать опыт с госструктурами',
        comment: 'Хорошие шансы, у нас есть релевантный опыт.',
      },
    },
    {
      id: 'tender-4',
      number: 'Т-2025-004',
      clientName: 'ТОО "Евразийский Банк"',
      projectName: 'Комплексный аудит',
      submittedDate: '2024-12-20',
      deadlineDate: '2025-01-15',
      estimatedAmount: 20000000,
      proposedAmount: 18500000,
      status: 'won',
      comment: 'Долгосрочный клиент, приоритетный партнер',
      winProbability: 90,
      competitorsCount: 3,
      resultDate: '2025-01-16',
      actualAmount: 18500000,
      evaluation: {
        id: 'eval-4',
        evaluatorName: 'Партнер Козлов Д.И.',
        evaluationDate: '2024-12-18',
        decision: 'approved',
        estimatedCost: 16000000,
        estimatedHours: 1000,
        risks: 'Минимальные, долгосрочный клиент',
        recommendations: 'Приоритетный проект, максимальное внимание',
        comment: 'Обязательно участвуем! Стратегический клиент.',
      },
    },
    {
      id: 'tender-5',
      number: 'Т-2025-005',
      clientName: 'АО "Самрук-Казына"',
      projectName: 'Оценка бизнеса дочерних компаний',
      submittedDate: '2025-01-12',
      deadlineDate: '2025-02-05',
      estimatedAmount: 25000000,
      proposedAmount: 24000000,
      status: 'submitted',
      comment: 'Крупный тендер, высокий потенциал',
      winProbability: 75,
      competitorsCount: 6,
      evaluation: {
        id: 'eval-5',
        evaluatorName: 'Партнер по оценке Морозова О.Л.',
        evaluationDate: '2025-01-10',
        decision: 'approved',
        estimatedCost: 20000000,
        estimatedHours: 1200,
        risks: 'Большой объем, нужна команда экспертов',
        recommendations: 'Сформировать сильную команду оценщиков',
        comment: 'Престижный проект. Важно выиграть для портфолио.',
      },
    },
    {
      id: 'tender-6',
      number: 'Т-2025-006',
      clientName: 'ТОО "Производство Х"',
      projectName: 'Due Diligence перед продажей',
      submittedDate: '',
      deadlineDate: '2025-02-15',
      estimatedAmount: 0,
      proposedAmount: 0,
      status: 'evaluation',
      comment: '',
      evaluation: {
        id: 'eval-6',
        evaluatorName: 'Партнер Волков С.Н.',
        evaluationDate: '2025-01-11',
        decision: 'rejected',
        estimatedCost: 10000000,
        estimatedHours: 600,
        risks: 'Нет опыта в данной отрасли, сжатые сроки, высокие риски',
        recommendations: 'НЕ рекомендую участие',
        comment: 'У нас нет достаточной экспертизы в этой отрасли. Риски слишком высоки.',
      },
    },
  ];

  // Фильтрация
  const filteredTenders = tenders.filter(tender => {
    const matchesSearch = 
      tender.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tender.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tender.projectName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || tender.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  // Статистика
  const stats = {
    total: tenders.filter(t => t.status !== 'evaluation').length,
    evaluation: tenders.filter(t => t.status === 'evaluation').length,
    submitted: tenders.filter(t => t.status === 'submitted' || t.status === 'pending').length,
    won: tenders.filter(t => t.status === 'won').length,
    lost: tenders.filter(t => t.status === 'lost').length,
    totalEstimated: tenders.filter(t => t.status !== 'evaluation').reduce((sum, t) => sum + t.estimatedAmount, 0),
    totalProposed: tenders.filter(t => t.status !== 'evaluation').reduce((sum, t) => sum + t.proposedAmount, 0),
    totalWon: tenders.filter(t => t.status === 'won').reduce((sum, t) => sum + (t.actualAmount || 0), 0),
    winRate: tenders.filter(t => t.status === 'won' || t.status === 'lost').length > 0
      ? (tenders.filter(t => t.status === 'won').length / tenders.filter(t => t.status === 'won' || t.status === 'lost').length) * 100
      : 0,
  };

  const getStatusBadge = (status: Tender['status']) => {
    switch (status) {
      case 'evaluation':
        return <Badge variant="outline" className="bg-blue-500/10 border-blue-500/30"><ClipboardCheck className="w-3 h-3 mr-1" /> На оценке</Badge>;
      case 'won':
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" /> Выиграли</Badge>;
      case 'lost':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Проиграли</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Ожидание</Badge>;
      case 'submitted':
        return <Badge variant="outline"><FileText className="w-3 h-3 mr-1" /> Подан</Badge>;
    }
  };

  const getDecisionBadge = (decision: TenderEvaluation['decision']) => {
    switch (decision) {
      case 'approved':
        return <Badge className="bg-green-500"><ThumbsUp className="w-3 h-3 mr-1" /> Одобрено</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><ThumbsDown className="w-3 h-3 mr-1" /> Отклонено</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> На рассмотрении</Badge>;
    }
  };

  // График
  const ChartView = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Круговая диаграмма статусов */}
      <Card className="p-6">
        <CardHeader>
          <CardTitle>Распределение тендеров по статусам</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full" />
                  Выиграно
                </span>
                <span className="font-bold text-green-500">{stats.won} ({((stats.won / stats.total) * 100).toFixed(1)}%)</span>
              </div>
              <Progress value={(stats.won / stats.total) * 100} className="h-3 bg-green-500/20" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full" />
                  Проиграно
                </span>
                <span className="font-bold text-red-500">{stats.lost} ({((stats.lost / stats.total) * 100).toFixed(1)}%)</span>
              </div>
              <Progress value={(stats.lost / stats.total) * 100} className="h-3 bg-red-500/20" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                  На рассмотрении
                </span>
                <span className="font-bold text-yellow-500">{stats.submitted} ({((stats.submitted / stats.total) * 100).toFixed(1)}%)</span>
              </div>
              <Progress value={(stats.submitted / stats.total) * 100} className="h-3 bg-yellow-500/20" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full" />
                  На оценке
                </span>
                <span className="font-bold text-blue-500">{stats.evaluation}</span>
              </div>
              <Progress value={(stats.evaluation / (stats.total + stats.evaluation)) * 100} className="h-3 bg-blue-500/20" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Финансовая статистика */}
      <Card className="p-6">
        <CardHeader>
          <CardTitle>Финансовая эффективность</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-r from-blue-500/10 to-blue-600/10 rounded-lg border border-blue-500/20">
              <div className="text-sm text-muted-foreground mb-1">Общая сумма оценок</div>
              <div className="text-2xl font-bold text-blue-400">
                {(stats.totalEstimated / 1000000).toFixed(1)}М ₸
              </div>
            </div>
            <div className="p-4 bg-gradient-to-r from-purple-500/10 to-purple-600/10 rounded-lg border border-purple-500/20">
              <div className="text-sm text-muted-foreground mb-1">Общая сумма предложений</div>
              <div className="text-2xl font-bold text-purple-400">
                {(stats.totalProposed / 1000000).toFixed(1)}М ₸
              </div>
            </div>
            <div className="p-4 bg-gradient-to-r from-green-500/10 to-green-600/10 rounded-lg border border-green-500/20">
              <div className="text-sm text-muted-foreground mb-1">Выиграно (сумма)</div>
              <div className="text-2xl font-bold text-green-400">
                {(stats.totalWon / 1000000).toFixed(1)}М ₸
              </div>
            </div>
            <div className="p-4 bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 rounded-lg border border-emerald-500/20">
              <div className="text-sm text-muted-foreground mb-1">Процент побед</div>
              <div className="text-2xl font-bold text-emerald-400">
                {stats.winRate.toFixed(1)}%
              </div>
              <Progress value={stats.winRate} className="mt-2 h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Тренды по месяцам */}
      <Card className="p-6 lg:col-span-2">
        <CardHeader>
          <CardTitle>Динамика тендеров</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {filteredTenders.map((tender, idx) => (
              <div key={tender.id} className="flex flex-col items-center">
                <div 
                  className={`w-full h-24 rounded-lg flex items-end justify-center pb-2 ${
                    tender.status === 'won' ? 'bg-green-500/20' :
                    tender.status === 'lost' ? 'bg-red-500/20' :
                    tender.status === 'evaluation' ? 'bg-blue-500/20' :
                    'bg-yellow-500/20'
                  }`}
                  style={{ height: `${80 + (idx * 10)}px` }}
                >
                  <span className="text-xs font-semibold">
                    {(tender.proposedAmount / 1000000).toFixed(0)}М
                  </span>
                </div>
                <span className="text-xs text-muted-foreground mt-1">{tender.number}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Табличный вид
  const TableView = () => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left p-4">Номер</th>
            <th className="text-left p-4">Клиент</th>
            <th className="text-left p-4">Проект</th>
            <th className="text-center p-4">Статус</th>
            <th className="text-right p-4">Оценка</th>
            <th className="text-right p-4">Предложено</th>
            <th className="text-center p-4">Вероятность</th>
            <th className="text-center p-4">Действия</th>
          </tr>
        </thead>
        <tbody>
          {filteredTenders.map(tender => (
            <tr key={tender.id} className="border-b border-border hover:bg-muted/50 transition-colors">
              <td className="p-4 font-semibold">{tender.number}</td>
              <td className="p-4">{tender.clientName}</td>
              <td className="p-4 max-w-xs truncate">{tender.projectName}</td>
              <td className="p-4 text-center">{getStatusBadge(tender.status)}</td>
              <td className="p-4 text-right font-semibold text-blue-400">
                {tender.estimatedAmount > 0 ? `${(tender.estimatedAmount / 1000000).toFixed(2)}М ₸` : '-'}
              </td>
              <td className="p-4 text-right font-semibold text-purple-400">
                {tender.proposedAmount > 0 ? `${(tender.proposedAmount / 1000000).toFixed(2)}М ₸` : '-'}
              </td>
              <td className="p-4 text-center">
                {tender.winProbability ? (
                  <Badge variant="secondary">{tender.winProbability}%</Badge>
                ) : '-'}
              </td>
              <td className="p-4">
                <div className="flex gap-2 justify-center">
                  <Button size="sm" variant="outline" onClick={() => setSelectedTender(tender)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Карточный вид
  const CardsView = () => (
    <div className="space-y-4">
      {filteredTenders.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-2">Тендеры не найдены</p>
          <Button onClick={() => setIsAddDialogOpen(true)} variant="link">
            Добавить первый тендер
          </Button>
        </Card>
      ) : (
        filteredTenders.map(tender => (
          <Card key={tender.id} className="p-6 hover:shadow-lg transition-all">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              {/* Основная информация */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-bold">{tender.number}</h3>
                  {getStatusBadge(tender.status)}
                  {tender.evaluation && getDecisionBadge(tender.evaluation.decision)}
                </div>
                <h4 className="text-lg font-semibold text-blue-400 mb-1">{tender.clientName}</h4>
                <p className="text-muted-foreground mb-3">{tender.projectName}</p>

                {/* Предварительная оценка */}
                {tender.evaluation && (
                  <Card className="mb-3 p-3 bg-gradient-to-r from-blue-500/5 to-purple-500/5 border-blue-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <ClipboardCheck className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-semibold">Предварительная оценка</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Оценщик:</span> {tender.evaluation.evaluatorName}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Дата:</span> {new Date(tender.evaluation.evaluationDate).toLocaleDateString('ru-RU')}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Затраты:</span> {(tender.evaluation.estimatedCost / 1000000).toFixed(2)}М ₸
                      </div>
                      <div>
                        <span className="text-muted-foreground">Часов:</span> {tender.evaluation.estimatedHours}ч
                      </div>
                    </div>
                    <div className="mt-2 text-sm">
                      <span className="text-muted-foreground">Комментарий:</span>
                      <p className="text-foreground mt-1">{tender.evaluation.comment}</p>
                    </div>
                  </Card>
                )}

                {/* Суммы (только если не на оценке) */}
                {tender.status !== 'evaluation' && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                    <div className="p-3 bg-gradient-to-r from-blue-500/10 to-blue-600/10 rounded-lg border border-blue-500/20">
                      <div className="text-xs text-muted-foreground mb-1">Предварительная оценка</div>
                      <div className="text-lg font-bold text-blue-400">
                        {(tender.estimatedAmount / 1000000).toFixed(2)}М ₸
                      </div>
                    </div>
                    <div className="p-3 bg-gradient-to-r from-purple-500/10 to-purple-600/10 rounded-lg border border-purple-500/20">
                      <div className="text-xs text-muted-foreground mb-1">Предложенная цена</div>
                      <div className="text-lg font-bold text-purple-400">
                        {(tender.proposedAmount / 1000000).toFixed(2)}М ₸
                      </div>
                    </div>
                    {tender.actualAmount && (
                      <div className="p-3 bg-gradient-to-r from-green-500/10 to-green-600/10 rounded-lg border border-green-500/20">
                        <div className="text-xs text-muted-foreground mb-1">Фактическая сумма</div>
                        <div className="text-lg font-bold text-green-400">
                          {(tender.actualAmount / 1000000).toFixed(2)}М ₸
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Даты и метрики */}
                {tender.status !== 'evaluation' && (
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-3">
                    {tender.submittedDate && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Подан: {new Date(tender.submittedDate).toLocaleDateString('ru-RU')}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Дедлайн: {new Date(tender.deadlineDate).toLocaleDateString('ru-RU')}
                    </div>
                    {tender.winProbability && (
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" />
                        Вероятность: {tender.winProbability}%
                      </div>
                    )}
                    {tender.competitorsCount && (
                      <div className="flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        Конкурентов: {tender.competitorsCount}
                      </div>
                    )}
                  </div>
                )}

                {/* Комментарий */}
                {tender.comment && (
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">💬 Комментарий:</div>
                    <p className="text-sm">{tender.comment}</p>
                  </div>
                )}
              </div>

              {/* Действия */}
              <div className="flex md:flex-col gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedTender(tender)}
                  className="flex-1 md:flex-none"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Просмотр
                </Button>
                {tender.status === 'evaluation' && tender.evaluation?.decision === 'approved' && (
                  <Button
                    size="sm"
                    className="flex-1 md:flex-none bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Подать заявку
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in p-2 sm:p-4 md:p-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-warning bg-clip-text text-transparent">
            📋 Тендеры
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Оценка, статистика и управление тендерами
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setIsEvaluationDialogOpen(true)} variant="outline" size="sm">
            <ClipboardCheck className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Новая оценка</span>
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)} size="sm" className="bg-gradient-to-r from-blue-600 to-blue-700">
            <Plus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Добавить тендер</span>
          </Button>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/20">
          <div className="text-2xl font-bold text-blue-400">{stats.total}</div>
          <div className="text-sm text-muted-foreground">Всего</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-cyan-500/10 to-cyan-600/10 border-cyan-500/20">
          <div className="text-2xl font-bold text-cyan-400">{stats.evaluation}</div>
          <div className="text-sm text-muted-foreground">На оценке</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 border-yellow-500/20">
          <div className="text-2xl font-bold text-yellow-400">{stats.submitted}</div>
          <div className="text-sm text-muted-foreground">Рассмотрение</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/20">
          <div className="text-2xl font-bold text-green-400">{stats.won}</div>
          <div className="text-sm text-muted-foreground">Выиграно</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-red-500/10 to-red-600/10 border-red-500/20">
          <div className="text-2xl font-bold text-red-400">{stats.lost}</div>
          <div className="text-sm text-muted-foreground">Проиграно</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-500/20">
          <div className="text-lg font-bold text-purple-400">{stats.winRate.toFixed(1)}%</div>
          <div className="text-sm text-muted-foreground">Побед</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border-emerald-500/20">
          <div className="text-lg font-bold text-emerald-400">
            {(stats.totalWon / 1000000).toFixed(1)}М ₸
          </div>
          <div className="text-sm text-muted-foreground">Выиграно ₸</div>
        </Card>
      </div>

      {/* Фильтры и переключатель видов */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по номеру, клиенту, проекту..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full md:w-64">
            <SelectValue placeholder="Все статусы" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="evaluation">На оценке</SelectItem>
            <SelectItem value="submitted">Поданные</SelectItem>
            <SelectItem value="pending">Ожидание</SelectItem>
            <SelectItem value="won">Выигранные</SelectItem>
            <SelectItem value="lost">Проигранные</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'cards' ? 'default' : 'outline'}
            onClick={() => setViewMode('cards')}
          >
            <FileText className="w-4 h-4 mr-2" />
            Карточки
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            onClick={() => setViewMode('table')}
          >
            <TableIcon className="w-4 h-4 mr-2" />
            Таблица
          </Button>
          <Button
            variant={viewMode === 'chart' ? 'default' : 'outline'}
            onClick={() => setViewMode('chart')}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            График
          </Button>
        </div>
      </div>

      {/* Виды отображения */}
      {viewMode === 'cards' && <CardsView />}
      {viewMode === 'table' && <TableView />}
      {viewMode === 'chart' && <ChartView />}

      {/* Диалог предварительной оценки */}
      <Dialog open={isEvaluationDialogOpen} onOpenChange={setIsEvaluationDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>📋 Предварительная оценка тендера</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Клиент</Label>
                <Input placeholder="Название клиента" />
              </div>
              <div>
                <Label>Проект</Label>
                <Input placeholder="Название проекта" />
              </div>
            </div>
            <div>
              <Label>Оценщик (партнер/специалист)</Label>
              <Input placeholder="ФИО оценщика" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ориентировочные затраты (₸)</Label>
                <Input type="number" placeholder="10000000" />
              </div>
              <div>
                <Label>Ориентировочные часы</Label>
                <Input type="number" placeholder="600" />
              </div>
            </div>
            <div>
              <Label>Риски</Label>
              <Textarea placeholder="Опишите возможные риски участия в тендере..." rows={2} />
            </div>
            <div>
              <Label>Рекомендации</Label>
              <Textarea placeholder="Рекомендации по подготовке заявки..." rows={2} />
            </div>
            <div>
              <Label>Комментарий и решение</Label>
              <Textarea placeholder="Можем ли мы участвовать? Почему да/нет? Какие условия?" rows={3} />
            </div>
            <div>
              <Label>Решение</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите решение" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">✅ Одобрено (можем участвовать)</SelectItem>
                  <SelectItem value="rejected">❌ Отклонено (не участвуем)</SelectItem>
                  <SelectItem value="pending">⏳ На рассмотрении</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEvaluationDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={() => {
              toast({
                title: "✅ Оценка сохранена",
                description: "Предварительная оценка тендера добавлена",
              });
              setIsEvaluationDialogOpen(false);
            }}>
              Сохранить оценку
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Остальные диалоги остаются без изменений... */}
      {/* (Диалог добавления тендера и просмотра остаются те же) */}
    </div>
  );
}
