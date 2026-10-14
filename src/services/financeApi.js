async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...options,
  })

  const data = await response.json().catch(() => ({}))

  if (response.status === 401) {
    window.dispatchEvent(new Event('anangi:session-expired'))
    throw new Error('Sesi login berakhir')
  }

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`)
  }

  return data
}

export async function getExpenses(from, to) {
  const query = new URLSearchParams({ from, to })
  return (await api(`/api/expenses.php?${query}`)).expenses
}
export async function getExpense(id) {
  const query = new URLSearchParams({ id })
  return (await api(`/api/expenses.php?${query}`)).expenses[0] || null
}
export async function getIncomes() {
  return (await api('/api/incomes.php')).incomes
}
export async function getIncome(id) {
  const query = new URLSearchParams({ id })
  return (await api(`/api/incomes.php?${query}`)).incomes[0] || null
}
// Writes are deliberately disabled until the final Supabase-to-MySQL cutover.
export function requireFinanceCutover() {
  throw new Error('Input/edit/hapus MySQL belum diaktifkan. Selesaikan sinkronisasi data terakhir terlebih dahulu.')
}

export async function getSavingUses() {
  return (await api('/api/saving-uses.php')).saving_uses
}
export async function getSavingsLedger() {
  return (await api('/api/savings-ledger.php')).savings_ledger
}
export async function getWeeklyChecks() {
  return (await api('/api/weekly-checks.php')).weekly_checks
}
export async function getWeeklyAudit() {
  return (await api('/api/periodic.php')).periods
}

export async function createExpense(payload) {
  return api('/api/expenses.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
}
export async function updateExpense(payload) {
  return api('/api/expenses.php', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
}
export async function deleteExpense(id) {
  return api('/api/expenses.php', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
}

export async function createIncome(payload) {
  return api('/api/incomes.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
}
export async function updateIncome(payload) {
  return api('/api/incomes.php', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
}
export async function deleteIncome(id) {
  return api('/api/incomes.php', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
}

export const createSavingUse = payload => api('/api/saving-uses.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
export const updateSavingUse = payload => api('/api/saving-uses.php', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
export const deleteSavingUse = id => api('/api/saving-uses.php', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
export const createWeeklyCheck = payload => api('/api/weekly-checks.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
export const updateWeeklyCheck = payload => api('/api/weekly-checks.php', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
export const deleteWeeklyCheck = id => api('/api/weekly-checks.php', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
