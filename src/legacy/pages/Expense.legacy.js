import { getExpenses, getExpense, requireFinanceCutover } from '../../services/financeApi.js'
import { formatRupiah } from '../../utils/format.js'
import { notifyDataChanged } from '../../utils/events.js'
import { canWrite, getOwnerId } from '../../utils/auth.js'
import { getPeriodEndWednesday } from '../../utils/period.js'

let currentWeekStart = getThursdayStart(new Date())

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseLocalDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function getThursdayStart(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day - 4 + 7) % 7
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function getDayName(dateString) {
  const date = parseLocalDate(dateString)
  return date.toLocaleDateString('id-ID', { weekday: 'long' })
}

function showExpenseForm() {
  document.querySelector('#expenseFormContainer').classList.add('show')
  document.querySelector('#toggleExpenseForm').textContent = '✕ Tutup Form'
  document.querySelector('#toggleExpenseForm').classList.add('active')
}

function hideExpenseForm() {
  document.querySelector('#expenseFormContainer').classList.remove('show')
  document.querySelector('#toggleExpenseForm').textContent = '+ Tambah'
  document.querySelector('#toggleExpenseForm').classList.remove('active')
}

export function expenseView() {
  return `
    <section class="card">
      <div class="section-title-row">
        <div>
          <h2>Expense Mingguan</h2>
          <p id="expensePeriodLabel"></p>
        </div>

        <button id="toggleExpenseForm">
          + Tambah
        </button>
      </div>

      <div id="expenseFormContainer" class="hidden-form">
        <form id="expenseForm">
          <input
            type="date"
            id="date_expense"
            value="${formatDate(new Date())}"
            required
          />
          <input type="text" id="expense_name" placeholder="Nama pengeluaran" required />
          <input type="text" id="code" placeholder="Kode, contoh ED/TP/HL" value="ED" required />
          <input type="number" id="amount" placeholder="Nominal" required />
          <button type="submit">Simpan Expense</button>
        </form>
      </div>

      <div class="week-nav">
        <button id="prevWeek">← Prev Week</button>
        <button id="thisWeek">This Week</button>
        <button id="nextWeek">Next Week →</button>
      </div>

      <div id="expenseSummary"></div>
      <div id="expenseList"></div>
    </section>
  `
}

function formatDisplayDate(date) {
  const d = typeof date === 'string'
    ? parseLocalDate(date)
    : date

  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()

  return `${day}/${month}/${year}`
}

export async function loadExpenses() {
  const expenseList = document.querySelector('#expenseList')
  const expenseSummary = document.querySelector('#expenseSummary')
  const expensePeriodLabel = document.querySelector('#expensePeriodLabel')

  const start = currentWeekStart
  const end = addDays(start, 6)

  const startText = formatDate(start)
  const endText = formatDate(end)

  expensePeriodLabel.textContent =
    `Periode ${formatDisplayDate(start)} - ${formatDisplayDate(end)}`

  let data
  try {
    data = await getExpenses(startText, endText)
  } catch (error) {
    expenseList.textContent = `Gagal ambil data: ${error.message}`
    console.error(error)
    return
  }

  const today = formatDate(new Date())

  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(currentWeekStart, index)
    return formatDate(date)
  })

  const visibleWeekDays = weekDays
    .filter(date => date <= today)
    .reverse()

  const dayCount = visibleWeekDays.length

  const totalWeek = data.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const nmiWeek = data.filter(item => String(item.code || '').trim().toUpperCase() === 'NMI').reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const fmWeek = data.filter(item => String(item.code || '').trim().toUpperCase() === 'FM').reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const personalWeek = totalWeek - nmiWeek - fmWeek
  const totalTransaction = data.length
  const averageDaily = dayCount > 0 ? totalWeek / dayCount : 0

  expenseSummary.innerHTML = `
    <div class="summary-grid">
      <div class="summary-card">
        <span>Total Minggu Ini</span>
        <b>${formatRupiah(totalWeek)}</b>
      </div>

      <div class="summary-card">
        <span>Pengeluaran Pribadi</span>
        <b>${formatRupiah(personalWeek)}</b>
      </div>

      <div class="summary-card">
        <span>Dana Talang NMI</span>
        <b>${formatRupiah(nmiWeek)}</b>
      </div>

      <div class="summary-card">
        <span>Biaya Keluarga (FM)</span>
        <b>${formatRupiah(fmWeek)}</b>
      </div>

      <div class="summary-card">
        <span>Jumlah Transaksi</span>
        <b>${totalTransaction}</b>
      </div>

      <div class="summary-card">
        <span>Rata-rata Transaksi</span>
        <b>${formatRupiah(totalTransaction > 0 ? (totalWeek / totalTransaction).toFixed(2) : '0.00')}</b>
      </div>

      <div class="summary-card">
        <span>Rata-rata Harian</span>
        <b>${formatRupiah(averageDaily)}</b>
      </div>
    </div>
  `

  const grouped = data.reduce((acc, item) => {
    if (!acc[item.date_expense]) acc[item.date_expense] = []
    acc[item.date_expense].push(item)
    return acc
  }, {})

  

  const html = visibleWeekDays.map(date => {
    const items = grouped[date] || []
    const dailyTotal = items.reduce((sum, item) => sum + Number(item.amount || 0), 0)

    return `
    <div class="day-group">
      <div class="day-header">
        <div>
          <h3>${getDayName(date)} <span>${formatDisplayDate(date)}</span></h3>
        </div>

        <b>${formatRupiah(dailyTotal)}</b>
      </div>

      ${items.length === 0
        ? `
            <div class="empty-day">
              Tidak ada pengeluaran
            </div>
          `
      : items.map(item => `
        <div class="expense-row compact-expense-row">
          <div class="expense-main">
            <b class="expense-name" data-full-name="${item.expense_name}">
              ${item.expense_name}
            </b>
            <span class="expense-code">${item.code || '-'}</span>
          </div>

          <div class="expense-actions">
            <b>${formatRupiah(item.amount)}</b>

            <div class="expense-menu">
              <button class="menu-btn" data-menu-expense="${item.id}">
                ⋮
              </button>

              <div class="menu-dropdown hidden" id="menu-${item.id}">
                <button class="edit-btn small-btn" data-edit-expense="${item.id}">
                  Edit
                </button>

                <button class="danger-btn small-btn" data-delete-expense="${item.id}">
                  Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      `).join('')
      }
    </div>
  `
  }).join('')

  expenseList.innerHTML = html || `<p>Tidak ada expense pada periode ini.</p>`

  setupExpenseItemEvents()
}



function setupExpenseItemEvents() {
  document.querySelectorAll('.expense-name').forEach(name => {
    name.addEventListener('click', () => {
      name.classList.toggle('expanded-name')
    })
  })
  document.querySelectorAll('[data-menu-expense]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.menuExpense
      const menu = document.querySelector(`#menu-${id}`)

      document.querySelectorAll('.menu-dropdown').forEach(item => {
        if (item !== menu) item.classList.add('hidden')
      })

      menu.classList.toggle('hidden')
    })
  })

  document.querySelectorAll('[data-delete-expense]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!canWrite()) return

      const id = btn.dataset.deleteExpense
      const confirmDelete = confirm('Yakin hapus expense ini?')

      if (!confirmDelete) return

      alert('Penghapusan dinonaktifkan sampai sinkronisasi MySQL selesai.')
    })
  })

  document.querySelectorAll('[data-edit-expense]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.editExpense

      alert('Pengeditan dinonaktifkan sampai sinkronisasi MySQL selesai.')
      return

      document.querySelector('#date_expense').value = data.date_expense
      document.querySelector('#expense_name').value = data.expense_name
      document.querySelector('#code').value = data.code || ''
      document.querySelector('#amount').value = data.amount

      document.querySelector('#expenseForm').dataset.editId = id

      showExpenseForm()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  })
}

export function setupExpenseEvents() {
  const expenseForm = document.querySelector('#expenseForm')
  const toggleExpenseForm = document.querySelector('#toggleExpenseForm')
  const expenseFormContainer = document.querySelector('#expenseFormContainer')
  const prevWeek = document.querySelector('#prevWeek')
  const thisWeek = document.querySelector('#thisWeek')
  const nextWeek = document.querySelector('#nextWeek')

  toggleExpenseForm.addEventListener('click', () => {
    const isOpen = expenseFormContainer.classList.contains('show')
    isOpen ? hideExpenseForm() : showExpenseForm()
  })

  expenseForm.addEventListener('submit', async (e) => {
    e.preventDefault()

    if (!canWrite()) return

    alert('Penyimpanan dinonaktifkan sampai sinkronisasi MySQL selesai.')
  })

  prevWeek.addEventListener('click', () => {
    currentWeekStart = addDays(currentWeekStart, -7)
    setActiveWeekButton(prevWeek)
    loadExpenses()
  })

  thisWeek.addEventListener('click', () => {
    currentWeekStart = getThursdayStart(new Date())
    setActiveWeekButton(thisWeek)
    loadExpenses()
  })

  nextWeek.addEventListener('click', () => {
    currentWeekStart = addDays(currentWeekStart, 7)
    setActiveWeekButton(nextWeek)
    loadExpenses()
  })

  function setActiveWeekButton(activeBtn) {
    document
      .querySelectorAll('.week-nav button')
      .forEach(btn => btn.classList.remove('active'))

    activeBtn.classList.add('active')
  }
  setActiveWeekButton(thisWeek)
}