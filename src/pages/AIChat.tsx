/**
 * AI-чат «RB» — продуктовый интерфейс.
 *
 * Дизайн:
 *  - Шапка плотная: имя/модель + расход.
 *  - Пустое состояние: 2 категории чипсов («Спросить» и «Действия») —
 *    тап вставляет в input. Для роли без write-прав — только «Спросить».
 *  - Сообщения занимают всю свободную высоту, прокрутка независимая.
 *  - Sticky-input внизу.
 *  - Никаких устаревших disclaimer-ов — список реальных возможностей в
 *    футере, краткий.
 */

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  Bot, Send, Sparkles, Wrench, RotateCcw, ChevronDown, ChevronUp,
  Wand2, Eye, ShieldCheck,
} from 'lucide-react';

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

// Примеры запросов. Тап = вставка в input (не отправка — чтобы можно
// дописать). Группы соответствуют реальным возможностям AI.
const READ_PROMPTS = [
  'Сколько активных проектов в МАК?',
  'Покажи команду проекта Karaton',
  'Кто ещё не сдал опрос?',
  'Какая нагрузка у Аманова Онгара?',
  'Найди все недоработки в системе',
  'Дай отчёт: проекты по статусам',
  'Сколько потратили на AI за месяц?',
];

const WRITE_PROMPTS = [
  'Запусти опрос с дедлайном 30 июня',
  'Создай задачу для Иванова: подготовить отчёт по Karaton к пятнице, высокий приоритет',
  'Назначь Петрова на проект Bapy Mining как senior_assistant',
  'Поменяй статус проекта X на completed',
  'Утверди предложение по проекту Y',
  'Запомни: МАК = Russell Bedford A+ Partners',
];

const WRITE_ROLES = new Set(['ceo', 'admin', 'deputy_director']);

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
  const canWrite = user && WRITE_ROLES.has(user.role);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  if (!user) return <div className="p-6 text-muted-foreground">Войдите в систему.</div>;

  if (!isPrivileged) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          AI-ассистент доступен только зам.директору, CEO, партнёру, HR и админу.
        </CardContent>
      </Card>
    );
  }

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
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
    <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      {/* Шапка */}
      <div className="flex items-center gap-2 px-1 pb-3 flex-wrap shrink-0">
        <Bot className="w-5 h-5 text-primary" />
        <span className="font-semibold">AI «RB»</span>
        <Badge variant="outline" className="text-[10px]">Haiku 4.5</Badge>
        {canWrite ? (
          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
            <Wand2 className="w-3 h-3 mr-1" /> Чтение и действия
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-700 border-slate-200">
            <Eye className="w-3 h-3 mr-1" /> Только чтение
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-2">
          {messages.length > 0 && (
            <span className="text-[10px] text-muted-foreground">
              ${totalCost.toFixed(4)}
              {totalTokens.cacheRead > 0 && ` · кеш ${(totalTokens.cacheRead / 1000).toFixed(1)}K`}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={startNewChat} disabled={busy || messages.length === 0} className="h-7 px-2">
            <RotateCcw className="w-3 h-3 mr-1" /> Новый
          </Button>
        </div>
      </div>

      {/* Скроллящаяся история */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="space-y-4 pt-4">
            <div className="text-center text-sm text-muted-foreground">
              Привет, {user.name.split(' ')[0]}. Я знаю всё про проекты, сотрудников, опросы и AI-расходы.
              {canWrite && ' Могу запускать опросы, создавать задачи, менять статусы — спрошу подтверждение перед действием.'}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 px-2">
                <Eye className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Спросить</span>
              </div>
              <div className="flex flex-wrap gap-2 px-1">
                {READ_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-foreground border transition-colors text-left"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {canWrite && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-2">
                  <Wand2 className="w-3 h-3 text-primary" />
                  <span className="text-xs font-medium text-primary">Сделать (с подтверждением)</span>
                </div>
                <div className="flex flex-wrap gap-2 px-1">
                  {WRITE_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => send(p)}
                      className="text-xs px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 transition-colors text-left"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="text-[11px] text-muted-foreground pt-2 px-2 flex items-start gap-2">
              <ShieldCheck className="w-3 h-3 mt-0.5 shrink-0" />
              <span>
                Для любого изменения сначала покажу что собираюсь сделать и попрошу «да».
                Все мои действия пишутся в журнал (`ai_audit_log`).
              </span>
            </div>
          </div>
        )}

        {messages.map((m, idx) => (
          <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : m.isError
                  ? 'bg-red-50 border border-red-200 text-red-900'
                  : 'bg-card border'
              }`}
            >
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.text}</div>
              {m.toolsUsed && m.toolsUsed.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/20">
                  <button
                    onClick={() => setShowTools((s) => ({ ...s, [idx]: !s[idx] }))}
                    className="flex items-center gap-1 text-[10px] opacity-70 hover:opacity-100"
                  >
                    <Wrench className="w-3 h-3" />
                    {showTools[idx] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {m.toolsUsed.length} инструмент{m.toolsUsed.length === 1 ? '' : m.toolsUsed.length < 5 ? 'а' : 'ов'}
                  </button>
                  {showTools[idx] && (
                    <div className="mt-1 space-y-1">
                      {m.toolsUsed.map((t, i) => (
                        <div key={i} className="text-[10px] font-mono bg-background/60 rounded px-2 py-1">
                          <span className="font-semibold">{t.name}</span>
                          {Object.keys(t.input || {}).length > 0 && (
                            <span className="opacity-70"> · {JSON.stringify(t.input).slice(0, 140)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {m.tokens && m.role === 'assistant' && (
                <div className="mt-1 text-[9px] opacity-40 flex flex-wrap gap-x-2">
                  <span>{m.tokens.in}↓ {m.tokens.out}↑{m.tokens.cacheRead > 0 ? ` · cache ${m.tokens.cacheRead}` : ''}</span>
                  <span>${(m.costUsd || 0).toFixed(5)}</span>
                  <span>{m.durationMs}мс</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex justify-start">
            <div className="bg-card border rounded-2xl px-4 py-2.5">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Bot className="w-4 h-4 animate-pulse" /> Думает…
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="pt-2 pb-2 shrink-0">
        <Card className="shadow-lg">
          <CardContent className="p-2">
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
                placeholder="Спросить или попросить что-то сделать…"
                rows={1}
                className="resize-none min-h-[40px] max-h-[120px]"
                disabled={busy}
              />
              <Button size="default" onClick={() => send()} disabled={busy || !input.trim()} className="h-10">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
