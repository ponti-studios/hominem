import { CheckIcon, PencilIcon, PlusIcon, TrashIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { useLoaderData } from 'react-router'
import { Button } from '~/components/ui/button'
import type { Certification, CertificationSummary } from '~/lib/db/schema'
import { createSuccessResponse, withAuthLoader } from '~/lib/route-utils'

interface LoaderData {
  user: { id: string; email?: string | null; name?: string | null }
  certifications: Certification[]
  summary: CertificationSummary
}

export async function loader(args: LoaderFunctionArgs) {
  return withAuthLoader(args, async ({ user }) => {
    try {
      // For now, return empty data - we'll implement the queries later
      const certifications: Certification[] = []
      const summary: CertificationSummary = {
        totalCertifications: 0,
        activeCertifications: 0,
        expiredCertifications: 0,
        expiringInSixMonths: 0,
        categories: [],
        totalInvestment: 0,
        upcomingRenewals: [],
        certificationsByYear: [],
      }

      return createSuccessResponse({
        user,
        certifications,
        summary,
      })
    } catch (error) {
      console.error('Error loading certifications:', error)
      throw new Response('Error loading certifications', { status: 500 })
    }
  })
}

export async function action(args: ActionFunctionArgs) {
  return withAuthLoader(args, async ({ user, request }) => {
    const formData = await request.formData()
    const operation = formData.get('operation') as string

    try {
      if (operation === 'create') {
        // TODO: Implement certification creation
        return createSuccessResponse({ success: true }, 'Certification created successfully')
      }

      if (operation === 'update') {
        // TODO: Implement certification update
        return createSuccessResponse({ success: true }, 'Certification updated successfully')
      }

      if (operation === 'delete') {
        // TODO: Implement certification deletion
        return createSuccessResponse({ success: true }, 'Certification deleted successfully')
      }

      throw new Response('Invalid operation', { status: 400 })
    } catch (error) {
      console.error('Error handling certification operation:', error)
      throw new Response('Error processing certification request', { status: 500 })
    }
  })
}

export default function CertificationsPage() {
  const response = useLoaderData<{ success: boolean; data: LoaderData }>()
  const data = response?.data || {}
  const { certifications, summary } = data

  const [showCreateForm, setShowCreateForm] = useState(false)

  return (
    <div className="bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Header */}
      <div className="border-b border-slate-200/50 bg-white/80 backdrop-blur-sm">
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-light text-slate-900 font-serif">
                Professional Certifications
              </h1>
              <p className="text-lg text-slate-600 font-sans mt-2">
                Track your certifications across your entire career
              </p>
            </div>
            <Button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Certification
            </Button>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/50">
            <div className="text-2xl font-bold text-slate-900">{summary.totalCertifications}</div>
            <div className="text-sm text-slate-600">Total Certifications</div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/50">
            <div className="text-2xl font-bold text-green-600">{summary.activeCertifications}</div>
            <div className="text-sm text-slate-600">Active</div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/50">
            <div className="text-2xl font-bold text-amber-600">{summary.expiringInSixMonths}</div>
            <div className="text-sm text-slate-600">Expiring Soon</div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200/50">
            <div className="text-2xl font-bold text-slate-900">
              ${(summary.totalInvestment / 100).toLocaleString()}
            </div>
            <div className="text-sm text-slate-600">Total Investment</div>
          </div>
        </div>

        {/* Certifications List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/50">
          <div className="p-6 border-b border-slate-200/50">
            <h2 className="text-xl font-semibold text-slate-900">Your Certifications</h2>
          </div>

          {certifications.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-slate-400 mb-4">
                <svg
                  className="w-16 h-16 mx-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No certifications yet</h3>
              <p className="text-slate-600 mb-6">
                Start tracking your professional certifications to showcase your expertise.
              </p>
              <Button
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                Add Your First Certification
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200/50">
              {certifications.map((cert) => (
                <CertificationCard key={cert.id} certification={cert} />
              ))}
            </div>
          )}
        </div>

        {/* Create Form Modal */}
        {showCreateForm && <CreateCertificationModal onClose={() => setShowCreateForm(false)} />}
      </div>
    </div>
  )
}

interface CertificationCardProps {
  certification: Certification
}

function CertificationCard({ certification }: CertificationCardProps) {
  const [isEditing, setIsEditing] = useState(false)

  return (
    <div className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-slate-900">{certification.name}</h3>
            <span
              className={`px-2 py-1 text-xs font-medium rounded-full ${
                certification.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : certification.status === 'expired'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-amber-100 text-amber-800'
              }`}
            >
              {certification.status}
            </span>
          </div>
          <p className="text-slate-600 mb-3">{certification.issuingOrganization}</p>
          {certification.description && (
            <p className="text-slate-700 mb-3">{certification.description}</p>
          )}
          <div className="flex items-center gap-6 text-sm text-slate-600">
            <span>Issued: {new Date(certification.issueDate).toLocaleDateString()}</span>
            {certification.expirationDate && (
              <span>Expires: {new Date(certification.expirationDate).toLocaleDateString()}</span>
            )}
            {certification.cost && (
              <span>Cost: ${(certification.cost / 100).toLocaleString()}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="text-slate-400 hover:text-slate-600"
          >
            <PencilIcon className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600">
            <TrashIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

interface CreateCertificationModalProps {
  onClose: () => void
}

function CreateCertificationModal({ onClose }: CreateCertificationModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Add Certification</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <XIcon className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <form className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="cert-name" className="block text-sm font-medium text-slate-700 mb-2">
                Certification Name *
              </label>
              <input
                id="cert-name"
                type="text"
                name="name"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="AWS Solutions Architect"
              />
            </div>
            <div>
              <label
                htmlFor="issuing-org"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Issuing Organization *
              </label>
              <input
                id="issuing-org"
                type="text"
                name="issuingOrganization"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Amazon Web Services"
              />
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-2">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Brief description of what this certification covers..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label htmlFor="issue-date" className="block text-sm font-medium text-slate-700 mb-2">
                Issue Date *
              </label>
              <input
                id="issue-date"
                type="date"
                name="issueDate"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor="expiration-date"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Expiration Date
              </label>
              <input
                id="expiration-date"
                type="date"
                name="expirationDate"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="cost" className="block text-sm font-medium text-slate-700 mb-2">
                Cost
              </label>
              <input
                id="cost"
                type="number"
                name="cost"
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="299.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-slate-700 mb-2">
                Category
              </label>
              <select
                id="category"
                name="category"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">Select category...</option>
                <option value="technical">Technical</option>
                <option value="leadership">Leadership</option>
                <option value="project_management">Project Management</option>
                <option value="security">Security</option>
                <option value="cloud">Cloud</option>
                <option value="data">Data</option>
                <option value="compliance">Compliance</option>
                <option value="industry">Industry</option>
                <option value="language">Language</option>
                <option value="design">Design</option>
              </select>
            </div>
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-slate-700 mb-2">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue="active"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="pending_renewal">Pending Renewal</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
              <CheckIcon className="w-4 h-4 mr-2" />
              Add Certification
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
