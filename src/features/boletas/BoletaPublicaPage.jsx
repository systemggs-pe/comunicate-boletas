import React, {useMemo, useState} from 'react';
import {AlertCircle, Building2, CheckCircle2, FileText, PackageCheck, Search} from '../../components/Icons.jsx';
import {consultarBoletaPublica} from '../../services/functionsClient.js';
import {formatClp} from '../../utils/currency.js';

const initialForm = {rut: '', nBoleta: '', fecha: '', monto: ''};
const publicDateFormatter = new Intl.DateTimeFormat('es-PE', {dateStyle: 'medium', timeStyle: 'short'});

function equipmentRows(boleta) {
  const data = boleta?.boletaData || {};
  return (data.ventas || []).map((sale, index) => {
    const equipment = data.equiposMap?.[sale.imeiEquipo] || {};
    return {
      id: `${sale.imeiEquipo || 'item'}-${index}`,
      name: [sale.marcaEquipo || equipment.marca, equipment.nombreComercial || sale.nombreComercial || sale.modeloEquipo || equipment.modelo].filter(Boolean).join(' '),
      details: [sale.memoria || equipment.memoria, sale.color || equipment.color, sale.sn || equipment.sn ? `S/N ${sale.sn || equipment.sn}` : '', sale.imeiEquipo ? `IMEI ${sale.imeiEquipo}` : ''].filter(Boolean).join(' / '),
    };
  });
}

export function BoletaPublicaPage() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [boleta, setBoleta] = useState(null);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const items = useMemo(() => equipmentRows(boleta), [boleta]);

  const submit = async event => {
    event.preventDefault();
    const errors = {};
    if (!form.rut.trim()) errors.rut = 'Ingresa el RUT impreso en la boleta.';
    if (!form.nBoleta.trim()) errors.nBoleta = 'Ingresa el número de boleta.';
    if (!form.fecha) errors.fecha = 'Selecciona la fecha impresa en la boleta.';
    if (!form.monto.trim() || Number(String(form.monto).replace(',', '.')) <= 0) errors.monto = 'Ingresa un monto total válido.';
    setFieldErrors(errors);
    const firstField = Object.keys(errors)[0];
    if (firstField) {
      window.requestAnimationFrame(() => {
        const input = document.getElementById(`public-${firstField}`);
        input?.focus();
        input?.scrollIntoView({behavior: 'smooth', block: 'center'});
      });
      return;
    }
    setLoading(true);
    setError('');
    setBoleta(null);
    try {
      const result = await consultarBoletaPublica(form);
      setBoleta(result.boleta);
    } catch (requestError) {
      setError(requestError.message === 'BOLETA_NO_ENCONTRADA'
        ? 'Los datos no coinciden con una boleta emitida.'
        : 'No fue posible verificar la boleta. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field, value) => {
    setFieldErrors(current => {
      const next = {...current};
      delete next[field];
      return next;
    });
    setError('');
    setForm(current => ({...current, [field]: value}));
  };

  const renderFieldError = field => fieldErrors[field]
    ? <span className="field-error" id={`public-${field}-error`} role="alert">{fieldErrors[field]}</span>
    : null;

  const data = boleta?.boletaData || {};
  const emitter = data.emisor || {};
  const total = Number(boleta?.totalClp || data.totalClp || 0);
  const tax = Math.round(total * 0.19 / 1.19);
  const subtotal = total - tax;

  return (
    <main className="public-page">
      <header className="public-header">
        <div className="public-brand"><FileText size={22}/><span>COMUNIC@TE</span></div>
        <span>Verificación de boleta de venta</span>
      </header>
      <section className="public-content">
        <div className="public-intro">
          <p className="saas-page-kicker">Consulta pública</p>
          <h1>Comprueba tu BOLETA DE VENTA</h1>
          <p>Ingresa exactamente los datos impresos al final del documento.</p>
        </div>
        <form className="public-form" onSubmit={submit} noValidate aria-busy={loading}>
          <label htmlFor="public-rut">RUT del cliente
            <input id="public-rut" name="rut" value={form.rut} onChange={e => updateField('rut', e.target.value)} autoComplete="off" spellCheck="false" aria-invalid={Boolean(fieldErrors.rut)} aria-describedby={fieldErrors.rut ? 'public-rut-error' : undefined} required/>
            {renderFieldError('rut')}
          </label>
          <label htmlFor="public-nBoleta">Número de boleta
            <input id="public-nBoleta" name="nBoleta" inputMode="numeric" value={form.nBoleta} onChange={e => updateField('nBoleta', e.target.value.replace(/\D/g, ''))} autoComplete="off" spellCheck="false" aria-invalid={Boolean(fieldErrors.nBoleta)} aria-describedby={fieldErrors.nBoleta ? 'public-nBoleta-error' : undefined} required/>
            {renderFieldError('nBoleta')}
          </label>
          <label htmlFor="public-fecha">Fecha
            <input id="public-fecha" name="fecha" type="date" value={form.fecha} onChange={e => updateField('fecha', e.target.value)} autoComplete="off" aria-invalid={Boolean(fieldErrors.fecha)} aria-describedby={fieldErrors.fecha ? 'public-fecha-error' : undefined} required/>
            {renderFieldError('fecha')}
          </label>
          <label htmlFor="public-monto">Monto total
            <input id="public-monto" name="monto" inputMode="decimal" value={form.monto} onChange={e => updateField('monto', e.target.value)} placeholder="CLP o PEN…" autoComplete="off" spellCheck="false" aria-invalid={Boolean(fieldErrors.monto)} aria-describedby={fieldErrors.monto ? 'public-monto-error' : undefined} required/>
            {renderFieldError('monto')}
          </label>
          <button className="saas-primary" type="submit" disabled={loading}><Search size={17}/> {loading ? 'Verificando…' : 'Verificar boleta'}</button>
          {loading && <p className="public-loading" role="status" aria-live="polite">Consultando la boleta de venta…</p>}
        </form>

        {error && <div className="public-error" role="alert"><AlertCircle size={19}/>{error}</div>}

        {boleta && (
          <article className="validation-result" aria-live="polite">
            <header><CheckCircle2 size={24}/><div><strong>La boleta de venta existe y es válida</strong><span>Boleta N.º {boleta.nBoleta}</span></div></header>
            <dl className="validation-summary">
              <div><dt>Cliente</dt><dd>{data.cliente?.nombre || boleta.clienteNombre}</dd></div>
              <div><dt>Fecha y hora</dt><dd>{publicDateFormatter.format(new Date(boleta.fechaHora))}</dd></div>
            </dl>
            <section className="validation-section">
              <h2><PackageCheck size={18}/> Artículo adquirido</h2>
              {items.map(item => <div className="validation-item" key={item.id}><strong>{item.name || 'Equipo'}</strong><span>{item.details || 'Sin caracteristicas registradas'}</span></div>)}
              <div className="validation-item-total"><span>Total del articulo</span><strong>${formatClp(total)} CLP</strong></div>
            </section>
            <section className="validation-section">
              <h2><Building2 size={18}/> Empresa emisora</h2>
              <p><strong>{emitter.nombre || 'Empresa no especificada'}</strong></p>
              <p>{emitter.direccion || 'Dirección no especificada'}</p>
              <p>RUT {emitter.rut || '-'}</p>
            </section>
            <dl className="amounts">
              <div><dt>Monto</dt><dd>${formatClp(subtotal)} CLP</dd></div>
              <div><dt>Impuesto</dt><dd>${formatClp(tax)} CLP</dd></div>
              <div className="amount-total"><dt>Total</dt><dd>${formatClp(total)} CLP</dd></div>
            </dl>
          </article>
        )}
      </section>
    </main>
  );
}
