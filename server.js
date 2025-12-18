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

// In-memory storage for demonstration (replace with database in production)
let serviceMemos = [];
let evaluations = [];

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

// ========== SERVICE MEMOS API ==========

// GET all service memos
app.get('/api/service-memos', (req, res) => {
  const user = getUserFromRequest(req);
  const filter = req.query.filter || 'all';

  let filtered = serviceMemos;

  if (filter === 'my') {
    filtered = serviceMemos.filter(m => m.createdBy === user.id);
  } else if (filter === 'pending') {
    // Pending for current user - needs their approval
    const userDept = getRoleToDepart(user.role);
    filtered = serviceMemos.filter(m => {
      const current = m.workflow[m.currentStage];
      return m.overallStatus === 'in_progress' &&
             current &&
             current.department === userDept &&
             current.status === 'pending';
    });
  } else if (filter === 'in_progress') {
    filtered = serviceMemos.filter(m => m.overallStatus === 'in_progress');
  } else if (filter === 'completed') {
    filtered = serviceMemos.filter(m => m.overallStatus === 'completed');
  } else if (filter === 'rejected') {
    filtered = serviceMemos.filter(m => m.overallStatus === 'rejected');
  }

  res.json(filtered);
});

// GET single service memo
app.get('/api/service-memos/:id', (req, res) => {
  const memo = serviceMemos.find(m => m.id === req.params.id);
  if (!memo) {
    return res.status(404).json({ error: 'Service memo not found' });
  }
  res.json(memo);
});

// CREATE service memo
app.post('/api/service-memos', (req, res) => {
  const user = getUserFromRequest(req);
  const { title, description, priority, category, customWorkflow } = req.body;

  if (!title?.trim() || !description?.trim()) {
    return res.status(400).json({ error: 'Title and description required' });
  }

  const WORKFLOW_TEMPLATES = {
    it_support: ['initiator', 'it', 'deputy_director', 'director'],
    purchase: ['initiator', 'procurement', 'deputy_director', 'director', 'accounting'],
    maintenance: ['initiator', 'admin', 'deputy_director', 'director'],
    request: ['initiator', 'hr', 'deputy_director', 'director'],
    complaint: ['initiator', 'hr', 'deputy_director', 'director'],
    other: ['initiator', 'admin', 'director'],
  };

  const DEPARTMENT_LABELS = {
    initiator: 'Инициатор',
    it: 'IT отдел',
    procurement: 'Закупки',
    hr: 'HR отдел',
    deputy_director: 'Зам. директора',
    director: 'Директор',
    accounting: 'Бухгалтерия',
    admin: 'Администратор',
  };

  const workflowTemplate = customWorkflow?.length > 0
    ? customWorkflow
    : WORKFLOW_TEMPLATES[category] || WORKFLOW_TEMPLATES.other;

  const workflow = workflowTemplate.map((dept, index) => ({
    stage: index,
    department: dept,
    departmentLabel: DEPARTMENT_LABELS[dept],
    status: index === 0 ? 'approved' : 'pending',
    approver: index === 0 ? user.id : undefined,
    approverName: index === 0 ? user.name : undefined,
    approvedAt: index === 0 ? new Date().toISOString() : undefined,
    comments: undefined,
  }));

  const newMemo = {
    id: `memo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title,
    description,
    createdBy: user.id,
    createdByName: user.name,
    priority: priority || 'medium',
    category: category || 'other',
    workflow,
    currentStage: 1,
    overallStatus: 'in_progress',
    attachments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  serviceMemos.push(newMemo);
  res.status(201).json(newMemo);
});

// APPROVE service memo
app.put('/api/service-memos/:id/approve', (req, res) => {
  const user = getUserFromRequest(req);
  const { comments } = req.body;
  const memo = serviceMemos.find(m => m.id === req.params.id);

  if (!memo) {
    return res.status(404).json({ error: 'Service memo not found' });
  }

  if (memo.overallStatus !== 'in_progress') {
    return res.status(400).json({ error: 'Cannot approve completed or rejected memo' });
  }

  const currentStageData = memo.workflow[memo.currentStage];
  if (!currentStageData || currentStageData.status !== 'pending') {
    return res.status(400).json({ error: 'Invalid memo state for approval' });
  }

  const updatedWorkflow = [...memo.workflow];
  updatedWorkflow[memo.currentStage] = {
    ...currentStageData,
    status: 'approved',
    approver: user.id,
    approverName: user.name,
    approvedAt: new Date().toISOString(),
    comments: comments || undefined,
  };

  const isLastStage = memo.currentStage === memo.workflow.length - 1;
  const newStatus = isLastStage ? 'completed' : 'in_progress';
  const newStage = isLastStage ? memo.currentStage : memo.currentStage + 1;

  const updated = {
    ...memo,
    workflow: updatedWorkflow,
    currentStage: newStage,
    overallStatus: newStatus,
    updatedAt: new Date().toISOString(),
    completedAt: isLastStage ? new Date().toISOString() : undefined,
  };

  const index = serviceMemos.findIndex(m => m.id === req.params.id);
  serviceMemos[index] = updated;

  res.json(updated);
});

// REJECT service memo
app.put('/api/service-memos/:id/reject', (req, res) => {
  const user = getUserFromRequest(req);
  const { comments } = req.body;

  if (!comments?.trim()) {
    return res.status(400).json({ error: 'Reason required for rejection' });
  }

  const memo = serviceMemos.find(m => m.id === req.params.id);

  if (!memo) {
    return res.status(404).json({ error: 'Service memo not found' });
  }

  const currentStageData = memo.workflow[memo.currentStage];
  const updatedWorkflow = [...memo.workflow];
  updatedWorkflow[memo.currentStage] = {
    ...currentStageData,
    status: 'rejected',
    approver: user.id,
    approverName: user.name,
    approvedAt: new Date().toISOString(),
    comments,
  };

  const updated = {
    ...memo,
    workflow: updatedWorkflow,
    overallStatus: 'rejected',
    updatedAt: new Date().toISOString(),
  };

  const index = serviceMemos.findIndex(m => m.id === req.params.id);
  serviceMemos[index] = updated;

  res.json(updated);
});

// DELETE service memo
app.delete('/api/service-memos/:id', (req, res) => {
  const user = getUserFromRequest(req);
  const memo = serviceMemos.find(m => m.id === req.params.id);

  if (!memo) {
    return res.status(404).json({ error: 'Service memo not found' });
  }

  // Only creator or admin can delete
  if (memo.createdBy !== user.id && user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  serviceMemos = serviceMemos.filter(m => m.id !== req.params.id);
  res.json({ success: true });
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

// SPA fallback - важно для React Router
app.get('*', (req, res) => {
  // Если это не API запрос, отправляем index.html
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
