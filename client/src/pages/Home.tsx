import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, Camera, Check, ChevronRight, Droplets, ImageOff, Menu, Search, ShieldCheck, Sparkles, Waves, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createReport, listReports, searchReports, type Report, type ReportCategory } from "@/lib/drainforgeApi";
import { uploadEvidence } from "@/lib/supabase";
import { LocationPicker } from "@/components/LocationPicker";
import HeroImage from "@/public/hero.jpg";



const categories: { label: string; value: ReportCategory }[] = [
  { label: "Blocked drain", value: "blocked_drain" },
  { label: "Flooding", value: "flooding" },
  { label: "Waste / plastic", value: "waste_plastic" },
  { label: "Rising water", value: "rising_water" },
  { label: "Damaged drainage", value: "damaged_drainage" },
  { label: "Other", value: "other" },
];

const categoryIcon: Record<ReportCategory, string> = {
  blocked_drain: "▦",
  flooding: "≈",
  waste_plastic: "⌁",
  rising_water: "↗",
  damaged_drainage: "△",
  other: "＋",
};

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

function categoryLabel(value: string) {
  return value.replaceAll("_", " ").replace(/^\w/, (char) => char.toUpperCase());
}

export default function Home() {
  const [isReportOpen, setReportOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ReportCategory>("blocked_drain");
  const [severity, setSeverity] = useState("medium");
  const [description, setDescription] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [trackingReference, setTrackingReference] = useState("");
  const [liveReports, setLiveReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [location, setLocation] = useState({ latitude: 6.5249, longitude: 3.3897, address: "Akoka, Lagos", accuracy: 12 });
  const [submitted, setSubmitted] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const progress = useMemo(() => Math.round((step / 4) * 100), [step]);
  const [phone, setPhone] = useState("");

  const loadReports = () => {
    setLoadingReports(true);
    listReports(undefined, 6)
      .then(setLiveReports)
      .catch(() => setLiveReports([]))
      .finally(() => setLoadingReports(false));
  };

  useEffect(() => { loadReports(); }, []);

  const runSearch = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const query = searchQuery.trim();
    if (!query) { loadReports(); return; }
    setSearching(true);
    try {
      const results = await searchReports(query);
      setLiveReports(results);
      if (results.length === 0) toast.info("No matches", { description: `Nothing found for "${query}" — try the title or a tracking ID like DF-0C59CBDF0C.` });
    } catch {
      toast.error("Search failed", { description: "Please try again in a moment." });
    } finally {
      setSearching(false);
    }
  };

  const openReport = () => {
    setStep(1);
    setSubmitted(false);
    setTitle("");
    setDescription("");
    setPhone("");
    setEvidenceFiles([]);
    setTrackingReference("");
    setReportOpen(true);
  };

  const submitReport = async () => {
    if (!title.trim()) { toast.error("Give it a short title", { description: "e.g. \"Blocked culvert on Herbert Macaulay Way\"" }); setStep(1); return; }
    setSubmitting(true);
    try {
      const reference = `pending-${Date.now()}`;
      let evidencePaths: string[] = [];
      if (evidenceFiles[0]) {
        try {
          const path = await uploadEvidence(evidenceFiles[0], reference);
          evidencePaths = [path];
        } catch {
          toast.error("Photo upload failed", { description: "Continuing without the photo — you can still track this report." });
        }
      }
      const result = await createReport({
        title: title.trim(),
        category,
        severity: severity as never,
        description,
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
        area: location.address,
        location_accuracy: location.accuracy,
        reporter_phone: phone.trim() || undefined,
        evidence_paths: evidencePaths,
      });
      setTrackingReference(result.reference);
      setSubmitted(true);
      toast.success("Report received", { description: `Your acknowledgement ${result.reference} is ready to track.` });
      loadReports();
    } catch {
      toast.error("Report could not be sent", { description: "Please try again when the service is available." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#fbfaf8] text-[#403f58]">
      <div className="pointer-events-none fixed inset-0 -z-0 opacity-80" aria-hidden="true">
        <div className="absolute -left-20 top-0 h-[34rem] w-[34rem] rounded-full bg-[#e7dcf7]/55 blur-3xl" />
        <div className="absolute right-[-8rem] top-[28rem] h-[36rem] w-[36rem] rounded-full bg-[#f5dce6]/60 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-[28%] h-[28rem] w-[28rem] rounded-full bg-[#dff1e9]/55 blur-3xl" />
      </div>

      <header className="relative z-50 mx-auto flex max-w-7xl items-center justify-between px-6 py-7 lg:px-12 bg-[#fbfaf8]">
        <Link href="/" className="flex items-center gap-3" aria-label="DrainForge home">
          <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#403f58] text-[#fbfaf8] shadow-[0_8px_20px_rgba(64,63,88,.16)]"><Droplets size={19} /></span>
          <span><span className="block text-[11px] font-semibold uppercase tracking-[0.32em] text-[#74718b]">Community signal</span><span className="font-serif text-xl tracking-tight text-[#403f58]">DrainForge</span></span>
        </Link>
        <nav className={`${mobileNav ? "absolute left-6 right-6 top-20 flex" : "hidden"} z-20 flex-col gap-3 rounded-2xl border border-white/60 bg-[#fffdfa]/95 p-5 shadow-xl backdrop-blur lg:static lg:flex lg:flex-row lg:items-center lg:gap-8 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none`}>
          <a href="#reports" className="text-sm text-[#74718b] transition-colors hover:text-[#403f58]">Live reports</a>
          <a href="#how-it-works" className="text-sm text-[#74718b] transition-colors hover:text-[#403f58]">How it works</a>
          <Link href="/authority" className="text-sm text-[#74718b] transition-colors hover:text-[#403f58]">Authority console</Link>
          <Button onClick={openReport} className="rounded-full bg-[#403f58] px-5 text-xs uppercase tracking-[0.18em] text-white hover:bg-[#5d5a79]">Report a problem <ArrowUpRight size={15} /></Button>
        </nav>
        <button className="rounded-full p-2 text-[#403f58] lg:hidden" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation">{mobileNav ? <X /> : <Menu />}</button>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 pb-20 pt-12 lg:grid-cols-[1fr_0.9fr] lg:px-12 lg:pb-28 lg:pt-20">
          <div className="relative">
            <span className="editorial-corner editorial-corner--tl" />
            <h1 className="max-w-2xl font-serif text-5xl leading-[0.98] tracking-[-0.045em] text-[#403f58] sm:text-7xl">Keep your community's <em className="font-normal text-[#8d7ea8]">drains flowing.</em></h1>
            <p className="mt-8 max-w-lg text-lg leading-8 text-[#74718b]">See a blocked drain, rising water, or flood risk? Send a clear signal to the people who can respond — before it becomes a flood.</p>
            <div className="mt-10 flex flex-wrap gap-3"><Button onClick={openReport} className="h-12 rounded-full bg-[#403f58] px-6 text-xs uppercase tracking-[0.18em] text-white hover:bg-[#5d5a79]">Report a problem <ArrowUpRight size={16} /></Button><a href="#reports" className="flex h-12 items-center gap-2 rounded-full border border-[#d7d2df] bg-white/35 px-6 text-xs uppercase tracking-[0.18em] text-[#5b5872] transition hover:bg-white/75">View live reports <ChevronRight size={16} /></a></div>
            <div className="mt-14 flex items-center gap-4 text-xs text-[#8e8ba0]"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#e8f3eb] text-[#66917a]"><ShieldCheck size={15} /></span><span>Community-powered. Authority-connected.<br /><strong className="font-medium text-[#5b5872]">Designed for action in under 60 seconds.</strong></span></div>
          </div>
          <div className="relative min-h-[25rem] overflow-hidden rounded-[2rem] border border-white/75 bg-[#f7f1fb]/75 p-5 shadow-[0_24px_80px_rgba(100,87,130,.14)] backdrop-blur-sm sm:min-h-[31rem] lg:rotate-[1.5deg]">
            <img
              src={HeroImage}
              alt="DrainForge"
              className="absolute inset-0 h-full w-full object-cover"
            />          
          </div>
        </section>

        <section id="reports" className="mx-auto max-w-7xl px-6 py-16 lg:px-12">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div><p className="eyebrow">The corridor, in view</p><h2 className="mt-2 font-serif text-4xl tracking-[-0.03em] text-[#403f58]">Reports near you</h2></div>
            <form onSubmit={runSearch} className="flex items-center gap-2 rounded-full border border-[#ded8e4] bg-white/60 py-1.5 pl-4 pr-1.5 text-xs text-[#74718b] focus-within:border-[#a896bc]">
              <Search size={14} className="text-[#9b96a9]" />
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search by title or tracking ID (DF-…)" className="w-56 bg-transparent text-xs text-[#403f58] placeholder:text-[#aaa4b5] focus:outline-none sm:w-72" />
              <Button type="submit" disabled={searching} className="h-7 rounded-full bg-[#403f58] px-4 text-[10px] uppercase tracking-[0.16em] text-white hover:bg-[#5d5a79]">{searching ? "…" : "Search"}</Button>
            </form>
          </div>
          {loadingReports ? (
            <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((key) => <div key={key} className="h-64 animate-pulse rounded-[1.4rem] border border-white/80 bg-white/40" />)}</div>
          ) : liveReports.length === 0 ? (
            <div className="rounded-[1.4rem] border border-dashed border-[#d8cfe0] bg-white/40 p-12 text-center text-sm text-[#858096]">No reports yet — be the first to flag an issue in the corridor.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {liveReports.map((report) => (
                <Link key={report.reference} href={`/reports/${report.reference}`}>
                  <Card className="group cursor-pointer overflow-hidden rounded-[1.4rem] border-white/80 bg-white/55 shadow-[0_14px_36px_rgba(94,83,118,.07)] backdrop-blur transition hover:-translate-y-1 hover:bg-white/80">
                    <div className="relative h-36 w-full overflow-hidden bg-[#eee6f7]">
                      {report.image_url ? (
                        <img src={report.image_url} alt={report.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-[#c3b7d5]"><ImageOff size={26} /></div>
                      )}
                      <Badge variant="outline" className={`absolute right-3 top-3 rounded-full border-0 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] backdrop-blur ${report.status === "resolved" ? "bg-[#e4f2e8]/90 text-[#5d8e74]" : "bg-[#faf1da]/90 text-[#a58649]"}`}>{report.status === "resolved" ? "Resolved" : "Pending"}</Badge>
                    </div>
                    <CardContent className="p-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9b96a9]">{report.reference} {report.area ? `· ${report.area}` : ""}</p>
                      <h3 className="mt-2 font-serif text-xl text-[#403f58]">{report.title}</h3>
                      <p className="mt-2 text-sm text-[#858096]">{categoryLabel(report.category)} <span className="px-1 text-[#c1bacb]">·</span> {relativeTime(report.created_at)}</p>
                      <span className="mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#8d7ea8] transition group-hover:gap-3">View report <ArrowUpRight size={15} /></span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-20 lg:px-12"><div className="grid gap-12 rounded-[2rem] border border-white/75 bg-white/35 p-8 lg:grid-cols-[0.8fr_1.2fr] lg:p-14"><div><p className="eyebrow">A clear signal, a faster response</p><h2 className="mt-3 max-w-md font-serif text-4xl leading-tight tracking-[-0.03em] text-[#403f58]">From your street to the response team.</h2><p className="mt-5 max-w-md text-sm leading-7 text-[#858096]">Every report carries the context that helps authorities act: what happened, where it happened, and how urgent it feels.</p></div><div className="grid gap-5 sm:grid-cols-3">{[["01", "Notice", "See a blocked drain or early water rise."], ["02", "Report", "Share a photo, location, and simple description."], ["03", "Follow through", "Track the status until the issue is resolved."]].map(([number, title2, copy]) => <div key={number} className="relative border-l border-[#cfc5da] pl-5"><p className="font-serif text-3xl text-[#b7a8c8]">{number}</p><h3 className="mt-5 text-sm font-semibold uppercase tracking-[0.16em] text-[#5b5872]">{title2}</h3><p className="mt-3 text-sm leading-6 text-[#858096]">{copy}</p></div>)}</div></div></section>
      </main>

      <footer className="mx-auto flex max-w-7xl flex-col gap-3 border-t border-[#e5e0e8] px-6 py-8 text-xs text-[#9290a2] sm:flex-row sm:items-center sm:justify-between lg:px-12"><span>© 2026 DrainForge · Pilot corridor, Lagos</span><span className="flex items-center gap-2"><Sparkles size={13} className="text-[#b7a8c8]" /> Built for earlier action.</span></footer>

      <Dialog open={isReportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-xl rounded-[1.7rem] border-white/80 bg-[#fffdfa]/95 p-0 text-[#403f58] shadow-2xl backdrop-blur-xl">
          <div className="p-7 sm:p-9">
            {submitted ? (
              <div className="py-8 text-center">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#e4f2e8] text-[#6b9b7e]"><Check size={30} /></span>
                <DialogTitle className="mt-6 font-serif text-3xl">Report received.</DialogTitle>
                <DialogDescription className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#858096]">Thank you for helping keep the corridor clear. Your tracking reference is ready — save it to check progress any time.</DialogDescription>
                <div className="mx-auto mt-7 max-w-xs rounded-2xl bg-[#f4eff8] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8d7ea8]">Report ID</p>
                  <p className="mt-1 font-serif text-2xl text-[#403f58]">{trackingReference || "Awaiting reference"}</p>
                  <p className="mt-1 text-xs text-[#858096]">Status · Pending</p>
                </div>
                <div className="mt-6 flex justify-center gap-3">
                  <Button onClick={() => setReportOpen(false)} className="rounded-full bg-[#403f58] px-6 text-xs uppercase tracking-[0.18em]">Done</Button>
                  {trackingReference && <Link href={`/reports/${trackingReference}`}><Button variant="outline" onClick={() => setReportOpen(false)} className="rounded-full border-[#d8cfe0] bg-transparent px-6 text-xs uppercase tracking-[0.18em]">Track it</Button></Link>}
                </div>
              </div>
            ) : (
              <>
                <DialogHeader>
                  <div className="mb-4 flex items-center justify-between">
                    <span className="eyebrow">Quick report · {progress}%</span>
                    <span className="text-xs text-[#9b96a9]">Step {step} of 4</span>
                  </div>
                  <div className="mb-6 h-1 overflow-hidden rounded-full bg-[#eee9f1]"><div className="h-full rounded-full bg-[#8d7ea8] transition-all duration-300" style={{ width: `${progress}%` }} /></div>
                  <DialogTitle className="font-serif text-3xl">{step === 1 ? "What did you notice?" : step === 2 ? "Where is it?" : step === 3 ? "Add some evidence." : "A little more context."}</DialogTitle>
                  <DialogDescription className="mt-2 text-sm text-[#858096]">{step === 1 ? "Choose the closest description and give it a short title." : step === 2 ? "Your location helps the response team route the work." : step === 3 ? "A photo makes verification faster, but it is optional." : "Tell the team what is happening in your own words."}</DialogDescription>
                </DialogHeader>

                {step === 1 && (
                  <>
                    <div className="mt-7 grid grid-cols-2 gap-3">
                      {categories.map((item) => (
                        <button key={item.value} onClick={() => setCategory(item.value)} className={`rounded-2xl border p-4 text-left text-sm transition ${category === item.value ? "border-[#a896bc] bg-[#f0e9f7] text-[#403f58]" : "border-[#e5e0e8] bg-white/45 text-[#858096] hover:bg-white"}`}>
                          <span className="mb-5 block text-lg">{categoryIcon[item.value]}</span>
                          <span className="font-medium">{item.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="mt-5">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9b96a9]">Short title</p>
                      <Input value={title} onChange={(event) => setTitle(event.target.value.slice(0, 120))} placeholder="e.g. Blocked culvert on Herbert Macaulay Way" className="rounded-xl border-[#ded8e4] bg-white/55 text-sm text-[#403f58] placeholder:text-[#b1acba]" />
                    </div>
                    <div className="mt-4">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9b96a9]">Severity</p>
                      <div className="flex flex-wrap gap-2">
                        {["low", "medium", "high", "critical"].map((item) => (
                          <button key={item} onClick={() => setSeverity(item)} className={`rounded-full border px-3 py-2 text-[10px] uppercase tracking-[0.14em] ${severity === item ? "border-[#a896bc] bg-[#eee6f7] text-[#5b5872]" : "border-[#e5e0e8] text-[#9b96a9]"}`}>{item}</button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {step === 2 && (
                  <div className="mt-7">
                    <LocationPicker value={location} onChange={setLocation} />
                  </div>
                )}

                {step === 3 && (
                  <div className="mt-7 grid place-items-center rounded-2xl border border-dashed border-[#cfc5da] bg-[#faf7fb] px-5 py-12 text-center">
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-[#eee6f7] text-[#8d7ea8]"><Camera size={22} /></span>
                    <p className="mt-4 text-sm font-medium text-[#5b5872]">Add a photo</p>
                    <p className="mt-1 text-xs text-[#9b96a9]">Photos help authorities verify the problem and show on the report card.</p>
                    <label className="mt-5 inline-flex cursor-pointer items-center rounded-full border border-[#d8cfe0] bg-white/60 px-4 py-2 text-xs uppercase tracking-[0.16em] text-[#5b5872]">
                      <input type="file" accept="image/*" className="sr-only" onChange={(event) => setEvidenceFiles(Array.from(event.target.files ?? []).slice(0, 1))} />+ Add photo
                    </label>
                    {evidenceFiles.length > 0 && <p className="mt-3 text-xs text-[#858096]">{evidenceFiles[0].name} selected</p>}
                  </div>
                )}

                {step === 4 && (
                  <div className="mt-7 space-y-5">
                    <div>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9b96a9]">Phone number</p>
                      <Input
                        type="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value.slice(0, 20))}
                        placeholder="e.g. 0803 123 4567"
                        className="rounded-xl border-[#ded8e4] bg-white/55 text-sm text-[#403f58] placeholder:text-[#b1acba]"
                      />
                      <p className="mt-1 text-[11px] text-[#9b96a9]">Shared only with the response team, in case they need to confirm details with you.</p>
                    </div>
                    <div>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9b96a9]">Description</p>
                      <Textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value.slice(0, 500))}
                        placeholder="Large amount of plastic waste is blocking the drainage entrance..."
                        className="min-h-32 resize-none rounded-2xl border-[#ded8e4] bg-white/55 p-4 text-sm text-[#403f58] placeholder:text-[#b1acba]"
                      />
                      <div className="mt-2 text-right text-xs text-[#9b96a9]">{description.length} / 500</div>
                    </div>
                  </div>
                )}

                <div className="mt-8 flex justify-between gap-3">
                  {step > 1 ? <Button variant="outline" onClick={() => setStep(step - 1)} className="rounded-full border-[#d8cfe0] bg-transparent text-xs uppercase tracking-[0.15em]">Back</Button> : <span />}
                  {step < 4 ? (
                    <Button onClick={() => setStep(step + 1)} className="rounded-full bg-[#403f58] px-6 text-xs uppercase tracking-[0.15em]">Continue <ChevronRight size={15} /></Button>
                  ) : (
                    <Button onClick={submitReport} disabled={submitting} className="rounded-full bg-[#403f58] px-6 text-xs uppercase tracking-[0.15em]">{submitting ? "Submitting…" : "Submit report"} <ArrowUpRight size={15} /></Button>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}