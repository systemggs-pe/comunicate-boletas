import React, {useState} from 'react';
import {FileText, LogIn, ShieldCheck} from '../../components/Icons.jsx';
import {GoogleAuthProvider, signInWithPopup, signOut} from 'firebase/auth';

export function LoginScreen({auth, allowedEmails, showToast}) {
  const [loading, setLoading] = useState(false);

  const login = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const email = String(result.user.email || '').toLowerCase();
      if (!result.user.emailVerified || !allowedEmails.has(email)) {
        await signOut(auth);
        showToast('Este correo no esta autorizado', 'error');
      }
    } catch (error) {
      if (error.code !== 'auth/popup-closed-by-user') showToast('No se pudo iniciar sesion', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-identity">
          <div className="login-mark"><FileText size={24}/></div>
          <div><strong>COMUNIC@TE</strong><span>Gestión documental</span></div>
        </div>
        <p className="saas-page-kicker">Acceso interno</p>
        <h1 id="login-title">BOLETA DE VENTA</h1>
        <p className="login-copy">Emite, consulta y verifica boletas de venta desde un espacio seguro.</p>
        <button type="button" className="saas-primary login-button" onClick={login} disabled={loading}>
          <LogIn size={18}/> {loading ? 'Ingresando...' : 'Continuar con Google'}
        </button>
        <div className="login-security"><ShieldCheck size={16}/> Acceso exclusivo para personal autorizado</div>
      </section>
    </main>
  );
}
