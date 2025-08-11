import { Hero } from '../components/sections/hero'
import { FeaturedProperties } from '../components/sections/featured-properties'
import { Features } from '../components/sections/features'
import { Stats } from '../components/sections/stats'
import { Testimonials } from '../components/sections/testimonials'
import { CTA } from '../components/sections/cta'
import { Header } from '../components/layout/header'
import { Footer } from '../components/layout/footer'
import { SearchDemo } from '../components/demo/search-demo'

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <div className="py-16">
          <div className="container mx-auto px-6">
            <SearchDemo />
          </div>
        </div>
        <Stats />
        <FeaturedProperties />
        <Features />
        <Testimonials />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}