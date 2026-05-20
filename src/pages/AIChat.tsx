import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Bot, Send, Sparkles, Wrench, AlertTriangle, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  toolsUsed?: Array<{ name: string; input: any }>;
  tokens?: { in: number; out: number; cacheRead: number; cacheWrite: number };
  costUsd?: number;
  durationMs?: number;
  isError?: boolean;
}

const LS_CONVO_KEY = 'rb_ai_chat_convo_id';

export default function AIChat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversationId, setConversationId] = useState<string | null>(() => localStorage.getItem(LS_CONVO_KEY));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [showTools, setShowTools] = useState<Record<number, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const isPrivileged = user && ['ceo', 'deputy_director', 'partner', 'hr', 'admin'].includes(user.role);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  if (!user) return <div className="p-6 text-muted-foreground">Войдите в систему.</div>;

  if (!isPrivileged) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Нет доступа</CardTitle>
          <CardDescription>
            AI-ассистент доступен только зам.директору, CEO, партнёру, HR и админу.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setBusy(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          conversationId,
          message: text,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', text: data.message || data.error || 'Ошибка вызова AI', isError: true },
        ]);
        toast({ title: 'AI ошибка', description: data.message || data.error, variant: 'destructive' });
        return;
      }
      if (data.conversationId && data.conversationId !== conversationId) {
        setConversationId(data.conversationId);
        localStorage.setItem(LS_CONVO_KEY, data.conversationId);
      }
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: data.reply,
          toolsUsed: data.toolsUsed,
          tokens: data.tokens,
          costUsd: data.costUsd,
          durationMs: data.durationMs,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: `Сеть/сервер: ${err?.message || err}`, isError: true },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setConversationId(null);
    localStorage.removeItem(LS_CONVO_KEY);
    setInput('');
  };

  const totalCost = messages.reduce((s, m) => s + (m.costUsd || 0), 0);
  const totalTokens = messages.reduce(
    (s, m) => ({
      in: s.in + (m.tokens?.in || 0),
      out: s.out + (m.tokens?.out || 0),
      cacheRead: s.cacheRead + (m.tokens?.cacheRead || 0),
    }),
    { in: 0, out: 0, cacheRead: 0 },
  );

  return (
    <div className="max-w-4xl mx-auto pb-24 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-6 h-6 text-primary" />
            AI-ассистент «RB»
            <Badge variant="outline" className="text-xs ml-2">
              Claude Haiku 4.5
            </Badge>
          </CardTitle>
          <CardDescription>
            Спроси что угодно про проекты, сотрудников, опросы, нагрузку. Я смотрю реальные данные в системе через
            инструменты. Помню важные факты между разговорами — скажи «запомни …» и я сохраню в долговременную память.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <Button variant="outline" size="sm" onClick={startNewChat} disabled={busy || messages.length === 0}>
            <RotateCcw className="w-3 h-3 mr-1" /> Новый чат
          </Button>
          {conversationId && (
            <span className="font-mono opacity-60">
              чат: …{conversationId.slice(-6)}
            </span>
          )}
          {messages.length > 0 && (
            <span>
              Сообщений: <b>{messages.length}</b> · Расход:{' '}
              <b>${totalCost.toFixed(4)}</b> ({totalTokens.in.toLocaleString('ru')} in /{' '}
              {totalTokens.out.toLocaleString('ru')} out
              {totalTokens.cacheRead > 0 ? ` · ${totalTokens.cacheRead.toLocaleString('ru')} из кеша` : ''})
            </span>
          )}
        </CardContent>
      </Card>

      <div ref={scrollRef} className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
        {messages.length === 0 && (
          <Card className="bg-muted/30">
            <CardContent className="p-6 text-sm text-muted-foreground space-y-2">
              <div className="font-medium text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Примеры запросов
              </div>
              <ul className="list-disc pl-5 space-y-1">
                <li>«Сколько активных проектов сейчас?»</li>
                <li>«Покажи команду по проекту Karaton»</li>
                <li>«Кто ещё не сдал опрос?»</li>
                <li>«Какая нагрузка у Аманова Онгара по часам?»</li>
                <li>«Запомни: таймщиты приходят 1-го числа каждого месяца» — я сохраню в долговременную память</li>
                <li>«Сколько мы потратили на AI за неделю?»</li>
              </ul>
            </CardContent>
          </Card>
        )}

        {messages.map((m, idx) => (
          <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-lg px-4 py-3 ${
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : m.isError
                  ? 'bg-red-50 border border-red-200 text-red-900'
                  : 'bg-card border'
              }`}
            >
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.text}</div>
              {m.toolsUsed && m.toolsUsed.length > 0 && (
                <div className="mt-3 pt-2 border-t border-border/30">
                  <button
                    onClick={() => setShowTools((s) => ({ ...s, [idx]: !s[idx] }))}
                    className="flex items-center gap-1 text-xs opacity-70 hover:opacity-100"
                  >
                    <Wrench className="w-3 h-3" />
                    {showTools[idx] ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                    Использовал {m.toolsUsed.length} инструмент(ов)
                  </button>
                  {showTools[idx] && (
                    <div className="mt-2 space-y-1">
                      {m.toolsUsed.map((t, i) => (
                        <div key={i} className="text-[10px] font-mono bg-background/60 rounded px-2 py-1">
                          <span className="font-bold">{t.name}</span>
                          {Object.keys(t.input || {}).length > 0 && (
                            <span className="opacity-70"> · {JSON.stringify(t.input).slice(0, 120)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {m.tokens && (
                <div className="mt-2 text-[10px] opacity-50 flex flex-wrap gap-x-3">
                  <span>
                    {m.tokens.in} in / {m.tokens.out} out
                    {m.tokens.cacheRead > 0 ? ` · ${m.tokens.cacheRead} из кеша` : ''}
                  </span>
                  <span>${(m.costUsd || 0).toFixed(5)}</span>
                  <span>{m.durationMs}мс</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex justify-start">
            <div className="bg-card border rounded-lg px-4 py-3 max-w-[85%]">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Bot className="w-4 h-4 animate-pulse" /> Думает…
              </div>
            </div>
          </div>
        )}
      </div>

      <Card className="sticky bottom-4 shadow-xl z-10">
        <CardContent className="p-3">
          <div className="flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Спросить (Enter — отправить, Shift+Enter — новая строка)"
              rows={2}
              className="resize-none"
              disabled={busy}
            />
            <Button size="lg" onClick={send} disabled={busy || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-3 text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <b>На текущем этапе AI только читает данные.</b> Изменения, отправка уведомлений сотрудникам и
            автоматические задания — следующая итерация (нужен канал доставки: Telegram или e-mail). Если попросишь
            «отправь сотруднику» — я предложу скопировать готовый текст вручную.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
