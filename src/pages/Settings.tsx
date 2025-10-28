import React from 'react';
import { Card } from '@/components/ui/card';

export default function Settings() {
  return (
    <div className="space-y-6">
        <div>
        <h1 className="text-3xl font-bold">⚙️ Настройки</h1>
        <p className="text-muted-foreground">Настройки системы и профиля</p>
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Настройки профиля</h2>
        <p className="text-muted-foreground">
          Здесь будут настройки профиля пользователя.
        </p>
      </Card>
    </div>
  );
}