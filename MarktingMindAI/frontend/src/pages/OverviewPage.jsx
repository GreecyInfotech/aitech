import { ArrowRight, Database, Radar, Rocket, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

function dbStatusBadge(status) {
  if (status === 'available') return 'success'
  if (status === 'error') return 'danger'
  return 'neutral'
}

export function OverviewPage({ overview, health }) {
  if (!overview) {
    return null
  }

  const sqlStatus = health?.database?.status ?? 'loading'
  const mongoStatus = health?.mongodb?.status ?? 'loading'

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Unified front office</p>
          <h3>Operational UX rebuilt from the legacy HTML dashboards.</h3>
          <p className="hero-copy">{overview.headline}</p>
        </div>
        <div className="hero-grid">
          <div className="metric-tile accent-amber">
            <Rocket size={18} />
            <strong>{overview.modules[0].metric}</strong>
            <span>Campaign throughput</span>
          </div>
          <div className="metric-tile accent-teal">
            <Radar size={18} />
            <strong>{overview.modules[1].metric}</strong>
            <span>Automation queue</span>
          </div>
          <div className={`metric-tile accent-cobalt`}>
            <Database size={18} />
            <strong>{sqlStatus}</strong>
            <span>SQL health</span>
          </div>
          <div className={`metric-tile accent-cobalt`}>
            <Database size={18} />
            <strong>{mongoStatus}</strong>
            <span>MongoDB health</span>
          </div>
        </div>
      </section>

      <section className="module-grid">
        {overview.modules.map((module) => (
          <article key={module.slug} className="module-card">
            <div className="module-header">
              <div>
                <p className="eyebrow">Module</p>
                <h4>{module.label}</h4>
              </div>
              <span className="metric-chip">{module.metric}</span>
            </div>
            <p>{module.description}</p>
            <Link className="inline-link" to={`/${module.slug}`}>
              Open workspace
              <ArrowRight size={16} />
            </Link>
          </article>
        ))}
      </section>

      <section className="dual-grid">
        <article className="glass-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Recent activity</p>
              <h4>Operational feed</h4>
            </div>
          </div>
          <div className="activity-list">
            {overview.activity.map((item) => (
              <div key={item.title} className="activity-row">
                <div className="activity-icon">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="glass-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Database health</p>
              <h4>Connection posture</h4>
            </div>
          </div>
          <div className="card-list compact-list">
            <div className="list-card list-card-inline">
              <div><strong>SQL (SQLite / PostgreSQL)</strong><p>{health?.database?.message ?? 'Checking...'}</p></div>
              <span className={`chip-button static ${dbStatusBadge(sqlStatus)}`}>{sqlStatus}</span>
            </div>
            <div className="list-card list-card-inline">
              <div><strong>MongoDB</strong><p>{health?.mongodb?.message ?? 'Checking...'}</p></div>
              <span className={`chip-button static ${dbStatusBadge(mongoStatus)}`}>{mongoStatus}</span>
            </div>
          </div>
          <ul className="check-list" style={{ marginTop: 12 }}>
            <li>API surface is split by module-specific endpoints.</li>
            <li>Database connection is normalized and health-checked on startup.</li>
            <li>Frontend routing preserves all child pages from the source HTML modules.</li>
            <li>Each dashboard is seeded with rich test data while you wire live tables later.</li>
          </ul>
        </article>
      </section>
    </div>
  )
}
