# Outreach Agents — VPS Deployment

## Files to copy to VPS

Copy these 3 files to `/home/api-server/agents/` on 72.60.120.245:

```
agents/outreach-email.js     → /home/api-server/agents/outreach-email.js
agents/outreach-callprep.js  → /home/api-server/agents/outreach-callprep.js
agents/outreach-audit.js     → /home/api-server/agents/outreach-audit.js
```

## Add to server.js

Add these lines to `/home/api-server/server.js` (after existing route registrations):

```javascript
// Outreach agents
const outreachEmail = require('./agents/outreach-email.js');
app.get('/agent/outreach-email/health', outreachEmail.healthCheck);
app.post('/agent/outreach-email', outreachEmail.verifyKey, outreachEmail.handler);

const outreachCallprep = require('./agents/outreach-callprep.js');
app.get('/agent/outreach-callprep/health', outreachCallprep.healthCheck);
app.post('/agent/outreach-callprep', outreachCallprep.verifyKey, outreachCallprep.handler);

const outreachAudit = require('./agents/outreach-audit.js');
app.get('/agent/outreach-audit/health', outreachAudit.healthCheck);
app.post('/agent/outreach-audit', outreachAudit.verifyKey, outreachAudit.handler);
```

## Deploy

```bash
pm2 restart all
```

## Test

```bash
# Health checks
curl http://localhost:3000/agent/outreach-email/health
curl http://localhost:3000/agent/outreach-callprep/health
curl http://localhost:3000/agent/outreach-audit/health

# Generate email
curl -X POST http://localhost:3000/agent/outreach-email \
  -H "Content-Type: application/json" \
  -H "x-api-key: armadillo-agent-2026" \
  -d '{"lead":{"biz_name":"Test Plumbing","industry":"plumber","contact":"John"}}'

# Call prep
curl -X POST http://localhost:3000/agent/outreach-callprep \
  -H "Content-Type: application/json" \
  -H "x-api-key: armadillo-agent-2026" \
  -d '{"lead":{"biz_name":"Test Plumbing","industry":"plumber","contact":"John"}}'

# Site audit
curl -X POST http://localhost:3000/agent/outreach-audit \
  -H "Content-Type: application/json" \
  -H "x-api-key: armadillo-agent-2026" \
  -d '{"url":"example.com"}'
```
