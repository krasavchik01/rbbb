-- Создание таблицы посещаемости (attendance)

CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in TIME,
  check_in_lat DECIMAL(10, 7),
  check_in_lng DECIMAL(10, 7),
  check_in_accuracy INTEGER,
  check_out TIME,
  check_out_lat DECIMAL(10, 7),
  check_out_lng DECIMAL(10, 7),
  check_out_accuracy INTEGER,
  location_type TEXT CHECK (location_type IN ('office', 'remote', 'client', 'trip')),
  office_id TEXT,
  work_duration INTEGER, -- минуты
  status TEXT DEFAULT 'present' CHECK (status IN ('present', 'late', 'absent', 'vacation', 'sick_leave')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX idx_attendance_employee_date ON attendance(employee_id, date);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_status ON attendance(status);

-- Уникальность: один сотрудник - одна запись в день
CREATE UNIQUE INDEX idx_attendance_employee_date_unique ON attendance(employee_id, date);

-- Триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_attendance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER attendance_updated_at
BEFORE UPDATE ON attendance
FOR EACH ROW
EXECUTE FUNCTION update_attendance_updated_at();

-- RLS (Row Level Security)
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Политика: все аутентифицированные пользователи могут читать
CREATE POLICY "Anyone can view attendance" ON attendance
  FOR SELECT
  USING (true);

-- Политика: сотрудник может создавать/обновлять свои записи
CREATE POLICY "Employees can manage own attendance" ON attendance
  FOR ALL
  USING (auth.uid()::text = employee_id::text);

-- Политика: HR и админы могут управлять всем
CREATE POLICY "Admins can manage all attendance" ON attendance
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE id::text = auth.uid()::text
      AND (position ILIKE '%HR%' OR position ILIKE '%admin%' OR position ILIKE '%CEO%')
    )
  );

-- Комментарии
COMMENT ON TABLE attendance IS 'Учет посещаемости сотрудников (приход/уход)';
COMMENT ON COLUMN attendance.check_in IS 'Время прихода (HH:MM:SS)';
COMMENT ON COLUMN attendance.check_out IS 'Время ухода (HH:MM:SS)';
COMMENT ON COLUMN attendance.location_type IS 'Тип места работы: office/remote/client/trip';
COMMENT ON COLUMN attendance.work_duration IS 'Продолжительность работы в минутах';




