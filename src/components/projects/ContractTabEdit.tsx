import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Save } from "lucide-react";
import { ProjectV3, ProjectCurrency, ProjectType, PROJECT_TYPE_LABELS } from "@/types/project-v3";
import { DEFAULT_COMPANIES } from "@/types/companies";
import { supabaseDataStore } from "@/lib/supabaseDataStore";
import { useToast } from "@/hooks/use-toast";

interface ContractTabEditProps {
  project: ProjectV3;
  onSave: (updatedProject: ProjectV3) => void;
}

// Inline editing component for contract tab - force redeploy
export function ContractTabEdit({ project, onSave }: ContractTabEditProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

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

  const companies = DEFAULT_COMPANIES.filter(c => c.isActive);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const amount = parseFloat(amountWithoutVAT) || 0;
      const vat = parseFloat(vatRate) || 0;
      const vatAmount = amount * (vat / 100);
      const amountWithVAT = amount + vatAmount;

      const updatedProject: ProjectV3 = {
        ...project,
        // Обновляем настройки проекта
        type: projectType as ProjectType,
        companyId: companyId || project.companyId,
        companyName: companies.find(c => c.id === (companyId || project.companyId))?.name || project.companyName,
        contract: {
          ...project.contract,
          number: contractNumber,
          date: contractDate,
          subject: contractSubject,
          serviceStartDate: serviceStartDate,
          serviceEndDate: serviceEndDate,
          amountWithoutVAT: amount,
          vatRate: vat,
          vatAmount: vatAmount,
          amountWithVAT: amountWithVAT,
          currency: currency,
        },
        updated_at: new Date().toISOString()
      };

      await supabaseDataStore.updateProject(project.id, updatedProject);

      toast({
        title: "✅ Проект обновлён",
        description: "Изменения сохранены"
      });

      onSave(updatedProject);
    } catch (error: any) {
      console.error("❌ ОШИБКА СОХРАНЕНИЯ:", error);
      toast({
        title: "Ошибка сохранения",
        description: error.message || "Не удалось сохранить изменения",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Редактирование договора
        </h3>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Сохранение..." : "Сохранить"}
        </Button>
      </div>

      <div className="space-y-6">
        {/* Основные данные договора */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Номер договора</Label>
            <Input
              value={contractNumber}
              onChange={(e) => setContractNumber(e.target.value)}
              placeholder="№ договора"
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

        <div>
          <Label>Предмет договора</Label>
          <Input
            value={contractSubject}
            onChange={(e) => setContractSubject(e.target.value)}
            placeholder="Предмет договора"
          />
        </div>

        {/* Сроки */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Срок начала оказания услуг</Label>
            <Input
              type="date"
              value={serviceStartDate}
              onChange={(e) => setServiceStartDate(e.target.value)}
            />
          </div>
          <div>
            <Label>Срок окончания оказания услуг</Label>
            <Input
              type="date"
              value={serviceEndDate}
              onChange={(e) => setServiceEndDate(e.target.value)}
            />
          </div>
        </div>

        {/* Суммы */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Сумма без НДС</Label>
            <Input
              type="number"
              value={amountWithoutVAT}
              onChange={(e) => setAmountWithoutVAT(e.target.value)}
              placeholder="0"
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

        {/* Настройки проекта */}
        <div className="pt-6 border-t">
          <h4 className="font-medium mb-4">Настройки проекта</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Валюта договора</Label>
              <Select value={currency} onValueChange={(value) => setCurrency(value as ProjectCurrency)}>
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
              <Select value={projectType} onValueChange={(value) => setProjectType(value as ProjectType)}>
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
          </div>
        </div>

        {/* Итоговые суммы */}
        <div className="pt-6 border-t">
          <h4 className="font-medium mb-3">Итоговые суммы</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Сумма без НДС:</span>
              <span className="font-medium">{(parseFloat(amountWithoutVAT) || 0).toLocaleString()} ₸</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">НДС ({vatRate}%):</span>
              <span className="font-medium">{((parseFloat(amountWithoutVAT) || 0) * (parseFloat(vatRate) || 0) / 100).toLocaleString()} ₸</span>
            </div>
            <div className="flex justify-between text-lg">
              <span className="font-semibold">Итого с НДС:</span>
              <span className="font-semibold text-primary">
                {((parseFloat(amountWithoutVAT) || 0) * (1 + (parseFloat(vatRate) || 0) / 100)).toLocaleString()} ₸
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
