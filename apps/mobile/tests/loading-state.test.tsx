import { render, screen } from '@testing-library/react-native';

import { LoadingState } from '~/components/loading-state';

describe('LoadingState', () => {
  it('renders the page loading state', () => {
    render(<LoadingState variant="page" message="Loading chat..." />);

    expect(screen.getByText('Loading chat...')).toBeTruthy();
  });
});
