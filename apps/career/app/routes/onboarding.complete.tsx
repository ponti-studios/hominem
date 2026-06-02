import {
  ArrowRight,
  CheckCircle2,
  Edit3,
  Eye,
  Gift,
  Share2,
  Sparkles,
  Star,
  Trophy,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { MetaFunction } from 'react-router'
import { useNavigate } from 'react-router'
import { Button } from '~/components/ui/button'

export const meta: MetaFunction = () => {
  return [
    { title: 'Welcome to Craftd! - Your Portfolio is Ready' },
    {
      name: 'description',
      content: 'Congratulations! Your professional portfolio is now live and ready to share.',
    },
  ]
}

export default function OnboardingComplete() {
  const navigate = useNavigate()
  const [showCelebration, setShowCelebration] = useState(false)
  const [justCompleted] = useState(true)

  useEffect(() => {
    if (justCompleted) {
      setShowCelebration(true)
      // Auto hide after 5 seconds
      const timer = setTimeout(() => {
        setShowCelebration(false)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [justCompleted])

  const goToPortfolio = () => {
    navigate('/account')
  }

  const shareTips = () => {
    // Scroll to sharing section
    document.getElementById('sharing-tips')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      {/* Celebration Animation */}
      {showCelebration && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          <div className="relative">
            <div className="animate-pulse">
              <Sparkles className="w-16 h-16 text-yellow-400" />
            </div>
            {/* Floating emojis animation */}
            <div className="absolute -top-8 -left-8 animate-bounce">🎉</div>
            <div className="absolute -top-4 -right-8 animate-bounce delay-150">✨</div>
            <div className="absolute -bottom-4 -left-4 animate-bounce delay-300">🚀</div>
          </div>
        </div>
      )}

      <div className="bg-linear-to-br from-blue-50 via-white to-purple-50">
        <div className="max-w-4xl mx-auto px-6 py-12">
          {/* Main Success Message */}
          <div className="text-center mb-16">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>

            <h1 className="font-serif text-4xl lg:text-5xl font-light text-gray-900 mb-6">
              🎉 Congratulations!
            </h1>

            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
              Your professional portfolio is now live and ready to make a great first impression.
              You've just taken a huge step forward in your career journey!
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                type="button"
                onClick={goToPortfolio}
                variant="primary"
                size="lg"
                className="flex items-center justify-center gap-2 shadow-lg"
              >
                <Eye className="w-5 h-5" />
                View Your Portfolio
                <ArrowRight className="w-4 h-4" />
              </Button>

              <Button
                type="button"
                onClick={shareTips}
                variant="outline"
                size="lg"
                className="flex items-center justify-center gap-2"
              >
                <Share2 className="w-5 h-5" />
                Learn How to Share
              </Button>
            </div>
          </div>

          {/* Achievement Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Trophy className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Portfolio Created</h3>
              <p className="text-gray-600 text-sm">
                Your professional portfolio is now live with a beautiful, clean design that
                showcases your experience.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <Star className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">SEO Optimized</h3>
              <p className="text-gray-600 text-sm">
                Your portfolio is optimized for search engines, making it easier for recruiters and
                employers to find you.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Ready to Share</h3>
              <p className="text-gray-600 text-sm">
                Share your portfolio link on LinkedIn, in job applications, or with your network to
                showcase your skills.
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 mb-16">
            <h2 className="font-serif text-2xl font-light text-gray-900 mb-6">What's Next?</h2>

            <div className="grid md:grid-cols-2 gap-6">
              <Button
                type="button"
                onClick={() => navigate('/editor')}
                variant="ghost"
                className="flex items-start gap-4 p-6 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors group text-left h-auto"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-blue-200 transition-colors">
                  <Edit3 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Customize Your Portfolio</h3>
                  <p className="text-gray-600 text-sm">
                    Fine-tune your content, add projects, or adjust the styling to make it uniquely
                    yours.
                  </p>
                </div>
              </Button>

              <Button
                type="button"
                onClick={shareTips}
                variant="ghost"
                className="flex items-start gap-4 p-6 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition-colors group text-left h-auto"
              >
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-green-200 transition-colors">
                  <Share2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Share Your Portfolio</h3>
                  <p className="text-gray-600 text-sm">
                    Learn the best ways to share your portfolio and maximize its impact on your
                    career.
                  </p>
                </div>
              </Button>
            </div>
          </div>

          {/* Sharing Tips Section */}
          <div
            id="sharing-tips"
            className="bg-linear-to-r from-blue-50 to-purple-50 rounded-xl p-8"
          >
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Gift className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="font-serif text-2xl font-light text-gray-900 mb-4">
                Pro Tips for Sharing Your Portfolio
              </h2>
              <p className="text-gray-600">
                Maximize the impact of your new portfolio with these proven strategies
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">🎯 LinkedIn Strategy</h3>
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-1 shrink-0" />
                    <span className="text-sm">
                      Add your portfolio URL to your LinkedIn headline
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-1 shrink-0" />
                    <span className="text-sm">Include it in your LinkedIn "About" section</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-1 shrink-0" />
                    <span className="text-sm">Share a post announcing your new portfolio</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-4">📧 Job Applications</h3>
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-1 shrink-0" />
                    <span className="text-sm">
                      Include your portfolio link in your email signature
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-1 shrink-0" />
                    <span className="text-sm">
                      Add it to your cover letter and job applications
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-1 shrink-0" />
                    <span className="text-sm">Mention it during networking conversations</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8 p-6 bg-white rounded-lg border border-blue-200">
              <div className="flex items-center gap-3 mb-3">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <h4 className="font-semibold text-gray-900">Your Portfolio URL</h4>
              </div>
              <div className="flex items-center gap-3">
                <code className="flex-1 px-3 py-2 bg-gray-100 rounded text-sm font-mono text-gray-800">
                  https://craftd.dev/your-name
                </code>
                <Button type="button" variant="primary" size="sm">
                  Copy Link
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
