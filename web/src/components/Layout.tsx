import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Footer } from './Footer'
import { Header } from './Header'
import { MobileBookBar } from './MobileBookBar'
import { PageMetadata } from './PageMetadata'

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
    <div className="min-h-screen pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-0">
      <PageMetadata />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-sm focus:bg-navy focus:px-4 focus:py-3 focus:font-semibold focus:text-ivory"
      >
        Skip to content
      </a>
      <Header />
      <main id="main-content" tabIndex={-1} className="scroll-mt-28 [&_[id]]:scroll-mt-28">
        <Outlet />
      </main>
      <Footer />
      <MobileBookBar />
    </div>
  )
}
