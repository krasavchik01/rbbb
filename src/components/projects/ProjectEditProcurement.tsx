import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Trash2,
  FileText,
  Calendar,
  DollarSign,
  Edit,
  Save,
  X,
  AlertCircle,
  FolderOpen,
  Settings,
  Building2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ProjectV3, ContractAmendment, YearlyAmount, ProjectType, PROJECT_TYPE_LABELS } from "@/types/project-v3";
import { supabaseDataStore } from "@/lib/supabaseDataStore";
import { ProjectFileManager } from "./ProjectFileManager";
import { DEFAULT_COMPANIES } from "@/types/companies";

interface ProjectEditProcurementProps {
  project: ProjectV3;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedProject: ProjectV3) => void;
}

export function ProjectEditProcurement({ project, isOpen, onClose, onSave }: ProjectEditProcurementProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  // Данные клиента
  const [clientName, setClientName] = useState(project.client?.name || "");
  const [clientWebsite, setClientWebsite] = useState(project.client?.website || "");
  const [clientActivity, setClientActivity] = useState(project.client?.activity || "");
  const [clientCity, setClientCity] = useState(project.client?.city || "");

  // Основные данные договора
  const [contractNumber, setContractNumber] = useState(project.contract?.number || "");
  const [contractDate, setContractDate] = useState(project.contract?.date || "");
  const [contractSubject, setContractSubject] = useState(project.contract?.subject || "");
  const [serviceStartDate, setServiceStartDate] = useState(project.contract?.serviceStartDate || "");
  const [serviceEndDate, setServiceEndDate] = useState(project.contract?.serviceEndDate || "");
  const [amountWithoutVAT, setAmountWithoutVAT] = useState(project.contract?.amountWithoutVAT?.toString() || "");
  const [vatRate, setVatRate] = useState(project.contract?.vatRate?.toString() || "16");

  // Настройки проекта
  const [currency, setCurrency] = useState(project.contract?.currency || "KZT");
  const [projectType, setProjectType] = useState(project.type || "");
  const [companyId, setCompanyId] = useState(project.companyId || "");
  const [isConsortium, setIsConsortium] = useState(false); // Консорциум в ProjectV3 не предусмотрен
  const [consortiumMembers, setConsortiumMembers] = useState<any[]>([]); // Пока не используется

  // Многолетний договор
  const [isMultiYear, setIsMultiYear] = useState(project.contract?.isMultiYear || false);
  const [yearlyAmounts, setYearlyAmounts] = useState<YearlyAmount[]>(
    project.contract?.yearlyAmounts || []
  );

  // Допсоглашения
  const [amendments, setAmendments] = useState<ContractAmendment[]>(() => {
    const contractAmendments = project.contract?.amendments || [];
    console.log('=== ИНИЦИАЛИЗАЦИЯ ДОПСОГЛАШЕНИЙ ===');
    console.log('Проект:', project.name);
    console.log('Допсоглашения из contract:', contractAmendments);
    return contractAmendments;
  });

  // Новое допсоглашение
  const [newAmendment, setNewAmendment] = useState({
    number: "",
    date: "",
    type: "other" as ContractAmendment['type'],
    description: "",
    newAmount: "",
    newEndDate: ""
  });

  const [isSaving, setIsSaving] = useState(false);

  // Загружаем список компаний (используем дефолтные компании)
  const companies = DEFAULT_COMPANIES.filter(c => c.isActive);

  // Добавить год в разбивку
  const addYear = () => {
    const currentYear = new Date().getFullYear();
    const existingYears = yearlyAmounts.map(y => y.year);
    let newYear = currentYear;
    while (existingYears.includes(newYear)) {
      newYear++;
    }
    setYearlyAmounts([...yearlyAmounts, { year: newYear, amount: 0 }]);
  };

  // Удалить год
  const removeYear = (year: number) => {
    setYearlyAmounts(yearlyAmounts.filter(y => y.year !== year));
  };

  // Обновить сумму года
  const updateYearAmount = (year: number, amount: number) => {
    setYearlyAmounts(yearlyAmounts.map(y =>
      y.year === year ? { ...y, amount } : y
    ));
  };

  // Добавить допсоглашение
  const addAmendment = () => {
    if (!newAmendment.number || !newAmendment.date || !newAmendment.description) {
      toast({
        title: "Ошибка",
        description: "Заполните номер, дату и описание допсоглашения",
        variant: "destructive"
      });
      return;
    }

    const amendment: ContractAmendment = {
      id: `amend_${Date.now()}`,
      number: newAmendment.number,
      date: newAmendment.date,
      type: newAmendment.type,
      description: newAmendment.description,
      newAmount: newAmendment.newAmount ? parseFloat(newAmendment.newAmount) : undefined,
      newEndDate: newAmendment.newEndDate || undefined,
      createdBy: user?.id || "",
      createdAt: new Date().toISOString()
    };

    setAmendments([...amendments, amendment]);
    setNewAmendment({
      number: "",
      date: "",
      type: "other",
      description: "",
      newAmount: "",
      newEndDate: ""
    });

    toast({
      title: "Допсоглашение добавлено",
      description: `Допсоглашение №${amendment.number} добавлено`
    });
  };

  // Удалить допсоглашение
  const removeAmendment = (id: string) => {
    setAmendments(amendments.filter(a => a.id !== id));
  };

  // Функции для консорциума
  const addConsortiumMember = () => {
    const currentTotal = consortiumMembers.reduce((sum: number, m: any) => sum + m.sharePercentage, 0);
    const remaining = 100 - currentTotal;
    setConsortiumMembers([...consortiumMembers, { companyId: "", sharePercentage: remaining > 0 ? remaining : 10 }]);
  };

  const removeConsortiumMember = (index: number) => {
    if (consortiumMembers.length <= 2) {
      toast({ title: "Ошибка", description: "Минимум 2 участника консорциума", variant: "destructive" });
      return;
    }
    setConsortiumMembers(consortiumMembers.filter((_: any, i: number) => i !== index));
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
    return consortiumMembers.reduce((sum: number, m: any) => sum + m.sharePercentage, 0);
  };

  const isShareValid = () => {
    const total = getTotalShare();
    return Math.abs(total - 100) < 0.01;
  };

  // Сохранить изменения
  const handleSave = async () => {
    setIsSaving(true);

    try {
      const amount = parseFloat(amountWithoutVAT) || 0;
      const vat = parseFloat(vatRate) || 0;
      const vatAmount = amount * (vat / 100);

      const updatedContract = {
        ...project.contract,
        number: contractNumber,
        date: contractDate,
        subject: contractSubject,
        serviceStartDate,
        serviceEndDate,
        amountWithoutVAT: amount,
        vatRate: vat,
        vatAmount: vatAmount,
        amountWithVAT: amount + vatAmount,
        isMultiYear,
        yearlyAmounts: isMultiYear ? yearlyAmounts : undefined,
        amendments: amendments.length > 0 ? amendments : undefined
      };

      const updatedProject: ProjectV3 = {
        ...project,
        // Обновляем данные клиента
        client: {
          ...project.client,
          name: clientName,
          website: clientWebsite,
          activity: clientActivity,
          city: clientCity
        },
        contract: {
          ...updatedContract,
          currency: currency
        },
        // Всегда синхронизируем finances с суммой договора (чтобы в списке показывалась актуальная сумма)
        finances: {
          ...project.finances,
          amountWithoutVAT: amount,
          vatRate: vat,
          vatAmount: vatAmount,
          amountWithVAT: amount + vatAmount,
          currency: currency,
        },
        // Обновляем настройки проекта
        type: projectType as ProjectType,
        companyId: companyId || project.companyId,
        companyName: companies.find(c => c.id === (companyId || project.companyId))?.name || project.companyName,
        // Если была пролонгация - обновляем даты проекта
        ...(amendments.some(a => a.type === 'prolongation' && a.newEndDate) && {
          endDate: amendments.find(a => a.type === 'prolongation' && a.newEndDate)?.newEndDate
        }),
        updated_at: new Date().toISOString()
      };

      console.log('=== СОХРАНЕНИЕ ПРОЕКТА ===');
      console.log('Проект ID:', project.id);
      console.log('Допсоглашения:', amendments);
      console.log('Обновленный проект:', updatedProject);

      const result = await supabaseDataStore.updateProject(project.id, updatedProject);

      if (result === null) {
        throw new Error("Не удалось сохранить в базе данных. Проверьте подключение или обратитесь к администратору.");
      }

      toast({
        title: "✅ Проект обновлён",
        description: "Изменения сохранены"
      });

      onSave(updatedProject);
      onClose();
    } catch (error: any) {
      console.error("❌ ОШИБКА СОХРАНЕНИЯ:", error);
      console.error("Детали ошибки:", error.message);
      console.error("Stack:", error.stack);
      toast({
        title: "Ошибка сохранения",
        description: error.message || "Не удалось сохранить изменения",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const amendmentTypeLabels: Record<ContractAmendment['type'], string> = {
    prolongation: "Пролонгация",
    amount_change: "Изменение суммы",
    scope_change: "Изменение объёма работ",
    other: "Прочее"
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5" />
            Редактирование проекта
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="client" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="client">Клиент</TabsTrigger>
            <TabsTrigger value="contract">Договор</TabsTrigger>
            <TabsTrigger value="settings">Настройки</TabsTrigger>
            <TabsTrigger value="files">Файлы</TabsTrigger>
            <TabsTrigger value="amendments">
              Допсоглашения
              {amendments.length > 0 && (
                <Badge variant="secondary" className="ml-2">{amendments.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="years">По годам</TabsTrigger>
          </TabsList>

          {/* Вкладка клиента */}
          <TabsContent value="client" className="space-y-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Информация о клиенте</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clientName">Название клиента</Label>
                  <Input
                    id="clientName"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="ТОО 'Компания'"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="clientWebsite">Веб-сайт</Label>
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
                  <Label htmlFor="clientActivity">Вид деятельности</Label>
                  <Input
                    id="clientActivity"
                    value={clientActivity}
                    onChange={(e) => setClientActivity(e.target.value)}
                    placeholder="Производство и торговля"
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
              </div>
            </Card>
          </TabsContent>

          {/* Вкладка настроек */}
          <TabsContent value="settings" className="space-y-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Настройки проекта
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Валюта договора</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KZT">🇰🇿 Тенге (₸)</SelectItem>
                      <SelectItem value="USD">🇺🇸 Доллар ($)</SelectItem>
                      <SelectItem value="EUR">🇪🇺 Евро (€)</SelectItem>
                      <SelectItem value="RUB">🇷🇺 Рубль (₽)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Вид проекта</Label>
                  <Select value={projectType} onValueChange={setProjectType}>
                    <SelectTrigger>
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
              </div>

              {/* Консорциум */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="consortium">Консорциум</Label>
                    <Switch
                      id="consortium"
                      checked={isConsortium}
                      onCheckedChange={setIsConsortium}
                    />
                  </div>
                  {isConsortium && (
                    <Badge variant={isShareValid() ? "default" : "destructive"}>
                      Сумма долей: {getTotalShare().toFixed(1)}%
                    </Badge>
                  )}
                </div>

                {isConsortium ? (
                  <div className="space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Участники консорциума
                    </h4>

                    {consortiumMembers.map((member: any, index: number) => (
                      <div key={index} className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                        <div className="flex-1">
                          <Label className="text-xs">Компания</Label>
                          <Select
                            value={member.companyId}
                            onValueChange={(v) => updateConsortiumMember(index, 'companyId', v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Выберите компанию" />
                            </SelectTrigger>
                            <SelectContent>
                              {companies.map((company) => (
                                <SelectItem key={company.id} value={company.id}>
                                  {company.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="w-32">
                          <Label className="text-xs">Доля %</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={member.sharePercentage}
                            onChange={(e) => updateConsortiumMember(index, 'sharePercentage', e.target.value)}
                          />
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeConsortiumMember(index)}
                          disabled={consortiumMembers.length <= 2}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))}

                    <Button onClick={addConsortiumMember} variant="outline" className="w-full">
                      <Plus className="w-4 h-4 mr-2" />
                      Добавить участника
                    </Button>

                    {!isShareValid() && (
                      <div className="flex items-center gap-2 text-yellow-600 text-sm p-3 bg-yellow-50 rounded-lg">
                        <AlertCircle className="w-4 h-4" />
                        Сумма долей должна быть 100%
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <Label>Компания-исполнитель</Label>
                    <Select value={companyId} onValueChange={setCompanyId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите компанию" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* Вкладка файлов */}
          <TabsContent value="files" className="space-y-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                Файлы проекта
              </h3>
              <ProjectFileManager
                projectId={project.id}
                uploadedBy={user?.id || ""}
                onFilesChange={() => {}}
              />
            </Card>
          </TabsContent>

          {/* Вкладка договора */}
          <TabsContent value="contract" className="space-y-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Основные данные договора
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Номер договора</Label>
                  <Input
                    value={contractNumber}
                    onChange={(e) => setContractNumber(e.target.value)}
                    placeholder="№ 123/2025"
                  />
                </div>
                <div>
                  <Label>Дата договора</Label>
                  <Input
                    type="date"
                    value={contractDate}
                    onChange={(e) => setContractDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-4">
                <Label>Предмет договора</Label>
                <Textarea
                  value={contractSubject}
                  onChange={(e) => setContractSubject(e.target.value)}
                  placeholder="Оказание услуг..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <Label>Дата начала услуг</Label>
                  <Input
                    type="date"
                    value={serviceStartDate}
                    onChange={(e) => setServiceStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Дата окончания услуг</Label>
                  <Input
                    type="date"
                    value={serviceEndDate}
                    onChange={(e) => setServiceEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <Label>Сумма без НДС</Label>
                  <Input
                    type="number"
                    value={amountWithoutVAT}
                    onChange={(e) => setAmountWithoutVAT(e.target.value)}
                    placeholder="10000000"
                  />
                </div>
                <div>
                  <Label>Ставка НДС</Label>
                  <Select value={vatRate} onValueChange={setVatRate}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Без НДС (0%)</SelectItem>
                      <SelectItem value="12">НДС 12%</SelectItem>
                      <SelectItem value="16">НДС 16%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Расчёт */}
              {amountWithoutVAT && (
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span>Сумма без НДС:</span>
                    <span>{parseFloat(amountWithoutVAT).toLocaleString()} ₸</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>НДС ({vatRate}%):</span>
                    <span>{(parseFloat(amountWithoutVAT) * parseFloat(vatRate) / 100).toLocaleString()} ₸</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t pt-2 mt-2">
                    <span>Итого с НДС:</span>
                    <span>{(parseFloat(amountWithoutVAT) * (1 + parseFloat(vatRate) / 100)).toLocaleString()} ₸</span>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Вкладка допсоглашений */}
          <TabsContent value="amendments" className="space-y-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Допсоглашения и изменения
              </h3>

              {/* Список допсоглашений */}
              {amendments.length > 0 && (
                <div className="space-y-2 mb-4">
                  {amendments.map((amend) => (
                    <div key={amend.id} className="flex items-start justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">№{amend.number}</span>
                          <Badge variant="outline">{amendmentTypeLabels[amend.type]}</Badge>
                          <span className="text-sm text-muted-foreground">{amend.date}</span>
                        </div>
                        <p className="text-sm mt-1">{amend.description}</p>
                        {amend.newAmount && (
                          <p className="text-sm text-green-600">Новая сумма: {amend.newAmount.toLocaleString()} ₸</p>
                        )}
                        {amend.newEndDate && (
                          <p className="text-sm text-blue-600">Новая дата окончания: {amend.newEndDate}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAmendment(amend.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Форма добавления */}
              <div className="border rounded-lg p-4 space-y-4">
                <h4 className="font-medium">Добавить допсоглашение</h4>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Номер</Label>
                    <Input
                      value={newAmendment.number}
                      onChange={(e) => setNewAmendment({...newAmendment, number: e.target.value})}
                      placeholder="ДС-1"
                    />
                  </div>
                  <div>
                    <Label>Дата</Label>
                    <Input
                      type="date"
                      value={newAmendment.date}
                      onChange={(e) => setNewAmendment({...newAmendment, date: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>Тип изменения</Label>
                    <Select
                      value={newAmendment.type}
                      onValueChange={(v: ContractAmendment['type']) => setNewAmendment({...newAmendment, type: v})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prolongation">Пролонгация</SelectItem>
                        <SelectItem value="amount_change">Изменение суммы</SelectItem>
                        <SelectItem value="scope_change">Изменение объёма работ</SelectItem>
                        <SelectItem value="other">Прочее</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Описание изменений</Label>
                  <Textarea
                    value={newAmendment.description}
                    onChange={(e) => setNewAmendment({...newAmendment, description: e.target.value})}
                    placeholder="Описание изменений по допсоглашению..."
                    rows={2}
                  />
                </div>

                {newAmendment.type === 'amount_change' && (
                  <div>
                    <Label>Новая сумма (без НДС)</Label>
                    <Input
                      type="number"
                      value={newAmendment.newAmount}
                      onChange={(e) => setNewAmendment({...newAmendment, newAmount: e.target.value})}
                      placeholder="15000000"
                    />
                  </div>
                )}

                {newAmendment.type === 'prolongation' && (
                  <div>
                    <Label>Новая дата окончания</Label>
                    <Input
                      type="date"
                      value={newAmendment.newEndDate}
                      onChange={(e) => setNewAmendment({...newAmendment, newEndDate: e.target.value})}
                    />
                  </div>
                )}

                <Button onClick={addAmendment} variant="outline" className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Добавить допсоглашение
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Вкладка разбивки по годам */}
          <TabsContent value="years" className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Разбивка по годам
                </h3>
                <div className="flex items-center gap-2">
                  <Label htmlFor="multi-year">Многолетний договор</Label>
                  <Switch
                    id="multi-year"
                    checked={isMultiYear}
                    onCheckedChange={setIsMultiYear}
                  />
                </div>
              </div>

              {isMultiYear ? (
                <>
                  {/* Список годов */}
                  {yearlyAmounts.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {yearlyAmounts
                        .sort((a, b) => a.year - b.year)
                        .map((ya) => (
                          <div key={ya.year} className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                            <span className="font-medium w-20">{ya.year} год</span>
                            <Input
                              type="number"
                              value={ya.amount}
                              onChange={(e) => updateYearAmount(ya.year, parseFloat(e.target.value) || 0)}
                              className="flex-1"
                              placeholder="Сумма"
                            />
                            <span className="text-sm text-muted-foreground">₸</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeYear(ya.year)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                    </div>
                  )}

                  <Button onClick={addYear} variant="outline" className="w-full mb-4">
                    <Plus className="w-4 h-4 mr-2" />
                    Добавить год
                  </Button>

                  {/* Итоги */}
                  {yearlyAmounts.length > 0 && (
                    <div className="p-3 bg-muted rounded-lg space-y-2">
                      <div className="flex justify-between">
                        <span>Сумма по годам:</span>
                        <span className="font-medium">
                          {yearlyAmounts.reduce((sum, y) => sum + y.amount, 0).toLocaleString()} ₸
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Сумма по договору:</span>
                        <span className="font-medium">
                          {(parseFloat(amountWithoutVAT) || 0).toLocaleString()} ₸
                        </span>
                      </div>
                      {Math.abs(yearlyAmounts.reduce((sum, y) => sum + y.amount, 0) - (parseFloat(amountWithoutVAT) || 0)) > 1 && (
                        <div className="flex items-center gap-2 text-yellow-600 text-sm">
                          <AlertCircle className="w-4 h-4" />
                          Сумма по годам не совпадает с суммой договора
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Включите "Многолетний договор" для разбивки суммы по годам</p>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Сохранение..." : "Сохранить изменения"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
