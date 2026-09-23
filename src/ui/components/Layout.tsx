import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useDeps, useI18n } from '../../app/AppProviders.tsx';
import styles from '../styles/ui.module.css';

function IconHome() {
  return (
    <svg className={styles.navIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 3.4 2.8 11.2h2.4V21h6.2v-6.2h3.2V21h6.2v-9.8h2.4L12 3.4z" />
    </svg>
  );
}

function IconDrills() {
  return (
    <svg className={styles.navIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 2.4a7.6 7.6 0 1 1-7.6 7.6A7.6 7.6 0 0 1 12 4.4zm-.9 3.2h1.8v4.05l3.2 1.9-.9 1.5L11.1 13z"
      />
    </svg>
  );
}

function IconHistory() {
  return (
    <svg className={styles.navIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 1 0 4.4 19l-1-2A8 8 0 1 1 12 4V1l4 3.5L12 8V6a6 6 0 1 0 6 6h2A8 8 0 0 1 12 2zm1 5v5.2l4 2.4-.9 1.5L11 13V7z"
      />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg className={styles.navIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.4 13a7.7 7.7 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.6 7.6 0 0 0-1.7-1L15 3h-6l-.3 2.9a7.6 7.6 0 0 0-1.7 1l-2.5-1-2 3.5L4.6 11a7.7 7.7 0 0 0 0 2L2.5 14.6l2 3.5 2.5-1a7.6 7.6 0 0 0 1.7 1L9 21h6l.3-2.9a7.6 7.6 0 0 0 1.7-1l2.5 1 2-3.5zm-7.4 2.2A3.2 3.2 0 1 1 15.2 12 3.2 3.2 0 0 1 12 15.2z"
      />
    </svg>
  );
}

export function Layout() {
  const { t } = useI18n();
  const deps = useDeps();

  useEffect(() => {
    const unlock = () => {
      deps.audio.unlock();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('touchstart', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [deps]);

  return (
    <div className={styles.layout}>
      <Outlet />
      <nav className={styles.nav}>
        <NavLink to="/" end>
          <IconHome />
          <span>{t('nav.home')}</span>
        </NavLink>
        <NavLink to="/drills">
          <IconDrills />
          <span>{t('nav.drills')}</span>
        </NavLink>
        <NavLink to="/history">
          <IconHistory />
          <span>{t('nav.history')}</span>
        </NavLink>
        <NavLink to="/settings">
          <IconSettings />
          <span>{t('nav.settings')}</span>
        </NavLink>
      </nav>
    </div>
  );
}
