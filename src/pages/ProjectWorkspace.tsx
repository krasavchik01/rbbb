import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Check, 
  Upload,
  FileText,
  CheckCircle2,
  Circle,
  ChevronRight,
  Save,
  AlertCircle
} from "lucide-react";
import { useTemplates, useProjects } from "@/hooks/useDataStore";
import { ProjectTemplate, ProcedureElement, ELEMENT_TYPE_ICONS } from "@/types/methodology";
import { ProjectData, ElementData } from "@/types/methodology";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useProjectDataSync } from "@/hooks/useProjectDataSync";

export default function ProjectWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { templates } = useTemplates();
  const { projects } = useProjects();
  const { toast } = useToast();
  const { user } = useAuth();

  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [template, setTemplate] = useState<ProjectTemplate | null>(null);
  const [project, setProject] = useState<any>(null);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  
  // Хук для синхронизации с Supabase (работает ТОЛЬКО если id существует)
  const { loadProjectData, saveProjectData: syncSaveProjectData, syncStatus, forceSync } = 
    useProjectDataSync(id || '');

  // Загрузка данных проекта (с синхронизацией)
  useEffect(() => {
    if (!id) return;

    const foundProject = projects.find(p => p.id === id);
    if (!foundProject) {
      navigate('/projects');
      return;
    }

    setProject(foundProject);

    // Загружаем данные с автоматической синхронизацией
    loadProjectData().then(data => {
      if (data) {
        setProjectData(data);

        // Находим шаблон
        const foundTemplate = templates.find(t => t.id === data.templateId);
        if (foundTemplate) {
          setTemplate(foundTemplate);
        }
      }
    });
  }, [id, projects, templates, loadProjectData]);

  const saveProjectDataLocal = (data: ProjectData) => {
    setProjectData(data);
    // Автоматически синхронизируем с Supabase (если доступен)
    syncSaveProjectData(data);
  };

  const handleElementUpdate = (stageId: string, elementId: string, updates: Partial<ElementData>) => {
    if (!projectData) return;

    const newData = { ...projectData };
    
    if (!newData.stagesData[stageId]) {
      newData.stagesData[stageId] = {};
    }

    const existingData = newData.stagesData[stageId][elementId] || {
      elementId,
      completed: false
    };

    newData.stagesData[stageId][elementId] = {
      ...existingData,
      ...updates
    };

    // Пересчитываем прогресс
    const totalElements = template?.stages.reduce((sum, stage) => sum + stage.elements.length, 0) || 0;
    let completedElements = 0;

    Object.values(newData.stagesData).forEach(stageData => {
      Object.values(stageData).forEach(elementData => {
        if (elementData.completed) completedElements++;
      });
    });

    newData.completionStatus = {
      totalElements,
      completedElements,
      percentage: totalElements > 0 ? Math.round((completedElements / totalElements) * 100) : 0
    };

    saveProjectDataLocal(newData);

    toast({
      title: "Сохранено",
      description: "Изменения сохранены",
    });
  };

  const toggleElementComplete = (stageId: string, elementId: string) => {
    if (!projectData) return;

    const elementData = projectData.stagesData[stageId]?.[elementId];
    const isCompleted = elementData?.completed || false;

    handleElementUpdate(stageId, elementId, {
      completed: !isCompleted,
      completedAt: !isCompleted ? new Date().toISOString() : undefined,
      completedBy: !isCompleted ? user?.id : undefined
    });
  };

  const renderElementInput = (stageId: string, element: ProcedureElement) => {
    const elementData = projectData?.stagesData[stageId]?.[element.id];
    const isCompleted = elementData?.completed || false;

    switch (element.type) {
      case 'header':
        return (
          <div className="py-4">
            <h3 className="text-lg font-semibold text-primary">{element.title}</h3>
            {element.description && (
              <p className="text-sm text-muted-foreground mt-1">{element.description}</p>
            )}
          </div>
        );

      case 'question':
        return (
          <Card className={`p-4 ${isCompleted ? 'bg-green-50 border-green-200' : ''}`}>
            <div className="flex items-start gap-3">
              <Button
                variant={isCompleted ? "default" : "outline"}
                size="icon"
                className={isCompleted ? "bg-green-500 hover:bg-green-600" : ""}
                onClick={() => toggleElementComplete(stageId, element.id)}
              >
                {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
              </Button>
              <div className="flex-1 space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{ELEMENT_TYPE_ICONS[element.type]}</span>
                    <h4 className="font-semibold">{element.title}</h4>
                    {element.required && <Badge variant="destructive">Обязательно</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground font-medium">{element.question}</p>
                </div>
                <div>
                  <Label htmlFor={`answer-${element.id}`}>Ваш ответ:</Label>
                  <Textarea
                    id={`answer-${element.id}`}
                    value={elementData?.answer || ''}
                    onChange={(e) => handleElementUpdate(stageId, element.id, { answer: e.target.value })}
                    placeholder="Введите ваш ответ..."
                    rows={4}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          </Card>
        );

      case 'procedure':
        return (
          <Card className={`p-4 ${isCompleted ? 'bg-green-50 border-green-200' : ''}`}>
            <div className="flex items-start gap-3">
              <Button
                variant={isCompleted ? "default" : "outline"}
                size="icon"
                className={isCompleted ? "bg-green-500 hover:bg-green-600" : ""}
                onClick={() => toggleElementComplete(stageId, element.id)}
              >
                {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
              </Button>
              <div className="flex-1 space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{ELEMENT_TYPE_ICONS[element.type]}</span>
                    <h4 className="font-semibold">{element.title}</h4>
                    {element.required && <Badge variant="destructive">Обязательно</Badge>}
                  </div>
                  {element.description && (
                    <p className="text-sm text-muted-foreground">{element.description}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor={`work-${element.id}`}>Описание выполненной работы:</Label>
                  <Textarea
                    id={`work-${element.id}`}
                    value={elementData?.workDescription || ''}
                    onChange={(e) => handleElementUpdate(stageId, element.id, { workDescription: e.target.value })}
                    placeholder="Опишите что было сделано..."
                    rows={3}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor={`comments-${element.id}`}>Комментарии / Несоответствия:</Label>
                  <Textarea
                    id={`comments-${element.id}`}
                    value={elementData?.comments || ''}
                    onChange={(e) => handleElementUpdate(stageId, element.id, { comments: e.target.value })}
                    placeholder="Укажите комментарии или найденные несоответствия..."
                    rows={2}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          </Card>
        );

      case 'file':
        return (
          <Card className={`p-4 ${isCompleted ? 'bg-green-50 border-green-200' : ''}`}>
            <div className="flex items-start gap-3">
              <Button
                variant={isCompleted ? "default" : "outline"}
                size="icon"
                className={isCompleted ? "bg-green-500 hover:bg-green-600" : ""}
                onClick={() => toggleElementComplete(stageId, element.id)}
              >
                {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
              </Button>
              <div className="flex-1 space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{ELEMENT_TYPE_ICONS[element.type]}</span>
                    <h4 className="font-semibold">{element.title}</h4>
                    {element.required && <Badge variant="destructive">Обязательно</Badge>}
                  </div>
                  {element.description && (
                    <p className="text-sm text-muted-foreground">{element.description}</p>
                  )}
                </div>
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium mb-1">Нажмите для загрузки файла</p>
                  <p className="text-xs text-muted-foreground">
                    {element.config?.allowedFileTypes?.join(', ') || 'Любой формат'} • 
                    Макс. {element.config?.maxFileSize || 10} МБ
                  </p>
                  <input type="file" className="hidden" accept={element.config?.allowedFileTypes?.join(',')} />
                </div>
                {elementData?.files && elementData.files.length > 0 && (
                  <div className="space-y-2">
                    {elementData.files.map((file, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
                        <FileText className="w-4 h-4" />
                        <span className="text-sm flex-1">{file.name}</span>
                        <Badge variant="outline">{(file.size / 1024).toFixed(1)} КБ</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>
        );

      case 'signature':
        return (
          <Card className={`p-4 ${isCompleted ? 'bg-green-50 border-green-200' : 'border-yellow-200 bg-yellow-50'}`}>
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{ELEMENT_TYPE_ICONS[element.type]}</span>
                  <h4 className="font-semibold">{element.title}</h4>
                  {element.required && <Badge variant="destructive">Обязательно</Badge>}
                </div>
                {element.description && (
                  <p className="text-sm text-muted-foreground mb-3">{element.description}</p>
                )}
                {isCompleted ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">Утверждено</span>
                    {elementData?.signedAt && (
                      <span className="text-sm text-muted-foreground">
                        • {new Date(elementData.signedAt).toLocaleString('ru-RU')}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-yellow-600">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-medium">Ожидает утверждения ({element.requiredRole})</span>
                  </div>
                )}
              </div>
              {user?.role === element.requiredRole && !isCompleted && (
                <Button
                  onClick={() => handleElementUpdate(stageId, element.id, {
                    completed: true,
                    signedBy: user.id,
                    signedAt: new Date().toISOString()
                  })}
                  className="bg-green-500 hover:bg-green-600"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Утвердить
                </Button>
              )}
            </div>
          </Card>
        );

      default:
        return null;
    }
  };

  if (!project || !template || !projectData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-lg">Загрузка проекта...</div>
        </div>
      </div>
    );
  }

  const currentStage = template.stages[currentStageIndex];
  const stageProgress = currentStage ? 
    (Object.values(projectData.stagesData[currentStage.id] || {}).filter(e => e.completed).length / currentStage.elements.length) * 100 
    : 0;

  return (
    <div className="space-y-6 animate-fade-in p-4 md:p-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <p className="text-sm text-muted-foreground">{template.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Индикатор синхронизации */}
          {syncStatus.isSyncing && (
            <Badge variant="outline" className="animate-pulse">
              🔄 Синхронизация...
            </Badge>
          )}
          {!syncStatus.isSyncing && syncStatus.isOnline && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              ✅ Синхронизировано
            </Badge>
          )}
          {!syncStatus.isSyncing && !syncStatus.isOnline && (
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
              💾 Только локально
            </Badge>
          )}
          <Badge className="bg-gradient-to-r from-blue-500 to-blue-700 text-lg px-4 py-2">
            {projectData.completionStatus.percentage}% выполнено
          </Badge>
        </div>
      </div>

      {/* Общий прогресс */}
      <Card className="p-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Общий прогресс</span>
            <span className="text-sm text-muted-foreground">
              {projectData.completionStatus.completedElements} из {projectData.completionStatus.totalElements} выполнено
            </span>
          </div>
          <Progress value={projectData.completionStatus.percentage} className="h-3" />
        </div>
      </Card>

      {/* Навигация по этапам */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {template.stages.map((stage, index) => {
          const stageData = projectData.stagesData[stage.id] || {};
          const completedCount = Object.values(stageData).filter(e => e.completed).length;
          const totalCount = stage.elements.length;
          const isCompleted = completedCount === totalCount;
          const isCurrent = index === currentStageIndex;

          return (
            <Button
              key={stage.id}
              variant={isCurrent ? "default" : "outline"}
              className={`flex-shrink-0 ${isCompleted ? 'bg-green-500 hover:bg-green-600' : ''}`}
              onClick={() => setCurrentStageIndex(index)}
            >
              <span className="mr-2">{index + 1}.</span>
              {stage.name}
              <Badge variant="secondary" className="ml-2">
                {completedCount}/{totalCount}
              </Badge>
              {isCompleted && <CheckCircle2 className="w-4 h-4 ml-2" />}
            </Button>
          );
        })}
      </div>

      {/* Текущий этап */}
      {currentStage && (
        <Card className="p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-bold" style={{ color: currentStage.color }}>
                Этап {currentStageIndex + 1}: {currentStage.name}
              </h2>
              <Badge variant="outline" className="text-sm">
                {Math.round(stageProgress)}% завершено
              </Badge>
            </div>
            {currentStage.description && (
              <p className="text-muted-foreground">{currentStage.description}</p>
            )}
            <Progress value={stageProgress} className="h-2 mt-3" />
          </div>

          <div className="space-y-6">
            {currentStage.elements.map((element) => (
              <div key={element.id}>
                {renderElementInput(currentStage.id, element)}
              </div>
            ))}
          </div>

          {/* Навигация между этапами */}
          <div className="flex gap-4 mt-6 pt-6 border-t">
            <Button
              variant="outline"
              onClick={() => setCurrentStageIndex(Math.max(0, currentStageIndex - 1))}
              disabled={currentStageIndex === 0}
              className="flex-1"
            >
              Предыдущий этап
            </Button>
            <Button
              onClick={() => setCurrentStageIndex(Math.min(template.stages.length - 1, currentStageIndex + 1))}
              disabled={currentStageIndex === template.stages.length - 1}
              className="flex-1"
            >
              Следующий этап
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </Card>
      )}

      {/* Информация о паспорте */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Информация о проекте</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {template.customFields.map(field => (
            <div key={field.id}>
              <Label className="text-sm text-muted-foreground">{field.label}</Label>
              <p className="font-medium">{projectData.passportData[field.name] || '-'}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}


