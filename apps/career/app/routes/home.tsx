import { useEffect, useState } from 'react'
import type { LoaderFunctionArgs, MetaFunction } from 'react-router'
import { Link } from 'react-router'

export const meta: MetaFunction = () => {
  return [
    { title: 'Craftd - Create Your Dream Portfolio' },
    {
      name: 'description',
      content:
        'Create stunning portfolios in minutes, not hours. Our AI-powered builder makes professional portfolio creation simple and beautiful.',
    },
    { property: 'og:title', content: 'Craftd - Create Your Dream Portfolio' },
    {
      property: 'og:description',
      content:
        'Create stunning portfolios in minutes, not hours. Our AI-powered builder makes professional portfolio creation simple and beautiful.',
    },
  ]
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { getAuthenticatedUser, redirectIfAuthenticated } = await import('../lib/auth.server')
  const user = await getAuthenticatedUser(request)
  redirectIfAuthenticated(user, '/account')
  return null
}

export default function Home() {
  const [loading, setLoading] = useState(true)
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null)

  useEffect(() => {
    setLoading(false)
  }, [])

  const features = [
    {
      icon: '⚡',
      title: 'Lightning Fast',
      description:
        'Create stunning portfolios in minutes, not hours. Our AI-powered builder does the heavy lifting.',
      gradient: 'from-yellow-400 to-orange-500',
    },
    {
      icon: '🎨',
      title: 'Beautiful Design',
      description:
        'Choose from professionally designed templates that adapt to your unique style and brand.',
      gradient: 'from-pink-400 to-purple-500',
    },
    {
      icon: '💻',
      title: 'Developer Friendly',
      description:
        'Built with modern tech stack. Customize everything with React, TypeScript, and Tailwind CSS.',
      gradient: 'from-blue-400 to-cyan-500',
    },
    {
      icon: '🌍',
      title: 'Global Reach',
      description:
        'Share your portfolio anywhere with custom domains and lightning-fast global CDN.',
      gradient: 'from-green-400 to-emerald-500',
    },
    {
      icon: '📊',
      title: 'Analytics Included',
      description: 'Track visitors, engagement, and conversions with built-in analytics dashboard.',
      gradient: 'from-indigo-400 to-blue-500',
    },
    {
      icon: '🛡️',
      title: 'Secure & Reliable',
      description:
        'Enterprise-grade security with 99.9% uptime guarantee. Your data is always safe.',
      gradient: 'from-red-400 to-pink-500',
    },
  ]

  const testimonials = [
    {
      name: 'Sarah Chen',
      role: 'Senior Product Designer',
      company: 'Google',
      content:
        'Craftd helped me land my dream job at Google. The portfolio templates are absolutely stunning!',
      initials: 'SC',
    },
    {
      name: 'Mike Rodriguez',
      role: 'Full Stack Developer',
      company: 'Stripe',
      content:
        "The most intuitive portfolio builder I've ever used. Went from idea to published in 30 minutes.",
      initials: 'MR',
    },
    {
      name: 'Emma Thompson',
      role: 'UX Director',
      company: 'Airbnb',
      content: 'Clean, professional, and mobile-optimized. My portfolio has never looked better.',
      initials: 'ET',
    },
  ]

  const stats = [
    { label: 'Portfolios Created', value: '50K+', icon: '💼' },
    { label: 'Job Offers Generated', value: '12K+', icon: '⭐' },
    { label: 'Happy Creators', value: '25K+', icon: '👥' },
    { label: 'Countries Reached', value: '120+', icon: '🌍' },
  ]

  if (loading) {
    return (
      <div className="bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white max-w-7xl mx-auto">
      {/* Hero Section */}
      <section className="pt-20 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto">
          <div className="mb-6 inline-flex items-center px-4 py-2 rounded-full border border-blue-200 text-blue-700">
            <span className="animate-pulse">✨</span>
            <span className="ml-2">Trusted by 25K+ professionals</span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-8 leading-tight">
            Create Your{' '}
            <span className="bg-linear-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Dream Portfolio
            </span>{' '}
            in Minutes
          </h1>

          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Create stunning portfolios in minutes, not hours. Our AI-powered builder makes
            professional portfolio creation simple and beautiful.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Link
              to="/onboarding"
              className="bg-black hover:bg-gray-800 text-white px-8 py-4 text-lg group rounded-md font-medium transition-all duration-300 inline-flex items-center hover:scale-105"
            >
              Start Building
              <span className="ml-2 group-hover:translate-x-1 transition-transform inline-block">
                →
              </span>
            </Link>

            <Link
              to="/demo"
              className="px-8 py-4 text-lg group border border-gray-300 hover:border-gray-400 rounded-md font-medium transition-all duration-300 inline-flex items-center hover:scale-105"
            >
              <span className="mr-2 group-hover:scale-110 transition-transform inline-block">
                ▶
              </span>
              View Demo
            </Link>
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            No credit card required
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl mb-4">{stat.icon}</div>
                <div className="text-3xl font-bold text-gray-900 mb-2">{stat.value}</div>
                <div className="text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            Everything you need to{' '}
            <span className="bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              stand out
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Professional features that make your portfolio shine and help you land your next
            opportunity.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="h-full group hover:shadow-xl transition-all duration-300 border-0 bg-linear-to-br from-white to-gray-50 rounded-lg p-8 hover:scale-105"
              onMouseEnter={() => setHoveredFeature(index)}
              onMouseLeave={() => setHoveredFeature(null)}
            >
              <div
                className={`w-12 h-12 rounded-lg bg-linear-to-br flex items-center justify-center mb-6 group-hover:scale-110 transition-transform text-white text-xl ${feature.gradient}`}
              >
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">
              Loved by{' '}
              <span className="bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                professionals
              </span>
            </h2>
            <p className="text-xl text-gray-600">
              Join thousands of creators who've transformed their careers with Craftd.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial) => (
              <div key={testimonial.name} className="h-full bg-white rounded-lg border p-8">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 rounded-full bg-linear-to-br from-blue-500 to-purple-600 mr-4 flex items-center justify-center text-sm font-semibold text-white">
                    {testimonial.initials}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{testimonial.name}</h4>
                    <p className="text-sm text-gray-600">
                      {testimonial.role} • {testimonial.company}
                    </p>
                  </div>
                </div>
                <p className="text-gray-700 italic">"{testimonial.content}"</p>
                <div className="flex mt-4">
                  {Array(5)
                    .fill(0)
                    .map((_, i) => (
                      <span key={`star-${testimonial.name}-${i}`} className="text-yellow-400">
                        ⭐
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            Ready to write your{' '}
            <span className="bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              success story?
            </span>
          </h2>
          <p className="text-xl text-gray-600 mb-10">
            Join thousands of professionals who've landed their dream jobs with portfolios built on
            Craftd.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/onboarding"
              className="bg-black hover:bg-gray-800 text-white px-8 py-4 text-lg group rounded-md font-medium transition-colors inline-flex items-center"
            >
              <span className="mr-2 group-hover:-translate-y-0.5 transition-transform inline-block">
                🚀
              </span>
              Create Your Portfolio
            </Link>

            <Link
              to="/demo"
              className="px-8 py-4 text-lg border border-gray-300 hover:border-gray-400 rounded-md font-medium transition-colors inline-flex items-center"
            >
              Explore Examples
            </Link>
          </div>

          <div className="mt-8 flex items-center justify-center gap-6 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Free to start
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              No credit card required
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Setup in minutes
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <div className="w-6 h-6 rounded bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                ✨
              </div>
              <span className="font-semibold text-gray-900">Craftd</span>
            </div>

            <div className="flex items-center gap-6 text-sm text-gray-600">
              <Link to="/account" className="hover:text-gray-900 transition-colors">
                Account
              </Link>
              <Link to="/onboarding" className="hover:text-gray-900 transition-colors">
                Create
              </Link>
              <Link to="/demo" className="hover:text-gray-900 transition-colors">
                Demo
              </Link>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-gray-200 text-center text-sm text-gray-500">
            © 2025 Craftd. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
