-- Создание таблицы для тендеров
CREATE TABLE IF NOT EXISTS public.tenders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    client_name TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    deadline DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'on_evaluation', 'submitted', 'won', 'lost')),
    win_probability INTEGER CHECK (win_probability >= 0 AND win_probability <= 100),
    our_company TEXT,
    project_type TEXT,
    notes TEXT,
    evaluation JSONB, -- Хранит оценку от партнеров/специалистов
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_tenders_status ON public.tenders(status);
CREATE INDEX IF NOT EXISTS idx_tenders_deadline ON public.tenders(deadline);
CREATE INDEX IF NOT EXISTS idx_tenders_created_at ON public.tenders(created_at);

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION public.update_tenders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_tenders_updated_at
    BEFORE UPDATE ON public.tenders
    FOR EACH ROW
    EXECUTE FUNCTION public.update_tenders_updated_at();

-- Разрешения
ALTER TABLE public.tenders ENABLE ROW LEVEL SECURITY;

-- Политика: все могут читать
CREATE POLICY "Все могут читать тендеры"
    ON public.tenders FOR SELECT
    USING (true);

-- Политика: все могут создавать
CREATE POLICY "Все могут создавать тендеры"
    ON public.tenders FOR INSERT
    WITH CHECK (true);

-- Политика: все могут обновлять
CREATE POLICY "Все могут обновлять тендеры"
    ON public.tenders FOR UPDATE
    USING (true);

-- Политика: все могут удалять
CREATE POLICY "Все могут удалять тендеры"
    ON public.tenders FOR DELETE
    USING (true);

-- Комментарии
COMMENT ON TABLE public.tenders IS 'Тендеры и тендерные заявки';
COMMENT ON COLUMN public.tenders.evaluation IS 'JSON объект с оценкой: {partnerId, partnerName, rating, comments, submittedAt}';

