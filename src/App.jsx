import React, {lazy, Suspense, useCallback, useEffect, useMemo, useState} from 'react';
import {FileText, LogOut, Settings} from './components/Icons.jsx';
import {onAuthStateChanged, signOut} from 'firebase/auth';
import {auth} from './lib/firebase.js';
import {mergeBoletaExtranjeraEmisores} from './config/boletaExtranjera.js';
import {obtenerConfiguracionBoleta, guardarConfiguracionBoleta} from './services/functionsClient.js';
import {LoginScreen} from './features/auth/LoginScreen.jsx';

const lazyNamed = (loader, name) => lazy(() => loader().then(module => ({default: module[name]})));
const BoletaExtranjera = lazyNamed(() => import('./features/boletas/BoletaExtranjera.jsx'), 'BoletaExtranjera');
const BoletaPublicaPage = lazyNamed(() => import('./features/boletas/BoletaPublicaPage.jsx'), 'BoletaPublicaPage');
const EmisoresSettings = lazyNamed(() => import('./features/settings/EmisoresSettings.jsx'), 'EmisoresSettings');

const configuredEmails = String(import.meta.env.VITE_ALLOWED_EMAILS || 'brand050103@gmail.com,lauryruyz50@gmail.com')
  .split(',').map(value => value.trim().toLowerCase()).filter(Boolean);

export default function App() {
  const publicRoute = useMemo(() => (window.location.pathname.replace(/\/+$/, '') || '/') === '/boleta', []);
  const allowedEmails = useMemo(() => new Set(configuredEmails), []);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState('boletas');
  const [issuerConfig, setIssuerConfig] = useState(() => mergeBoletaExtranjeraEmisores());
  const [toast, setToast] = useState(null);

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
      .catch(() => showToast('No se pudo cargar la configuracion de emisores', 'error'));
  }, [user, showToast]);

  if (publicRoute) return <Suspense fallback={<div className="app-loading">Cargando verificacion...</div>}><BoletaPublicaPage/></Suspense>;
  if (authLoading) return <div className="app-loading">Cargando acceso...</div>;
  if (!user) return <LoginScreen auth={auth} allowedEmails={allowedEmails} showToast={showToast}/>;

  const saveConfig = async config => {
    const result = await guardarConfiguracionBoleta(config);
    setIssuerConfig(mergeBoletaExtranjeraEmisores(result.config));
    showToast('Emisores actualizados');
  };

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="topbar-primary">
          <div className="app-brand"><strong>COMUNIC@TE</strong><span className="brand-product">BOLETAS</span></div>
          <div className="account-actions">
            <span>{user.email}</span>
            <button className="topbar-signout" type="button" onClick={() => signOut(auth)}><LogOut size={17}/> Salir</button>
          </div>
        </div>
        <nav className="app-navigation" aria-label="Navegacion principal">
          <button type="button" data-active={view === 'boletas'} aria-current={view === 'boletas' ? 'page' : undefined} onClick={() => setView('boletas')}><FileText size={19}/><strong>BOLETA DE VENTA</strong></button>
          <button type="button" data-active={view === 'settings'} aria-current={view === 'settings' ? 'page' : undefined} onClick={() => setView('settings')}><Settings size={19}/><strong>Emisores</strong></button>
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
        <main className="app-main">
          <Suspense fallback={<div className="saas-empty py-12">Cargando módulo...</div>}>
            {view === 'boletas'
              ? <BoletaExtranjera boletaEmisoresConfig={issuerConfig} showToast={showToast}/>
              : <EmisoresSettings key={JSON.stringify(issuerConfig)} config={issuerConfig} onSave={saveConfig}/>
            }
          </Suspense>
        </main>
      </div>
      <nav className="mobile-navigation" aria-label="Navegacion principal">
        <button type="button" data-active={view === 'boletas'} aria-current={view === 'boletas' ? 'page' : undefined} onClick={() => setView('boletas')}><FileText size={20}/><span>BOLETA DE VENTA</span></button>
        <button type="button" data-active={view === 'settings'} aria-current={view === 'settings' ? 'page' : undefined} onClick={() => setView('settings')}><Settings size={20}/><span>Emisores</span></button>
      </nav>
      {toast && <div className={`app-toast ${toast.type === 'error' ? 'is-error' : ''}`} role="status" aria-live="polite">{toast.message}</div>}
    </div>
  );
}
