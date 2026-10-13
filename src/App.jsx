import { useEffect, useRef, useState } from 'react'
import styles from './App.module.css'
import Navbar from './components/Navbar.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Expense from './pages/Expense.jsx'
import Income from './pages/Income.jsx'
import Saving from './pages/Saving.jsx'
import Weekly from './pages/Weekly.jsx'
import ExpenseAnalysis from './pages/ExpenseAnalysis.jsx'
import { checkSession, login, logout } from './utils/auth.js'

export default function App() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [password, setPassword] = useState('')
  const [page, setPage] = useState('dashboard')
  const [error, setError] = useState('')
  const [quickAddToken, setQuickAddToken] = useState(0)
  const attemptedPassword = useRef('')

  useEffect(() => {
    let mounted = true
    checkSession().then(user => {
      if (mounted) { setCurrentUser(user); setLoading(false) }
    })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (loading || currentUser || busy || password.length < 4) return
    if (attemptedPassword.current === password) return

    const timer = setTimeout(async () => {
      attemptedPassword.current = password
      setBusy(true)
      setError('')
      try {
        const user = await login(password)
        setCurrentUser(user)
        setPassword('')
      } catch (err) {
        setError(err.message || 'Password tidak cocok')
      } finally {
        setBusy(false)
      }
    }, 1200)

    return () => clearTimeout(timer)
  }, [password, loading, currentUser, busy])

  async function handleLogout() {
    setBusy(true)
    try {
      await logout()
    } catch (err) {
      console.error('Logout API:', err)
    } finally {
      setCurrentUser(null)
      setPage('dashboard')
      setBusy(false)
    }
  }

  if (loading) return <div className={styles.loginShell}>Memeriksa sesi...</div>

  if (!currentUser) {
    return (
      <div className={styles.loginShell}>
        <div className={styles.loginCard}>
          <h1>Anangi App</h1>
          <p>Masuk menggunakan akun Anangi</p>
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required disabled={busy} />
          <p>{busy ? 'Memeriksa password...' : 'Login otomatis setelah selesai mengetik'}</p>
          <p role="alert" className={styles.loginError}>{error}</p>
        </div>
      </div>
    )
  }

  const pages = {
    dashboard: <Dashboard onLogout={handleLogout} currentUser={currentUser} />,
    expense: <Expense quickAddToken={quickAddToken} currentUser={currentUser} />,
    income: <Income currentUser={currentUser} />,
    saving: <Saving currentUser={currentUser} />,
    weekly: <Weekly currentUser={currentUser} />,
    analysis: <ExpenseAnalysis currentUser={currentUser} />,
  }

  return (
    <div className={styles.appContainer}>
      <Navbar page={page} onNavigate={setPage}
        onQuickExpense={() => { setPage('expense'); setQuickAddToken(v => v + 1) }} />
      {pages[page]}
    </div>
  )
}
