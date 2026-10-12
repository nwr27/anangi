import { useCallback, useEffect, useState } from 'react'
import { formatRupiah } from '../utils/format.js'
import styles from './Dashboard.module.css'

function SummaryCard({ label, value, className = '' }) {
  return (
    <div className={`${styles.summaryCard} ${className}`}>
      <span>{label}</span>
      <b>{value === null || value === undefined ? '-' : formatRupiah(value)}</b>
    </div>
  )
}

function DifferenceCard({ value, actualValue }) {
  const hasActual = actualValue !== null && actualValue !== undefined
  if (!hasActual) return <SummaryCard label="Selisih Balance" value={null} className={styles.diffPending} />
  const number = Number(value ?? 0)
  const stateClass = number > 0 ? styles.diffSurplus : number < 0 ? styles.diffDefisit : styles.diffMatch
  return <SummaryCard label="Selisih Balance" value={number} className={stateClass} />
}

export default function Dashboard({ onLogout, currentUser }) {
  const [summary, setSummary] = useState(null)
  const [weekly, setWeekly] = useState(null)
  const [weeklyOffset, setWeeklyOffset] = useState(0)
  const [topCode, setTopCode] = useState({ code: 'Code', total: 0 })
  const [codeStats, setCodeStats] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [expenseBreakdown, setExpenseBreakdown] = useState({ total: 0, nmi: 0, fm: 0, personal: 0 })
  const [summaryError, setSummaryError] = useState('')
  const [weeklyError, setWeeklyError] = useState('')
  const [weeklyExpenseBreakdown, setWeeklyExpenseBreakdown] = useState({ total: 0, nmi: 0, fm: 0, personal: 0 })

  const [periods, setPeriods] = useState([])
  const [expenseStats, setExpenseStats] = useState([])

  const refresh = useCallback(async () => {
    setSummaryError('')
    setWeeklyError('')
    try {
      const [dashboardResponse, periodicResponse] = await Promise.all([
        fetch('/api/dashboard.php', { credentials: 'same-origin', cache: 'no-store' }),
        fetch('/api/periodic.php', { credentials: 'same-origin', cache: 'no-store' }),
      ])
      if (!dashboardResponse.ok || !periodicResponse.ok) {
        throw new Error(`Dashboard HTTP ${dashboardResponse.status}, Periodic HTTP ${periodicResponse.status}`)
      }
      const [dashboard, periodic] = await Promise.all([
        dashboardResponse.json(), periodicResponse.json(),
      ])
      if (dashboard.status !== 'ok' || periodic.status !== 'ok') {
        throw new Error('Respons API tidak valid')
      }
      if (!dashboard.summary || !Array.isArray(dashboard.expense_stats) || !Array.isArray(periodic.periods)) {
        throw new Error('Data API belum lengkap (summary, expense_stats, periods)')
      }
      setSummary(dashboard.summary)
      setPeriods(periodic.periods)
      setExpenseStats(dashboard.expense_stats)
      setWeeklyOffset(0)
    } catch (error) {
      console.error(error)
      // Jangan tampilkan saldo lama sebagai saldo terbaru jika refresh gagal.
      setSummary(null)
      setPeriods([])
      setExpenseStats([])
      setSummaryError(`Gagal mengambil data MySQL: ${error.message}`)
      setWeeklyError('Gagal mengambil audit mingguan.')
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    const handleDataChanged = () => refresh()
    window.addEventListener('finance:data-changed', handleDataChanged)
    return () => window.removeEventListener('finance:data-changed', handleDataChanged)
  }, [refresh])

  useEffect(() => {
    const selected = periods[weeklyOffset] || null
    setWeekly(selected)
  }, [periods, weeklyOffset])

  const calculateBreakdown = useCallback((items) => {
    const total = items.reduce((sum, item) => sum + Number(item.total || 0), 0)
    const nmi = items.filter(item => String(item.code || '').trim().toUpperCase() === 'NMI')
      .reduce((sum, item) => sum + Number(item.total || 0), 0)
    const fm = items.filter(item => String(item.code || '').trim().toUpperCase() === 'FM')
      .reduce((sum, item) => sum + Number(item.total || 0), 0)
    return { total, nmi, fm, personal: total - nmi - fm }
  }, [])

  useEffect(() => {
    setExpenseBreakdown(calculateBreakdown(expenseStats))
    const grouped = expenseStats.reduce((acc, item) => {
      const code = item.code || 'UNKNOWN'
      acc[code] = (acc[code] || 0) + Number(item.total || 0)
      return acc
    }, {})
    const sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1])
    setTopCode(sorted.length ? { code: sorted[0][0], total: sorted[0][1] } : { code: 'Code', total: 0 })
  }, [expenseStats, calculateBreakdown])

  useEffect(() => {
    const selected = periods[weeklyOffset] || null
    setWeeklyExpenseBreakdown(calculateBreakdown(
      selected ? expenseStats.filter(item => item.periodic_date === selected.periodic_date) : []
    ))
  }, [expenseStats, periods, weeklyOffset, calculateBreakdown])

  function openCodeStats() {
    setModalOpen(true)
    const totalExpense = expenseStats.reduce((sum, item) => sum + Number(item.total || 0), 0)
    const grouped = expenseStats.reduce((acc, item) => {
      const code = item.code || 'UNKNOWN'
      acc[code] = (acc[code] || 0) + Number(item.total || 0)
      return acc
    }, {})
    setCodeStats(Object.entries(grouped).sort((a, b) => b[1] - a[1]).map(([code, total]) => ({
      code,
      total,
      percentage: totalExpense > 0 ? `${((total / totalExpense) * 100).toFixed(1)}%` : '0.0%',
    })))
  }

  const availableBalance = Number(summary?.realtime_balance || 0)
  const auditedSaving = Number(summary?.nest_egg || 0) + Number(summary?.wedding || 0) + Number(summary?.umrah || 0)
  const piggy = Number(summary?.piggy || 0)
  const trading = Number(summary?.trading || 0)
  const totalWealth = availableBalance + auditedSaving + piggy + trading

  return (
    <main className={styles.page}>
      <section className={styles.dashboardHeader}>
        <h2>Anangi App</h2>
      </section>

      <section className={styles.card}>
        <div className={`${styles.sectionTitleRow} ${styles.dashboardMainTitle}`}>
          <div className={styles.titleWithUser}>
            <h3>Ringkasan Utama</h3>
            {currentUser && (
              <div className={styles.userBadge} title={`User aktif: ${currentUser.name}`}>
                {currentUser.name}
              </div>
            )}
          </div>
          <div className={styles.dashboardActions}>
            <button onClick={refresh}>Refresh</button>
            <button onClick={onLogout}>Logout</button>
          </div>
        </div>

        {summaryError && <p>{summaryError}</p>}
        {summary && <>
          <div className={styles.heroGrid}>
            <div className={styles.heroCard}><span>Balance Tersedia</span><b>{formatRupiah(availableBalance)}</b><small>Uang biaya hidup yang bebas digunakan</small></div>
            <div className={styles.heroCard}><span>Saving Diaudit</span><b>{formatRupiah(auditedSaving)}</b><small>Nest Egg + Wedding + Umrah</small></div>
            <div className={styles.heroCard}><span>Total Kekayaan</span><b>{formatRupiah(totalWealth)}</b><small>Balance + seluruh saving + aset dingin</small></div>
          </div>

          <h3 className={styles.subTitle}>Rincian Saving</h3>
          <div className={styles.summaryGrid}>
            <SummaryCard label="Nest Egg" value={summary.nest_egg} />
            <SummaryCard label="Wedding" value={summary.wedding} />
            <SummaryCard label="Umrah" value={summary.umrah} />
            <SummaryCard label="Piggy (di luar audit)" value={piggy} />
            <SummaryCard label="Modal Trading (di luar audit)" value={trading} />
            <SummaryCard label="Saving Diaudit" value={auditedSaving} />
            <SummaryCard label="Pengeluaran Pribadi" value={expenseBreakdown.personal} />
            <SummaryCard label="Dana Talang NMI" value={expenseBreakdown.nmi} />
            <SummaryCard label="Biaya Keluarga (FM)" value={expenseBreakdown.fm} />
            <SummaryCard label="Total Pengeluaran" value={expenseBreakdown.total} />
            <SummaryCard label="Total Balance Masuk" value={summary.total_balance_allocation} />
            <button className={`${styles.summaryCard} ${styles.clickableCard}`} onClick={openCodeStats}>
              <span>{topCode.code}</span><b>{formatRupiah(topCode.total)}</b>
            </button>
          </div>
        </>}
      </section>

      <section className={`${styles.card} ${styles.weeklySummaryCard}`}>
        <div className={styles.sectionTitleRow}>
          <h3>Ringkasan Audit Mingguan</h3>
          <div className={styles.weeklyNav}>
            <button onClick={() => setWeeklyOffset(v => Math.max(0, v - 1))} disabled={weeklyOffset === 0}>↑</button>
            <button onClick={() => setWeeklyOffset(v => Math.min(periods.length - 1, v + 1))} disabled={weeklyOffset >= periods.length - 1}>↓</button>
          </div>
        </div>
        {weeklyError && <p>{weeklyError}</p>}
        {!weeklyError && !weekly && <p>Belum ada data weekly summary.</p>}
        {weekly && <div className={styles.weeklyCard}>
          <div className={styles.weeklyCardHeader}><h4>{weekly.periodic_date}</h4><span>Periode</span></div>
          <div className={styles.weeklyGrid}>
            <SummaryCard label="Total Saldo Aktual" value={weekly.actual_total} />
            <SummaryCard label="Saving yang Diaudit" value={weekly.audited_saving} />
            <SummaryCard label="Balance Tersedia Aktual" value={weekly.actual_real_balance} />
            <SummaryCard label="Balance Tersedia Menurut Data" value={weekly.data_balance} />
            <SummaryCard label="Baseline Minggu Lalu" value={weekly.previous_real_balance} />
            <SummaryCard label="Balance Masuk" value={weekly.balance_allocation} />
            <SummaryCard label="Pengeluaran Total Minggu Ini" value={weeklyExpenseBreakdown.total} />
            <SummaryCard label="Pengeluaran Pribadi Minggu Ini" value={weeklyExpenseBreakdown.personal} />
            <SummaryCard label="Dana Talang NMI Minggu Ini" value={weeklyExpenseBreakdown.nmi} />
            <SummaryCard label="Biaya Keluarga (FM) Minggu Ini" value={weeklyExpenseBreakdown.fm} />
            <DifferenceCard value={weekly.difference} actualValue={weekly.actual_real_balance} />
          </div>
        </div>}
      </section>

      {modalOpen && <div className={styles.modal} onMouseDown={e => e.target === e.currentTarget && setModalOpen(false)}>
        <div className={styles.modalContent}>
          <div className={styles.modalHeader}><h3>Persentase Pengeluaran per Kode</h3><button onClick={() => setModalOpen(false)}>✕</button></div>
          {codeStats.map(item => <div className={styles.codeStatRow} key={item.code}>
            <div><b>{item.code}</b></div><div>{formatRupiah(item.total)}</div><div>{item.percentage}</div>
          </div>)}
        </div>
      </div>}
    </main>
  )
}
