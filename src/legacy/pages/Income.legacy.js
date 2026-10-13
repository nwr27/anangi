import { getIncomes, createIncome, updateIncome, deleteIncome } from '../../services/financeApi.js'
import { formatRupiah } from '../../utils/format.js'
import { notifyDataChanged } from '../../utils/events.js'

let incomeCache = []
let editingId = null
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function incomeView() {
  return `
    <section class="card">
      <h2>Income</h2>
      <p class="form-help">Anjay dapet duit dari siapa nich?</p>
      <form id="incomeForm">
        <input type="date" id="date_income" value="${today()}" required />
        <input type="number" id="amount_income" min="1" step="1" placeholder="Nominal income" required />
        <input type="text" id="note_income" maxlength="2000" placeholder="Catatan income" />
        <select id="allocation_type" required>
          <option value="">Pilih alokasi</option>
          <option value="auto">Auto (30/30/30/10)</option>
          <option value="balance">Balance</option>
          <option value="nest_egg">Nest Egg</option>
          <option value="wedding">Wedding</option>
          <option value="umrah">Umrah</option>
          <option value="piggy">Piggy</option>
          <option value="trading">Trading</option>
        </select>
        <button type="submit" id="incomeSubmit">Simpan Income</button>
        <button type="button" id="incomeCancel" hidden>Batal Edit</button>
        <p id="incomeStatus" role="status"></p>
      </form>
    </section>
    <section class="card">
      <h2>Data Income</h2>
      <button type="button" id="loadIncome">Refresh Data</button>
      <div id="incomeList"></div>
    </section>
  `
}

function resetIncomeForm() {
  editingId = null
  document.querySelector('#incomeForm').reset()
  document.querySelector('#date_income').value = today()
  document.querySelector('#incomeSubmit').textContent = 'Simpan Income'
  document.querySelector('#incomeCancel').hidden = true
}

export async function loadIncomes() {
  const list = document.querySelector('#incomeList')
  if (!list) return
  try {
    incomeCache = await getIncomes()
    list.replaceChildren()
    if (!incomeCache.length) { list.textContent = 'Belum ada income.'; return }
    for (const item of incomeCache) {
      const row = document.createElement('div')
      row.className = 'item'
      const description = document.createElement('div')
      const name = document.createElement('b')
      name.textContent = item.note || 'Income'
      description.append(name, document.createElement('br'))
      const detail = document.createElement('span')
      detail.textContent = `${item.date_income} | ${item.allocation_type} | ${formatRupiah(item.amount)} | Periode ${item.periodic_date || '-'}`
      description.append(detail)
      const edit = document.createElement('button')
      edit.type = 'button'; edit.textContent = 'Edit'; edit.className = 'edit-btn'
      edit.addEventListener('click', () => {
        editingId = item.id
        document.querySelector('#date_income').value = item.date_income
        document.querySelector('#amount_income').value = item.amount
        document.querySelector('#note_income').value = item.note || ''
        document.querySelector('#allocation_type').value = item.allocation_type
        document.querySelector('#incomeSubmit').textContent = 'Simpan Perubahan'
        document.querySelector('#incomeCancel').hidden = false
        document.querySelector('#incomeStatus').textContent = 'Mode edit income'
        document.querySelector('#incomeForm').scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
      const remove = document.createElement('button')
      remove.type = 'button'; remove.textContent = 'Hapus'; remove.className = 'danger-btn'
      remove.addEventListener('click', async () => {
        if (!window.confirm(`Hapus income ${formatRupiah(item.amount)}? Semua alokasi otomatis dari income ini juga akan dihapus.`)) return
        remove.disabled = true
        try {
          await deleteIncome(item.id)
          if (editingId === item.id) resetIncomeForm()
          await loadIncomes()
          notifyDataChanged()
        } catch (error) {
          window.alert(`Gagal menghapus income: ${error.message}`)
          remove.disabled = false
        }
      })
      row.append(description, edit, remove)
      list.append(row)
    }
  } catch (error) { list.textContent = `Gagal mengambil income: ${error.message}` }
}

export function setupIncomeEvents() {
  const form = document.querySelector('#incomeForm')
  const submit = document.querySelector('#incomeSubmit')
  const status = document.querySelector('#incomeStatus')
  document.querySelector('#incomeCancel').addEventListener('click', () => { resetIncomeForm(); status.textContent = '' })
  document.querySelector('#loadIncome').addEventListener('click', loadIncomes)
  form.addEventListener('submit', async event => {
    event.preventDefault()
    const payload = {
      date_income: document.querySelector('#date_income').value,
      amount: document.querySelector('#amount_income').value,
      note: document.querySelector('#note_income').value.trim(),
      allocation_type: document.querySelector('#allocation_type').value,
    }
    if (editingId) payload.id = editingId
    submit.disabled = true
    status.textContent = 'Menyimpan…'
    try {
      if (editingId) await updateIncome(payload)
      else await createIncome(payload)
      resetIncomeForm()
      status.textContent = 'Income berhasil disimpan.'
      await loadIncomes()
      notifyDataChanged()
    } catch (error) { status.textContent = `Gagal menyimpan: ${error.message}` }
    finally { submit.disabled = false }
  })
}
