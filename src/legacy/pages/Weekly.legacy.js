import { getSavingUses, getSavingsLedger, getWeeklyChecks, getWeeklyAudit } from '../../services/financeApi.js'
import { formatRupiah } from '../../utils/format.js'
import { notifyDataChanged } from '../../utils/events.js'
import { canWrite, getOwnerId } from '../../utils/auth.js'
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
        <button type="submit" disabled title="Menunggu sinkronisasi MySQL">Simpan Weekly Check (belum aktif)</button>
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

async function loadWeeklyRawChecks() {
  const weeklyRawList = document.querySelector('#weeklyRawList')

  const data = await getWeeklyChecks()
  const error = null

  if (error) {
    weeklyRawList.innerHTML = `<p>Gagal ambil raw weekly check: ${error.message}</p>`
    console.error(error)
    return
  }

  weeklyRawList.innerHTML = data.map(item => `
    <div class="item">
      <b>Periode: ${item.periodic_date}</b><br>
      Cash: ${formatRupiah(item.cash)}
      <br>
      Dana: ${formatRupiah(item.dana)}
      <br>
      Gopay / Seabank: ${formatRupiah(item.gopay)}
      <br>
      BCA / CIMB Niaga: ${formatRupiah(item.bca)}
      <br>
      Total Saldo Aktual: ${formatRupiah(item.real_balance)}
      <br>
      Catatan: ${item.note || '-'}
      <br><br>

      <button class="edit-btn" data-edit-weekly="${item.id}">
        Edit
      </button>

      <button class="danger-btn" data-delete-weekly="${item.id}">
        Hapus
      </button>
    </div>
  `).join('')


}

export function setupWeeklyEvents() {
  document.querySelector('#weeklyCheckForm')?.addEventListener('submit', e => {
    e.preventDefault()
    alert('Input MySQL belum diaktifkan sampai sinkronisasi terakhir selesai.')
  })
  document.querySelector('#loadWeeklyAudit')?.addEventListener('click', () => loadWeeklyChecks().catch(console.error))
  document.querySelector('#loadWeeklyRaw')?.addEventListener('click', () => loadWeeklyChecks().catch(console.error))
}
