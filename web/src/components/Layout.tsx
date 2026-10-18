import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Footer } from './Footer'
import { Header } from './Header'
import { MobileBookBar } from './MobileBookBar'

export function Layout() {
  const { pathname, hash, key } = useLocation()

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0)
      return
    }

    let targetId = hash.slice(1)
    try {
      targetId = decodeURIComponent(targetId)
    } catch {
      // A malformed fragment can still match a literal element ID.
    }

    let observer: MutationObserver | undefined
    let timeout: number | undefined
    const scrollToTarget = () => {
      const target = document.getElementById(targetId)
      if (!target) return false
      target.scrollIntoView({ block: 'start' })
      return true
    }
    const frame = window.requestAnimationFrame(() => {
      if (scrollToTarget()) return
      // Inquiry sections can arrive after the availability request finishes.
      observer = new MutationObserver(() => {
        if (scrollToTarget()) {
          observer?.disconnect()
          window.clearTimeout(timeout)
        }
      })
      observer.observe(document.getElementById('root') || document.body, {
        childList: true,
        subtree: true,
      })
      timeout = window.setTimeout(() => observer?.disconnect(), 10000)
    })

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timeout)
      observer?.disconnect()
    }
  }, [pathname, hash, key])

  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <Header />
      <main className="[&_[id]]:scroll-mt-28">
        <Outlet />
      </main>
      <Footer />
      <MobileBookBar />
    </div>
  )
}
