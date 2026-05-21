import { Component, type ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Перехватывает любую runtime-ошибку в дочерних компонентах и показывает
 * понятную карточку вместо чёрного/белого экрана. Без этого Suspense+lazy
 * могут проглотить ошибку и оставить пользователя с пустым экраном.
 */
export class AIErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[AIErrorBoundary]', error, info);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    const msg = this.state.error?.message || String(this.state.error || 'неизвестная ошибка');
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card className="border-red-200 bg-red-50/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-900">
              <AlertTriangle className="w-5 h-5" />
              Что-то сломалось на этой странице
            </CardTitle>
            <CardDescription className="text-red-900/80">
              Это не должно было случиться. Ошибка отправлена в console браузера (F12).
              Чаще всего помогает hard-refresh: <b>Ctrl+Shift+R</b> (Windows) или
              <b> Cmd+Shift+R</b> (Mac). На телефоне — закрой вкладку и открой снова.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-background border rounded p-3 font-mono text-xs whitespace-pre-wrap overflow-auto max-h-40">
              {msg}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={this.reset}>
                <RotateCcw className="w-3 h-3 mr-1" /> Попробовать снова
              </Button>
              <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                Перезагрузить страницу
              </Button>
              <Button size="sm" variant="ghost" onClick={() => (window.location.href = '/')}>
                На главную
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}
