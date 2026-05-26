import React from 'react';
import { Card } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  // Опциональное имя виджета — попадёт в сообщение и в console.
  label?: string;
}

interface State {
  err: Error | null;
}

// Локальный ErrorBoundary для отдельных виджетов: ловит runtime-ошибку
// внутри одного блока и показывает понятную плашку вместо белого экрана всей страницы.
export class WidgetErrorBoundary extends React.Component<Props, State> {
  state: State = { err: null };

  static getDerivedStateFromError(err: Error): State {
    return { err };
  }

  componentDidCatch(err: Error, info: React.ErrorInfo) {
    console.error(`[WidgetErrorBoundary${this.props.label ? `:${this.props.label}` : ''}]`, err, info);
  }

  render() {
    if (this.state.err) {
      return (
        <Card className="p-4 border-destructive/40 bg-destructive/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-destructive">
                Виджет «{this.props.label ?? 'компонент'}» упал
              </p>
              <p className="text-xs text-muted-foreground mt-1 break-words">
                {this.state.err.message || String(this.state.err)}
              </p>
              <button
                onClick={() => this.setState({ err: null })}
                className="text-xs underline text-destructive mt-2"
              >
                Попробовать снова
              </button>
            </div>
          </div>
        </Card>
      );
    }
    return this.props.children;
  }
}
