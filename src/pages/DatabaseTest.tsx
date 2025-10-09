/**
 * Страница для тестирования работы БД (localStorage + Supabase)
 */

import { useState } from 'react';
import { useEmployees, useProjects } from '@/hooks/useDataStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Database, CheckCircle, XCircle } from 'lucide-react';

export default function DatabaseTest() {
  const { employees, loading: empLoading, error: empError, createEmployee, deleteEmployee } = useEmployees();
  const { projects, loading: projLoading, error: projError, createProject } = useProjects();
  
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpEmail, setNewEmpEmail] = useState('');
  const [newProjName, setNewProjName] = useState('');
  const [success, setSuccess] = useState('');

  const handleCreateEmployee = async () => {
    try {
      await createEmployee({
        name: newEmpName,
        email: newEmpEmail,
        role: 'assistant_1',
        department: 'Тестовый',
      });
      setSuccess('Сотрудник успешно создан!');
      setNewEmpName('');
      setNewEmpEmail('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateProject = async () => {
    try {
      await createProject({
        name: newProjName,
        status: 'draft',
        clientName: 'Тестовый клиент',
      });
      setSuccess('Проект успешно создан!');
      setNewProjName('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    try {
      await deleteEmployee(id);
      setSuccess('Сотрудник успешно удален!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center space-x-3">
        <Database className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Тестирование БД</h1>
          <p className="text-muted-foreground">localStorage + Supabase (гибридное хранилище)</p>
        </div>
      </div>

      {success && (
        <Alert className="border-green-500/50 bg-green-500/10">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <AlertDescription className="text-green-500">{success}</AlertDescription>
        </Alert>
      )}

      {(empError || projError) && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{empError || projError}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Сотрудники */}
        <Card>
          <CardHeader>
            <CardTitle>Сотрудники</CardTitle>
            <CardDescription>
              Всего: {employees.length} | {empLoading ? 'Загрузка...' : 'Готово'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Добавить сотрудника</Label>
              <Input
                placeholder="Имя"
                value={newEmpName}
                onChange={(e) => setNewEmpName(e.target.value)}
              />
              <Input
                placeholder="Email"
                value={newEmpEmail}
                onChange={(e) => setNewEmpEmail(e.target.value)}
              />
              <Button
                onClick={handleCreateEmployee}
                disabled={!newEmpName || !newEmpEmail}
                className="w-full"
              >
                Создать сотрудника
              </Button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {empLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                employees.map((emp) => (
                  <div
                    key={emp.id}
                    className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{emp.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{emp.email}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteEmployee(emp.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      Удалить
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Проекты */}
        <Card>
          <CardHeader>
            <CardTitle>Проекты</CardTitle>
            <CardDescription>
              Всего: {projects.length} | {projLoading ? 'Загрузка...' : 'Готово'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Добавить проект</Label>
              <Input
                placeholder="Название проекта"
                value={newProjName}
                onChange={(e) => setNewProjName(e.target.value)}
              />
              <Button
                onClick={handleCreateProject}
                disabled={!newProjName}
                className="w-full"
              >
                Создать проект
              </Button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {projLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                projects.map((proj) => (
                  <div
                    key={proj.id}
                    className="p-3 bg-secondary/50 rounded-lg"
                  >
                    <p className="font-medium">{proj.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Статус: {proj.status} | Клиент: {proj.clientName || 'Не указан'}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Статус */}
      <Card>
        <CardHeader>
          <CardTitle>Статус хранилища</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>localStorage:</span>
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <div className="flex items-center justify-between">
              <span>Supabase:</span>
              <span className="text-sm text-muted-foreground">
                (Проверка при первом запросе)
              </span>
            </div>
            <div className="mt-4 p-4 bg-secondary/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                💡 Данные сохраняются сначала в localStorage (всегда работает), 
                затем синхронизируются с Supabase (если доступен).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

