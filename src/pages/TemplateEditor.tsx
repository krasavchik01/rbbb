import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Copy, 
  Eye,
  FileText,
  ToggleLeft,
  ToggleRight,
  ListOrdered
} from "lucide-react";
import { useTemplates } from "@/hooks/useDataStore";
import { Template } from "@/lib/defaultTemplates";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function TemplateEditor() {
  const { templates, deleteTemplate, updateTemplate } = useTemplates();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const navigate = useNavigate();

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "all" || template.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const handleDeleteClick = (template: Template) => {
    setSelectedTemplate(template);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedTemplate) return;
    await deleteTemplate(selectedTemplate.id);
    setIsDeleteDialogOpen(false);
    setSelectedTemplate(null);
  };

  const handleCreateNew = () => {
    navigate('/template-constructor/new');
  };

  const handleEdit = (template: Template) => {
    navigate(`/template-constructor/${template.id}`);
  };

  return (
    <div className="space-y-6 animate-fade-in p-4 md:p-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-warning bg-clip-text text-transparent">
            Редактор методологий
          </h1>
          <p className="text-muted-foreground mt-1">
            Создавайте и настраивайте шаблоны проектов для разных направлений бизнеса
          </p>
        </div>
        <Button onClick={handleCreateNew} className="w-full md:w-auto" size="lg">
          <Plus className="w-4 h-4 mr-2" />
          Создать новый шаблон
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск шаблонов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-full md:w-64">
            <SelectValue placeholder="Все категории" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все категории</SelectItem>
            <SelectItem value="audit">🔍 Аудит</SelectItem>
            <SelectItem value="consulting">💼 Консалтинг</SelectItem>
            <SelectItem value="valuation">📊 Оценка</SelectItem>
            <SelectItem value="tax">🧾 Налоги</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold">{templates.length}</div>
          <div className="text-sm text-muted-foreground">Всего шаблонов</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-green-500">
            {templates.filter(t => t.category === 'audit').length}
          </div>
          <div className="text-sm text-muted-foreground">Аудит</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-blue-500">
            {templates.filter(t => t.category === 'consulting').length}
          </div>
          <div className="text-sm text-muted-foreground">Консалтинг</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-purple-500">
            {templates.filter(t => t.category === 'valuation').length}
          </div>
          <div className="text-sm text-muted-foreground">Оценка</div>
        </Card>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="p-6 hover:shadow-lg transition-all duration-200 group">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  <h3 className="font-semibold text-lg">{template.name}</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{template.description}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">
                    {template.category === 'audit' && '🔍 Аудит'}
                    {template.category === 'consulting' && '💼 Консалтинг'}
                    {template.category === 'valuation' && '📊 Оценка'}
                    {template.category === 'tax' && '🧾 Налоги'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 my-4 p-3 bg-muted/50 rounded-lg">
              <div className="text-center">
                <div className="text-lg font-bold">{template.customFields.length}</div>
                <div className="text-xs text-muted-foreground">Полей</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold">{template.workStages.length}</div>
                <div className="text-xs text-muted-foreground">Этапов</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold">
                  {template.workStages.reduce((sum, stage) => sum + stage.procedures.length, 0)}
                </div>
                <div className="text-xs text-muted-foreground">Процедур</div>
              </div>
            </div>

            {/* Stages Preview */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <ListOrdered className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Этапы работы:</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {template.workStages.slice(0, 3).map((stage) => (
                  <Badge 
                    key={stage.id} 
                    variant="outline" 
                    className="text-xs"
                  >
                    {stage.order}. {stage.name}
                  </Badge>
                ))}
                {template.workStages.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{template.workStages.length - 3} ещё
                  </Badge>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              <Button 
                onClick={() => handleEdit(template)} 
                className="flex-1"
                variant="default"
              >
                <Edit className="w-4 h-4 mr-1" />
                Посмотреть
              </Button>
              <Button 
                onClick={() => handleDeleteClick(template)}
                variant="outline"
                size="icon"
                title="Удалить шаблон"
                className="text-red-500 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            {/* Usage info */}
            <div className="mt-3 text-xs text-muted-foreground">
              Создан {new Date(template.createdAt).toLocaleDateString('ru-RU')}
            </div>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <Card className="p-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-2">Шаблоны не найдены</p>
          <Button onClick={handleCreateNew} variant="link">
            Создать первый шаблон
          </Button>
        </Card>
      )}

      {/* Delete Alert Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить шаблон?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить шаблон "{selectedTemplate?.name}"? 
              Это действие нельзя отменить. Существующие проекты на основе этого шаблона останутся без изменений.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-500 hover:bg-red-600">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}




