import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { CaptureLogger } from '../test/fakes.ts';

function Boom(): never {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders fallback and logs', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const logger = new CaptureLogger();
    render(
      <ErrorBoundary logger={logger} fallback={<p>down</p>}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('down')).toBeInTheDocument();
    expect(logger.lines.some((line) => line.level === 'error')).toBe(true);
  });
});
