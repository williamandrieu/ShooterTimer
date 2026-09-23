import { Component, type ErrorInfo, type ReactNode } from 'react';
import type { Logger } from '../ports/contracts.ts';

type Props = { children: ReactNode; logger: Logger; fallback: ReactNode };
type State = { crashed: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false };

  static getDerivedStateFromError(): State {
    return { crashed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.logger.error('ui.crash', { error, info });
  }

  render(): ReactNode {
    if (this.state.crashed) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
