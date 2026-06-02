import { useState } from 'react'
import { JobScrapingResumeCustomizer } from '~/components/JobScrapingResumeCustomizer'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/Card'

export default function ResumeCustomizer() {
  const [inputMethod, setInputMethod] = useState<'url' | 'paste'>('url')
  const [pastedDescription, setPastedDescription] = useState('')

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="container mx-auto py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="font-serif text-4xl font-light text-gray-900 mb-4">Resume Customizer</h1>
            <p className="text-gray-600 text-lg">Generate a tailored resume for your target job</p>
          </div>

          {/* Input Method Selection */}
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm mb-8">
            <CardContent className="p-8">
              <h2 className="font-serif text-2xl font-light text-gray-900 mb-6 text-center">
                How would you like to provide the job details?
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button
                  type="button"
                  onClick={() => setInputMethod('url')}
                  className={`p-6 rounded-lg border-2 transition-all ${
                    inputMethod === 'url'
                      ? 'border-black bg-black text-white'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-3xl mb-3">🔗</div>
                    <div className="font-serif text-lg font-medium mb-2">Scrape from URL</div>
                    <div className="text-sm opacity-80">
                      Paste a job posting URL to automatically extract details
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setInputMethod('paste')}
                  className={`p-6 rounded-lg border-2 transition-all ${
                    inputMethod === 'paste'
                      ? 'border-black bg-black text-white'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-3xl mb-3">📋</div>
                    <div className="font-serif text-lg font-medium mb-2">Paste Description</div>
                    <div className="text-sm opacity-80">
                      Copy & paste the job description manually
                    </div>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* URL Scraping */}
          {inputMethod === 'url' && (
            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
              <CardContent className="p-8">
                <JobScrapingResumeCustomizer showResumeGeneration={true} />
              </CardContent>
            </Card>
          )}

          {/* Paste Description */}
          {inputMethod === 'paste' && (
            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
              <CardContent className="p-8">
                <div className="text-center mb-8">
                  <h2 className="font-serif text-2xl font-light text-gray-900 mb-2">
                    Paste Job Description
                  </h2>
                  <p className="text-gray-600">
                    Paste the job description to generate a tailored resume
                  </p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label
                      htmlFor="pastedDescription"
                      className="block font-serif text-sm font-medium text-gray-900 mb-3"
                    >
                      Job Description
                    </label>
                    <textarea
                      id="pastedDescription"
                      value={pastedDescription}
                      onChange={(e) => setPastedDescription(e.target.value)}
                      rows={12}
                      placeholder="Paste the complete job description here..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent resize-none font-sans text-sm"
                    />
                  </div>

                  <div className="text-center">
                    <Button
                      disabled={!pastedDescription.trim()}
                      className="px-8 py-3 bg-black text-white hover:bg-gray-800 border-0 rounded-none font-medium"
                    >
                      Generate Resume
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
