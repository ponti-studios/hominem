import type { CareerWorkExperienceRecord as WorkExperience } from '@hominem/db';
import { Button } from '@hominem/ui/button';
import { ArrowLeftIcon, PlusIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { useLoaderData, useNavigate } from 'react-router';

import { jsonObject } from '~/lib/db-json';
import { createSuccessResponse, withAuthLoader } from '~/lib/route-utils';
import { cn } from '~/lib/utils';
import type { WorkExperienceMetadata } from '~/types/career-data';
interface LoaderData {
  workExperience: WorkExperience;
}

export async function loader(args: LoaderFunctionArgs) {
  return withAuthLoader(args, async ({ user }) => {
    const { id } = args.params;
    if (!id) throw new Response('Work experience ID is required', { status: 400 });
    try {
      const { getWorkExperienceById } = await import('~/lib/career/queries/base');
      const workExperience = await getWorkExperienceById(user.id, id);
      if (!workExperience) throw new Response('Work experience not found', { status: 404 });
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
    if (!id) throw new Response('Work experience ID is required', { status: 400 });
    const formData = await request.formData();
    const field = formData.get('field') as string;
    const value = formData.get('value') as string;
    try {
      const { updateWorkExperience } = await import('~/lib/career/queries/base');
      let processedValue: string | number | Date | null = value;
      if (
        [
          'base_salary',
          'total_compensation',
          'equity_value',
          'signing_bonus',
          'annual_bonus',
        ].includes(field)
      ) {
        processedValue = value ? Number.parseInt(value) * 100 : null;
      } else if (['team_size', 'direct_reports'].includes(field)) {
        processedValue = value ? Number.parseInt(value) : null;
      } else if (['start_date', 'end_date'].includes(field)) {
        processedValue = value ? new Date(value) : null;
      }
      if (field.startsWith('metadata.')) {
        const { getWorkExperienceById } = await import('~/lib/career/queries/base');
        const current = await getWorkExperienceById(user.id, id);
        if (current) {
          const metadataField = field.replace('metadata.', '');
          const metadata = jsonObject<Record<string, unknown>>(current.metadata) ?? {};
          let parsedValue: unknown = processedValue;
          try {
            parsedValue = JSON.parse(value);
          } catch {
            parsedValue = processedValue;
          }
          await updateWorkExperience(user.id, id, {
            metadata: { ...metadata, [metadataField]: parsedValue },
          });
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

// ─── helpers ──────────────────────────────────────────────────────────────────

function submitField(field: string, value: string) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.style.display = 'none';
  const f = document.createElement('input');
  f.name = 'field';
  f.value = field;
  const v = document.createElement('textarea');
  v.name = 'value';
  v.value = value;
  form.appendChild(f);
  form.appendChild(v);
  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function fmtCurrency(cents: number | null | undefined) {
  if (!cents) return null;
  const k = cents / 100;
  return k >= 1000 ? `$${(k / 1000).toFixed(0)}k` : `$${k.toLocaleString()}`;
}

function capitalize(s: string) {
  return s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── inline editable ──────────────────────────────────────────────────────────

interface InlineEditableProps {
  value: string | null | undefined;
  field: string;
  type?: 'text' | 'number' | 'date' | 'select' | 'textarea';
  options?: string[];
  placeholder?: string;
  className?: string;
  prefix?: string;
  suffix?: string;
  /** extra transform applied to the displayed (not editing) value */
  display?: (v: string) => string;
}

function InlineEditable({
  value,
  field,
  type = 'text',
  options = [],
  placeholder = '—',
  className = '',
  prefix,
  suffix,
  display,
}: InlineEditableProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const cancelledRef = useRef(false);

  const startEdit = () => {
    setDraft(value ?? '');
    cancelledRef.current = false;
    setEditing(true);
  };

  const save = () => {
    if (!cancelledRef.current && draft !== (value ?? '')) {
      submitField(field, draft);
    }
    setEditing(false);
  };

  const cancel = () => {
    cancelledRef.current = true;
    setDraft(value ?? '');
    setEditing(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
    if (e.key === 'Enter' && type !== 'textarea') {
      e.preventDefault();
      save();
    }
  };

  const baseInputCls =
    'bg-transparent border-b border-ring/50 focus:border-ring focus:outline-none text-foreground placeholder:text-muted-foreground/40';

  if (editing) {
    if (type === 'textarea') {
      return (
        <textarea
          // biome-ignore lint/a11y/noAutofocus: intentional inline edit
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              cancel();
            }
          }}
          className={cn(baseInputCls, 'w-full resize-none leading-relaxed', className)}
          rows={4}
          placeholder={placeholder}
        />
      );
    }
    if (type === 'select') {
      return (
        <select
          // biome-ignore lint/a11y/noAutofocus: intentional inline edit
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={onKeyDown}
          className={cn(baseInputCls, className)}
        >
          <option value="">—</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {capitalize(o)}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        // biome-ignore lint/a11y/noAutofocus: intentional inline edit
        autoFocus
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={onKeyDown}
        className={cn(baseInputCls, className)}
        placeholder={placeholder}
      />
    );
  }

  const isEmpty = !value;
  const shown = isEmpty ? null : display ? display(value!) : value!;

  return (
    <span
      onClick={startEdit}
      title="Click to edit"
      className={cn(
        'cursor-text transition-colors',
        isEmpty
          ? 'text-muted-foreground/40 italic hover:text-muted-foreground/70'
          : 'hover:underline decoration-dotted underline-offset-2',
        className,
      )}
    >
      {!isEmpty && prefix && <span className="text-muted-foreground">{prefix}</span>}
      {shown ?? placeholder}
      {!isEmpty && suffix && <span className="text-muted-foreground">{suffix}</span>}
    </span>
  );
}

// ─── array editors ────────────────────────────────────────────────────────────

function AchievementList({ items, field }: { items: string[]; field: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(items);

  const save = () => {
    const filtered = draft.map((v) => v.trim()).filter(Boolean);
    submitField(field, JSON.stringify(filtered));
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 text-sm leading-relaxed">
            <span className="mt-0.5 text-muted-foreground/60 shrink-0">•</span>
            <span>{item}</span>
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            setDraft(items.length ? items : ['']);
            setEditing(true);
          }}
          className="flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground mt-1 transition-colors"
        >
          <PlusIcon className="w-3 h-3" />
          {items.length ? 'Edit' : 'Add achievement'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {draft.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-muted-foreground/60 shrink-0">•</span>
          <input
            type="text"
            value={item}
            onChange={(e) => {
              const next = [...draft];
              next[i] = e.target.value;
              setDraft(next);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                setDraft((d) => {
                  const n = [...d];
                  n.splice(i + 1, 0, '');
                  return n;
                });
              }
              if (e.key === 'Backspace' && item === '' && draft.length > 1) {
                e.preventDefault();
                setDraft((d) => d.filter((_, idx) => idx !== i));
              }
            }}
            // biome-ignore lint/a11y/noAutofocus: intentional
            autoFocus={i === draft.length - 1}
            className="flex-1 bg-transparent border-b border-border/50 focus:border-ring focus:outline-none text-sm py-0.5"
            placeholder="Achievement…"
          />
          <button
            type="button"
            onClick={() => setDraft((d) => d.filter((_, idx) => idx !== i))}
            className="text-muted-foreground/40 hover:text-destructive text-xs"
            aria-label="Remove"
          >
            ×
          </button>
        </div>
      ))}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => setDraft((d) => [...d, ''])}
          className="text-xs text-muted-foreground/50 hover:text-muted-foreground flex items-center gap-1"
        >
          <PlusIcon className="w-3 h-3" /> Add
        </button>
        <button type="button" onClick={save} className="text-xs text-primary hover:text-primary/80">
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft(items);
            setEditing(false);
          }}
          className="text-xs text-muted-foreground/50 hover:text-muted-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function TechTags({ items, field }: { items: string[]; field: string }) {
  const [adding, setAdding] = useState(false);
  const [newTag, setNewTag] = useState('');

  const remove = (i: number) => {
    const next = items.filter((_, idx) => idx !== i);
    submitField(field, JSON.stringify(next));
  };

  const add = () => {
    const tag = newTag.trim();
    if (!tag) {
      setAdding(false);
      return;
    }
    submitField(field, JSON.stringify([...items, tag]));
    setNewTag('');
    setAdding(false);
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t, i) => (
        <button
          key={i}
          type="button"
          onClick={() => remove(i)}
          title="Click to remove"
          className="px-2 py-0.5 rounded-full bg-muted text-xs text-foreground hover:bg-destructive/10 hover:text-destructive hover:line-through transition-colors"
        >
          {t}
        </button>
      ))}
      {adding ? (
        <input
          // biome-ignore lint/a11y/noAutofocus: intentional
          autoFocus
          type="text"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add();
            if (e.key === 'Escape') {
              setAdding(false);
              setNewTag('');
            }
          }}
          onBlur={add}
          className="px-2 py-0.5 rounded-full bg-muted text-xs border border-ring/50 focus:outline-none w-24"
          placeholder="add tag…"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="px-2 py-0.5 rounded-full border border-dashed border-muted-foreground/30 text-xs text-muted-foreground/40 hover:text-muted-foreground hover:border-muted-foreground/60 transition-colors"
        >
          + add
        </button>
      )}
    </div>
  );
}

// ─── layout primitives ────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 h-px bg-border/50" />
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function WorkExperienceDetail() {
  const response = useLoaderData<{ success: boolean; data: LoaderData }>();
  const { workExperience: wx } = response?.data ?? {};
  const navigate = useNavigate();

  if (!wx) return <div className="p-8 text-muted-foreground">Work experience not found</div>;

  const metadata = jsonObject<WorkExperienceMetadata>(wx.metadata) ?? {};
  const achievements = metadata.achievements ?? [];
  const technologies = metadata.technologies ?? [];

  const hasFinancial = !!(
    wx.base_salary ||
    wx.total_compensation ||
    wx.signing_bonus ||
    wx.annual_bonus ||
    wx.equity_value ||
    wx.equity_percentage
  );
  const hasTeam = !!(
    wx.team_size ||
    wx.direct_reports ||
    wx.reports_to ||
    wx.seniority_level ||
    wx.department
  );
  const hasExit = !!(wx.reason_for_leaving || wx.exit_notes);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Back */}
      <button
        type="button"
        onClick={() => navigate('/career')}
        data-testid="back-button"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeftIcon className="w-3.5 h-3.5" />
        Career
      </button>

      {/* Identity */}
      <div className="space-y-1">
        <InlineEditable
          value={wx.role}
          field="role"
          placeholder="Role / Position"
          className="text-2xl font-semibold text-foreground block w-full"
        />
        <InlineEditable
          value={wx.company}
          field="company"
          placeholder="Company"
          className="text-lg text-muted-foreground block"
        />

        {/* Metadata row — each segment is individually editable */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground pt-1">
          <InlineEditable
            value={wx.start_date ? new Date(wx.start_date).toISOString().split('T')[0] : ''}
            field="start_date"
            type="date"
            placeholder="Start"
            display={(_v) => fmtDate(wx.start_date) ?? ''}
          />
          <span className="text-muted-foreground/40">–</span>
          <InlineEditable
            value={wx.end_date ? new Date(wx.end_date).toISOString().split('T')[0] : ''}
            field="end_date"
            type="date"
            placeholder="Present"
            display={(_v) => fmtDate(wx.end_date) ?? ''}
          />
          <Sep />
          <InlineEditable
            value={wx.employment_type ?? ''}
            field="employment_type"
            type="select"
            options={['full-time', 'part-time', 'contract', 'freelance', 'internship', 'temporary']}
            placeholder="Type"
            display={capitalize}
          />
          <Sep />
          <InlineEditable
            value={wx.work_arrangement ?? ''}
            field="work_arrangement"
            type="select"
            options={['office', 'remote', 'hybrid', 'travel']}
            placeholder="Arrangement"
            display={capitalize}
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <InlineEditable
          value={wx.description ?? ''}
          field="description"
          type="textarea"
          placeholder="Add a description of your role and responsibilities…"
          className="text-sm text-foreground/90 leading-relaxed w-full block"
        />
      </div>

      {/* Achievements */}
      <div>
        <SectionLabel>Achievements</SectionLabel>
        <AchievementList items={achievements} field="metadata.achievements" />
      </div>

      {/* Technologies */}
      <div>
        <SectionLabel>Technologies</SectionLabel>
        <TechTags items={technologies} field="metadata.technologies" />
      </div>

      {/* Projects */}
      <div>
        <SectionLabel>Projects</SectionLabel>
        <button
          type="button"
          onClick={() => navigate(`/career/experience/${wx.id}/projects`)}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
        >
          Manage projects
          <span className="text-muted-foreground/40">→</span>
        </button>
      </div>

      {/* Financial — hidden until populated, soft prompt if not */}
      {hasFinancial ? (
        <div>
          <SectionLabel>Compensation</SectionLabel>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <CompFact label="Base" value={wx.base_salary} field="base_salary" cents />
            <CompFact
              label="Total comp"
              value={wx.total_compensation}
              field="total_compensation"
              cents
            />
            <CompFact label="Signing" value={wx.signing_bonus} field="signing_bonus" cents />
            <CompFact label="Annual bonus" value={wx.annual_bonus} field="annual_bonus" cents />
            <CompFact label="Equity value" value={wx.equity_value} field="equity_value" cents />
            {(wx.equity_percentage || true) && (
              <span className="text-muted-foreground">
                <InlineEditable
                  value={wx.equity_percentage ?? ''}
                  field="equity_percentage"
                  placeholder="0.5% equity"
                  suffix=" equity"
                />
              </span>
            )}
          </div>
        </div>
      ) : (
        <AddPrompt label="Add compensation" onExpand={() => submitField('base_salary', '')} />
      )}

      {/* Team — hidden until populated */}
      {hasTeam ? (
        <div>
          <SectionLabel>Team</SectionLabel>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
            {(wx.seniority_level || true) && (
              <InlineEditable
                value={wx.seniority_level ?? ''}
                field="seniority_level"
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
                placeholder="Seniority"
                display={capitalize}
              />
            )}
            {(wx.department || true) && (
              <>
                <Sep />
                <InlineEditable
                  value={wx.department ?? ''}
                  field="department"
                  placeholder="Department"
                />
              </>
            )}
            {wx.team_size != null && (
              <>
                <Sep />
                <InlineEditable
                  value={wx.team_size.toString()}
                  field="team_size"
                  type="number"
                  placeholder="Team size"
                  suffix="-person team"
                />
              </>
            )}
            {wx.direct_reports != null && (
              <>
                <Sep />
                <InlineEditable
                  value={wx.direct_reports.toString()}
                  field="direct_reports"
                  type="number"
                  placeholder="Reports"
                  suffix=" direct reports"
                />
              </>
            )}
            {(wx.reports_to || true) && (
              <>
                <Sep />
                <span className="text-muted-foreground/60">→</span>
                <InlineEditable
                  value={wx.reports_to ?? ''}
                  field="reports_to"
                  placeholder="Reports to"
                />
              </>
            )}
          </div>
        </div>
      ) : (
        <AddPrompt label="Add team details" onExpand={() => {}} />
      )}

      {/* Exit — hidden until populated */}
      {hasExit && (
        <div>
          <SectionLabel>Exit</SectionLabel>
          <div className="space-y-2 text-sm text-muted-foreground">
            <InlineEditable
              value={wx.reason_for_leaving ?? ''}
              field="reason_for_leaving"
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
              placeholder="Reason for leaving"
              display={capitalize}
            />
            {wx.exit_notes && (
              <InlineEditable
                value={wx.exit_notes}
                field="exit_notes"
                type="textarea"
                placeholder="Exit notes…"
                className="block w-full leading-relaxed"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── small helpers ────────────────────────────────────────────────────────────

function Sep() {
  return <span className="text-muted-foreground/30 select-none">·</span>;
}

function CompFact({
  label,
  value,
  field,
  cents,
}: {
  label: string;
  value: number | null | undefined;
  field: string;
  cents?: boolean;
}) {
  if (!value) return null;
  const display = cents ? fmtCurrency(value) : value.toString();
  return (
    <span className="text-muted-foreground">
      <span className="text-muted-foreground/60 text-xs mr-1">{label}</span>
      <InlineEditable
        value={cents ? (value / 100).toString() : value.toString()}
        field={field}
        type="number"
        prefix="$"
        display={() => display ?? ''}
      />
    </span>
  );
}

function AddPrompt({ label, onExpand }: { label: string; onExpand: () => void }) {
  return (
    <button
      type="button"
      onClick={onExpand}
      className="flex items-center gap-1.5 text-xs text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
    >
      <PlusIcon className="w-3 h-3" />
      {label}
    </button>
  );
}
