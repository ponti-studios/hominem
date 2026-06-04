import { Button } from '@hominem/ui/button';
import { Card, CardContent } from '@hominem/ui/card';
import { useState } from 'react';

import { JobScrapingResumeCustomizer } from '~/components/JobScrapingResumeCustomizer';
import { cn } from '~/lib/utils';
export default function ResumeCustomizer() {
  const [inputMethod, setInputMethod] = useState<'url' | 'paste'>('url');
  const [pastedDescription, setPastedDescription] = useState('');

  return (
    <div className="min-h-screen">
      <div className="mx-auto py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="font-sans text-4xl font-light text-foreground mb-4">
              Resume Customizer
            </h1>
            <p className="text-muted-foreground text-lg">
              Generate a tailored resume for your target job
            </p>
          </div>

          {/* Input Method Selection */}
          <Card className="mb-8 ">
            <CardContent className="p-8">
              <h2 className="font-sans text-2xl font-light text-foreground mb-6 text-center">
                How would you like to provide the job details?
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button
                  type="button"
                  onClick={() => setInputMethod('url')}
                  className={cn(
                    'p-6 rounded-lg border-2 transition-all',
                    inputMethod === 'url'
                      ? 'border-accent bg-accent text-accent-foreground'
                      : 'hover:border-border',
                  )}
                >
                  <div className="text-center">
                    <div className="mb-3 text-3xl">Link</div>
                    <div className="font-sans text-lg font-medium mb-2">Scrape from URL</div>
                    <div className="text-sm opacity-80">
                      Paste a job posting URL to automatically extract details
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setInputMethod('paste')}
                  className={cn(
                    'p-6 rounded-lg border-2 transition-all',
                    inputMethod === 'paste'
                      ? 'border-accent bg-accent text-accent-foreground'
                      : 'hover:border-border',
                  )}
                >
                  <div className="text-center">
                    <div className="mb-3 text-3xl">Text</div>
                    <div className="font-sans text-lg font-medium mb-2">Paste Description</div>
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
            <Card>
              <CardContent className="p-8">
                <JobScrapingResumeCustomizer showResumeGeneration={true} />
              </CardContent>
            </Card>
          )}

          {/* Paste Description */}
          {inputMethod === 'paste' && (
            <Card>
              <CardContent className="p-8">
                <div className="text-center mb-8">
                  <h2 className="font-sans text-2xl font-light text-foreground mb-2">
                    Paste Job Description
                  </h2>
                  <p className="text-muted-foreground">
                    Paste the job description to generate a tailored resume
                  </p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label
                      htmlFor="pastedDescription"
                      className="block font-sans text-sm font-medium text-foreground mb-3"
                    >
                      Job Description
                    </label>
                    <textarea
                      id="pastedDescription"
                      value={pastedDescription}
                      onChange={(e) => setPastedDescription(e.target.value)}
                      rows={12}
                      placeholder="Paste the complete job description here..."
                      className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-ring/50 focus:border-transparent resize-none font-sans text-sm"
                    />
                  </div>

                  <div className="text-center">
                    <Button
                      disabled={!pastedDescription.trim()}
                      className="px-8 py-3 bg-primary text-primary-foreground hover:bg-primary/90 border-0 rounded-md font-medium"
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
  );
}
