import type { InputType } from 'storybook/internal/csf';

type StorybookControlTable = NonNullable<InputType['table']>;

type StorybookControlCondition = NonNullable<InputType['if']>;

type StorybookControl = InputType;

type SelectControlConfig = {
  controlType?: 'select' | 'radio' | 'inline-radio' | 'check' | 'inline-check' | 'multi-select';
  defaultValue?: boolean | number | string | null;
  if?: StorybookControlCondition;
  labels?: Record<string, string>;
  mapping?: Record<string, unknown>;
  table?: StorybookControlTable;
};

const commonControlsExclude = /^(className|style|children|asChild|on[A-Z].*|render[A-Z].*)$/;

const hiddenControl = {
  control: false,
  table: {
    disable: true,
  },
} satisfies StorybookControl;

function withDefaultValue(
  control: StorybookControl,
  defaultValue?: boolean | number | string | null,
): StorybookControl {
  if (defaultValue === undefined) {
    return control;
  }

  return {
    ...control,
    table: {
      ...control.table,
      defaultValue: {
        summary: String(defaultValue),
      },
    },
  };
}

function booleanControl(description: string, defaultValue?: boolean): StorybookControl {
  return withDefaultValue(
    {
      control: 'boolean',
      description,
    },
    defaultValue,
  );
}

function textControl(description: string, defaultValue?: string): StorybookControl {
  return withDefaultValue(
    {
      control: 'text',
      description,
    },
    defaultValue,
  );
}

function numberControl(
  description: string,
  config?: {
    defaultValue?: number;
    max?: number;
    min?: number;
    step?: number;
  },
): StorybookControl {
  return withDefaultValue(
    {
      control: {
        max: config?.max,
        min: config?.min,
        step: config?.step,
        type: 'number',
      },
      description,
    },
    config?.defaultValue,
  );
}

function selectControl<T extends boolean | number | string | null>(
  options: readonly T[],
  description: string,
  config?: SelectControlConfig,
): StorybookControl {
  return withDefaultValue(
    {
      control: {
        type: config?.controlType ?? 'select',
      },
      description,
      options,
      ...(config?.if ? { if: config.if } : {}),
      ...(config?.labels ? { labels: config.labels } : {}),
      ...(config?.mapping ? { mapping: config.mapping } : {}),
      ...(config?.table ? { table: config.table } : {}),
    },
    config?.defaultValue,
  );
}

export {
  booleanControl,
  commonControlsExclude,
  hiddenControl,
  numberControl,
  selectControl,
  textControl,
};
