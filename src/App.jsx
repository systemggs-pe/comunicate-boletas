import React, {lazy, Suspense, useCallback, useEffect, useMemo, useState} from 'react';
import {FileText, LogOut, Settings} from 'lucide-react';
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
        <div className="app-brand"><span className="app-brand-mark"><FileText size={19}/></span><div><strong>COMUNIC@TE</strong><small>Boletas extranjeras</small></div></div>
        <nav aria-label="Navegacion principal">
          <button type="button" data-active={view === 'boletas'} onClick={() => setView('boletas')}><FileText size={17}/> Boletas</button>
          <button type="button" data-active={view === 'settings'} onClick={() => setView('settings')}><Settings size={17}/> Emisores</button>
        </nav>
        <button className="saas-icon-button" type="button" onClick={() => signOut(auth)} aria-label="Cerrar sesion" title="Cerrar sesion"><LogOut size={18}/></button>
      </header>
      <main className="app-main">
        <Suspense fallback={<div className="saas-empty py-12">Cargando modulo...</div>}>
          {view === 'boletas'
            ? <BoletaExtranjera boletaEmisoresConfig={issuerConfig} showToast={showToast}/>
            : <EmisoresSettings key={JSON.stringify(issuerConfig)} config={issuerConfig} onSave={saveConfig}/>
          }
        </Suspense>
      </main>
      {toast && <div className={`app-toast ${toast.type === 'error' ? 'is-error' : ''}`} role="status" aria-live="polite">{toast.message}</div>}
    </div>
  );
}
