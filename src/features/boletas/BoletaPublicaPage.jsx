import React, {useMemo, useState} from 'react';
import {AlertCircle, Building2, CheckCircle2, FileText, PackageCheck, Search} from '../../components/Icons.jsx';
import {consultarBoletaPublica} from '../../services/functionsClient.js';
import {formatClp} from '../../utils/currency.js';

const initialForm = {rut: '', nBoleta: '', fecha: '', monto: ''};

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
  const items = useMemo(() => equipmentRows(boleta), [boleta]);

  const submit = async event => {
    event.preventDefault();
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

  const data = boleta?.boletaData || {};
  const emitter = data.emisor || {};
  const total = Number(boleta?.totalClp || data.totalClp || 0);
  const tax = Math.round(total * 0.19 / 1.19);
  const subtotal = total - tax;

  return (
    <main className="public-page">
      <header className="public-header">
        <div className="public-brand"><FileText size={22}/><span>COMUNIC@TE</span></div>
        <span>Verificacion de boleta de venta</span>
      </header>
      <section className="public-content">
        <div className="public-intro">
          <p className="saas-page-kicker">Consulta publica</p>
          <h1>Comprueba tu BOLETA DE VENTA</h1>
          <p>Ingresa exactamente los datos impresos al final del documento.</p>
        </div>
        <form className="public-form" onSubmit={submit}>
          <label>RUT del cliente<input value={form.rut} onChange={e => setForm({...form, rut: e.target.value})} required/></label>
          <label>Numero de boleta<input inputMode="numeric" value={form.nBoleta} onChange={e => setForm({...form, nBoleta: e.target.value.replace(/\D/g, '')})} required/></label>
          <label>Fecha<input type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} required/></label>
          <label>Monto total<input inputMode="decimal" value={form.monto} onChange={e => setForm({...form, monto: e.target.value})} placeholder="CLP o PEN" required/></label>
          <button className="saas-primary" type="submit" disabled={loading}><Search size={17}/> {loading ? 'Verificando...' : 'Verificar boleta'}</button>
        </form>

        {error && <div className="public-error" role="alert"><AlertCircle size={19}/>{error}</div>}

        {boleta && (
          <article className="validation-result">
            <header><CheckCircle2 size={24}/><div><strong>La boleta de venta existe y es valida</strong><span>Boleta Nro {boleta.nBoleta}</span></div></header>
            <dl className="validation-summary">
              <div><dt>Cliente</dt><dd>{data.cliente?.nombre || boleta.clienteNombre}</dd></div>
              <div><dt>Fecha y hora</dt><dd>{new Date(boleta.fechaHora).toLocaleString('es-PE')}</dd></div>
            </dl>
            <section className="validation-section">
              <h2><PackageCheck size={18}/> Articulo adquirido</h2>
              {items.map(item => <div className="validation-item" key={item.id}><strong>{item.name || 'Equipo'}</strong><span>{item.details || 'Sin caracteristicas registradas'}</span></div>)}
              <div className="validation-item-total"><span>Total del articulo</span><strong>${formatClp(total)} CLP</strong></div>
            </section>
            <section className="validation-section">
              <h2><Building2 size={18}/> Empresa emisora</h2>
              <p><strong>{emitter.nombre || 'Empresa no especificada'}</strong></p>
              <p>{emitter.direccion || 'Direccion no especificada'}</p>
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
