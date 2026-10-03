import { Router, Request, Response } from 'express';

const router = Router();

export const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Decko Africa - Field Materials Management API',
    version: '1.0.0',
    description: 'RESTful API for digitizing Decko Africa field-team material requests, approvals, accounting payments, store issuance, QR/barcode scanning, team stock, consumption, and immutable audit logs.',
    contact: {
      name: 'Decko Africa IT Engineering',
      url: 'https://deckoafrica.com',
      email: 'it-support@deckoafrica.com'
    }
  },
  servers: [{ url: '/api/v1', description: 'Current Server Environment' }],
  paths: {
    '/projects/{id}': {
      delete: {
        summary: 'Delete a client project when it has no teams, staff assignments, or request history',
        tags: ['Projects'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Project deleted successfully' },
          404: { description: 'Project not found' },
          409: { description: 'Project still has linked records and cannot be deleted' }
        }
      }
    },
    '/auth/login': {
      post: {
        summary: 'Authenticate employee with email and password',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', example: 'leader@deckoafrica.com' },
                  password: { type: 'string', example: 'Decko2026!' }
                },
                required: ['email', 'password']
              }
            }
          }
        },
        responses: {
          200: { description: 'JWT authentication token and user profile returned' },
          401: { description: 'Invalid credentials or inactive account' }
        }
      }
    },
    '/material-requests': {
      get: {
        summary: 'List material requests with status, project, team, and priority filters',
        tags: ['Material Requests'],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'teamId', in: 'query', schema: { type: 'string' } },
          { name: 'projectId', in: 'query', schema: { type: 'string' } },
          { name: 'priority', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } }
        ],
        responses: { 200: { description: 'List of material requests' } }
      },
      post: {
        summary: 'Create a new material request (or save draft)',
        tags: ['Material Requests'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  teamId: { type: 'string' },
                  projectId: { type: 'string' },
                  siteName: { type: 'string' },
                  requiredDate: { type: 'string', format: 'date' },
                  priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
                  reason: { type: 'string' },
                  workOrderRef: { type: 'string' },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        materialId: { type: 'string' },
                        quantityRequested: { type: 'number' },
                        unit: { type: 'string' },
                        reason: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'Request created and request number issued' } }
      }
    },
    '/material-requests/{id}/approve': {
      post: {
        summary: 'Dispatcher/Project Manager approves material request',
        tags: ['Approvals'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Request approved and routed to accounting queue' } }
      }
    },
    '/material-requests/{id}/payment': {
      post: {
        summary: 'Accountant confirms payment or purchase allocation',
        tags: ['Payments'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Payment recorded and request marked READY_FOR_ISSUE' } }
      }
    },
    '/material-requests/{id}/issue': {
      post: {
        summary: 'Store officer issues materials, validates serials, updates ledger and team stock',
        tags: ['Material Issuance'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Materials issued and ledger updated atomically' } }
      }
    },
    '/materials': {
      get: {
        summary: 'Retrieve all catalog materials and stock balances',
        tags: ['Materials'],
        responses: { 200: { description: 'Material master list' } }
      }
    },
    '/inventory/transactions': {
      get: {
        summary: 'Retrieve complete immutable inventory ledger movements',
        tags: ['Inventory'],
        responses: { 200: { description: 'Transaction history' } }
      }
    },
    '/reports/summary': {
      get: {
        summary: 'Get executive dashboard statistics and SLA health',
        tags: ['Reports'],
        responses: { 200: { description: 'Management KPIs and summaries' } }
      }
    },
    '/audit-logs': {
      get: {
        summary: 'Search immutable audit events',
        tags: ['Audit'],
        responses: { 200: { description: 'Audit trail records' } }
      }
    }
  }
};

router.get('/spec.json', (_req: Request, res: Response) => {
  res.json(openApiSpec);
});

router.get('/', (_req: Request, res: Response) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Decko Materials API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <style>
    body { margin: 0; background: #fafafa; }
    .topbar { display: none; }
    .swagger-ui .info .title { color: #0B2545; }
    .header-bar {
      background: #0B2545;
      color: white;
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-family: -apple-system, sans-serif;
    }
    .header-bar a { color: #38bdf8; text-decoration: none; font-size: 14px; }
  </style>
</head>
<body>
  <div class="header-bar">
    <div>
      <strong style="font-size: 18px; letter-spacing: 0.5px;">DECKO AFRICA</strong> &nbsp;|&nbsp; Field Materials Management API
    </div>
    <div>
      <a href="/">← Return to Application</a>
    </div>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: "/api/docs/spec.json",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>
  `);
});

export default router;
