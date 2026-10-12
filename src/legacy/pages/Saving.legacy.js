import { getSavingUses, getSavingsLedger, createSavingUse, updateSavingUse, deleteSavingUse } from '../../services/financeApi.js'
import { formatRupiah } from '../../utils/format.js'
import { notifyDataChanged } from '../../utils/events.js'

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

        <button type="submit" >Simpan Saving Use</button>
        <button type="button" id="cancelSavingEdit" hidden>Batal Edit</button>
        <p id="savingStatus" role="status"></p>
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
  savingList.replaceChildren()
  if (!data.length) { savingList.textContent = 'Belum ada saving ledger.'; return }
  for (const item of data) {
    const row = document.createElement('div')
    row.className = 'item'
    const name = document.createElement('b')
    name.textContent = item.type_save
    const details = document.createElement('div')
    details.textContent = `${item.date_save} | ${formatRupiah(item.amount)}`
    const note = document.createElement('div')
    note.textContent = `Note: ${item.note || '-'}`
    const period = document.createElement('div')
    period.textContent = `Periodic: ${item.periodic_date || '-'}`
    row.append(name, details, note, period)
    savingList.append(row)
  }
}

let savingCache = []
let editingId = null
function resetSaving() {
  editingId = null
  const form = document.querySelector('#savingUseForm')
  form?.reset()
  document.querySelector('#date_use').value = formatDate(new Date())
  document.querySelector('#cancelSavingEdit').hidden = true
}
export async function loadSavingUses() {
  const list = document.querySelector('#savingUseList')
  if (!list) return
  try {
    savingCache = await getSavingUses()
    list.replaceChildren()
    if (!savingCache.length) { list.textContent = 'Belum ada saving use.'; return }
    for (const item of savingCache) {
      const row = document.createElement('div'); row.className = 'item'
      const detail = document.createElement('div')
      detail.textContent = `${item.date_use} | ${item.from_save} → ${item.to_target} | ${formatRupiah(item.amount)} | ${item.note || '-'}`
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'edit-btn'; edit.textContent = 'Edit'
      edit.addEventListener('click', () => {
        editingId = item.id
        for (const [field, value] of Object.entries({ date_use: item.date_use, from_save: item.from_save, to_target: item.to_target, amount_use: item.amount, note_use: item.note || '' })) document.getElementById(field).value = value
        document.querySelector('#cancelSavingEdit').hidden = false
        document.querySelector('#savingUseForm').scrollIntoView({ behavior: 'smooth' })
      })
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'danger-btn'; remove.textContent = 'Hapus'
      remove.addEventListener('click', async () => {
        if (!window.confirm(`Hapus saving use ${formatRupiah(item.amount)}?`)) return
        remove.disabled = true
        try { await deleteSavingUse(item.id); if (editingId === item.id) resetSaving(); await Promise.all([loadSavings(), loadSavingUses()]); notifyDataChanged() }
        catch (error) { window.alert(error.message); remove.disabled = false }
      })
      row.append(detail, edit, remove); list.append(row)
    }
  } catch (error) { list.textContent = `Gagal memuat saving use: ${error.message}` }
}
export function setupSavingEvents() {
  const form = document.querySelector('#savingUseForm')
  const status = document.querySelector('#savingStatus')
  document.querySelector('#cancelSavingEdit').addEventListener('click', () => { resetSaving(); status.textContent = '' })
  form.addEventListener('submit', async event => {
    event.preventDefault()
    const payload = {
      date_use: document.querySelector('#date_use').value,
      from_save: document.querySelector('#from_save').value,
      to_target: document.querySelector('#to_target').value,
      amount: document.querySelector('#amount_use').value,
      note: document.querySelector('#note_use').value.trim(),
    }
    if (editingId) payload.id = editingId
    const submit = form.querySelector('[type="submit"]'); submit.disabled = true
    status.textContent = 'Menyimpan…'
    try {
      if (editingId) await updateSavingUse(payload)
      else await createSavingUse(payload)
      resetSaving(); status.textContent = 'Saving use berhasil disimpan.'
      await Promise.all([loadSavings(), loadSavingUses()]); notifyDataChanged()
    } catch (error) { status.textContent = `Gagal menyimpan: ${error.message}` }
    finally { submit.disabled = false }
  })
  document.querySelector('#loadSaving')?.addEventListener('click', () => loadSavings().catch(console.error))
  document.querySelector('#loadSavingUses')?.addEventListener('click', () => loadSavingUses().catch(console.error))
}
