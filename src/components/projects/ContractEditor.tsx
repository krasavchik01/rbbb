/**
 * Компонент редактирования договора и дополнительных соглашений
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  FileText,
  Plus,
  Trash2,
  Edit,
  Save,
  X,
  Upload,
  Calendar,
  DollarSign,
  FileSignature,
  Files,
  Download,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabaseDataStore } from '@/lib/supabaseDataStore';
import { ContractInfo, ProjectAmendment, ProjectCurrency, CURRENCY_LABELS, ProjectType, PROJECT_TYPE_LABELS } from '@/types/project-v3';
import { DEFAULT_COMPANIES } from '@/types/companies';

interface ContractEditorProps {
  projectId: string;
  contract: ContractInfo | null;
  amendments?: ProjectAmendment[];
  projectType?: string;
  companyId?: string;
  companyName?: string;
  onContractUpdate: (contract: ContractInfo) => void;
  onProjectSettingsUpdate?: (settings: { type?: string; companyId?: string; companyName?: string }) => void;
  onAmendmentAdd?: (amendment: ProjectAmendment) => void;
  onAmendmentDelete?: (amendmentId: string) => void;
  canEdit?: boolean;
}

export function ContractEditor({
  projectId,
  contract,
  amendments = [],
  projectType: initialProjectType,
  companyId: initialCompanyId,
  companyName: initialCompanyName,
  onContractUpdate,
  onProjectSettingsUpdate,
  onAmendmentAdd,
  onAmendmentDelete,
  canEdit = true,
}: ContractEditorProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editedContract, setEditedContract] = useState<ContractInfo | null>(contract);
  const [showAddAmendment, setShowAddAmendment] = useState(false);
  const [amendmentToDelete, setAmendmentToDelete] = useState<string | null>(null);

  // Настройки проекта
  const [editedProjectType, setEditedProjectType] = useState(initialProjectType || '');
  const [editedCompanyId, setEditedCompanyId] = useState(initialCompanyId || '');
  const companies = DEFAULT_COMPANIES.filter(c => c.isActive);

  // Форма доп соглашения
  const [newAmendment, setNewAmendment] = useState({
    number: '',
    date: '',
    description: '',
    amountChange: 0,
  });

  // Загрузка файлов
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [amendmentFile, setAmendmentFile] = useState<File | null>(null);

  useEffect(() => {
    setEditedContract(contract);
  }, [contract]);

  useEffect(() => {
    setEditedProjectType(initialProjectType || '');
  }, [initialProjectType]);

  useEffect(() => {
    setEditedCompanyId(initialCompanyId || '');
  }, [initialCompanyId]);

  const handleSaveContract = async () => {
    if (!editedContract) return;

    try {
      // Загружаем файлы если есть
      if (contractFile) {
        const result = await supabaseDataStore.uploadProjectFile(
          projectId,
          contractFile,
          'contract',
          'system'
        );
        editedContract.contractScanUrl = result.publicUrl;
      }

      if (originalFile) {
        const result = await supabaseDataStore.uploadProjectFile(
          projectId,
          originalFile,
          'contract',
          'system'
        );
        editedContract.contractOriginalUrl = result.publicUrl;
      }

      // Рассчитываем НДС
      const vatRate = editedContract.vatRate || 0;
      const amountWithoutVAT = editedContract.amountWithoutVAT || 0;
      editedContract.vatAmount = amountWithoutVAT * (vatRate / 100);
      editedContract.amountWithVAT = amountWithoutVAT + editedContract.vatAmount;

      onContractUpdate(editedContract);

      // Сохраняем настройки проекта (вид проекта, компания)
      if (onProjectSettingsUpdate) {
        const selectedCompany = companies.find(c => c.id === editedCompanyId);
        onProjectSettingsUpdate({
          type: editedProjectType || undefined,
          companyId: editedCompanyId || undefined,
          companyName: selectedCompany?.name || undefined,
        });
      }

      setIsEditing(false);
      setContractFile(null);
      setOriginalFile(null);

      toast({
        title: '✅ Договор обновлён',
        description: 'Данные договора успешно сохранены',
      });
    } catch (error) {
      console.error('Error saving contract:', error);
      toast({
        title: '❌ Ошибка',
        description: 'Не удалось сохранить договор',
        variant: 'destructive',
      });
    }
  };

  const handleAddAmendment = async () => {
    if (!newAmendment.number || !newAmendment.date) {
      toast({
        title: 'Ошибка',
        description: 'Укажите номер и дату доп. соглашения',
        variant: 'destructive',
      });
      return;
    }

    try {
      let fileUrl: string | undefined;

      if (amendmentFile) {
        const result = await supabaseDataStore.uploadProjectFile(
          projectId,
          amendmentFile,
          'document',
          'system'
        );
        fileUrl = result.publicUrl;
      }

      const amendment: ProjectAmendment = {
        id: `amend_${Date.now()}`,
        projectId,
        number: newAmendment.number,
        date: newAmendment.date,
        description: newAmendment.description,
        fileUrl,
        createdBy: 'system',
        createdAt: new Date().toISOString(),
      };

      // Сохраняем в Supabase
      await supabaseDataStore.createProjectAmendment(projectId, {
        number: amendment.number,
        date: amendment.date,
        description: amendment.description,
        fileUrl: amendment.fileUrl,
      }, 'system');

      onAmendmentAdd?.(amendment);

      setNewAmendment({ number: '', date: '', description: '', amountChange: 0 });
      setAmendmentFile(null);
      setShowAddAmendment(false);

      toast({
        title: '✅ Доп. соглашение добавлено',
        description: `Доп. соглашение №${amendment.number} успешно добавлено`,
      });
    } catch (error) {
      console.error('Error adding amendment:', error);
      toast({
        title: '❌ Ошибка',
        description: 'Не удалось добавить доп. соглашение',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteAmendment = async () => {
    if (!amendmentToDelete) return;

    try {
      await supabaseDataStore.deleteProjectAmendment(amendmentToDelete);
      onAmendmentDelete?.(amendmentToDelete);
      setAmendmentToDelete(null);

      toast({
        title: '✅ Доп. соглашение удалено',
      });
    } catch (error) {
      console.error('Error deleting amendment:', error);
      toast({
        title: '❌ Ошибка',
        description: 'Не удалось удалить доп. соглашение',
        variant: 'destructive',
      });
    }
  };

  const formatCurrency = (amount: number, currency: ProjectCurrency = 'KZT') => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (!contract && !isEditing) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Данные договора не указаны</p>
          {canEdit && (
            <Button onClick={() => setIsEditing(true)} variant="outline" className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Добавить данные договора
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Основной договор */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center">
              <FileSignature className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Договор</CardTitle>
              {contract && (
                <p className="text-sm text-muted-foreground">
                  №{contract.number} от {new Date(contract.date).toLocaleDateString('ru-RU')}
                </p>
              )}
            </div>
          </div>
          {canEdit && !isEditing && (
            <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
              <Edit className="w-4 h-4 mr-2" />
              Редактировать
            </Button>
          )}
        </CardHeader>

        <CardContent>
          {isEditing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Номер договора</Label>
                  <Input
                    value={editedContract?.number || ''}
                    onChange={(e) => setEditedContract(prev => prev ? { ...prev, number: e.target.value } : null)}
                    placeholder="№ 123/2025"
                  />
                </div>
                <div>
                  <Label>Дата договора</Label>
                  <Input
                    type="date"
                    value={editedContract?.date || ''}
                    onChange={(e) => setEditedContract(prev => prev ? { ...prev, date: e.target.value } : null)}
                  />
                </div>
              </div>

              <div>
                <Label>Предмет договора</Label>
                <Textarea
                  value={editedContract?.subject || ''}
                  onChange={(e) => setEditedContract(prev => prev ? { ...prev, subject: e.target.value } : null)}
                  placeholder="Оказание услуг по аудиту"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Срок начала</Label>
                  <Input
                    type="date"
                    value={editedContract?.serviceStartDate || ''}
                    onChange={(e) => setEditedContract(prev => prev ? { ...prev, serviceStartDate: e.target.value } : null)}
                  />
                </div>
                <div>
                  <Label>Срок окончания</Label>
                  <Input
                    type="date"
                    value={editedContract?.serviceEndDate || ''}
                    onChange={(e) => setEditedContract(prev => prev ? { ...prev, serviceEndDate: e.target.value } : null)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Валюта</Label>
                  <Select
                    value={editedContract?.currency || 'KZT'}
                    onValueChange={(value) => setEditedContract(prev => prev ? { ...prev, currency: value as ProjectCurrency } : null)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CURRENCY_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Сумма без НДС</Label>
                  <Input
                    type="number"
                    value={editedContract?.amountWithoutVAT || 0}
                    onChange={(e) => setEditedContract(prev => prev ? { ...prev, amountWithoutVAT: parseFloat(e.target.value) || 0 } : null)}
                    placeholder="10000000"
                  />
                </div>
                <div>
                  <Label>Ставка НДС</Label>
                  <Select
                    value={String(editedContract?.vatRate ?? 16)}
                    onValueChange={(value) => setEditedContract(prev => prev ? { ...prev, vatRate: parseFloat(value) } : null)}
                  >
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

              {/* Итоговые суммы */}
              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Сумма без НДС:</span>
                    <p className="font-medium">{(editedContract?.amountWithoutVAT || 0).toLocaleString()} {editedContract?.currency || 'KZT'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">НДС ({editedContract?.vatRate ?? 16}%):</span>
                    <p className="font-medium">{((editedContract?.amountWithoutVAT || 0) * ((editedContract?.vatRate ?? 16) / 100)).toLocaleString()} {editedContract?.currency || 'KZT'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-semibold">Итого с НДС:</span>
                    <p className="font-bold text-primary">{((editedContract?.amountWithoutVAT || 0) * (1 + (editedContract?.vatRate ?? 16) / 100)).toLocaleString()} {editedContract?.currency || 'KZT'}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Настройки проекта */}
              <div>
                <h4 className="font-medium mb-3">Настройки проекта</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Вид проекта</Label>
                    <Select value={editedProjectType} onValueChange={setEditedProjectType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите вид проекта" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PROJECT_TYPE_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Компания-исполнитель</Label>
                    <Select value={editedCompanyId} onValueChange={setEditedCompanyId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите компанию" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Скан договора (заменить)</Label>
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setContractFile(e.target.files?.[0] || null)}
                  />
                  {contractFile && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Новый файл: {contractFile.name}
                    </p>
                  )}
                  {editedContract?.contractScanUrl && !contractFile && (
                    <p className="text-xs text-green-500 mt-1">
                      ✓ Скан загружен
                    </p>
                  )}
                </div>
                <div>
                  <Label>Оригинал договора</Label>
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setOriginalFile(e.target.files?.[0] || null)}
                  />
                  {originalFile && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Новый файл: {originalFile.name}
                    </p>
                  )}
                  {editedContract?.contractOriginalUrl && !originalFile && (
                    <p className="text-xs text-green-500 mt-1">
                      ✓ Оригинал загружен
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => {
                  setIsEditing(false);
                  setEditedContract(contract);
                  setContractFile(null);
                  setOriginalFile(null);
                }}>
                  <X className="w-4 h-4 mr-2" />
                  Отмена
                </Button>
                <Button onClick={handleSaveContract}>
                  <Save className="w-4 h-4 mr-2" />
                  Сохранить
                </Button>
              </div>
            </div>
          ) : contract && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Предмет договора</p>
                  <p className="font-medium">{contract.subject || 'Не указан'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Сумма без НДС</p>
                  <p className="font-bold text-lg text-primary">
                    {formatCurrency(contract.amountWithoutVAT, contract.currency)}
                  </p>
                </div>
              </div>

              {/* НДС и итого */}
              {contract.vatRate !== undefined && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Ставка НДС</p>
                    <p className="font-medium">{contract.vatRate === 0 ? 'Без НДС' : `${contract.vatRate}%`}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Сумма НДС</p>
                    <p className="font-medium">{formatCurrency(contract.vatAmount || 0, contract.currency)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Итого с НДС</p>
                    <p className="font-bold text-primary">{formatCurrency(contract.amountWithVAT || 0, contract.currency)}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Срок оказания услуг</p>
                  <p className="font-medium">
                    {contract.serviceStartDate && new Date(contract.serviceStartDate).toLocaleDateString('ru-RU')} — {contract.serviceEndDate && new Date(contract.serviceEndDate).toLocaleDateString('ru-RU')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Файлы</p>
                  <div className="flex gap-2 mt-1">
                    {contract.contractScanUrl && (
                      <a href={contract.contractScanUrl} target="_blank" rel="noopener noreferrer">
                        <Badge variant="outline" className="cursor-pointer hover:bg-primary/10">
                          <FileText className="w-3 h-3 mr-1" />
                          Скан
                        </Badge>
                      </a>
                    )}
                    {contract.contractOriginalUrl && (
                      <a href={contract.contractOriginalUrl} target="_blank" rel="noopener noreferrer">
                        <Badge variant="outline" className="cursor-pointer hover:bg-primary/10 bg-green-500/10 border-green-500/30">
                          <FileText className="w-3 h-3 mr-1" />
                          Оригинал
                        </Badge>
                      </a>
                    )}
                    {!contract.contractScanUrl && !contract.contractOriginalUrl && (
                      <span className="text-sm text-muted-foreground">Файлы не загружены</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Настройки проекта - только просмотр */}
              {(initialProjectType || initialCompanyName) && (
                <div className="pt-4 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {initialProjectType && (
                      <div>
                        <p className="text-sm text-muted-foreground">Вид проекта</p>
                        <p className="font-medium">{PROJECT_TYPE_LABELS[initialProjectType as ProjectType] || initialProjectType}</p>
                      </div>
                    )}
                    {initialCompanyName && (
                      <div>
                        <p className="text-sm text-muted-foreground">Компания-исполнитель</p>
                        <p className="font-medium">{initialCompanyName}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Дополнительные соглашения */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg flex items-center justify-center">
              <Files className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Дополнительные соглашения</CardTitle>
              <p className="text-sm text-muted-foreground">
                {amendments.length > 0 ? `${amendments.length} доп. соглашений` : 'Нет доп. соглашений'}
              </p>
            </div>
          </div>
          {canEdit && (
            <Button onClick={() => setShowAddAmendment(true)} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Добавить
            </Button>
          )}
        </CardHeader>

        <CardContent>
          {amendments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Files className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Дополнительные соглашения отсутствуют</p>
            </div>
          ) : (
            <div className="space-y-3">
              {amendments.map((amendment) => (
                <div
                  key={amendment.id}
                  className="p-4 bg-muted/30 rounded-lg border flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">№{amendment.number}</Badge>
                      <span className="text-sm text-muted-foreground">
                        от {new Date(amendment.date).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                    <p className="text-sm">{amendment.description || 'Без описания'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {amendment.fileUrl && (
                      <a href={amendment.fileUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon">
                          <Download className="w-4 h-4" />
                        </Button>
                      </a>
                    )}
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setAmendmentToDelete(amendment.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Диалог добавления доп соглашения */}
      <Dialog open={showAddAmendment} onOpenChange={setShowAddAmendment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить доп. соглашение</DialogTitle>
            <DialogDescription>
              Укажите данные дополнительного соглашения к договору
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Номер</Label>
                <Input
                  value={newAmendment.number}
                  onChange={(e) => setNewAmendment(prev => ({ ...prev, number: e.target.value }))}
                  placeholder="ДС-1"
                />
              </div>
              <div>
                <Label>Дата</Label>
                <Input
                  type="date"
                  value={newAmendment.date}
                  onChange={(e) => setNewAmendment(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label>Описание</Label>
              <Textarea
                value={newAmendment.description}
                onChange={(e) => setNewAmendment(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Изменение сроков, суммы и т.д."
                rows={3}
              />
            </div>

            <div>
              <Label>Файл доп. соглашения</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={(e) => setAmendmentFile(e.target.files?.[0] || null)}
              />
              {amendmentFile && (
                <p className="text-xs text-muted-foreground mt-1">
                  Выбран: {amendmentFile.name}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddAmendment(false);
              setNewAmendment({ number: '', date: '', description: '', amountChange: 0 });
              setAmendmentFile(null);
            }}>
              Отмена
            </Button>
            <Button onClick={handleAddAmendment}>
              <Plus className="w-4 h-4 mr-2" />
              Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Подтверждение удаления */}
      <AlertDialog open={!!amendmentToDelete} onOpenChange={() => setAmendmentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить доп. соглашение?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Доп. соглашение будет удалено безвозвратно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAmendment} className="bg-destructive text-destructive-foreground">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
