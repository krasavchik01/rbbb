import React from 'react';
import { Card } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  // Опциональное имя виджета — попадёт в сообщение и в console.
  label?: string;
  // Если true — рендерим версию для целой страницы (крупнее, с кнопкой
  // «Перезагрузить страницу»). Иначе компактная карточка для виджета.
  fullPage?: boolean;
}

interface State {
  err: Error | null;
}

// ErrorBoundary: ловит runtime-ошибку внутри блока (виджета или целой страницы)
// и показывает понятную плашку вместо белого экрана.
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
      const errMsg = this.state.err.message || String(this.state.err);
      const stack = this.state.err.stack || '';

      if (this.props.fullPage) {
        return (
          <div className="p-4 sm:p-6 max-w-3xl mx-auto">
            <Card className="p-6 border-destructive/40 bg-destructive/5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-destructive/15 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg sm:text-xl font-semibold text-destructive">
                    Страница «{this.props.label ?? 'компонент'}» упала
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Что-то сломалось при отображении. Текст ошибки ниже — пришлите его, и поправим:
                  </p>
                  <pre className="text-xs bg-background/60 border border-destructive/20 rounded-md p-3 mt-3 overflow-auto max-h-40 whitespace-pre-wrap break-words">
                    {errMsg}
                  </pre>
                  {stack && (
                    <details className="mt-2">
                      <summary className="text-xs text-muted-foreground cursor-pointer">Stack trace</summary>
                      <pre className="text-[10px] bg-background/60 border border-destructive/10 rounded-md p-3 mt-1 overflow-auto max-h-60 whitespace-pre-wrap break-words text-muted-foreground">
                        {stack}
                      </pre>
                    </details>
                  )}
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => this.setState({ err: null })}
                      className="text-sm px-3 py-1.5 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10"
                    >
                      Попробовать снова
                    </button>
                    <button
                      onClick={() => window.location.reload()}
                      className="text-sm px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 inline-flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Перезагрузить страницу
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        );
      }

      return (
        <Card className="p-4 border-destructive/40 bg-destructive/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-destructive">
                Виджет «{this.props.label ?? 'компонент'}» упал
              </p>
              <p className="text-xs text-muted-foreground mt-1 break-words">
                {errMsg}
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
