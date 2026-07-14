import React, {useState} from 'react';
import {Save} from '../../components/Icons.jsx';
import {mergeBoletaExtranjeraEmisores} from '../../config/boletaExtranjera.js';

const FORMATOS = [1, 2, 3, 4];

function prepararLogo(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) {
      reject(new Error('Selecciona una imagen PNG, JPG o WEBP.'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('El logo no puede superar 5 MB.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el logo.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('La imagen del logo no es válida.'));
      image.onload = () => {
        const scale = Math.min(1, 420 / image.naturalWidth, 180 / image.naturalHeight);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.84);
        if (dataUrl.length > 300000) reject(new Error('El logo sigue siendo demasiado pesado. Usa una imagen más simple.'));
        else resolve(dataUrl);
      };
      image.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

export function EmisoresSettings({config, onSave}) {
  const [form, setForm] = useState(() => mergeBoletaExtranjeraEmisores(config));
  const [saving, setSaving] = useState(false);
  const [logoError, setLogoError] = useState('');

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

  const cambiarLogo = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoError('');
    try {
      update(4, 'logoDataUrl', await prepararLogo(file));
    } catch (error) {
      setLogoError(error.message || 'No se pudo preparar el logo.');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <form className="saas-form-shell settings-shell" onSubmit={submit}>
      <div className="settings-grid">
        {FORMATOS.map(format => {
          const item = form[`formato${format}`];
          return (
            <fieldset key={format} className={`issuer-section ${format === 4 ? 'issuer-section-format4' : ''}`}>
              <legend><span>{format}</span> Formato {format}</legend>
              <p className="issuer-description">{format === 4 ? 'Factura de página completa con logo y datos empresariales editables.' : 'Información impresa en la cabecera de la boleta.'}</p>
              {format === 4 ? (
                <div className="issuer-format4-grid">
                  <div className="issuer-logo-editor">
                    <div className="issuer-logo-preview">
                      {item.logoDataUrl ? <img src={item.logoDataUrl} alt="Vista previa del logo"/> : <span>Espacio del logo</span>}
                    </div>
                    <label className="issuer-logo-input">Agregar o cambiar logo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={cambiarLogo}/></label>
                    {item.logoDataUrl && <button type="button" className="saas-secondary" onClick={() => update(4, 'logoDataUrl', '')}>Quitar logo</button>}
                    {logoError && <p className="issuer-logo-error" role="alert">{logoError}</p>}
                  </div>
                  <div className="issuer-sensitive-grid">
                    <label>Nombre o razón social<input value={item.nombre} onChange={e => update(format, 'nombre', e.target.value)} required/></label>
                    <label>Identificación fiscal<input value={item.rut} onChange={e => update(format, 'rut', e.target.value)} required/></label>
                    <label>Dirección<input value={item.direccion} onChange={e => update(format, 'direccion', e.target.value)} required/></label>
                    <label>Ciudad, estado y código postal<input value={item.ciudad || ''} onChange={e => update(format, 'ciudad', e.target.value)}/></label>
                    <label>País<input value={item.pais || ''} onChange={e => update(format, 'pais', e.target.value)}/></label>
                    <label>Correo<input type="email" value={item.email || ''} onChange={e => update(format, 'email', e.target.value)}/></label>
                    <label>Teléfono<input value={item.telefono || ''} onChange={e => update(format, 'telefono', e.target.value)}/></label>
                    <label>Sitio web<input value={item.sitioWeb || ''} onChange={e => update(format, 'sitioWeb', e.target.value)}/></label>
                    <label>Método de pago<input value={item.metodoPago || ''} onChange={e => update(format, 'metodoPago', e.target.value)}/></label>
                    <label>Impuesto (%)<input type="number" min="0" max="100" step="0.01" value={item.impuestoPorcentaje || '0'} onChange={e => update(format, 'impuestoPorcentaje', e.target.value)}/></label>
                    <label className="issuer-wide-field">Notas<textarea rows="2" value={item.notas || ''} onChange={e => update(format, 'notas', e.target.value)}/></label>
                    <label className="issuer-wide-field">Términos<textarea rows="2" value={item.terminos || ''} onChange={e => update(format, 'terminos', e.target.value)}/></label>
                  </div>
                </div>
              ) : (
                <>
                  <label>Nombre o razón social<input value={item.nombre} onChange={e => update(format, 'nombre', e.target.value)} required/></label>
                  <label>RUT<input value={item.rut} onChange={e => update(format, 'rut', e.target.value)} required/></label>
                  <label>Dirección fiscal<textarea rows="3" value={item.direccion} onChange={e => update(format, 'direccion', e.target.value)} required/></label>
                </>
              )}
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
