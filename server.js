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
// In production, this would validate JWT token from Authorization header
const getUserFromRequest = (req) => {
  // For now, assume user info is passed in headers
  // In production: validate JWT token from req.headers.authorization
  return {
    id: req.headers['x-user-id'] || 'unknown',
    name: req.headers['x-user-name'] || 'Unknown',
    role: req.headers['x-user-role'] || 'member',
  };
};

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
let storage, upload;
if (multer) {
  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const projectId = req.body.projectId || 'general';
      const projectDir = path.join(storagePath, projectId);
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }
      cb(null, projectDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      // Очистка имени файла от спецсимволов
      const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      cb(null, `${uniqueSuffix}-${safeName}`);
    }
  });

  upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
  });
}

// ========== API РАБОТЫ С ФАЙЛАМИ ==========

// Загрузка файла
app.post('/api/upload', (req, res, next) => {
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
  const { projectId, filename } = req.params;
  const filePath = path.join(storagePath, projectId, filename);

  if (fs.existsSync(filePath)) {
    // В будущем здесь можно добавить проверку прав доступа
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Файл не найден' });
  }
});

// Удаление файла
app.delete('/api/files/:projectId/:filename', (req, res) => {
  const { projectId, filename } = req.params;
  const filePath = path.join(storagePath, projectId, filename);

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
  const filePath = path.join(projectDataDir, `${projectId}.json`);

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
  const filePath = path.join(projectDataDir, `${projectId}.json`);

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
  const filePath = path.join(projectDataDir, `${projectId}.json`);

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
  // Если это не API запрос, отправляем index.html
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
