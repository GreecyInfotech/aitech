import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useEffect, useMemo, useState } from 'react'

import { filterDayReportDashboard } from '../api/client'
import { isDateRangeValid } from '../utils/validators'

function extractNumeric(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const match = value.match(/-?\d+(\.\d+)?/)
    return match ? Number(match[0]) : 0
  }

  return 0
}

function aggregateByDay(rows) {
  const grouped = new Map()

  rows.forEach((row) => {
    const current = grouped.get(row.date) ?? {
      date: row.date,
      linkedin: 0,
      calls: 0,
      sourced: 0,
      marketing: 0,
    }

    current.linkedin += extractNumeric(row.linkedin)
    current.calls += extractNumeric(row.calls)
    current.sourced += extractNumeric(row.sourced)
    current.marketing += extractNumeric(row.marketing)
    grouped.set(row.date, current)
  })

  return Array.from(grouped.values()).sort((left, right) => left.date.localeCompare(right.date))
}

function recruiterTotals(rows) {
  const grouped = new Map()

  rows.forEach((row) => {
    grouped.set(row.recruiter, (grouped.get(row.recruiter) ?? 0) + extractNumeric(row.sourced))
  })

  return Array.from(grouped.entries())
    .map(([recruiter, sourced]) => ({ recruiter, sourced }))
    .sort((left, right) => right.sourced - left.sourced)
}

function technologyTotals(rows) {
  const grouped = new Map()

  rows.forEach((row) => {
    row.technology
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((tech) => {
        grouped.set(tech, (grouped.get(tech) ?? 0) + 1)
      })
  })

  return Array.from(grouped.entries())
    .map(([technology, count]) => ({ technology, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 10)
}

function sumMetric(rows, field) {
  return rows.reduce((accumulator, row) => accumulator + extractNumeric(row[field]), 0)
}

function fmtInt(value) {
  return Math.round(value).toLocaleString()
}

export function DayReportPage({ workspace }) {
  const [draftStart, setDraftStart] = useState('')
  const [draftEnd, setDraftEnd] = useState('')
  const [draftRecruiter, setDraftRecruiter] = useState('__all__')
  const [rangeText, setRangeText] = useState('')
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState([])
  const [recruiters, setRecruiters] = useState([])
  const [minDate, setMinDate] = useState('')
  const [maxDate, setMaxDate] = useState('')
  const [validationMessage, setValidationMessage] = useState('')

  useEffect(() => {
    if (!workspace) {
      return
    }

    setRows(workspace.rows)
    setRecruiters(workspace.recruiters)
    setDraftStart(workspace.range.start)
    setDraftEnd(workspace.range.end)
    setMinDate(workspace.range.start)
    setMaxDate(workspace.range.end)
    setRangeText(`${workspace.range.start} to ${workspace.range.end}`)
  }, [workspace])

  if (!workspace) {
    return null
  }

  const applyFilters = async () => {
    if (!isDateRangeValid(draftStart, draftEnd)) {
      setValidationMessage('Start date cannot be after end date.')
      return
    }

    setValidationMessage('')
    setBusy(true)
    try {
      const payload = {
        start: draftStart || null,
        end: draftEnd || null,
        recruiter: draftRecruiter === '__all__' ? null : draftRecruiter,
      }

      const response = await filterDayReportDashboard(payload)
      setRows(response.rows)
      setRecruiters(response.recruiters)
      setRangeText(`${draftStart || workspace.range.start} to ${draftEnd || workspace.range.end}`)
    } catch {
      // Fallback to local filtering if API call fails.
      const locallyFiltered = workspace.rows.filter((row) => {
        const afterStart = !draftStart || row.date >= draftStart
        const beforeEnd = !draftEnd || row.date <= draftEnd
        const recruiterMatch = draftRecruiter === '__all__' || row.recruiter === draftRecruiter
        return afterStart && beforeEnd && recruiterMatch
      })
      setRows(locallyFiltered)
      setRangeText(`${draftStart || workspace.range.start} to ${draftEnd || workspace.range.end}`)
    } finally {
      setBusy(false)
    }
  }

  const resetFilters = async () => {
    setDraftStart(workspace.range.start)
    setDraftEnd(workspace.range.end)
    setDraftRecruiter('__all__')
    setBusy(true)
    setValidationMessage('')

    try {
      const response = await filterDayReportDashboard({
        start: workspace.range.start,
        end: workspace.range.end,
        recruiter: null,
      })
      setRows(response.rows)
      setRecruiters(response.recruiters)
      setRangeText(`${workspace.range.start} to ${workspace.range.end}`)
    } catch {
      setRows(workspace.rows)
      setRecruiters(workspace.recruiters)
      setRangeText(`${workspace.range.start} to ${workspace.range.end}`)
    } finally {
      setBusy(false)
    }
  }

  const totals = useMemo(
    () => ({
      linkedin: sumMetric(rows, 'linkedin'),
      calls: sumMetric(rows, 'calls'),
      sourced: sumMetric(rows, 'sourced'),
      marketing: sumMetric(rows, 'marketing'),
    }),
    [rows],
  )

  const trendRows = useMemo(() => aggregateByDay(rows), [rows])
  const recruiterRows = useMemo(() => recruiterTotals(rows), [rows])
  const technologyRows = useMemo(() => technologyTotals(rows), [rows])
  const recentRows = useMemo(() => [...rows].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 25), [rows])

  return (
    <div className="page-stack day-report-page">
      <section className="hero-panel compact">
        <div>
          <p className="eyebrow">DAY TO DAY REPORT Dashboard</p>
          <h3>Filters drive all charts and KPI cards.</h3>
          <p className="hero-copy">Data range: {rangeText}</p>
        </div>
      </section>

      <section className="glass-card day-report-controls">
        {validationMessage ? <div className="banner error">{validationMessage}</div> : null}
        <div className="form-grid day-filter-grid">
          <label>
            Start date
            <input type="date" min={minDate} max={maxDate} value={draftStart} onChange={(event) => setDraftStart(event.target.value)} />
          </label>
          <label>
            End date
            <input type="date" min={minDate} max={maxDate} value={draftEnd} onChange={(event) => setDraftEnd(event.target.value)} />
          </label>
          <label>
            Recruiter
            <select value={draftRecruiter} onChange={(event) => setDraftRecruiter(event.target.value)}>
              <option value="__all__">All</option>
              {recruiters.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <div className="button-row">
            <button className="primary-button" type="button" disabled={busy} onClick={applyFilters}>{busy ? 'Applying...' : 'Apply'}</button>
            <button className="secondary-button" type="button" disabled={busy} onClick={resetFilters}>Reset</button>
          </div>
        </div>
      </section>

      <section className="stat-row four-up">
        <article className="metric-card"><span>Total Linkedin Connections</span><strong>{fmtInt(totals.linkedin)}</strong><small>Filtered period</small></article>
        <article className="metric-card"><span>Total Daily Calls</span><strong>{fmtInt(totals.calls)}</strong><small>Filtered period</small></article>
        <article className="metric-card"><span>Total Sourced Data</span><strong>{fmtInt(totals.sourced)}</strong><small>Filtered period</small></article>
        <article className="metric-card"><span>Total Marketing/Submissions</span><strong>{fmtInt(totals.marketing)}</strong><small>Filtered period</small></article>
      </section>

      <section className="chart-grid">
        <article className="glass-card chart-card span-two">
          <div className="section-heading"><div><p className="eyebrow">Daily trend</p><h4>Totals across filtered period</h4></div></div>
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={trendRows}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="date" stroke="#98a4d3" />
              <YAxis stroke="#98a4d3" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="sourced" stroke="#2dd4bf" strokeWidth={3} name="Sourced Data" />
              <Line type="monotone" dataKey="calls" stroke="#ff7a18" strokeWidth={3} name="Daily Calls" />
              <Line type="monotone" dataKey="linkedin" stroke="#8b5cf6" strokeWidth={2} name="Linkedin Connections" />
              <Line type="monotone" dataKey="marketing" stroke="#60a5fa" strokeWidth={2} name="Marketing/Submissions" />
            </LineChart>
          </ResponsiveContainer>
        </article>

        <article className="glass-card chart-card">
          <div className="section-heading"><div><p className="eyebrow">Recruiter totals</p><h4>Sourced Data</h4></div></div>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={recruiterRows} layout="vertical">
              <CartesianGrid stroke="rgba(255,255,255,0.08)" horizontal={false} />
              <XAxis type="number" stroke="#98a4d3" />
              <YAxis type="category" dataKey="recruiter" stroke="#98a4d3" width={90} />
              <Tooltip />
              <Bar dataKey="sourced" fill="#2dd4bf" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </article>

        <article className="glass-card chart-card">
          <div className="section-heading"><div><p className="eyebrow">Metric mix</p><h4>Stacked by day</h4></div></div>
          <ResponsiveContainer width="100%" height={340}>
            <AreaChart data={trendRows}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="date" stroke="#98a4d3" />
              <YAxis stroke="#98a4d3" />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="sourced" stackId="1" stroke="#2dd4bf" fill="#2dd4bf" name="Sourced Data" />
              <Area type="monotone" dataKey="calls" stackId="1" stroke="#ff7a18" fill="#ff7a18" name="Daily Calls" />
              <Area type="monotone" dataKey="linkedin" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" name="Linkedin" />
              <Area type="monotone" dataKey="marketing" stackId="1" stroke="#60a5fa" fill="#60a5fa" name="Marketing" />
            </AreaChart>
          </ResponsiveContainer>
        </article>

        <article className="glass-card chart-card">
          <div className="section-heading"><div><p className="eyebrow">Top technologies</p><h4>By entry count</h4></div></div>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={technologyRows} layout="vertical">
              <CartesianGrid stroke="rgba(255,255,255,0.08)" horizontal={false} />
              <XAxis type="number" stroke="#98a4d3" />
              <YAxis type="category" dataKey="technology" stroke="#98a4d3" width={140} />
              <Tooltip />
              <Bar dataKey="count" fill="#ff7a18" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </article>
      </section>

      <article className="glass-card">
        <div className="section-heading"><div><p className="eyebrow">Recent activity</p><h4>Latest 25 rows</h4></div></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Recruiter</th>
                <th>Technology</th>
                <th>Linkedin</th>
                <th>Calls</th>
                <th>Sourced</th>
                <th>Marketing</th>
                <th>Notes?</th>
              </tr>
            </thead>
            <tbody>
              {recentRows.map((row, index) => (
                <tr key={`${row.date}-${row.recruiter}-${index}`}>
                  <td>{row.date}</td>
                  <td>{row.recruiter}</td>
                  <td>{row.technology}</td>
                  <td>{fmtInt(extractNumeric(row.linkedin))}</td>
                  <td>{fmtInt(extractNumeric(row.calls))}</td>
                  <td>{fmtInt(extractNumeric(row.sourced))}</td>
                  <td>{fmtInt(extractNumeric(row.marketing))}</td>
                  <td>{row.notes?.trim() ? 'Yes' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <p className="support-copy">Tip: if values are messy free text, numeric extraction takes the first number it finds.</p>
    </div>
  )
}