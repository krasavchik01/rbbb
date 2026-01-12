import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Building2, Plus, Trash2, Edit, Save } from 'lucide-react';
import { Company } from '@/types/companies';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

interface CompaniesManagementProps {
  companies: Company[];
  onChange: (companies: Company[]) => void;
}

export function CompaniesManagement({ companies, onChange }: CompaniesManagementProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Company>>({});

  const handleAdd = () => {
    setFormData({
      id: '',
      name: '',
      fullName: '',
      inn: '',
      isActive: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setIsAdding(true);
  };

  const handleEdit = (company: Company) => {
    setFormData(company);
    setEditingId(company.id);
  };

  const handleSave = () => {
    if (!formData.id || !formData.name || !formData.fullName || !formData.inn) {
      alert('Заполните все обязательные поля');
      return;
    }

    let updatedCompanies: Company[];

    if (editingId) {
      // Обновление существующей компании
      updatedCompanies = companies.map(c =>
        c.id === editingId
          ? { ...formData, updated_at: new Date().toISOString() } as Company
          : c
      );
    } else {
      // Проверка на дубликат ID
      if (companies.some(c => c.id === formData.id)) {
        alert('Компания с таким ID уже существует');
        return;
      }
      // Добавление новой компании
      updatedCompanies = [...companies, formData as Company];
    }

    onChange(updatedCompanies);
    setIsAdding(false);
    setEditingId(null);
    setFormData({});
  };

  const handleDelete = (id: string) => {
    onChange(companies.filter(c => c.id !== id));
  };

  const toggleActive = (id: string) => {
    onChange(companies.map(c =>
      c.id === id ? { ...c, isActive: !c.isActive, updated_at: new Date().toISOString() } : c
    ));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Управление компаниями</h3>
          <p className="text-sm text-muted-foreground">Список компаний группы для выбора в проектах</p>
        </div>
        <Dialog open={isAdding || editingId !== null} onOpenChange={(open) => {
          if (!open) {
            setIsAdding(false);
            setEditingId(null);
            setFormData({});
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={handleAdd}>
              <Plus className="w-4 h-4 mr-2" />
              Добавить компанию
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingId ? 'Редактировать компанию' : 'Добавить компанию'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="id">ID компании *</Label>
                  <Input
                    id="id"
                    value={formData.id || ''}
                    onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                    placeholder="mak, aplus, rb-partners"
                    disabled={editingId !== null}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Короткое название *</Label>
                  <Input
                    id="name"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="ТОО МАК"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName">Полное название *</Label>
                <Input
                  id="fullName"
                  value={formData.fullName || ''}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder='Товарищество с ограниченной ответственностью "МАК"'
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="inn">ИИН/БИН *</Label>
                  <Input
                    id="inn"
                    value={formData.inn || ''}
                    onChange={(e) => setFormData({ ...formData, inn: e.target.value })}
                    placeholder="000000000000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parentCompanyId">Родительская компания</Label>
                  <select
                    id="parentCompanyId"
                    value={formData.parentCompanyId || ''}
                    onChange={(e) => setFormData({ ...formData, parentCompanyId: e.target.value || undefined })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Нет</option>
                    {companies.filter(c => c.id !== formData.id).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Адрес</Label>
                  <Input
                    id="address"
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="г. Алматы, ул. ..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Телефон</Label>
                  <Input
                    id="phone"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+7 (700) 000-00-00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="info@company.kz"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsAdding(false);
                setEditingId(null);
                setFormData({});
              }}>
                Отмена
              </Button>
              <Button onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />
                Сохранить
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {companies.map((company) => (
          <Card key={company.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  <h4 className="font-semibold">{company.name}</h4>
                  <Badge variant={company.isActive ? "default" : "secondary"}>
                    {company.isActive ? 'Активна' : 'Неактивна'}
                  </Badge>
                  {company.parentCompanyId && (
                    <Badge variant="outline">
                      Дочерняя компания: {companies.find(c => c.id === company.parentCompanyId)?.name}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-1">{company.fullName}</p>
                <p className="text-xs text-muted-foreground">ИИН/БИН: {company.inn}</p>
                {company.address && (
                  <p className="text-xs text-muted-foreground mt-1">📍 {company.address}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Активна</Label>
                  <Switch
                    checked={company.isActive}
                    onCheckedChange={() => toggleActive(company.id)}
                  />
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleEdit(company)}>
                  <Edit className="w-4 h-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Удалить компанию?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Вы уверены, что хотите удалить компанию "{company.name}"? Это действие нельзя отменить.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Отмена</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(company.id)} className="bg-destructive text-destructive-foreground">
                        Удалить
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </Card>
        ))}

        {companies.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Нет компаний. Добавьте первую компанию.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
