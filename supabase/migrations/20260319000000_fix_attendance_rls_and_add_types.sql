-- Исправляем RLS для attendance - разрешаем анонимный доступ (демо-юзеры без auth)

DROP POLICY IF EXISTS "Anyone can view attendance" ON attendance;
DROP POLICY IF EXISTS "Employees can manage own attendance" ON attendance;
DROP POLICY IF EXISTS "Admins can manage all attendance" ON attendance;

CREATE POLICY "Anyone can read attendance"
  ON attendance FOR SELECT USING (true);

CREATE POLICY "Anyone can insert attendance"
  ON attendance FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update attendance"
  ON attendance FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete attendance"
  ON attendance FOR DELETE USING (true);
