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
import { Star, Plus, Edit, Trash2, Eye, Lock, Users } from 'lucide-react';

interface TeamEvaluation {
  id: string;
  projectId: string;
  evaluatedPersonId: string;
  evaluatorId: string;
  evaluatorName: string;
  evaluatorRole: string;
  type: 'partner_by_manager' | 'manager_by_team' | 'team_by_manager';
  rating: number;
  comment: string;
  teamMembers?: string[];
  isAnonymous: boolean;
  createdAt: string;
  updatedAt: string;
}

const EVALUATION_TYPES = {
  partner_by_manager: { label: 'Партнер оценен менеджером', icon: '👔' },
  manager_by_team: { label: 'Менеджер оценен командой (анонимно)', icon: '🔒' },
  team_by_manager: { label: 'Команда оценена менеджером', icon: '👥' },
};

const RATING_LABELS = {
  1: 'Неудовлетворительно',
  2: 'Плохо',
  3: 'Удовлетворительно',
  4: 'Хорошо',
  5: 'Отлично',
};

export default function TeamEvaluation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [evaluations, setEvaluations] = useState<TeamEvaluation[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  const [formData, setFormData] = useState({
    evaluatedPersonId: '',
    type: 'manager_by_team' as const,
    rating: 5,
    comment: '',
  });

  useEffect(() => {
    if (selectedProject) {
      loadEvaluations();
    }
  }, [selectedProject]);

  const getHeaders = () => {
    return {
      'Content-Type': 'application/json',
      'x-user-id': user?.id || 'unknown',
      'x-user-name': user?.name || 'Unknown',
      'x-user-role': user?.role || 'member',
    };
  };

  const loadEvaluations = async () => {
    if (!selectedProject) return;

    try {
      const response = await fetch(`/api/project-evaluations/${selectedProject}`, {
        headers: getHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setEvaluations(data);
      }
    } catch (error) {
      console.error('Failed to load evaluations:', error);
    }
  };

  const createEvaluation = async () => {
    if (!formData.evaluatedPersonId || !selectedProject) {
      toast({
        title: 'Ошибка',
        description: 'Выберите человека для оценки',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch('/api/project-evaluations', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          projectId: selectedProject,
          evaluatedPersonId: formData.evaluatedPersonId,
          type: formData.type,
          rating: formData.rating,
          comment: formData.comment,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create evaluation');
      }

      const newEval = await response.json();
      setEvaluations([...evaluations, newEval]);

      toast({
        title: 'Оценка создана',
        description: 'Оценка сохранена в систему',
      });

      setFormData({
        evaluatedPersonId: '',
        type: 'manager_by_team',
        rating: 5,
        comment: '',
      });
      setDialogOpen(false);
    } catch (error) {
      console.error('Failed to create evaluation:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать оценку',
        variant: 'destructive',
      });
    }
  };

  const updateEvaluation = async (id: string) => {
    try {
      const response = await fetch(`/api/project-evaluations/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          rating: formData.rating,
          comment: formData.comment,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update evaluation');
      }

      const updated = await response.json();
      setEvaluations(evaluations.map(e => e.id === id ? updated : e));

      toast({
        title: 'Оценка обновлена',
        description: 'Изменения сохранены',
      });

      setEditingId(null);
      setDialogOpen(false);
      setFormData({
        evaluatedPersonId: '',
        type: 'manager_by_team',
        rating: 5,
        comment: '',
      });
    } catch (error) {
      console.error('Failed to update evaluation:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить оценку',
        variant: 'destructive',
      });
    }
  };

  const deleteEvaluation = async (id: string) => {
    if (!confirm('Удалить оценку?')) return;

    try {
      const response = await fetch(`/api/project-evaluations/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to delete evaluation');
      }

      setEvaluations(evaluations.filter(e => e.id !== id));

      toast({
        title: 'Оценка удалена',
        description: 'Оценка удалена из системы',
      });
    } catch (error) {
      console.error('Failed to delete evaluation:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить оценку',
        variant: 'destructive',
      });
    }
  };

  const handleEditClick = (evaluation: TeamEvaluation) => {
    setEditingId(evaluation.id);
    setFormData({
      evaluatedPersonId: evaluation.evaluatedPersonId,
      type: evaluation.type,
      rating: evaluation.rating,
      comment: evaluation.comment,
    });
    setDialogOpen(true);
  };

  const filteredEvaluations = evaluations.filter(evaluation => {
    if (activeTab === 'my') {
      return evaluation.evaluatorId === user?.id;
    } else if (activeTab === 'received') {
      return evaluation.evaluatedPersonId === user?.id;
    }
    return true;
  });

  const stats = {
    total: evaluations.length,
    byMe: evaluations.filter(e => e.evaluatorId === user?.id).length,
    forMe: evaluations.filter(e => e.evaluatedPersonId === user?.id).length,
  };

  const isManagement = ['ceo', 'admin', 'deputy_director'].includes(user?.role || '');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Оценка команды</h1>
          <p className="text-muted-foreground">Система оценки после завершения проекта</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingId(null);
              setFormData({
                evaluatedPersonId: '',
                type: 'manager_by_team',
                rating: 5,
                comment: '',
              });
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Добавить оценку
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingId ? 'Редактировать оценку' : 'Новая оценка'}
              </DialogTitle>
              <DialogDescription>
                Оцените члена команды или партнера
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="project">Проект</Label>
                <Input
                  id="project"
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  placeholder="ID проекта"
                />
              </div>

              <div>
                <Label htmlFor="person">Оцениваемый человек</Label>
                <Input
                  id="person"
                  value={formData.evaluatedPersonId}
                  onChange={(e) =>
                    setFormData({ ...formData, evaluatedPersonId: e.target.value })
                  }
                  placeholder="ID человека"
                />
              </div>

              <div>
                <Label htmlFor="type">Тип оценки</Label>
                <Select value={formData.type} onValueChange={(v: any) =>
                  setFormData({ ...formData, type: v })
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EVALUATION_TYPES).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="rating" className="mb-2 block">
                  Оценка: {RATING_LABELS[formData.rating as keyof typeof RATING_LABELS]}
                </Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setFormData({ ...formData, rating: star })}
                      className={`p-2 rounded transition ${
                        star <= formData.rating
                          ? 'text-yellow-500 bg-yellow-500/10'
                          : 'text-gray-300 hover:text-yellow-300'
                      }`}
                    >
                      <Star className="w-6 h-6 fill-current" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="comment">Комментарий</Label>
                <Textarea
                  id="comment"
                  value={formData.comment}
                  onChange={(e) =>
                    setFormData({ ...formData, comment: e.target.value })
                  }
                  placeholder="Детальный комментарий к оценке..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Отмена
              </Button>
              <Button
                onClick={() =>
                  editingId
                    ? updateEvaluation(editingId)
                    : createEvaluation()
                }
              >
                {editingId ? 'Обновить' : 'Создать'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Project selector */}
      <Card className="p-4">
        <Label htmlFor="select-project">Выберите проект для просмотра оценок</Label>
        <Input
          id="select-project"
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          placeholder="Введите ID проекта..."
          className="mt-2"
        />
      </Card>

      {selectedProject && (
        <>
          {/* Statistics */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Всего оценок</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center space-x-2">
                <Edit className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.byMe}</p>
                  <p className="text-xs text-muted-foreground">Я создал</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center space-x-2">
                <Eye className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.forMe}</p>
                  <p className="text-xs text-muted-foreground">Обо мне</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Evaluations Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="all">Все ({stats.total})</TabsTrigger>
              <TabsTrigger value="my">Мои ({stats.byMe})</TabsTrigger>
              <TabsTrigger value="received">Обо мне ({stats.forMe})</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-4">
              {filteredEvaluations.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground">
                  Нет оценок
                </Card>
              ) : (
                filteredEvaluations.map((evaluation) => {
                  const typeInfo = EVALUATION_TYPES[evaluation.type];

                  return (
                    <Card key={evaluation.id} className="p-6">
                      <div className="space-y-4">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-2xl">{typeInfo.icon}</span>
                              <h3 className="text-lg font-semibold">{typeInfo.label}</h3>
                              {evaluation.isAnonymous && (
                                <Badge className="bg-purple-500 text-white">
                                  <Lock className="w-3 h-3 mr-1" />
                                  Анонимно
                                </Badge>
                              )}
                            </div>

                            {/* Rating Stars */}
                            <div className="flex gap-1 mb-3">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-5 h-5 ${
                                    star <= evaluation.rating
                                      ? 'fill-yellow-500 text-yellow-500'
                                      : 'text-gray-300'
                                  }`}
                                />
                              ))}
                              <span className="ml-2 text-sm font-medium">
                                {RATING_LABELS[evaluation.rating as keyof typeof RATING_LABELS]}
                              </span>
                            </div>

                            {/* Details */}
                            <div className="text-sm text-muted-foreground space-y-1">
                              {!evaluation.isAnonymous && (
                                <div>
                                  Оценивающий: {evaluation.evaluatorName} ({evaluation.evaluatorRole})
                                </div>
                              )}
                              <div>Создано: {new Date(evaluation.createdAt).toLocaleDateString('ru-RU')}</div>
                            </div>

                            {/* Comment */}
                            {evaluation.comment && (
                              <p className="text-sm mt-3 p-3 bg-secondary/50 rounded border">
                                {evaluation.comment}
                              </p>
                            )}
                          </div>

                          {/* Actions */}
                          {evaluation.evaluatorId === user?.id && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditClick(evaluation)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive"
                                onClick={() => deleteEvaluation(evaluation.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Management section - only for management roles */}
      {isManagement && (
        <Card className="p-6 border-blue-500/30 bg-blue-500/5">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold">Видно только руководству</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Анонимные оценки команды видны только руководству (CEO, администратор, заместитель директора).
            Эта информация используется для оценки производительности менеджеров.
          </p>
        </Card>
      )}
    </div>
  );
}
