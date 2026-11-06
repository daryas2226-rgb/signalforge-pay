# SignalForge Pay — Devpost final submission answers (draft)
Prepared November 3, 2026. **Do not submit without a public YouTube demo video and eligibility confirmation.**
This draft does not contain passwords, keys, or personal PayPal financial data.

## Required submission fields
- 28778 Submitter Type: Individual
- 28779 Country: Kazakhstan
- 28780 Canada province: N/A
- 28781 Organization name: N/A
- 28782 New or Existing: New (the **specific PayPal app** started October 10, 2026; earlier SignalForge AI was a broader concept only). Confirm that none of its code was copied from a pre-Oct-1 application before answering.
- 28783 If existed before: N/A (assuming New)
- 28784 How project meets PayPal + AI requirement:
  SignalForge Pay integrates PayPal Sandbox OAuth 2.0 and the PayPal Transaction Search REST API through a restricted server-side endpoint. The private sync endpoint validates the owner's passcode, requests a Sandbox OAuth token, checks for the reporting/search/read permission, safely refreshes a stale cached token once if necessary, queries bounded transaction-history pages, conservatively maps PayPal event codes to sales/refunds/chargebacks, and computes aggregated business metrics. Separately, Floot's AI service generates an evidence-first revenue brief from metrics and anomalies, identifies uncertainty, and prioritizes three next actions. The live public demo uses explicitly labeled synthetic financial transactions, and its PayPal-format importer runs locally in the browser. As of November 3, Sandbox transaction retrieval has not been confirmed working end-to-end due to reporting-scope access; this limitation is intentionally disclosed.
- 28786 Additional sponsor tools: None, used other AI tools. (Only if no named sponsor tools actually used.)
- 28788 Public source: https://github.com/daryas2226-rgb/signalforge-pay
- 28787 Working live demo: https://signalforge-pay.floot.app
- 28798 Testing instructions (optional):
  Open https://signalforge-pay.floot.app. No login is needed to explore the synthetic dashboard. Review revenue/refund/fee KPIs and charts; click Generate AI Brief and inspect the recommended next actions. Download the labeled sample Sandbox-format JSON report, then import it using the file picker to test classification and recalculation. The merchant-only Sandbox sync requires a private owner passcode and is not part of the public judging flow; it currently lacks confirmed reporting API access. Never share the owner passcode publicly.
- 28790 PayPal integration experience rating: **PERSONAL ANSWER REQUIRED**, 1–10.
- 28791 Experience explanation:
  Implementing Sandbox OAuth was straightforward, but the Transaction Search permission remained absent from the issued token even after enabling the app feature. Better diagnostics and faster grant propagation would improve the developer experience. The incident reinforced the need to test authorization scopes independently of successful authentication. (Confirm if this reflects your experience.)
- 28792 Contact for feedback: **PERSONAL CHOICE REQUIRED**, Yes or No.
- 28794 Age: 20 (confirm at submission time).
- 28795 Eligible Jurisdiction: Kazakhstan (confirm eligibility statement against official rules).
- 28796 Employee: **PERSONAL DECLARATION REQUIRED** (PayPal/organizer affiliate status).
- 29053 AI tools used: Floot AI service, the model powering the app's revenue briefs; ChatGPT for development assistance. Confirm the exact model designation before submission.
- 29054 Level of learning: **PERSONAL CHOICE REQUIRED**, Moderate or Significant.
- 29055 Did you gain career-useful AI value: **PERSONAL CHOICE REQUIRED**, Yes or No.

## Required remaining deliverable
- A public YouTube video **less than 3 minutes** showing the working app, finance dashboard, Generate AI Brief output and safe JSON demo. Do not show real credentials.
- Add the video URL to the project, then submit and verify **Submitted** status.

## Accuracy and security
Do not assert successful PayPal transaction sync until independently observed. Never include live PayPal credentials, private sync passcode, OAuth access tokens, or actual customer data.
