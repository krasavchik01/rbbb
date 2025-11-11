/**
 * Утилиты для валидации данных в модуле МСУК-1 Compliance
 */

/**
 * Валидирует ИНН (10 или 12 цифр)
 */
export const validateINN = (inn: string): boolean => {
  return /^\d{10,12}$/.test(inn.trim());
};

/**
 * Валидирует обязательные поля клиента
 */
export const validateClientData = (data: {
  name?: string;
  inn?: string;
}): { isValid: boolean; error?: string } => {
  if (!data.name?.trim()) {
    return { isValid: false, error: 'Заполните название компании' };
  }
  
  if (!data.inn?.trim()) {
    return { isValid: false, error: 'Заполните ИНН' };
  }
  
  if (!validateINN(data.inn)) {
    return { isValid: false, error: 'ИНН должен содержать 10 или 12 цифр' };
  }
  
  return { isValid: true };
};

/**
 * Санитизирует строку для безопасного отображения (защита от XSS)
 */
export const sanitizeString = (str: string): string => {
  return str
    .replace(/[<>]/g, '') // Удаляем потенциально опасные символы
    .trim();
};

