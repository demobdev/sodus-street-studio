import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { About } from './pages/About'
import { Booking } from './pages/Booking'
import { Contact } from './pages/Contact'
import { FAQ } from './pages/FAQ'
import { Home } from './pages/Home'
import { Portfolio } from './pages/Portfolio'
import { Privacy } from './pages/Privacy'
import { Services } from './pages/Services'
import { StudioSpace } from './pages/StudioSpace'
import { Terms } from './pages/Terms'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="about" element={<About />} />
          <Route path="services" element={<Services />} />
          <Route path="studio-space" element={<StudioSpace />} />
          <Route path="portfolio" element={<Portfolio />} />
          <Route path="booking" element={<Booking />} />
          <Route path="faq" element={<FAQ />} />
          <Route path="contact" element={<Contact />} />
          <Route path="privacy-policy" element={<Privacy />} />
          <Route path="terms-and-conditions" element={<Terms />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
