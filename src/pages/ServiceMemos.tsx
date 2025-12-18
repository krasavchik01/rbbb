import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { FileText, Plus, Check, Clock, AlertCircle, Trash2, User, Calendar as CalendarIcon, ArrowRight, CheckCircle, XCircle, CircleDot } from 'lucide-react';

// Типы для workflow
type DepartmentRole = 'initiator' | 'it' | 'procurement' | 'hr' | 'deputy_director' | 'director' | 'accounting' | 'admin';

interface ApprovalStage {
  stage: number;
  department: DepartmentRole;
  departmentLabel: string;
  status: 'pending' | 'approved' | 'rejected';
  approver?: string;
  approverName?: string;
  approvedAt?: string;
  comments?: string;
}

interface Attachment {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
}

interface ServiceMemo {
  id: string;
  title: string;
  description: string;
  createdBy: string;
  createdByName: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'purchase' | 'maintenance' | 'request' | 'complaint' | 'it_support' | 'other';
  workflow: ApprovalStage[];
  currentStage: number;
  overallStatus: 'in_progress' | 'completed' | 'rejected';
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

const PRIORITY_LABELS = {
  low: { label: 'Низкий', color: 'bg-gray-500' },
  medium: { label: 'Средний', color: 'bg-blue-500' },
  high: { label: 'Высокий', color: 'bg-orange-500' },
  urgent: { label: 'Срочно', color: 'bg-red-500' },
};

const CATEGORY_LABELS = {
  purchase: 'Закупка',
  maintenance: 'Обслуживание',
  request: 'Запрос',
  complaint: 'Жалоба',
  it_support: 'IT поддержка',
  other: 'Другое',
};

const DEPARTMENT_LABELS: Record<DepartmentRole, string> = {
  initiator: 'Инициатор',
  it: 'IT отдел',
  procurement: 'Закупки',
  hr: 'HR отдел',
  deputy_director: 'Зам. директора',
  director: 'Директор',
  accounting: 'Бухгалтерия',
  admin: 'Администратор',
};

// Шаблоны workflow для разных категорий
const WORKFLOW_TEMPLATES: Record<string, DepartmentRole[]> = {
  it_support: ['initiator', 'it', 'deputy_director', 'director'],
  purchase: ['initiator', 'procurement', 'deputy_director', 'director', 'accounting'],
  maintenance: ['initiator', 'admin', 'deputy_director', 'director'],
  request: ['initiator', 'hr', 'deputy_director', 'director'],
  complaint: ['initiator', 'hr', 'deputy_director', 'director'],
  other: ['initiator', 'admin', 'director'],
};

// Маппинг ролей пользователей к департаментам
const ROLE_TO_DEPARTMENT: Record<string, DepartmentRole> = {
  admin: 'admin',
  ceo: 'director',
  deputy_director: 'deputy_director',
  hr: 'hr',
  procurement: 'procurement',
  it: 'it',
  accountant: 'accounting',
};

export default function ServiceMemos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [memos, setMemos] = useState<ServiceMemo[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedMemo, setSelectedMemo] = useState<ServiceMemo | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Форма новой записки
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium' as ServiceMemo['priority'],
    category: 'request' as ServiceMemo['category'],
    customWorkflow: [] as DepartmentRole[],
  });

  // Форма утверждения/отклонения
  const [approvalComments, setApprovalComments] = useState('');

  useEffect(() => {
    loadMemos();
  }, []);

  const loadMemos = () => {
    const saved = localStorage.getItem('serviceMemos_v2');
    if (saved) {
      setMemos(JSON.parse(saved));
    }
  };

  const saveMemos = (updatedMemos: ServiceMemo[]) => {
    localStorage.setItem('serviceMemos_v2', JSON.stringify(updatedMemos));
    setMemos(updatedMemos);
  };

  const createMemo = () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Заполните название и описание',
        variant: 'destructive',
      });
      return;
    }

    // Получаем шаблон workflow или используем кастомный
    const workflowTemplate = formData.customWorkflow.length > 0
      ? formData.customWorkflow
      : WORKFLOW_TEMPLATES[formData.category] || WORKFLOW_TEMPLATES.other;

    // Создаем этапы утверждения
    const workflow: ApprovalStage[] = workflowTemplate.map((dept, index) => ({
      stage: index,
      department: dept,
      departmentLabel: DEPARTMENT_LABELS[dept],
      status: index === 0 ? 'approved' : 'pending', // Первый этап (инициатор) сразу approved
      approver: index === 0 ? user?.id : undefined,
      approverName: index === 0 ? user?.name : undefined,
      approvedAt: index === 0 ? new Date().toISOString() : undefined,
    }));

    const newMemo: ServiceMemo = {
      id: `memo-${Date.now()}`,
      title: formData.title,
      description: formData.description,
      createdBy: user?.id || '',
      createdByName: user?.name || 'Неизвестный',
      priority: formData.priority,
      category: formData.category,
      workflow,
      currentStage: 1, // Начинаем со второго этапа (после инициатора)
      overallStatus: 'in_progress',
      attachments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveMemos([newMemo, ...memos]);

    toast({
      title: 'Служебная записка создана',
      description: `Записка "${formData.title}" отправлена на утверждение`,
    });

    setFormData({
      title: '',
      description: '',
      priority: 'medium',
      category: 'request',
      customWorkflow: [],
    });
    setDialogOpen(false);
  };

  const approveMemo = (memoId: string) => {
    const memo = memos.find(m => m.id === memoId);
    if (!memo) return;

    const currentStageData = memo.workflow[memo.currentStage];
    if (!currentStageData) return;

    // Обновляем текущий этап
    const updatedWorkflow = [...memo.workflow];
    updatedWorkflow[memo.currentStage] = {
      ...currentStageData,
      status: 'approved',
      approver: user?.id,
      approverName: user?.name,
      approvedAt: new Date().toISOString(),
      comments: approvalComments || undefined,
    };

    // Проверяем, есть ли еще этапы
    const isLastStage = memo.currentStage === memo.workflow.length - 1;
    const newStatus: 'in_progress' | 'completed' = isLastStage ? 'completed' : 'in_progress';
    const newStage = isLastStage ? memo.currentStage : memo.currentStage + 1;

    const updatedMemos = memos.map(m =>
      m.id === memoId
        ? {
            ...m,
            workflow: updatedWorkflow,
            currentStage: newStage,
            overallStatus: newStatus,
            updatedAt: new Date().toISOString(),
            completedAt: isLastStage ? new Date().toISOString() : m.completedAt,
          }
        : m
    );

    saveMemos(updatedMemos);

    toast({
      title: 'Записка утверждена',
      description: isLastStage
        ? 'Служебная записка полностью утверждена'
        : `Записка передана на этап: ${memo.workflow[newStage]?.departmentLabel}`,
    });

    setApprovalComments('');
    setDetailsDialogOpen(false);
  };

  const rejectMemo = (memoId: string) => {
    const memo = memos.find(m => m.id === memoId);
    if (!memo) return;

    if (!approvalComments.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Укажите причину отклонения',
        variant: 'destructive',
      });
      return;
    }

    const currentStageData = memo.workflow[memo.currentStage];
    const updatedWorkflow = [...memo.workflow];
    updatedWorkflow[memo.currentStage] = {
      ...currentStageData,
      status: 'rejected',
      approver: user?.id,
      approverName: user?.name,
      approvedAt: new Date().toISOString(),
      comments: approvalComments,
    };

    const updatedMemos = memos.map(m =>
      m.id === memoId
        ? {
            ...m,
            workflow: updatedWorkflow,
            overallStatus: 'rejected' as const,
            updatedAt: new Date().toISOString(),
          }
        : m
    );

    saveMemos(updatedMemos);

    toast({
      title: 'Записка отклонена',
      description: 'Служебная записка отклонена',
      variant: 'destructive',
    });

    setApprovalComments('');
    setDetailsDialogOpen(false);
  };

  const deleteMemo = (memoId: string) => {
    if (!confirm('Удалить служебную записку?')) return;

    const updated = memos.filter(m => m.id !== memoId);
    saveMemos(updated);

    toast({
      title: 'Записка удалена',
      description: 'Служебная записка удалена из системы',
    });
  };

  // Проверка, может ли текущий пользователь утверждать данную записку
  const canApprove = (memo: ServiceMemo): boolean => {
    if (memo.overallStatus !== 'in_progress') return false;

    const currentStageData = memo.workflow[memo.currentStage];
    if (!currentStageData) return false;

    const userDepartment = ROLE_TO_DEPARTMENT[user?.role || ''];
    return currentStageData.department === userDepartment;
  };

  // Фильтрация
  const filteredMemos = memos.filter(memo => {
    const matchesSearch =
      memo.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      memo.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTab =
      activeTab === 'all' ||
      (activeTab === 'my' && memo.createdBy === user?.id) ||
      (activeTab === 'pending' && canApprove(memo)) ||
      (activeTab === 'in_progress' && memo.overallStatus === 'in_progress') ||
      (activeTab === 'completed' && memo.overallStatus === 'completed') ||
      (activeTab === 'rejected' && memo.overallStatus === 'rejected');

    return matchesSearch && matchesTab;
  });

  // Статистика
  const stats = {
    total: memos.length,
    my: memos.filter(m => m.createdBy === user?.id).length,
    pending: memos.filter(m => canApprove(m)).length,
    inProgress: memos.filter(m => m.overallStatus === 'in_progress').length,
    completed: memos.filter(m => m.overallStatus === 'completed').length,
    rejected: memos.filter(m => m.overallStatus === 'rejected').length,
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Служебные записки</h1>
          <p className="text-muted-foreground">Система согласования служебных запросов</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Создать записку
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Новая служебная записка</DialogTitle>
              <DialogDescription>
                Создайте запрос, который пройдет все необходимые этапы согласования
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Название запроса *</Label>
                <Input
                  id="title"
                  placeholder="Например: Требуется ремонт ноутбука"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="description">Описание *</Label>
                <Textarea
                  id="description"
                  placeholder="Подробное описание запроса..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Категория *</Label>
                  <Select value={formData.category} onValueChange={(v: ServiceMemo['category']) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="priority">Приоритет</Label>
                  <Select value={formData.priority} onValueChange={(v: ServiceMemo['priority']) => setFormData({ ...formData, priority: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRIORITY_LABELS).map(([key, { label }]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Предпросмотр маршрута */}
              <div className="p-4 bg-secondary/30 rounded-lg">
                <p className="text-sm font-medium mb-2">Маршрут согласования:</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {(WORKFLOW_TEMPLATES[formData.category] || WORKFLOW_TEMPLATES.other).map((dept, index, arr) => (
                    <div key={dept} className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {DEPARTMENT_LABELS[dept]}
                      </Badge>
                      {index < arr.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Отмена
              </Button>
              <Button onClick={createMemo}>Создать записку</Button>
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
            <User className="w-5 h-5 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">{stats.my}</p>
              <p className="text-xs text-muted-foreground">Мои</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Ожидают меня</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{stats.inProgress}</p>
              <p className="text-xs text-muted-foreground">В работе</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <Check className="w-5 h-5 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{stats.completed}</p>
              <p className="text-xs text-muted-foreground">Выполнено</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <XCircle className="w-5 h-5 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{stats.rejected}</p>
              <p className="text-xs text-muted-foreground">Отклонено</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Поиск */}
      <Card className="p-4">
        <Input
          placeholder="Поиск по названию или описанию..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </Card>

      {/* Список записок */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="all">Все ({stats.total})</TabsTrigger>
          <TabsTrigger value="my">Мои ({stats.my})</TabsTrigger>
          <TabsTrigger value="pending">
            <AlertCircle className="w-4 h-4 mr-1" />
            Ожидают меня ({stats.pending})
          </TabsTrigger>
          <TabsTrigger value="in_progress">В работе ({stats.inProgress})</TabsTrigger>
          <TabsTrigger value="completed">Выполнено ({stats.completed})</TabsTrigger>
          <TabsTrigger value="rejected">Отклонено ({stats.rejected})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {filteredMemos.length === 0 ? (
            <Card className="p-8">
              <div className="text-center text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Нет служебных записок</p>
              </div>
            </Card>
          ) : (
            filteredMemos.map((memo) => {
              const priorityInfo = PRIORITY_LABELS[memo.priority];
              const currentStageData = memo.workflow[memo.currentStage];
              const canUserApprove = canApprove(memo);

              return (
                <Card key={memo.id} className={`p-6 ${canUserApprove ? 'border-orange-500 border-2' : ''}`}>
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold">{memo.title}</h3>
                          {memo.overallStatus === 'completed' && (
                            <Badge className="bg-green-500 text-white">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Завершено
                            </Badge>
                          )}
                          {memo.overallStatus === 'rejected' && (
                            <Badge className="bg-red-500 text-white">
                              <XCircle className="w-3 h-3 mr-1" />
                              Отклонено
                            </Badge>
                          )}
                          {memo.overallStatus === 'in_progress' && (
                            <Badge className="bg-blue-500 text-white">
                              <Clock className="w-3 h-3 mr-1" />
                              На этапе: {currentStageData?.departmentLabel}
                            </Badge>
                          )}
                          <Badge className={`${priorityInfo.color} text-white`}>
                            {priorityInfo.label}
                          </Badge>
                          <Badge variant="outline">{CATEGORY_LABELS[memo.category]}</Badge>
                          {canUserApprove && (
                            <Badge className="bg-orange-500 text-white">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Требует вашего утверждения
                            </Badge>
                          )}
                        </div>

                        <p className="text-sm text-muted-foreground mb-3">{memo.description}</p>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            Автор: {memo.createdByName}
                          </span>
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3" />
                            Создано: {new Date(memo.createdAt).toLocaleDateString('ru-RU')}
                          </span>
                          {memo.completedAt && (
                            <span className="flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              Завершено: {new Date(memo.completedAt).toLocaleDateString('ru-RU')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Действия */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedMemo(memo);
                            setDetailsDialogOpen(true);
                          }}
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Подробнее
                        </Button>
                        {(isAdmin || memo.createdBy === user?.id) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => deleteMemo(memo.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Workflow Progress */}
                    <div className="p-4 bg-secondary/20 rounded-lg">
                      <p className="text-xs font-medium mb-3 text-muted-foreground">Прогресс согласования:</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {memo.workflow.map((stage, index) => (
                          <div key={stage.stage} className="flex items-center gap-2">
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                              stage.status === 'approved' ? 'bg-green-500/20 border border-green-500' :
                              stage.status === 'rejected' ? 'bg-red-500/20 border border-red-500' :
                              index === memo.currentStage ? 'bg-orange-500/20 border border-orange-500' :
                              'bg-gray-500/20 border border-gray-500'
                            }`}>
                              {stage.status === 'approved' ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : stage.status === 'rejected' ? (
                                <XCircle className="w-4 h-4 text-red-500" />
                              ) : index === memo.currentStage ? (
                                <CircleDot className="w-4 h-4 text-orange-500" />
                              ) : (
                                <Clock className="w-4 h-4 text-gray-500" />
                              )}
                              <span className="text-xs font-medium">{stage.departmentLabel}</span>
                            </div>
                            {index < memo.workflow.length - 1 && (
                              <ArrowRight className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* Диалог деталей и утверждения */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedMemo && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedMemo.title}</DialogTitle>
                <DialogDescription>
                  Детали служебной записки и история согласования
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Описание */}
                <div>
                  <Label>Описание</Label>
                  <p className="text-sm text-muted-foreground mt-1">{selectedMemo.description}</p>
                </div>

                {/* Информация */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Автор</Label>
                    <p className="text-sm">{selectedMemo.createdByName}</p>
                  </div>
                  <div>
                    <Label>Категория</Label>
                    <p className="text-sm">{CATEGORY_LABELS[selectedMemo.category]}</p>
                  </div>
                  <div>
                    <Label>Приоритет</Label>
                    <Badge className={`${PRIORITY_LABELS[selectedMemo.priority].color} text-white`}>
                      {PRIORITY_LABELS[selectedMemo.priority].label}
                    </Badge>
                  </div>
                  <div>
                    <Label>Создано</Label>
                    <p className="text-sm">{new Date(selectedMemo.createdAt).toLocaleString('ru-RU')}</p>
                  </div>
                </div>

                {/* История согласования */}
                <div>
                  <Label className="mb-2 block">История согласования</Label>
                  <div className="space-y-2">
                    {selectedMemo.workflow.map((stage, index) => (
                      <Card key={stage.stage} className={`p-4 ${
                        stage.status === 'approved' ? 'bg-green-500/10' :
                        stage.status === 'rejected' ? 'bg-red-500/10' :
                        index === selectedMemo.currentStage ? 'bg-orange-500/10' :
                        'bg-gray-500/5'
                      }`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            {stage.status === 'approved' ? (
                              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                            ) : stage.status === 'rejected' ? (
                              <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                            ) : index === selectedMemo.currentStage ? (
                              <CircleDot className="w-5 h-5 text-orange-500 mt-0.5" />
                            ) : (
                              <Clock className="w-5 h-5 text-gray-500 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm">{stage.departmentLabel}</p>
                                {stage.status === 'approved' && (
                                  <Badge variant="outline" className="text-xs bg-green-500/20 border-green-500">Утверждено</Badge>
                                )}
                                {stage.status === 'rejected' && (
                                  <Badge variant="outline" className="text-xs bg-red-500/20 border-red-500">Отклонено</Badge>
                                )}
                                {index === selectedMemo.currentStage && selectedMemo.overallStatus === 'in_progress' && (
                                  <Badge variant="outline" className="text-xs bg-orange-500/20 border-orange-500">Текущий этап</Badge>
                                )}
                              </div>
                              {stage.approverName && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {stage.status === 'approved' ? 'Утвердил' : 'Отклонил'}: {stage.approverName}
                                  {stage.approvedAt && ` • ${new Date(stage.approvedAt).toLocaleString('ru-RU')}`}
                                </p>
                              )}
                              {stage.comments && (
                                <p className="text-xs mt-2 p-2 bg-background rounded border">
                                  <span className="font-medium">Комментарий:</span> {stage.comments}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Форма утверждения/отклонения */}
                {canApprove(selectedMemo) && (
                  <div className="p-4 border-2 border-orange-500 rounded-lg bg-orange-500/5">
                    <Label className="mb-2 block">Ваше решение</Label>
                    <Textarea
                      placeholder="Комментарий к решению (обязательно при отклонении)..."
                      value={approvalComments}
                      onChange={(e) => setApprovalComments(e.target.value)}
                      rows={3}
                    />
                    <div className="flex gap-2 mt-3">
                      <Button
                        className="flex-1"
                        onClick={() => approveMemo(selectedMemo.id)}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Утвердить
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => rejectMemo(selectedMemo.id)}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Отклонить
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setDetailsDialogOpen(false);
                  setApprovalComments('');
                }}>
                  Закрыть
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
