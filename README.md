# SignalForge Pay

**AI Revenue Decision Agent — PayPal AI Hackathon 2026**

An evidence-first financial insights prototype for small businesses. Analyze payment trends, refunds, reversals and charges; identify unusual periods; request an AI-powered revenue brief with three prioritized investigation steps.

Live demo: https://signalforge-pay.floot.app

## Current status (October 2026)

- Public **synthetic-data demo** works. Floot AI generates an explanation and suggested actions from computed metrics.
- Client-only JSON import accepts PayPal Transaction Search-shaped data and recalculates metrics without Sandbox access. A clearly synthetic sample report is offered on the site.
- PayPal Sandbox OAuth and Transaction Search integration is written. **End-to-end synchronization of real Sandbox test transactions is not yet verified.** The owner still needs to connect Sandbox credentials.
- No real money or live PayPal credentials are involved. Sandbox payment data is protected behind a server-side owner-only sync passcode.
- AI requests use a shared PostgreSQL hourly budget limit to minimize unexpected Floot AI credit consumption.

## Stack

- React + TypeScript
- Floot hosting and serverless API endpoints
- Floot AI (GPT-6 Luna)
- PayPal Sandbox: OAuth 2.0 client credentials and Transaction Search API
- Zod validation and SuperJSON transport
- Floot-managed PostgreSQL for request budgets

## Key modules

- `pages/_index.tsx` — public dashboard and clearly marked demo dataset
- `endpoints/paypal-sync_POST.ts` — private PayPal Sandbox reporting sync
- `endpoints/revenue-brief_POST.ts` — structured AI analysis with rate limits
- `endpoints/*.schema.ts` — request validation and typed client APIs
- `helpers/db.tsx`, `helpers/schema.tsx` — Floot-generated database connection and schema
- `helpers/paypalFinancialEvents.tsx` and `helpers/paypalFinancialEvents.spec.tsx` — isolated merchant T-code logic and Jasmine regression tests for sales, refunds, chargebacks, holds, payouts and invalid amounts
- `helpers/parsePayPalReport.tsx` and `helpers/parsePayPalReport.spec.tsx` — browser-only import logic and validation tests
- `static/sample-sandbox-report.json` — synthetic test transactions

## Configuration

Server-side only:

- `PAYPAL_CLIENT_ID`: PayPal Developer **Sandbox** REST app client ID.
- `PAYPAL_CLIENT_SECRET`: Sandbox secret.
- `SIGNALFORGE_SYNC_PASSCODE`: long private owner-only passcode to request PayPal reporting data.
- `FLOOT_DATABASE_URL`: provisioned by Floot for request budget persistence.
- Floot AI is configured by the Floot environment.

Do **not** commit these secret values or use Live PayPal credentials.

## Run and test

The current source runs in the **Floot** managed app environment, which provides its serverless endpoint routing, database wiring, AI SDK and environment variables. To reproduce:

1. Import or recreate all project source files into a compatible Floot project.
2. Provision a Floot-managed database and migrate the `ai_request_budgets` table (see below).
3. Publish to a Floot subdomain to run the public demo.
4. Generate a Revenue Recovery Brief with the labeled synthetic data.
5. Download `/sample-sandbox-report.json` and upload it into the importer to verify calculations on transaction records.
6. To test private merchant sync, connect Sandbox app keys and a unique passcode through secure environment configuration.
7. Generate Sandbox transactions in the matching merchant account, allow for PayPal reporting delays, and attempt sync.

### DB migration

```sql
CREATE TABLE IF NOT EXISTS ai_request_budgets (
  scope text NOT NULL,
  bucket bigint NOT NULL,
  used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, bucket)
);
```

## Data methodology and limitations

The demo is synthetic and must never be represented as real merchant performance. Financial metrics are estimates, not accounting statements. PayPal Transaction Search **balance-affecting** records don't provide complete checkout failure attempts; no real failure rate is inferred from them. Event classifications use PayPal T-codes; merchant refunds and reversals are tracked separately from purchase income, and mixed currency reports are rejected rather than summed. Cash-flow holds, detailed disputes, and other accounting events are outside this prototype's current coverage. AI suggestions are hypotheses to validate, not financial advice.

Documentation: https://developer.paypal.com/reports/reference/t-codes/

## License

MIT license. See LICENSE at the root. No secrets are included.

## Attribution and chronology

Earlier SignalForge AI concept existed before October 2026. SignalForge Pay was built as a distinct PayPal-specific demo during the 2026 hackathon, adding the reporting connector, payment dashboard, AI revenue brief, source labeling, data safety controls and test-focused interaction.
