import { getIncomes } from '../../services/financeApi.js'
import { formatRupiah } from '../../utils/format.js'
import { notifyDataChanged } from '../../utils/events.js'
import { canWrite, getOwnerId } from '../../utils/auth.js'
import { getPeriodEndWednesday } from '../../utils/period.js'

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function incomeView() {
  return `
    <section class="card">
      <h2>Input Income</h2>
      <p class="form-help">Anjay dapet uang dari siapa?</p>

      <form id="incomeForm">
        <input type="date" id="date_income" value="${formatDate(new Date())}" required />
        <input type="number" id="amount_income" placeholder="Nominal income" required />
        <input type="text" id="note_income" placeholder="Catatan income" />

        <select id="allocation_type" required>
          <option value="">Pilih alokasi</option>
          <option value="auto">Auto</option>
          <option value="balance">Balance</option>
          <option value="nest_egg">Nest Egg</option>
          <option value="wedding">Wedding</option>
          <option value="umrah">Umrah</option>
          <option value="piggy">Piggy</option>
          <option value="trading">Trading</option>
        </select>

        <button type="submit">Simpan Income</button>
      </form>
    </section>

    <section class="card">
      <h2>Data Income</h2>
      <button id="loadIncome">Refresh Data</button>
      <div id="incomeList"></div>
    </section>
  `
}

export async function loadIncomes() {
  const incomeList = document.querySelector('#incomeList')

  let data
  try {
    data = await getIncomes()
  } catch (error) {
    incomeList.textContent = `Gagal ambil income: ${error.message}`
    console.error(error)
    return
  }

  incomeList.innerHTML = data.map(item => `
  <div class="item">
    <b>${item.note || 'Income'}</b><br>
    ${item.date_income} | ${item.allocation_type} | ${formatRupiah(item.amount)}
    <br>
    Periodic: ${item.periodic_date || '-'}
    <br><br>
    <button class="edit-btn" data-edit-income="${item.id}">
      Edit
    </button>
    <button class="danger-btn" data-delete-income="${item.id}">
      Hapus
    </button>
  </div>
`).join('')

  document.querySelectorAll('[data-delete-income]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!canWrite()) return

      const id = btn.dataset.deleteIncome

      const confirmDelete = confirm(
        'Yakin hapus income ini? Allocation dan saving ledger terkait juga akan terhapus.'
      )

      if (!confirmDelete) return

      alert('Penghapusan dinonaktifkan sampai sinkronisasi MySQL selesai.')
    })
  })
  document.querySelectorAll('[data-edit-income]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.editIncome

      alert('Pengeditan dinonaktifkan sampai sinkronisasi MySQL selesai.')
      return

      document.querySelector('#date_income').value = data.date_income
      document.querySelector('#amount_income').value = data.amount
      document.querySelector('#note_income').value = data.note || ''
      document.querySelector('#allocation_type').value = data.allocation_type

      document.querySelector('#incomeForm').dataset.editId = id
    })
  })
}

export function setupIncomeEvents() {
  const incomeForm = document.querySelector('#incomeForm')
  const loadIncome = document.querySelector('#loadIncome')

  incomeForm.addEventListener('submit', async (e) => {
    e.preventDefault()

    if (!canWrite()) return

    alert('Penyimpanan dinonaktifkan sampai sinkronisasi MySQL selesai.')
  })

  loadIncome.addEventListener('click', loadIncomes)
}