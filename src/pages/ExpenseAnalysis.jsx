import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatRupiah } from '../utils/format.js'
import { updateExpense } from '../services/financeApi.js'
import styles from './ExpenseAnalysis.module.css'

function normalizeCode(code) {
  return String(code || 'UNKNOWN').trim().toUpperCase()
}

function getClassification(code) {
  const normalized = normalizeCode(code)
  if (normalized === 'NMI') return 'nmi'
  if (normalized === 'FM') return 'fm'
  return 'personal'
}

function classificationLabel(value) {
  if (value === 'nmi') return 'NMI · Dana Talang'
  if (value === 'fm') return 'FM · Keluarga'
  if (value === 'personal') return 'Biaya Pribadi'
  return 'Semua Pengeluaran'
}

export default function ExpenseAnalysis() {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [classification, setClassification] = useState('all')
  const [code, setCode] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const loadExpenses = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/expenses.php', {
        credentials: 'same-origin',
        cache: 'no-store',
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`)
      if (payload.status !== 'ok' || !Array.isArray(payload.expenses)) {
        throw new Error('Format respons Expense API tidak sesuai')
      }
      setExpenses(payload.expenses)
    } catch (err) {
      setExpenses([])
      setError(err.message || 'Gagal membaca Expense API')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadExpenses() }, [loadExpenses])
  useEffect(() => {
    const handler = () => loadExpenses()
    window.addEventListener('finance:data-changed', handler)
    return () => window.removeEventListener('finance:data-changed', handler)
  }, [loadExpenses])

  const codes = useMemo(() => [...new Set(expenses.map(item => normalizeCode(item.code)))].sort(), [expenses])

  const filtered = useMemo(() => expenses.filter(item => {
    const itemCode = normalizeCode(item.code)
    if (classification !== 'all' && getClassification(itemCode) !== classification) return false
    if (code !== 'all' && itemCode !== code) return false
    if (startDate && item.date_expense < startDate) return false
    if (endDate && item.date_expense > endDate) return false
    return true
  }), [expenses, classification, code, startDate, endDate])

  const stats = useMemo(() => {
    const total = filtered.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    const nmi = filtered.filter(item => getClassification(item.code) === 'nmi').reduce((sum, item) => sum + Number(item.amount || 0), 0)
    const fm = filtered.filter(item => getClassification(item.code) === 'fm').reduce((sum, item) => sum + Number(item.amount || 0), 0)
    const personal = filtered.filter(item => getClassification(item.code) === 'personal').reduce((sum, item) => sum + Number(item.amount || 0), 0)
    return { total, nmi, fm, personal }
  }, [filtered])

  function openEdit(item) {
    setEditing({
      id: item.id,
      date_expense: item.date_expense,
      expense_name: item.expense_name || '',
      code: normalizeCode(item.code) === 'UNKNOWN' ? '' : normalizeCode(item.code),
      amount: String(item.amount ?? ''),
    })
    setEditError('')
  }

  async function saveEdit(event) {
    event.preventDefault()
    if (!editing || saving) return
    setSaving(true)
    setEditError('')
    try {
      await updateExpense(editing)
      setEditing(null)
      await loadExpenses()
      window.dispatchEvent(new Event('finance:data-changed'))
    } catch (err) {
      setEditError(err.message || 'Gagal menyimpan perubahan')
    } finally {
      setSaving(false)
    }
  }

  function chooseClassification(next) {
    setClassification(next)
    if (next === 'nmi') setCode('NMI')
    else if (next === 'fm') setCode('FM')
    else setCode('all')
  }


  function resetFilters() {
    setClassification('all')
    setCode('all')
    setStartDate('')
    setEndDate('')
  }

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div><h2>Analisis Expense</h2><p>Telusuri dana talang NMI, biaya keluarga, dan biaya pribadi.</p></div>
        <button onClick={loadExpenses}>Refresh</button>
      </div>

      <section className={styles.heroGrid}>
        <button className={`${styles.heroCard} ${classification === 'personal' ? styles.active : ''}`} onClick={() => chooseClassification('personal')}>
          <span>Biaya Saya</span><b>{formatRupiah(stats.personal)}</b><small>Selain NMI dan FM</small>
        </button>
        <button className={`${styles.heroCard} ${classification === 'nmi' ? styles.active : ''}`} onClick={() => chooseClassification('nmi')}>
          <span>Dana Talang NMI</span><b>{formatRupiah(stats.nmi)}</b><small>Expense dengan kode NMI</small>
        </button>
        <button className={`${styles.heroCard} ${classification === 'fm' ? styles.active : ''}`} onClick={() => chooseClassification('fm')}>
          <span>Biaya Keluarga</span><b>{formatRupiah(stats.fm)}</b><small>Expense dengan kode FM</small>
        </button>
        <button className={`${styles.heroCard} ${classification === 'all' ? styles.active : ''}`} onClick={() => chooseClassification('all')}>
          <span>Total Pengeluaran</span><b>{formatRupiah(stats.total)}</b><small>Seluruh expense pada filter</small>
        </button>
      </section>

      <section className={styles.card}>
        <div className={styles.filterHeader}><h3>Filter Transaksi</h3><button className={styles.secondary} onClick={resetFilters}>Reset</button></div>
        <div className={styles.filters}>
          <label>Klasifikasi<select value={classification} onChange={e => chooseClassification(e.target.value)}>
            <option value="all">Semua</option><option value="nmi">NMI · Dana Talang</option><option value="fm">FM · Keluarga</option><option value="personal">Biaya Pribadi</option>
          </select></label>
          <label>Kode<select value={code} onChange={e => setCode(e.target.value)}>
            <option value="all">Semua kode</option>{codes.map(item => <option key={item} value={item}>{item}</option>)}
          </select></label>
          <label>Dari<input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
          <label>Sampai<input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></label>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.resultHeader}><div><h3>{classificationLabel(classification)}</h3><span>{filtered.length} transaksi</span></div><b>{formatRupiah(stats.total)}</b></div>
        {loading && <p>Memuat transaksi...</p>}
        {error && <p className={styles.error}>Gagal mengambil data: {error}</p>}
        {!loading && !error && filtered.length === 0 && <div className={styles.empty}>Tidak ada transaksi sesuai filter.</div>}
        <div className={styles.list}>
          {filtered.map(item => <div className={styles.row} key={item.id}>
            <div className={styles.date}>{new Date(`${item.date_expense}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            <div className={styles.main}><b>{item.expense_name}</b><span>{classificationLabel(getClassification(item.code))}</span></div>
            <span className={styles.code}>{normalizeCode(item.code)}</span>
            <b className={styles.amount}>{formatRupiah(item.amount)}</b>
            <button className={styles.editButton} type="button" onClick={() => openEdit(item)}>Edit</button>
          </div>)}
        </div>
      </section>


      {editing && (
        <div className={styles.modalBackdrop} onMouseDown={e => { if (e.target === e.currentTarget && !saving) setEditing(null) }}>
          <form className={styles.editModal} onSubmit={saveEdit} aria-label="Edit pengeluaran">
            <div className={styles.modalHeader}>
              <div><h3>Edit Pengeluaran</h3><span>Perubahan akan disimpan ke database Anangi.</span></div>
              <button type="button" className={styles.closeButton} onClick={() => setEditing(null)} disabled={saving} aria-label="Tutup">✕</button>
            </div>
            <label>Tanggal<input type="date" required value={editing.date_expense} disabled={saving} onChange={e => setEditing(v => ({ ...v, date_expense: e.target.value }))} /></label>
            <label>Keterangan<input type="text" required maxLength={2000} value={editing.expense_name} disabled={saving} onChange={e => setEditing(v => ({ ...v, expense_name: e.target.value }))} /></label>
            <label>Kode<select required value={editing.code} disabled={saving} onChange={e => setEditing(v => ({ ...v, code: e.target.value }))}>
              <option value="">Pilih kode</option>
              {[...new Set([...codes, editing.code])].filter(Boolean).sort().map(c => <option key={c} value={c}>{c}</option>)}
            </select></label>
            <label>Nominal (Rp)<input type="number" required min="1" step="1" value={editing.amount} disabled={saving} onChange={e => setEditing(v => ({ ...v, amount: e.target.value }))} /></label>
            {editError && <p className={styles.error} role="alert">{editError}</p>}
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondary} disabled={saving} onClick={() => setEditing(null)}>Batal</button>
              <button type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</button>
            </div>
          </form>
        </div>
      )}

    </main>
  )
}
