'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  fallbackLabel?: string;
  retryLabel?: string;
};

type State = {
  hasError: boolean;
};

/**
 * Isolates picture-find crashes so the games widget / dashboard keep working.
 */
export class PictureFindErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[PictureFindErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        <p className="font-medium">{this.props.fallbackLabel ?? '그림 찾기를 불러오지 못했습니다.'}</p>
        <button
          type="button"
          className="mt-2 rounded-md bg-amber-700 px-2.5 py-1 text-xs font-semibold text-white"
          onClick={() => this.setState({ hasError: false })}
        >
          {this.props.retryLabel ?? '다시 시도'}
        </button>
      </div>
    );
  }
}
