import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';

import {
  booleanControl,
  hiddenControl,
  selectControl,
  textControl,
} from '../../storybook/controls';
import { codeBlockLanguageOptions } from '../../storybook/options';
import type { CodeBlockProps } from './code-block';
import CodeBlock from './code-block';

type CodeBlockStoryArgs = CodeBlockProps;

const meta = {
  title: 'Patterns/AI/CodeBlock',
  component: CodeBlockWrapper,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Code block component with syntax highlighting and copy functionality. Used in AI assistant responses to display code snippets with language detection and clipboard support.',
      },
    },
  },
  argTypes: {
    language: selectControl(
      codeBlockLanguageOptions,
      'Programming language for syntax highlighting',
      {
        defaultValue: 'javascript',
      },
    ),
    code: textControl('Code content to display'),
    isCopied: booleanControl('Whether the copy action has been completed', false),
    onCopy: hiddenControl,
  },
  args: {
    language: 'javascript',
    code: "console.log('Hello');",
    isCopied: false,
  },
} satisfies Meta<typeof CodeBlockWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

function CodeBlockWrapper({ code, isCopied, ...props }: CodeBlockStoryArgs) {
  const [currentCopied, setCurrentCopied] = useState(isCopied);

  useEffect(() => {
    setCurrentCopied(isCopied);
  }, [isCopied]);

  useEffect(() => {
    if (!currentCopied) {
      return;
    }

    const timeout = window.setTimeout(() => setCurrentCopied(false), 2000);

    return () => window.clearTimeout(timeout);
  }, [currentCopied]);

  const handleCopy = () => {
    setCurrentCopied(true);
    void navigator.clipboard.writeText(code);
  };

  return <CodeBlock {...props} code={code} isCopied={currentCopied} onCopy={handleCopy} />;
}

export const TypeScript: Story = {
  args: {
    language: 'typescript',
    code: `interface User {
  id: string;
  name: string;
  email: string;
}

async function fetchUser(id: string): Promise<User> {
  const response = await fetch(\`/api/users/\${id}\`);
  return response.json();
}`,
  },
};

export const TSX: Story = {
  args: {
    language: 'tsx',
    code: `export function Button({ children, onClick }: Props) {
  return (
    <button
      className="px-4 py-2 rounded-md bg-primary text-white"
      onClick={onClick}
    >
      {children}
    </button>
  );
}`,
  },
};

export const Python: Story = {
  args: {
    language: 'python',
    code: `def fibonacci(n: int) -> int:
    """Calculate the nth Fibonacci number."""
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

# Example usage
result = fibonacci(10)
print(f"Fibonacci(10) = {result}")`,
  },
};

export const Bash: Story = {
  args: {
    language: 'bash',
    code: `# Install dependencies
npm install

# Build the project
npm run build

# Start development server
npm run dev

# Run tests
npm run test`,
  },
};

export const JSON: Story = {
  args: {
    language: 'json',
    code: `{
  "name": "@hakumi/ui",
  "version": "0.0.0",
  "scripts": {
    "build": "vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^19.0.0",
    "tailwindcss": "^4.0.0"
  }
}`,
  },
};

export const SQL: Story = {
  args: {
    language: 'sql',
    code: `SELECT
  users.id,
  users.name,
  COUNT(posts.id) as post_count
FROM users
LEFT JOIN posts ON users.id = posts.user_id
GROUP BY users.id
ORDER BY post_count DESC
LIMIT 10;`,
  },
};

export const LongCode: Story = {
  args: {
    language: 'typescript',
    code: `// Large component with multiple sections
import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

interface ListItem {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

interface ListProps {
  initialSort?: 'name' | 'date';
  onSelect?: (item: ListItem) => void;
  maxItems?: number;
}

export function DataList({
  initialSort = 'date',
  onSelect,
  maxItems = 50
}: ListProps) {
  const [sortBy, setSortBy] = useState<'name' | 'date'>(initialSort);
  const [filter, setFilter] = useState<'active' | 'all'>('all');

  const { data, isLoading, error } = useQuery({
    queryKey: ['items', filter, sortBy],
    queryFn: async () => {
      const response = await fetch(\`/api/items?filter=\${filter}&sort=\${sortBy}\`);
      return response.json() as Promise<ListItem[]>;
    },
  });

  const filteredAndSorted = useMemo(() => {
    if (!data) return [];

    let items = [...data];

    if (sortBy === 'name') {
      items.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return items.slice(0, maxItems);
  }, [data, sortBy, maxItems]);

  const handleSelectItem = useCallback((item: ListItem) => {
    onSelect?.(item);
  }, [onSelect]);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading items</div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <button onClick={() => setSortBy('name')}>Sort by Name</button>
        <button onClick={() => setSortBy('date')}>Sort by Date</button>
      </div>
      <ul>
        {filteredAndSorted.map(item => (
          <li
            key={item.id}
            onClick={() => handleSelectItem(item)}
          >
            {item.name}
          </li>
        ))}
      </ul>
    </div>
  );
}`,
  },
};

export const Default: Story = {
  args: {
    language: 'javascript',
    code: `const greeting = (name) => {
  return \`Hello, \${name}!\`;
};

console.log(greeting('World'));`,
  },
};
