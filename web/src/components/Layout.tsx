import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Footer } from './Footer'
import { Header } from './Header'
import { MobileBookBar } from './MobileBookBar'

export function Layout() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
      <MobileBookBar />
    </div>
  )
}
