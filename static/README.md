# SignalForge Pay

**AI Revenue Decision Agent — PayPal AI Hackathon 2026**

An evidence-first financial insights prototype for small businesses. Analyze payment trends, refunds, reversals and fees; identify unusual periods; request an AI revenue brief with three prioritized investigation steps.

- [Live demo](https://signalforge-pay.floot.app)
- [Source](https://github.com/daryas2226-rgb/signalforge-pay)
- [Devpost project](https://devpost.com/software/signalforge-pay)

## Verified status — 6 November 2026

- The public synthetic-data demo and browser-only PayPal-format JSON import are available. Both are visibly labeled; imported reports have unverified provenance.
- Existing PayPal Sandbox credentials are connected securely. A real owner-only check successfully authenticated with PayPal but still received `PAYPAL_REPORTING_SCOPE_MISSING` after attempting the stale-token refresh flow. The current app token lacks `https://uri.paypal.com/services/reporting/search/read`. **Real Sandbox transaction synchronization is not verified and no returned transaction data is claimed.**
- The prototype remains usable with synthetic data and JSON imports while the matching Sandbox REST app's Transaction Search permission is resolved. API permission is controlled by PayPal, not by changing dashboard calculations.
- Sandbox reporting uses a private server-side sync passcode. No Live PayPal endpoint, real charge, capture, refund or money movement is used.
- AI requests have a durable shared PostgreSQL hourly budget. Incomplete model output is rejected; no fabricated fallback brief is shown.
- Four targeted Jasmine spec files passed and Floot TypeScript checks passed before publication.

## Stack and source

React, TypeScript, Floot hosting/serverless endpoints, Floot AI (`gpt-6-luna`), PayPal Sandbox OAuth 2.0 and Transaction Search, Zod, SuperJSON, PostgreSQL/Kysely.

```text
components/                          UI kit and global context providers
pages/_index.tsx                     Dashboard, source labels and JSON upload
endpoints/paypal-sync_POST.ts        Public endpoint adapter, no-store responses
helpers/paypalSyncService.tsx        Shared private Sandbox sync + token refresh
helpers/flootAppExports.tsx          Editor-owner-only operational verification
endpoints/revenue-brief_POST.ts      AI request budget and validated brief
endpoints/*.schema.ts                Validated inputs and typed client calls
helpers/validateRevenueBrief.tsx     Strict AI response schema
helpers/paypalFinancialEvents.tsx    Conservative merchant T-code classification
helpers/parsePayPalReport.tsx        Client-only report import
helpers/*.spec.tsx                   Jasmine regression tests
helpers/db.tsx, helpers/schema.tsx   Floot database wiring and schema
static/sample-sandbox-report.json    Clearly synthetic test transactions
static/__dev/                       Original working notes and editor dependencies
```

The old `github-export` page containing an outdated duplicate source snapshot has been removed. The repository is the source location. Files under `static/__dev/` are historical/editor working notes, not assertions that a submission is complete.

## Run and test

This application runs in the **Floot managed environment**, which provides routing, `@floot/ai`, `@floot/apps`, database wiring and secure resources. The source export does not claim a standalone npm server.

1. Import the source folders and `base.css` into a compatible Floot project; use `static/__dev/dependencies.json` for the dependency map.
2. Provision the managed PostgreSQL resource and create the budget table below.
3. Keep the environment variables server-side, using Floot's secure resource configuration.
4. Run the four targeted specs and TypeScript check, then publish.
5. Open the public app. Generate a Revenue Recovery Brief from the labeled synthetic data.
6. Download `/sample-sandbox-report.json`, import it and inspect the changed metrics.
7. For private reporting, enable Transaction Search on the **same Sandbox REST app** as the stored credentials, then use the owner passcode. PayPal reporting can be delayed; an empty successful report is not evidence of transaction activity.

Targeted Jasmine specs: `helpers/paypalSyncFlow.spec.tsx`, `helpers/parsePayPalReport.spec.tsx`, `helpers/paypalFinancialEvents.spec.tsx`, `helpers/validateRevenueBrief.spec.tsx`. They cover wrong-passcode rejection, stale OAuth refresh, persistent missing permissions, error privacy, restricted diagnostic access, classification/import behavior and malformed AI output. Network calls in tests are mocked; live checks are reported separately.

### Server configuration

- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`: **Sandbox** REST app credentials.
- `SIGNALFORGE_SYNC_PASSCODE`: a long private owner-only password for reporting.
- `FLOOT_DATABASE_URL`: managed database URL.
- Floot AI is supplied by the environment.

The empty `.env.example` documents names only. Never commit real values or use Live credentials.

```sql
CREATE TABLE IF NOT EXISTS ai_request_budgets (
  scope text NOT NULL,
  bucket bigint NOT NULL,
  used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, bucket)
);
```

### Private operational check

The published `verifySandboxSync({days:30})` function is callable through Floot's authenticated owner/editor MCP facility only. It refuses other apps and non-owner callers, uses the existing passcode-protected service, and returns only environment, status/error code and counts. It never returns tokens, passwords, records or amounts. There is no public diagnostic HTTP endpoint.

## Methodology, privacy and limits

The demo is synthetic and is not real merchant performance. Financial metrics are estimates, not accounting statements. Transaction Search balance-affecting records do not cover complete checkout failures, so imported/Sandbox data is never presented as a measured checkout failure rate. Event classification uses PayPal T-codes; refunds and reversals remain separate from gross sales. Mixed currencies are rejected. Cash-flow holds, detailed dispute workflows and other accounting events are outside current scope.

Raw imported transaction rows are parsed in browser memory. Only derived signals go to the AI endpoint after the user requests a brief. The public demo has no per-user persistence or account system; do not upload confidential customer reports. The AI provides hypotheses and reversible next steps, not established causes or calibrated probabilities. Forecasts are simple recent-slope extrapolations.

Official references: [Transaction Search](https://developer.paypal.com/docs/api/transaction-search/v1/), [OAuth](https://developer.paypal.com/reference/get-an-access-token/), [T-codes](https://developer.paypal.com/reports/reference/t-codes/).

## Attribution and license

An earlier SignalForge AI concept predated this project. SignalForge Pay is the distinct PayPal-specific version built during the 2026 event, adding reporting, payment metrics, a revenue brief, data-source labeling and safety controls. AI tools assisted with implementation and tests.

MIT — see [LICENSE](LICENSE). Third-party components retain their respective licenses.
