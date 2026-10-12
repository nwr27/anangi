import { getExpenses, createExpense, updateExpense, deleteExpense } from '../../services/financeApi.js'
import { formatRupiah } from '../../utils/format.js'

let currentWeekStart = getThursdayStart(new Date())
let expenseCache = []
let editingExpenseId = null

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

        <button id="toggleExpenseForm" type="button" >
          + Tambah
        </button>
      </div>

      <div id="expenseFormContainer" class="hidden-form">
        <form id="expenseForm">
          <p id="expenseFormStatus" role="status" aria-live="polite"></p>
          <input
            type="date"
            id="date_expense"
            value="${formatDate(new Date())}"
            required
          />
          <input type="text" id="expense_name" placeholder="Nama pengeluaran" required />
          <input type="text" id="code" placeholder="Kode, contoh ED/TP/HL" value="ED" required />
          <input type="number" id="amount" placeholder="Nominal" required />
          <button type="submit" id="expenseSubmit">Simpan Expense</button>
          <button type="button" id="expenseCancel">Batal</button>
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

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char])
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

  expenseCache = data
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
            <b class="expense-name" data-full-name="${escapeHtml(item.expense_name)}">
              ${escapeHtml(item.expense_name)}
            </b>
            <span class="expense-code">${escapeHtml(item.code || '-')}</span>
          </div>

          <div class="expense-actions">
            <b>${formatRupiah(item.amount)}</b>

            <div class="expense-menu">
              <button class="menu-btn" type="button" data-menu-expense="${item.id}">
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
  document.querySelectorAll('[data-edit-expense]').forEach(btn => btn.addEventListener('click', () => {
    const item = expenseCache.find(row => row.id === btn.dataset.editExpense)
    if (!item) return
    editingExpenseId = item.id
    document.querySelector('#date_expense').value = item.date_expense
    document.querySelector('#expense_name').value = item.expense_name
    document.querySelector('#code').value = item.code || ''
    document.querySelector('#amount').value = item.amount
    document.querySelector('#expenseSubmit').textContent = 'Simpan Perubahan'
    document.querySelector('#expenseFormStatus').textContent = ''
    showExpenseForm()
    document.querySelector('#expenseFormContainer').scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }))
  document.querySelectorAll('[data-delete-expense]').forEach(btn => btn.addEventListener('click', async () => {
    const item = expenseCache.find(row => row.id === btn.dataset.deleteExpense)
    if (!item || !window.confirm(`Hapus pengeluaran "${item.expense_name}" sebesar ${formatRupiah(item.amount)}?`)) return
    btn.disabled = true
    try {
      await deleteExpense(item.id)
      await loadExpenses()
    } catch (error) {
      window.alert(`Gagal menghapus: ${error.message}`)
      btn.disabled = false
    }
  }))
}

export function setupExpenseEvents() {
  const form = document.querySelector('#expenseForm')
  const toggle = document.querySelector('#toggleExpenseForm')
  const cancel = document.querySelector('#expenseCancel')
  const resetForm = () => {
    editingExpenseId = null
    form.reset()
    document.querySelector('#date_expense').value = formatDate(new Date())
    document.querySelector('#code').value = 'ED'
    document.querySelector('#expenseSubmit').textContent = 'Simpan Expense'
    document.querySelector('#expenseFormStatus').textContent = ''
    hideExpenseForm()
  }
  toggle.addEventListener('click', () => {
    if (document.querySelector('#expenseFormContainer').classList.contains('show')) resetForm()
    else showExpenseForm()
  })
  cancel.addEventListener('click', resetForm)
  form.addEventListener('submit', async event => {
    event.preventDefault()
    const submit = document.querySelector('#expenseSubmit')
    const status = document.querySelector('#expenseFormStatus')
    const payload = {
      date_expense: document.querySelector('#date_expense').value,
      expense_name: document.querySelector('#expense_name').value.trim(),
      code: document.querySelector('#code').value.trim().toUpperCase(),
      amount: document.querySelector('#amount').value
    }
    if (editingExpenseId) payload.id = editingExpenseId
    submit.disabled = true
    status.textContent = 'Menyimpan…'
    try {
      if (editingExpenseId) await updateExpense(payload)
      else await createExpense(payload)
      const savedDate = parseLocalDate(payload.date_expense)
      currentWeekStart = getThursdayStart(savedDate)
      resetForm()
      await loadExpenses()
    } catch (error) {
      status.textContent = `Gagal menyimpan: ${error.message}`
    } finally {
      submit.disabled = false
    }
  })
  const prevWeek = document.querySelector('#prevWeek')
  const thisWeek = document.querySelector('#thisWeek')
  const nextWeek = document.querySelector('#nextWeek')

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