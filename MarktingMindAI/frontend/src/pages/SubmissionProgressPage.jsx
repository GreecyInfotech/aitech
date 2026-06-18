import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useMemo, useState } from 'react'
import { isMonthRangeValid } from '../utils/validators'

function tone(value) {
  if (value === null || value === undefined) {
    return 'neutral'
  }
  return value >= 0 ? 'positive' : 'negative'
}

export function SubmissionProgressPage({ workspace }) {
  const [startMonth, setStartMonth] = useState(workspace?.range.start ?? '')
  const [endMonth, setEndMonth] = useState(workspace?.range.end ?? '')
  const [validationMessage, setValidationMessage] = useState('')

  const validRange = isMonthRangeValid(startMonth, endMonth)

  const filteredMonths = useMemo(() => {
    if (!workspace) {
      return []
    }

    if (!validRange) {
      return []
    }

    return workspace.months.filter((row) => row.month >= startMonth && row.month <= endMonth)
  }, [endMonth, startMonth, validRange, workspace])

  if (!workspace) {
    return null
  }

  const total = filteredMonths.reduce((current, row) => current + row.submissions, 0)
  const average = filteredMonths.length ? Math.round(total / filteredMonths.length) : 0

  return (
    <div className="page-stack">
      <section className="hero-panel compact">
        <div>
          <p className="eyebrow">Submission progress</p>
          <h3>MoM and YoY tracking, rebuilt for the React analytics layer.</h3>
          <p className="hero-copy">Filter the calendar month range and keep the historical comparison logic intact from the original dashboard.</p>
        </div>
        <div className="filter-bar wide-filters">
          <label>
            Start month
            <input
              type="month"
              value={startMonth}
              min={workspace.range.start}
              max={workspace.range.end}
              onChange={(event) => {
                const nextStart = event.target.value
                setStartMonth(nextStart)
                if (!isMonthRangeValid(nextStart, endMonth)) {
                  setValidationMessage('Start month cannot be after end month.')
                } else {
                  setValidationMessage('')
                }
              }}
            />
          </label>
          <label>
            End month
            <input
              type="month"
              value={endMonth}
              min={workspace.range.start}
              max={workspace.range.end}
              onChange={(event) => {
                const nextEnd = event.target.value
                setEndMonth(nextEnd)
                if (!isMonthRangeValid(startMonth, nextEnd)) {
                  setValidationMessage('Start month cannot be after end month.')
                } else {
                  setValidationMessage('')
                }
              }}
            />
          </label>
        </div>
      </section>

      {validationMessage ? <div className="banner error">{validationMessage}</div> : null}

      <section className="stat-row two-up">
        <article className="metric-card"><span>Total submissions</span><strong>{total}</strong></article>
        <article className="metric-card"><span>Average per month</span><strong>{average}</strong></article>
      </section>

      <section className="chart-grid">
        <article className="glass-card chart-card span-two">
          <div className="section-heading"><div><p className="eyebrow">Trend line</p><h4>Submission volume by month</h4></div></div>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={filteredMonths}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="month" stroke="#98a4d3" />
              <YAxis stroke="#98a4d3" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="submissions" stroke="#ff9457" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </article>

        <article className="glass-card chart-card">
          <div className="section-heading"><div><p className="eyebrow">MoM</p><h4>Month over month change</h4></div></div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={filteredMonths}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="month" stroke="#98a4d3" />
              <YAxis stroke="#98a4d3" />
              <Tooltip />
              <Bar dataKey="mom" radius={[8, 8, 0, 0]}>
                {filteredMonths.map((entry) => (
                  <Cell key={entry.month} fill={entry.mom === null ? '#64748b' : entry.mom >= 0 ? '#30c0c7' : '#ff9457'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </article>

        <article className="glass-card chart-card">
          <div className="section-heading"><div><p className="eyebrow">YoY</p><h4>Year over year change</h4></div></div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={filteredMonths}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="month" stroke="#98a4d3" />
              <YAxis stroke="#98a4d3" />
              <Tooltip />
              <Bar dataKey="yoy" radius={[8, 8, 0, 0]}>
                {filteredMonths.map((entry) => (
                  <Cell key={entry.month} fill={entry.yoy === null ? '#64748b' : entry.yoy >= 0 ? '#30c0c7' : '#ff9457'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </article>
      </section>

      <article className="glass-card">
        <div className="section-heading"><div><p className="eyebrow">Monthly table</p><h4>Submission deltas</h4></div></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Submissions</th>
                <th>MoM</th>
                <th>YoY</th>
              </tr>
            </thead>
            <tbody>
              {filteredMonths.map((row) => (
                <tr key={row.month}>
                  <td>{row.month}</td>
                  <td>{row.submissions}</td>
                  <td><span className={`delta-pill ${tone(row.mom)}`}>{row.mom === null ? 'N/A' : `${row.mom}%`}</span></td>
                  <td><span className={`delta-pill ${tone(row.yoy)}`}>{row.yoy === null ? 'N/A' : `${row.yoy}%`}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  )
}
