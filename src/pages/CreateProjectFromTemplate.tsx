import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Check, FileText, Rocket } from "lucide-react";
import { useTemplates } from "@/hooks/useDataStore";
import { ProjectTemplate, CustomField } from "@/types/methodology";
import { dataStore } from "@/store/dataStore";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/hooks/useSupabaseData";

export default function CreateProjectFromTemplate() {
  const navigate = useNavigate();
  const { templates } = useTemplates();
  const { toast } = useToast();
  const { user } = useAuth();
  const { createProject } = useProjects();

  const [step, setStep] = useState(1); // 1: выбор шаблона, 2: заполнение паспорта
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [passportData, setPassportData] = useState<Record<string, any>>({});

  const activeTemplates = templates.filter(t => t.isActive);

  const handleTemplateSelect = (template: ProjectTemplate) => {
    setSelectedTemplate(template);
    // Инициализируем данные паспорта со значениями по умолчанию
    const initialData: Record<string, any> = {};
    template.customFields.forEach(field => {
      if (field.defaultValue !== undefined) {
        initialData[field.name] = field.defaultValue;
      }
    });
    setPassportData(initialData);
    setStep(2);
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setPassportData({
      ...passportData,
      [fieldName]: value
    });
  };

  const validatePassport = (): boolean => {
    if (!selectedTemplate) return false;

    for (const field of selectedTemplate.customFields) {
      if (field.required && !passportData[field.name]) {
        toast({
          title: "Не заполнены обязательные поля",
          description: `Пожалуйста, заполните поле "${field.label}"`,
          variant: "destructive"
        });
        return false;
      }
    }
    return true;
  };

  const handleCreateProject = async () => {
    if (!selectedTemplate || !validatePassport()) return;

    try {
      // Собираем данные проекта на основе шаблона
      const projectData = {
        name: passportData['project_name'] || passportData['client_name'] || selectedTemplate.name,
        description: selectedTemplate.description,
        status: 'Черновик',
        company: 'RB Partners',
        deadline: passportData['deadline'] || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        budget: passportData['budget'] || 0,
        team: [],
        completion: 0,
        templateId: selectedTemplate.id,
        templateVersion: selectedTemplate.version,
        passportData: passportData,
        stagesData: {},
        completionStatus: {
          totalElements: selectedTemplate.stages.reduce((sum, stage) => sum + stage.elements.length, 0),
          completedElements: 0,
          percentage: 0
        },
        history: [{
          date: new Date().toISOString(),
          user: user?.name || 'Система',
          action: 'Проект создан из шаблона',
          details: `Шаблон: ${selectedTemplate.name}`
        }],
        updated_at: new Date().toISOString()
      };

      // Создаем проект в Supabase
      const createdProject = await createProject(projectData);

      if (createdProject && createdProject.id) {
        toast({
          title: "Проект создан!",
          description: `Проект "${projectData.name}" успешно создан. Теперь можно приступить к заполнению процедур.`
        });

        // Переходим на страницу проекта
        navigate(`/project/${createdProject.id}`);
      }
    } catch (error) {
      console.error('Failed to create project:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось создать проект в базе данных",
        variant: "destructive"
      });
    }
  };

  const renderFieldInput = (field: CustomField) => {
    const value = passportData[field.name] || '';

    switch (field.type) {
      case 'text':
        return (
          <Input
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
            rows={3}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => handleFieldChange(field.name, Number(e.target.value))}
            placeholder={field.placeholder}
            required={field.required}
          />
        );

      case 'date':
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            required={field.required}
          />
        );

      case 'select':
        return (
          <Select value={value} onValueChange={(val) => handleFieldChange(field.name, val)}>
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder || "Выберите..."} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map(option => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'user':
        // Здесь можно добавить выбор из списка сотрудников
        return (
          <Input
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder || "Введите имя сотрудника"}
            required={field.required}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in p-4 md:p-0 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => step === 1 ? navigate('/projects') : setStep(1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-warning bg-clip-text text-transparent">
            Создание проекта
          </h1>
          <p className="text-muted-foreground mt-1">
            {step === 1 ? 'Выберите шаблон проекта' : 'Заполните информацию о проекте'}
          </p>
        </div>
      </div>

      {/* Индикатор шагов */}
      <div className="flex items-center justify-center gap-4">
        <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-primary text-white' : 'bg-muted'}`}>
            {step > 1 ? <Check className="w-4 h-4" /> : '1'}
          </div>
          <span className="font-medium">Выбор шаблона</span>
        </div>
        <div className="w-12 h-0.5 bg-muted" />
        <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-primary text-white' : 'bg-muted'}`}>
            2
          </div>
          <span className="font-medium">Паспорт проекта</span>
        </div>
      </div>

      {/* Шаг 1: Выбор шаблона */}
      {step === 1 && (
        <div className="space-y-4">
          {activeTemplates.length === 0 ? (
            <Card className="p-12 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">Нет доступных шаблонов</p>
              <Button onClick={() => navigate('/template-editor')}>
                Создать шаблон
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {activeTemplates.map((template) => (
                <Card
                  key={template.id}
                  className="p-6 hover:shadow-lg transition-all duration-200 cursor-pointer hover:border-primary"
                  onClick={() => handleTemplateSelect(template)}
                >
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">{template.name}</h3>
                      <p className="text-sm text-muted-foreground mb-2">{template.description}</p>
                      <Badge variant="secondary">{template.category}</Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 p-3 bg-muted/50 rounded-lg">
                    <div className="text-center">
                      <div className="text-lg font-bold">{template.customFields.length}</div>
                      <div className="text-xs text-muted-foreground">Полей</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold">{template.stages.length}</div>
                      <div className="text-xs text-muted-foreground">Этапов</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold">
                        {template.stages.reduce((sum, stage) => sum + stage.elements.length, 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">Процедур</div>
                    </div>
                  </div>

                  <Button className="w-full mt-4" variant="outline">
                    Выбрать этот шаблон
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Шаг 2: Заполнение паспорта */}
      {step === 2 && selectedTemplate && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{selectedTemplate.name}</h3>
                <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center text-sm font-bold">
                    📝
                  </span>
                  Информация о проекте
                </h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Заполните основные данные проекта. Поля отмеченные <Badge variant="destructive" className="text-xs ml-1">*</Badge> обязательны для заполнения.
                </p>
              </div>

              <div className="space-y-4">
                {selectedTemplate.customFields
                  .sort((a, b) => a.order - b.order)
                  .map((field) => (
                    <div key={field.id} className="space-y-2">
                      <Label htmlFor={field.name} className="flex items-center gap-2">
                        {field.label}
                        {field.required && (
                          <Badge variant="destructive" className="text-xs">Обязательное</Badge>
                        )}
                      </Label>
                      {field.helpText && (
                        <p className="text-sm text-muted-foreground">{field.helpText}</p>
                      )}
                      {renderFieldInput(field)}
                    </div>
                  ))}
              </div>
            </div>
          </Card>

          <div className="flex gap-4">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад
            </Button>
            <Button onClick={handleCreateProject} className="flex-1" size="lg">
              <Rocket className="w-4 h-4 mr-2" />
              Создать проект
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}




