import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Upload, Plus, Trash2, FileText, Building2, User, Calendar, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getActiveCompanies } from "@/types/companies";
import { PROJECT_TYPE_LABELS, ProjectType, ClientInfo, ContractInfo } from "@/types/project-v3";

interface ContactPerson {
  name: string;
  position: string;
  phone: string;
  email: string;
}

export default function CreateProjectProcurement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  // Данные клиента
  const [clientName, setClientName] = useState("");
  const [clientWebsite, setClientWebsite] = useState("");
  const [clientActivity, setClientActivity] = useState("");
  const [clientCity, setClientCity] = useState("");
  const [contacts, setContacts] = useState<ContactPerson[]>([
    { name: "", position: "", phone: "", email: "" }
  ]);

  // Данные договора
  const [contractNumber, setContractNumber] = useState("");
  const [contractDate, setContractDate] = useState("");
  const [contractSubject, setContractSubject] = useState("");
  const [serviceStartDate, setServiceStartDate] = useState("");
  const [serviceEndDate, setServiceEndDate] = useState("");
  const [amountWithoutVAT, setAmountWithoutVAT] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [projectType, setProjectType] = useState<ProjectType | "">("");
  
  // Файл договора
  const [contractFile, setContractFile] = useState<File | null>(null);

  const companies = getActiveCompanies();

  const addContact = () => {
    setContacts([...contacts, { name: "", position: "", phone: "", email: "" }]);
  };

  const removeContact = (index: number) => {
    setContacts(contacts.filter((_, i) => i !== index));
  };

  const updateContact = (index: number, field: keyof ContactPerson, value: string) => {
    const updated = [...contacts];
    updated[index][field] = value;
    setContacts(updated);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setContractFile(e.target.files[0]);
    }
  };

  const validateForm = (): boolean => {
    if (!clientName.trim()) {
      toast({ title: "Ошибка", description: "Укажите наименование клиента", variant: "destructive" });
      return false;
    }
    if (!contractNumber.trim()) {
      toast({ title: "Ошибка", description: "Укажите номер договора", variant: "destructive" });
      return false;
    }
    if (!contractDate) {
      toast({ title: "Ошибка", description: "Укажите дату договора", variant: "destructive" });
      return false;
    }
    if (!contractSubject.trim()) {
      toast({ title: "Ошибка", description: "Укажите предмет договора", variant: "destructive" });
      return false;
    }
    if (!serviceStartDate || !serviceEndDate) {
      toast({ title: "Ошибка", description: "Укажите срок оказания услуг", variant: "destructive" });
      return false;
    }
    if (!amountWithoutVAT || parseFloat(amountWithoutVAT) <= 0) {
      toast({ title: "Ошибка", description: "Укажите сумму без НДС", variant: "destructive" });
      return false;
    }
    if (!companyId) {
      toast({ title: "Ошибка", description: "Выберите компанию", variant: "destructive" });
      return false;
    }
    if (!projectType) {
      toast({ title: "Ошибка", description: "Выберите вид проекта", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    // Создаём объект проекта
    const project = {
      id: `proj_${Date.now()}`,
      name: `${clientName} - ${contractSubject}`,
      type: projectType as ProjectType,
      companyId: companyId,
      companyName: companies.find(c => c.id === companyId)?.name || "",
      status: 'new' as const,
      completionPercent: 0,
      
      client: {
        name: clientName,
        website: clientWebsite,
        activity: clientActivity,
        city: clientCity,
        contacts: contacts.filter(c => c.name.trim() !== ""),
      } as ClientInfo,
      
      contract: {
        number: contractNumber,
        date: contractDate,
        subject: contractSubject,
        serviceStartDate: serviceStartDate,
        serviceEndDate: serviceEndDate,
        amountWithoutVAT: parseFloat(amountWithoutVAT),
        contractScanUrl: contractFile ? URL.createObjectURL(contractFile) : undefined,
      } as ContractInfo,
      
      team: [],
      tasks: [],
      kpiRatings: [],
      
      finances: {
        amountWithoutVAT: parseFloat(amountWithoutVAT),
        preExpensePercent: 30,
        preExpenseAmount: parseFloat(amountWithoutVAT) * 0.3,
        contractors: [],
        totalContractorsAmount: 0,
        bonusBase: parseFloat(amountWithoutVAT) * 0.7,
        bonusPercent: 50,
        totalBonusAmount: parseFloat(amountWithoutVAT) * 0.7 * 0.5,
        teamBonuses: {},
        totalPaidBonuses: 0,
        totalCosts: parseFloat(amountWithoutVAT) * 0.3,
        grossProfit: parseFloat(amountWithoutVAT) * 0.7,
        profitMargin: 70,
      },
      
      financeChangeLogs: [],
      
      createdBy: user?.id || "",
      createdByName: user?.name || "",
      createdAt: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Сохраняем в localStorage (пока)
    const existingProjects = JSON.parse(localStorage.getItem('rb_projects_v3') || '[]');
    existingProjects.push(project);
    localStorage.setItem('rb_projects_v3', JSON.stringify(existingProjects));

    toast({
      title: "Проект создан!",
      description: `Проект "${project.name}" отправлен на утверждение`,
    });

    navigate('/projects');
  };

  return (
    <div className="space-y-6 animate-fade-in p-4 md:p-0 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-warning bg-clip-text text-transparent">
            Создание нового проекта
          </h1>
          <p className="text-muted-foreground mt-1">Отдел закупок</p>
        </div>
        <Badge variant="outline" className="text-lg">
          Новый проект
        </Badge>
      </div>

      {/* Информация о клиенте */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Информация о клиенте</h3>
            <p className="text-sm text-muted-foreground">Основные данные о компании-клиенте</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label htmlFor="clientName">
              Наименование клиента <Badge variant="destructive" className="ml-2 text-xs">Обязательно</Badge>
            </Label>
            <Input
              id="clientName"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="ТОО 'Компания'"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="clientWebsite">Сайт компании</Label>
            <Input
              id="clientWebsite"
              type="url"
              value={clientWebsite}
              onChange={(e) => setClientWebsite(e.target.value)}
              placeholder="https://example.com"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="clientCity">Город</Label>
            <Input
              id="clientCity"
              value={clientCity}
              onChange={(e) => setClientCity(e.target.value)}
              placeholder="Алматы"
              className="mt-1"
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="clientActivity">Деятельность</Label>
            <Textarea
              id="clientActivity"
              value={clientActivity}
              onChange={(e) => setClientActivity(e.target.value)}
              placeholder="Описание деятельности компании"
              rows={2}
              className="mt-1"
            />
          </div>
        </div>

        {/* Контактные лица */}
        <div className="mt-6 pt-6 border-t">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              <h4 className="font-semibold">Контактные лица</h4>
            </div>
            <Button onClick={addContact} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Добавить контакт
            </Button>
          </div>

          <div className="space-y-4">
            {contacts.map((contact, index) => (
              <Card key={index} className="p-4 bg-muted/30">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs">ФИО</Label>
                    <Input
                      value={contact.name}
                      onChange={(e) => updateContact(index, 'name', e.target.value)}
                      placeholder="Иванов Иван"
                      className="mt-1"
                      size="sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Должность</Label>
                    <Input
                      value={contact.position}
                      onChange={(e) => updateContact(index, 'position', e.target.value)}
                      placeholder="Директор"
                      className="mt-1"
                      size="sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Телефон</Label>
                    <Input
                      value={contact.phone}
                      onChange={(e) => updateContact(index, 'phone', e.target.value)}
                      placeholder="+7 (777) 123-45-67"
                      className="mt-1"
                      size="sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">Email</Label>
                      <Input
                        value={contact.email}
                        onChange={(e) => updateContact(index, 'email', e.target.value)}
                        placeholder="email@example.com"
                        className="mt-1"
                        size="sm"
                      />
                    </div>
                    {contacts.length > 1 && (
                      <Button
                        onClick={() => removeContact(index)}
                        variant="ghost"
                        size="icon"
                        className="mt-6"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </Card>

      {/* Информация о договоре */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-700 rounded-xl flex items-center justify-center">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Информация о договоре</h3>
            <p className="text-sm text-muted-foreground">Данные договора на оказание услуг</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="contractNumber">
              Номер договора <Badge variant="destructive" className="ml-2 text-xs">Обязательно</Badge>
            </Label>
            <Input
              id="contractNumber"
              value={contractNumber}
              onChange={(e) => setContractNumber(e.target.value)}
              placeholder="№ 123/2025"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="contractDate">
              Дата договора <Badge variant="destructive" className="ml-2 text-xs">Обязательно</Badge>
            </Label>
            <Input
              id="contractDate"
              type="date"
              value={contractDate}
              onChange={(e) => setContractDate(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="contractSubject">
              Предмет договора <Badge variant="destructive" className="ml-2 text-xs">Обязательно</Badge>
            </Label>
            <Textarea
              id="contractSubject"
              value={contractSubject}
              onChange={(e) => setContractSubject(e.target.value)}
              placeholder="Оказание услуг по аудиту финансовой отчетности"
              rows={2}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="serviceStartDate">
              Срок оказания услуг (начало) <Badge variant="destructive" className="ml-2 text-xs">Обязательно</Badge>
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <Input
                id="serviceStartDate"
                type="date"
                value={serviceStartDate}
                onChange={(e) => setServiceStartDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="serviceEndDate">
              Срок оказания услуг (окончание) <Badge variant="destructive" className="ml-2 text-xs">Обязательно</Badge>
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <Input
                id="serviceEndDate"
                type="date"
                value={serviceEndDate}
                onChange={(e) => setServiceEndDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="amountWithoutVAT">
              Сумма без НДС <Badge variant="destructive" className="ml-2 text-xs">Обязательно</Badge>
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <Input
                id="amountWithoutVAT"
                type="number"
                value={amountWithoutVAT}
                onChange={(e) => setAmountWithoutVAT(e.target.value)}
                placeholder="10000000"
                min="0"
                step="1000"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">В тенге (₸)</p>
          </div>

          <div>
            <Label htmlFor="companyId">
              Наша компания <Badge variant="destructive" className="ml-2 text-xs">Обязательно</Badge>
            </Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Выберите компанию" />
              </SelectTrigger>
              <SelectContent>
                {companies.map(company => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="projectType">
              Вид проекта <Badge variant="destructive" className="ml-2 text-xs">Обязательно</Badge>
            </Label>
            <Select value={projectType} onValueChange={(value) => setProjectType(value as ProjectType)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Выберите вид проекта" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PROJECT_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="contractFile">Скан договора (PDF, JPG, PNG)</Label>
            <div className="mt-2 border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
              <input
                id="contractFile"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="contractFile" className="cursor-pointer">
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium mb-1">
                  {contractFile ? contractFile.name : 'Нажмите для загрузки файла'}
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF, JPG, PNG • Макс. 10 МБ
                </p>
              </label>
            </div>
          </div>
        </div>
      </Card>

      {/* Кнопки действий */}
      <div className="flex gap-4">
        <Button variant="outline" onClick={() => navigate('/projects')} className="flex-1">
          Отмена
        </Button>
        <Button onClick={handleSubmit} className="flex-1" size="lg">
          <FileText className="w-4 h-4 mr-2" />
          Отправить на утверждение
        </Button>
      </div>
    </div>
  );
}


