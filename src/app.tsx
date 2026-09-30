import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  createContextEntry,
  mergeContext,
  type IntelligencePipelineResult,
  type ContextState,
} from "./intelligence";
import { requestIntelligence } from "./intelligence-api";

type Experience = "Home" | "Work" | "Business" | "Library" | "Account";
type BusinessProfile = { name: string; type: string; location: string };
type WorkItem = {
  id: string;
  request: string;
  intent: IntelligencePipelineResult["intent"];
  createdAt: string;
  status: "active" | "complete";
  pipeline?: IntelligencePipelineResult;
};
type LibraryItem = { id: string; title: string; body: string; createdAt: string };
type NotificationPreferences = {
  workUpdates: boolean;
  researchReady: boolean;
  securityAlerts: boolean;
};

const experiences: Experience[] = ["Home", "Work", "Business", "Library", "Account"];
const profileKey = "busiq:business-profile";
const workKey = "busiq:work";
const libraryKey = "busiq:library";
const contextKey = "busiq:context";
const notificationKey = "busiq:notifications";
const defaultNotificationPreferences: NotificationPreferences = {
  workUpdates: true,
  researchReady: true,
  securityAlerts: true,
};

function load<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "B";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function App() {
  const [active, setActive] = useState<Experience>("Home");
  const [profile, setProfile] = useState<BusinessProfile>(() =>
    load(profileKey, { name: "", type: "", location: "" }),
  );
  const [work, setWork] = useState<WorkItem[]>(() => load(workKey, []));
  const [library, setLibrary] = useState<LibraryItem[]>(() => load(libraryKey, []));
  const [context, setContext] = useState<ContextState>(() =>
    load(contextKey, {
      business: [],
      user: [],
      conversation: [],
      work: [],
      decisions: [],
      knowledge: [],
      provenance: [],
    }),
  );
  const [request, setRequest] = useState("");
  const [pipeline, setPipeline] = useState<IntelligencePipelineResult | null>(null);
  const [pipelineError, setPipelineError] = useState("");
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [savedMessage, setSavedMessage] = useState("");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [notifications, setNotifications] = useState<NotificationPreferences>(() =>
    load(notificationKey, defaultNotificationPreferences),
  );

  useEffect(() => localStorage.setItem(profileKey, JSON.stringify(profile)), [profile]);
  useEffect(() => localStorage.setItem(workKey, JSON.stringify(work)), [work]);
  useEffect(() => localStorage.setItem(libraryKey, JSON.stringify(library)), [library]);
  useEffect(() => localStorage.setItem(contextKey, JSON.stringify(context)), [context]);
  useEffect(() => localStorage.setItem(notificationKey, JSON.stringify(notifications)), [notifications]);

  useEffect(() => {
    const entries = [
      profile.name ? createContextEntry("business", "name", profile.name) : null,
      profile.type ? createContextEntry("business", "type", profile.type) : null,
      profile.location ? createContextEntry("business", "location", profile.location) : null,
    ].filter(Boolean) as NonNullable<ReturnType<typeof createContextEntry>>[];

    if (entries.length) {
      setContext((current) => ({
        ...current,
        business: mergeContext(current.business, entries),
      }));
    }
  }, [profile.name, profile.type, profile.location]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    addEventListener("online", on);
    addEventListener("offline", off);
    return () => {
      removeEventListener("online", on);
      removeEventListener("offline", off);
    };
  }, []);

  const activeWork = useMemo(() => work.filter((item) => item.status === "active"), [work]);

  function navigate(next: Experience) {
    setActive(next);
    setSelectedWorkId(null);
  }

  async function submitRequest(value = request) {
    const trimmed = value.trim();
    if (!trimmed) return;

    setPipelineError("");

    try {
      const result = await requestIntelligence(trimmed, context);
      setPipeline(result);

      if (result.status !== "needs_clarification") {
        const workId = crypto.randomUUID();
        setWork((current) => [
          {
            id: workId,
            request: result.request,
            intent: result.intent,
            createdAt: new Date().toISOString(),
            status: "active" as const,
            pipeline: result,
          },
          ...current,
        ].slice(0, 20));
        setContext((current) => ({
          ...current,
          work: mergeContext(current.work, [
            createContextEntry("work", workId, result.request, { workId }),
          ]),
        }));
      }

      setRequest("");
      setActive("Home");
    } catch (error) {
      setPipelineError(error instanceof Error ? error.message : "BUSIQ could not complete the request.");
    }
  }

  async function openWork(item: WorkItem) {
    setSelectedWorkId(item.id);
    setPipelineError("");

    if (item.pipeline) {
      setPipeline(item.pipeline);
    } else {
      try {
        setPipeline(await requestIntelligence(item.request, context));
      } catch (error) {
        setPipelineError(error instanceof Error ? error.message : "BUSIQ could not restore this work.");
      }
    }

    setActive("Work");
  }

  function saveNote() {
    const title = request.trim();
    if (!title) return;

    const id = crypto.randomUUID();
    setLibrary((current) => [
      {
        id,
        title,
        body: "Created from BUSIQ. This knowledge is currently stored locally on this device.",
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]);
    setContext((current) => ({
      ...current,
      knowledge: mergeContext(current.knowledge, [
        createContextEntry("knowledge", id, title, { source: "BUSIQ Library", workId: id }),
      ]),
    }));
    setRequest("");
    setSavedMessage("Saved to Library.");
    window.setTimeout(() => setSavedMessage(""), 2200);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="wordmark" type="button" onClick={() => navigate("Home")} aria-label="BUSIQ Home">
          <span className="wordmark-mark">B</span>
          <span>BUSIQ</span>
        </button>

        <nav className="desktop-nav" aria-label="Primary navigation">
          {experiences.map((item) => (
            <button
              key={item}
              type="button"
              className={active === item ? "nav-item active" : "nav-item"}
              aria-current={active === item ? "page" : undefined}
              onClick={() => navigate(item)}
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="topbar-right">
          <span className={online ? "connection-state" : "connection-state offline"}>
            <i aria-hidden="true" />
            {online ? "Online" : "Offline"}
          </span>
          <button className="profile-chip" type="button" onClick={() => navigate("Account")} aria-label="Account">
            {initials(profile.name)}
          </button>
        </div>
      </header>

      {!online && (
        <div className="offline-banner" role="status">
          <span className="offline-dot" aria-hidden="true" />
          <strong>You're offline.</strong>
          <span>Local work remains available. Connected data and external research are unavailable.</span>
        </div>
      )}

      <section className="workspace">
        {active === "Home" && (
          <Home
            profile={profile}
            request={request}
            setRequest={setRequest}
            submitRequest={submitRequest}
            pipeline={pipeline}
            pipelineError={pipelineError}
            activeWork={activeWork}
            work={work}
            onOpenWork={openWork}
            onNavigate={navigate}
          />
        )}

        {active === "Work" && (
          <Work
            work={work}
            selectedWorkId={selectedWorkId}
            pipeline={pipeline}
            onOpen={openWork}
            onClose={() => setSelectedWorkId(null)}
            onComplete={(id) =>
              setWork((current) =>
                current.map((item) => (item.id === id ? { ...item, status: "complete" } : item)),
              )
            }
          />
        )}

        {active === "Business" && <Business onNavigate={navigate} />}

        {active === "Library" && (
          <Library
            library={library}
            query={libraryQuery}
            setQuery={setLibraryQuery}
            request={request}
            setRequest={setRequest}
            onSave={saveNote}
            savedMessage={savedMessage}
          />
        )}

        {active === "Account" && (
          <Account
            profile={profile}
            setProfile={setProfile}
            notifications={notifications}
            setNotifications={setNotifications}
            savedMessage={savedMessage}
            setSavedMessage={setSavedMessage}
          />
        )}
      </section>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {experiences.map((item) => (
          <button
            key={item}
            type="button"
            className={active === item ? "mobile-nav-item active" : "mobile-nav-item"}
            aria-current={active === item ? "page" : undefined}
            onClick={() => navigate(item)}
          >
            <span className={"mobile-icon mobile-icon-" + item.toLowerCase()} aria-hidden="true" />
            <span>{item}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}

function Home({
  profile,
  request,
  setRequest,
  submitRequest,
  pipeline,
  pipelineError,
  activeWork,
  work,
  onOpenWork,
  onNavigate,
}: {
  profile: BusinessProfile;
  request: string;
  setRequest: (value: string) => void;
  submitRequest: (value?: string) => void;
  pipeline: IntelligencePipelineResult | null;
  pipelineError: string;
  activeWork: WorkItem[];
  work: WorkItem[];
  onOpenWork: (item: WorkItem) => void;
  onNavigate: (next: Experience) => void;
}) {
  const suggestions = ["Why are my sales down?", "Create a business plan", "How can I increase profit?"];

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-kicker">
          <span className="status-dot" aria-hidden="true" />
          BUSINESS CLARITY
        </div>
        <h1>
          {profile.name ? <>Good morning, {profile.name}.</> : <>Understand your business. <em>Know what to do next.</em></>}
        </h1>
        <p className="hero-copy">
          Ask a question, bring a problem, or describe what you want to accomplish. BUSIQ works out the useful next step.
        </p>
      </section>

      <form className="ask-surface premium" onSubmit={(event) => { event.preventDefault(); submitRequest(); }}>
        <div className="ask-label">
          <span>Ask BUSIQ</span>
          <span className="ask-hint">Natural language · Enter ↵</span>
        </div>
        <textarea
          id="ask"
          value={request}
          onChange={(event) => setRequest(event.target.value)}
          placeholder="What would you like to understand or accomplish?"
          rows={3}
          aria-label="Ask BUSIQ"
        />
        <div className="ask-footer">
          <div className="suggestions" aria-label="Suggested questions">
            {suggestions.map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => { setRequest(suggestion); submitRequest(suggestion); }}>
                {suggestion}
              </button>
            ))}
          </div>
          <button className="primary-button" type="submit" disabled={!request.trim()}>
            Ask BUSIQ <b>↗</b>
          </button>
        </div>
      </form>

      {pipelineError && <div className="pipeline-error" role="alert">{pipelineError}</div>}
      {pipeline && <PipelineView result={pipeline} />}

      <section className="home-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">YOUR WORKSPACE</span>
            <h2>Continue where you left off</h2>
          </div>
          {work.length > 0 && <button className="text-button" type="button" onClick={() => onNavigate("Work")}>View all</button>}
        </div>

        {activeWork.length === 0 ? (
          <div className="empty-home">
            <div className="empty-symbol">+</div>
            <div>
              <strong>No active work yet.</strong>
              <p>Ask BUSIQ a real question and your work will stay here for you to resume.</p>
            </div>
          </div>
        ) : (
          <div className="work-preview">
            {activeWork.slice(0, 3).map((item) => (
              <button className="work-card" type="button" key={item.id} onClick={() => onOpenWork(item)}>
                <span className="work-card-top">
                  <span>{item.intent.label}</span>
                  <i>↗</i>
                </span>
                <strong>{item.request}</strong>
                <small>{formatDate(item.createdAt)} · Active</small>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="home-section compact-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">CONNECTIONS</span>
            <h2>What BUSIQ can access</h2>
          </div>
        </div>
        <div className="connection-strip">
          <span><b>Business profile</b>{profile.name ? "Connected locally" : "Not set up"}</span>
          <span><b>Business systems</b>Not connected</span>
          <span><b>External research</b>Not connected</span>
        </div>
      </section>
    </div>
  );
}

function Work({
  work,
  selectedWorkId,
  pipeline,
  onOpen,
  onClose,
  onComplete,
}: {
  work: WorkItem[];
  selectedWorkId: string | null;
  pipeline: IntelligencePipelineResult | null;
  onOpen: (item: WorkItem) => void;
  onClose: () => void;
  onComplete: (id: string) => void;
}) {
  const selected = work.find((item) => item.id === selectedWorkId);

  return (
    <Page eyebrow="BUSIQ · WORK" title="Questions, investigations and plans stay together." intro="Resume something you started, inspect what BUSIQ found, or continue toward a decision.">
      <div className="work-list">
        {work.length === 0 ? (
          <div className="empty-home">
            <div className="empty-symbol">+</div>
            <div><strong>Your workspace is empty.</strong><p>Ask BUSIQ from Home to create your first piece of work.</p></div>
          </div>
        ) : (
          work.map((item, index) => (
            <button className="work-row" type="button" key={item.id} onClick={() => onOpen(item)}>
              <span className="work-row-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="work-row-main">
                <strong>{item.request}</strong>
                <span>{item.intent.label} · {item.status === "active" ? "Active" : "Complete"} · {formatDate(item.createdAt)}</span>
              </span>
              <b>→</b>
            </button>
          ))
        )}
      </div>

      {selected && pipeline && (
        <WorkDetail item={selected} result={pipeline} onClose={onClose} onComplete={() => onComplete(selected.id)} />
      )}
    </Page>
  );
}

function WorkDetail({
  item,
  result,
  onClose,
  onComplete,
}: {
  item: WorkItem;
  result: IntelligencePipelineResult;
  onClose: () => void;
  onComplete: () => void;
}) {
  return (
    <section className="detail-panel" aria-label="Work detail">
      <div className="detail-head">
        <div><span className="section-kicker">WORK DETAIL</span><h2>{item.request}</h2></div>
        <button className="text-button" type="button" onClick={onClose}>Close</button>
      </div>
      <div className="detail-summary">
        <span><small>Intent</small><strong>{result.intent.label}</strong></span>
        <span><small>Status</small><strong>{result.status.replaceAll("_", " ")}</strong></span>
        <span><small>Evidence</small><strong>{result.evidence.length} item{result.evidence.length === 1 ? "" : "s"}</strong></span>
        <span><small>Next</small><strong>{result.answer.nextAction}</strong></span>
      </div>
      <div className="detail-block">
        <span className="section-kicker">WHAT BUSIQ FOUND</span>
        <p>{result.answer.detail}</p>
      </div>
      <div className="detail-block">
        <span className="section-kicker">EVIDENCE</span>
        {result.evidence.length === 0 ? (
          <p>No external evidence was used. BUSIQ is not presenting unverified external facts as fact.</p>
        ) : (
          <ul>{result.evidence.map((evidence) => <li key={evidence.id}><strong>{evidence.label}</strong>{evidence.source}</li>)}</ul>
        )}
      </div>
      <div className="detail-actions">
        <button className="secondary-button" type="button" onClick={onComplete}>Mark complete</button>
        <details className="why-details">
          <summary>Why this answer?</summary>
          <div className="why-body">
            <p>{result.answer.detail}</p>
            {result.answer.limitations?.length ? <p>{result.answer.limitations.join(" ")}</p> : null}
            <span>Quality gate: {result.answerQuality?.passed ? "Passed" : "Blocked"}</span>
          </div>
        </details>
      </div>
    </section>
  );
}

function Business({ onNavigate }: { onNavigate: (next: Experience) => void }) {
  const areas = [
    ["Sales", "Revenue · orders · performance"],
    ["Customers", "Relationships · retention · demand"],
    ["Money", "Income · expenses · profit"],
    ["Products", "Offers · pricing · performance"],
    ["Inventory", "Stock · movement · availability"],
    ["People", "Roles · capacity · team"],
    ["Operations", "Processes · delivery · efficiency"],
    ["Marketing", "Reach · campaigns · acquisition"],
    ["Projects", "Initiatives · milestones · ownership"],
  ];

  return (
    <Page eyebrow="BUSIQ · BUSINESS" title="Your business, in human terms." intro="Connect the areas that matter to you. BUSIQ will only use information that is actually available.">
      <div className="business-grid">
        {areas.map(([name, description]) => (
          <article className="business-card" key={name}>
            <div className="business-card-icon">{name[0]}</div>
            <div><strong>{name}</strong><span>{description}</span></div>
            <small>Not connected</small>
          </article>
        ))}
      </div>
      <div className="setup-callout">
        <div><strong>Start with your business identity.</strong><p>Add your business name, type and location so BUSIQ can keep your local context consistent.</p></div>
        <button className="primary-button" type="button" onClick={() => onNavigate("Account")}>Set up business</button>
      </div>
    </Page>
  );
}

function Library({
  library,
  query,
  setQuery,
  request,
  setRequest,
  onSave,
  savedMessage,
}: {
  library: LibraryItem[];
  query: string;
  setQuery: (value: string) => void;
  request: string;
  setRequest: (value: string) => void;
  onSave: () => void;
  savedMessage: string;
}) {
  const filtered = library.filter((item) =>
    !query.trim() || `${item.title} ${item.body}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <Page eyebrow="BUSIQ · LIBRARY" title="Your business knowledge, kept close." intro="Notes, plans, research and decisions can live here. At this stage, Library data stays on this device.">
      <div className="library-create">
        <input value={request} onChange={(event) => setRequest(event.target.value)} placeholder="Save a note, plan or decision…" aria-label="New library item" />
        <button className="primary-button" type="button" onClick={onSave} disabled={!request.trim()}>Save</button>
      </div>
      {savedMessage && <div className="saved-message" role="status">{savedMessage}</div>}
      <label className="library-search">
        <span aria-hidden="true">⌕</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Library" aria-label="Search Library" />
      </label>
      <div className="library-list">
        {filtered.length === 0 ? (
          <div className="empty-home"><div className="empty-symbol">+</div><div><strong>Nothing here yet.</strong><p>Saved business knowledge will appear in your Library.</p></div></div>
        ) : (
          filtered.map((item) => (
            <article className="library-item" key={item.id}>
              <span className="library-type">SAVED KNOWLEDGE</span>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
              <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
            </article>
          ))
        )}
      </div>
    </Page>
  );
}

function Account({
  profile,
  setProfile,
  notifications,
  setNotifications,
  savedMessage,
  setSavedMessage,
}: {
  profile: BusinessProfile;
  setProfile: (value: BusinessProfile) => void;
  notifications: NotificationPreferences;
  setNotifications: (value: NotificationPreferences) => void;
  savedMessage: string;
  setSavedMessage: (value: string) => void;
}) {
  return (
    <Page eyebrow="BUSIQ · ACCOUNT" title="Keep your context accurate." intro="Business identity, connections and preferences live here. BUSIQ does not claim services that are not connected.">
      <form className="profile-form premium-form" onSubmit={(event) => {
        event.preventDefault();
        setSavedMessage("Business profile saved.");
        window.setTimeout(() => setSavedMessage(""), 2200);
      }}>
        <div className="form-title"><span>BUSINESS IDENTITY</span><strong>The basics BUSIQ can remember locally.</strong></div>
        <label>Business name<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} required /></label>
        <label>Business type<input value={profile.type} onChange={(event) => setProfile({ ...profile, type: event.target.value })} placeholder="e.g. retail, services, manufacturing" /></label>
        <label>Location<input value={profile.location} onChange={(event) => setProfile({ ...profile, location: event.target.value })} placeholder="City / country" /></label>
        <div className="form-actions"><button className="primary-button" type="submit">Save business</button>{savedMessage && <span className="saved-message">{savedMessage}</span>}</div>
      </form>

      <section className="settings-section">
        <div className="section-heading"><div><span className="section-kicker">CONNECTIONS</span><h2>What BUSIQ can access</h2></div></div>
        <div className="settings-list">
          {[
            ["Business profile", profile.name ? "Connected locally on this device." : "Not set up."],
            ["Cloud database", "Not connected."],
            ["Business systems", "Not connected."],
            ["External research", "Not connected."],
          ].map(([name, status]) => <div className="setting-row" key={name}><div><strong>{name}</strong><span>{status}</span></div><small>{name === "Business profile" && profile.name ? "CONNECTED" : "NOT CONNECTED"}</small></div>)}
        </div>
      </section>

      <section className="settings-section">
        <div className="section-heading"><div><span className="section-kicker">PREFERENCES</span><h2>Notifications</h2></div></div>
        <div className="settings-list">
          <ToggleRow label="Work updates" description="Local reminders and changes to saved work." checked={notifications.workUpdates} onChange={(checked) => setNotifications({ ...notifications, workUpdates: checked })} />
          <ToggleRow label="Research readiness" description="Tell me when a research capability becomes available." checked={notifications.researchReady} onChange={(checked) => setNotifications({ ...notifications, researchReady: checked })} />
          <ToggleRow label="Security alerts" description="Show local warnings about blocked or unsafe actions." checked={notifications.securityAlerts} onChange={(checked) => setNotifications({ ...notifications, securityAlerts: checked })} />
        </div>
        <p className="truth-note">These preferences are stored locally. BUSIQ does not have a push-notification service connected yet.</p>
      </section>
    </Page>
  );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="setting-row toggle-row">
      <div><strong>{label}</strong><span>{description}</span></div>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function PipelineView({ result }: { result: IntelligencePipelineResult }) {
  return (
    <section className="pipeline-card" aria-live="polite">
      <div className="result-top"><span className="section-kicker">BUSIQ RESPONSE</span><span className="result-status">{result.status.replaceAll("_", " ")}</span></div>
      <h2>{result.answer.headline}</h2>
      <p>{result.answer.detail}</p>

      <div className="result-next"><span>Next useful step</span><strong>{result.answer.nextAction}</strong></div>

      {result.ambiguity.length > 0 && (
        <div className="clarification">
          <strong>{result.ambiguity[0].question}</strong>
          <span>{result.ambiguity[0].reason}</span>
        </div>
      )}

      <details className="answer-details">
        <summary>Show evidence and reasoning</summary>
        <div className="answer-detail-body">
          {result.evidence.length > 0 && <div><strong>Evidence</strong><ul>{result.evidence.map((item) => <li key={item.id}>{item.label} · {item.source}</li>)}</ul></div>}
          {result.answer.limitations?.length ? <div><strong>What is missing</strong><ul>{result.answer.limitations.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
          <div><strong>Quality</strong><span>{result.answerQuality?.passed ? "Passed" : "Blocked until the answer meets its evidence requirements."}</span></div>
        </div>
      </details>
    </section>
  );
}

function Page({ title, eyebrow, intro, children }: { title: string; eyebrow: string; intro: string; children: ReactNode }) {
  return (
    <div className="page">
      <div className="hero-kicker">{eyebrow}</div>
      <h1 className="page-title">{title}</h1>
      <p className="page-intro">{intro}</p>
      {children}
    </div>
  );
}
