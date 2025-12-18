# RB Partners Suite - Deployment Guide

This guide covers deploying the RB Partners Suite with full backend support.

## Architecture Overview

The application now includes:
- **Frontend**: React + TypeScript + Vite (SPA)
- **Backend**: Express.js server with REST API
- **Process Management**: PM2 for production process management
- **Reverse Proxy**: Nginx with SSL/TLS support
- **Containerization**: Docker + Docker Compose

## Quick Start - Local Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Start development server (frontend only)
npm run dev

# OR start with backend
npm run dev:server
```

Access the app at `http://localhost:5173` (frontend only) or `http://localhost:3000` (with backend).

## Production Deployment

### Option 1: Docker Compose (Recommended)

Docker Compose provides the easiest production deployment with automatic service orchestration.

#### Prerequisites
- Docker 20.10+
- Docker Compose 1.29+

#### Setup

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env with your settings:
#   - PORT=3000
#   - NODE_ENV=production
#   - ALLOWED_ORIGINS=https://yourdomain.com,https://sub.yourdomain.com

# 2. Build and start services
docker-compose up -d

# 3. View logs
docker-compose logs -f

# 4. Stop services
docker-compose down
```

**What docker-compose provides:**
- Automatic health checks for services
- Volume mounting for logs (optional)
- Easy scaling and service management
- Consistent environments between dev and prod

#### Accessing the Application

By default:
- **HTTP**: http://localhost:80
- **HTTPS**: https://localhost:443 (if SSL configured)
- **Direct App**: http://localhost:3000

### Option 2: Standalone Server (Advanced)

For servers where Docker isn't available:

#### Prerequisites
- Node.js 18+ LTS
- PM2 (`npm install -g pm2`)
- Nginx (optional but recommended)

#### Build and Deploy

```bash
# 1. Install dependencies
npm install --production

# 2. Build frontend
npm run build

# 3. Configure environment
cp .env.example .env
# Edit .env as needed

# 4. Start with PM2
pm2 start ecosystem.config.js --env production

# 5. Setup Nginx (optional)
sudo cp nginx.conf /etc/nginx/sites-available/rb-suite
sudo ln -s /etc/nginx/sites-available/rb-suite /etc/nginx/sites-enabled/
sudo nginx -s reload

# 6. View logs
pm2 logs

# 7. Monitor
pm2 monit
```

## API Endpoints

### Service Memos

```
GET    /api/service-memos                    - List all memos (with filters)
GET    /api/service-memos/:id                - Get specific memo
POST   /api/service-memos                    - Create new memo
PUT    /api/service-memos/:id/approve        - Approve memo at current stage
PUT    /api/service-memos/:id/reject         - Reject memo with reason
DELETE /api/service-memos/:id                - Delete memo
```

**Query Parameters for GET /api/service-memos:**
- `filter=all|my|pending|in_progress|completed|rejected`

**Request Headers:**
- `x-user-id`: User ID
- `x-user-name`: User display name
- `x-user-role`: User role

### Team Evaluations

```
GET    /api/project-evaluations/:projectId   - List evaluations for project
GET    /api/project-evaluations/:projectId/:id - Get specific evaluation
POST   /api/project-evaluations              - Create new evaluation
PUT    /api/project-evaluations/:id          - Update evaluation
DELETE /api/project-evaluations/:id          - Delete evaluation
```

**Evaluation Types:**
- `partner_by_manager`: Manager evaluates partner
- `manager_by_team`: Team anonymously evaluates manager
- `team_by_manager`: Manager evaluates team members

## Configuration Files

### .env

```env
# Server
PORT=3000
NODE_ENV=production

# CORS
ALLOWED_ORIGINS=https://rb-suite.yourdomain.com

# Supabase (optional)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### docker-compose.yml

```yaml
services:
  rb-suite:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - rb-suite
```

### nginx.conf

Key features:
- **SSL/TLS**: Configures TLS 1.2 and 1.3
- **Security Headers**: HSTS, X-Frame-Options, CSP
- **Rate Limiting**: 10 req/s general, 30 req/s for API
- **Caching**: Static assets cached for 365 days
- **Compression**: Gzip enabled for text/JSON
- **SPA Routing**: Fallback to index.html for client-side routing

### ecosystem.config.js

PM2 configuration for production:
- **Cluster Mode**: Auto-scales to available CPU cores
- **Memory Limit**: 500MB per instance
- **Logging**: Error and output logs to `/var/log/pm2/`
- **Auto-restart**: On crashes and system reboot

## SSL/TLS Setup

### Using Self-Signed Certificate (Development)

```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Create ssl directory
mkdir -p ssl
mv cert.pem ssl/fullchain.pem
mv key.pem ssl/privkey.pem
```

### Using Let's Encrypt (Production)

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Generate certificate
sudo certbot certonly --nginx -d yourdomain.com -d sub.yourdomain.com

# Symlink to nginx.conf location
sudo ln -s /etc/letsencrypt/live/yourdomain.com/fullchain.pem ssl/fullchain.pem
sudo ln -s /etc/letsencrypt/live/yourdomain.com/privkey.pem ssl/privkey.pem
```

## Data Persistence

### Development (localStorage)
- In-memory storage on backend falls back to browser localStorage
- Data persists in browser but not across server restarts

### Production (Recommended: Supabase)
Replace in-memory storage with Supabase:

```typescript
// In server.js or backend code
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Query memos from database
const { data: memos } = await supabase
  .from('service_memos')
  .select('*')
  .eq('projectId', projectId);
```

## Monitoring and Logs

### Docker Compose
```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f rb-suite

# View last N lines
docker-compose logs --tail=50 rb-suite
```

### PM2
```bash
# View logs
pm2 logs

# Real-time monitoring
pm2 monit

# Save logs to file
pm2 logs > app.log

# Flush logs
pm2 flush
```

### Nginx
```bash
# View access logs
tail -f /var/log/nginx/rb-suite-access.log

# View error logs
tail -f /var/log/nginx/rb-suite-error.log
```

## Health Checks

### API Health
```bash
curl http://localhost:3000/api/health
# Response: {"status":"ok","timestamp":"2025-12-18T..."}
```

### Full Health Check
```bash
curl http://localhost/
# Should return the SPA index.html
```

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use a different port
PORT=3001 npm run dev:server
```

### SSL Certificate Issues
```bash
# Check certificate
openssl x509 -in ssl/fullchain.pem -text -noout

# Verify certificate and key match
openssl x509 -noout -modulus -in ssl/fullchain.pem | openssl md5
openssl rsa -noout -modulus -in ssl/privkey.pem | openssl md5
```

### Nginx Not Starting
```bash
# Test configuration
sudo nginx -t

# View error logs
sudo tail -f /var/log/nginx/error.log

# Reload configuration
sudo systemctl reload nginx
```

### Backend API Errors
```bash
# Enable debug logging
NODE_DEBUG=* npm run dev:server

# Check PM2 logs
pm2 logs --err

# View PM2 error log file
tail -f /var/log/pm2/rb-suite-error.log
```

## Performance Tips

1. **Enable Compression**: Nginx gzip is already configured
2. **Cache Static Assets**: Set to 365 days (already configured)
3. **Use CDN**: Put Nginx behind CloudFlare or similar
4. **Database Optimization**: Index service_memos and evaluations tables
5. **Rate Limiting**: Adjust in nginx.conf if needed (currently 10 req/s general, 30 req/s API)

## Backup Strategy

```bash
# Backup application
tar -czf rb-suite-backup-$(date +%Y%m%d).tar.gz /path/to/rb-suite

# Backup Supabase data
pg_dump postgresql://user:password@host/db > backup.sql

# Automated daily backup (add to crontab)
0 2 * * * tar -czf /backups/rb-suite-$(date +\%Y\%m\%d).tar.gz /opt/rb-suite
```

## Version Management

Deployments track versions via:
- Git commits (stored in `/opt/rb-suite/.git`)
- Docker image tags
- PM2 app versions

To rollback:
```bash
git checkout <commit-hash>
npm run build
pm2 restart rb-suite
```

## Support

For issues, check:
1. Application logs: `docker-compose logs` or `pm2 logs`
2. Nginx logs: `/var/log/nginx/rb-suite-*.log`
3. GitHub issues: https://github.com/krasavchik01/rbbb/issues
4. Documentation: This file and code comments

## Next Steps

1. Configure `.env` with your settings
2. Set up SSL certificates
3. Choose deployment method (Docker Compose recommended)
4. Deploy and verify all services are running
5. Configure database persistence with Supabase
6. Set up monitoring and logging
7. Create backup strategy
