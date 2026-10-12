async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)
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
