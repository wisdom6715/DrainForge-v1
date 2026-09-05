import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Activity, ArrowLeft, Check, Clock, Droplets, KeyRound, Lock, MapPin, Phone, RefreshCw, Search, ShieldCheck, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  adminAnalytics,
  adminListReports,
  adminUpdateStatus,
  clearAdminKey,
  getStoredAdminKey,
  storeAdminKey,
  verifyAdminKey,
  type AnalyticsSummary,
  type Report,
} from "@/lib/drainforgeApi";
import { AdminBarChart, DonutSplit } from "@/components/AdminBarChart";

function categoryLabel(value: string) {
  return value.replaceAll("_", " ").replace(/^\w/, (char) => char.toUpperCase());
}

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours > 1 ? "s" : ""} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

export default function Authority() {
  const [adminKey, setAdminKey] = useState<string | null>(() => getStoredAdminKey());
  const [keyInput, setKeyInput] = useState("");
  const [verifying, setVerifying] = useState(false);

  if (!adminKey) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#faf9f7] px-6 text-center text-[#403f58]">
        <div className="fixed inset-0 -z-0 bg-[radial-gradient(circle_at_85%_8%,rgba(240,222,233,.7),transparent_30%),radial-gradient(circle_at_15%_0%,rgba(229,220,246,.8),transparent_32%),linear-gradient(120deg,#faf9f7,#f4f0f6)]" />
        <div className="relative z-10 w-full max-w-sm rounded-[1.7rem] border border-white/80 bg-white/70 p-9 shadow-[0_18px_55px_rgba(94,83,118,.1)] backdrop-blur">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#eee6f7] text-[#8d7ea8]"><KeyRound size={24} /></span>
          <h1 className="mt-5 font-serif text-3xl">Authority access</h1>
          <p className="mt-2 text-sm leading-6 text-[#858096]">Enter the admin key to review reports, mark them resolved, and see corridor analytics. No account needed.</p>
          <form
            className="mt-7 space-y-3 text-left"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!keyInput.trim()) return;
              setVerifying(true);
              try {
                const ok = await verifyAdminKey(keyInput.trim());
                if (ok) {
                  storeAdminKey(keyInput.trim());
                  setAdminKey(keyInput.trim());
                } else {
                  toast.error("Invalid admin key", { description: "Check the key and try again." });
                }
              } catch {
                toast.error("Couldn't verify key", { description: "The service may be unavailable right now." });
              } finally {
                setVerifying(false);
              }
            }}
          >
            <Input
              type="password"
              value={keyInput}
              onChange={(event) => setKeyInput(event.target.value)}
              placeholder="Admin key"
              autoFocus
              className="rounded-xl border-[#ded8e4] bg-white/70 text-sm"
            />
            <Button type="submit" disabled={verifying} className="w-full rounded-full bg-[#403f58] text-xs uppercase tracking-[0.18em] text-white hover:bg-[#5d5a79]">
              {verifying ? "Checking…" : "Enter console"}
            </Button>
          </form>
          <Link href="/" className="mt-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8d7ea8]"><ArrowLeft size={14} /> Resident view</Link>
        </div>
      </div>
    );
  }

  return <AdminConsole adminKey={adminKey} onLock={() => { clearAdminKey(); setAdminKey(null); }} />;
}

function AdminConsole({ adminKey, onLock }: { adminKey: string; onLock: () => void }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"All cases" | "Pending" | "Resolved">("All cases");
  const [query, setQuery] = useState("");
  const [busyReference, setBusyReference] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [reportList, analyticsSummary] = await Promise.all([adminListReports(adminKey), adminAnalytics(adminKey)]);
      setReports(reportList);
      setAnalytics(analyticsSummary);
    } catch {
      toast.error("Couldn't load the console", { description: "The admin key may have been revoked. Try locking and re-entering it." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [adminKey]);

  const filtered = useMemo(
    () =>
      reports.filter((item) => {
        const statusOk = filter === "All cases" || (filter === "Resolved" ? item.status === "resolved" : item.status === "pending");
        const text = `${item.reference} ${item.title} ${item.area ?? ""}`.toLowerCase();
        return statusOk && text.includes(query.toLowerCase());
      }),
    [reports, filter, query],
  );

  const toggleStatus = async (report: Report) => {
    const nextStatus = report.status === "resolved" ? "pending" : "resolved";
    setBusyReference(report.reference);
    try {
      const updated = await adminUpdateStatus(adminKey, report.reference, nextStatus);
      setReports((current) => current.map((item) => (item.reference === report.reference ? updated : item)));
      toast.success(`${report.reference} marked ${nextStatus}`, { description: nextStatus === "resolved" ? "The resident can see this update on their tracking page." : "Moved back to pending." });
      const summary = await adminAnalytics(adminKey);
      setAnalytics(summary);
    } catch {
      toast.error("Couldn't update status", { description: "Please try again." });
    } finally {
      setBusyReference(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9f7] text-[#403f58]">
      <div className="fixed inset-0 -z-0 bg-[radial-gradient(circle_at_85%_8%,rgba(240,222,233,.7),transparent_30%),radial-gradient(circle_at_15%_0%,rgba(229,220,246,.8),transparent_32%),linear-gradient(120deg,#faf9f7,#f4f0f6)]" />
      <header className="relative z-10 border-b border-white/80 bg-[#fffdfa]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-6 py-5 lg:px-10">
          <div className="flex items-center gap-7">
            <Link href="/" className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#403f58] text-white"><Droplets size={19} /></span><span className="font-serif text-xl">DrainForge</span></Link>
            <span className="hidden h-7 w-px bg-[#ded8e4] sm:block" />
            <div className="hidden sm:block"><p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#8d7ea8]">Authority console</p><p className="mt-1 text-xs text-[#858096]">Pilot operations · Lagos Mainland</p></div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={load} className="flex items-center gap-2 rounded-full border border-[#e2dce7] px-3 py-2 text-xs text-[#74718b] hover:bg-white"><RefreshCw size={14} /> Refresh</button>
            <button onClick={onLock} className="flex items-center gap-2 rounded-full border border-[#e2dce7] px-3 py-2 text-xs text-[#74718b] hover:bg-white"><Lock size={14} /> Lock console</button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1500px] px-6 py-8 lg:px-10 lg:py-12">
        <div className="mb-10 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div><p className="eyebrow">Welcome back</p><h1 className="mt-2 font-serif text-4xl tracking-[-0.04em] text-[#403f58] sm:text-5xl">The corridor, in focus.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#858096]">Review incoming reports, mark them resolved, and track response performance over time.</p></div>
          <Link href="/" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#8d7ea8]"><ArrowLeft size={15} /> Resident view</Link>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Total reports" value={analytics?.total_reports ?? "—"} meta="All time" icon={<Activity size={18} />} tone="lavender" />
          <Metric label="Pending" value={analytics?.pending ?? "—"} meta="Awaiting resolution" icon={<Clock size={18} />} tone="blush" />
          <Metric label="Resolved" value={analytics?.resolved ?? "—"} meta={`${analytics?.resolution_rate ?? 0}% resolution rate`} icon={<Check size={18} />} tone="mint" />
          <Metric label="This month" value={analytics?.reports_this_month ?? "—"} meta="New reports" icon={<TrendingUp size={18} />} tone="cream" />
        </section>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_360px]">
          <Card className="overflow-hidden rounded-[1.5rem] border-white/80 bg-white/62 shadow-[0_18px_55px_rgba(94,83,118,.08)] backdrop-blur">
            <CardHeader className="flex flex-col gap-5 border-b border-[#eee9f1] p-6 sm:flex-row sm:items-center sm:justify-between">
              <div><CardTitle className="font-serif text-2xl font-normal">Incoming reports</CardTitle><p className="mt-1 text-xs text-[#9b96a9]">Mark a case resolved once the response team confirms it's cleared.</p></div>
              <div className="flex flex-wrap gap-2">
                <div className="relative"><Search className="absolute left-3 top-2.5 text-[#aaa4b5]" size={15} /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search cases" className="h-9 w-40 rounded-full border-[#e2dce7] bg-white/60 pl-9 text-xs" /></div>
              </div>
            </CardHeader>
            <div className="flex gap-1 overflow-x-auto border-b border-[#eee9f1] px-6 pt-4">
              {(["All cases", "Pending", "Resolved"] as const).map((item) => (
                <button key={item} onClick={() => setFilter(item)} className={`whitespace-nowrap border-b-2 px-3 pb-3 text-xs transition ${filter === item ? "border-[#8d7ea8] font-semibold text-[#5b5872]" : "border-transparent text-[#9b96a9]"}`}>{item}</button>
              ))}
            </div>
            <div className="divide-y divide-[#eee9f1]">
              {loading && <div className="p-12 text-center text-sm text-[#858096]">Loading reports…</div>}
              {!loading && filtered.map((item) => (
                <div key={item.reference} className="grid gap-4 p-6 transition hover:bg-white/55 lg:grid-cols-[1fr_150px_125px_160px]">
                  <div className="flex gap-4">
                    <span className="mt-1 h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#eee6f7]">
                      {item.image_url ? <img src={item.image_url} alt={item.title} className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center text-[#8d7ea8]"><Droplets size={18} /></span>}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8d7ea8]">{item.reference}</span><span className="text-[10px] text-[#b0aaba]">{relativeTime(item.created_at)}</span></div>
                      <Link href={`/reports/${item.reference}`}><h3 className="mt-1 font-serif text-lg text-[#403f58] hover:underline">{item.title}</h3></Link>
                      <p className="mt-1 text-xs text-[#858096]">{categoryLabel(item.category)} <span className="px-1 text-[#c7c0ce]">·</span> {item.severity} severity</p>
                      {item.reporter_phone && (
                        <a
                          href={`tel:${item.reporter_phone}`}
                          onClick={(event) => event.stopPropagation()}
                          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#6b9b7e] hover:underline"
                        >
                          <Phone size={12} /> {item.reporter_phone}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#74718b]"><MapPin size={14} className="text-[#9a8bb0]" /> {item.area || "—"}</div>
                  <div className="flex items-center">
                    <Badge className={`rounded-full border-0 px-3 py-1 text-[10px] uppercase tracking-[0.12em] ${item.status === "resolved" ? "bg-[#e5f2e8] text-[#5d8e74]" : "bg-[#f6efd8] text-[#a58649]"}`}>{item.status === "resolved" ? "Resolved" : "Pending"}</Badge>
                  </div>
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => toggleStatus(item)}
                      disabled={busyReference === item.reference}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition disabled:opacity-50 ${item.status === "resolved" ? "border-[#dcd5e2] bg-white/60 text-[#6c6880] hover:bg-white" : "border-[#85b595] bg-[#e5f2e8] text-[#4c7a5f] hover:bg-[#d8ecdd]"}`}
                    >
                      {item.status === "resolved" ? "Mark pending" : "Mark resolved"}
                    </button>
                  </div>
                </div>
              ))}
              {!loading && filtered.length === 0 && <div className="p-12 text-center text-sm text-[#858096]">No cases match this view.</div>}
            </div>
          </Card>

          <aside className="space-y-6">
            <Card className="rounded-[1.5rem] border-white/80 bg-[#403f58] text-white shadow-[0_18px_55px_rgba(64,63,88,.16)]">
              <CardContent className="p-6">
                <div className="flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#c5b8d2]">Reports this month</p><span className="h-2 w-2 rounded-full bg-[#9ed0ae] shadow-[0_0_0_4px_rgba(158,208,174,.14)]" /></div>
                <h2 className="mt-4 font-serif text-2xl font-normal">Last 6 months</h2>
                <div className="mt-5">
                  <AdminBarChart
                    data={(analytics?.monthly ?? []).map((point) => ({ label: point.month, value: point.count }))}
                    tone="#c8b8db"
                    valueColor="#f5f0f7"
                    labelColor="#aaa8bb"
                    axisColor="rgba(255,255,255,0.14)"
                  />
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-[1.5rem] border-white/80 bg-white/62 shadow-[0_18px_55px_rgba(94,83,118,.06)]">
              <CardContent className="p-6">
                <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e4f2e8] text-[#6b9b7e]"><ShieldCheck size={18} /></span><div><p className="font-serif text-lg">Resolved vs pending</p><p className="text-xs text-[#9b96a9]">All time</p></div></div>
                <div className="mt-6">
                  <DonutSplit resolved={analytics?.resolved ?? 0} pending={analytics?.pending ?? 0} />
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Metric({ label, value, meta, icon, tone }: { label: string; value: string | number; meta: string; icon: React.ReactNode; tone: string }) {
  const styles: Record<string, string> = { lavender: "bg-[#eee6f7] text-[#8d7ea8]", blush: "bg-[#fae8ee] text-[#bf7896]", mint: "bg-[#e4f2e8] text-[#6b9b7e]", cream: "bg-[#f6efd8] text-[#aa8d51]" };
  return <Card className="rounded-[1.35rem] border-white/80 bg-white/62 shadow-[0_14px_36px_rgba(94,83,118,.06)]"><CardContent className="p-5"><div className="flex items-center justify-between"><span className={`grid h-9 w-9 place-items-center rounded-xl ${styles[tone]}`}>{icon}</span><span className="text-[10px] uppercase tracking-[0.16em] text-[#aaa4b5]">Live</span></div><p className="mt-5 text-xs text-[#858096]">{label}</p><div className="mt-1 flex items-end justify-between"><p className="font-serif text-3xl text-[#403f58]">{value}</p><span className="mb-1 text-[10px] text-[#6b9b7e]">{meta}</span></div></CardContent></Card>;
}