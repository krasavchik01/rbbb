import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// In-memory storage removed (Migrated to Supabase)

// Helper function to parse auth user from request
// TODO(auth-migration): сейчас доверяем заголовкам x-user-* — это подделывается
// клиентом. Безопасный вариант: валидация Supabase JWT из Authorization. См.
// task #8 — миграция на Supabase Auth. До этого ручки НЕ должны делать
// серверные mutation-actions без отдельной строгой проверки.
const getUserFromRequest = (req) => {
  const id = typeof req.headers['x-user-id'] === 'string' ? req.headers['x-user-id'].trim() : '';
  const name = typeof req.headers['x-user-name'] === 'string' ? req.headers['x-user-name'].trim() : '';
  const role = typeof req.headers['x-user-role'] === 'string' ? req.headers['x-user-role'].trim() : '';

  return {
    id,
    name: name || 'Unknown',
    role,
  };
};

const hasAuthenticatedUserContext = (user) => Boolean(user.id && user.role);
const FILE_UPLOAD_ROLES = ['admin', 'ceo', 'deputy_director', 'procurement', 'manager'];
const FILE_DELETE_ROLES = ['admin', 'ceo', 'deputy_director', 'procurement', 'manager'];

function requireAuthenticatedUser(req, res) {
  const user = getUserFromRequest(req);
  if (!hasAuthenticatedUserContext(user)) {
    res.status(401).json({ error: 'Требуется авторизация для доступа к файлам' });
    return null;
  }
  return user;
}

function requireAnyRole(req, res, allowedRoles) {
  const user = requireAuthenticatedUser(req, res);
  if (!user) return null;
  if (!allowedRoles.includes(user.role)) {
    res.status(403).json({ error: 'Недостаточно прав для операции с файлом' });
    return null;
  }
  return user;
}

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();
  return value || '';
}

function isSafeSeafilePath(storagePath) {
  if (typeof storagePath !== 'string') return false;
  if (!storagePath.startsWith('/')) return false;
  if (storagePath.includes('\0')) return false;
  return storagePath.split('/').every((part) => part !== '..');
}

function isSafeSeafileRelativePath(relativePath) {
  if (typeof relativePath !== 'string') return false;
  if (!relativePath || relativePath.startsWith('/')) return false;
  if (relativePath.includes('\0')) return false;
  return relativePath.split('/').every((part) => part && part !== '..');
}

function getSeafileConfig(res) {
  const seafileUrl = getRequiredEnv('SEAFILE_URL');
  const seafileToken = getRequiredEnv('SEAFILE_TOKEN');
  const repoId = getRequiredEnv('SEAFILE_REPO_ID');
  if (!seafileUrl || !seafileToken || !repoId) {
    res.status(503).json({ error: 'Seafile не настроен на сервере' });
    return null;
  }
  return { seafileUrl, seafileToken, repoId };
}

// Защита от path traversal: имя проекта/файла не должно вытаскивать нас за
// пределы baseDir. Поможет если кто-то пришлёт projectId="../../etc" или
// filename="..\\..\\windows\\system32". После path.resolve проверяем префикс.
function safeJoin(baseDir, ...parts) {
  for (const part of parts) {
    if (typeof part !== 'string' || part.length === 0) {
      throw new Error('Empty path component');
    }
    // Запрещаем разделители путей, '..' и null-байты внутри сегмента.
    if (/[\\/]/.test(part) || part === '..' || part.includes('\0')) {
      throw new Error(`Unsafe path component: ${part}`);
    }
  }
  const resolvedBase = path.resolve(baseDir);
  const resolved = path.resolve(path.join(resolvedBase, ...parts));
  if (resolved !== resolvedBase && !resolved.startsWith(resolvedBase + path.sep)) {
    throw new Error('Path escapes base directory');
  }
  return resolved;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ========== FILE STORAGE CONFIGURATION ==========
import fs from 'fs';

// Динамический импорт multer для предотвращения падения сервера при отсутствии пакета
let multer;
try {
  // Используем специальный хак для ES-модулей, если пакет еще не установлен
  const multerModule = await import('multer').catch(() => null);
  multer = multerModule?.default;
} catch (e) {
  console.warn('⚠️ Пакет "multer" не найден. Функция загрузки файлов будет недоступна до запуска "npm install".');
}

// Путь к хранилищу (NAS или локальная папка)
// Рекомендуется задать NAS_STORAGE_PATH в .env как \\192.168.7.40\rbbb_docs
const storagePath = process.env.NAS_STORAGE_PATH || path.join(__dirname, 'uploads');

if (!fs.existsSync(storagePath)) {
  try {
    fs.mkdirSync(storagePath, { recursive: true });
    console.log(`📁 Папка для загрузок создана: ${storagePath}`);
  } catch (err) {
    console.error('❌ Ошибка создания папки storagePath:', err.message);
  }
}

// Настройка хранилища (только если multer доступен)
let storage, upload, seafileUpload;
if (multer) {
  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const projectId = req.body.projectId || 'general';
      try {
        const projectDir = safeJoin(storagePath, projectId);
        if (!fs.existsSync(projectDir)) {
          fs.mkdirSync(projectDir, { recursive: true });
        }
        cb(null, projectDir);
      } catch (err) {
        cb(err, null);
      }
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      // Очистка имени файла от спецсимволов. Точки тоже схлопываем подряд,
      // чтобы исключить '..' даже в имени файла (после удаления слэшей).
      const safeName = file.originalname
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .replace(/\.{2,}/g, '.');
      cb(null, `${uniqueSuffix}-${safeName}`);
    }
  });

  upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
  });

  seafileUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
  });
}

// ========== API РАБОТЫ С ФАЙЛАМИ ==========

// Загрузка файла
app.post('/api/upload', (req, res, next) => {
  if (!requireAnyRole(req, res, FILE_UPLOAD_ROLES)) return;

  if (!multer || !upload) {
    return res.status(503).json({ error: 'Сервис загрузки временно недоступен (отсутствует зависимость multer). Запустите npm install.' });
  }
  upload.single('file')(req, res, (err) => {
    if (err) return next(err);

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Файл не получен' });
      }

      const { projectId, uploadedBy } = req.body;

      // Формируем относительный путь для хранения в БД
      const relativePath = path.relative(storagePath, req.file.path).replace(/\\/g, '/');

      res.json({
        success: true,
        file: {
          id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          fileName: req.file.originalname,
          fileType: req.file.mimetype,
          fileSize: req.file.size,
          storagePath: relativePath,
          category: req.body.category || 'other',
          uploadedBy: uploadedBy || 'system',
          uploadedAt: new Date().toISOString()
        }
      });
    } catch (err) {
      console.error('❌ Ошибка при загрузке:', err);
      res.status(500).json({ error: err.message });
    }
  });
});

// Скачивание/Просмотр файла
app.get('/api/files/:projectId/:filename', (req, res) => {
  if (!requireAuthenticatedUser(req, res)) return;

  const { projectId, filename } = req.params;
  let filePath;
  try {
    filePath = safeJoin(storagePath, projectId, filename);
  } catch (err) {
    return res.status(400).json({ error: 'Некорректный путь к файлу' });
  }

  if (fs.existsSync(filePath)) {
    // TODO(auth-migration): сейчас это defense-in-depth на основе user context
    // из заголовков. Полная защита требует Supabase JWT + проверки доступа к
    // конкретному проекту на сервере.
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Файл не найден' });
  }
});

// Получить временную ссылку Seafile без раскрытия SEAFILE_TOKEN во frontend.
app.get('/api/seafile/download-url', async (req, res) => {
  if (!requireAuthenticatedUser(req, res)) return;

  const storagePath = String(req.query.path || '');
  if (!isSafeSeafilePath(storagePath)) {
    return res.status(400).json({ error: 'Некорректный путь к файлу Seafile' });
  }

  const config = getSeafileConfig(res);
  if (!config) return;
  const { seafileUrl, seafileToken, repoId } = config;

  try {
    const encodedPath = encodeURIComponent(storagePath);
    const response = await fetch(`${seafileUrl}/api2/repos/${repoId}/file/?p=${encodedPath}`, {
      headers: { Authorization: `Token ${seafileToken}` },
    });
    if (!response.ok) {
      return res.status(502).json({ error: `Ошибка получения ссылки из Seafile: ${response.status}` });
    }

    const rawUrl = await response.text();
    res.json({ url: rawUrl.replace(/"/g, '') });
  } catch (err) {
    console.error('❌ Ошибка получения ссылки Seafile:', err);
    res.status(502).json({ error: 'Не удалось получить ссылку из Seafile' });
  }
});

// Получить список файлов/папок Seafile без раскрытия SEAFILE_TOKEN во frontend.
app.get('/api/seafile/list', async (req, res) => {
  if (!requireAuthenticatedUser(req, res)) return;

  const dirPath = String(req.query.path || '');
  if (!isSafeSeafilePath(dirPath)) {
    return res.status(400).json({ error: 'Некорректный путь к папке Seafile' });
  }

  const config = getSeafileConfig(res);
  if (!config) return;
  const { seafileUrl, seafileToken, repoId } = config;

  try {
    const response = await fetch(`${seafileUrl}/api2/repos/${repoId}/dir/?p=${encodeURIComponent(dirPath)}`, {
      headers: { Authorization: `Token ${seafileToken}` },
    });
    if (!response.ok) {
      return res.status(response.status === 404 ? 404 : 502).json({ error: `Ошибка получения списка из Seafile: ${response.status}` });
    }

    const entries = await response.json();
    res.json({ entries: Array.isArray(entries) ? entries : [] });
  } catch (err) {
    console.error('❌ Ошибка получения списка Seafile:', err);
    res.status(502).json({ error: 'Не удалось получить список из Seafile' });
  }
});

// Загрузить файл в Seafile через backend, чтобы не раскрывать SEAFILE_TOKEN.
app.post('/api/seafile/upload', (req, res, next) => {
  if (!requireAnyRole(req, res, FILE_UPLOAD_ROLES)) return;

  if (!multer || !seafileUpload) {
    return res.status(503).json({ error: 'Сервис загрузки временно недоступен (отсутствует зависимость multer). Запустите npm install.' });
  }

  seafileUpload.single('file')(req, res, async (err) => {
    if (err) return next(err);
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не получен' });
    }

    const projectId = String(req.body.projectId || '').trim();
    const taskId = String(req.body.taskId || '').trim();
    const relativePath = taskId ? `tasks/${taskId}` : projectId;
    if (!isSafeSeafileRelativePath(relativePath)) {
      return res.status(400).json({ error: 'Некорректная папка Seafile для загрузки' });
    }

    const config = getSeafileConfig(res);
    if (!config) return;
    const { seafileUrl, seafileToken, repoId } = config;

    try {
      const uploadLinkRes = await fetch(`${seafileUrl}/api2/repos/${repoId}/upload-link/?p=/`, {
        headers: { Authorization: `Token ${seafileToken}` },
      });
      if (!uploadLinkRes.ok) {
        return res.status(502).json({ error: `Ошибка получения ссылки Seafile: ${uploadLinkRes.status}` });
      }

      const uploadUrlRaw = await uploadLinkRes.text();
      const uploadUrl = uploadUrlRaw.replace(/"/g, '').replace(/^https?:\/\/[^/]+/, seafileUrl);
      const formData = new FormData();
      formData.append('file', new Blob([req.file.buffer], { type: req.file.mimetype || 'application/octet-stream' }), req.file.originalname);
      formData.append('parent_dir', '/');
      formData.append('relative_path', relativePath);

      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: { Authorization: `Token ${seafileToken}` },
        body: formData,
      });
      if (!uploadRes.ok) {
        return res.status(502).json({ error: `Ошибка загрузки файла в Seafile: ${uploadRes.status}` });
      }

      const storagePath = `/${relativePath}/${req.file.originalname}`;
      const now = new Date().toISOString();
      res.json({
        success: true,
        file: taskId ? {
          id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
          name: req.file.originalname,
          size: req.file.size,
          storagePath,
          uploadedAt: now,
          uploadedBy: req.body.uploadedBy || getUserFromRequest(req).id || 'system',
        } : {
          id: `${Date.now()}-${Math.round(Math.random() * 100000)}`,
          fileName: req.file.originalname,
          fileType: req.file.mimetype || 'application/octet-stream',
          fileSize: req.file.size,
          storagePath,
          category: req.body.category || 'other',
          uploadedBy: req.body.uploadedBy || getUserFromRequest(req).id || 'system',
          uploadedAt: now,
          isSeafile: true,
          publicUrl: `seafile://${storagePath}`,
        },
      });
    } catch (error) {
      console.error('❌ Ошибка загрузки файла в Seafile:', error);
      res.status(502).json({ error: 'Не удалось загрузить файл в Seafile' });
    }
  });
});

// Удалить файл из Seafile через backend, чтобы не раскрывать SEAFILE_TOKEN.
app.delete('/api/seafile/file', async (req, res) => {
  if (!requireAnyRole(req, res, FILE_DELETE_ROLES)) return;

  const storagePath = String(req.query.path || '');
  if (!isSafeSeafilePath(storagePath)) {
    return res.status(400).json({ error: 'Некорректный путь к файлу Seafile' });
  }

  const config = getSeafileConfig(res);
  if (!config) return;
  const { seafileUrl, seafileToken, repoId } = config;

  try {
    const response = await fetch(`${seafileUrl}/api2/repos/${repoId}/file/?p=${encodeURIComponent(storagePath)}`, {
      method: 'DELETE',
      headers: { Authorization: `Token ${seafileToken}` },
    });
    if (!response.ok) {
      return res.status(response.status === 404 ? 404 : 502).json({ error: `Ошибка удаления файла из Seafile: ${response.status}` });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Ошибка удаления файла Seafile:', err);
    res.status(502).json({ error: 'Не удалось удалить файл из Seafile' });
  }
});

// Удаление файла
app.delete('/api/files/:projectId/:filename', (req, res) => {
  if (!requireAnyRole(req, res, ['admin', 'ceo', 'deputy_director', 'procurement'])) return;

  const { projectId, filename } = req.params;
  let filePath;
  try {
    filePath = safeJoin(storagePath, projectId, filename);
  } catch (err) {
    return res.status(400).json({ error: 'Некорректный путь к файлу' });
  }

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true, message: 'Файл удален' });
    } else {
      res.status(404).json({ error: 'Файл не найден' });
    }
  } catch (err) {
    console.error('❌ Ошибка при удалении файла:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========== PROJECT STORAGE CONFIGURATION ==========
const projectsFilePath = path.join(storagePath, 'projects.json');

// Helper to load projects
const loadProjectsFromFile = () => {
  try {
    if (fs.existsSync(projectsFilePath)) {
      const data = fs.readFileSync(projectsFilePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('❌ Ошибка при чтении projects.json:', err);
  }
  return [];
};

// Helper to save projects
const saveProjectsToFile = (projects) => {
  try {
    fs.writeFileSync(projectsFilePath, JSON.stringify(projects, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('❌ Ошибка при записи в projects.json:', err);
    return false;
  }
};

// ========== API РАБОТЫ С ПРОЕКТАМИ ==========

// Список проектов
app.get('/api/projects', (req, res) => {
  const projects = loadProjectsFromFile();
  res.json(projects);
});

// Получение одного проекта
app.get('/api/projects/:id', (req, res) => {
  const { id } = req.params;
  const projects = loadProjectsFromFile();
  const project = projects.find(p => p.id === id);

  if (project) {
    res.json(project);
  } else {
    res.status(404).json({ error: 'Проект не найден' });
  }
});

// Создание проекта
app.post('/api/projects', (req, res) => {
  try {
    const projects = loadProjectsFromFile();
    const newProject = {
      ...req.body,
      id: req.body.id || `proj_${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    projects.unshift(newProject);
    if (saveProjectsToFile(projects)) {
      res.status(201).json(newProject);
    } else {
      res.status(500).json({ error: 'Не удалось сохранить проект на сервере' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Обновление проекта
app.put('/api/projects/:id', (req, res) => {
  try {
    const { id } = req.params;
    const projects = loadProjectsFromFile();
    const index = projects.findIndex(p => p.id === id);

    if (index !== -1) {
      projects[index] = {
        ...projects[index],
        ...req.body,
        id: id, // Запрещаем менять ID
        updated_at: new Date().toISOString()
      };

      if (saveProjectsToFile(projects)) {
        res.json(projects[index]);
      } else {
        res.status(500).json({ error: 'Не удалось обновить проект на сервере' });
      }
    } else {
      res.status(404).json({ error: 'Проект не найден' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Удаление проекта
app.delete('/api/projects/:id', (req, res) => {
  try {
    const { id } = req.params;
    let projects = loadProjectsFromFile();
    const initialLength = projects.length;
    projects = projects.filter(p => p.id !== id);

    if (projects.length < initialLength) {
      if (saveProjectsToFile(projects)) {
        res.json({ success: true, message: 'Проект удален' });
      } else {
        res.status(500).json({ error: 'Не удалось обновить файл проектов после удаления' });
      }
    } else {
      res.status(404).json({ error: 'Проект не найден' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== PROJECT DATA (TEMPLATE/STAGES) STORAGE ==========
const projectDataDir = path.join(storagePath, 'project_data');
if (!fs.existsSync(projectDataDir)) {
  try {
    fs.mkdirSync(projectDataDir, { recursive: true });
    console.log(`📁 Папка для project_data создана: ${projectDataDir}`);
  } catch (err) {
    console.error('❌ Ошибка создания папки project_data:', err.message);
  }
}

// Получить данные проекта (шаблон, этапы, паспорт)
app.get('/api/project-data/:projectId', (req, res) => {
  const { projectId } = req.params;
  let filePath;
  try {
    filePath = safeJoin(projectDataDir, `${projectId}.json`);
  } catch (err) {
    return res.status(400).json({ error: 'Некорректный идентификатор проекта' });
  }

  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      res.json(JSON.parse(data));
    } else {
      res.status(404).json({ error: 'Данные проекта не найдены' });
    }
  } catch (err) {
    console.error('❌ Ошибка чтения project_data:', err);
    res.status(500).json({ error: err.message });
  }
});

// Сохранить/обновить данные проекта
app.put('/api/project-data/:projectId', (req, res) => {
  const { projectId } = req.params;
  let filePath;
  try {
    filePath = safeJoin(projectDataDir, `${projectId}.json`);
  } catch (err) {
    return res.status(400).json({ error: 'Некорректный идентификатор проекта' });
  }

  try {
    const payload = {
      ...req.body,
      project_id: projectId,
      updated_at: new Date().toISOString()
    };

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`✅ Project data saved: ${projectId}`);
    res.json(payload);
  } catch (err) {
    console.error('❌ Ошибка записи project_data:', err);
    res.status(500).json({ error: err.message });
  }
});

// Удалить данные проекта
app.delete('/api/project-data/:projectId', (req, res) => {
  const { projectId } = req.params;
  let filePath;
  try {
    filePath = safeJoin(projectDataDir, `${projectId}.json`);
  } catch (err) {
    return res.status(400).json({ error: 'Некорректный идентификатор проекта' });
  }

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true, message: 'Данные проекта удалены' });
    } else {
      res.status(404).json({ error: 'Данные проекта не найдены' });
    }
  } catch (err) {
    console.error('❌ Ошибка удаления project_data:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========== HELPER FUNCTIONS ==========

function getRoleToDepart(role) {
  const ROLE_TO_DEPARTMENT = {
    admin: 'admin',
    ceo: 'director',
    deputy_director: 'deputy_director',
    hr: 'hr',
    procurement: 'procurement',
    it: 'it',
    accountant: 'accounting',
  };
  return ROLE_TO_DEPARTMENT[role] || 'initiator';
}

// Serve static files from dist
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback - важно для React Router (Express 5 syntax)
app.get('/{*path}', (req, res) => {
  // Явно отвечаем на неизвестные API, чтобы запросы не зависали.
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint не найден' });
  }

  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

