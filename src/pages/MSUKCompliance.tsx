import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Download, 
  Plus, 
  Trash2, 
  Eye, 
  BookOpen, 
  Shield,
  Building2,
  Zap,
  X
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MSUKClient {
  id: number;
  name: string;
  inn: string;
  country: 'RU' | 'KZ';
  industry: string;
  publicCompany: boolean;
  litigation: boolean;
  conflictOfInterest: boolean;
  employees: string;
  revenue: string;
  documents: {
    kycForm: string;
    independenceForm: string;
    complianceChecklist: string;
    eqrForm: string;
  };
}

export default function MSUKCompliance() {
  const { toast } = useToast();
  
  const [clients, setClients] = useState<MSUKClient[]>([]);
  const [currentClient, setCurrentClient] = useState<MSUKClient | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    inn: '',
    country: 'RU' as 'RU' | 'KZ',
    industry: '',
    publicCompany: false,
    litigation: false,
    conflictOfInterest: false,
    employees: '',
    revenue: '',
  });

  const DEMO_CLIENTS = [
    {
      name: 'ТОО "МАЭК"',
      inn: '7710000000',
      country: 'KZ' as const,
      industry: 'Энергетика',
      publicCompany: true,
      litigation: false,
      conflictOfInterest: false,
      employees: '3421',
      revenue: '76000',
    },
    {
      name: 'ПАО "Газпром"',
      inn: '7704192801',
      country: 'RU' as const,
      industry: 'Энергетика',
      publicCompany: true,
      litigation: true,
      conflictOfInterest: false,
      employees: '415000',
      revenue: '10500000',
    },
    {
      name: 'ООО "Альфа-Банк"',
      inn: '7700020830',
      country: 'RU' as const,
      industry: 'Финансовые услуги',
      publicCompany: true,
      litigation: true,
      conflictOfInterest: true,
      employees: '5000',
      revenue: '250000',
    },
    {
      name: 'ООО "TechCore Solutions"',
      inn: '7708123456',
      country: 'RU' as const,
      industry: 'Информационные технологии',
      publicCompany: false,
      litigation: false,
      conflictOfInterest: false,
      employees: '250',
      revenue: '500',
    },
    {
      name: 'ОАО "Торговая сеть"',
      inn: '7701987654',
      country: 'RU' as const,
      industry: 'Розница',
      publicCompany: false,
      litigation: false,
      conflictOfInterest: true,
      employees: '2500',
      revenue: '5000',
    },
    {
      name: 'ООО "СОГД Страховая"',
      inn: '7702445566',
      country: 'RU' as const,
      industry: 'Страхование',
      publicCompany: true,
      litigation: false,
      conflictOfInterest: false,
      employees: '800',
      revenue: '2000',
    },
  ];

  const calculateRisk = (client: Partial<MSUKClient>) => {
    let riskLevel = 0;
    let factors: string[] = [];
    let eqrRequired = false;

    if (client.publicCompany) {
      riskLevel += 2;
      factors.push('✓ Публичная компания (ПЗО)');
      eqrRequired = true;
    }
    if (client.litigation) {
      riskLevel += 2;
      factors.push('✓ Судебные разбирательства');
      eqrRequired = true;
    }
    if (client.conflictOfInterest) {
      riskLevel += 1;
      factors.push('✓ Конфликт интересов');
    }
    if (client.country === 'RU') {
      riskLevel += 1;
      factors.push('✓ Риск страны - Россия');
    }
    if (client.industry === 'Финансовые услуги' || client.industry === 'Страхование') {
      riskLevel += 1;
      factors.push(`✓ Высокий риск отрасли`);
    }

    const riskText = riskLevel >= 3 ? 'ВЫСОКИЙ' : riskLevel >= 1 ? 'СРЕДНИЙ' : 'НИЗКИЙ';
    
    return { riskLevel, riskText, factors, eqrRequired };
  };

  const generateDocuments = (client: Partial<MSUKClient>) => {
    const risk = calculateRisk(client);
    const date = new Date().toLocaleDateString('ru-RU');

    const kycForm = `
═══════════════════════════════════════════════════════════
АНКЕТА КЛИЕНТА ПО МСУК-1
═══════════════════════════════════════════════════════════
Дата заполнения: ${date}

I. ОБЩАЯ ИНФОРМАЦИЯ
─────────────────────────────────────────────────────────
Наименование: ${client.name}
ИНН: ${client.inn}
Страна: ${client.country}
Вид деятельности: ${client.industry}
Количество сотрудников: ${client.employees}
Годовой доход: ${client.revenue} млн тенге

II. ФАКТОРЫ РИСКА КАЧЕСТВА (МСУК-1)
─────────────────────────────────────────────────────────
✓ Публичная компания (ПЗО): ${client.publicCompany ? 'ДА' : 'НЕТ'}
✓ Судебные разбирательства: ${client.litigation ? 'ДА' : 'НЕТ'}
✓ Конфликт интересов: ${client.conflictOfInterest ? 'ДА' : 'НЕТ'}

III. ОЦЕНКА РИСКОВ
─────────────────────────────────────────────────────────
Общий уровень риска: ${risk.riskText}
Индекс риска: ${risk.riskLevel}/5

Выявленные факторы:
${risk.factors.map(f => f).join('\n')}

IV. СПЕЦИАЛЬНЫЕ ТРЕБОВАНИЯ
─────────────────────────────────────────────────────────
EQR требуется: ${risk.eqrRequired ? 'ДА - Независимый проверяющий' : 'НЕТ'}
Ротация партнёра: ${client.publicCompany ? 'Каждые 7 лет (для ПЗО)' : 'Каждые 10 лет'}
Мониторинг: Ежегодно

V. ВЫВОД
─────────────────────────────────────────────────────────
Статус: ${risk.riskText === 'ВЫСОКИЙ' ? '⚠️ ТРЕБУЕТСЯ УСИЛЕННАЯ ПРОВЕРКА' : '✓ ОДОБРЕНО'}

Дата: ${date}
Подготовил: _________________________
Проверил: _________________________
    `.trim();

    const independenceForm = `
═══════════════════════════════════════════════════════════
ЗАЯВЛЕНИЕ О НЕЗАВИСИМОСТИ
═══════════════════════════════════════════════════════════
Клиент: ${client.name}
Дата: ${date}

ПОДТВЕРЖДЕНИЕ НЕЗАВИСИМОСТИ:
─────────────────────────────────────────────────────────
✓ Не является учредителем клиента
✓ Отсутствует финансовая заинтересованность
✓ Нет тесных деловых отношений
✓ Не предоставляли займы или поручительства
✓ Отсутствуют семейные или личные отношения
✓ Соблюдены требования по независимости
✓ Нет конфликтов интересов
✓ Полностью рассчиталось с клиентом

ВЫВОД:
─────────────────────────────────────────────────────────
Подтверждаем НЕЗАВИСИМОСТЬ аудиторской организации.

Дата: ${date}
Подпись руководителя: _________________________
    `.trim();

    const complianceChecklist = `
═══════════════════════════════════════════════════════════
ЧЕКЛИСТ СООТВЕТСТВИЯ МСУК-1
═══════════════════════════════════════════════════════════
Клиент: ${client.name}
Проверено: ${date}

8 КОМПОНЕНТОВ МСУК-1:
─────────────────────────────────────────────────────────
☑ 1. Процесс оценки рисков: ВЫПОЛНЕНО (${risk.riskText})
☑ 2. Руководство и управление: ТРЕБУЕТСЯ
☑ 3. Этические требования: ВЫПОЛНЕНО
☑ 4. Принятие клиента: ВЫПОЛНЕНО
☑ 5. Выполнение заданий: ТРЕБУЕТСЯ
☑ 6. Ресурсы: ГОТОВО
☑ 7. Информационные системы: ТРЕБУЕТСЯ
☑ 8. Мониторинг: ТРЕБУЕТСЯ

КРИТИЧЕСКИЕ ТРЕБОВАНИЯ:
─────────────────────────────────────────────────────────
✓ KYC/Due Diligence: ВЫПОЛНЕНО
✓ Проверка независимости: ВЫПОЛНЕНО
✓ Скрининг санкций: ТРЕБУЕТСЯ
${risk.eqrRequired ? '✓ EQR ТРЕБУЕТСЯ - ОБЯЗАТЕЛЕН' : ''}

РЕКОМЕНДАЦИЯ:
─────────────────────────────────────────────────────────
${risk.riskText === 'ВЫСОКИЙ' ? '🔴 ВЫСОКИЙ РИСК - УСИЛЕННАЯ ПРОВЕРКА' : '✓ К ПРИНЯТИЮ'}

Дата проверки: ${date}
Проверил: _________________________
Утвердил: _________________________
    `.trim();

    const eqrForm = risk.eqrRequired ? `
═══════════════════════════════════════════════════════════
ФОРМА НАЗНАЧЕНИЯ EQR
(Engagement Quality Reviewer - Проверяющий качества)
═══════════════════════════════════════════════════════════
Клиент: ${client.name}
Дата назначения: ${date}
Статус: 🔴 ОБЯЗАТЕЛЬНОЕ НАЗНАЧЕНИЕ

ОБОСНОВАНИЕ НАЗНАЧЕНИЯ EQR (МСУК-2):
─────────────────────────────────────────────────────────
${risk.factors.map(f => f).join('\n')}

НОРМАТИВНАЯ БАЗА:
─────────────────────────────────────────────────────────
• МСУК-1 пункт 34(f) - Назначение EQR при высоких рисках
• МСУК-2 пункты 17-19 - Процедуры работы EQR
• МСА 220 - Управление качеством при аудите

ТРЕБОВАНИЯ К EQR:
─────────────────────────────────────────────────────────
☑ НЕ входит в состав аудиторской группы
☑ Обладает необходимой компетентностью
☑ Соблюдает требования независимости
☑ Cooling-off период: 2 года (для бывших руководителей)
☑ Все выводы письменно

ОБЯЗАННОСТИ EQR:
─────────────────────────────────────────────────────────
1. Запросить и изучить всю существенную информацию
2. Обсудить существенные вопросы с руководителем
3. Проверить документацию по ключевым вопросам
4. Оценить обоснованность суждений
5. Убедиться в наличии профессионального скептицизма
6. Оценить соблюдение этических требований
7. Проверить надлежащесть консультаций
8. Подписать "Stand-back" подтверждение

Дата: ${date}
Ответственный: _________________________
Подпись: _________________________
    `.trim() : '';

    return { kycForm, independenceForm, complianceChecklist, eqrForm };
  };

  const loadDemoClients = () => {
    const demoClientsWithDocs: MSUKClient[] = DEMO_CLIENTS.map(client => ({
      id: Date.now() + Math.random(),
      ...client,
      documents: generateDocuments(client)
    }));
    setClients([...clients, ...demoClientsWithDocs]);
    setShowDemo(false);
    toast({
      title: "Примеры загружены",
      description: `Добавлено ${demoClientsWithDocs.length} примеров клиентов.`,
    });
  };

  const handleAddClient = () => {
    if (!formData.name || !formData.inn) {
      toast({
        title: "Ошибка",
        description: "Заполните название и ИНН",
        variant: "destructive"
      });
      return;
    }

    const newClient: MSUKClient = {
      id: Date.now(),
      ...formData,
      documents: generateDocuments(formData)
    };

    setClients([...clients, newClient]);
    setFormData({
      name: '',
      inn: '',
      country: 'RU',
      industry: '',
      publicCompany: false,
      litigation: false,
      conflictOfInterest: false,
      employees: '',
      revenue: '',
    });
    setShowForm(false);
    
    toast({
      title: "Клиент добавлен",
      description: `Клиент "${newClient.name}" успешно добавлен.`,
    });
  };

  const handleDeleteClient = (id: number) => {
    const client = clients.find(c => c.id === id);
    setClients(clients.filter(c => c.id !== id));
    if (currentClient?.id === id) {
      setCurrentClient(null);
    }
    toast({
      title: "Клиент удален",
      description: `Клиент "${client?.name}" удален.`,
      variant: "destructive"
    });
  };

  const viewDocument = (content: string, title: string) => {
    setPreviewData(content);
    setPreviewTitle(title);
    setShowPreview(true);
  };

  const downloadDocument = (content: string, filename: string) => {
    const element = document.createElement('a');
    const file = new Blob([content], {type: 'text/plain;charset=utf-8'});
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(element.href);
    
    toast({
      title: "Документ скачан",
      description: `Файл "${filename}" успешно скачан.`,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in p-4 md:p-0">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-warning bg-clip-text text-transparent flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-primary" />
            МСУК-1 Manager Pro
          </h1>
          <p className="text-muted-foreground mt-1">Аудиторская комплаенс-система</p>
        </div>
        <Badge className="text-lg px-4 py-2">
          {clients.length} клиентов
        </Badge>
      </div>

      {/* Быстрый старт */}
      {clients.length === 0 && (
        <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0">
          <div className="p-6">
            <div className="flex items-center justify-between flex-col sm:flex-row gap-4">
              <div>
                <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                  <Zap className="w-6 h-6" />
                  Быстрый старт
                </h2>
                <p className="text-blue-100">Загрузите 6 примеров клиентов с разными уровнями рисков</p>
              </div>
              <Button
                onClick={() => setShowDemo(true)}
                className="bg-white text-blue-600 hover:bg-blue-50 whitespace-nowrap"
              >
                <Zap className="w-4 h-4 mr-2" />
                Загрузить примеры
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Основной контент - двухколоночный layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Левая панель - список клиентов */}
        <div className="lg:col-span-1">
          <Card className="overflow-hidden">
            <div className="bg-primary text-primary-foreground p-4 flex items-center justify-between">
              <h2 className="font-semibold">Клиенты ({clients.length})</h2>
              <Button
                onClick={() => setShowForm(true)}
                variant="secondary"
                size="icon"
                className="h-8 w-8"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <div className="divide-y max-h-[600px] overflow-y-auto">
              {clients.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Нет клиентов</p>
                </div>
              ) : (
                clients.map(client => {
                  const risk = calculateRisk(client);
                  return (
                    <div
                      key={client.id}
                      onClick={() => setCurrentClient(client)}
                      className={`p-4 cursor-pointer transition ${
                        currentClient?.id === client.id ? 'bg-primary/10 border-l-4 border-primary' : 'hover:bg-secondary/50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate">{client.name}</h3>
                          <p className="text-xs text-muted-foreground">{client.inn}</p>
                          <div className="mt-2 flex gap-1 flex-wrap">
                            <Badge
                              variant={
                                risk.riskText === 'ВЫСОКИЙ' ? 'destructive' :
                                risk.riskText === 'СРЕДНИЙ' ? 'default' : 'secondary'
                              }
                              className="text-xs"
                            >
                              {risk.riskText}
                            </Badge>
                            {risk.eqrRequired && (
                              <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-200">
                                EQR
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClient(client.id);
                          }}
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        {/* Правая панель - детали клиента или форма */}
        <div className="lg:col-span-2">
          {showForm ? (
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">Добавить клиента</h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Название компании *</Label>
                  <Input
                    id="name"
                    placeholder="ТОО 'Компания'"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                <div>
                  <Label htmlFor="inn">ИНН *</Label>
                  <Input
                    id="inn"
                    placeholder="7700000000"
                    value={formData.inn}
                    onChange={(e) => setFormData({...formData, inn: e.target.value})}
                  />
                </div>

                <div>
                  <Label htmlFor="country">Страна</Label>
                  <Select
                    value={formData.country}
                    onValueChange={(value: 'RU' | 'KZ') => setFormData({...formData, country: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RU">Россия</SelectItem>
                      <SelectItem value="KZ">Казахстан</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="industry">Вид деятельности</Label>
                  <Input
                    id="industry"
                    placeholder="Энергетика, Финансовые услуги, и т.д."
                    value={formData.industry}
                    onChange={(e) => setFormData({...formData, industry: e.target.value})}
                  />
                </div>

                <div>
                  <Label htmlFor="employees">Количество сотрудников</Label>
                  <Input
                    id="employees"
                    placeholder="1000"
                    value={formData.employees}
                    onChange={(e) => setFormData({...formData, employees: e.target.value})}
                  />
                </div>

                <div>
                  <Label htmlFor="revenue">Годовой доход (млн тенге)</Label>
                  <Input
                    id="revenue"
                    placeholder="10000"
                    value={formData.revenue}
                    onChange={(e) => setFormData({...formData, revenue: e.target.value})}
                  />
                </div>

                <div className="space-y-3 pt-4 border-t">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="publicCompany"
                      checked={formData.publicCompany}
                      onCheckedChange={(checked) => setFormData({...formData, publicCompany: checked as boolean})}
                    />
                    <Label htmlFor="publicCompany" className="cursor-pointer">
                      Публичная компания (ПЗО)
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="litigation"
                      checked={formData.litigation}
                      onCheckedChange={(checked) => setFormData({...formData, litigation: checked as boolean})}
                    />
                    <Label htmlFor="litigation" className="cursor-pointer">
                      Судебные разбирательства
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="conflictOfInterest"
                      checked={formData.conflictOfInterest}
                      onCheckedChange={(checked) => setFormData({...formData, conflictOfInterest: checked as boolean})}
                    />
                    <Label htmlFor="conflictOfInterest" className="cursor-pointer">
                      Конфликт интересов
                    </Label>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button onClick={handleAddClient} className="flex-1">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Добавить
                  </Button>
                  <Button onClick={() => setShowForm(false)} variant="outline" className="flex-1">
                    Отмена
                  </Button>
                </div>
              </div>
            </Card>
          ) : currentClient ? (
            <div className="space-y-4">
              {/* Информация о клиенте */}
              <Card className="p-6">
                <h2 className="text-2xl font-bold mb-4">{currentClient.name}</h2>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">ИНН</Label>
                    <p className="font-semibold">{currentClient.inn}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Страна</Label>
                    <p className="font-semibold">{currentClient.country}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Сотрудников</Label>
                    <p className="font-semibold">{currentClient.employees}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Доход (млн)</Label>
                    <p className="font-semibold">{currentClient.revenue}</p>
                  </div>
                </div>
                {calculateRisk(currentClient).factors.length > 0 && (
                  <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                    <h3 className="font-semibold text-destructive mb-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Факторы риска
                    </h3>
                    <ul className="space-y-1">
                      {calculateRisk(currentClient).factors.map((f, i) => (
                        <li key={i} className="text-sm text-destructive/80">{f}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>

              {/* Документы */}
              <Card className="p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Документы
                </h3>
                <div className="space-y-2">
                  {/* Анкета клиента */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                    <span className="font-semibold text-blue-900 dark:text-blue-100">📋 Анкета клиента</span>
                    <div className="flex gap-2 mt-2">
                      <Button
                        onClick={() => viewDocument(currentClient.documents.kycForm, '📋 Анкета клиента')}
                        variant="outline"
                        className="flex-1 bg-blue-500 text-white hover:bg-blue-600 border-blue-500"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Просмотр
                      </Button>
                      <Button
                        onClick={() => downloadDocument(currentClient.documents.kycForm, `KYC_${currentClient.name.replace(/\s/g, '_')}.txt`)}
                        className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Скачать
                      </Button>
                    </div>
                  </div>

                  {/* Заявление о независимости */}
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                    <span className="font-semibold text-green-900 dark:text-green-100">✓ Заявление о независимости</span>
                    <div className="flex gap-2 mt-2">
                      <Button
                        onClick={() => viewDocument(currentClient.documents.independenceForm, '✓ Заявление о независимости')}
                        variant="outline"
                        className="flex-1 bg-green-500 text-white hover:bg-green-600 border-green-500"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Просмотр
                      </Button>
                      <Button
                        onClick={() => downloadDocument(currentClient.documents.independenceForm, `Independence_${currentClient.name.replace(/\s/g, '_')}.txt`)}
                        className="flex-1 bg-green-600 text-white hover:bg-green-700"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Скачать
                      </Button>
                    </div>
                  </div>

                  {/* Чеклист МСУК-1 */}
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                    <span className="font-semibold text-purple-900 dark:text-purple-100">☐ Чеклист МСУК-1</span>
                    <div className="flex gap-2 mt-2">
                      <Button
                        onClick={() => viewDocument(currentClient.documents.complianceChecklist, '☐ Чеклист МСУК-1')}
                        variant="outline"
                        className="flex-1 bg-purple-500 text-white hover:bg-purple-600 border-purple-500"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Просмотр
                      </Button>
                      <Button
                        onClick={() => downloadDocument(currentClient.documents.complianceChecklist, `Compliance_${currentClient.name.replace(/\s/g, '_')}.txt`)}
                        className="flex-1 bg-purple-600 text-white hover:bg-purple-700"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Скачать
                      </Button>
                    </div>
                  </div>

                  {/* EQR форма (если требуется) */}
                  {calculateRisk(currentClient).eqrRequired && currentClient.documents.eqrForm && (
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border border-red-200 dark:border-red-800">
                      <span className="font-semibold text-red-900 dark:text-red-100">🔴 Назначение EQR (ТРЕБУЕТСЯ)</span>
                      <div className="flex gap-2 mt-2">
                        <Button
                          onClick={() => viewDocument(currentClient.documents.eqrForm, '🔴 Назначение EQR')}
                          variant="outline"
                          className="flex-1 bg-red-500 text-white hover:bg-red-600 border-red-500"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Просмотр
                        </Button>
                        <Button
                          onClick={() => downloadDocument(currentClient.documents.eqrForm, `EQR_${currentClient.name.replace(/\s/g, '_')}.txt`)}
                          className="flex-1 bg-red-600 text-white hover:bg-red-700"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Скачать
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Статус риска */}
              <Card className={`p-6 ${
                calculateRisk(currentClient).riskText === 'ВЫСОКИЙ' ? 'bg-destructive/10 border-2 border-destructive' :
                calculateRisk(currentClient).riskText === 'СРЕДНИЙ' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-300 dark:border-yellow-700' :
                'bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700'
              }`}>
                <h3 className="font-bold mb-2 flex items-center gap-2">
                  {calculateRisk(currentClient).riskText === 'ВЫСОКИЙ' ? (
                    <AlertCircle className="w-5 h-5 text-destructive" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  )}
                  <span className={
                    calculateRisk(currentClient).riskText === 'ВЫСОКИЙ' ? 'text-destructive' :
                    calculateRisk(currentClient).riskText === 'СРЕДНИЙ' ? 'text-yellow-700 dark:text-yellow-300' :
                    'text-green-700 dark:text-green-300'
                  }>
                    СТАТУС: {
                      calculateRisk(currentClient).riskText === 'ВЫСОКИЙ' ? 'ВЫСОКИЙ РИСК ⚠️' :
                      calculateRisk(currentClient).riskText === 'СРЕДНИЙ' ? 'СРЕДНИЙ РИСК 🟡' :
                      'НИЗКИЙ РИСК ✅'
                    }
                  </span>
                </h3>
                <p className={
                  calculateRisk(currentClient).riskText === 'ВЫСОКИЙ' ? 'text-destructive' :
                  calculateRisk(currentClient).riskText === 'СРЕДНИЙ' ? 'text-yellow-600 dark:text-yellow-400' :
                  'text-green-600 dark:text-green-400'
                }>
                  {calculateRisk(currentClient).riskText === 'ВЫСОКИЙ' ? '⚠️ Требуется усиленная проверка и EQR' :
                   calculateRisk(currentClient).riskText === 'СРЕДНИЙ' ? '🟡 Повышенное внимание к процедурам' :
                   '✅ Стандартные процедуры достаточны'}
                </p>
              </Card>
            </div>
          ) : (
            <Card className="p-12 text-center">
              <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-lg">Выберите клиента</p>
            </Card>
          )}
        </div>
      </div>

      {/* Диалог примеров */}
      <Dialog open={showDemo} onOpenChange={setShowDemo}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>⚡ Примеры клиентов</DialogTitle>
            <DialogDescription>
              Выберите примеры или загрузите все 6 клиентов с разными уровнями рисков
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {DEMO_CLIENTS.map((client, i) => {
                const risk = calculateRisk(client);
                return (
                  <Card
                    key={i}
                    className={`p-4 border-2 ${
                      risk.riskText === 'ВЫСОКИЙ' ? 'bg-destructive/10 border-destructive' :
                      risk.riskText === 'СРЕДНИЙ' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700' :
                      'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                    }`}
                  >
                    <h4 className="font-semibold text-sm mb-1">{client.name}</h4>
                    <p className="text-xs text-muted-foreground mb-2">{client.industry}</p>
                    <div className="flex items-center justify-between">
                      <Badge
                        variant={
                          risk.riskText === 'ВЫСОКИЙ' ? 'destructive' :
                          risk.riskText === 'СРЕДНИЙ' ? 'default' : 'secondary'
                        }
                        className="text-xs"
                      >
                        {risk.riskText}
                      </Badge>
                      {risk.eqrRequired && (
                        <Badge variant="outline" className="text-xs text-destructive">
                          EQR ⚠️
                        </Badge>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>

            <Button
              onClick={loadDemoClients}
              className="w-full mt-6"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Загрузить все 6 примеров
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог предпросмотра документа */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{previewTitle}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 bg-secondary rounded-md">
            <pre className="font-mono text-xs whitespace-pre-wrap break-words">
              {previewData}
            </pre>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button
              onClick={() => setShowPreview(false)}
              variant="outline"
              className="flex-1"
            >
              Закрыть
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
