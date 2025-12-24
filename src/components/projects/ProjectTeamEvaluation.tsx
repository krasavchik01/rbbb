import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Star, Lock, Users, AlertTriangle, CheckCircle } from 'lucide-react';
import { UserRole } from '@/types/roles';

interface TeamMember {
  userId: string;
  userName: string;
  role: UserRole;
}

interface Evaluation {
  id: string;
  projectId: string;
  evaluatedUserId: string;
  evaluatedUserName: string;
  evaluatedUserRole: UserRole;
  evaluatorId: string;
  evaluatorName: string;
  evaluatorRole: UserRole;
  rating: number;
  comment: string;
  isAnonymous: boolean;
  createdAt: string;
}

interface Props {
  projectId: string;
  projectStatus: string;
  teamMembers: TeamMember[];
}

// Иерархия ролей (кто выше кого)
const ROLE_HIERARCHY: Record<UserRole, number> = {
  ceo: 100,
  deputy_director: 90,
  admin: 85,
  partner: 80,
  manager_3: 70,
  manager_2: 65,
  manager_1: 60,
  senior_auditor: 50,
  auditor: 40,
  junior_auditor: 30,
  assistant: 20,
  hr: 15,
  procurement: 10,
};

// Названия ролей
const ROLE_NAMES: Record<UserRole, string> = {
  ceo: 'Генеральный директор',
  deputy_director: 'Заместитель директора',
  admin: 'Администратор',
  partner: 'Партнёр',
  manager_3: 'Менеджер 3 уровня',
  manager_2: 'Менеджер 2 уровня',
  manager_1: 'Менеджер 1 уровня',
  senior_auditor: 'Старший аудитор',
  auditor: 'Аудитор',
  junior_auditor: 'Младший аудитор',
  assistant: 'Ассистент',
  hr: 'HR специалист',
  procurement: 'Закупки',
};

const RATING_LABELS: Record<number, string> = {
  1: 'Неудовлетворительно',
  2: 'Ниже ожиданий',
  3: 'Соответствует ожиданиям',
  4: 'Превышает ожидания',
  5: 'Отлично',
};

export function ProjectTeamEvaluation({ projectId, projectStatus, teamMembers }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [rating, setRating] = useState(4);
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  const isProjectCompleted = projectStatus === 'completed' || projectStatus === 'завершен';
  const currentUserRole = user?.role as UserRole;
  const currentUserLevel = ROLE_HIERARCHY[currentUserRole] || 0;

  // Определяем кого текущий пользователь может оценивать
  const evaluatableMembers = useMemo(() => {
    if (!user) return [];

    return teamMembers.filter(member => {
      if (member.userId === user.id) return false; // Себя не оцениваем

      const memberLevel = ROLE_HIERARCHY[member.role] || 0;

      // Партнер может оценивать всех ниже себя
      if (currentUserRole === 'partner') {
        return memberLevel < currentUserLevel;
      }

      // Менеджеры могут оценивать тех кто ниже + АНОНИМНО партнера
      if (currentUserRole.startsWith('manager_')) {
        // Могут оценивать ассистентов и аудиторов
        if (memberLevel < currentUserLevel) return true;
        // Могут анонимно оценивать партнера
        if (member.role === 'partner') return true;
        return false;
      }

      // Аудиторы и ассистенты могут ТОЛЬКО анонимно оценивать своего менеджера
      if (['senior_auditor', 'auditor', 'junior_auditor', 'assistant'].includes(currentUserRole)) {
        // Только менеджеров
        if (member.role.startsWith('manager_')) return true;
        return false;
      }

      return false;
    });
  }, [teamMembers, user, currentUserRole, currentUserLevel]);

  // Должна ли быть анонимной оценка конкретного члена
  const mustBeAnonymous = (member: TeamMember): boolean => {
    if (!user) return false;

    const memberLevel = ROLE_HIERARCHY[member.role] || 0;

    // Менеджер оценивает партнера - анонимно
    if (currentUserRole.startsWith('manager_') && member.role === 'partner') {
      return true;
    }

    // Ассистенты/аудиторы оценивают менеджеров - анонимно
    if (['senior_auditor', 'auditor', 'junior_auditor', 'assistant'].includes(currentUserRole)
        && member.role.startsWith('manager_')) {
      return true;
    }

    return false;
  };

  useEffect(() => {
    loadEvaluations();
  }, [projectId]);

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'x-user-id': user?.id || '',
    'x-user-name': user?.name || '',
    'x-user-role': user?.role || '',
  });

  const loadEvaluations = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/project-evaluations/${projectId}`, {
        headers: getHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setEvaluations(data);
      }
    } catch (error) {
      console.error('Failed to load evaluations:', error);
    } finally {
      setLoading(false);
    }
  };

  const openEvaluationDialog = (member: TeamMember) => {
    setSelectedMember(member);
    setIsAnonymous(mustBeAnonymous(member));
    setRating(4);
    setComment('');
    setDialogOpen(true);
  };

  const submitEvaluation = async () => {
    if (!selectedMember || !user) return;

    try {
      const response = await fetch('/api/project-evaluations', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          projectId,
          evaluatedUserId: selectedMember.userId,
          evaluatedUserName: selectedMember.userName,
          evaluatedUserRole: selectedMember.role,
          rating,
          comment,
          isAnonymous,
        }),
      });

      if (!response.ok) throw new Error('Failed to create evaluation');

      const newEval = await response.json();
      setEvaluations([...evaluations, newEval]);

      toast({
        title: 'Оценка сохранена',
        description: isAnonymous ? 'Ваша анонимная оценка сохранена' : 'Оценка успешно сохранена',
      });

      setDialogOpen(false);
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить оценку',
        variant: 'destructive',
      });
    }
  };

  // Проверяем уже поставленные оценки
  const hasEvaluated = (memberId: string): boolean => {
    return evaluations.some(e =>
      e.evaluatedUserId === memberId && e.evaluatorId === user?.id
    );
  };

  // Для управляющих - показываем все оценки
  const isManagement = ['ceo', 'deputy_director', 'admin', 'partner'].includes(currentUserRole);

  // Мои полученные оценки (не анонимные или анонимные если я руководитель)
  const myReceivedEvaluations = evaluations.filter(e => {
    if (e.evaluatedUserId !== user?.id) return false;
    // Анонимные оценки руководство не видит кто ставил, но видит факт оценки
    return true;
  });

  if (!isProjectCompleted) {
    return (
      <Card className="p-6 border-yellow-500/30 bg-yellow-500/5">
        <div className="flex items-center gap-3 text-yellow-600">
          <AlertTriangle className="w-6 h-6" />
          <div>
            <h3 className="font-semibold">Проект ещё не завершён</h3>
            <p className="text-sm text-muted-foreground">
              Оценка команды станет доступна после завершения проекта
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (loading) {
    return <Card className="p-6"><p className="text-muted-foreground">Загрузка...</p></Card>;
  }

  return (
    <div className="space-y-6">
      {/* Кого можно оценить */}
      {evaluatableMembers.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Оцените участников проекта
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {evaluatableMembers.map(member => {
              const alreadyEvaluated = hasEvaluated(member.userId);
              const anonymousRequired = mustBeAnonymous(member);

              return (
                <div
                  key={member.userId}
                  className={`p-4 border rounded-lg ${alreadyEvaluated ? 'bg-green-500/5 border-green-500/30' : 'hover:border-primary/50'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium">{member.userName}</p>
                      <p className="text-xs text-muted-foreground">{ROLE_NAMES[member.role]}</p>
                    </div>
                    {anonymousRequired && (
                      <Badge variant="secondary" className="text-xs">
                        <Lock className="w-3 h-3 mr-1" />
                        Анонимно
                      </Badge>
                    )}
                  </div>

                  {alreadyEvaluated ? (
                    <div className="flex items-center gap-2 text-green-600 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      Оценка поставлена
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-2"
                      onClick={() => openEvaluationDialog(member)}
                    >
                      Оценить
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Полученные мной оценки */}
      {myReceivedEvaluations.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Ваши оценки в этом проекте</h3>
          <div className="space-y-3">
            {myReceivedEvaluations.map(evaluation => (
              <div key={evaluation.id} className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(star => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${star <= evaluation.rating ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300'}`}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-medium">{RATING_LABELS[evaluation.rating]}</span>
                  {evaluation.isAnonymous && (
                    <Badge variant="secondary" className="text-xs ml-auto">
                      <Lock className="w-3 h-3 mr-1" />
                      Анонимно
                    </Badge>
                  )}
                </div>
                {!evaluation.isAnonymous && (
                  <p className="text-xs text-muted-foreground mb-2">
                    От: {evaluation.evaluatorName}
                  </p>
                )}
                {evaluation.comment && (
                  <p className="text-sm bg-secondary/50 p-2 rounded">{evaluation.comment}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Все оценки проекта (для руководства) */}
      {isManagement && evaluations.length > 0 && (
        <Card className="p-6 border-blue-500/30 bg-blue-500/5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5 text-blue-500" />
            Все оценки проекта (только для руководства)
          </h3>
          <div className="space-y-3">
            {evaluations.map(evaluation => (
              <div key={evaluation.id} className="p-4 border rounded-lg bg-background">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium">{evaluation.evaluatedUserName}</p>
                    <p className="text-xs text-muted-foreground">{ROLE_NAMES[evaluation.evaluatedUserRole]}</p>
                  </div>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(star => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${star <= evaluation.rating ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300'}`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {evaluation.isAnonymous ? 'Анонимная оценка' : `От: ${evaluation.evaluatorName}`}
                </p>
                {evaluation.comment && (
                  <p className="text-sm bg-secondary/30 p-2 rounded mt-2">{evaluation.comment}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Диалог оценки */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Оценка: {selectedMember?.userName}
            </DialogTitle>
            <DialogDescription>
              {selectedMember && (
                <>
                  {ROLE_NAMES[selectedMember.role]}
                  {isAnonymous && (
                    <Badge variant="secondary" className="ml-2">
                      <Lock className="w-3 h-3 mr-1" />
                      Анонимная оценка
                    </Badge>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Звёзды */}
            <div>
              <p className="text-sm font-medium mb-2">
                Оценка: {RATING_LABELS[rating]}
              </p>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(star => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className={`p-2 rounded transition ${
                      star <= rating
                        ? 'text-yellow-500 bg-yellow-500/10'
                        : 'text-gray-300 hover:text-yellow-300'
                    }`}
                  >
                    <Star className="w-8 h-8 fill-current" />
                  </button>
                ))}
              </div>
            </div>

            {/* Комментарий */}
            <div>
              <p className="text-sm font-medium mb-2">Комментарий</p>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Опишите работу участника на проекте..."
                rows={4}
              />
            </div>

            {isAnonymous && (
              <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg text-sm">
                <div className="flex items-center gap-2 text-purple-600 font-medium mb-1">
                  <Lock className="w-4 h-4" />
                  Анонимная оценка
                </div>
                <p className="text-muted-foreground">
                  Ваше имя не будет показано оцениваемому. Руководство увидит только факт анонимной оценки.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={submitEvaluation}>
              Сохранить оценку
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
