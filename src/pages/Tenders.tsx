/**
 * Раздел "Тендеры" для отдела закупок
 * Статистика тендеров: поданные, ценовые предложения, выигранные, проигранные
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
  Edit
} from 'lucide-react';

// Типы данных
interface Tender {
  id: string;
  number: string;
  clientName: string;
  projectName: string;
  submittedDate: string;
  deadlineDate: string;
  estimatedAmount: number; // Предварительная оценка
  proposedAmount: number; // Предложенная цена
  status: 'submitted' | 'won' | 'lost' | 'pending';
  comment: string;
  winProbability?: number; // % вероятности выигрыша
  competitorsCount?: number;
  resultDate?: string;
  actualAmount?: number; // Фактическая сумма контракта (если выиграли)
}

export default function Tenders() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTender, setSelectedTender] = useState<Tender | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

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
    total: tenders.length,
    submitted: tenders.filter(t => t.status === 'submitted' || t.status === 'pending').length,
    won: tenders.filter(t => t.status === 'won').length,
    lost: tenders.filter(t => t.status === 'lost').length,
    totalEstimated: tenders.reduce((sum, t) => sum + t.estimatedAmount, 0),
    totalProposed: tenders.reduce((sum, t) => sum + t.proposedAmount, 0),
    totalWon: tenders.filter(t => t.status === 'won').reduce((sum, t) => sum + (t.actualAmount || 0), 0),
    winRate: tenders.filter(t => t.status === 'won' || t.status === 'lost').length > 0
      ? (tenders.filter(t => t.status === 'won').length / tenders.filter(t => t.status === 'won' || t.status === 'lost').length) * 100
      : 0,
  };

  const getStatusBadge = (status: Tender['status']) => {
    switch (status) {
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

  return (
    <div className="space-y-6 animate-fade-in p-4 md:p-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-warning bg-clip-text text-transparent">
            📋 Тендеры
          </h1>
          <p className="text-muted-foreground mt-1">
            Статистика и управление тендерами отдела закупок
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} className="bg-gradient-to-r from-blue-600 to-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Добавить тендер
        </Button>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/20">
          <div className="text-2xl font-bold text-blue-400">{stats.total}</div>
          <div className="text-sm text-muted-foreground">Всего тендеров</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 border-yellow-500/20">
          <div className="text-2xl font-bold text-yellow-400">{stats.submitted}</div>
          <div className="text-sm text-muted-foreground">На рассмотрении</div>
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
          <div className="text-sm text-muted-foreground">Процент побед</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border-emerald-500/20">
          <div className="text-lg font-bold text-emerald-400">
            {(stats.totalWon / 1000000).toFixed(1)}М ₸
          </div>
          <div className="text-sm text-muted-foreground">Выиграно сумма</div>
        </Card>
      </div>

      {/* Фильтры */}
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
            <SelectItem value="submitted">Поданные</SelectItem>
            <SelectItem value="pending">Ожидание</SelectItem>
            <SelectItem value="won">Выигранные</SelectItem>
            <SelectItem value="lost">Проигранные</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Список тендеров */}
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
                  </div>
                  <h4 className="text-lg font-semibold text-blue-400 mb-1">{tender.clientName}</h4>
                  <p className="text-muted-foreground mb-3">{tender.projectName}</p>

                  {/* Суммы */}
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

                  {/* Даты и метрики */}
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-3">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Подан: {new Date(tender.submittedDate).toLocaleDateString('ru-RU')}
                    </div>
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

                  {/* Комментарий */}
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">💬 Комментарий:</div>
                    <p className="text-sm">{tender.comment}</p>
                  </div>
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
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 md:flex-none"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Редактировать
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Диалог добавления тендера */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Добавить новый тендер</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Номер тендера</Label>
              <Input placeholder="Т-2025-006" />
            </div>
            <div>
              <Label>Клиент</Label>
              <Input placeholder="Название клиента" />
            </div>
            <div className="col-span-2">
              <Label>Название проекта</Label>
              <Input placeholder="Описание тендера" />
            </div>
            <div>
              <Label>Дата подачи</Label>
              <Input type="date" />
            </div>
            <div>
              <Label>Дедлайн</Label>
              <Input type="date" />
            </div>
            <div>
              <Label>Предварительная оценка (₸)</Label>
              <Input type="number" placeholder="15000000" />
            </div>
            <div>
              <Label>Предложенная цена (₸)</Label>
              <Input type="number" placeholder="14500000" />
            </div>
            <div>
              <Label>Вероятность выигрыша (%)</Label>
              <Input type="number" placeholder="75" min="0" max="100" />
            </div>
            <div>
              <Label>Количество конкурентов</Label>
              <Input type="number" placeholder="5" />
            </div>
            <div className="col-span-2">
              <Label>Комментарий</Label>
              <Textarea placeholder="Особенности тендера, сильные стороны..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={() => {
              toast({
                title: "✅ Тендер добавлен",
                description: "Новый тендер успешно добавлен в систему",
              });
              setIsAddDialogOpen(false);
            }}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог просмотра тендера */}
      {selectedTender && (
        <Dialog open={!!selectedTender} onOpenChange={() => setSelectedTender(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                {selectedTender.number} - {selectedTender.clientName}
                {getStatusBadge(selectedTender.status)}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Проект:</h4>
                <p>{selectedTender.projectName}</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4">
                  <div className="text-sm text-muted-foreground mb-1">Предварительная оценка</div>
                  <div className="text-xl font-bold text-blue-400">
                    {selectedTender.estimatedAmount.toLocaleString('ru-RU')} ₸
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-sm text-muted-foreground mb-1">Предложенная цена</div>
                  <div className="text-xl font-bold text-purple-400">
                    {selectedTender.proposedAmount.toLocaleString('ru-RU')} ₸
                  </div>
                </Card>
                {selectedTender.actualAmount && (
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">Фактическая сумма</div>
                    <div className="text-xl font-bold text-green-400">
                      {selectedTender.actualAmount.toLocaleString('ru-RU')} ₸
                    </div>
                  </Card>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Дата подачи:</h4>
                  <p>{new Date(selectedTender.submittedDate).toLocaleDateString('ru-RU')}</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Дедлайн:</h4>
                  <p>{new Date(selectedTender.deadlineDate).toLocaleDateString('ru-RU')}</p>
                </div>
                {selectedTender.winProbability && (
                  <div>
                    <h4 className="font-semibold mb-2">Вероятность выигрыша:</h4>
                    <p>{selectedTender.winProbability}%</p>
                  </div>
                )}
                {selectedTender.competitorsCount && (
                  <div>
                    <h4 className="font-semibold mb-2">Конкурентов:</h4>
                    <p>{selectedTender.competitorsCount}</p>
                  </div>
                )}
              </div>
              <div>
                <h4 className="font-semibold mb-2">Комментарий:</h4>
                <Card className="p-4 bg-muted">
                  <p>{selectedTender.comment}</p>
                </Card>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

