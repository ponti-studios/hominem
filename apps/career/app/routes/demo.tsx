import { ArrowLeft } from 'lucide-react'
import type { MetaFunction } from 'react-router'
import { Link } from 'react-router'

export const meta: MetaFunction = () => {
  return [
    { title: 'Demo Portfolio - Sarah Chen | Craftd' },
    {
      name: 'description',
      content: 'Demo portfolio showcasing our minimal, Apple-inspired resume design',
    },
  ]
}

// Demo portfolio data
const demoPortfolio = {
  slug: 'sarah-chen',
  title: 'Senior Product Designer - Sarah Chen',
  personalInfo: {
    name: 'Sarah Chen',
    title: 'Senior Product Designer',
    tagline:
      'Demo Portfolio · I design digital experiences that bridge the gap between user needs and business objectives, with a focus on accessibility and sustainable design practices.',
    bio: "With over 8 years in product design, I've led design initiatives at both high-growth startups and Fortune 500 companies. My approach combines rigorous user research with systematic design thinking to create products that are both beautiful and functional.",
    location: {
      current: 'San Francisco, CA',
      tagline: 'Open to remote work',
    },
    availability: {
      status: true,
      message: 'Available for new opportunities starting January 2024',
    },
    contact: {
      email: 'sarah.chen@example.com',
      phone: '+1 (555) 123-4567',
    },
    social: {
      linkedin: 'https://linkedin.com/in/sarahchen',
      github: 'https://github.com/sarahchen',
      website: 'https://sarahchen.design',
    },
    stats: [
      { value: '8+', label: 'Years Experience' },
      { value: '50M+', label: 'Users Impacted' },
      { value: '15+', label: 'Product Launches' },
      { value: '95%', label: 'User Satisfaction' },
    ],
  },
  workExperience: [
    {
      title: 'Stripe',
      role: 'Senior Product Designer',
      company: 'Stripe',
      startDate: '2022-01-01',
      endDate: null,
      description:
        "Leading design for Stripe's next-generation payment processing platform, focusing on developer experience and enterprise merchant tools.",
      metrics:
        'Improved developer onboarding completion rate by 40% and reduced time-to-first-payment by 60%',
      tags: ['Product Strategy', 'Developer Experience', 'Enterprise Design', 'Design Systems'],
    },
    {
      title: 'Figma',
      role: 'Product Designer',
      company: 'Figma',
      startDate: '2020-03-01',
      endDate: '2021-12-31',
      description:
        "Designed collaboration features for Figma's web platform, including real-time commenting, version history, and team libraries.",
      metrics:
        'Increased daily active collaborators by 300% and improved team adoption rate by 85%',
      tags: ['Collaboration', 'Real-time Systems', 'Team Workflows'],
    },
  ],
  skills: [
    {
      category: 'Design',
      items: ['Product Design', 'UX Research', 'Design Systems', 'Prototyping', 'User Testing'],
    },
    {
      category: 'Tools',
      items: ['Figma', 'Sketch', 'Principle', 'Framer', 'Adobe Creative Suite'],
    },
    {
      category: 'Development',
      items: ['HTML/CSS', 'JavaScript', 'React', 'Design Tokens'],
    },
  ],
  projects: [
    {
      title: 'Stripe Dashboard Redesign',
      description:
        'Complete redesign of the merchant dashboard with focus on data visualization and workflow optimization.',
      tags: ['Product Design', 'Data Visualization', 'Enterprise'],
      featured: true,
    },
    {
      title: 'Figma Comments System',
      description: 'Real-time commenting and feedback system for design collaboration.',
      tags: ['Collaboration', 'Real-time', 'UX'],
      featured: true,
    },
  ],
}

export default function Demo() {
  return (
    <>
      {/* Demo Navigation */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="font-sans text-sm font-medium">Back to Craftd</span>
            </Link>

            <div className="font-sans text-sm text-gray-500">
              <span className="font-medium">Demo Portfolio</span> · Sarah Chen
            </div>
          </div>
        </div>
      </div>

      {/* Content with top spacing */}
      <div className="pt-16">
        <div className="max-w-2xl mx-auto px-6 py-12">
          {/* Header */}
          <header className="mb-16">
            <div className="flex items-start justify-between mb-8">
              <div>
                <h1 className="font-serif text-4xl font-light text-gray-900 mb-2">
                  {demoPortfolio.personalInfo.name}
                </h1>
                <p className="text-xl text-gray-600 mb-4">{demoPortfolio.personalInfo.title}</p>
                <p className="text-gray-600 leading-relaxed">
                  {demoPortfolio.personalInfo.tagline}
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
              {demoPortfolio.personalInfo.stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl font-serif font-light text-gray-900 mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm text-gray-600">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Contact */}
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <span>{demoPortfolio.personalInfo.location.current}</span>
              <span>•</span>
              <span>{demoPortfolio.personalInfo.contact.email}</span>
              <span>•</span>
              <span className="text-green-600 font-medium">
                {demoPortfolio.personalInfo.availability.message}
              </span>
            </div>
          </header>

          {/* Bio */}
          <section className="mb-16">
            <h2 className="font-serif text-2xl font-light text-gray-900 mb-6">About</h2>
            <p className="text-gray-700 leading-relaxed">{demoPortfolio.personalInfo.bio}</p>
          </section>

          {/* Work Experience */}
          <section className="mb-16">
            <h2 className="font-serif text-2xl font-light text-gray-900 mb-8">Experience</h2>
            <div className="space-y-12">
              {demoPortfolio.workExperience.map((job) => (
                <div
                  key={`${job.title}-${job.startDate}`}
                  className="border-l-2 border-gray-100 pl-6"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-gray-900">{job.title}</h3>
                      <p className="text-gray-700">{job.role}</p>
                      {job.company && <p className="text-sm text-gray-600">{job.company}</p>}
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(job.startDate).getFullYear()} -
                      {job.endDate ? new Date(job.endDate).getFullYear() : 'Present'}
                    </div>
                  </div>
                  <p className="text-gray-700 mb-3 leading-relaxed">{job.description}</p>
                  <p className="text-sm text-gray-600 mb-4 italic">{job.metrics}</p>
                  <div className="flex flex-wrap gap-2">
                    {job.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Skills */}
          <section className="mb-16">
            <h2 className="font-serif text-2xl font-light text-gray-900 mb-8">Skills</h2>
            <div className="space-y-6">
              {demoPortfolio.skills.map((skillGroup) => (
                <div key={skillGroup.category}>
                  <h3 className="font-medium text-gray-900 mb-3">{skillGroup.category}</h3>
                  <div className="flex flex-wrap gap-2">
                    {skillGroup.items.map((skill) => (
                      <span
                        key={skill}
                        className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Featured Projects */}
          <section>
            <h2 className="font-serif text-2xl font-light text-gray-900 mb-8">Featured Projects</h2>
            <div className="space-y-8">
              {demoPortfolio.projects
                .filter((project) => project.featured)
                .map((project) => (
                  <div key={project.title} className="border border-gray-200 rounded-lg p-6">
                    <h3 className="font-medium text-gray-900 mb-2">{project.title}</h3>
                    <p className="text-gray-700 mb-4 leading-relaxed">{project.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {project.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
