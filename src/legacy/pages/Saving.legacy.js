import { getSavingUses, getSavingsLedger, getWeeklyChecks, getWeeklyAudit } from '../../services/financeApi.js'
import { formatRupiah } from '../../utils/format.js'
import { notifyDataChanged } from '../../utils/events.js'
import { canWrite, getOwnerId } from '../../utils/auth.js'

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function savingView() {
  return `
    <section class="card">
      <h2>Saving Use</h2>
      <p class="form-help">Hayo balance nya kurang yaa, Boros banget sih lho!</p>

      <form id="savingUseForm">
        <input type="date" id="date_use" value="${formatDate(new Date())}" required />

        <select id="from_save" required>
          <option value="">Ambil dari saving</option>
          <option value="nest_egg">Nest Egg</option>
          <option value="wedding">Wedding</option>
          <option value="umrah">Umrah</option>
          <option value="piggy">Piggy</option>
          <option value="trading">Trading</option>
        </select>

        <select id="to_target" required>
          <option value="">Tujuan</option>
          <option value="balance">Balance</option>
        </select>

        <input type="number" id="amount_use" placeholder="Nominal" required />
        <input type="text" id="note_use" placeholder="Catatan" />

        <button type="submit" disabled title="Menunggu sinkronisasi MySQL">Simpan Saving Use (belum aktif)</button>
      </form>
    </section>

    <section class="card">
      <h2>Saving Ledger</h2>
      <button id="loadSaving">Refresh Data</button>
      <div id="savingList"></div>
    </section>

    <section class="card">
      <h2>Saving Use History</h2>
      <button id="loadSavingUses">Refresh Saving Uses</button>
      <div id="savingUseList"></div>
    </section>
  `
}

export async function loadSavings() {
  const savingList = document.querySelector('#savingList')

  const data = await getSavingsLedger()
  const error = null

  if (error) {
    savingList.innerHTML = `<p>Gagal ambil saving: ${error.message}</p>`
    console.error(error)
    return
  }

  savingList.innerHTML = data.map(item => `
    <div class="item">
      <b>${item.type_save}</b><br>
      ${item.date_save} | ${formatRupiah(item.amount)}
      <br>
      Note: ${item.note || '-'}
      <br>
      Periodic: ${item.periodic_date || '-'}
    </div>
  `).join('')
}

export async function loadSavingUses() {
  const savingUseList = document.querySelector('#savingUseList')

  const data = await getSavingUses()
  const error = null

  if (error) {
    savingUseList.innerHTML = `<p>Gagal ambil saving use: ${error.message}</p>`
    console.error(error)
    return
  }

  savingUseList.innerHTML = data.map(item => `
    <div class="item">
      <b>${item.from_save} → ${item.to_target}</b><br>
      ${item.date_use} | ${formatRupiah(item.amount)}
      <br>
      Note: ${item.note || '-'}
      <br>
      Periodic: ${item.periodic_date || '-'}
      <br><br>
      <button class="danger-btn" data-delete-saving-use="${item.id}">
        Hapus
      </button>
    </div>
  `).join('')

  document
    .querySelectorAll('[data-delete-saving-use]')
    .forEach(btn => {

      btn.addEventListener('click', async () => {

        if (!canWrite()) return

        const id = btn.dataset.deleteSavingUse

        const confirmDelete = confirm(
          'Yakin hapus saving use ini?'
        )

        if (!confirmDelete) return

        const { error } = await supabase
          .from('saving_uses')
          .delete()
          .eq('id', id)
          .eq('owner_id', getOwnerId())

        if (error) {
          alert('Gagal hapus saving use: ' + error.message)
          console.error(error)
          return
        }

        alert('Saving use berhasil dihapus')

        loadSavings()
        loadSavingUses()
        notifyDataChanged()
      })
    })
  document.querySelectorAll('[data-edit-saving-use]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.editSavingUse

      const { data, error } = await supabase
        .from('saving_uses')
        .select('*')
        .eq('id', id)
        .eq('owner_id', getOwnerId())
        .single()

      if (error) {
        alert('Gagal ambil saving use: ' + error.message)
        console.error(error)
        return
      }

      document.querySelector('#date_use').value = data.date_use
      document.querySelector('#from_save').value = data.from_save
      document.querySelector('#to_target').value = data.to_target
      document.querySelector('#amount_use').value = data.amount
      document.querySelector('#note_use').value = data.note || ''

      document.querySelector('#savingUseForm').dataset.editId = id
    })
  })
}

export function setupSavingEvents() {
  document.querySelector('#savingUseForm')?.addEventListener('submit', e => {
    e.preventDefault()
    alert('Input MySQL belum diaktifkan sampai sinkronisasi terakhir selesai.')
  })
  document.querySelector('#loadSaving')?.addEventListener('click', () => loadSavings().catch(console.error))
  document.querySelector('#loadSavingUses')?.addEventListener('click', () => loadSavingUses().catch(console.error))
}
