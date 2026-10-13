const USERS = {
  nana: { id: 'nana', name: 'NANA' },
  meysa: { id: 'meysa', name: 'MEYSA' },
}

let currentUser = null

async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...options,
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.error || `HTTP ${response.status}`)
  }
  return body
}

export async function checkSession() {
  try {
    const body = await request('/api/auth/session.php')
    currentUser = body.authenticated ? USERS[body.owner_id] || null : null
  } catch {
    currentUser = null
  }
  return currentUser
}

export async function login(password) {
  const body = await request('/api/auth/login.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  // Validate the actual PHP session rather than trusting the login response.
  const user = await checkSession()
  if (!user) throw new Error(body.error || 'Lu siapa?')
  return user
}

export async function logout() {
  try {
    await request('/api/auth/logout.php', { method: 'POST' })
  } finally {
    currentUser = null
  }
}

export function getCurrentUser() { return currentUser }
export function getOwnerId() { return currentUser?.id || null }
export function isLoggedIn() { return Boolean(currentUser) }
export function canWrite() { return Boolean(currentUser) }
