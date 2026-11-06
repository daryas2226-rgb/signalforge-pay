import React, { useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import {
  Activity, ArrowRight, BadgeDollarSign, BrainCircuit, CircleDollarSign,
  CreditCard, RefreshCcw, ShieldCheck, Sparkles, TrendingDown, TrendingUp,
  TriangleAlert, Upload, WalletCards
} from "lucide-react";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Input } from "../components/Input";
import { FileDropzone } from "../components/FileDropzone";
import { parsePayPalReport } from "../helpers/parsePayPalReport";
import { postPaypalSync, type Period } from "../endpoints/paypal-sync_POST.schema";
import { postRevenueBrief, type OutputType as RevenueBrief } from "../endpoints/revenue-brief_POST.schema";
import styles from "./_index.module.css";

const DEMO: Period[] = [
  { label: "Sep 01", gross: 8240, refunds: 210, fees: 282, transactions: 112, failed: 5, disputes: 1 },
  { label: "Sep 08", gross: 8870, refunds: 180, fees: 303, transactions: 119, failed: 4, disputes: 0 },
  { label: "Sep 15", gross: 9310, refunds: 245, fees: 318, transactions: 125, failed: 6, disputes: 1 },
  { label: "Sep 22", gross: 9680, refunds: 265, fees: 331, transactions: 130, failed: 5, disputes: 1 },
  { label: "Sep 29", gross: 10420, refunds: 290, fees: 356, transactions: 139, failed: 7, disputes: 1 },
  { label: "Oct 06", gross: 10980, refunds: 315, fees: 375, transactions: 145, failed: 6, disputes: 2 },
  { label: "Oct 13", gross: 7820, refunds: 760, fees: 282, transactions: 111, failed: 17, disputes: 4 },
  { label: "Oct 20", gross: 11360, refunds: 340, fees: 389, transactions: 149, failed: 7, disputes: 1 },
];

const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / Math.max(a.length, 1);
const slope = (a: number[]) => {
  const xm = (a.length - 1) / 2;
  const ym = mean(a);
  let numerator = 0;
  let denominator = 0;
  a.forEach((y, i) => {
    numerator += (i - xm) * (y - ym);
    denominator += (i - xm) ** 2;
  });
  return numerator / (denominator || 1);
};
const sd = (a: number[]) => {
  const m = mean(a);
  return Math.sqrt(mean(a.map(v => (v - m) ** 2))) || 1;
};
const money = (n: number, currency: string) => new Intl.NumberFormat("en-US", {
  style: "currency", currency, maximumFractionDigits: 0,
}).format(n);
const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

export default function Home() {
  const [periods, setPeriods] = useState<Period[]>(DEMO);
  const [source, setSource] = useState<"demo" | "paypal-sandbox" | "imported-file">("demo");
  const [currency, setCurrency] = useState("USD");
  const [syncing, setSyncing] = useState(false);
  const [syncTransactionCount, setSyncTransactionCount] = useState<number | null>(null);
  const [syncPasscode, setSyncPasscode] = useState("");
  const [syncError, setSyncError] = useState("");
  const [importError, setImportError] = useState("");
  const [importCount, setImportCount] = useState(0);
  const [brief, setBrief] = useState<RevenueBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState("");

  const analysis = useMemo(() => {
    const safe = periods.length >= 2 ? periods : DEMO;
    const gross = safe.map(x => x.gross);
    const latest = safe.at(-1)!;
    const previous = safe.at(-2)!;
    const net = latest.gross - latest.refunds - latest.fees;
    const refundRate = latest.gross > 0 ? (latest.refunds / latest.gross) * 100 : 0;
    const denominator = latest.transactions + latest.failed;
    const failureRate = denominator > 0 ? (latest.failed / denominator) * 100 : 0;
    const aov = latest.transactions > 0 ? latest.gross / latest.transactions : 0;
    const trendPct = mean(gross) !== 0 ? (slope(gross) / mean(gross)) * 100 : 0;
    const next = Math.max(0, latest.gross + slope(gross.slice(-4)));
    const grossMean = mean(gross);
    const grossSd = sd(gross);
    const anomalies = safe
      .map((x, i) => ({ ...x, z: Math.abs((x.gross - grossMean) / grossSd), index: i }))
      .filter(x => x.z > 1.5);
    return {
      latest, previous, net, refundRate, failureRate, aov, trendPct, next, anomalies,
      changeVsPrev: previous.gross !== 0 ? ((latest.gross - previous.gross) / previous.gross) * 100 : 0,
    };
  }, [periods]);

  const chartMax = Math.max(1, ...periods.map(p => p.gross));

  async function syncPayPal() {
    setSyncing(true);
    setSyncError("");
    setBrief(null);
    try {
      const result = await postPaypalSync({ days: 30, syncPasscode });
      if (result.periods.length < 2) throw new Error("PayPal returned incomplete period data.");
      setPeriods(result.periods);
      setCurrency(result.currency || "USD");
      setSyncTransactionCount(result.transactionCount);
      setSource("paypal-sandbox");
      setImportError("");
    } catch (e) {
      setSource("demo");
      setSyncTransactionCount(null);
      setPeriods(DEMO);
      setCurrency("USD");
      setSyncError(e instanceof Error ? e.message : "Could not sync PayPal Sandbox.");
    } finally {
      setSyncing(false);
    }
  }

  function useDemoData() {
    setPeriods(DEMO);
    setCurrency("USD");
    setSource("demo");
    setSyncTransactionCount(null);
    setBrief(null);
    setBriefError("");
    setSyncError("");
    setImportError("");
    setImportCount(0);
  }

  async function importReport(files: File[]) {
    setImportError("");
    const file = files[0];
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error("JSON exceeds the 2 MB limit.");
      const report = parsePayPalReport(await file.text());
      setPeriods(report.periods);
      setCurrency(report.currency);
      setSource("imported-file");
      setImportCount(report.transactionCount);
      setSyncTransactionCount(null);
      setBrief(null);
      setBriefError("");
      setSyncError("");
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Unable to import this report.");
    }
  }

  async function generateBrief() {
    setBriefLoading(true);
    setBrief(null);
    setBriefError("");
    try {
      const anomalySummary = analysis.anomalies.length
        ? analysis.anomalies.map(a => `${a.label}: gross ${money(a.gross, currency)}, refunds/reversals ${money(a.refunds, currency)}, chargebacks ${a.disputes}`).join("; ")
        : "No material gross-revenue anomalies above the configured threshold.";
      const result = await postRevenueBrief({
        source,
        currency,
        latestGross: analysis.latest.gross,
        netRevenue: analysis.net,
        changeVsPrevPct: analysis.changeVsPrev,
        trendPct: analysis.trendPct,
        forecast: analysis.next,
        refundRatePct: analysis.refundRate,
        failureRatePct: analysis.failureRate,
        completedPayments: analysis.latest.transactions,
        failedPayments: analysis.latest.failed,
        disputes: analysis.latest.disputes,
        anomalySummary,
      });
      setBrief(result);
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code !== "OUT_OF_CREDITS") {
        setBriefError(err.message || "Could not generate AI brief.");
      }
    } finally {
      setBriefLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <Helmet>
        <title>SignalForge Pay — AI Revenue Decision Agent</title>
        <meta name="description" content="Turn PayPal payment signals into revenue forecasts, risk signals and next-best actions." />
      </Helmet>

      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.mark}>SF</div>
          <div><strong>SignalForge Pay</strong><span>Revenue decision agent</span></div>
        </div>
        <div className={styles.headerBadges}>
          <Badge variant="outline">PayPal Sandbox</Badge>
          <Badge variant="outline">AI Decision Intelligence</Badge>
        </div>
      </header>

      <section className={styles.hero}>
        <div>
          <div className={styles.eyebrow}><Sparkles size={14}/> PayPal AI Hackathon 2026</div>
          <h1>Know where revenue is leaking — and what to do next.</h1>
          <p>
            SignalForge Pay converts payment activity into an evidence-backed operating brief for small businesses:
            revenue movement, refund pressure, failed-payment risk, forecast and three prioritized actions.
          </p>
        </div>
        <div className={styles.flow}>
          <div><WalletCards size={17}/><span>PayPal Sandbox</span></div>
          <ArrowRight size={15}/>
          <div><Activity size={17}/><span>Revenue signals</span></div>
          <ArrowRight size={15}/>
          <div><BrainCircuit size={17}/><span>AI reasoning</span></div>
          <ArrowRight size={15}/>
          <div><ShieldCheck size={17}/><span>Action brief</span></div>
        </div>
      </section>

      <section className={styles.sourceBar}>
        <div className={styles.sourceState}>
          <span className={source === "demo" ? styles.demoDot : styles.liveDot}/>
          <div>
            <strong>{source === "demo" ? "Demo dataset active" : source === "imported-file" ? "Locally imported PayPal-format data" : "PayPal Sandbox connected"}</strong>
            <small>{source === "demo" ? "Synthetic sandbox-like payments · no real money"
              : source === "imported-file" ? `${importCount} supported financial events · authenticity not verified · parsed in your browser`
              : `PayPal Sandbox reporting · ${syncTransactionCount ?? 0} test records found · no real charges`}</small>
          </div>
        </div>
        <div className={styles.sourceActions}>
          <Input type="password" autoComplete="off" value={syncPasscode}
            onChange={e => setSyncPasscode(e.target.value)}
            placeholder="Private sync passcode" aria-label="Private PayPal Sandbox sync passcode"
            className={styles.syncPasscode}/>
          {source !== "demo" && <Button variant="outline" onClick={useDemoData} disabled={briefLoading || syncing}>Use demo data</Button>}
          <Button onClick={syncPayPal} disabled={syncing || briefLoading || syncPasscode.length < 16}>
            <RefreshCcw size={16} className={syncing ? styles.spin : ""}/>
            {syncing ? "Syncing…" : "Sync PayPal Sandbox"}
          </Button>
        </div>
      </section>

      <section className={styles.importPanel} aria-label="Import PayPal-style test report">
        <div className={styles.importIntro}>
          <div className={styles.kicker}>Interactive test · no Sandbox credentials needed</div>
          <strong>Analyze your own PayPal-format JSON file</strong>
          <p>Parse transaction event codes locally. No raw transaction rows are uploaded; only aggregated metrics are sent if you click Generate AI brief. Keep real customer reports private.</p>
          <a href="/sample-sandbox-report.json" download="sample-sandbox-report.json">
            Download safe synthetic sample file
          </a>
        </div>
        <FileDropzone accept=".json" maxSize={2_000_000} maxFiles={1}
          icon={<Upload size={21}/>}
          title="Drop a PayPal-style JSON report"
          subtitle="or click to select · max 2 MB · browser-only parsing"
          onFilesSelected={importReport} disabled={briefLoading || syncing}/>
      </section>
      {importError && <div className={styles.alertBox}><TriangleAlert size={18}/><div><strong>Report import failed</strong><p>{importError}</p></div></div>}

      <p className={styles.syncExplainer}>
        <ShieldCheck size={14}/> Public demo: no account, card or password needed for AI analysis.
        Merchant-only Sandbox sync requires a private passcode and never uses live payments.
      </p>

      {syncError && (
        <div className={styles.alertBox}>
          <TriangleAlert size={18}/>
          <div>
            <strong>Sandbox sync is not active yet</strong>
            <p>{syncError} The demo remains available while credentials or test transactions are being set up.</p>
          </div>
        </div>
      )}
      {source === "paypal-sandbox" && syncTransactionCount === 0 && (
        <div className={styles.alertBox}>
          <TriangleAlert size={18}/>
          <div><strong>Sandbox is connected, but its report is empty</strong>
            <p>No balance-affecting test transactions were returned for the last 30 days. Make test payments with the matching sandbox merchant and retry after PayPal reporting updates.</p></div>
        </div>
      )}

      <section className={styles.metrics}>
        <article><span>Gross revenue</span><strong>{money(analysis.latest.gross, currency)}</strong><small className={analysis.changeVsPrev >= 0 ? styles.good : styles.bad}>{pct(analysis.changeVsPrev)} vs prior period</small></article>
        <article><span>Net after refunds + fees</span><strong>{money(analysis.net, currency)}</strong><small>{money(analysis.latest.refunds + analysis.latest.fees, currency)} outflow</small></article>
        <article><span>Refund / reversal rate</span><strong>{analysis.refundRate.toFixed(1)}%</strong><small>{money(analysis.latest.refunds, currency)} returned or charged back</small></article>
        <article><span>Failed payment rate</span><strong>{source === "demo" ? `${analysis.failureRate.toFixed(1)}%` : "N/A"}</strong><small>{source === "demo" ? `${analysis.latest.failed} simulated failed attempts` : "Not available from imported/reporting records"}</small></article>
        <article><span>Avg. order value</span><strong>{money(analysis.aov, currency)}</strong><small>{analysis.latest.transactions} completed payments</small></article>
        <article><span>Next-period forecast</span><strong>{money(analysis.next, currency)}</strong><small>{pct(((analysis.next - analysis.latest.gross) / Math.max(analysis.latest.gross, 1)) * 100)} vs latest</small></article>
      </section>

      <section className={styles.trendPanel} aria-label="Historical gross revenue trend">
        <div className={styles.trendTitle}>
          <div><span className={styles.kicker}>Transaction evidence</span><h2>Gross revenue over time</h2></div>
          <small>{source === "demo" ? "Synthetic weekly series" : source === "imported-file" ? "Aggregated from local JSON" : "Aggregated from PayPal test transactions"} · {periods.length} periods</small>
        </div>
        <div className={styles.trendBars} role="img" aria-label={periods.map(p => `${p.label}: ${money(p.gross,currency)} gross revenue`).join("; ")}>
          {periods.map((p,i) => (
            <div key={p.label + i} className={styles.trendItem}>
              <div className={styles.trendTrack} title={`${p.label}: ${money(p.gross,currency)}`}>
                <div className={styles.trendBar}
                  style={{height:`${Math.max(1, (p.gross/chartMax)*100)}%`,opacity:p.gross===0?0.24:1}} />
              </div>
              <strong>{money(p.gross,currency)}</strong>
              <span>{p.label}</span>
            </div>
          ))}
        </div>
        <p className={styles.trendNote}>Periods follow the selected dataset. This is a historical descriptive chart, not an audited ledger or a prediction.</p>
      </section>

      <section className={styles.grid}>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <div><span className={styles.kicker}>Evidence</span><h2>Revenue health</h2></div>
            <CircleDollarSign size={22}/>
          </div>
          <div className={styles.signalRows}>
            <div><span>Multi-period direction</span><b className={analysis.trendPct >= 0 ? styles.good : styles.bad}>{pct(analysis.trendPct)}</b></div>
            <div><span>Refund pressure</span><b className={analysis.refundRate > 5 ? styles.bad : styles.good}>{analysis.refundRate > 5 ? "Elevated" : "Healthy"}</b></div>
            <div><span>Payment failures</span><b className={analysis.failureRate > 7 ? styles.bad : styles.good}>{source === "demo" ? `${analysis.failureRate.toFixed(1)}%` : "Not available"}</b></div>
            <div><span>{source === "demo" ? "Simulated disputes" : "Chargeback events"}</span><b>{analysis.latest.disputes}</b></div>
          </div>
          <div className={styles.alertBox}>
            <TriangleAlert size={18}/>
            <div>
              <strong>{analysis.anomalies.length} unusual revenue period{analysis.anomalies.length === 1 ? "" : "s"} detected</strong>
              <p>{analysis.anomalies.length ? "The pattern should be investigated alongside refunds, failures and disputes. Treat it as a signal, not proof of a single cause." : "No material revenue anomaly crossed the current threshold."}</p>
            </div>
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <div><span className={styles.kicker}>Forecast</span><h2>What happens next</h2></div>
            {analysis.next >= analysis.latest.gross ? <TrendingUp size={22}/> : <TrendingDown size={22}/>}
          </div>
          <div className={styles.forecast}>
            <span>Projected gross revenue</span>
            <strong>{money(analysis.next, currency)}</strong>
            <em>{pct(((analysis.next - analysis.latest.gross) / Math.max(analysis.latest.gross, 1)) * 100)}</em>
          </div>
          <div className={styles.forecastMeta}>
            <span><i/>Recent-period slope</span>
            <span><i/>Simple linear estimate</span>
            <span><i/>No causal claims</span>
          </div>
        </article>
      </section>

      <section className={styles.aiPanel}>
        <div className={styles.aiHeader}>
          <div><span className={styles.kicker}>AI decision layer</span><h2>Revenue Recovery Brief</h2></div>
          <Button size="lg" onClick={generateBrief} disabled={briefLoading || syncing || (source === "paypal-sandbox" && syncTransactionCount === 0)}>
            <BrainCircuit size={17}/>{briefLoading ? "Reasoning…" : "Generate AI brief"}
          </Button>
        </div>

        {briefError && (
          <div className={styles.alertBox}><TriangleAlert size={18}/><div><strong>AI brief unavailable</strong><p>{briefError}</p></div></div>
        )}

        {!brief ? (
          <div className={styles.emptyBrief}>
            <BrainCircuit size={30}/>
            <div><strong>Ground the AI in payment evidence first.</strong><p>The model receives derived revenue signals rather than being asked to invent explanations from raw noise.</p></div>
          </div>
        ) : (
          <div className={styles.briefGrid}>
            <div className={styles.briefHero}><span>What changed</span><h3>{brief.whatChanged}</h3><p>{brief.investigation}</p></div>
            <div className={styles.briefCard}><span>What happens next</span><p>{brief.whatNext}</p></div>
            <div className={styles.briefCard}><span>Risks & opportunities</span><p><b>Risks:</b> {brief.risks.join(" ")}</p><p><b>Opportunities:</b> {brief.opportunities.join(" ")}</p></div>
            <div className={styles.actions}>
              <span>Next-best actions</span>
              {brief.actions.map((a, index) => (
                <div key={`${a.action}-${index}`}><b>{String(index + 1).padStart(2, "0")}</b><div><strong>{a.action}</strong><p>{a.rationale}</p></div><code>{a.confidence}</code></div>
              ))}
            </div>
            <div className={styles.critic}><ShieldCheck size={20}/><div><strong>Evidence guardrail</strong><p>{brief.guardrail}</p><small>{brief.model}</small></div></div>
          </div>
        )}
      </section>

      <section className={styles.why}>
        <div><CreditCard size={19}/><strong>Sandbox-first</strong><span>PayPal test transactions only during the hackathon.</span></div>
        <div><BadgeDollarSign size={19}/><strong>Revenue-focused</strong><span>Refunds, failures, fees and disputes become decision signals.</span></div>
        <div><ShieldCheck size={19}/><strong>Explainable</strong><span>Evidence, hypotheses and actions stay visibly separated.</span></div>
      </section>

      <footer>
        <span>SignalForge Pay</span>
        <span>Built for the PayPal AI Hackathon · Sandbox only · No real payments</span>
      </footer>
    </main>
  );
}