import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const experiences = ["Workspace", "Discover", "Build", "Library", "Account"] as const;

function App() {
  const [active, setActive] = React.useState<(typeof experiences)[number]>("Workspace");

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="BUSIQ home">BUSIQ</a>
        <nav aria-label="Primary navigation">
          {experiences.map((experience) => (
            <button
              key={experience}
              type="button"
              className={active === experience ? "nav-item active" : "nav-item"}
              aria-current={active === experience ? "page" : undefined}
              onClick={() => setActive(experience)}
            >
              {experience}
            </button>
          ))}
        </nav>
        <button className="quiet-button" type="button">Search</button>
      </header>

      <section className="workspace" aria-labelledby="workspace-title">
        <div className="eyebrow">FOUNDATION · {active.toUpperCase()}</div>
        <h1 id="workspace-title">Business clarity, in one continuous environment.</h1>
        <p className="lede">
          BUSIQ prepares the context, evidence, reasoning and next action around a business decision.
          The person remains in control.
        </p>

        <div className="foundation-grid">
          <article className="surface">
            <span className="surface-label">Intelligence loop</span>
            <h2>Observe → Learn → Connect</h2>
            <p>Analysis, prediction, recommendation and preparation follow from resolved business context.</p>
          </article>
          <article className="surface">
            <span className="surface-label">Resolution</span>
            <h2>Context before action</h2>
            <p>Context, intent, knowledge, learning, environment and time are resolved before intelligence is surfaced.</p>
          </article>
          <article className="surface">
            <span className="surface-label">Trust</span>
            <h2>Glass-box by default</h2>
            <p>Meaning, evidence, assumptions, confidence and methodology remain progressively inspectable.</p>
          </article>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
