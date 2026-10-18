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
  autoPlay: false,
  fullScreen: { enable: false },
  detectRetina: false,
  fpsLimit: 24,
  pauseOnBlur: true,
  pauseOnOutsideViewport: true,
  particles: {
    number: { value: 60, density: { enable: false } },
    // tsParticles v4 puts color in paint; the small basic bundle supplies
    // circles, movement and opacity animation without mouse interactions.
    paint: { color: { value: ['#F8F5EC', '#F8F5EC', '#D5BC7C'] } },
    shape: { type: 'circle' },
    size: { value: { min: 0.6, max: 1.7 } },
    opacity: {
      value: { min: 0.15, max: 0.8 },
      animation: { enable: true, speed: 0.3, sync: false, startValue: 'random' },
    },
    move: {
      enable: true,
      speed: 0.045,
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
  const [paused, setPaused] = useState(false)
  const [inView, setInView] = useState(false)
  const [activated, setActivated] = useState(false)
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || !document.hidden)
  const [ready, setReady] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const shouldAnimate = !reducedMotion && !paused && inView && pageVisible
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
      }).catch(() => { if (!disposed) setUnavailable(true) })
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
    <>
      <div ref={sceneRef} className="starry-night" aria-hidden="true" data-sky-state={reducedMotion ? 'still' : shouldAnimate && ready ? 'playing' : 'paused'}>
        <div className="starry-night__atmosphere" />
        <div className={`starry-night__still ${ready ? 'starry-night__still--dim' : ''}`}>
          {stillStars.map((style, index) => <span key={index} style={style} />)}
        </div>
        <div ref={canvasRef} className="starry-night__canvas" />
      </div>
      {!reducedMotion && !unavailable ? (
        <button
          type="button"
          className="starry-night__control"
          aria-label={paused ? 'Play star animation' : 'Pause star animation'}
          onClick={() => setPaused(value => !value)}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
            {paused ? <path d="M3 1.5 10 6l-7 4.5z" /> : <path d="M2 1h3v10H2zm5 0h3v10H7z" />}
          </svg>
          {paused ? 'Play sky' : 'Pause sky'}
        </button>
      ) : null}
    </>
  )
}
