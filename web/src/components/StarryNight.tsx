import { useEffect, useId, useRef, useState } from 'react'
import type { Container, Engine, ISourceOptions } from '@tsparticles/engine'
import './StarryNight.css'

let enginePromise: Promise<Engine> | undefined

function loadStarEngine() {
  enginePromise ??= Promise.all([
    import('@tsparticles/engine'),
    import('@tsparticles/basic'),
  ]).then(async ([{ tsParticles }, { loadBasic }]) => {
    await loadBasic(tsParticles)
    return tsParticles
  }).catch(error => {
    enginePromise = undefined
    throw error
  })
  return enginePromise
}

// A small, deterministic still sky is present before the engine loads and for
// visitors who prefer reduced motion. No animation library is needed for it.
const stillStars = Array.from({ length: 48 }, (_, index) => ({
  left: `${((index * 73 + 11) % 997) / 10}%`,
  top: `${((index * 139 + 37) % 907) / 10}%`,
  width: index % 9 === 0 ? '2px' : '1px',
  height: index % 9 === 0 ? '2px' : '1px',
  opacity: 0.24 + (index % 5) * 0.12,
  backgroundColor: index % 7 === 0 ? '#D5BC7C' : '#F8F5EC',
}))

const starOptions: ISourceOptions = {
  autoPlay: true,
  fullScreen: { enable: false },
  detectRetina: false,
  fpsLimit: 24,
  // The component owns visibility so two pause controllers cannot disagree.
  pauseOnBlur: false,
  particles: {
    number: { value: 60, density: { enable: false } },
    // tsParticles v4 puts color in paint; the small basic bundle supplies
    // circles, movement and opacity animation without mouse interactions.
    paint: { color: { value: ['#F8F5EC', '#F8F5EC', '#D5BC7C'] } },
    shape: { type: 'circle' },
    size: { value: { min: 0.8, max: 2 } },
    opacity: {
      value: { min: 0.15, max: 0.8 },
      animation: { enable: true, speed: 0.9, sync: false, startValue: 'random' },
    },
    move: {
      enable: true,
      speed: 0.18,
      direction: 'none',
      outModes: { default: 'out' },
    },
  },
}

export function StarryNight() {
  const id = useId()
  const sceneRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<Container | undefined>(undefined)
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [inView, setInView] = useState(false)
  const [activated, setActivated] = useState(false)
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || !document.hidden)
  const [ready, setReady] = useState(false)
  const shouldAnimate = !reducedMotion && inView && pageVisible
  const shouldAnimateRef = useRef(shouldAnimate)

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onPreference = () => setReducedMotion(preference.matches)
    const onVisibility = () => setPageVisible(!document.hidden)
    preference.addEventListener('change', onPreference)
    document.addEventListener('visibilitychange', onVisibility)
    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting)
      if (entry.isIntersecting) setActivated(true)
    })
    if (sceneRef.current) observer.observe(sceneRef.current)
    return () => {
      observer.disconnect()
      preference.removeEventListener('change', onPreference)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  useEffect(() => {
    shouldAnimateRef.current = shouldAnimate
    if (shouldAnimate) containerRef.current?.play()
    else containerRef.current?.pause()
  }, [shouldAnimate])

  useEffect(() => {
    if (!activated || reducedMotion) return
    const element = canvasRef.current
    if (!element) return
    let disposed = false
    let ownedContainer: Container | undefined
    // Leave the first hero paint free to render its content and still sky.
    const frame = window.requestAnimationFrame(() => {
      void loadStarEngine().then(async engine => {
        if (disposed) return
        const options = window.matchMedia('(max-width: 767px)').matches
          ? { ...starOptions, particles: { ...starOptions.particles, number: { value: 30, density: { enable: false } } } }
          : starOptions
        const container = await engine.load({ id: `sodus-stars-${id}`, element, options })
        if (disposed) { container?.destroy(); return }
        ownedContainer = container
        containerRef.current = container
        if (container) {
          if (shouldAnimateRef.current) container.play()
          else container.pause()
          setReady(true)
        }
      }).catch(() => { /* Keep the still sky if the optional engine cannot load. */ })
    })
    return () => {
      disposed = true
      window.cancelAnimationFrame(frame)
      ownedContainer?.destroy()
      containerRef.current = undefined
      setReady(false)
    }
  }, [activated, reducedMotion, id])

  return (
      <div ref={sceneRef} className="starry-night" aria-hidden="true" data-sky-state={reducedMotion ? 'still' : shouldAnimate && ready ? 'playing' : 'paused'}>
        <div className="starry-night__atmosphere" />
        <div className={`starry-night__still ${ready ? 'starry-night__still--dim' : ''}`}>
          {stillStars.map((style, index) => <span key={index} style={style} />)}
        </div>
        <div ref={canvasRef} className="starry-night__canvas" />
      </div>
  )
}
