import React, { Component, type ReactNode } from 'react';

import {
  createBoundaryStateFromError,
  createRootFallbackMessage,
  resetBoundaryState,
  type BoundaryState,
} from '~/utils/error-boundary/contracts';
import { logError } from '~/utils/error-boundary/log-error';

import { FullScreenErrorFallback } from './full-screen-error-fallback';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

type State = BoundaryState;

export class RootErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return createBoundaryStateFromError(error);
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logError(error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState(resetBoundaryState());
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <FullScreenErrorFallback
          actionLabel="Try Again"
          message={createRootFallbackMessage(this.state.error)}
          onPress={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}
