import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Save, X } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Project, ClientInfo, ProcurementInfo, RiskLevel, ProjectStatus } from "@/types/project";

interface CreateProjectFormProps {
  onSave: (project: Partial<Project>) => void;
  onCancel: () => void;
}

export function CreateProjectForm({ onSave, onCancel }: CreateProjectFormProps) {
  const [formData, setFormData] = useState<Partial<Project>>({
    name: "",
    description: "",
    risk_level: "low" as RiskLevel,
    status: "draft" as ProjectStatus,
    tags: [],
    client_info: {
      company_name: "",
      contact_person: "",
      position: "",
      email: "",
      phone: "",
      address: "",
      industry: "",
      company_size: "",
      website: "",
      notes: ""
    },
    procurement_department: {
      procurement_manager: "",
      procurement_email: "",
      procurement_phone: "",
      budget_approved: false,
      budget_amount: 0,
      procurement_notes: ""
    }
  });

  const [startDate, setStartDate] = useState<Date>();
  const [dueDate, setDueDate] = useState<Date>();

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleClientInfoChange = (field: keyof ClientInfo, value: any) => {
    setFormData(prev => ({
      ...prev,
      client_info: {
        ...prev.client_info!,
        [field]: value
      }
    }));
  };

  const handleProcurementChange = (field: keyof ProcurementInfo, value: any) => {
    setFormData(prev => ({
      ...prev,
      procurement_department: {
        ...prev.procurement_department!,
        [field]: value
      }
    }));
  };

  const handleSave = () => {
    const projectData = {
      ...formData,
      start_date: startDate?.toISOString(),
      due_date: dueDate?.toISOString()
    };
    onSave(projectData);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Создание нового проекта</h2>
        <Button variant="outline" onClick={onCancel}>
          <X className="w-4 h-4 mr-2" />
          Отмена
        </Button>
      </div>

      <Tabs defaultValue="basic" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic">Основная информация</TabsTrigger>
          <TabsTrigger value="client">Информация о клиенте</TabsTrigger>
          <TabsTrigger value="procurement">Отдел закупа</TabsTrigger>
          <TabsTrigger value="settings">Настройки</TabsTrigger>
        </TabsList>

        {/* Основная информация */}
        <TabsContent value="basic" className="space-y-6">
          <Card className="p-6 glass-card">
            <h3 className="text-lg font-semibold mb-4">Основная информация о проекте</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Название проекта *</Label>
                <Input
                  id="name"
                  value={formData.name || ""}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Введите название проекта"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="risk_level">Уровень риска</Label>
                <Select
                  value={formData.risk_level}
                  onValueChange={(value) => handleInputChange("risk_level", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите уровень риска" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Низкий</SelectItem>
                    <SelectItem value="med">Средний</SelectItem>
                    <SelectItem value="high">Высокий</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="start_date">Дата начала</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP", { locale: ru }) : "Выберите дату"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="due_date">Дедлайн</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dueDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, "PPP", { locale: ru }) : "Выберите дату"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={setDueDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="description">Описание проекта</Label>
                <Textarea
                  id="description"
                  value={formData.description || ""}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  placeholder="Опишите детали проекта"
                  rows={4}
                />
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Информация о клиенте */}
        <TabsContent value="client" className="space-y-6">
          <Card className="p-6 glass-card">
            <h3 className="text-lg font-semibold mb-4">Информация о клиенте</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">Название компании *</Label>
                <Input
                  id="company_name"
                  value={formData.client_info?.company_name || ""}
                  onChange={(e) => handleClientInfoChange("company_name", e.target.value)}
                  placeholder="Название компании клиента"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_person">Контактное лицо *</Label>
                <Input
                  id="contact_person"
                  value={formData.client_info?.contact_person || ""}
                  onChange={(e) => handleClientInfoChange("contact_person", e.target.value)}
                  placeholder="ФИО контактного лица"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="position">Должность</Label>
                <Input
                  id="position"
                  value={formData.client_info?.position || ""}
                  onChange={(e) => handleClientInfoChange("position", e.target.value)}
                  placeholder="Должность контактного лица"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.client_info?.email || ""}
                  onChange={(e) => handleClientInfoChange("email", e.target.value)}
                  placeholder="email@company.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Телефон *</Label>
                <Input
                  id="phone"
                  value={formData.client_info?.phone || ""}
                  onChange={(e) => handleClientInfoChange("phone", e.target.value)}
                  placeholder="+7 (xxx) xxx-xx-xx"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Веб-сайт</Label>
                <Input
                  id="website"
                  value={formData.client_info?.website || ""}
                  onChange={(e) => handleClientInfoChange("website", e.target.value)}
                  placeholder="https://company.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry">Отрасль</Label>
                <Select
                  value={formData.client_info?.industry || ""}
                  onValueChange={(value) => handleClientInfoChange("industry", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите отрасль" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IT">IT и технологии</SelectItem>
                    <SelectItem value="finance">Финансы и банки</SelectItem>
                    <SelectItem value="retail">Розничная торговля</SelectItem>
                    <SelectItem value="manufacturing">Производство</SelectItem>
                    <SelectItem value="construction">Строительство</SelectItem>
                    <SelectItem value="healthcare">Здравоохранение</SelectItem>
                    <SelectItem value="education">Образование</SelectItem>
                    <SelectItem value="other">Другое</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_size">Размер компании</Label>
                <Select
                  value={formData.client_info?.company_size || ""}
                  onValueChange={(value) => handleClientInfoChange("company_size", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите размер компании" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="startup">Стартап (1-10 сотрудников)</SelectItem>
                    <SelectItem value="small">Малый бизнес (11-50 сотрудников)</SelectItem>
                    <SelectItem value="medium">Средний бизнес (51-250 сотрудников)</SelectItem>
                    <SelectItem value="large">Крупный бизнес (250+ сотрудников)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="address">Адрес</Label>
                <Input
                  id="address"
                  value={formData.client_info?.address || ""}
                  onChange={(e) => handleClientInfoChange("address", e.target.value)}
                  placeholder="Полный адрес компании"
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="client_notes">Дополнительные заметки о клиенте</Label>
                <Textarea
                  id="client_notes"
                  value={formData.client_info?.notes || ""}
                  onChange={(e) => handleClientInfoChange("notes", e.target.value)}
                  placeholder="Дополнительная информация о клиенте"
                  rows={3}
                />
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Отдел закупа */}
        <TabsContent value="procurement" className="space-y-6">
          <Card className="p-6 glass-card">
            <h3 className="text-lg font-semibold mb-4">Информация отдела закупа</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="procurement_manager">Менеджер по закупкам *</Label>
                <Input
                  id="procurement_manager"
                  value={formData.procurement_department?.procurement_manager || ""}
                  onChange={(e) => handleProcurementChange("procurement_manager", e.target.value)}
                  placeholder="ФИО менеджера по закупкам"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="procurement_email">Email менеджера *</Label>
                <Input
                  id="procurement_email"
                  type="email"
                  value={formData.procurement_department?.procurement_email || ""}
                  onChange={(e) => handleProcurementChange("procurement_email", e.target.value)}
                  placeholder="email@company.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="procurement_phone">Телефон менеджера *</Label>
                <Input
                  id="procurement_phone"
                  value={formData.procurement_department?.procurement_phone || ""}
                  onChange={(e) => handleProcurementChange("procurement_phone", e.target.value)}
                  placeholder="+7 (xxx) xxx-xx-xx"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="budget_amount">Бюджет проекта</Label>
                <Input
                  id="budget_amount"
                  type="number"
                  value={formData.procurement_department?.budget_amount || ""}
                  onChange={(e) => handleProcurementChange("budget_amount", Number(e.target.value))}
                  placeholder="Сумма в рублях"
                />
              </div>

              <div className="md:col-span-2 flex items-center space-x-2">
                <Checkbox
                  id="budget_approved"
                  checked={formData.procurement_department?.budget_approved || false}
                  onCheckedChange={(checked) => handleProcurementChange("budget_approved", checked)}
                />
                <Label htmlFor="budget_approved">Бюджет утвержден</Label>
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="procurement_notes">Заметки отдела закупа</Label>
                <Textarea
                  id="procurement_notes"
                  value={formData.procurement_department?.procurement_notes || ""}
                  onChange={(e) => handleProcurementChange("procurement_notes", e.target.value)}
                  placeholder="Дополнительная информация от отдела закупа"
                  rows={3}
                />
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Настройки */}
        <TabsContent value="settings" className="space-y-6">
          <Card className="p-6 glass-card">
            <h3 className="text-lg font-semibold mb-4">Дополнительные настройки</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tags">Теги проекта</Label>
                <Input
                  id="tags"
                  value={formData.tags?.join(", ") || ""}
                  onChange={(e) => handleInputChange("tags", e.target.value.split(", ").filter(tag => tag.trim()))}
                  placeholder="Введите теги через запятую"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Статус проекта</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleInputChange("status", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите статус" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Черновик</SelectItem>
                    <SelectItem value="pre_approval">На согласовании</SelectItem>
                    <SelectItem value="partner_assigned">Назначен партнёр</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end space-x-4">
        <Button variant="outline" onClick={onCancel}>
          Отмена
        </Button>
        <Button onClick={handleSave} className="btn-gradient">
          <Save className="w-4 h-4 mr-2" />
          Создать проект
        </Button>
      </div>
    </div>
  );
}
