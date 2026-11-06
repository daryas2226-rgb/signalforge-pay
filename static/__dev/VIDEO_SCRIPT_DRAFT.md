# SignalForge Pay — ~2:40 demo video plan (draft, not recorded)

**Important:** show the *actual* working app. Do not state PayPal Sandbox integration was tested until an authentic merchant sync succeeds. Judges require a public YouTube video under 3 minutes and a public repository with a license.

## 0:00–0:20 · The problem
“Payment data tells a business owner what happened. But what should they investigate or change tomorrow? SignalForge Pay turns payment signals into an evidence-backed action plan.”

## 0:20–0:45 · Transparency
Open the public homepage at https://signalforge-pay.floot.app . Show the yellow “Demo dataset active” label. Explain that sample values are synthetic, there is no card payment or personal financial data.

## 0:45–1:15 · Financial signals
Move through gross and net revenue, refund/reversal pressure, transaction counts, the gross revenue bar chart and a simple next-period projection. State forecasting limitations and that chargeback event counts are not the same as all disputes.

## 1:15–1:50 · AI analysis
Click **Generate AI brief**. Show actual generated text, separating observed figures, hypotheses, future outlook, risks and the three ranked next actions. Explain that advice is reversible and should be validated.

## 1:50–2:15 · PayPal-format report import and API integration
Download and import the explicitly synthetic JSON report. Show the metrics changing, and stress that no raw transaction rows leave the browser. Imported data is NOT verified authentic PayPal API data.
Only if fully verified by then: switch to the **private Sandbox sync**, enter the owner-only passcode privately (not visible on recording), sync test transactions and show source changing to PayPal Sandbox. Redact merchant/account information.
If not verified: show the code architecture, but clearly disclose that actual Sandbox sync is unfinished; do not falsely claim a completed integration.

## 2:15–2:40 · Implementation and roadmap
Highlight server-side PayPal OAuth, event classification, shared AI budgets and public code repository. End with what's actually working, the known limits, and the next test.

## Mandatory before recording

- Verify real PayPal Sandbox sync end to end.
- Create a public GitHub/GitLab repo containing the full source, a visible OSI-approved license, and setup instructions.
- Capture smooth screen recording, remove passwords/private fields, publish unlisted/public on YouTube per the official rules (public visibility if mandated).
- Insert the actual links on Devpost, submit, and check for an official confirmation.