import { getWeeklyChecks, getWeeklyAudit, createWeeklyCheck, updateWeeklyCheck, deleteWeeklyCheck } from '../../services/financeApi.js'
import { formatRupiah } from '../../utils/format.js'
import { notifyDataChanged } from '../../utils/events.js'
import { getLatestCompletedWednesday, isWednesday } from '../../utils/period.js'

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function weeklyView() {
  return `
    <section class="card">
      <h2>Input Weekly Check</h2>
      <p class="form-help">Jangan masukkan aset dingin: Piggy atau Trading.</p>

      <form id="weeklyCheckForm">
        <input type="date" id="periodic_date" value="${getLatestCompletedWednesday()}" required />
        <input type="number" id="cash" placeholder="Cash" />
        <input type="number" id="dana" placeholder="Dana" />
        <input type="number" id="gopay" placeholder="Gopay / Seabank" />
        <input type="number" id="bca" placeholder="BCA / CIMB Niaga" />
        <input type="text" id="weekly_note" placeholder="Catatan weekly check" />
        <button type="submit" >Simpan Weekly Check</button>
        <button type="button" id="cancelWeeklyEdit" hidden>Batal Edit</button>
        <p id="weeklyStatus" role="status"></p>
      </form>
    </section>

    <section class="card">
      <h2>Audit Balance Mingguan</h2>
      <button id="loadWeeklyAudit">Refresh Audit</button>
      <div id="weeklyAuditList"></div>
    </section>

    <section class="card">
      <h2>Rincian Saldo Aktual</h2>
      <button id="loadWeeklyRaw">Refresh Rincian</button>
      <div id="weeklyRawList"></div>
    </section>
  `
}

export async function loadWeeklyChecks() {
  await loadWeeklyAudit()
  await loadWeeklyRawChecks()
}

async function loadWeeklyAudit() {
  const weeklyAuditList = document.querySelector('#weeklyAuditList')

  const data = await getWeeklyAudit()
  const error = null

  if (error) {
    weeklyAuditList.innerHTML = `<p>Gagal ambil periodic audit: ${error.message}</p>`
    console.error(error)
    return
  }

  weeklyAuditList.innerHTML = data.map(item => {
    const hasActual = item.actual_real_balance !== null && item.actual_real_balance !== undefined
    const difference = hasActual ? Number(item.difference ?? 0) : null

    let status = hasActual ? 'Match' : 'Pending'
    let statusClass = hasActual ? 'status-match' : 'status-pending'

    if (hasActual && difference > 0) {
      status = 'Surplus'
      statusClass = 'status-surplus'
    }

    if (hasActual && difference < 0) {
      status = 'Defisit'
      statusClass = 'status-defisit'
    }

    return `
      <div class="item">
        <b>Periode: ${item.periodic_date}</b><br>
        Total Saldo Aktual: ${item.actual_total === null ? '-' : formatRupiah(item.actual_total)}
        <br>
        Saving yang Diaudit: ${formatRupiah(item.audited_saving)}
        <br>
        Balance Tersedia Aktual: ${item.actual_real_balance === null ? '-' : formatRupiah(item.actual_real_balance)}
        <br>
        Balance Tersedia Menurut Data: ${formatRupiah(item.data_balance)}
        <br>
        Selisih Balance: ${hasActual ? formatRupiah(item.difference) : '-'}
        <br>
        Status: <span class="status-badge ${statusClass}">${status}</span>
        <br><br>
        Baseline Minggu Lalu: ${formatRupiah(item.previous_real_balance)}
        <br>
        Balance Masuk: ${formatRupiah(item.balance_allocation)}
        <br>
        Pengeluaran: ${formatRupiah(item.expense_usage)}
        <br>
        <small>Piggy dan Modal Trading tidak termasuk dalam audit.</small>
      </div>
    `
  }).join('')
}

let weeklyCache = []
let weeklyEditingId = null
function resetWeekly() {
  weeklyEditingId = null
  const form = document.querySelector('#weeklyCheckForm'); form?.reset()
  document.querySelector('#periodic_date').value = getLatestCompletedWednesday()
  document.querySelector('#cancelWeeklyEdit').hidden = true
}
async function loadWeeklyRawChecks() {
  const list = document.querySelector('#weeklyRawList')
  if (!list) return
  try {
    weeklyCache = await getWeeklyChecks()
    list.replaceChildren()
    if (!weeklyCache.length) { list.textContent = 'Belum ada weekly check.'; return }
    for (const item of weeklyCache) {
      const row = document.createElement('div'); row.className = 'item'
      const detail = document.createElement('div')
      detail.textContent = `${item.periodic_date} | Cash ${formatRupiah(item.cash)} | Dana ${formatRupiah(item.dana)} | Gopay ${formatRupiah(item.gopay)} | BCA ${formatRupiah(item.bca)} | Total ${formatRupiah(item.real_balance)} | ${item.note || '-'}`
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'edit-btn'; edit.textContent = 'Edit'
      edit.addEventListener('click', () => {
        weeklyEditingId = item.id
        for (const field of ['periodic_date','cash','dana','gopay','bca']) document.getElementById(field).value = item[field]
        document.querySelector('#weekly_note').value = item.note || ''
        document.querySelector('#cancelWeeklyEdit').hidden = false
        document.querySelector('#weeklyCheckForm').scrollIntoView({ behavior: 'smooth' })
      })
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'danger-btn'; remove.textContent = 'Hapus'
      remove.addEventListener('click', async () => {
        if (!window.confirm(`Hapus weekly check ${item.periodic_date}? Ini mengubah baseline audit.`)) return
        remove.disabled = true
        try { await deleteWeeklyCheck(item.id); if (weeklyEditingId === item.id) resetWeekly(); await loadWeeklyChecks(); notifyDataChanged() }
        catch (error) { window.alert(error.message); remove.disabled = false }
      })
      row.append(detail, edit, remove); list.append(row)
    }
  } catch (error) { list.textContent = `Gagal memuat weekly: ${error.message}` }
}
export function setupWeeklyEvents() {
  const form = document.querySelector('#weeklyCheckForm')
  const status = document.querySelector('#weeklyStatus')
  document.querySelector('#cancelWeeklyEdit').addEventListener('click', () => { resetWeekly(); status.textContent = '' })
  form.addEventListener('submit', async event => {
    event.preventDefault()
    const payload = { periodic_date: document.querySelector('#periodic_date').value, note: document.querySelector('#weekly_note').value.trim() }
    for (const field of ['cash','dana','gopay','bca']) payload[field] = document.getElementById(field).value || '0'
    if (weeklyEditingId) payload.id = weeklyEditingId
    const submit = form.querySelector('[type="submit"]'); submit.disabled = true
    status.textContent = 'Menyimpan…'
    try {
      if (weeklyEditingId) await updateWeeklyCheck(payload)
      else await createWeeklyCheck(payload)
      resetWeekly(); status.textContent = 'Weekly check berhasil disimpan.'
      await loadWeeklyChecks(); notifyDataChanged()
    } catch (error) { status.textContent = `Gagal menyimpan: ${error.message}` }
    finally { submit.disabled = false }
  })
  document.querySelector('#loadWeeklyAudit')?.addEventListener('click', () => loadWeeklyChecks().catch(console.error))
  document.querySelector('#loadWeeklyRaw')?.addEventListener('click', () => loadWeeklyChecks().catch(console.error))
}
