import React from 'react';
import { Card } from '@/components/ui/card';

export default function Bonuses() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">🎁 Бонусы</h1>
        <p className="text-muted-foreground">Система бонусов и поощрений</p>
      </div>
      
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Бонусы в разработке</h2>
        <p className="text-muted-foreground">
          Здесь будет система бонусов и поощрений.
        </p>
      </Card>
    </div>
  );
}