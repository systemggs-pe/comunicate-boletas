import React, {useEffect, useMemo, useState} from 'react';
import {Save} from '../../components/Icons.jsx';
import {mergeBoletaExtranjeraEmisores} from '../../config/boletaExtranjera.js';

const FORMATOS = [
  {id: 1, label: 'Térmica 48 mm', description: 'Formato compacto para impresora térmica de 48 mm.'},
  {id: 2, label: 'Térmica 80 mm', description: 'Formato térmico de 80 mm con código PDF417.'},
  {id: 3, label: 'Pizarro #3', description: 'Formato Pizarro Villarreal #3 con código PDF417.'},
  {id: 4, label: 'Página completa', description: 'Documento de página completa con logo y datos empresariales.'},
];

const REQUIRED_FIELDS = ['nombre', 'rut', 'direccion'];

function prepararLogo(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) {
      reject(new Error('Selecciona una imagen PNG, JPG o WEBP.'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('El logo no puede superar 5 MB.'));
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
        context.fillStyle = '#fefefe';
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

export function EmisoresSettings({config, onSave, onDirtyChange}) {
  const initialConfig = useMemo(() => mergeBoletaExtranjeraEmisores(config), [config]);
  const [form, setForm] = useState(initialConfig);
  const [savedForm, setSavedForm] = useState(initialConfig);
  const [activeFormat, setActiveFormat] = useState(1);
  const [saving, setSaving] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(savedForm), [form, savedForm]);

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  useEffect(() => {
    const warnBeforeUnload = event => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [dirty]);

  const update = (format, field, value) => {
    setSaveError('');
    setFieldErrors(current => {
      const next = {...current};
      delete next[`${format}-${field}`];
      return next;
    });
    setForm(current => ({
      ...current,
      [`formato${format}`]: {...current[`formato${format}`], [field]: value},
    }));
  };

  const validate = () => {
    const errors = {};
    FORMATOS.forEach(({id}) => {
      REQUIRED_FIELDS.forEach(field => {
        if (!String(form[`formato${id}`]?.[field] || '').trim()) errors[`${id}-${field}`] = 'Este campo es obligatorio.';
      });
    });
    setFieldErrors(errors);
    const firstKey = Object.keys(errors)[0];
    if (!firstKey) return true;
    const [format] = firstKey.split('-');
    setActiveFormat(Number(format));
    window.requestAnimationFrame(() => {
      const field = document.getElementById(`issuer-${firstKey}`);
      field?.focus();
      field?.scrollIntoView({behavior: 'smooth', block: 'center'});
    });
    return false;
  };

  const submit = async event => {
    event.preventDefault();
    if (!validate()) {
      setSaveError('Revisa los campos obligatorios antes de guardar.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      await onSave(form);
      setSavedForm(form);
    } catch (error) {
      console.error('Error al guardar emisores:', error);
      setSaveError('No se pudieron guardar los emisores. Verifica tu conexión e inténtalo nuevamente.');
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

  const renderField = (format, field, label, options = {}) => {
    const item = form[`formato${format}`];
    const key = `${format}-${field}`;
    const error = fieldErrors[key];
    const id = `issuer-${key}`;
    const Input = options.multiline ? 'textarea' : 'input';
    return (
      <label className={options.wide ? 'issuer-wide-field' : undefined} htmlFor={id}>
        {label}{options.required ? ' *' : ''}
        <Input
          id={id}
          name={`formato${format}-${field}`}
          value={item[field] || ''}
          onChange={event => update(format, field, event.target.value)}
          autoComplete="off"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          rows={options.multiline ? options.rows || 2 : undefined}
          type={options.type}
          min={options.min}
          max={options.max}
          step={options.step}
          inputMode={options.inputMode}
        />
        {error && <span className="field-error" id={`${id}-error`} role="alert">{error}</span>}
      </label>
    );
  };

  const meta = FORMATOS.find(format => format.id === activeFormat);
  const item = form[`formato${activeFormat}`];

  return (
    <form className="saas-form-shell settings-shell" onSubmit={submit} noValidate aria-busy={saving}>
      <div className="issuer-format-selector" aria-label="Formato de impresión">
        <div>
          <p className="settings-selector-label">Formato de impresión</p>
          <p>Configura un formato a la vez.</p>
        </div>
        <div className="issuer-format-options">
          {FORMATOS.map(format => (
            <button
              key={format.id}
              type="button"
              className="issuer-format-option"
              data-active={activeFormat === format.id}
              aria-pressed={activeFormat === format.id}
              onClick={() => setActiveFormat(format.id)}
            >
              <span>{format.id}</span>{format.label}
            </button>
          ))}
        </div>
      </div>

      <fieldset className={`issuer-section ${activeFormat === 4 ? 'issuer-section-format4' : ''}`}>
        <legend><span>{activeFormat}</span> {meta.label}</legend>
        <p className="issuer-description">{meta.description}</p>
        {activeFormat === 4 ? (
          <div className="issuer-format4-grid">
            <div className="issuer-logo-editor">
              <div className="issuer-logo-preview">
                {item.logoDataUrl
                  ? <img src={item.logoDataUrl} alt="Vista previa del logo" width="420" height="180"/>
                  : <span>Espacio del logo</span>}
              </div>
              <label className="issuer-logo-input" htmlFor="issuer-logo">Agregar o cambiar logo
                <input id="issuer-logo" name="issuer-logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={cambiarLogo}/>
              </label>
              {item.logoDataUrl && <button type="button" className="saas-secondary" onClick={() => update(4, 'logoDataUrl', '')}>Quitar logo</button>}
              {logoError && <p className="issuer-logo-error" role="alert">{logoError}</p>}
            </div>
            <div className="issuer-sensitive-grid">
              {renderField(4, 'nombre', 'Nombre o razón social', {required: true})}
              {renderField(4, 'rut', 'Identificación fiscal', {required: true})}
              {renderField(4, 'direccion', 'Dirección', {required: true})}
              {renderField(4, 'ciudad', 'Ciudad, estado y código postal')}
              {renderField(4, 'pais', 'País')}
              {renderField(4, 'email', 'Correo', {type: 'email', inputMode: 'email'})}
              {renderField(4, 'telefono', 'Teléfono', {type: 'tel', inputMode: 'tel'})}
              {renderField(4, 'sitioWeb', 'Sitio web', {type: 'url', inputMode: 'url'})}
              {renderField(4, 'metodoPago', 'Método de pago')}
              {renderField(4, 'impuestoPorcentaje', 'Impuesto (%)', {type: 'number', inputMode: 'decimal', min: '0', max: '100', step: '0.01'})}
              {renderField(4, 'notas', 'Notas', {multiline: true, wide: true})}
              {renderField(4, 'terminos', 'Términos', {multiline: true, wide: true})}
            </div>
          </div>
        ) : (
          <div className="issuer-basic-grid">
            {renderField(activeFormat, 'nombre', 'Nombre o razón social', {required: true})}
            {renderField(activeFormat, 'rut', 'RUT', {required: true})}
            {renderField(activeFormat, 'direccion', 'Dirección fiscal', {required: true, multiline: true, rows: 3})}
          </div>
        )}
      </fieldset>

      <div className="settings-actions">
        <div className="settings-save-state" role="status" aria-live="polite">
          {saveError ? <span className="is-error">{saveError}</span> : dirty ? 'Cambios sin guardar' : 'Todo guardado'}
        </div>
        <button className="saas-primary" type="submit" disabled={saving || !dirty}><Save size={17}/> {saving ? 'Guardando…' : 'Guardar emisores'}</button>
      </div>
    </form>
  );
}
