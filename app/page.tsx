"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Banknote,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Circle,
  CircleAlert,
  Clock3,
  ExternalLink,
  Gauge,
  GitBranch,
  Kanban,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type View = "today" | "opportunities" | "pipeline" | "contacts" | "interview" | "activity";

type Opportunity = {
  id: string;
  company: string;
  title: string;
  req_id: string;
  job_status: string;
  priority: string;
  scores: {
    technical_fit: number;
    leadership_fit: number;
    career_value: number;
    compensation: number;
    practicality: number;
    overall: number;
    confidence: number;
  };
  location: string;
  work_mode: string;
  employment_type: string;
  compensation: {
    base_min: number | null;
    base_max: number | null;
    currency: string;
    bonus: string;
    equity: string;
    total_estimate: string;
  };
  sponsorship: { status: string; evidence: string; notes: string };
  source: { type: string; confidence: string; url: string; verified_on: string };
  why_fit: string[];
  gaps: string[];
  resume_variant: string;
  tracking: {
    application_stage: string;
    pipeline_phase: string;
    status_detail: string;
    applied_on?: string | null;
  };
};

type Task = {
  id: string;
  opportunity_id: string | null;
  title: string;
  category: string;
  urgency: string;
  due_on: string;
  status: string;
  details: string;
  owner: string;
};

type Contact = {
  id: string;
  name: string;
  company: string;
  relationship: string;
  channel: string;
  related_opportunity_ids: string[];
  last_contact: string;
  next_follow_up: string | null;
  status: string;
  notes: string;
};

type ActivityItem = {
  id: string;
  occurred_at: string;
  type: string;
  opportunity_id: string | null;
  summary: string;
};

type Resume = { id: string; name: string; status: string; focus: string[] };

type DashboardData = {
  generated_at: string | null;
  opportunities: Opportunity[];
  tasks: Task[];
  contacts: Contact[];
  activities: ActivityItem[];
  resumes: Resume[];
  meta: { last_search_at?: string | null };
};

type GitHubSettings = {
  owner: string;
  repo: string;
  branch: string;
  token: string;
};

const GITHUB_SETTINGS_KEY = "vamsi-career-command-center-github";
const SITE_BASE_PATH = process.env.NEXT_PUBLIC_SITE_BASE_PATH ?? "";

function decodeGitHubContent(content: string) {
  const binary = atob(content.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function fetchGitHubJson(settings: GitHubSettings, path: string) {
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}/contents/data/${encodeURIComponent(path)}?ref=${encodeURIComponent(settings.branch)}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${settings.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    if (response.status === 401) throw new Error("GitHub rejected the token. Confirm that it is active and copied completely.");
    if (response.status === 403) throw new Error("The token cannot read this repository. Grant it Contents: Read access to the private data repository.");
    if (response.status === 404) throw new Error("The private data repository or branch could not be found with this token.");
    throw new Error(`GitHub returned ${response.status} while loading ${path}.`);
  }
  const payload = await response.json() as { content?: string };
  if (!payload.content) throw new Error(`GitHub returned no content for ${path}.`);
  return JSON.parse(decodeGitHubContent(payload.content));
}

async function loadPrivateDashboard(settings: GitHubSettings): Promise<DashboardData> {
  const [opportunitiesDoc, trackingDoc, tasksDoc, contactsDoc, activityDoc, resumesDoc, metaDoc] = await Promise.all([
    fetchGitHubJson(settings, "opportunities.json"),
    fetchGitHubJson(settings, "tracking.json"),
    fetchGitHubJson(settings, "tasks.json"),
    fetchGitHubJson(settings, "contacts.json"),
    fetchGitHubJson(settings, "activity.json"),
    fetchGitHubJson(settings, "resumes.json"),
    fetchGitHubJson(settings, "meta.json"),
  ]);
  const trackingByOpportunity = new Map<string, Opportunity["tracking"]>(
    trackingDoc.tracking.map((item: Opportunity["tracking"] & { opportunity_id: string }) => [item.opportunity_id, item]),
  );
  const opportunities = opportunitiesDoc.opportunities.map((opportunity: Omit<Opportunity, "tracking">) => ({
    ...opportunity,
    tracking: trackingByOpportunity.get(opportunity.id) ?? {
      application_stage: "Researching",
      pipeline_phase: "Not started",
      status_detail: "No workflow state recorded",
    },
  }));
  return {
    generated_at: new Date().toISOString(),
    opportunities,
    tasks: tasksDoc.tasks,
    contacts: contactsDoc.contacts,
    activities: activityDoc.activities,
    resumes: resumesDoc.resumes,
    meta: metaDoc,
  };
}

const navItems: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "today", label: "Today", icon: LayoutDashboard },
  { id: "opportunities", label: "Opportunities", icon: Target },
  { id: "pipeline", label: "Pipeline", icon: Kanban },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "interview", label: "Interview Center", icon: BrainCircuit },
  { id: "activity", label: "Activity", icon: Activity },
];

const viewTitles: Record<View, { eyebrow: string; title: string }> = {
  today: { eyebrow: "Monday, October 5", title: "Make the next move count." },
  opportunities: { eyebrow: "Opportunity intelligence", title: "The roles worth your time." },
  pipeline: { eyebrow: "Application pipeline", title: "Momentum, without the noise." },
  contacts: { eyebrow: "Relationship map", title: "Every conversation has a next step." },
  interview: { eyebrow: "Interview center", title: "Prepare for the bar, not the calendar." },
  activity: { eyebrow: "Decision history", title: "A clean record of what changed." },
};

const stageOrder = [
  "Assessment", "Interview", "Final Interview", "Team Matching", "Recruiter Screen",
  "Recruiter Contact", "Applied", "Ready to Apply", "Target", "Researching", "Offer",
  "Rejected", "Withdrawn",
];

function formatMoney(value: number | null) {
  if (!value) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: value >= 100000 ? "compact" : "standard",
  }).format(value);
}

function formatDate(value?: string | null, withYear = false) {
  if (!value) return "Not scheduled";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  }).format(date);
}

function priorityClass(priority: string) {
  if (priority === "P0") return "priority-p0";
  if (priority === "P1") return "priority-p1";
  if (priority === "P2") return "priority-p2";
  return "priority-p3";
}

function sourceClass(confidence: string) {
  return {
    GREEN: "source-green",
    PURPLE: "source-purple",
    BLUE: "source-blue",
    YELLOW: "source-yellow",
    RED: "source-red",
  }[confidence] ?? "source-yellow";
}

function stageClass(stage: string) {
  if (["Assessment", "Interview", "Final Interview", "Team Matching"].includes(stage)) return "stage-hot";
  if (["Applied", "Recruiter Screen", "Recruiter Contact"].includes(stage)) return "stage-active";
  if (stage === "Ready to Apply") return "stage-ready";
  if (["Rejected", "Withdrawn"].includes(stage)) return "stage-muted";
  return "stage-research";
}

function ScoreRing({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const pct = Math.max(0, Math.min(100, score * 20));
  return (
    <div
      className={`score-ring score-ring-${size}`}
      style={{ "--score": `${pct * 3.6}deg` } as React.CSSProperties}
      aria-label={`Fit score ${score.toFixed(1)} out of 5`}
    >
      <span>{score.toFixed(1)}</span>
    </div>
  );
}

function MiniStat({ label, value, detail, accent }: { label: string; value: string | number; detail: string; accent: string }) {
  return (
    <div className="metric-card">
      <span className={`metric-signal ${accent}`} />
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      <p className="metric-detail">{detail}</p>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="empty-state">
      <Circle className="h-5 w-5" />
      <p>{label}</p>
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [connectionNeeded, setConnectionNeeded] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState("");
  const [view, setView] = useState<View>("today");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("All stages");
  const [selected, setSelected] = useState<Opportunity | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`${SITE_BASE_PATH}/generated/dashboard.json`, { cache: "no-store" });
        if (response.ok) {
          const payload = await response.json() as DashboardData;
          if (payload.opportunities?.length) {
            if (active) setData(payload);
            return;
          }
        }
        const saved = window.localStorage.getItem(GITHUB_SETTINGS_KEY);
        if (!saved) {
          if (active) setConnectionNeeded(true);
          return;
        }
        const payload = await loadPrivateDashboard(JSON.parse(saved) as GitHubSettings);
        if (active) setData(payload);
      } catch (error) {
        if (!active) return;
        const saved = window.localStorage.getItem(GITHUB_SETTINGS_KEY);
        if (saved) {
          setConnectionMessage(error instanceof Error ? error.message : "The private GitHub data could not be loaded.");
          setConnectionNeeded(true);
        } else {
          setLoadError(true);
        }
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  const connectGitHub = async (settings: GitHubSettings) => {
    const payload = await loadPrivateDashboard(settings);
    window.localStorage.setItem(GITHUB_SETTINGS_KEY, JSON.stringify(settings));
    setData(payload);
    setConnectionNeeded(false);
    setConnectionMessage("");
  };

  const opportunityMap = useMemo(
    () => new Map(data?.opportunities.map((item) => [item.id, item]) ?? []),
    [data],
  );

  const activeOpportunities = useMemo(
    () => data?.opportunities.filter((item) => item.job_status !== "Closed") ?? [],
    [data],
  );

  const filteredOpportunities = useMemo(() => {
    const needle = search.toLowerCase().trim();
    return activeOpportunities
      .filter((item) => {
        const matchesText = !needle || `${item.company} ${item.title} ${item.location} ${item.req_id}`.toLowerCase().includes(needle);
        const matchesStage = stageFilter === "All stages" || item.tracking.application_stage === stageFilter;
        return matchesText && matchesStage;
      })
      .sort((a, b) => {
        const aStage = stageOrder.indexOf(a.tracking.application_stage);
        const bStage = stageOrder.indexOf(b.tracking.application_stage);
        if (a.priority !== b.priority) return a.priority.localeCompare(b.priority);
        if (aStage !== bStage) return aStage - bStage;
        return b.scores.overall - a.scores.overall;
      });
  }, [activeOpportunities, search, stageFilter]);

  if (connectionNeeded && !data) {
    return <GitHubConnectionScreen initialMessage={connectionMessage} onConnect={connectGitHub} />;
  }

  if (!data && !loadError) {
    return (
      <main className="min-h-screen bg-background p-6 text-foreground">
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-[250px_1fr]">
          <Skeleton className="h-[calc(100vh-48px)] rounded-3xl" />
          <div className="space-y-5">
            <Skeleton className="h-32 rounded-3xl" />
            <div className="grid gap-4 sm:grid-cols-3"><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-32 rounded-2xl" /></div>
            <Skeleton className="h-96 rounded-3xl" />
          </div>
        </div>
      </main>
    );
  }

  if (loadError || !data) {
    return (
      <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
        <div className="max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-2xl">
          <CircleAlert className="mx-auto h-10 w-10 text-orange-400" />
          <h1 className="mt-4 text-2xl font-semibold">The command center could not load.</h1>
          <p className="mt-2 text-muted-foreground">The private data snapshot is missing or malformed. Refresh after the next data sync.</p>
          <Button className="mt-6" onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </main>
    );
  }

  const currentTitle = viewTitles[view];
  const openTasks = data.tasks.filter((task) => task.status === "Open");
  const p0Tasks = openTasks.filter((task) => task.urgency === "Due now");
  const readyCount = activeOpportunities.filter((item) => item.tracking.application_stage === "Ready to Apply").length;
  const pipelineCount = activeOpportunities.filter((item) => ["Applied", "Recruiter Contact", "Recruiter Screen", "Assessment", "Interview", "Final Interview", "Team Matching", "Offer"].includes(item.tracking.application_stage)).length;
  const needsVerification = activeOpportunities.filter((item) => item.job_status === "Unclear");
  const capitalOne = opportunityMap.get("capital-one-r1001577-1");
  const topRoles = activeOpportunities
    .filter((item) => ["Ready to Apply", "Target", "Researching"].includes(item.tracking.application_stage))
    .sort((a, b) => b.scores.overall - a.scores.overall)
    .slice(0, 5);

  return (
    <SidebarProvider defaultOpen style={{ "--sidebar-width": "16.5rem", "--sidebar-width-icon": "4.5rem" } as React.CSSProperties}>
      <Sidebar collapsible="icon" className="border-r-0 p-3 pr-0">
        <SidebarHeader className="px-3 pb-5 pt-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="brand-mark"><span>V</span></div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-teal-300">Career OS</p>
              <p className="truncate text-base font-semibold text-white">Command Center</p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={view === item.id}
                        tooltip={item.label}
                        onClick={() => setView(item.id)}
                        className="sidebar-nav"
                      >
                        <Icon />
                        <span>{item.label}</span>
                        {item.id === "today" && p0Tasks.length > 0 ? <span className="nav-count">{p0Tasks.length}</span> : null}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="px-3 pb-4">
          <div className="sidebar-status group-data-[collapsible=icon]:hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Search health</span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-teal-300"><span className="h-1.5 w-1.5 rounded-full bg-teal-300" />Current</span>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <p className="text-2xl font-semibold text-white">{activeOpportunities.length}</p>
                <p className="text-xs text-slate-500">active records</p>
              </div>
              <p className="text-right text-[0.68rem] leading-4 text-slate-500">Last scan<br />{formatDate(data.meta.last_search_at)}</p>
            </div>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0 bg-transparent">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/[0.06] bg-background/90 px-4 backdrop-blur-xl sm:px-7">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="text-slate-400 hover:bg-white/[0.06] hover:text-white" />
            <div className="hidden h-5 w-px bg-white/[0.08] sm:block" />
            <p className="hidden text-sm text-slate-400 sm:block">Plainfield · Chicago · Remote</p>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="sync-pill"><span /> Synced {formatDate(data.generated_at)}</div>
            <button className="avatar-button" aria-label="Vamsi profile">VK</button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1520px] px-4 pb-16 pt-7 sm:px-7 lg:px-9">
          <div className="page-heading">
            <div>
              <p className="eyebrow">{currentTitle.eyebrow}</p>
              <h1>{currentTitle.title}</h1>
              <p className="search-policy">Senior Manager+ <span /> $190K+ total compensation <span /> H-1B compatible</p>
            </div>
            {view !== "today" ? (
              <Button variant="outline" className="hidden border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.08] hover:text-white sm:flex" onClick={() => setView("today")}>Back to Today</Button>
            ) : null}
          </div>

          {view === "today" ? (
            <TodayView
              capitalOne={capitalOne}
              openTasks={openTasks}
              p0Tasks={p0Tasks}
              topRoles={topRoles}
              needsVerification={needsVerification}
              opportunityMap={opportunityMap}
              metrics={{ pipelineCount, readyCount, activeCount: activeOpportunities.length }}
              onOpenOpportunity={setSelected}
              onChangeView={setView}
            />
          ) : null}
          {view === "opportunities" ? (
            <OpportunitiesView
              opportunities={filteredOpportunities}
              search={search}
              onSearch={setSearch}
              stageFilter={stageFilter}
              onStageFilter={setStageFilter}
              onOpen={setSelected}
            />
          ) : null}
          {view === "pipeline" ? <PipelineView opportunities={activeOpportunities} onOpen={setSelected} /> : null}
          {view === "contacts" ? <ContactsView contacts={data.contacts} opportunityMap={opportunityMap} /> : null}
          {view === "interview" ? <InterviewView capitalOne={capitalOne} resumes={data.resumes} /> : null}
          {view === "activity" ? <ActivityView activities={data.activities} opportunityMap={opportunityMap} data={data} /> : null}
        </main>
      </SidebarInset>

      <OpportunitySheet opportunity={selected} onClose={() => setSelected(null)} />
    </SidebarProvider>
  );
}

function GitHubConnectionScreen({ initialMessage, onConnect }: {
  initialMessage: string;
  onConnect: (settings: GitHubSettings) => Promise<void>;
}) {
  const [owner, setOwner] = useState("rallabhandiAi");
  const [repo, setRepo] = useState("vamsi-career-command-center-data");
  const [branch, setBranch] = useState("main");
  const [token, setToken] = useState("");
  const [message, setMessage] = useState(initialMessage);
  const [connecting, setConnecting] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setConnecting(true);
    setMessage("");
    try {
      await onConnect({ owner: owner.trim(), repo: repo.trim(), branch: branch.trim(), token: token.trim() });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The private GitHub data could not be loaded.");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <main className="connection-page">
      <section className="connection-card">
        <div className="connection-brand"><span className="brand-mark">V</span><span>Career OS</span></div>
        <div className="connection-icon"><LockKeyhole /></div>
        <p className="eyebrow">Private data connection</p>
        <h1>Connect your Career Command Center.</h1>
        <p className="connection-copy">The GitHub Pages shell is public, but your opportunities, applications and contacts stay in the private data repository. Use a fine-grained token limited to that repository with <strong>Contents: Read-only</strong>.</p>
        <form onSubmit={submit} className="connection-form">
          <label><span>GitHub owner</span><Input required value={owner} onChange={(event) => setOwner(event.target.value)} autoComplete="off" /></label>
          <label><span>Private data repository</span><Input required value={repo} onChange={(event) => setRepo(event.target.value)} autoComplete="off" /></label>
          <label><span>Branch</span><Input required value={branch} onChange={(event) => setBranch(event.target.value)} autoComplete="off" /></label>
          <label className="connection-token"><span>Fine-grained personal access token</span><div className="relative"><KeyRound className="connection-input-icon" /><Input required type="password" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" placeholder="github_pat_…" /></div></label>
          {message ? <p className="connection-error" role="alert">{message}</p> : null}
          <Button type="submit" disabled={connecting} className="connection-submit">{connecting ? "Connecting…" : <><GitBranch /> Connect private repository</>}</Button>
        </form>
        <p className="connection-footnote">The token is sent only to GitHub and stored only in this browser on this device. No token is committed to either repository.</p>
      </section>
    </main>
  );
}

function TodayView({
  capitalOne,
  openTasks,
  p0Tasks,
  topRoles,
  needsVerification,
  opportunityMap,
  metrics,
  onOpenOpportunity,
  onChangeView,
}: {
  capitalOne?: Opportunity;
  openTasks: Task[];
  p0Tasks: Task[];
  topRoles: Opportunity[];
  needsVerification: Opportunity[];
  opportunityMap: Map<string, Opportunity>;
  metrics: { pipelineCount: number; readyCount: number; activeCount: number };
  onOpenOpportunity: (item: Opportunity) => void;
  onChangeView: (view: View) => void;
}) {
  const sortedTasks = [...openTasks].sort((a, b) => {
    const urgency = { "Due now": 0, "Due soon": 1, Planned: 2, Waiting: 3, None: 4 } as Record<string, number>;
    return (urgency[a.urgency] ?? 9) - (urgency[b.urgency] ?? 9) || a.due_on.localeCompare(b.due_on);
  });

  return (
    <div className="space-y-6">
      <section className="focus-banner">
        <div className="focus-glow" />
        <div className="relative grid gap-7 lg:grid-cols-[1.45fr_0.85fr] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-0 bg-orange-400/15 text-orange-300 hover:bg-orange-400/15"><Sparkles className="mr-1.5 h-3.5 w-3.5" />Primary focus</Badge>
              <span className="text-sm text-slate-400">Capital One · Phase 1</span>
            </div>
            <h2 className="mt-4 max-w-3xl text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">Protect the interview opportunity. Inspect the CodeSignal invitation before the clock starts.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">The recruiter screen is complete. Your recommendation can remain valid for 12 months, while an unsuccessful attempt creates a six-month cooling period.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button className="bg-teal-300 text-slate-950 hover:bg-teal-200" onClick={() => onChangeView("interview")}>Open interview plan</Button>
              {capitalOne ? <Button variant="outline" className="border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.08] hover:text-white" onClick={() => onOpenOpportunity(capitalOne)}>View role context</Button> : null}
            </div>
          </div>
          <div className="phase-card">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Evaluation path</p>
              <span className="text-xs text-teal-300">1 of 6 complete</span>
            </div>
            <Progress value={17} className="mt-4 h-1.5 bg-white/[0.06] [&>div]:bg-teal-300" />
            <div className="mt-5 grid grid-cols-6 gap-2" aria-label="Interview progress">
              {["Screen", "Code", "DE 1", "DE 2", "Behavior", "Problem"].map((step, index) => (
                <div key={step} className="text-center">
                  <span className={`mx-auto grid h-7 w-7 place-items-center rounded-full border text-xs ${index === 0 ? "border-teal-300 bg-teal-300 text-slate-950" : index === 1 ? "border-orange-400/70 bg-orange-400/10 text-orange-300" : "border-white/10 bg-white/[0.02] text-slate-600"}`}>
                    {index === 0 ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                  </span>
                  <p className="mt-2 truncate text-[0.65rem] text-slate-500">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="Active pipeline" value={metrics.pipelineCount} detail="Applications and recruiter leads" accent="signal-teal" />
        <MiniStat label="Apply-ready" value={metrics.readyCount} detail="Tailored submission queue" accent="signal-cyan" />
        <MiniStat label="Action due" value={p0Tasks.length} detail="Needs attention today" accent="signal-orange" />
        <MiniStat label="Tracked roles" value={metrics.activeCount} detail="Open, unclear and recruiter-led" accent="signal-violet" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="panel">
          <div className="panel-header">
            <div><p className="section-kicker">Action queue</p><h2>What deserves attention now</h2></div>
            <span className="panel-count">{openTasks.length} open</span>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {sortedTasks.slice(0, 7).map((task, index) => {
              const opportunity = task.opportunity_id ? opportunityMap.get(task.opportunity_id) : undefined;
              return (
                <button key={task.id} className="task-row" onClick={() => opportunity && onOpenOpportunity(opportunity)}>
                  <span className={`task-rank ${task.urgency === "Due now" ? "task-rank-hot" : ""}`}>{String(index + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-slate-100">{task.title}</span>
                      <Badge variant="outline" className="border-white/10 bg-transparent text-[0.65rem] font-medium text-slate-500">{task.category}</Badge>
                    </span>
                    <span className="mt-1 block truncate text-sm text-slate-500">{opportunity ? `${opportunity.company} · ${task.details}` : task.details}</span>
                  </span>
                  <span className={`task-due ${task.urgency === "Due now" ? "text-orange-300" : "text-slate-500"}`}><Clock3 className="h-3.5 w-3.5" />{formatDate(task.due_on)}</span>
                  <ChevronRight className="h-4 w-4 text-slate-700" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div><p className="section-kicker">Opportunity radar</p><h2>Highest-value targets</h2></div>
            <button className="text-sm text-teal-300 hover:text-teal-200" onClick={() => onChangeView("opportunities")}>See all</button>
          </div>
          <div className="space-y-2 p-3">
            {topRoles.map((role, index) => (
              <button key={role.id} className="role-radar-row" onClick={() => onOpenOpportunity(role)}>
                <span className="w-5 text-xs text-slate-600">{index + 1}</span>
                <ScoreRing score={role.scores.overall} size="sm" />
                <span className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-medium text-slate-100">{role.company}</span><span className="block truncate text-xs text-slate-500">{role.title}</span></span>
                <span className={`priority-chip ${priorityClass(role.priority)}`}>{role.priority}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div><p className="section-kicker">Verification debt</p><h2>Promising, but not yet actionable</h2></div>
          <Badge variant="outline" className="border-amber-300/20 bg-amber-300/5 text-amber-200">{needsVerification.length} unclear</Badge>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {needsVerification.slice(0, 6).map((role) => (
            <button key={role.id} onClick={() => onOpenOpportunity(role)} className="verification-card">
              <div className="flex items-start justify-between gap-3"><div className="text-left"><p className="font-medium text-slate-100">{role.company}</p><p className="mt-1 line-clamp-2 text-sm text-slate-500">{role.title}</p></div><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /></div>
              <p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><CalendarDays className="h-3.5 w-3.5" /> Last checked {formatDate(role.source.verified_on)}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function OpportunitiesView({ opportunities, search, onSearch, stageFilter, onStageFilter, onOpen }: {
  opportunities: Opportunity[];
  search: string;
  onSearch: (value: string) => void;
  stageFilter: string;
  onStageFilter: (value: string) => void;
  onOpen: (item: Opportunity) => void;
}) {
  const stages = ["All stages", "Assessment", "Applied", "Recruiter Contact", "Ready to Apply", "Target", "Researching"];
  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-white/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
          <Input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search company, title, location or req ID" className="border-white/10 bg-white/[0.03] pl-9 text-slate-100 placeholder:text-slate-600" />
        </div>
        <NativeSelect value={stageFilter} onChange={(event) => onStageFilter(event.target.value)} className="w-full border-white/10 bg-white/[0.03] text-slate-300 sm:w-48">
          {stages.map((stage) => <NativeSelectOption key={stage} value={stage}>{stage}</NativeSelectOption>)}
        </NativeSelect>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow className="border-white/[0.06] hover:bg-transparent"><TableHead className="w-[38%] pl-5 text-slate-500">Opportunity</TableHead><TableHead className="text-slate-500">Stage</TableHead><TableHead className="text-slate-500">Compensation</TableHead><TableHead className="text-slate-500">Source</TableHead><TableHead className="text-right text-slate-500">Fit</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
          <TableBody>
            {opportunities.map((role) => (
              <TableRow key={role.id} className="cursor-pointer border-white/[0.05] hover:bg-white/[0.025]" onClick={() => onOpen(role)}>
                <TableCell className="pl-5"><div className="flex items-start gap-3"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${sourceClass(role.source.confidence)}`} /><div className="min-w-0"><p className="font-medium text-slate-100">{role.company}</p><p className="mt-0.5 max-w-xl text-sm text-slate-500">{role.title}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-slate-600"><MapPin className="h-3 w-3" />{role.work_mode} · {role.location}</p></div></div></TableCell>
                <TableCell><span className={`stage-chip ${stageClass(role.tracking.application_stage)}`}>{role.tracking.application_stage}</span></TableCell>
                <TableCell><p className="text-sm text-slate-300">{role.compensation.base_min ? `${formatMoney(role.compensation.base_min)}–${formatMoney(role.compensation.base_max)}` : "Not confirmed"}</p><p className="mt-1 text-xs text-slate-600">{role.compensation.bonus}</p></TableCell>
                <TableCell><span className="inline-flex items-center gap-2 text-xs text-slate-500"><span className={`h-2 w-2 rounded-full ${sourceClass(role.source.confidence)}`} />{role.source.type}</span></TableCell>
                <TableCell className="text-right"><span className="font-mono text-base font-semibold text-slate-100">{role.scores.overall.toFixed(2)}</span><p className="text-[0.65rem] uppercase tracking-wider text-slate-600">of 5</p></TableCell>
                <TableCell><ChevronRight className="h-4 w-4 text-slate-700" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {opportunities.length === 0 ? <EmptyState label="No opportunities match these filters." /> : null}
    </section>
  );
}

function PipelineView({ opportunities, onOpen }: { opportunities: Opportunity[]; onOpen: (item: Opportunity) => void }) {
  const columns = [
    { title: "Live process", stages: ["Assessment", "Interview", "Final Interview", "Team Matching", "Offer"] },
    { title: "In motion", stages: ["Applied", "Recruiter Contact", "Recruiter Screen", "Hiring Manager"] },
    { title: "Apply next", stages: ["Ready to Apply"] },
    { title: "Qualified targets", stages: ["Target"] },
    { title: "Research", stages: ["Researching"] },
  ];
  return (
    <div className="overflow-x-auto pb-3">
      <div className="grid min-w-[1180px] grid-cols-5 gap-4">
        {columns.map((column) => {
          const items = opportunities.filter((item) => column.stages.includes(item.tracking.application_stage));
          return (
            <section key={column.title} className="pipeline-column">
              <div className="flex items-center justify-between px-1 pb-3"><h2 className="text-sm font-semibold text-slate-300">{column.title}</h2><span className="column-count">{items.length}</span></div>
              <div className="space-y-3">
                {items.map((role) => (
                  <button key={role.id} onClick={() => onOpen(role)} className="pipeline-card">
                    <div className="flex items-start justify-between gap-3"><span className={`priority-chip ${priorityClass(role.priority)}`}>{role.priority}</span><span className="font-mono text-sm font-semibold text-teal-300">{role.scores.overall.toFixed(2)}</span></div>
                    <p className="mt-4 text-left text-sm font-semibold text-slate-100">{role.company}</p><p className="mt-1 line-clamp-2 text-left text-sm leading-5 text-slate-500">{role.title}</p>
                    <div className="mt-4 flex items-center justify-between border-t border-white/[0.05] pt-3 text-xs text-slate-600"><span>{role.work_mode}</span><span>{role.req_id || "Lead"}</span></div>
                  </button>
                ))}
                {items.length === 0 ? <div className="rounded-2xl border border-dashed border-white/[0.08] px-4 py-8 text-center text-xs text-slate-700">Nothing here yet</div> : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ContactsView({ contacts, opportunityMap }: { contacts: Contact[]; opportunityMap: Map<string, Opportunity> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {contacts.map((contact) => (
        <article key={contact.id} className="contact-card">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3"><div className="contact-avatar">{contact.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div><div><h2 className="font-semibold text-slate-100">{contact.name}</h2><p className="text-sm text-slate-500">{contact.relationship} · {contact.company}</p></div></div>
            <span className={`status-dot ${contact.status === "Active" ? "bg-teal-300" : contact.status === "Closed" ? "bg-slate-700" : "bg-orange-300"}`} />
          </div>
          <p className="mt-5 min-h-12 text-sm leading-6 text-slate-400">{contact.notes}</p>
          <div className="mt-5 flex flex-wrap gap-2">{contact.related_opportunity_ids.slice(0, 3).map((id) => opportunityMap.get(id)).filter(Boolean).map((role) => <span key={role!.id} className="relation-chip">{role!.company}</span>)}</div>
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-4"><div><p className="text-[0.65rem] uppercase tracking-wider text-slate-600">Last contact</p><p className="mt-1 text-sm text-slate-300">{formatDate(contact.last_contact)}</p></div><div><p className="text-[0.65rem] uppercase tracking-wider text-slate-600">Next follow-up</p><p className="mt-1 text-sm text-orange-300">{formatDate(contact.next_follow_up)}</p></div></div>
        </article>
      ))}
    </div>
  );
}

function InterviewView({ capitalOne, resumes }: { capitalOne?: Opportunity; resumes: Resume[] }) {
  const steps = [
    { name: "Recruiter screen", status: "Complete", detail: "Completed October 1" },
    { name: "CodeSignal", status: "Next", detail: "70 minutes · four questions · Python expected" },
    { name: "Data engineering I", status: "Planned", detail: "Architecture, pipelines and coding" },
    { name: "Data engineering II", status: "Planned", detail: "Data systems and technical depth" },
    { name: "Behavioral", status: "Planned", detail: "Leadership evidence and judgment" },
    { name: "Problem solving", status: "Planned", detail: "Structured reasoning under ambiguity" },
  ];
  const evidence = [
    { value: "35–40", label: "Engineers led", note: "Accenture global organization" },
    { value: "25–30%", label: "Cost reduction", note: "Infrastructure and platform" },
    { value: "355 → 20", label: "Minutes", note: "Critical pipeline optimization" },
    { value: "50+", label: "Production jobs", note: "Current platform scope" },
  ];
  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="panel">
        <div className="panel-header"><div><p className="section-kicker">Capital One</p><h2>Standardized evaluation</h2></div>{capitalOne ? <span className={`stage-chip ${stageClass(capitalOne.tracking.application_stage)}`}>{capitalOne.tracking.application_stage}</span> : null}</div>
        <div className="p-5 sm:p-6">
          <div className="interview-timeline">
            {steps.map((step, index) => (
              <div className="interview-step" key={step.name}>
                <div className={`step-marker ${step.status === "Complete" ? "step-complete" : step.status === "Next" ? "step-next" : ""}`}>{step.status === "Complete" ? <CheckCircle2 className="h-4 w-4" /> : index + 1}</div>
                <div className="min-w-0 flex-1 pb-7"><div className="flex items-center justify-between gap-3"><h3 className="font-medium text-slate-100">{step.name}</h3><span className={`text-xs ${step.status === "Next" ? "text-orange-300" : step.status === "Complete" ? "text-teal-300" : "text-slate-600"}`}>{step.status}</span></div><p className="mt-1 text-sm text-slate-500">{step.detail}</p></div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-orange-300/15 bg-orange-300/[0.04] p-4"><div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-orange-300" /><div><p className="font-medium text-slate-100">Before opening CodeSignal</p><p className="mt-1 text-sm leading-6 text-slate-400">Record the deadline, permitted languages, proctoring and ID rules, SQL coverage, practice-test access, browser restrictions and retake policy.</p></div></div></div>
        </div>
      </section>

      <div className="space-y-6">
        <section className="panel">
          <div className="panel-header"><div><p className="section-kicker">Evidence bank</p><h2>Your strongest proof</h2></div><Gauge className="h-5 w-5 text-teal-300" /></div>
          <div className="grid grid-cols-2 gap-px bg-white/[0.06]">{evidence.map((item) => <div key={item.label} className="bg-card p-5"><p className="font-mono text-2xl font-semibold tracking-tight text-white">{item.value}</p><p className="mt-1 text-sm font-medium text-slate-300">{item.label}</p><p className="mt-1 text-xs text-slate-600">{item.note}</p></div>)}</div>
        </section>
        <section className="panel">
          <div className="panel-header"><div><p className="section-kicker">Resume system</p><h2>Positioning variants</h2></div><BookOpen className="h-5 w-5 text-violet-300" /></div>
          <div className="divide-y divide-white/[0.06] px-5">{resumes.map((resume) => <div key={resume.id} className="flex items-center gap-3 py-3.5"><span className={`h-2 w-2 rounded-full ${resume.status === "Active" ? "bg-teal-300" : "bg-slate-700"}`} /><div className="min-w-0 flex-1"><p className="truncate text-sm text-slate-200">{resume.name}</p><p className="truncate text-xs text-slate-600">{resume.focus.join(" · ")}</p></div><span className="text-xs text-slate-600">{resume.status}</span></div>)}</div>
        </section>
      </div>
    </div>
  );
}

function ActivityView({ activities, opportunityMap, data }: { activities: ActivityItem[]; opportunityMap: Map<string, Opportunity>; data: DashboardData }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <section className="panel">
        <div className="panel-header"><div><p className="section-kicker">Chronology</p><h2>Application and verification history</h2></div><Activity className="h-5 w-5 text-teal-300" /></div>
        <div className="p-5 sm:p-6"><div className="activity-line">{[...activities].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)).map((item) => { const opportunity = item.opportunity_id ? opportunityMap.get(item.opportunity_id) : undefined; return <div key={item.id} className="activity-item"><span className="activity-dot" /><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium text-slate-200">{opportunity?.company ?? "Command center"}</p><span className="text-[0.65rem] uppercase tracking-wider text-slate-600">{item.type.replaceAll("_", " ")}</span></div><p className="mt-1 text-sm leading-6 text-slate-500">{item.summary}</p><p className="mt-2 text-xs text-slate-700">{formatDate(item.occurred_at, true)}</p></div></div>; })}</div></div>
      </section>
      <aside className="space-y-4"><div className="panel p-5"><p className="section-kicker">Dataset</p><p className="mt-3 text-3xl font-semibold text-white">{data.opportunities.length}</p><p className="mt-1 text-sm text-slate-500">opportunities preserved</p></div><div className="panel p-5"><p className="section-kicker">Last search</p><p className="mt-3 text-lg font-semibold text-slate-100">{formatDate(data.meta.last_search_at, true)}</p><p className="mt-1 text-sm text-slate-500">Official pages checked before promotion</p></div><div className="panel p-5"><p className="section-kicker">Guardrail</p><p className="mt-3 text-sm leading-6 text-slate-400">Automations can update availability and verification. Applications, recruiter outcomes and interview results remain human-controlled.</p></div></aside>
    </div>
  );
}

function OpportunitySheet({ opportunity, onClose }: { opportunity: Opportunity | null; onClose: () => void }) {
  return (
    <Sheet open={Boolean(opportunity)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full border-white/10 bg-[#0a1321] p-0 text-slate-100 sm:max-w-xl">
        {opportunity ? (
          <ScrollArea className="h-full">
            <SheetHeader className="border-b border-white/[0.07] p-6 pr-12 text-left"><div className="flex flex-wrap items-center gap-2"><span className={`priority-chip ${priorityClass(opportunity.priority)}`}>{opportunity.priority}</span><span className={`stage-chip ${stageClass(opportunity.tracking.application_stage)}`}>{opportunity.tracking.application_stage}</span></div><SheetTitle className="mt-4 text-2xl tracking-tight text-white">{opportunity.title}</SheetTitle><SheetDescription className="text-base text-slate-400">{opportunity.company}{opportunity.req_id ? ` · ${opportunity.req_id}` : ""}</SheetDescription></SheetHeader>
            <div className="space-y-7 p-6">
              <div className="flex items-center gap-5 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4"><ScoreRing score={opportunity.scores.overall} size="lg" /><div><p className="text-sm font-medium text-slate-100">Weighted opportunity score</p><p className="mt-1 text-xs leading-5 text-slate-500">Career value and leadership scope receive the greatest weight. Confidence: {Math.round(opportunity.scores.confidence * 100)}%.</p></div></div>
              <div className="grid grid-cols-2 gap-3"><DetailTile icon={MapPin} label="Location" value={`${opportunity.work_mode} · ${opportunity.location}`} /><DetailTile icon={Banknote} label="Base range" value={opportunity.compensation.base_min ? `${formatMoney(opportunity.compensation.base_min)}–${formatMoney(opportunity.compensation.base_max)}` : "Not confirmed"} /><DetailTile icon={ShieldCheck} label="Sponsorship" value={opportunity.sponsorship.status} /><DetailTile icon={CalendarDays} label="Last verified" value={formatDate(opportunity.source.verified_on, true)} /></div>
              <ScoreBreakdown opportunity={opportunity} />
              <DetailList title="Why this role earns attention" items={opportunity.why_fit} positive />
              <DetailList title="Gaps and decision risks" items={opportunity.gaps} />
              <div><p className="detail-heading">Current next step</p><div className="mt-3 rounded-2xl border border-teal-300/15 bg-teal-300/[0.04] p-4"><p className="text-sm font-medium text-slate-100">{opportunity.tracking.pipeline_phase}</p><p className="mt-1 text-sm leading-6 text-slate-400">{opportunity.tracking.status_detail}</p></div></div>
              {opportunity.source.url ? <Button asChild className="w-full bg-teal-300 text-slate-950 hover:bg-teal-200"><a href={opportunity.source.url} target="_blank" rel="noreferrer">Open official posting <ExternalLink className="ml-2 h-4 w-4" /></a></Button> : null}
            </div>
          </ScrollArea>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function DetailTile({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return <div className="detail-tile"><Icon className="h-4 w-4 text-slate-600" /><p className="mt-3 text-[0.65rem] uppercase tracking-wider text-slate-600">{label}</p><p className="mt-1 line-clamp-3 text-sm leading-5 text-slate-300">{value}</p></div>;
}

function ScoreBreakdown({ opportunity }: { opportunity: Opportunity }) {
  const dimensions = [["Career value", opportunity.scores.career_value], ["Leadership", opportunity.scores.leadership_fit], ["Technical", opportunity.scores.technical_fit], ["Compensation", opportunity.scores.compensation], ["Practicality", opportunity.scores.practicality]] as const;
  return <div><p className="detail-heading">Fit dimensions</p><div className="mt-4 space-y-3">{dimensions.map(([label, score]) => <div key={label} className="grid grid-cols-[92px_1fr_28px] items-center gap-3"><span className="text-xs text-slate-500">{label}</span><Progress value={score * 20} className="h-1.5 bg-white/[0.06] [&>div]:bg-teal-300" /><span className="text-right font-mono text-xs text-slate-400">{score.toFixed(1)}</span></div>)}</div></div>;
}

function DetailList({ title, items, positive = false }: { title: string; items: string[]; positive?: boolean }) {
  return <div><p className="detail-heading">{title}</p><div className="mt-3 space-y-2.5">{items.map((item) => <div key={item} className="flex gap-3 text-sm leading-6 text-slate-400">{positive ? <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-teal-300" /> : <CircleAlert className="mt-1 h-4 w-4 shrink-0 text-orange-300" />}<span>{item}</span></div>)}</div></div>;
}
