import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppProviders } from '../../app/AppProviders.tsx';
import { AppRoutes } from '../../app/routes.tsx';
import { err } from '../../domain/result.ts';
import { appError, AppErrorCode } from '../../domain/errors.ts';
import { DEFAULT_SETTINGS, type Settings } from '../../domain/settings/settings.ts';
import { createIdleState, type TimerState } from '../../domain/timer/state.ts';
import { getDrill } from '../../domain/drills/catalog.ts';
import { drillId, shotIndex, splitSec, timeSec } from '../../domain/value-objects/ids.ts';
import { createTestDeps } from '../../test/createTestDeps.ts';
import { CrashPage } from './CrashPage.tsx';
import type { Session } from '../../domain/session/session.ts';

function renderApp(
  path: string,
  deps = createTestDeps(),
  initialLastRun: TimerState | null = null,
  extraSettings: Partial<Settings> = {},
) {
  deps.settingsStore.value = {
    ...DEFAULT_SETTINGS,
    ipscDelayMinSec: 0,
    ipscDelayMaxSec: 0,
    ...extraSettings,
  };
  return {
    deps,
    user: userEvent.setup(),
    ...render(
      <AppProviders deps={deps} initialLastRun={initialLastRun}>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </AppProviders>,
    ),
  };
}

describe('pages', () => {
  it('renders home and the drill library', async () => {
    const { user } = renderApp('/');
    expect(screen.getByTestId('home-free')).toBeInTheDocument();
    await user.click(screen.getByText('Drill library'));
    expect(screen.getByTestId('drill-bill-drill-6-dryTap')).toBeInTheDocument();
    expect(screen.getByTestId('drill-bill-drill-6-live')).toHaveAttribute(
      'href',
      '/preflight?drillId=bill-drill-6&input=live',
    );
    expect(screen.getByTestId('drill-custom-par-dryPar')).toBeInTheDocument();
  });

  it('changes language and delay range', async () => {
    const { user } = renderApp('/settings');
    await user.selectOptions(screen.getByTestId('language'), 'pl');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ustawienia'));
    await user.clear(screen.getByTestId('delay-min'));
    await user.type(screen.getByTestId('delay-min'), '1');
    await user.clear(screen.getByTestId('delay-max'));
    await user.type(screen.getByTestId('delay-max'), '2');
  });

  it('renders install instructions in settings', async () => {
    renderApp('/install');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Settings'));
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Install');
    expect(screen.getByTestId('mic-sensitivity')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('mic-sensitivity'), { target: { value: '0.9' } });
    await waitFor(() => expect(screen.getByTestId('mic-threshold')).toHaveStyle({ width: '90%' }));
  });

  it('redirects invalid run params', async () => {
    renderApp('/run');
    await waitFor(() => expect(screen.getByRole('heading')).toHaveTextContent('invalid'));
  });

  it('redirects unknown drills', async () => {
    renderApp('/run?drillId=nope&input=dryTap');
    await waitFor(() => expect(screen.getByRole('heading')).toHaveTextContent('invalid'));
  });

  it('shows a translated PAR error on Draw dry-PAR', async () => {
    const { user } = renderApp('/run?drillId=draw&input=dryPar');
    await user.click(screen.getByTestId('start'));
    await waitFor(() =>
      expect(screen.getByTestId('run-error')).toHaveTextContent('This drill has no PAR window.'),
    );
    expect(screen.queryByTestId('shot-pad')).not.toBeInTheDocument();
  });

  it('shows the PAR error in French', async () => {
    const { user } = renderApp('/run?drillId=draw&input=dryPar', createTestDeps(), null, { locale: 'fr' });
    await waitFor(() => expect(screen.getByTestId('start')).toHaveTextContent('Démarrer'));
    await user.click(screen.getByTestId('start'));
    await waitFor(() =>
      expect(screen.getByTestId('run-error')).toHaveTextContent('Cet exercice n’a pas de fenêtre PAR.'),
    );
  });

  it('runs a dry-fire string, deletes a shot and saves history', async () => {
    const { deps, user } = renderApp('/run?drillId=bill-drill-6&input=dryTap');
    await act(async () => {
      await Promise.resolve();
    });
    await user.click(screen.getByTestId('start'));
    expect(screen.getByTestId('dry-mic-hint')).toBeInTheDocument();
    act(() => {
      deps.clock.advance(5_000);
    });
    for (let i = 0; i < 6; i += 1) {
      act(() => {
        deps.shots.emit(deps.clock.now());
        deps.clock.advance(20);
      });
    }
    await screen.findByTestId('save-session');
    expect(screen.getByTestId('back-to-drill')).toHaveAttribute(
      'href',
      '/run?drillId=bill-drill-6&input=dryTap',
    );
    await user.click(screen.getByTestId('shot-1'));
    await user.click(screen.getByTestId('save-session'));
    await screen.findByTestId('history-item');
    expect(screen.getByTestId('back-to-drill')).toHaveAttribute(
      'href',
      '/run?drillId=bill-drill-6&input=dryTap',
    );
    await user.click(screen.getByRole('button', { name: /delete/i }));
    await waitFor(() => expect(screen.queryByTestId('history-item')).not.toBeInTheDocument());
    await user.click(screen.getByTestId('back-to-drill'));
    await screen.findByTestId('start');
    expect(screen.getByTestId('dry-mic-hint')).toBeInTheDocument();
  });

  it('shows empty review and a history row for an unknown drill', async () => {
    renderApp('/review');
    await waitFor(() => expect(screen.getByText(/No saved strings/)).toBeInTheDocument());
    const deps = createTestDeps();
    const session: Session = {
      id: 's-1',
      createdAt: 1,
      drillId: drillId('ghost'),
      timerProfile: 'ipscRandomStart',
      inputMethod: 'dryTap',
      shots: [],
      firstShotSec: null,
      totalSec: null,
      settingsSnapshot: { sensitivity: 0.5, preset: 'handgun' },
    };
    await deps.sessions.save(session);
    renderApp('/history', deps);
    await screen.findByTestId('history-item');
    expect(screen.getByText('ghost')).toBeInTheDocument();
  });

  it('reviews a PAR string with an out-of-window shot', async () => {
    const deps = createTestDeps();
    const lastRun: TimerState = {
      ...createIdleState(getDrill('custom-par')!, 'dryPar'),
      phase: 'review',
      shots: [
        {
          index: shotIndex(1),
          time: timeSec(9),
          split: null,
          inWindow: false,
          targetIndex: 0,
        },
        {
          index: shotIndex(2),
          time: timeSec(9.2),
          split: splitSec(0.2),
          inWindow: true,
          targetIndex: 0,
        },
      ],
    };
    const { user } = renderApp('/review', deps, lastRun);
    expect(screen.getByText(/Out of window/)).toBeInTheDocument();
    await user.click(screen.getByTestId('shot-1'));
    expect(screen.getByTestId('back-to-drill')).toHaveAttribute(
      'href',
      '/run?drillId=custom-par&input=dryPar',
    );
    await user.click(screen.getByRole('link', { name: /repeat/i }));
  });

  it('grants microphone permission on preflight', async () => {
    const { user, deps } = renderApp('/preflight?drillId=bill-drill-6&input=live');
    await user.click(screen.getByTestId('grant-mic'));
    expect(screen.queryByTestId('mic-denied')).not.toBeInTheDocument();
    await waitFor(() => expect(deps.settingsStore.value.micGranted).toBe(true));
    expect(screen.getByTestId('mic-granted')).toBeInTheDocument();
  });

  it('shows a denial message when the browser already reports denied', async () => {
    const deps = createTestDeps({
      queryMicPermission: async () => 'denied',
    });
    renderApp('/preflight', deps);
    await waitFor(() => expect(screen.getByTestId('mic-denied')).toBeInTheDocument());
  });

  it('shows a denial message when the microphone is refused', async () => {
    const denied = createTestDeps({
      requestMic: async () => err(appError(AppErrorCode.MIC_DENIED, 'no')),
    });
    const { user } = renderApp('/preflight', denied);
    await user.click(screen.getByTestId('grant-mic'));
    await waitFor(() => expect(screen.getByTestId('mic-denied')).toBeInTheDocument());
    expect(denied.settingsStore.value.micGranted).toBe(false);
  });

  it('skips preflight when microphone access was already saved', async () => {
    renderApp('/drills', createTestDeps(), null, { micGranted: true });
    await waitFor(() =>
      expect(screen.getByTestId('drill-bill-drill-6-live')).toHaveAttribute(
        'href',
        '/run?drillId=bill-drill-6&input=live',
      ),
    );
  });

  it('persists a granted permission reported by the browser', async () => {
    const deps = createTestDeps({
      queryMicPermission: async () => 'granted',
    });
    renderApp('/settings', deps);
    await waitFor(() => expect(deps.settingsStore.value.micGranted).toBe(true));
    expect(screen.getByTestId('mic-status')).toHaveTextContent('Allowed');
  });

  it('clears a saved grant when the browser reports denied', async () => {
    const deps = createTestDeps({
      queryMicPermission: async () => 'denied',
    });
    renderApp('/settings', deps, null, { micGranted: true });
    await waitFor(() => expect(deps.settingsStore.value.micGranted).toBe(false));
    expect(screen.getByTestId('mic-status')).toHaveTextContent('Not allowed');
  });

  it('renders crash copy', () => {
    render(<CrashPage />);
    expect(screen.getByRole('heading')).toHaveTextContent('crashed');
  });
});
