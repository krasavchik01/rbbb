import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Save, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Edit, 
  GripVertical,
  FileText,
  ListOrdered,
  Settings as SettingsIcon
} from "lucide-react";
import { useTemplates } from "@/hooks/useDataStore";
import { 
  ProjectTemplate, 
  CustomField, 
  ProjectStage, 
  ProcedureElement,
  PROJECT_CATEGORIES,
  FIELD_TYPE_LABELS,
  ELEMENT_TYPE_LABELS,
  ELEMENT_TYPE_ICONS,
  ROLE_LABELS,
  STAGE_COLORS,
  FieldType,
  ProcedureElementType
} from "@/types/methodology";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";

export default function TemplateConstructor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { templates, addTemplate, updateTemplate } = useTemplates();
  const { user } = useAuth();
  const isNew = id === 'new';

  // Основные данные шаблона
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateCategory, setTemplateCategory] = useState<string>(PROJECT_CATEGORIES[0]);
  
  // Паспорт проекта
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [isFieldDialogOpen, setIsFieldDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  
  // Рабочие процедуры
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [isStageDialogOpen, setIsStageDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<ProjectStage | null>(null);
  const [isElementDialogOpen, setIsElementDialogOpen] = useState(false);
  const [editingElement, setEditingElement] = useState<{ stageId: string; element: ProcedureElement | null }>();
  
  // Настройки и маршрутизация
  const [defaultApprovalRole, setDefaultApprovalRole] = useState<string>('partner');
  const [notifyOnCreation, setNotifyOnCreation] = useState(true);
  const [allowedRoles, setAllowedRoles] = useState<string[]>(['admin', 'partner', 'manager']);
  
  // Состояние для форм
  const [fieldForm, setFieldForm] = useState({
    name: '',
    label: '',
    type: 'text' as FieldType,
    required: false,
    options: [] as string[],
    placeholder: '',
    helpText: ''
  });

  const [stageForm, setStageForm] = useState({
    name: '',
    description: '',
    color: STAGE_COLORS[0]
  });

  const [elementForm, setElementForm] = useState({
    type: 'header' as ProcedureElementType,
    title: '',
    description: '',
    question: '',
    required: false,
    requiredRole: 'partner',
    multipleFiles: false,
    maxFileSize: 10,
    allowedFileTypes: [] as string[]
  });

  // Загрузка существующего шаблона
  useEffect(() => {
    if (!isNew && id) {
      const template = templates.find(t => t.id === id);
      if (template) {
        setTemplateName(template.name);
        setTemplateDescription(template.description);
        setTemplateCategory(template.category);
        setCustomFields(template.customFields);
        setStages(template.stages);
        setDefaultApprovalRole(template.routingSettings.defaultApprovalRole || 'partner');
        setNotifyOnCreation(template.routingSettings.notifyOnCreation || true);
        setAllowedRoles(template.routingSettings.allowedRoles || ['admin', 'partner', 'manager']);
      }
    }
  }, [id, isNew, templates]);

  const handleSave = () => {
    if (!templateName.trim()) {
      alert('Введите название шаблона');
      return;
    }

    const templateData = {
      name: templateName,
      description: templateDescription,
      category: templateCategory,
      customFields: customFields.map((f, i) => ({ ...f, order: i + 1 })),
      stages: stages.map((s, i) => ({
        ...s,
        order: i + 1,
        elements: s.elements.map((e, j) => ({ ...e, order: j + 1 }))
      })),
      routingSettings: {
        defaultApprovalRole: defaultApprovalRole as any,
        notifyOnCreation,
        allowedRoles: allowedRoles as any[]
      },
      created_by: user?.id || '1',
      isActive: true,
      usageCount: 0
    };

    if (isNew) {
      addTemplate(templateData);
    } else if (id) {
      updateTemplate(id, templateData);
    }

    navigate('/template-editor');
  };

  // ========== ПАСПОРТ ПРОЕКТА ==========

  const handleAddField = () => {
    setEditingField(null);
    setFieldForm({
      name: '',
      label: '',
      type: 'text',
      required: false,
      options: [],
      placeholder: '',
      helpText: ''
    });
    setIsFieldDialogOpen(true);
  };

  const handleEditField = (field: CustomField) => {
    setEditingField(field);
    setFieldForm({
      name: field.name,
      label: field.label,
      type: field.type,
      required: field.required,
      options: field.options || [],
      placeholder: field.placeholder || '',
      helpText: field.helpText || ''
    });
    setIsFieldDialogOpen(true);
  };

  const handleSaveField = () => {
    const newField: CustomField = {
      id: editingField?.id || `field-${Date.now()}`,
      name: fieldForm.name || fieldForm.label.toLowerCase().replace(/\s+/g, '_'),
      label: fieldForm.label,
      type: fieldForm.type,
      required: fieldForm.required,
      options: fieldForm.type === 'select' ? fieldForm.options : undefined,
      placeholder: fieldForm.placeholder,
      helpText: fieldForm.helpText,
      order: editingField?.order || customFields.length + 1
    };

    if (editingField) {
      setCustomFields(customFields.map(f => f.id === editingField.id ? newField : f));
    } else {
      setCustomFields([...customFields, newField]);
    }

    setIsFieldDialogOpen(false);
  };

  const handleDeleteField = (fieldId: string) => {
    setCustomFields(customFields.filter(f => f.id !== fieldId));
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newFields = [...customFields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newFields.length) return;
    [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
    setCustomFields(newFields);
  };

  // ========== РАБОЧИЕ ПРОЦЕДУРЫ ==========

  const handleAddStage = () => {
    setEditingStage(null);
    setStageForm({
      name: '',
      description: '',
      color: STAGE_COLORS[stages.length % STAGE_COLORS.length]
    });
    setIsStageDialogOpen(true);
  };

  const handleEditStage = (stage: ProjectStage) => {
    setEditingStage(stage);
    setStageForm({
      name: stage.name,
      description: stage.description || '',
      color: stage.color || STAGE_COLORS[0]
    });
    setIsStageDialogOpen(true);
  };

  const handleSaveStage = () => {
    const newStage: ProjectStage = {
      id: editingStage?.id || `stage-${Date.now()}`,
      name: stageForm.name,
      description: stageForm.description,
      color: stageForm.color,
      order: editingStage?.order || stages.length + 1,
      elements: editingStage?.elements || []
    };

    if (editingStage) {
      setStages(stages.map(s => s.id === editingStage.id ? newStage : s));
    } else {
      setStages([...stages, newStage]);
    }

    setIsStageDialogOpen(false);
  };

  const handleDeleteStage = (stageId: string) => {
    setStages(stages.filter(s => s.id !== stageId));
  };

  const moveStage = (index: number, direction: 'up' | 'down') => {
    const newStages = [...stages];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newStages.length) return;
    [newStages[index], newStages[targetIndex]] = [newStages[targetIndex], newStages[index]];
    setStages(newStages);
  };

  const handleAddElement = (stageId: string) => {
    setEditingElement({ stageId, element: null });
    setElementForm({
      type: 'header',
      title: '',
      description: '',
      question: '',
      required: false,
      requiredRole: 'partner',
      multipleFiles: false,
      maxFileSize: 10,
      allowedFileTypes: []
    });
    setIsElementDialogOpen(true);
  };

  const handleEditElement = (stageId: string, element: ProcedureElement) => {
    setEditingElement({ stageId, element });
    setElementForm({
      type: element.type,
      title: element.title,
      description: element.description || '',
      question: element.question || '',
      required: element.required,
      requiredRole: element.requiredRole || 'partner',
      multipleFiles: element.config?.multipleFiles || false,
      maxFileSize: element.config?.maxFileSize || 10,
      allowedFileTypes: element.config?.allowedFileTypes || []
    });
    setIsElementDialogOpen(true);
  };

  const handleSaveElement = () => {
    if (!editingElement) return;

    const newElement: ProcedureElement = {
      id: editingElement.element?.id || `element-${Date.now()}`,
      type: elementForm.type,
      title: elementForm.title,
      description: elementForm.description,
      question: elementForm.type === 'question' ? elementForm.question : undefined,
      required: elementForm.required,
      requiredRole: elementForm.type === 'signature' ? elementForm.requiredRole : undefined,
      config: elementForm.type === 'file' ? {
        multipleFiles: elementForm.multipleFiles,
        maxFileSize: elementForm.maxFileSize,
        allowedFileTypes: elementForm.allowedFileTypes
      } : undefined,
      order: editingElement.element?.order || 1
    };

    setStages(stages.map(stage => {
      if (stage.id === editingElement.stageId) {
        if (editingElement.element) {
          return {
            ...stage,
            elements: stage.elements.map(e => e.id === editingElement.element?.id ? newElement : e)
          };
        } else {
          return {
            ...stage,
            elements: [...stage.elements, newElement]
          };
        }
      }
      return stage;
    }));

    setIsElementDialogOpen(false);
  };

  const handleDeleteElement = (stageId: string, elementId: string) => {
    setStages(stages.map(stage => 
      stage.id === stageId 
        ? { ...stage, elements: stage.elements.filter(e => e.id !== elementId) }
        : stage
    ));
  };

  const moveElement = (stageId: string, elementIndex: number, direction: 'up' | 'down') => {
    setStages(stages.map(stage => {
      if (stage.id === stageId) {
        const newElements = [...stage.elements];
        const targetIndex = direction === 'up' ? elementIndex - 1 : elementIndex + 1;
        if (targetIndex < 0 || targetIndex >= newElements.length) return stage;
        [newElements[elementIndex], newElements[targetIndex]] = [newElements[targetIndex], newElements[elementIndex]];
        return { ...stage, elements: newElements };
      }
      return stage;
    }));
  };

  return (
    <div className="space-y-6 animate-fade-in p-4 md:p-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/template-editor')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-warning bg-clip-text text-transparent">
              {isNew ? 'Новый шаблон' : 'Редактирование шаблона'}
            </h1>
            <p className="text-muted-foreground mt-1">
              Настройте структуру и процедуры для проектов
            </p>
          </div>
        </div>
        <Button onClick={handleSave} size="lg">
          <Save className="w-4 h-4 mr-2" />
          Сохранить
        </Button>
      </div>

      {/* Основная информация */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <Label htmlFor="name">Название шаблона *</Label>
            <Input
              id="name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Аудит финансовой отчетности"
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="description">Описание</Label>
            <Textarea
              id="description"
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              placeholder="Краткое описание шаблона"
              rows={2}
            />
          </div>
          <div>
            <Label htmlFor="category">Категория</Label>
            <Select value={templateCategory} onValueChange={setTemplateCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Вкладки */}
      <Tabs defaultValue="passport" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="passport">
            <FileText className="w-4 h-4 mr-2" />
            Паспорт проекта
          </TabsTrigger>
          <TabsTrigger value="procedures">
            <ListOrdered className="w-4 h-4 mr-2" />
            Рабочие процедуры
          </TabsTrigger>
          <TabsTrigger value="settings">
            <SettingsIcon className="w-4 h-4 mr-2" />
            Настройки
          </TabsTrigger>
        </TabsList>

        {/* Вкладка 1: Паспорт проекта */}
        <TabsContent value="passport" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Кастомные поля</h3>
                <p className="text-sm text-muted-foreground">
                  Добавьте поля, которые будут заполняться при создании проекта
                </p>
              </div>
              <Button onClick={handleAddField}>
                <Plus className="w-4 h-4 mr-2" />
                Добавить поле
              </Button>
            </div>

            {customFields.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Пока нет полей. Добавьте первое поле!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {customFields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-2 p-4 border rounded-lg hover:bg-muted/50">
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveField(index, 'up')}
                        disabled={index === 0}
                      >
                        ↑
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveField(index, 'down')}
                        disabled={index === customFields.length - 1}
                      >
                        ↓
                      </Button>
                    </div>
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{field.label}</span>
                        {field.required && <Badge variant="destructive" className="text-xs">Обязательное</Badge>}
                        <Badge variant="outline" className="text-xs">{FIELD_TYPE_LABELS[field.type]}</Badge>
                      </div>
                      {field.helpText && (
                        <p className="text-sm text-muted-foreground mt-1">{field.helpText}</p>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleEditField(field)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteField(field.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Вкладка 2: Рабочие процедуры */}
        <TabsContent value="procedures" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Этапы и процедуры</h3>
                <p className="text-sm text-muted-foreground">
                  Создайте этапы проекта и добавьте процедурные элементы
                </p>
              </div>
              <Button onClick={handleAddStage}>
                <Plus className="w-4 h-4 mr-2" />
                Добавить этап
              </Button>
            </div>

            {stages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ListOrdered className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Пока нет этапов. Создайте первый этап!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {stages.map((stage, stageIndex) => (
                  <Card key={stage.id} className="p-4" style={{ borderLeft: `4px solid ${stage.color}` }}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-2 flex-1">
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => moveStage(stageIndex, 'up')}
                            disabled={stageIndex === 0}
                          >
                            ↑
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => moveStage(stageIndex, 'down')}
                            disabled={stageIndex === stages.length - 1}
                          >
                            ↓
                          </Button>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-lg">{stageIndex + 1}. {stage.name}</h4>
                          {stage.description && (
                            <p className="text-sm text-muted-foreground mt-1">{stage.description}</p>
                          )}
                          <Badge variant="outline" className="mt-2">
                            {stage.elements.length} элементов
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEditStage(stage)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteStage(stage.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>

                    {/* Элементы этапа */}
                    <div className="ml-8 space-y-2">
                      {stage.elements.map((element, elementIndex) => (
                        <div key={element.id} className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                          <div className="flex flex-col gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={() => moveElement(stage.id, elementIndex, 'up')}
                              disabled={elementIndex === 0}
                            >
                              ↑
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={() => moveElement(stage.id, elementIndex, 'down')}
                              disabled={elementIndex === stage.elements.length - 1}
                            >
                              ↓
                            </Button>
                          </div>
                          <span className="text-lg">{ELEMENT_TYPE_ICONS[element.type]}</span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{element.title}</span>
                              {element.required && <Badge variant="destructive" className="text-xs">Обязательный</Badge>}
                              <Badge variant="outline" className="text-xs">{ELEMENT_TYPE_LABELS[element.type]}</Badge>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => handleEditElement(stage.id, element)}>
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteElement(stage.id, element.id)}>
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </Button>
                        </div>
                      ))}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => handleAddElement(stage.id)}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Добавить элемент
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Вкладка 3: Настройки и маршрутизация */}
        <TabsContent value="settings" className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Настройки маршрутизации</h3>
            
            <div className="space-y-6">
              <div>
                <Label htmlFor="approvalRole">При создании направлять на утверждение роли:</Label>
                <Select value={defaultApprovalRole} onValueChange={setDefaultApprovalRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Отправлять уведомления при создании</Label>
                  <p className="text-sm text-muted-foreground">
                    Уведомить ответственного при создании нового проекта
                  </p>
                </div>
                <Switch checked={notifyOnCreation} onCheckedChange={setNotifyOnCreation} />
              </div>

              <div>
                <Label>Роли, которые могут создавать проекты по этому шаблону:</Label>
                <div className="mt-3 space-y-2">
                  {Object.entries(ROLE_LABELS).map(([key, label]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Switch
                        checked={allowedRoles.includes(key)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setAllowedRoles([...allowedRoles, key]);
                          } else {
                            setAllowedRoles(allowedRoles.filter(r => r !== key));
                          }
                        }}
                      />
                      <Label className="cursor-pointer">{label}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Диалог добавления/редактирования поля */}
      <Dialog open={isFieldDialogOpen} onOpenChange={setIsFieldDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingField ? 'Редактировать поле' : 'Добавить поле'}</DialogTitle>
            <DialogDescription>
              Настройте параметры кастомного поля для паспорта проекта
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="fieldLabel">Название поля *</Label>
              <Input
                id="fieldLabel"
                value={fieldForm.label}
                onChange={(e) => setFieldForm({ ...fieldForm, label: e.target.value })}
                placeholder="Например: Название клиента"
              />
            </div>

            <div>
              <Label htmlFor="fieldType">Тип поля *</Label>
              <Select value={fieldForm.type} onValueChange={(value) => setFieldForm({ ...fieldForm, type: value as FieldType })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FIELD_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {fieldForm.type === 'select' && (
              <div>
                <Label htmlFor="fieldOptions">Варианты (через запятую) *</Label>
                <Input
                  id="fieldOptions"
                  value={fieldForm.options.join(', ')}
                  onChange={(e) => setFieldForm({ 
                    ...fieldForm, 
                    options: e.target.value.split(',').map(o => o.trim()).filter(Boolean)
                  })}
                  placeholder="Вариант 1, Вариант 2, Вариант 3"
                />
              </div>
            )}

            <div>
              <Label htmlFor="fieldPlaceholder">Подсказка (placeholder)</Label>
              <Input
                id="fieldPlaceholder"
                value={fieldForm.placeholder}
                onChange={(e) => setFieldForm({ ...fieldForm, placeholder: e.target.value })}
                placeholder="Текст-подсказка для поля"
              />
            </div>

            <div>
              <Label htmlFor="fieldHelp">Текст помощи</Label>
              <Textarea
                id="fieldHelp"
                value={fieldForm.helpText}
                onChange={(e) => setFieldForm({ ...fieldForm, helpText: e.target.value })}
                placeholder="Дополнительная информация о поле"
                rows={2}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={fieldForm.required}
                onCheckedChange={(checked) => setFieldForm({ ...fieldForm, required: checked })}
              />
              <Label>Обязательное поле</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFieldDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSaveField}>
              {editingField ? 'Сохранить' : 'Добавить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог добавления/редактирования этапа */}
      <Dialog open={isStageDialogOpen} onOpenChange={setIsStageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStage ? 'Редактировать этап' : 'Добавить этап'}</DialogTitle>
            <DialogDescription>
              Создайте этап проекта с набором процедурных элементов
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="stageName">Название этапа *</Label>
              <Input
                id="stageName"
                value={stageForm.name}
                onChange={(e) => setStageForm({ ...stageForm, name: e.target.value })}
                placeholder="Например: Планирование"
              />
            </div>

            <div>
              <Label htmlFor="stageDescription">Описание</Label>
              <Textarea
                id="stageDescription"
                value={stageForm.description}
                onChange={(e) => setStageForm({ ...stageForm, description: e.target.value })}
                placeholder="Описание этапа"
                rows={2}
              />
            </div>

            <div>
              <Label>Цвет этапа</Label>
              <div className="grid grid-cols-8 gap-2 mt-2">
                {STAGE_COLORS.map(color => (
                  <button
                    key={color}
                    className={`w-8 h-8 rounded border-2 ${stageForm.color === color ? 'border-white scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setStageForm({ ...stageForm, color })}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStageDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSaveStage}>
              {editingStage ? 'Сохранить' : 'Добавить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог добавления/редактирования элемента */}
      <Dialog open={isElementDialogOpen} onOpenChange={setIsElementDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingElement?.element ? 'Редактировать элемент' : 'Добавить элемент'}</DialogTitle>
            <DialogDescription>
              Настройте процедурный элемент для этапа
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="elementType">Тип элемента *</Label>
              <Select value={elementForm.type} onValueChange={(value) => setElementForm({ ...elementForm, type: value as ProcedureElementType })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ELEMENT_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {ELEMENT_TYPE_ICONS[key as ProcedureElementType]} {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="elementTitle">Название элемента *</Label>
              <Input
                id="elementTitle"
                value={elementForm.title}
                onChange={(e) => setElementForm({ ...elementForm, title: e.target.value })}
                placeholder="Название элемента"
              />
            </div>

            {(elementForm.type === 'procedure' || elementForm.type === 'signature') && (
              <div>
                <Label htmlFor="elementDescription">Описание</Label>
                <Textarea
                  id="elementDescription"
                  value={elementForm.description}
                  onChange={(e) => setElementForm({ ...elementForm, description: e.target.value })}
                  placeholder="Детальное описание"
                  rows={2}
                />
              </div>
            )}

            {elementForm.type === 'question' && (
              <div>
                <Label htmlFor="elementQuestion">Текст вопроса *</Label>
                <Textarea
                  id="elementQuestion"
                  value={elementForm.question}
                  onChange={(e) => setElementForm({ ...elementForm, question: e.target.value })}
                  placeholder="Вопрос, на который нужно ответить"
                  rows={2}
                />
              </div>
            )}

            {elementForm.type === 'signature' && (
              <div>
                <Label htmlFor="signatureRole">Роль для утверждения</Label>
                <Select value={elementForm.requiredRole} onValueChange={(value) => setElementForm({ ...elementForm, requiredRole: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {elementForm.type === 'file' && (
              <>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={elementForm.multipleFiles}
                    onCheckedChange={(checked) => setElementForm({ ...elementForm, multipleFiles: checked })}
                  />
                  <Label>Разрешить загрузку нескольких файлов</Label>
                </div>

                <div>
                  <Label htmlFor="maxFileSize">Максимальный размер файла (МБ)</Label>
                  <Input
                    id="maxFileSize"
                    type="number"
                    value={elementForm.maxFileSize}
                    onChange={(e) => setElementForm({ ...elementForm, maxFileSize: Number(e.target.value) })}
                  />
                </div>

                <div>
                  <Label htmlFor="allowedTypes">Разрешённые типы файлов (через запятую)</Label>
                  <Input
                    id="allowedTypes"
                    value={elementForm.allowedFileTypes.join(', ')}
                    onChange={(e) => setElementForm({ 
                      ...elementForm, 
                      allowedFileTypes: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                    })}
                    placeholder=".pdf, .docx, .xlsx"
                  />
                </div>
              </>
            )}

            {elementForm.type !== 'header' && (
              <div className="flex items-center space-x-2">
                <Switch
                  checked={elementForm.required}
                  onCheckedChange={(checked) => setElementForm({ ...elementForm, required: checked })}
                />
                <Label>Обязательный элемент</Label>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsElementDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSaveElement}>
              {editingElement?.element ? 'Сохранить' : 'Добавить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}



