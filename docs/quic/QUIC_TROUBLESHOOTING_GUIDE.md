# QUIC Transport Troubleshooting Guide

## Overview

This guide provides solutions to common issues encountered when deploying and operating the QUIC transport feature. It includes diagnostic steps, common error patterns, and resolution procedures.

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Connection Issues](#connection-issues)
3. [Certificate Problems](#certificate-problems)
4. [Performance Issues](#performance-issues)
5. [Migration Failures](#migration-failures)
6. [Fallback Issues](#fallback-issues)
7. [Configuration Errors](#configuration-errors)
8. [Network Problems](#network-problems)
9. [Debugging Tools](#debugging-tools)
10. [Rollback Procedures](#rollback-procedures)

## Quick Diagnostics

### Health Check Checklist

Run these commands to quickly assess system health:

```bash
# 1. Check if QUIC server is running
sudo systemctl status messaging-app

# 2. Check if QUIC port is listening
sudo netstat -ulnp | grep 4433

# 3. Check recent logs
sudo journalctl -u messaging-app -n 100 --no-pager

# 4. Check metrics endpoint
curl https://your-domain.com/api/metrics/quic

# 5. Check certificate validity
openssl x509 -in /opt/messaging-app/certs/server.crt -noout -enddate

# 6. Test UDP connectivity
nc -u -v your-domain.com 4433
```

### Log Analysis

Check logs for common error patterns:

```bash
# Connection errors
sudo journalctl -u messaging-app | grep -i "connection.*error"

# Certificate errors
sudo journalctl -u messaging-app | grep -i "certificate\|tls"

# Authentication errors
sudo journalctl -u messaging-app | grep -i "auth.*failed"

# Performance warnings
sudo journalctl -u messaging-app | grep -i "timeout\|latency\|slow"
```

## Connection Issues

### Issue: Clients Cannot Connect via QUIC

**Symptoms:**
- Frontend shows "Connected via WebSocket" instead of "Connected via QUIC"
- Browser console shows: "WebTransport connection failed"
- Backend logs show no incoming QUIC connections

**Diagnostic Steps:**

1. Verify QUIC is enabled:
```bash
grep QUIC_ENABLED /opt/messaging-app/.env
# Should show: QUIC_ENABLED=true
```

2. Check if port is listening:
```bash
sudo netstat -ulnp | grep 4433
# Should show: udp 0.0.0.0:4433 ... messaging-app
```

3. Test UDP connectivity:
```bash
# From client machine
nc -u -v your-domain.com 4433
```

4. Check firewall rules:
```bash
sudo ufw status | grep 4433
# Should show: 4433/udp ALLOW
```

**Solutions:**

**Solution 1: Enable QUIC in configuration**
```bash
# Edit .env
sudo nano /opt/messaging-app/.env

# Set QUIC_ENABLED=true
QUIC_ENABLED=true

# Restart service
sudo systemctl restart messaging-app
```

**Solution 2: Open firewall port**
```bash
# Allow UDP port 4433
sudo ufw allow 4433/udp

# Reload firewall
sudo ufw reload
```

**Solution 3: Check cloud provider security groups**
- AWS: Add inbound rule for UDP 4433
- Azure: Add inbound security rule for UDP 4433
- GCP: Add firewall rule for UDP 4433

**Solution 4: Verify NAT/router configuration**
- Ensure UDP port forwarding is configured
- Check if carrier-grade NAT is blocking UDP
- Consider using a VPN or proxy if UDP is blocked

### Issue: QUIC Connections Drop Frequently

**Symptoms:**
- Clients reconnect every few minutes
- Backend logs show: "Connection idle timeout"
- Metrics show high reconnection rate

**Diagnostic Steps:**

1. Check idle timeout configuration:
```bash
grep IDLE_TIMEOUT /opt/messaging-app/.env
```

2. Check keep-alive interval:
```bash
grep KEEP_ALIVE /opt/messaging-app/.env
```

3. Monitor connection duration:
```bash
# Check metrics for average connection duration
curl https://your-domain.com/api/metrics/quic | jq '.connection_duration'
```

**Solutions:**

**Solution 1: Increase idle timeout**
```bash
# Edit .env
QUIC_IDLE_TIMEOUT_MS=60000  # Increase to 60 seconds

# Restart service
sudo systemctl restart messaging-app
```

**Solution 2: Decrease keep-alive interval**
```bash
# Edit .env
QUIC_KEEP_ALIVE_INTERVAL_MS=3000  # Decrease to 3 seconds

# Restart service
sudo systemctl restart messaging-app
```

**Solution 3: Check for network issues**
```bash
# Monitor packet loss
ping -c 100 your-domain.com | grep loss

# Check for high latency
ping -c 100 your-domain.com | grep avg
```

### Issue: High Connection Failure Rate

**Symptoms:**
- Metrics show high `connection_failures` count
- Many clients falling back to WebSocket
- Backend logs show: "Handshake failed"

**Diagnostic Steps:**

1. Check failure rate:
```bash
curl https://your-domain.com/api/metrics/quic | jq '.errors.connection_failures'
```

2. Check certificate validity:
```bash
openssl x509 -in /opt/messaging-app/certs/server.crt -noout -dates
```

3. Check for certificate mismatch:
```bash
# Verify certificate matches domain
openssl x509 -in /opt/messaging-app/certs/server.crt -noout -subject
```

**Solutions:**

**Solution 1: Renew expired certificate**
```bash
# Renew Let's Encrypt certificate
sudo certbot renew

# Copy new certificate
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /opt/messaging-app/certs/server.crt
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem /opt/messaging-app/certs/server.key

# Restart service
sudo systemctl restart messaging-app
```

**Solution 2: Fix certificate permissions**
```bash
sudo chown app-user:app-user /opt/messaging-app/certs/*
sudo chmod 600 /opt/messaging-app/certs/server.key
sudo chmod 644 /opt/messaging-app/certs/server.crt
```

**Solution 3: Increase connection limit**
```bash
# Edit .env
QUIC_MAX_CONNECTIONS=20000  # Increase limit

# Restart service
sudo systemctl restart messaging-app
```

## Certificate Problems

### Issue: Certificate Validation Failed

**Symptoms:**
- Browser console shows: "Certificate validation failed"
- Backend logs show: "TLS handshake error"
- All QUIC connections fail

**Diagnostic Steps:**

1. Verify certificate chain:
```bash
openssl verify -CAfile /etc/ssl/certs/ca-certificates.crt /opt/messaging-app/certs/server.crt
```

2. Check certificate details:
```bash
openssl x509 -in /opt/messaging-app/certs/server.crt -text -noout
```

3. Test TLS connection:
```bash
openssl s_client -connect your-domain.com:4433 -showcerts
```

**Solutions:**

**Solution 1: Include intermediate certificates**
```bash
# Combine certificates in correct order
cat your-certificate.crt intermediate.crt root.crt > server.crt

# Copy to application
sudo cp server.crt /opt/messaging-app/certs/

# Restart service
sudo systemctl restart messaging-app
```

**Solution 2: Update CA certificates**
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install ca-certificates
sudo update-ca-certificates

# RHEL/CentOS
sudo yum update ca-certificates
```

**Solution 3: Use correct certificate format**
```bash
# Convert certificate to PEM format if needed
openssl x509 -in certificate.der -inform DER -out server.crt -outform PEM
```

### Issue: Certificate Expired

**Symptoms:**
- All QUIC connections fail after specific date
- Browser shows certificate error
- Backend logs show: "Certificate expired"

**Diagnostic Steps:**

1. Check expiration date:
```bash
openssl x509 -in /opt/messaging-app/certs/server.crt -noout -enddate
```

**Solutions:**

**Solution 1: Renew certificate immediately**
```bash
# For Let's Encrypt
sudo certbot renew --force-renewal

# Copy new certificate
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /opt/messaging-app/certs/server.crt
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem /opt/messaging-app/certs/server.key

# Restart service
sudo systemctl restart messaging-app
```

**Solution 2: Set up automatic renewal**
```bash
# Add to crontab
sudo crontab -e

# Add renewal job
0 0 * * * certbot renew --quiet --deploy-hook "cp /etc/letsencrypt/live/your-domain.com/*.pem /opt/messaging-app/certs/ && systemctl restart messaging-app"
```

## Performance Issues

### Issue: High Latency

**Symptoms:**
- Messages take several seconds to deliver
- Metrics show p95 latency > 500ms
- Users report slow application

**Diagnostic Steps:**

1. Check current latency:
```bash
curl https://your-domain.com/api/metrics/quic | jq '.latency'
```

2. Check server load:
```bash
top -b -n 1 | head -20
```

3. Check network latency:
```bash
ping -c 100 your-domain.com | grep avg
```

4. Check for packet loss:
```bash
ping -c 100 your-domain.com | grep loss
```

**Solutions:**

**Solution 1: Increase server resources**
```bash
# Check current resource usage
htop

# If CPU > 80%, consider:
# - Scaling vertically (larger instance)
# - Scaling horizontally (load balancer + multiple instances)
```

**Solution 2: Optimize stream allocation**
```bash
# Edit .env - increase streams per connection
QUIC_MAX_STREAMS_PER_CONNECTION=200

# Restart service
sudo systemctl restart messaging-app
```

**Solution 3: Enable connection pooling**
- Ensure clients reuse connections
- Check frontend connection manager settings

**Solution 4: Check database performance**
```bash
# Check slow queries
sudo -u postgres psql -d messaging_db -c "SELECT query, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
```

### Issue: Low Throughput

**Symptoms:**
- Metrics show low messages_per_second
- File transfers are slow
- System can't handle expected load

**Diagnostic Steps:**

1. Check throughput metrics:
```bash
curl https://your-domain.com/api/metrics/quic | jq '.throughput'
```

2. Check connection count:
```bash
curl https://your-domain.com/api/metrics/quic | jq '.active_connections'
```

3. Check system limits:
```bash
ulimit -n  # File descriptor limit
sysctl net.core.rmem_max  # UDP receive buffer
sysctl net.core.wmem_max  # UDP send buffer
```

**Solutions:**

**Solution 1: Increase system limits**
```bash
# Edit /etc/security/limits.conf
sudo nano /etc/security/limits.conf

# Add:
* soft nofile 65536
* hard nofile 65536

# Edit /etc/sysctl.conf
sudo nano /etc/sysctl.conf

# Add:
net.core.rmem_max=26214400
net.core.wmem_max=26214400
net.ipv4.udp_mem=102400 873800 16777216

# Apply changes
sudo sysctl -p
```

**Solution 2: Optimize QUIC configuration**
```bash
# Edit .env
QUIC_MAX_CONNECTIONS=20000
QUIC_MAX_STREAMS_PER_CONNECTION=200

# Restart service
sudo systemctl restart messaging-app
```

**Solution 3: Enable batch processing**
- Check if message batching is enabled
- Increase batch size for bulk operations

### Issue: Memory Leak

**Symptoms:**
- Memory usage grows continuously
- Server becomes unresponsive after hours/days
- OOM killer terminates process

**Diagnostic Steps:**

1. Monitor memory usage:
```bash
# Check current memory
free -h

# Monitor process memory
ps aux | grep messaging-app

# Check for memory growth
watch -n 5 'ps aux | grep messaging-app'
```

2. Check connection count:
```bash
curl https://your-domain.com/api/metrics/quic | jq '.active_connections.total'
```

**Solutions:**

**Solution 1: Restart service regularly**
```bash
# Add to crontab for daily restart
sudo crontab -e

# Add:
0 3 * * * systemctl restart messaging-app
```

**Solution 2: Implement connection limits**
```bash
# Edit .env
QUIC_MAX_CONNECTIONS=10000  # Set reasonable limit

# Restart service
sudo systemctl restart messaging-app
```

**Solution 3: Update to latest version**
```bash
# Check for updates
cd backend
git pull
cargo build --release

# Deploy new version
sudo cp target/release/messaging-app /opt/messaging-app/
sudo systemctl restart messaging-app
```

**Solution 4: Enable memory profiling**
```bash
# Run with memory profiling
RUST_LOG=debug cargo run --release

# Analyze with valgrind
valgrind --leak-check=full ./target/release/messaging-app
```

## Migration Failures

### Issue: Connection Migration Not Working

**Symptoms:**
- Connections drop when switching networks
- Backend logs show: "Migration failed"
- Metrics show high migration_failures count

**Diagnostic Steps:**

1. Check migration failures:
```bash
curl https://your-domain.com/api/metrics/quic | jq '.errors.migration_failures'
```

2. Check backend logs:
```bash
sudo journalctl -u messaging-app | grep -i migration
```

**Solutions:**

**Solution 1: Verify QUIC version support**
- Ensure both client and server support connection migration
- Check Quinn version: `cargo tree | grep quinn`
- Update to latest Quinn version if needed

**Solution 2: Check NAT configuration**
- Connection migration may fail behind certain NATs
- Consider using STUN/TURN servers for NAT traversal

**Solution 3: Increase migration timeout**
```bash
# Edit backend code if configurable
# Or accept that some migrations will fail and rely on reconnection
```

## Fallback Issues

### Issue: Fallback to WebSocket Not Working

**Symptoms:**
- Application becomes unresponsive when QUIC fails
- No automatic fallback occurs
- Frontend shows connection error

**Diagnostic Steps:**

1. Check frontend configuration:
```bash
grep FALLBACK .env.production
# Should show: VITE_QUIC_FALLBACK_ENABLED=true
```

2. Check browser console for errors

3. Check WebSocket server is running:
```bash
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: test" \
  https://your-domain.com/ws
```

**Solutions:**

**Solution 1: Enable fallback in configuration**
```bash
# Edit frontend .env.production
VITE_QUIC_FALLBACK_ENABLED=true

# Rebuild frontend
npm run build
```

**Solution 2: Reduce QUIC timeout**
```bash
# Edit frontend .env.production
VITE_QUIC_TIMEOUT=3000  # Reduce to 3 seconds

# Rebuild frontend
npm run build
```

**Solution 3: Verify WebSocket server**
```bash
# Check if WebSocket handler is registered
sudo journalctl -u messaging-app | grep -i websocket

# Test WebSocket connection
wscat -c wss://your-domain.com/ws
```

### Issue: Clients Stuck on WebSocket

**Symptoms:**
- All clients use WebSocket even when QUIC is available
- Transport preference cache not expiring
- Metrics show 0% QUIC connections

**Diagnostic Steps:**

1. Check client-side cache:
```javascript
// In browser console
localStorage.getItem('transport_preference')
```

2. Check QUIC server is accessible:
```bash
nc -u -v your-domain.com 4433
```

**Solutions:**

**Solution 1: Clear client cache**
```javascript
// In browser console
localStorage.removeItem('transport_preference')
// Reload page
```

**Solution 2: Reduce cache duration**
```typescript
// Edit transport-manager.ts
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes instead of longer
```

**Solution 3: Force QUIC retry**
```bash
# Edit frontend configuration
VITE_QUIC_RETRY_INTERVAL=60000  # Retry every minute
```

## Configuration Errors

### Issue: Invalid Configuration

**Symptoms:**
- Service fails to start
- Logs show: "Configuration error"
- Validation errors on startup

**Diagnostic Steps:**

1. Check configuration file:
```bash
cat /opt/messaging-app/.env
```

2. Check for syntax errors:
```bash
# Look for missing values, typos
grep -E "^[A-Z_]+=\s*$" /opt/messaging-app/.env
```

3. Check logs for specific error:
```bash
sudo journalctl -u messaging-app -n 50 | grep -i "config\|error"
```

**Solutions:**

**Solution 1: Validate configuration**
```bash
# Check required variables are set
required_vars="QUIC_ENABLED QUIC_PORT QUIC_CERT_PATH QUIC_KEY_PATH DATABASE_URL"
for var in $required_vars; do
  if ! grep -q "^${var}=" /opt/messaging-app/.env; then
    echo "Missing: $var"
  fi
done
```

**Solution 2: Use example configuration**
```bash
# Copy example configuration
cp /opt/messaging-app/.env.example /opt/messaging-app/.env

# Edit with your values
sudo nano /opt/messaging-app/.env
```

**Solution 3: Fix common errors**
```bash
# Ensure no trailing spaces
sed -i 's/[[:space:]]*$//' /opt/messaging-app/.env

# Ensure no quotes around values (unless needed)
# QUIC_PORT=4433  # Correct
# QUIC_PORT="4433"  # May cause issues
```

### Issue: Port Already in Use

**Symptoms:**
- Service fails to start
- Logs show: "Address already in use"
- Port 4433 is occupied

**Diagnostic Steps:**

1. Check what's using the port:
```bash
sudo netstat -ulnp | grep 4433
# or
sudo lsof -i UDP:4433
```

**Solutions:**

**Solution 1: Stop conflicting service**
```bash
# Identify the process
sudo lsof -i UDP:4433

# Stop it
sudo kill <PID>

# Or stop the service
sudo systemctl stop <service-name>
```

**Solution 2: Use different port**
```bash
# Edit .env
QUIC_PORT=4434  # Use different port

# Update firewall
sudo ufw allow 4434/udp

# Update frontend configuration
# VITE_QUIC_URL=https://your-domain.com:4434

# Restart service
sudo systemctl restart messaging-app
```

## Network Problems

### Issue: UDP Packets Being Dropped

**Symptoms:**
- High packet loss
- Intermittent connection issues
- Metrics show low throughput

**Diagnostic Steps:**

1. Check packet loss:
```bash
# Monitor UDP statistics
netstat -su | grep -i "packet receive errors\|buffer errors"
```

2. Check firewall logs:
```bash
sudo tail -f /var/log/ufw.log | grep 4433
```

**Solutions:**

**Solution 1: Increase UDP buffer sizes**
```bash
# Edit /etc/sysctl.conf
sudo nano /etc/sysctl.conf

# Add:
net.core.rmem_default=26214400
net.core.rmem_max=26214400
net.core.wmem_default=26214400
net.core.wmem_max=26214400
net.core.netdev_max_backlog=5000

# Apply
sudo sysctl -p
```

**Solution 2: Check for rate limiting**
```bash
# Check iptables rules
sudo iptables -L -n -v | grep 4433

# Remove rate limiting if present
sudo iptables -D INPUT -p udp --dport 4433 -m limit --limit 100/s -j ACCEPT
```

**Solution 3: Optimize network interface**
```bash
# Increase ring buffer size
sudo ethtool -G eth0 rx 4096 tx 4096

# Enable hardware offloading
sudo ethtool -K eth0 gso on gro on tso on
```

### Issue: QUIC Blocked by ISP/Firewall

**Symptoms:**
- QUIC works on some networks but not others
- Corporate networks can't connect via QUIC
- All connections fall back to WebSocket

**Diagnostic Steps:**

1. Test from different networks
2. Check if UDP is blocked:
```bash
# From client machine
nc -u -v -w 3 your-domain.com 4433
```

**Solutions:**

**Solution 1: Document network requirements**
- Provide network requirements to users
- Explain UDP port 4433 must be open
- Provide instructions for IT departments

**Solution 2: Ensure fallback works**
```bash
# Verify WebSocket fallback is enabled
grep FALLBACK .env.production
```

**Solution 3: Consider alternative ports**
```bash
# Try port 443 (less likely to be blocked)
QUIC_PORT=443

# Note: May require running as root or using capabilities
sudo setcap 'cap_net_bind_service=+ep' /opt/messaging-app/messaging-app
```

## Debugging Tools

### Enable Debug Logging

```bash
# Edit systemd service
sudo systemctl edit messaging-app

# Add:
[Service]
Environment="RUST_LOG=debug"

# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart messaging-app

# View debug logs
sudo journalctl -u messaging-app -f
```

### Packet Capture

```bash
# Capture QUIC traffic
sudo tcpdump -i any -w quic-capture.pcap udp port 4433

# Analyze with Wireshark
wireshark quic-capture.pcap
```

### Performance Profiling

```bash
# CPU profiling
cargo flamegraph --bin messaging-app

# Memory profiling
valgrind --tool=massif ./target/release/messaging-app

# Analyze massif output
ms_print massif.out.<pid>
```

### Load Testing

```bash
# Install k6
sudo apt-get install k6

# Run load test
k6 run load-test.js

# Monitor during test
watch -n 1 'curl -s https://your-domain.com/api/metrics/quic | jq'
```

## Rollback Procedures

### Emergency Rollback (Disable QUIC)

If QUIC is causing critical issues:

```bash
# 1. Disable QUIC immediately
sudo sed -i 's/QUIC_ENABLED=true/QUIC_ENABLED=false/' /opt/messaging-app/.env

# 2. Restart service
sudo systemctl restart messaging-app

# 3. Verify WebSocket is working
curl https://your-domain.com/api/health

# 4. Monitor for stability
sudo journalctl -u messaging-app -f
```

### Rollback to Previous Version

If the current version has issues:

```bash
# 1. Stop service
sudo systemctl stop messaging-app

# 2. Restore backup
sudo cp /opt/messaging-app/messaging-app.backup /opt/messaging-app/messaging-app
sudo cp /opt/messaging-app/.env.backup /opt/messaging-app/.env

# 3. Restore database if needed
sudo -u postgres psql messaging_db < backup.sql

# 4. Start service
sudo systemctl start messaging-app

# 5. Verify
sudo systemctl status messaging-app
curl https://your-domain.com/api/health
```

### Gradual Rollback

For controlled rollback:

```bash
# 1. Reduce QUIC traffic gradually
# Edit .env to limit QUIC connections
QUIC_MAX_CONNECTIONS=1000  # Reduce from 10000

# 2. Restart
sudo systemctl restart messaging-app

# 3. Monitor metrics
watch -n 5 'curl -s https://your-domain.com/api/metrics/quic | jq ".active_connections"'

# 4. Continue reducing until stable
# Then disable completely if needed
```

## Getting Help

### Collect Diagnostic Information

Before requesting support, collect:

```bash
# 1. System information
uname -a > diagnostics.txt
cat /etc/os-release >> diagnostics.txt

# 2. Service status
systemctl status messaging-app >> diagnostics.txt

# 3. Recent logs
sudo journalctl -u messaging-app -n 500 --no-pager >> diagnostics.txt

# 4. Configuration (redact secrets!)
grep -v "SECRET\|PASSWORD" /opt/messaging-app/.env >> diagnostics.txt

# 5. Metrics
curl https://your-domain.com/api/metrics/quic >> diagnostics.txt

# 6. Network information
netstat -ulnp | grep 4433 >> diagnostics.txt
```

### Support Channels

- GitHub Issues: Report bugs with diagnostic information
- Documentation: Check latest documentation for updates
- Community Forum: Ask questions and share solutions

## Preventive Measures

### Regular Maintenance

```bash
# Weekly tasks
- Review logs for errors
- Check certificate expiration
- Monitor metrics trends
- Update dependencies

# Monthly tasks
- Review and optimize configuration
- Analyze performance trends
- Update documentation
- Test disaster recovery procedures
```

### Monitoring Alerts

Set up alerts for:
- Certificate expiration (30 days before)
- High error rates (> 5% failure rate)
- High latency (p95 > 200ms)
- Low throughput (< expected baseline)
- Service downtime

### Backup Strategy

```bash
# Daily backups
0 2 * * * /opt/scripts/backup-config.sh
0 3 * * * /opt/scripts/backup-database.sh

# Weekly full backups
0 4 * * 0 /opt/scripts/full-backup.sh
```

## Conclusion

This troubleshooting guide covers the most common issues encountered with QUIC transport. For issues not covered here:

1. Check the deployment guide for configuration details
2. Review application logs for specific error messages
3. Consult the API documentation for endpoint details
4. Contact support with diagnostic information

Remember: When in doubt, you can always disable QUIC and fall back to WebSocket while investigating issues.
