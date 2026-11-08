import { Globe } from 'lucide-react';
import { Controller, useFormContext } from 'react-hook-form';
import { siGithub, siX } from 'simple-icons';

import { DetailSection } from '~/components/design/detail';
import { PrefixInput } from '~/components/design/forms';
import type { ProfileDetailsFormValues } from '~/modules/career/lib/account/types';

const linkedinPath =
  'M416 32L31.9 32C14.3 32 0 46.5 0 64.3L0 447.7C0 465.5 14.3 480 31.9 480L416 480c17.6 0 32-14.5 32-32.3l0-383.4C448 46.5 433.6 32 416 32zM135.4 416l-66.4 0 0-213.8 66.5 0 0 213.8-.1 0zM102.2 96a38.5 38.5 0 1 1 0 77 38.5 38.5 0 1 1 0-77zM384.3 416l-66.4 0 0-104c0-24.8-.5-56.7-34.5-56.7-34.6 0-39.9 27-39.9 54.9l0 105.8-66.4 0 0-213.8 63.7 0 0 29.2 .9 0c8.9-16.8 30.6-34.5 62.9-34.5 67.2 0 79.7 44.3 79.7 101.9l0 117.2z';

function BrandIcon({ path, viewBox = '0 0 24 24' }: { path: string; viewBox?: string }) {
  return (
    <svg aria-hidden="true" className="size-4 text-[#9ba3b4]" fill="currentColor" viewBox={viewBox}>
      <path d={path} />
    </svg>
  );
}

const FIELDS = [
  {
    name: 'github' as const,
    label: (
      <>
        <BrandIcon path={siGithub.path} />
        GitHub
      </>
    ),
    prefix: 'github.com/',
    placeholder: 'username',
    pattern: {
      value: /^[a-zA-Z0-9]([a-zA-Z0-9-])*[a-zA-Z0-9]$/,
      message: 'Enter a valid GitHub username',
    },
  },
  {
    name: 'linkedin' as const,
    label: (
      <>
        <BrandIcon path={linkedinPath} viewBox="0 0 448 512" />
        LinkedIn
      </>
    ),
    prefix: 'linkedin.com/in/',
    placeholder: 'username',
    pattern: {
      value: /^[a-zA-Z0-9-]+$/,
      message: 'Enter a valid LinkedIn username',
    },
  },
  {
    name: 'twitter' as const,
    label: (
      <>
        <BrandIcon path={siX.path} />
        Twitter / X
      </>
    ),
    prefix: 'x.com/',
    placeholder: 'username',
    pattern: {
      value: /^[a-zA-Z0-9_]+$/,
      message: 'Enter a valid Twitter username',
    },
  },
  {
    name: 'website' as const,
    label: (
      <>
        <Globe className="size-4 text-[#9ba3b4]" />
        Website
      </>
    ),
    prefix: 'https://',
    placeholder: 'yoursite.com',
    pattern: {
      value: /^https?:\/\/.+\..+/,
      message: 'Enter a valid URL starting with https://',
    },
  },
] as const;

// Hooks into the page-level react-hook-form context (not its own form) so
// this fieldset shares dirty state and the save action with ProfilePage's SaveBar.
export function SocialLinksSection() {
  const {
    control,
    formState: { errors },
  } = useFormContext<ProfileDetailsFormValues>();

  return (
    <DetailSection title="Social">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <Controller
            key={field.name}
            name={field.name}
            control={control}
            rules={{ pattern: field.pattern }}
            render={({ field: controllerField }) => (
              <PrefixInput
                label={field.label}
                name={field.name}
                prefix={field.prefix}
                field={{
                  value: controllerField.value ?? '',
                  name: controllerField.name,
                  onChange: (value: string) => controllerField.onChange(value),
                  onBlur: () => {
                    controllerField.onBlur();
                  },
                }}
                placeholder={field.placeholder}
                error={errors[field.name]?.message}
              />
            )}
          />
        ))}
      </div>
    </DetailSection>
  );
}
