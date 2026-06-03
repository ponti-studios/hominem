import type { CareerWorkExperienceRecord as WorkExperience } from '@hominem/db';
import { Button } from '@hominem/ui/button';
import { ArrowLeftIcon, CheckIcon, PencilIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { useLoaderData, useNavigate } from 'react-router';

import { EditableArrayField } from '~/components/EditableArrayField';
import { createSuccessResponse, withAuthLoader } from '~/lib/route-utils';

interface LoaderData {
  workExperience: WorkExperience;
}

export async function loader(args: LoaderFunctionArgs) {
  return withAuthLoader(args, async ({ user }) => {
    const { id } = args.params;
    if (!id) {
      throw new Response('Work experience ID is required', { status: 400 });
    }

    try {
      const { getWorkExperienceById } = await import('~/lib/career/queries/base');
      const workExperience = await getWorkExperienceById(user.id, id);

      if (!workExperience) {
        throw new Response('Work experience not found', { status: 404 });
      }

      return createSuccessResponse({ workExperience });
    } catch (error) {
      console.error('Error loading work experience:', error);
      throw new Response('Error loading work experience', { status: 500 });
    }
  });
}

export async function action(args: ActionFunctionArgs) {
  return withAuthLoader(args, async ({ user, request }) => {
    const { id } = args.params;
    if (!id) {
      throw new Response('Work experience ID is required', { status: 400 });
    }

    const formData = await request.formData();
    const field = formData.get('field') as string;
    const value = formData.get('value') as string;

    try {
      const { updateWorkExperience } = await import('~/lib/career/queries/base');

      // Convert the value to appropriate type based on field
      let processedValue: string | number | Date | null = value;

      if (
        ['baseSalary', 'totalCompensation', 'equityValue', 'signingBonus', 'annualBonus'].includes(
          field,
        )
      ) {
        processedValue = value ? Number.parseInt(value) * 100 : null; // Convert to cents
      } else if (['teamSize', 'directReports'].includes(field)) {
        processedValue = value ? Number.parseInt(value) : null;
      } else if (['startDate', 'endDate'].includes(field)) {
        processedValue = value ? new Date(value) : null;
      }

      // Now determine how to update the database
      if (field.startsWith('metadata.')) {
        const { getWorkExperienceById } = await import('~/lib/career/queries/base');
        const currentExperience = await getWorkExperienceById(user.id, id);

        if (currentExperience) {
          const metadataField = field.replace('metadata.', '');
          const currentMetadata = currentExperience.metadata || {};

          // Parse JSON values for array fields like achievements, projects, etc.
          let parsedValue = processedValue;
          try {
            // Try to parse as JSON in case it's an array from EditableArrayField
            parsedValue = JSON.parse(value);
          } catch {
            // If parsing fails, use the original string value
            parsedValue = processedValue;
          }

          const updatedMetadata = {
            ...currentMetadata,
            [metadataField]: parsedValue,
          };

          await updateWorkExperience(user.id, id, { metadata: updatedMetadata });
        }
      } else {
        await updateWorkExperience(user.id, id, { [field]: processedValue });
      }

      return createSuccessResponse({ success: true });
    } catch (error) {
      console.error('Error updating work experience:', error);
      throw new Response('Error updating work experience', { status: 500 });
    }
  });
}

export default function WorkExperienceDetail() {
  const response = useLoaderData<{ success: boolean; data: LoaderData }>();
  const data = response?.data || {};
  const { workExperience } = data;
  const navigate = useNavigate();

  if (!workExperience) {
    return <div>Work experience not found</div>;
  }

  return (
    <div>
      {/* Header */}

      <div className="flex items-center gap-4">
        <Button
          type="button"
          onClick={() => navigate('/career')}
          variant="ghost"
          size="sm"
          className="p-2"
          data-testid="back-button"
        >
          <ArrowLeftIcon className="w-5 h-5 text-muted-foreground" />
        </Button>
        <div>
          <h1 className="text-3xl font-light text-foreground font-sans">{workExperience.role}</h1>
          <p className="text-lg text-muted-foreground font-sans">{workExperience.company}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Basic Information */}
          <Section title="Basic Information">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <EditableField
                label="Role/Position"
                value={workExperience.role}
                field="role"
                workExperienceId={workExperience.id}
              />
              <EditableField
                label="Company"
                value={workExperience.company}
                field="company"
                workExperienceId={workExperience.id}
              />
              <EditableField
                label="Start Date"
                value={workExperience.startDate?.toISOString().split('T')[0] || ''}
                field="startDate"
                type="date"
                workExperienceId={workExperience.id}
              />
              <EditableField
                label="End Date"
                value={workExperience.endDate?.toISOString().split('T')[0] || ''}
                field="endDate"
                type="date"
                workExperienceId={workExperience.id}
                placeholder="Leave blank if current"
              />
              <EditableField
                label="Employment Type"
                value={workExperience.employmentType}
                field="employmentType"
                type="select"
                options={[
                  'full-time',
                  'part-time',
                  'contract',
                  'freelance',
                  'internship',
                  'temporary',
                ]}
                workExperienceId={workExperience.id}
              />
              <EditableField
                label="Work Arrangement"
                value={workExperience.workArrangement}
                field="workArrangement"
                type="select"
                options={['office', 'remote', 'hybrid', 'travel']}
                workExperienceId={workExperience.id}
              />
            </div>
            <EditableField
              label="Description"
              value={workExperience.description}
              field="description"
              type="textarea"
              workExperienceId={workExperience.id}
              className="mt-6"
            />
          </Section>

          {/* Financial Information */}
          <Section title="Financial Information">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <EditableField
                label="Base Salary"
                value={
                  workExperience.baseSalary ? (workExperience.baseSalary / 100).toString() : ''
                }
                field="baseSalary"
                type="number"
                workExperienceId={workExperience.id}
                prefix="$"
                placeholder="Annual salary"
              />
              <EditableField
                label="Total Compensation"
                value={
                  workExperience.totalCompensation
                    ? (workExperience.totalCompensation / 100).toString()
                    : ''
                }
                field="totalCompensation"
                type="number"
                workExperienceId={workExperience.id}
                prefix="$"
                placeholder="Including equity & bonuses"
              />
              <EditableField
                label="Signing Bonus"
                value={
                  workExperience.signingBonus ? (workExperience.signingBonus / 100).toString() : ''
                }
                field="signingBonus"
                type="number"
                workExperienceId={workExperience.id}
                prefix="$"
              />
              <EditableField
                label="Annual Bonus"
                value={
                  workExperience.annualBonus ? (workExperience.annualBonus / 100).toString() : ''
                }
                field="annualBonus"
                type="number"
                workExperienceId={workExperience.id}
                prefix="$"
              />
              <EditableField
                label="Equity Value"
                value={
                  workExperience.equityValue ? (workExperience.equityValue / 100).toString() : ''
                }
                field="equityValue"
                type="number"
                workExperienceId={workExperience.id}
                prefix="$"
                placeholder="Estimated value"
              />
              <EditableField
                label="Equity Percentage"
                value={workExperience.equityPercentage || ''}
                field="equityPercentage"
                workExperienceId={workExperience.id}
                placeholder="0.5%"
              />
            </div>
          </Section>

          {/* Role Details */}
          <Section title="Role Details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <EditableField
                label="Seniority Level"
                value={workExperience.seniorityLevel || ''}
                field="seniorityLevel"
                type="select"
                options={[
                  'intern',
                  'entry-level',
                  'mid-level',
                  'senior',
                  'lead',
                  'principal',
                  'staff',
                  'director',
                  'vp',
                  'c-level',
                ]}
                workExperienceId={workExperience.id}
              />
              <EditableField
                label="Department"
                value={workExperience.department || ''}
                field="department"
                workExperienceId={workExperience.id}
              />
              <EditableField
                label="Team Size"
                value={workExperience.teamSize?.toString() || ''}
                field="teamSize"
                type="number"
                workExperienceId={workExperience.id}
              />
              <EditableField
                label="Direct Reports"
                value={workExperience.directReports?.toString() || ''}
                field="directReports"
                type="number"
                workExperienceId={workExperience.id}
              />
              <EditableField
                label="Reports To"
                value={workExperience.reportsTo || ''}
                field="reportsTo"
                workExperienceId={workExperience.id}
              />
            </div>
          </Section>

          {/* Achievements & Projects */}
          <Section title="Achievements & Projects">
            <div className="space-y-6">
              <EditableArrayField
                label="Key Achievements"
                value={(workExperience.metadata?.achievements as string[] | undefined) || []}
                field="metadata.achievements"
                placeholder="Describe a key achievement or accomplishment"
              />

              <EditableArrayField
                label="Technologies Used"
                value={(workExperience.metadata?.technologies as string[] | undefined) || []}
                field="metadata.technologies"
                placeholder="Technology, framework, or tool"
              />

              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Major Projects</h3>
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg border border-border">
                  <div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Track work items, projects, and their impact for interview prep
                    </p>
                  </div>
                  <Button
                    id="manage-projects-button"
                    type="button"
                    onClick={() => navigate(`/career/experience/${workExperience.id}/projects`)}
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    Manage Projects
                  </Button>
                </div>
              </div>
            </div>
          </Section>

          {/* Exit Information */}
          <Section title="Exit Information">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <EditableField
                label="Reason for Leaving"
                value={workExperience.reasonForLeaving || ''}
                field="reasonForLeaving"
                type="select"
                options={[
                  'promotion',
                  'better_opportunity',
                  'relocation',
                  'layoff',
                  'termination',
                  'contract_end',
                  'career_change',
                  'salary',
                  'culture',
                  'management',
                  'growth',
                  'personal',
                ]}
                workExperienceId={workExperience.id}
              />
            </div>
            <EditableField
              label="Exit Notes"
              value={workExperience.exitNotes || ''}
              field="exitNotes"
              type="textarea"
              workExperienceId={workExperience.id}
              className="mt-6"
            />
          </Section>
        </div>
      </div>
    </div>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <div className="bg-card rounded-md p-8  border border-border/50">
      <h2 className="text-2xl font-light text-foreground font-sans mb-6">{title}</h2>
      {children}
    </div>
  );
}

interface EditableFieldProps {
  label: string;
  value: string;
  field: string;
  workExperienceId: string;
  type?: 'text' | 'number' | 'date' | 'textarea' | 'select';
  options?: string[];
  prefix?: string;
  placeholder?: string;
  className?: string;
}

function EditableField({
  label,
  value,
  field,
  type = 'text',
  options = [],
  prefix,
  placeholder,
  className = '',
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.style.display = 'none';

    const fieldInput = document.createElement('input');
    fieldInput.name = 'field';
    fieldInput.value = field;

    // Use textarea for multiline content to preserve line breaks
    if (type === 'textarea') {
      const valueTextarea = document.createElement('textarea');
      valueTextarea.name = 'value';
      valueTextarea.value = editValue;
      valueTextarea.style.display = 'none';
      form.appendChild(valueTextarea);
    } else {
      const valueInput = document.createElement('input');
      valueInput.name = 'value';
      valueInput.value = editValue;
      form.appendChild(valueInput);
    }

    form.appendChild(fieldInput);
    document.body.appendChild(form);

    form.submit();
    document.body.removeChild(form);

    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const displayValue = value || 'Not set';

  if (isEditing) {
    return (
      <div className={className}>
        <div className="block text-sm font-medium text-muted-foreground mb-2">{label}</div>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {prefix && <span className="text-muted-foreground">{prefix}</span>}
            {type === 'textarea' ? (
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1 block w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ring focus:ring-ring/50"
                rows={3}
                placeholder={placeholder}
              />
            ) : type === 'select' ? (
              <select
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1 block w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ring focus:ring-ring/50"
              >
                <option value="">Select...</option>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={type}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1 block w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-ring focus:ring-ring/50"
                placeholder={placeholder}
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={handleSave}
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-primary-foreground"
            >
              <CheckIcon className="w-4 h-4 mr-1" />
              Save
            </Button>
            <Button
              type="button"
              onClick={handleCancel}
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:bg-muted"
            >
              <XIcon className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-muted-foreground">{label}</div>
        <Button
          type="button"
          onClick={() => setIsEditing(true)}
          variant="ghost"
          size="sm"
          className="p-1 text-muted-foreground hover:text-muted-foreground focus:text-muted-foreground"
          aria-label={`Edit ${label}`}
        >
          <PencilIcon className="w-4 h-4" />
        </Button>
      </div>
      <div>
        {prefix && value && <span className="text-muted-foreground mr-1">{prefix}</span>}
        {type === 'textarea' ? (
          <div
            className={`${!value ? 'text-muted-foreground italic' : 'text-foreground'} whitespace-pre-line break-words`}
          >
            {value || 'Not set'}
          </div>
        ) : (
          <span className={`${!value ? 'text-muted-foreground italic' : 'text-foreground'}`}>
            {type === 'number' && value ? Number.parseInt(value).toLocaleString() : displayValue}
          </span>
        )}
      </div>
    </div>
  );
}
