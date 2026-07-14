import React, {lazy, Suspense, useCallback, useEffect, useMemo, useState} from 'react';
import {FileText, LogOut, Settings} from './components/Icons.jsx';
import {onAuthStateChanged, signOut} from 'firebase/auth';
import {auth} from './lib/firebase.js';
import {mergeBoletaExtranjeraEmisores} from './config/boletaExtranjera.js';
import {obtenerConfiguracionBoleta, guardarConfiguracionBoleta} from './services/functionsClient.js';
import {LoginScreen} from './features/auth/LoginScreen.jsx';
import {AccessibleDialog} from './components/AccessibleDialog.jsx';

const lazyNamed = (loader, name) => lazy(() => loader().then(module => ({default: module[name]})));
const BoletaExtranjera = lazyNamed(() => import('./features/boletas/BoletaExtranjera.jsx'), 'BoletaExtranjera');
const BoletaPublicaPage = lazyNamed(() => import('./features/boletas/BoletaPublicaPage.jsx'), 'BoletaPublicaPage');
const EmisoresSettings = lazyNamed(() => import('./features/settings/EmisoresSettings.jsx'), 'EmisoresSettings');

const configuredEmails = String(import.meta.env.VITE_ALLOWED_EMAILS || 'brand050103@gmail.com,lauryruyz50@gmail.com')
  .split(',').map(value => value.trim().toLowerCase()).filter(Boolean);

const getViewFromUrl = () => new URLSearchParams(window.location.search).get('section') === 'emisores' ? 'settings' : 'boletas';

const writeViewToUrl = (view, replace = false) => {
  const url = new URL(window.location.href);
  url.searchParams.set('section', view === 'settings' ? 'emisores' : 'boletas');
  if (view === 'settings') url.searchParams.delete('mode');
  window.history[replace ? 'replaceState' : 'pushState']({}, '', url);
};

export default function App() {
  const publicRoute = useMemo(() => (window.location.pathname.replace(/\/+$/, '') || '/') === '/boleta', []);
  const allowedEmails = useMemo(() => new Set(configuredEmails), []);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState(getViewFromUrl);
  const [issuerConfig, setIssuerConfig] = useState(() => mergeBoletaExtranjeraEmisores());
  const [toast, setToast] = useState(null);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [pendingView, setPendingView] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({message, type, key: Date.now()});
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => onAuthStateChanged(auth, async current => {
    const email = String(current?.email || '').toLowerCase();
    if (current && current.emailVerified && allowedEmails.has(email)) setUser(current);
    else if (current) await signOut(auth);
    setAuthLoading(false);
  }), [allowedEmails]);

  useEffect(() => {
    if (!user) return;
    obtenerConfiguracionBoleta()
      .then(result => setIssuerConfig(mergeBoletaExtranjeraEmisores(result.config)))
      .catch(() => showToast('No se pudo cargar la configuración de emisores', 'error'));
  }, [user, showToast]);

  useEffect(() => {
    const onPopState = () => {
      const nextView = getViewFromUrl();
      if (settingsDirty && view === 'settings' && nextView !== 'settings') {
        writeViewToUrl('settings', true);
        setPendingView(nextView);
        return;
      }
      setView(nextView);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [settingsDirty, view]);

  if (publicRoute) return <Suspense fallback={<div className="app-loading">Cargando verificación…</div>}><BoletaPublicaPage/></Suspense>;
  if (authLoading) return <div className="app-loading">Cargando acceso…</div>;
  if (!user) return <LoginScreen auth={auth} allowedEmails={allowedEmails} showToast={showToast}/>;

  const saveConfig = async config => {
    const result = await guardarConfiguracionBoleta(config);
    setIssuerConfig(mergeBoletaExtranjeraEmisores(result.config));
    showToast('Emisores actualizados');
  };

  const applyView = (nextView, replace = false) => {
    setView(nextView);
    writeViewToUrl(nextView, replace);
  };

  const requestView = nextView => {
    if (nextView === view) return;
    if (settingsDirty && view === 'settings') {
      setPendingView(nextView);
      return;
    }
    applyView(nextView);
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Ir al contenido principal</a>
      <header className="app-topbar">
        <div className="topbar-primary">
          <div className="app-brand"><strong>COMUNIC@TE</strong><span className="brand-product">BOLETA DE VENTA</span></div>
          <div className="account-actions">
            <span>{user.email}</span>
            <button className="topbar-signout" type="button" onClick={() => signOut(auth)}><LogOut size={17}/> Salir</button>
          </div>
        </div>
        <nav className="app-navigation" aria-label="Navegación principal">
          <button type="button" data-active={view === 'boletas'} aria-current={view === 'boletas' ? 'page' : undefined} onClick={() => requestView('boletas')}><FileText size={19}/><strong>BOLETA DE VENTA</strong></button>
          <button type="button" data-active={view === 'settings'} aria-current={view === 'settings' ? 'page' : undefined} onClick={() => requestView('settings')}><Settings size={19}/><strong>Emisores</strong></button>
        </nav>
      </header>
      <div className="app-workspace">
        <header className="workspace-header">
          <div>
            <p className="saas-page-kicker">{view === 'boletas' ? 'Operación diaria' : 'Configuración'}</p>
            <h1>{view === 'boletas' ? 'BOLETA DE VENTA' : 'Emisores de boleta'}</h1>
            <p>{view === 'boletas' ? 'Emite desde una venta, registra una boleta manual o consulta el historial.' : 'Administra los datos fiscales utilizados en cada formato de impresión.'}</p>
          </div>
          <span className="workspace-status"><i/> Sistema disponible</span>
        </header>
        <main className="app-main" id="main-content" tabIndex={-1}>
          <Suspense fallback={<div className="saas-empty py-12" role="status">Cargando módulo…</div>}>
            {view === 'boletas'
              ? <BoletaExtranjera boletaEmisoresConfig={issuerConfig} showToast={showToast}/>
              : <EmisoresSettings key={JSON.stringify(issuerConfig)} config={issuerConfig} onSave={saveConfig} onDirtyChange={setSettingsDirty}/>
            }
          </Suspense>
        </main>
      </div>
      <nav className="mobile-navigation" aria-label="Navegación principal">
        <button type="button" data-active={view === 'boletas'} aria-current={view === 'boletas' ? 'page' : undefined} onClick={() => requestView('boletas')}><FileText size={20}/><span>Boletas</span></button>
        <button type="button" data-active={view === 'settings'} aria-current={view === 'settings' ? 'page' : undefined} onClick={() => requestView('settings')}><Settings size={20}/><span>Emisores</span></button>
      </nav>
      {pendingView && (
        <AccessibleDialog
          title="Hay cambios sin guardar"
          description="Si sales de Emisores, perderás los cambios realizados."
          onClose={() => setPendingView(null)}
        >
          <div className="dialog-actions">
            <button type="button" className="saas-secondary" onClick={() => setPendingView(null)} data-dialog-autofocus>Seguir editando</button>
            <button type="button" className="saas-primary" onClick={() => {
              const nextView = pendingView;
              setPendingView(null);
              setSettingsDirty(false);
              applyView(nextView);
            }}>Salir sin guardar</button>
          </div>
        </AccessibleDialog>
      )}
      {toast && <div className={`app-toast ${toast.type === 'error' ? 'is-error' : ''}`} role={toast.type === 'error' ? 'alert' : 'status'} aria-live={toast.type === 'error' ? 'assertive' : 'polite'}>{toast.message}</div>}
    </div>
  );
}
