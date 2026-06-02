import { BarChart3, Briefcase, Code, FolderOpen, Link2, MessageSquare, User } from 'lucide-react'
import type { LoaderFunctionArgs, MetaFunction } from 'react-router'
import { Link, Outlet, redirect, useLoaderData, useLocation } from 'react-router'
import type { FullPortfolio } from '../lib/portfolio.server'
import { getFullUserPortfolio } from '../lib/portfolio.server'
import { withAuthLoader } from '../lib/route-utils'

export const meta: MetaFunction = () => {
  return [
    { title: 'Portfolio Editor | Craftd' },
    {
      name: 'description',
      content: 'Edit and customize your professional portfolio',
    },
  ]
}

/**
 * Loader for wizard editor: ensure the user has a portfolio or redirect to onboarding
 */
export async function loader(args: LoaderFunctionArgs) {
  return withAuthLoader(args, async ({ user }) => {
    const portfolio = await getFullUserPortfolio(user.id)
    if (!portfolio) {
      throw redirect('/onboarding')
    }
    return portfolio
  })
}

const editorSteps = [
  {
    path: '/editor',
    value: 'editor',
    label: 'Basic Info',
    icon: User,
  },
  {
    path: '/editor/work',
    value: 'work',
    label: 'Work',
    icon: Briefcase,
  },
  {
    path: '/editor/skills',
    value: 'skills',
    label: 'Skills',
    icon: Code,
  },
  {
    path: '/editor/social',
    value: 'social',
    label: 'Social',
    icon: Link2,
  },
  {
    path: '/editor/stats',
    value: 'stats',
    label: 'Stats',
    icon: BarChart3,
  },
  {
    path: '/editor/projects',
    value: 'projects',
    label: 'Projects',
    icon: FolderOpen,
  },
  {
    path: '/editor/testimonials',
    value: 'testimonials',
    label: 'Testimonials',
    icon: MessageSquare,
  },
]

export default function EditorLayout() {
  const location = useLocation()
  const portfolio = useLoaderData<FullPortfolio>()

  const currentStepIndex = editorSteps.findIndex((step) => location.pathname.startsWith(step.path))

  return (
    <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-4 gap-8">
      {/* Sidebar Navigation */}
      <div className="md:col-span-2 lg:col-span-1 px-4 md:px-0">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-8">
          <nav className="space-y-2">
            {editorSteps.map((step, index) => {
              const isActive = step.value === location.pathname.split('/').pop()
              const isCompleted = index < currentStepIndex
              const Icon = step.icon

              return (
                <Link
                  key={step.path}
                  to={step.path}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-50 border border-blue-200 text-blue-900'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isActive ? 'bg-blue-100' : isCompleted ? 'bg-green-100' : 'bg-gray-100'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 ${
                        isActive
                          ? 'text-blue-600'
                          : isCompleted
                            ? 'text-green-600'
                            : 'text-gray-600'
                      }`}
                    />
                  </div>
                  <div>
                    <div className={`font-medium ${isActive ? 'text-blue-900' : 'text-gray-900'}`}>
                      {step.label}
                    </div>
                  </div>
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="md:col-span-2 lg:col-span-3 overflow-y-auto">
        <Outlet context={portfolio} />
      </div>
    </div>
  )
}
