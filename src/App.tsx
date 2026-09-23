import { BrowserRouter } from 'react-router-dom';
import { AppProviders } from './app/AppProviders.tsx';
import { AppRoutes } from './app/routes.tsx';
import { ErrorBoundary } from './app/ErrorBoundary.tsx';
import { createAppDeps } from './app/createAppDeps.ts';
import { CrashPage } from './ui/pages/CrashPage.tsx';

const deps = createAppDeps();

export default function App() {
  return (
    <ErrorBoundary logger={deps.logger} fallback={<CrashPage />}>
      <AppProviders deps={deps}>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AppProviders>
    </ErrorBoundary>
  );
}
