import * as React from 'react';

export function interleaveChildren(children: React.ReactNode, divider: React.ReactNode) {
  const items = React.Children.toArray(children);

  return items.flatMap((child, index) => {
    if (index === items.length - 1) {
      return [child];
    }

    const key = React.isValidElement(child) && child.key !== null ? String(child.key) : `${index}`;

    return [child, React.createElement(React.Fragment, { key: `divider-${key}` }, divider)];
  });
}
