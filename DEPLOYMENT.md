# Bitespeed - Deployment Guide

Complete guide for deploying the Identity Reconciliation service to production.

## Prerequisites

- GitHub account
- Render.com account (free)
- PostgreSQL database (local or managed)
- Node.js 18+ (for local testing)

## Option 1: Deploy to Render.com (Recommended for Beginners)

### Step 1: Prepare Your Repository

1. **Initialize Git repository:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Bitespeed identity reconciliation backend"
   ```

2. **Create GitHub repository:**
   - Go to https://github.com/new
   - Create repository `bitespeed-identity-reconciliation`
   - Don't initialize with README/LICENSE (we already have them)

3. **Push to GitHub:**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/bitespeed-identity-reconciliation.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Create PostgreSQL Database on Render

1. Go to https://dashboard.render.com
2. Click "New +" → "PostgreSQL"
3. Configure:
   - **Name:** bitespeed-db
   - **Database:** bitespeed_db
   - **User:** postgres
   - **Region:** Choose closest to you
4. Click "Create Database"
5. Note the **Internal Database URL** (will be used in environment variables)

### Step 3: Deploy the API Service

1. Go to https://dashboard.render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repository:
   - Select: `bitespeed-identity-reconciliation`
   - Authorize Render
4. Configure the service:
   - **Name:** bitespeed-api
   - **Environment:** Node
   - **Region:** Same as database
   - **Branch:** main
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`

5. **Add Environment Variables:**
   Click "Advanced" and add:
   ```
   NODE_ENV=production
   PORT=3000
   DB_HOST=[from PostgreSQL dashboard → Internal Database URL]
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=[from PostgreSQL dashboard]
   DB_NAME=bitespeed_db
   LOG_LEVEL=info
   ```

6. Click "Create Web Service"

### Step 4: Initialize Database

1. After deployment, go to Render Dashboard
2. Click on your Web Service
3. Open the "Shell" tab
4. Run:
   ```bash
   npm run migrate
   ```

5. Verify with:
   ```bash
   curl https://YOUR_RENDER_URL/health
   ```

### Step 5: Update README with Live URL

Edit README.md and add:
```markdown
## ��� Live Demo

**API Endpoint:** `https://your-service-name.onrender.com`

Test the endpoint:
```bash
curl -X POST https://your-service-name.onrender.com/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","phoneNumber":"1234567890"}'
```
```

---

## Option 2: Deploy Using Docker to AWS ECS

### Prerequisites
- AWS account with ECR and ECS access
- Docker installed locally
- AWS CLI configured

### Step 1: Build and Push Docker Image

```bash
# Login to AWS ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin [YOUR_ACCOUNT_ID].dkr.ecr.us-east-1.amazonaws.com

# Create ECR repository
aws ecr create-repository --repository-name bitespeed-api --region us-east-1

# Build image
docker build -t bitespeed-api:latest .

# Tag image
docker tag bitespeed-api:latest [YOUR_ACCOUNT_ID].dkr.ecr.us-east-1.amazonaws.com/bitespeed-api:latest

# Push to ECR
docker push [YOUR_ACCOUNT_ID].dkr.ecr.us-east-1.amazonaws.com/bitespeed-api:latest
```

### Step 2: Create ECS Task Definition

Create `ecs-task-definition.json`:
```json
{
  "family": "bitespeed-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [
    {
      "name": "bitespeed-api",
      "image": "[YOUR_ACCOUNT_ID].dkr.ecr.us-east-1.amazonaws.com/bitespeed-api:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "3000"
        },
        {
          "name": "DB_HOST",
          "value": "your-rds-endpoint"
        },
        {
          "name": "DB_PORT",
          "value": "5432"
        },
        {
          "name": "DB_USER",
          "value": "postgres"
        },
        {
          "name": "DB_NAME",
          "value": "bitespeed_db"
        }
      ],
      "secrets": [
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:db-password"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/bitespeed-api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

### Step 3: Create ECS Service

```bash
# Create cluster
aws ecs create-cluster --cluster-name bitespeed-cluster --region us-east-1

# Register task definition
aws ecs register-task-definition --cli-input-json file://ecs-task-definition.json --region us-east-1

# Create service
aws ecs create-service \
  --cluster bitespeed-cluster \
  --service-name bitespeed-api \
  --task-definition bitespeed-api \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxxx],securityGroups=[sg-xxxxx],assignPublicIp=ENABLED}" \
  --region us-east-1
```

---

## Option 3: Deploy to Heroku (Legacy but Still Works)

### Step 1: Install Heroku CLI

```bash
npm install -g heroku
heroku login
```

### Step 2: Create Heroku App

```bash
heroku create bitespeed-api
```

### Step 3: Add PostgreSQL Add-on

```bash
heroku addons:create heroku-postgresql:hobby-dev -a bitespeed-api
```

### Step 4: Set Environment Variables

```bash
heroku config:set NODE_ENV=production -a bitespeed-api
heroku config:set LOG_LEVEL=info -a bitespeed-api
```

### Step 5: Deploy

```bash
git push heroku main
```

### Step 6: Run Migrations

```bash
heroku run npm run migrate -a bitespeed-api
```

---

## Option 4: Self-Hosted on VPS (DigitalOcean/Linode)

### Step 1: Create VPS

- Choose Ubuntu 22.04 LTS
- Minimum 1GB RAM
- Configure firewall to allow ports 80, 443, 3000

### Step 2: Setup Server

```bash
# SSH into server
ssh root@YOUR_VPS_IP

# Update system
apt update && apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs

# Install PostgreSQL
apt install -y postgresql postgresql-contrib

# Install PM2 (process manager)
npm install -g pm2

# Install Nginx (reverse proxy)
apt install -y nginx

# Install Certbot (SSL certificates)
apt install -y certbot python3-certbot-nginx
```

### Step 3: Clone and Setup Application

```bash
# Create app directory
mkdir -p /var/www/bitespeed
cd /var/www/bitespeed

# Clone repository
git clone https://github.com/YOUR_USERNAME/bitespeed-identity-reconciliation.git .

# Install dependencies
npm install --production

# Build
npm run build

# Create .env file
cp .env.example .env
# Edit .env with your database credentials
nano .env
```

### Step 4: Setup PostgreSQL

```bash
sudo -u postgres createdb bitespeed_db
sudo -u postgres psql -d bitespeed_db -c "ALTER USER postgres WITH PASSWORD 'your_password';"
```

### Step 5: Run Migrations

```bash
npm run migrate
```

### Step 6: Setup PM2

```bash
pm2 start "npm start" --name "bitespeed-api"
pm2 save
pm2 startup
```

### Step 7: Configure Nginx

Create `/etc/nginx/sites-available/bitespeed`:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:
```bash
ln -s /etc/nginx/sites-available/bitespeed /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### Step 8: Setup SSL with Let's Encrypt

```bash
certbot --nginx -d your-domain.com -d www.your-domain.com
```

---

## Monitoring and Logs

### Render.com Logs
- Logs are visible in Render Dashboard → Your Service → Logs tab
- Tail logs: `curl https://api.render.com/v1/services/{SERVICE_ID}/logs`

### Local Logs
Logs are written to:
- Console (stdout)
- `logs/error.log` (errors only)
- `logs/combined.log` (all logs)

### Database Monitoring

```bash
# Connect to PostgreSQL
psql -h localhost -U postgres -d bitespeed_db

# Monitor slow queries
SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;

# Check connection count
SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;
```

---

## Performance Optimization

### 1. Enable Query Caching
Update database connection pool settings in `connection.ts`:
```typescript
const pool = new Pool({
  // ... existing config
  max: 20,              // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### 2. Add Redis Caching
```bash
npm install redis
```

### 3. Use CDN for Static Assets
If serving any static files, use Cloudflare or AWS CloudFront.

### 4. Enable Gzip Compression
Already enabled via Helmet middleware in `index.ts`.

---

## Security Checklist

- ✅ Use HTTPS in production
- ✅ Set `NODE_ENV=production`
- ✅ Use strong database passwords
- ✅ Enable CORS only for trusted domains
- ✅ Use environment variables for secrets
- ✅ Keep dependencies updated: `npm audit fix`
- ✅ Enable database backups
- ✅ Monitor error logs
- ✅ Use firewall rules to restrict access

---

## Backup and Recovery

### Database Backup

```bash
# Backup PostgreSQL
pg_dump -h localhost -U postgres bitespeed_db > backup.sql

# Restore from backup
psql -h localhost -U postgres bitespeed_db < backup.sql

# Using AWS RDS
aws rds create-db-snapshot \
  --db-instance-identifier bitespeed-db \
  --db-snapshot-identifier bitespeed-db-backup-$(date +%Y%m%d)
```

### Code Backup

GitHub automatically backs up your code. Always keep your main branch clean and production-ready.

---

## Troubleshooting Deployment

### Issue: Database Connection Timeout
```
Error: getaddrinfo ENOTFOUND db_host
```
**Solution:**
- Verify DB_HOST is correct
- Check database is running
- Verify firewall allows connections

### Issue: Out of Memory
```
JavaScript heap out of memory
```
**Solution:**
- Increase container memory allocation
- Optimize queries
- Enable pagination

### Issue: Build Fails
```
Command exited with code 1
```
**Solution:**
- Check build logs
- Verify `npm run build` works locally
- Check for missing environment variables

---

## Continuous Deployment

Setup automatic deployment on git push:

### Using Render Webhooks
1. Render automatically deploys on push to main
2. Configure in Dashboard → Service → Auto-Deploy

### Using GitHub Actions
Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Render

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Trigger Render Deployment
        run: |
          curl -X POST ${{ secrets.RENDER_DEPLOY_HOOK }} \
            -H "Content-Type: application/json"
```

---

**Last Updated:** 2026-03-05
