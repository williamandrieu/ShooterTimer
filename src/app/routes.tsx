import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '../ui/components/Layout.tsx';
import { DrillsPage } from '../ui/pages/DrillsPage.tsx';
import { HistoryPage } from '../ui/pages/HistoryPage.tsx';
import { HomePage } from '../ui/pages/HomePage.tsx';
import { InvalidRunPage } from '../ui/pages/InvalidRunPage.tsx';
import { PreflightPage } from '../ui/pages/PreflightPage.tsx';
import { ReviewPage } from '../ui/pages/ReviewPage.tsx';
import { RunPage } from '../ui/pages/RunPage.tsx';
import { SettingsPage } from '../ui/pages/SettingsPage.tsx';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/drills" element={<DrillsPage />} />
        <Route path="/preflight" element={<PreflightPage />} />
        <Route path="/run" element={<RunPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/install" element={<Navigate to="/settings" replace />} />
        <Route path="/invalid" element={<InvalidRunPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
