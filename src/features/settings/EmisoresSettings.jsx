import React, {useState} from 'react';
import {Building2, Save} from 'lucide-react';
import {mergeBoletaExtranjeraEmisores} from '../../config/boletaExtranjera.js';

const FORMATOS = [1, 2, 3];

export function EmisoresSettings({config, onSave}) {
  const [form, setForm] = useState(() => mergeBoletaExtranjeraEmisores(config));
  const [saving, setSaving] = useState(false);

  const update = (format, field, value) => {
    setForm(current => ({
      ...current,
      [`formato${format}`]: {...current[`formato${format}`], [field]: value},
    }));
  };

  const submit = async event => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="saas-form-shell settings-shell" onSubmit={submit}>
      <header className="saas-form-header">
        <div>
          <p className="saas-page-kicker">Configuracion</p>
          <h2 className="saas-page-title"><Building2 size={20}/> Emisores por formato</h2>
          <p className="saas-page-desc">Estos datos se imprimen en las boletas nuevas.</p>
        </div>
      </header>
      <div className="settings-grid">
        {FORMATOS.map(format => {
          const item = form[`formato${format}`];
          return (
            <fieldset key={format} className="issuer-section">
              <legend>Formato {format}</legend>
              <label>Nombre<input value={item.nombre} onChange={e => update(format, 'nombre', e.target.value)} required/></label>
              <label>RUT<input value={item.rut} onChange={e => update(format, 'rut', e.target.value)} required/></label>
              <label>Direccion<textarea rows="3" value={item.direccion} onChange={e => update(format, 'direccion', e.target.value)} required/></label>
            </fieldset>
          );
        })}
      </div>
      <div className="settings-actions">
        <button className="saas-primary" type="submit" disabled={saving}><Save size={17}/> {saving ? 'Guardando...' : 'Guardar emisores'}</button>
      </div>
    </form>
  );
}
