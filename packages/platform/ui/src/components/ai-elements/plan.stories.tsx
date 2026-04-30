import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../button';
import { Plan, PlanContent, PlanFooter, PlanHeader, PlanStep } from './plan';

function PlanPreview(props: { children: React.ReactNode }) {
  return <Plan {...props} />;
}

const meta = {
  title: 'Patterns/AI/Plan',
  component: PlanPreview,
  tags: ['autodocs'],
  parameters: {
    controls: {
      disable: true,
    },
  },
} satisfies Meta<typeof PlanPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: null,
  },
  render: () => (
    <div className="max-w-sm">
      <Plan>
        <PlanHeader title="Research Plan" />
        <PlanContent>
          <PlanStep
            index={0}
            status="completed"
            title="Gather requirements"
            description="Understand what the user needs."
          />
          <PlanStep
            index={1}
            status="in-progress"
            title="Search documentation"
            description="Look for relevant technical documentation."
          />
          <PlanStep
            index={2}
            status="pending"
            title="Synthesize findings"
            description="Combine information into a summary."
          />
          <PlanStep
            index={3}
            status="pending"
            title="Present results"
            description="Format and deliver the final output."
          />
        </PlanContent>
        <PlanFooter>
          <Button size="sm" variant="ghost">
            Cancel
          </Button>
          <Button size="sm">Continue</Button>
        </PlanFooter>
      </Plan>
    </div>
  ),
};
