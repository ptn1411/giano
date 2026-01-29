# QUIC Transport Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the QUIC transport feature in production environments. QUIC (Quick UDP Internet Connections) provides improved performance and reliability compared to traditional TCP-based protocols.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Certificate Setup](#certificate-setup)
3. [Configuration Options](#configuration-options)
4. [Monitoring Setup](#monitoring-setup)
5. [Deployment Steps](#deployment-steps)
6. [Verification](#verification)
7. [Security Considerations](#security-considerations)

## Prerequisites

### System Requirements

- **Operating System**: Linux (Ubuntu 20.04+, Debian 11+, RHEL 8+) or Windows Server 2019+
- **Rust**: Version 1.70 or higher
- **Node.js**: Version 18 or higher (for frontend)
- **Network**: UDP port 4433 (or configured port) must be accessible
- **TLS Certificates**: Valid TLS certificates for HTTPS/QUIC

### Firewall Requirements

QUIC uses UDP instead of TCP. Ensure the following ports are open:

```bash
# Backend QUIC port (default: 4433)
sudo ufw allow 4433/udp

# HTTP/WebSocket fallback (default: 8080)
sudo ufw allow 8080/tcp

# HTTPS (if using reverse proxy)
sudo ufw allow 443/tcp
```

### Browser Support

QUIC transport requires WebTransport API support:
- Chrome/Edge 97+
- Opera 83+
- Safari: Not yet supported (will fallback to WebSocket)
- Firefox: Behind flag (will fallback to WebSocket)

## Certificate Setup

### Option 1: Let's Encrypt (Recommended for Production)

#### Using Certbot

1. Install Certbot:
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install certbot

# RHEL/CentOS
sudo yum install certbot
```

2. Generate certificates:
```bash
sudo certbot certonly --standalone -d your-domain.com
```

3. Certificates will be created at:
```
/etc/letsencrypt/live/your-domain.com/fullchain.pem
/etc/letsencrypt/live/your-domain.com/privkey.pem
```

4. Copy certificates to application directory:
```bash
sudo mkdir -p /opt/messaging-app/certs
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /opt/messaging-app/certs/server.crt
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem /opt/messaging-app/certs/server.key
sudo chown app-user:app-user /opt/messaging-app/certs/*
sudo chmod 600 /opt/messaging-app/certs/server.key
```

5. Set up automatic renewal:
```bash
# Add to crontab
sudo crontab -e

# Add this line to renew certificates daily
0 0 * * * certbot renew --quiet --deploy-hook "cp /etc/letsencrypt/live/your-domain.com/*.pem /opt/messaging-app/certs/ && systemctl restart messaging-app"
```

### Option 2: Self-Signed Certificates (Development/Testing Only)

**WARNING**: Self-signed certificates should NEVER be used in production.

```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout server.key -out server.crt -days 365 -nodes \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

# Move to certs directory
mkdir -p backend/certs
mv server.key server.crt backend/certs/
chmod 600 backend/certs/server.key
```

### Option 3: Commercial Certificate Authority

1. Generate Certificate Signing Request (CSR):
```bash
openssl req -new -newkey rsa:4096 -nodes -keyout server.key -out server.csr \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=your-domain.com"
```

2. Submit CSR to your CA (DigiCert, GlobalSign, etc.)

3. Download the issued certificate and intermediate certificates

4. Combine certificates:
```bash
cat your-certificate.crt intermediate.crt > server.crt
```

5. Install certificates:
```bash
sudo mkdir -p /opt/messaging-app/certs
sudo mv server.crt server.key /opt/messaging-app/certs/
sudo chown app-user:app-user /opt/messaging-app/certs/*
sudo chmod 600 /opt/messaging-app/certs/server.key
```

### Certificate Validation

Verify your certificates are valid:

```bash
# Check certificate details
openssl x509 -in /opt/messaging-app/certs/server.crt -text -noout

# Verify certificate and key match
openssl x509 -noout -modulus -in /opt/messaging-app/certs/server.crt | openssl md5
openssl rsa -noout -modulus -in /opt/messaging-app/certs/server.key | openssl md5
# The MD5 hashes should match

# Check certificate expiration
openssl x509 -in /opt/messaging-app/certs/server.crt -noout -enddate
```

## Configuration Options

### Backend Configuration

Create or update `backend/.env`:

```bash
# ============================================
# QUIC Transport Configuration
# ============================================

# Enable/disable QUIC transport
# Set to false to disable QUIC and use WebSocket only
QUIC_ENABLED=true

# QUIC server bind address
# Use 0.0.0.0 to listen on all interfaces
# Use 127.0.0.1 for localhost only
QUIC_BIND_ADDRESS=0.0.0.0

# QUIC server UDP port
# Default: 4433 (standard QUIC port)
# Must be different from HTTP/WebSocket port
QUIC_PORT=4433

# TLS certificate paths
# Must be valid PEM-encoded certificates
QUIC_CERT_PATH=./certs/server.crt
QUIC_KEY_PATH=./certs/server.key

# Maximum concurrent QUIC connections
# Adjust based on server capacity
# Recommended: 10000 for production servers
QUIC_MAX_CONNECTIONS=10000

# Maximum streams per connection
# Each message type uses separate streams
# Recommended: 100 (allows 100 concurrent operations per client)
QUIC_MAX_STREAMS_PER_CONNECTION=100

# Connection idle timeout (milliseconds)
# Connections idle longer than this will be closed
# Recommended: 30000 (30 seconds)
QUIC_IDLE_TIMEOUT_MS=30000

# Keep-alive interval (milliseconds)
# How often to send keep-alive packets
# Recommended: 5000 (5 seconds)
QUIC_KEEP_ALIVE_INTERVAL_MS=5000

# ============================================
# Database Configuration
# ============================================
DATABASE_URL=postgresql://user:password@localhost/messaging_db

# ============================================
# Authentication Configuration
# ============================================
JWT_SECRET=your-secret-key-here
JWT_EXPIRATION=3600

# ============================================
# Server Configuration
# ============================================
SERVER_HOST=0.0.0.0
SERVER_PORT=8080
```

### Frontend Configuration

Create or update `frontend/.env.production`:

```bash
# ============================================
# QUIC Transport Configuration
# ============================================

# Enable/disable QUIC transport on client
# Set to false to force WebSocket only
VITE_QUIC_ENABLED=true

# QUIC server URL
# Must use https:// scheme for WebTransport
# Must match backend QUIC_PORT
VITE_QUIC_URL=https://your-domain.com:4433

# QUIC connection timeout (milliseconds)
# How long to wait before falling back to WebSocket
# Recommended: 5000 (5 seconds)
VITE_QUIC_TIMEOUT=5000

# Enable automatic fallback to WebSocket
# If false, connection will fail if QUIC fails
VITE_QUIC_FALLBACK_ENABLED=true

# WebSocket fallback URL
VITE_WEBSOCKET_URL=wss://your-domain.com/ws

# ============================================
# API Configuration
# ============================================
VITE_API_URL=https://your-domain.com/api
```

### Configuration Validation

The application validates configuration on startup. Check logs for validation errors:

```bash
# Check backend logs
journalctl -u messaging-app -n 100 --no-pager | grep -i "config\|quic"

# Common validation errors:
# - Invalid certificate paths
# - Port already in use
# - Invalid timeout values
# - Missing required environment variables
```

### Environment-Specific Configurations

#### Development
```bash
QUIC_ENABLED=true
QUIC_BIND_ADDRESS=127.0.0.1
QUIC_PORT=4433
QUIC_MAX_CONNECTIONS=100
```

#### Staging
```bash
QUIC_ENABLED=true
QUIC_BIND_ADDRESS=0.0.0.0
QUIC_PORT=4433
QUIC_MAX_CONNECTIONS=1000
```

#### Production
```bash
QUIC_ENABLED=true
QUIC_BIND_ADDRESS=0.0.0.0
QUIC_PORT=4433
QUIC_MAX_CONNECTIONS=10000
QUIC_IDLE_TIMEOUT_MS=30000
QUIC_KEEP_ALIVE_INTERVAL_MS=5000
```

## Monitoring Setup

### Metrics Endpoint

The backend exposes QUIC metrics at `/api/metrics/quic`:

```bash
curl https://your-domain.com/api/metrics/quic
```

Response format:
```json
{
  "active_connections": {
    "quic": 1250,
    "websocket": 750,
    "total": 2000
  },
  "connection_ratio": {
    "quic_percentage": 62.5,
    "websocket_percentage": 37.5
  },
  "throughput": {
    "messages_per_second": 15000,
    "bytes_per_second": 2500000
  },
  "latency": {
    "p50_ms": 25,
    "p95_ms": 50,
    "p99_ms": 100
  },
  "errors": {
    "connection_failures": 5,
    "migration_failures": 2,
    "timeout_errors": 3
  }
}
```

### Prometheus Integration

Add Prometheus scraping configuration:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'messaging-app-quic'
    scrape_interval: 15s
    static_configs:
      - targets: ['your-domain.com:8080']
    metrics_path: '/api/metrics/quic'
```

### Grafana Dashboard

Import the provided Grafana dashboard template:

1. Create dashboard JSON file `grafana-quic-dashboard.json`:
```json
{
  "dashboard": {
    "title": "QUIC Transport Metrics",
    "panels": [
      {
        "title": "Active Connections",
        "targets": [
          {
            "expr": "quic_active_connections",
            "legendFormat": "QUIC"
          },
          {
            "expr": "websocket_active_connections",
            "legendFormat": "WebSocket"
          }
        ]
      },
      {
        "title": "Throughput",
        "targets": [
          {
            "expr": "rate(quic_messages_total[5m])",
            "legendFormat": "Messages/sec"
          }
        ]
      },
      {
        "title": "Latency (p95)",
        "targets": [
          {
            "expr": "quic_latency_p95",
            "legendFormat": "p95 Latency"
          }
        ]
      }
    ]
  }
}
```

2. Import in Grafana UI: Dashboards → Import → Upload JSON

### Log Aggregation

Configure log shipping to your logging system:

#### Using Filebeat (ELK Stack)
```yaml
# filebeat.yml
filebeat.inputs:
  - type: log
    enabled: true
    paths:
      - /var/log/messaging-app/*.log
    fields:
      service: messaging-app
      transport: quic
    multiline.pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
    multiline.negate: true
    multiline.match: after

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
```

#### Using Fluentd
```conf
# fluentd.conf
<source>
  @type tail
  path /var/log/messaging-app/*.log
  pos_file /var/log/td-agent/messaging-app.pos
  tag messaging.app
  <parse>
    @type json
  </parse>
</source>

<match messaging.app>
  @type elasticsearch
  host elasticsearch
  port 9200
  index_name messaging-app
</match>
```

### Alerting Rules

Set up alerts for critical conditions:

#### Prometheus Alerting Rules
```yaml
# alerts.yml
groups:
  - name: quic_transport
    rules:
      - alert: HighQUICConnectionFailureRate
        expr: rate(quic_connection_failures[5m]) > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High QUIC connection failure rate"
          description: "QUIC connections are failing at {{ $value }} per second"

      - alert: QUICServerDown
        expr: up{job="messaging-app-quic"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "QUIC server is down"
          description: "QUIC metrics endpoint is not responding"

      - alert: HighLatency
        expr: quic_latency_p95 > 200
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High QUIC latency detected"
          description: "p95 latency is {{ $value }}ms"
```

### Health Checks

Implement health check endpoints:

```bash
# Check if QUIC server is running
curl https://your-domain.com/api/health/quic

# Expected response:
{
  "status": "healthy",
  "quic_enabled": true,
  "active_connections": 1250,
  "uptime_seconds": 86400
}
```

## Deployment Steps

### Step 1: Build Backend

```bash
cd backend

# Production build
cargo build --release

# Binary will be at: target/release/messaging-app
```

### Step 2: Build Frontend

```bash
cd frontend

# Install dependencies
npm install

# Production build
npm run build

# Static files will be in: dist/
```

### Step 3: Deploy Backend

#### Using Systemd (Linux)

1. Create systemd service file:
```bash
sudo nano /etc/systemd/system/messaging-app.service
```

2. Add service configuration:
```ini
[Unit]
Description=Messaging App with QUIC Transport
After=network.target postgresql.service

[Service]
Type=simple
User=app-user
Group=app-user
WorkingDirectory=/opt/messaging-app
Environment="RUST_LOG=info"
EnvironmentFile=/opt/messaging-app/.env
ExecStart=/opt/messaging-app/messaging-app
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/messaging-app/uploads

[Install]
WantedBy=multi-user.target
```

3. Deploy and start:
```bash
# Copy binary
sudo cp target/release/messaging-app /opt/messaging-app/

# Copy configuration
sudo cp .env /opt/messaging-app/

# Set permissions
sudo chown -R app-user:app-user /opt/messaging-app
sudo chmod +x /opt/messaging-app/messaging-app

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable messaging-app
sudo systemctl start messaging-app

# Check status
sudo systemctl status messaging-app
```

#### Using Docker

1. Create Dockerfile:
```dockerfile
FROM rust:1.75 as builder
WORKDIR /app
COPY backend/ .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/target/release/messaging-app .
COPY backend/.env .
COPY backend/certs ./certs
EXPOSE 8080 4433/udp
CMD ["./messaging-app"]
```

2. Build and run:
```bash
docker build -t messaging-app:latest .
docker run -d \
  --name messaging-app \
  -p 8080:8080 \
  -p 4433:4433/udp \
  -v /opt/certs:/app/certs:ro \
  -v /opt/uploads:/app/uploads \
  --env-file .env \
  messaging-app:latest
```

### Step 4: Deploy Frontend

#### Using Nginx

1. Install Nginx:
```bash
sudo apt-get install nginx
```

2. Configure Nginx:
```bash
sudo nano /etc/nginx/sites-available/messaging-app
```

3. Add configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Frontend static files
    root /var/www/messaging-app;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket proxy
    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# QUIC/HTTP3 support (if Nginx supports it)
server {
    listen 443 quic reuseport;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    add_header Alt-Svc 'h3=":443"; ma=86400';
}
```

4. Deploy frontend:
```bash
# Copy built files
sudo cp -r dist/* /var/www/messaging-app/

# Enable site
sudo ln -s /etc/nginx/sites-available/messaging-app /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Step 5: Database Migration

```bash
cd backend

# Run migrations
sqlx migrate run --database-url $DATABASE_URL
```

## Verification

### Backend Verification

1. Check service status:
```bash
sudo systemctl status messaging-app
```

2. Check QUIC port is listening:
```bash
sudo netstat -ulnp | grep 4433
# Should show: udp 0.0.0.0:4433
```

3. Check logs:
```bash
sudo journalctl -u messaging-app -f
# Look for: "QUIC server started on 0.0.0.0:4433"
```

4. Test metrics endpoint:
```bash
curl https://your-domain.com/api/metrics/quic
```

### Frontend Verification

1. Open browser developer console
2. Navigate to your application
3. Check console for transport type:
```
Transport Manager: Attempting QUIC connection...
Transport Manager: Connected via QUIC
```

4. Check Network tab for WebTransport connections

### End-to-End Verification

1. Send a test message
2. Check backend logs for QUIC message handling
3. Verify message appears in recipient's UI
4. Check metrics for connection count increase

## Security Considerations

### TLS Configuration

- **Always use TLS 1.3**: QUIC requires TLS 1.3 minimum
- **Strong cipher suites**: Use AEAD ciphers (AES-GCM, ChaCha20-Poly1305)
- **Certificate validation**: Ensure clients validate server certificates
- **Regular updates**: Keep certificates up to date

### Network Security

- **Firewall rules**: Only open necessary ports
- **Rate limiting**: Implement connection rate limits
- **DDoS protection**: Use CloudFlare or similar for DDoS mitigation
- **IP whitelisting**: Consider whitelisting for admin endpoints

### Application Security

- **Authentication**: Reuse existing JWT authentication
- **Authorization**: Validate user permissions on every request
- **Input validation**: Validate all incoming messages
- **Logging**: Log security events (failed auth, suspicious activity)

### Monitoring Security

- **Alert on anomalies**: Set up alerts for unusual patterns
- **Regular audits**: Review logs for security issues
- **Penetration testing**: Conduct regular security assessments

## Rollback Procedure

If issues occur, you can quickly disable QUIC:

### Quick Rollback (Keep Service Running)

1. Update configuration:
```bash
# Edit .env
QUIC_ENABLED=false
```

2. Restart service:
```bash
sudo systemctl restart messaging-app
```

All clients will automatically fall back to WebSocket.

### Full Rollback (Previous Version)

1. Stop service:
```bash
sudo systemctl stop messaging-app
```

2. Restore previous binary:
```bash
sudo cp /opt/messaging-app/messaging-app.backup /opt/messaging-app/messaging-app
```

3. Restore previous configuration:
```bash
sudo cp /opt/messaging-app/.env.backup /opt/messaging-app/.env
```

4. Start service:
```bash
sudo systemctl start messaging-app
```

## Support and Troubleshooting

For common issues and troubleshooting steps, see [QUIC_TROUBLESHOOTING_GUIDE.md](./QUIC_TROUBLESHOOTING_GUIDE.md).

For additional support:
- Check application logs: `journalctl -u messaging-app -f`
- Review metrics: `curl https://your-domain.com/api/metrics/quic`
- Contact support team with logs and metrics

## References

- QUIC Protocol: https://www.rfc-editor.org/rfc/rfc9000.html
- WebTransport API: https://w3c.github.io/webtransport/
- Quinn Documentation: https://docs.rs/quinn/
- Let's Encrypt: https://letsencrypt.org/
