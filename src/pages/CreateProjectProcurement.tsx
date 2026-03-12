import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Upload, Plus, Trash2, FileText, Building2, User, Calendar, DollarSign, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Company, DEFAULT_COMPANIES } from "@/types/companies";
import { PROJECT_TYPE_LABELS, ProjectType, ClientInfo, ContractInfo, ProjectStage, AdditionalService } from "@/types/project-v3";
import { notifyProjectCreated } from "@/lib/projectNotifications";
import { notifyDeputyDirectorNewProject } from "@/lib/notifications";
import { supabaseDataStore } from "@/lib/supabaseDataStore";
import { ProjectFileManager } from "@/components/projects/ProjectFileManager";
import { ProjectStagesEditor } from "@/components/projects/ProjectStagesEditor";
import { AdditionalServicesSelector } from "@/components/projects/AdditionalServicesSelector";

interface ContactPerson {
  name: string;
  position: string;
  phone: string;
  email: string;
}

interface ConsortiumMember {
  companyId: string;
  sharePercentage: number;
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
  const [vatRate, setVatRate] = useState("16"); // Ставка НДС в % (16% по умолчанию, 0% = без НДС)
  const [currency, setCurrency] = useState("KZT"); // KZT по умолчанию
  const [companyId, setCompanyId] = useState("");
  const [projectType, setProjectType] = useState<ProjectType | "">("");
  
  // Консорциум
  const [isConsortium, setIsConsortium] = useState(false);
  const [consortiumMembers, setConsortiumMembers] = useState<ConsortiumMember[]>([
    { companyId: "", sharePercentage: 50 },
    { companyId: "", sharePercentage: 50 },
  ]);
  
  // Файлы документов (вместо одного файла договора)
  const [contractFiles, setContractFiles] = useState<File[]>([]);
  const MAX_TOTAL_SIZE_MB = 50; // Максимальный общий размер файлов в МБ
  
  // Новые поля: этапы, услуги, файлы
  const [hasStages, setHasStages] = useState(false);
  const [projectStages, setProjectStages] = useState<Array<{
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    description?: string;
  }>>([]);
  
  const [hasAdditionalServices, setHasAdditionalServices] = useState(false);
  const [additionalServices, setAdditionalServices] = useState<Array<{
    id: string;
    name: string;
    description?: string;
    cost?: number;
  }>>([]);
  
  const [projectFiles, setProjectFiles] = useState<File[]>([]);

  // Загружаем компании напрямую из Supabase
  const [companies, setCompanies] = useState<Company[]>(DEFAULT_COMPANIES.filter(c => c.isActive));

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('companies')
          .limit(1)
          .single();

        if (error) {
          console.error('Ошибка загрузки компаний:', error);
          return;
        }

        if (data?.companies && Array.isArray(data.companies)) {
          console.log('Загружены компании из Supabase:', data.companies);
          const activeCompanies = data.companies.filter((c: Company) => c.isActive);
          setCompanies(activeCompanies);
        }
      } catch (err) {
        console.error('Ошибка при загрузке компаний:', err);
      }
    };

    loadCompanies();
  }, []);

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

  // Функции для консорциума
  const addConsortiumMember = () => {
    const currentTotal = consortiumMembers.reduce((sum, m) => sum + m.sharePercentage, 0);
    const remaining = 100 - currentTotal;
    setConsortiumMembers([...consortiumMembers, { companyId: "", sharePercentage: remaining > 0 ? remaining : 10 }]);
  };

  const removeConsortiumMember = (index: number) => {
    if (consortiumMembers.length <= 2) {
      toast({ title: "Ошибка", description: "Минимум 2 участника консорциума", variant: "destructive" });
      return;
    }
    setConsortiumMembers(consortiumMembers.filter((_, i) => i !== index));
  };

  const updateConsortiumMember = (index: number, field: 'companyId' | 'sharePercentage', value: string | number) => {
    const updated = [...consortiumMembers];
    if (field === 'sharePercentage') {
      updated[index][field] = typeof value === 'string' ? parseFloat(value) || 0 : value;
    } else {
      updated[index][field] = value as string;
    }
    setConsortiumMembers(updated);
  };

  const getTotalShare = () => {
    return consortiumMembers.reduce((sum, m) => sum + m.sharePercentage, 0);
  };

  const isShareValid = () => {
    const total = getTotalShare();
    return Math.abs(total - 100) < 0.01; // Допуск на погрешность
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      const allFiles = [...contractFiles, ...newFiles];

      // Проверяем общий размер
      const totalSize = allFiles.reduce((sum, file) => sum + file.size, 0);
      const totalSizeMB = totalSize / (1024 * 1024);

      if (totalSizeMB > MAX_TOTAL_SIZE_MB) {
        toast({
          title: "Превышен лимит размера",
          description: `Общий размер файлов не может превышать ${MAX_TOTAL_SIZE_MB} МБ. Текущий: ${totalSizeMB.toFixed(1)} МБ`,
          variant: "destructive"
        });
        return;
      }

      setContractFiles(allFiles);
    }
  };

  const removeFile = (index: number) => {
    setContractFiles(contractFiles.filter((_, i) => i !== index));
  };

  const getTotalFilesSize = () => {
    const totalSize = contractFiles.reduce((sum, file) => sum + file.size, 0);
    return (totalSize / (1024 * 1024)).toFixed(1);
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
    // serviceEndDate теперь не обязателен
    if (!amountWithoutVAT || parseFloat(amountWithoutVAT) <= 0) {
      toast({ title: "Ошибка", description: "Укажите сумму без НДС", variant: "destructive" });
      return false;
    }
    
    // Валидация консорциума
    if (isConsortium) {
      // Проверка что все компании выбраны
      const hasEmptyCompany = consortiumMembers.some(m => !m.companyId);
      if (hasEmptyCompany) {
        toast({ title: "Ошибка", description: "Выберите все компании консорциума", variant: "destructive" });
        return false;
      }
      
      // Проверка уникальности компаний
      const companyIds = consortiumMembers.map(m => m.companyId);
      const uniqueIds = new Set(companyIds);
      if (uniqueIds.size !== companyIds.length) {
        toast({ title: "Ошибка", description: "Компании в консорциуме должны быть уникальными", variant: "destructive" });
        return false;
      }
      
      // Проверка что сумма долей = 100%
      if (!isShareValid()) {
        toast({ title: "Ошибка", description: `Сумма долей должна быть 100% (сейчас ${getTotalShare().toFixed(1)}%)`, variant: "destructive" });
        return false;
      }
    } else {
      // Обычный проект - должна быть выбрана компания
      if (!companyId) {
        toast({ title: "Ошибка", description: "Выберите компанию", variant: "destructive" });
        return false;
      }
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
      
      // Консорциум или обычная компания
      isConsortium: isConsortium,
      companyId: isConsortium ? undefined : companyId,
      companyName: isConsortium ? "Консорциум" : (companies.find(c => c.id === companyId)?.name || ""),
      consortiumMembers: isConsortium ? consortiumMembers.map(m => ({
        companyId: m.companyId,
        companyName: companies.find(c => c.id === m.companyId)?.name || "",
        sharePercentage: m.sharePercentage,
        shareAmount: (parseFloat(amountWithoutVAT) * m.sharePercentage) / 100,
      })) : undefined,
      
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
        vatRate: parseFloat(vatRate), // Ставка НДС (0, 12, 16)
        vatAmount: parseFloat(amountWithoutVAT) * parseFloat(vatRate) / 100, // Сумма НДС
        amountWithVAT: parseFloat(amountWithoutVAT) * (1 + parseFloat(vatRate) / 100), // Сумма с НДС
        currency: currency, // Валюта проекта
        // Сохраняем информацию о файлах (URL создаются позже при загрузке в Storage)
        contractScanUrl: contractFiles.length > 0 ? 'pending_upload' : undefined,
      } as ContractInfo,

      // Файлы документов (будут загружены в Supabase Storage)
      documentFiles: contractFiles.map(file => ({
        name: file.name,
        size: file.size,
        type: file.type,
        localUrl: URL.createObjectURL(file),
      })),
      
      team: [],
      tasks: [],
      kpiRatings: [],
      
      // Новые поля: этапы и услуги
      stages: hasStages && projectStages.length > 0 ? projectStages : undefined,
      additionalServices: hasAdditionalServices && additionalServices.length > 0 ? additionalServices : undefined,
      
      finances: {
        amountWithoutVAT: parseFloat(amountWithoutVAT),
        preExpensePercent: 30,
        preExpenseAmount: parseFloat(amountWithoutVAT) * 0.3,
        contractors: [],
        totalContractorsAmount: 0,
        bonusBase: parseFloat(amountWithoutVAT) * 0.7,
        bonusPercent: 10,
        totalBonusAmount: parseFloat(amountWithoutVAT) * 0.7 * 0.1,
        teamBonuses: {},
        totalPaidBonuses: 0,
        totalCosts: parseFloat(amountWithoutVAT) * 0.3,
        grossProfit: parseFloat(amountWithoutVAT) * 0.7,
        profitMargin: 70,
        
        // Для консорциума - разбивка по компаниям
        consortiumFinances: isConsortium ? consortiumMembers.map(m => ({
          companyId: m.companyId,
          companyName: companies.find(c => c.id === m.companyId)?.name || "",
          sharePercentage: m.sharePercentage,
          shareAmount: (parseFloat(amountWithoutVAT) * m.sharePercentage) / 100,
          bonusBase: ((parseFloat(amountWithoutVAT) * m.sharePercentage) / 100) * 0.7,
          totalBonusAmount: ((parseFloat(amountWithoutVAT) * m.sharePercentage) / 100) * 0.7 * 0.1,
        })) : undefined,
      },
      
      financeChangeLogs: [],
      
      createdBy: user?.id || "",
      createdByName: user?.name || "",
      createdAt: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      // Сохраняем проект через новый dataStore (с Supabase интеграцией)
      console.log('💾 Сохраняем проект через supabaseDataStore...');
      const savedProject = await supabaseDataStore.createProject(project);
      console.log('✅ Проект успешно сохранён:', {
        id: project.id,
        name: project.name,
        status: project.status
      });

      // Загружаем файлы проекта (если есть)
      const allFilesToUpload = [...contractFiles, ...projectFiles];
      if (allFilesToUpload.length > 0) {
        console.log('📎 Загружаем файлы проекта...');
        for (const file of allFilesToUpload) {
          try {
            await supabaseDataStore.uploadProjectFile(
              project.id,
              file,
              file.name.toLowerCase().includes('договор') || file.name.toLowerCase().includes('contract') ? 'contract' : 'document',
              user?.id || ""
            );
          } catch (fileError) {
            console.warn('⚠️ Не удалось загрузить файл:', file.name, fileError);
            // Не блокируем создание проекта из-за ошибки загрузки файла
          }
        }
      }

      // Создаем уведомление для зам. директора (без фатала при кеш-проблемах)
      try {
        const formattedAmount = new Intl.NumberFormat('ru-RU').format(parseFloat(amountWithoutVAT));
        if (typeof notifyDeputyDirectorNewProject === 'function') {
          notifyDeputyDirectorNewProject(
            project.name,
            clientName,
            formattedAmount
          );
        }
      } catch (e) {
        console.warn('⚠️ Не удалось отправить уведомление зам. директору:', e);
      }

      toast({
        title: "✅ Проект создан!",
        description: `Проект "${project.name}" отправлен на утверждение. Зам. директор получил уведомление.`,
      });

      navigate('/projects');
    } catch (error) {
      console.error('❌ Ошибка при сохранении проекта:', error);
      toast({
        title: "❌ Ошибка",
        description: "Не удалось сохранить проект. Попробуйте ещё раз.",
        variant: "destructive"
      });
    }
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
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Должность</Label>
                    <Input
                      value={contact.position}
                      onChange={(e) => updateContact(index, 'position', e.target.value)}
                      placeholder="Директор"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Телефон</Label>
                    <Input
                      value={contact.phone}
                      onChange={(e) => updateContact(index, 'phone', e.target.value)}
                      placeholder="+7 (777) 123-45-67"
                      className="mt-1"
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
              Срок оказания услуг (начало)
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
              Срок оказания услуг (окончание)
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
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="KZT">₸ Тенге</SelectItem>
                  <SelectItem value="USD">$ Доллар</SelectItem>
                  <SelectItem value="EUR">€ Евро</SelectItem>
                  <SelectItem value="RUB">₽ Рубль</SelectItem>
                </SelectContent>
              </Select>
              <Input
                id="amountWithoutVAT"
                type="number"
                value={amountWithoutVAT}
                onChange={(e) => setAmountWithoutVAT(e.target.value)}
                placeholder="10000000"
                min="0"
                step="1000"
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Выберите валюту и укажите сумму
            </p>
          </div>

          <div>
            <Label htmlFor="vatRate">
              Ставка НДС <Badge variant="secondary" className="ml-2 text-xs">НДС</Badge>
            </Label>
            <Select value={vatRate} onValueChange={setVatRate}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Без НДС (0%)</SelectItem>
                <SelectItem value="12">НДС 12%</SelectItem>
                <SelectItem value="16">НДС 16% (по умолчанию)</SelectItem>
              </SelectContent>
            </Select>
            {amountWithoutVAT && parseFloat(amountWithoutVAT) > 0 && (
              <div className="mt-2 p-2 bg-green-500/10 rounded border border-green-500/30">
                <p className="text-xs text-green-400">
                  💰 Сумма НДС: <span className="font-bold">{(parseFloat(amountWithoutVAT) * parseFloat(vatRate) / 100).toLocaleString('ru-RU')} {currency}</span>
                </p>
                <p className="text-xs text-green-400 mt-1">
                  💵 Итого с НДС: <span className="font-bold">{(parseFloat(amountWithoutVAT) * (1 + parseFloat(vatRate) / 100)).toLocaleString('ru-RU')} {currency}</span>
                </p>
              </div>
            )}
          </div>

          {/* Чекбокс консорциума */}
          <div className="md:col-span-2">
            <div className="flex items-center space-x-2 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border-2 border-blue-400/50">
              <Checkbox 
                id="isConsortium" 
                checked={isConsortium}
                onCheckedChange={(checked) => setIsConsortium(checked as boolean)}
                className="border-blue-400"
              />
              <Label htmlFor="isConsortium" className="text-sm font-bold cursor-pointer text-blue-300">
                🤝 Проект консорциума (выполняют несколько наших компаний)
              </Label>
            </div>
          </div>

          {/* Блок консорциума или обычный выбор компании */}
          {!isConsortium ? (
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
          ) : (
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  <h4 className="font-semibold">Участники консорциума</h4>
                  <Badge variant={isShareValid() ? "default" : "destructive"}>
                    {getTotalShare().toFixed(1)}% из 100%
                  </Badge>
                </div>
                <Button onClick={addConsortiumMember} variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Добавить участника
                </Button>
              </div>

              <div className="space-y-3">
                {consortiumMembers.map((member, index) => (
                  <Card key={index} className="p-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-2 border-blue-400/30">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <Label className="text-xs text-blue-300 mb-1 block font-semibold">Компания</Label>
                        <Select 
                          value={member.companyId} 
                          onValueChange={(value) => updateConsortiumMember(index, 'companyId', value)}
                        >
                          <SelectTrigger>
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
                      
                      <div className="w-32">
                        <Label className="text-xs text-blue-300 mb-1 block font-semibold">Доля %</Label>
                        <Input
                          type="number"
                          value={member.sharePercentage}
                          onChange={(e) => updateConsortiumMember(index, 'sharePercentage', e.target.value)}
                          min="0"
                          max="100"
                          step="0.1"
                          className="text-center font-bold text-lg bg-slate-800 border-blue-400"
                        />
                      </div>

                      {consortiumMembers.length > 2 && (
                        <Button
                          onClick={() => removeConsortiumMember(index)}
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:bg-red-100 dark:hover:bg-red-900"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    {/* Расчет суммы для участника */}
                    {amountWithoutVAT && parseFloat(amountWithoutVAT) > 0 && (
                      <div className="mt-3 pt-3 border-t border-blue-400/30">
                        <p className="text-sm text-blue-200">
                          💰 Сумма участника: <span className="font-bold text-green-400 text-lg">
                            {((parseFloat(amountWithoutVAT) * member.sharePercentage) / 100).toLocaleString('ru-RU')} ₸
                          </span>
                        </p>
                      </div>
                    )}
                  </Card>
                ))}
              </div>

              {!isShareValid() && (
                <div className="mt-3 p-4 bg-red-500/20 border-2 border-red-400 rounded-lg">
                  <p className="text-sm text-red-300 font-semibold">
                    ⚠️ Сумма долей должна равняться 100%. Текущая сумма: <strong className="text-red-400 text-lg">{getTotalShare().toFixed(1)}%</strong>
                  </p>
                </div>
              )}
            </div>
          )}

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
            <Label htmlFor="contractFiles">
              <FileText className="w-4 h-4 inline mr-2" />
              Документы проекта (договор, сканы, приложения)
            </Label>
            <div className="mt-2 border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
              <input
                id="contractFiles"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                onChange={handleFileChange}
                className="hidden"
                multiple
              />
              <label htmlFor="contractFiles" className="cursor-pointer">
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium mb-1">
                  Нажмите для загрузки файлов
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF, DOC, XLS, JPG, PNG • Можно выбрать несколько файлов
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Лимит: {MAX_TOTAL_SIZE_MB} МБ (использовано: {getTotalFilesSize()} МБ)
                </p>
              </label>
            </div>

            {/* Список загруженных файлов */}
            {contractFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Загружено файлов: {contractFiles.length} ({getTotalFilesSize()} МБ из {MAX_TOTAL_SIZE_MB} МБ)
                </p>
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                  {contractFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-secondary/50 rounded-lg"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="w-4 h-4 flex-shrink-0 text-primary" />
                        <span className="text-sm truncate">{file.name}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          ({(file.size / (1024 * 1024)).toFixed(1)} МБ)
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        className="text-destructive hover:text-destructive flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Этапы проекта */}
      <Card className="p-6" data-testid="project-stages-section">
        <div className="flex items-center space-x-2 mb-4">
          <Checkbox
            id="hasStages"
            data-testid="has-stages-checkbox"
            checked={hasStages}
            onCheckedChange={(checked) => setHasStages(checked as boolean)}
          />
          <Label htmlFor="hasStages" className="font-semibold cursor-pointer">
            Этапы проекта
          </Label>
        </div>
        {hasStages && (
          <ProjectStagesEditor
            stages={projectStages}
            onChange={setProjectStages}
          />
        )}
      </Card>

      {/* Дополнительные услуги */}
      <Card className="p-6" data-testid="additional-services-section">
        <div className="flex items-center space-x-2 mb-4">
          <Checkbox
            id="hasAdditionalServices"
            data-testid="has-additional-services-checkbox"
            checked={hasAdditionalServices}
            onCheckedChange={(checked) => setHasAdditionalServices(checked as boolean)}
          />
          <Label htmlFor="hasAdditionalServices" className="font-semibold cursor-pointer">
            Дополнительные услуги
          </Label>
        </div>
        {hasAdditionalServices && (
          <AdditionalServicesSelector
            services={additionalServices}
            onChange={setAdditionalServices}
          />
        )}
      </Card>

      {/* Файлы проекта */}
      <Card className="p-6" data-testid="project-files-section">
        <h3 className="font-semibold mb-4">Файлы проекта</h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="projectFiles">Загрузить файлы (договор, сканы, документы)</Label>
            <Input
              id="projectFiles"
              data-testid="project-files-input"
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
              onChange={(e) => {
                if (e.target.files) {
                  setProjectFiles(Array.from(e.target.files));
                }
              }}
              className="mt-1"
            />
            {projectFiles.length > 0 && (
              <div className="mt-2 text-sm text-muted-foreground" data-testid="files-count">
                Выбрано файлов: {projectFiles.length}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Кнопки действий */}
      <div className="flex gap-4">
        <Button variant="outline" onClick={() => navigate('/projects')} className="flex-1">
          Отмена
        </Button>
        <Button onClick={handleSubmit} className="flex-1" size="lg" data-testid="submit-project-button">
          <FileText className="w-4 h-4 mr-2" />
          Отправить на утверждение
        </Button>
      </div>
    </div>
  );
}


