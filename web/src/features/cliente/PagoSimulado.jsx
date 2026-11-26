// Pago de una reserva de sauna con Visa, Yape o Plin. SIMULADO: no hay pasarela ni cargo real,
// y los datos de la tarjeta nunca salen del navegador (al servidor solo viaja el medio elegido).
import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  METODOS_PAGO_RESERVA, TARJETA_DE_PRUEBA, evaluarPago, etiquetaMedioPago, formatearFechaPe,
  formatearTarjeta, formatearVencimiento, soloDigitos
} from './logica';
import './pago.css';

const PASOS = {
  visa: ['Validando los datos de tu tarjeta…', 'Consultando con tu banco…', 'Autorizando el pago…'],
  yape: ['Verificando el código de aprobación…', 'Confirmando con Yape…'],
  plin: ['Enviando la solicitud a tu app Plin…', 'Esperando tu aprobación…', 'Confirmando el pago…']
};

const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

export default function PagoSimulado({ reserva, onCerrar, onPagado, demora = 2400 }) {
  const [medio, setMedio] = useState('visa');
  const [datos, setDatos] = useState({ numero: '', titular: '', vence: '', cvv: '', celular: '', codigo: '' });
  const [errores, setErrores] = useState({});
  const [fase, setFase] = useState('form'); // form | procesando | ok
  const [paso, setPaso] = useState(0);
  const [aviso, setAviso] = useState('');
  const [recibo, setRecibo] = useState(null);
  const primero = useRef(null);
  const monto = reserva.tarifa_aplicada;

  useEffect(() => { if (primero.current) primero.current.focus(); }, [medio]);
  useEffect(() => {
    const tecla = (e) => { if (e.key === 'Escape' && fase !== 'procesando') onCerrar(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [fase, onCerrar]);

  const poner = (campo, valor) => { setDatos((d) => ({ ...d, [campo]: valor })); setErrores((e) => ({ ...e, [campo]: undefined })); setAviso(''); };
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

  async function pagar(e) {
    e.preventDefault();
    const v = evaluarPago(medio, datos);
    if (!v.ok && !v.rechazo) { setErrores(v.errores); return; }
    setFase('procesando'); setPaso(0); setAviso('');
    const pasos = PASOS[medio];
    for (let i = 0; i < pasos.length; i += 1) { setPaso(i); await esperar(demora / pasos.length); }
    if (v.rechazo) { setFase('form'); setAviso(v.rechazo); return; }   // simula el rechazo del banco o de Yape
    const r = await supabase.rpc('pagar_reserva_sauna', { p_id_cita: reserva.id_cita, p_medio: medio });
    if (r.error || !r.data || !r.data.ok) {
      setFase('form');
      setAviso((r.error && r.error.message) || 'No se pudo registrar el pago. Inténtalo de nuevo.');
      return;
    }
    setRecibo({ ...r.data, ultimos: soloDigitos(datos.numero).slice(-4) });
    setFase('ok');
    if (onPagado) onPagado(r.data);
  }

  const campo = (id, etiqueta, props = {}) => (
    <div className={`pago-campo${errores[id] ? ' con-error' : ''}`}>
      <label htmlFor={`pago-${id}`}>{etiqueta}</label>
      <input id={`pago-${id}`} value={datos[id]} onChange={(e) => poner(id, props.formato ? props.formato(e.target.value) : e.target.value)}
        aria-invalid={Boolean(errores[id])} aria-describedby={errores[id] ? `pago-${id}-e` : undefined}
        autoComplete={props.auto} inputMode={props.modo} placeholder={props.ph} maxLength={props.max}
        ref={props.primero ? primero : undefined} />
      {errores[id] && <small id={`pago-${id}-e`} className="pago-error">{errores[id]}</small>}
    </div>
  );

  return (
    <div className="pago-fondo" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && fase !== 'procesando') onCerrar(); }}>
      <div className="pago-modal" role="dialog" aria-modal="true" aria-labelledby="pago-titulo">
        {fase !== 'ok' && (
          <>
            <header className="pago-cab">
              <div>
                <h2 id="pago-titulo">Pagar reserva de sauna</h2>
                <p>Sede {reserva.sede} · {formatearFechaPe(reserva.fecha_hora_cita)}</p>
              </div>
              <strong className="pago-monto">{soles(monto)}</strong>
            </header>

            <div className="pago-metodos" role="tablist" aria-label="Medio de pago">
              {METODOS_PAGO_RESERVA.map((m) => (
                <button key={m.id} type="button" role="tab" data-medio={m.id} aria-selected={medio === m.id} disabled={fase === 'procesando'}
                  className={`pago-metodo ${m.id}`} onClick={() => { setMedio(m.id); setErrores({}); setAviso(''); }}>
                  <i aria-hidden="true" />{m.etiqueta}
                </button>
              ))}
            </div>

            {fase === 'procesando' ? (
              <div className="pago-proceso" role="status" aria-live="polite">
                <span className="pago-spinner" aria-hidden="true" />
                <strong>{PASOS[medio][paso]}</strong>
                <small>No cierres esta ventana.</small>
              </div>
            ) : (
              <form onSubmit={pagar} noValidate className="pago-form">
                {aviso && <p className="pago-rechazo" role="alert">{aviso}</p>}

                {medio === 'visa' && (
                  <>
                    <div className="pago-tarjeta" aria-hidden="true">
                      <span className="pago-chip" />
                      <b>{datos.numero || '•••• •••• •••• ••••'}</b>
                      <div><span>{datos.titular.toUpperCase() || 'NOMBRE APELLIDO'}</span><span>{datos.vence || 'MM/AA'}</span></div>
                      <em>VISA</em>
                    </div>
                    {campo('numero', 'Número de tarjeta', { formato: formatearTarjeta, auto: 'cc-number', modo: 'numeric', ph: '0000 0000 0000 0000', max: 19, primero: true })}
                    {campo('titular', 'Titular', { auto: 'cc-name', ph: 'Como figura en la tarjeta', max: 40 })}
                    <div className="pago-fila">
                      {campo('vence', 'Vencimiento', { formato: formatearVencimiento, auto: 'cc-exp', modo: 'numeric', ph: 'MM/AA', max: 5 })}
                      {campo('cvv', 'CVV', { formato: (v) => soloDigitos(v, 3), auto: 'cc-csc', modo: 'numeric', ph: '123', max: 3 })}
                    </div>
                    <button type="button" className="pago-relleno" onClick={() => setDatos((d) => ({ ...d, numero: TARJETA_DE_PRUEBA, titular: d.titular || 'CLIENTE DE PRUEBA', vence: '12/29', cvv: '123' }))}>
                      Usar tarjeta de prueba
                    </button>
                  </>
                )}

                {medio === 'yape' && (
                  <>
                    <p className="pago-ayuda">Abre tu app Yape, genera el <strong>código de aprobación</strong> de 6 dígitos y escríbelo aquí.</p>
                    {campo('celular', 'Celular Yape', { formato: (v) => soloDigitos(v, 9), auto: 'tel', modo: 'numeric', ph: '9XXXXXXXX', max: 9, primero: true })}
                    {campo('codigo', 'Código de aprobación', { formato: (v) => soloDigitos(v, 6), modo: 'numeric', ph: '000000', max: 6 })}
                  </>
                )}

                {medio === 'plin' && (
                  <>
                    <p className="pago-ayuda">Te enviaremos la solicitud de pago a tu app Plin. <strong>Apruébala</strong> con tu huella o clave.</p>
                    {campo('celular', 'Celular Plin', { formato: (v) => soloDigitos(v, 9), auto: 'tel', modo: 'numeric', ph: '9XXXXXXXX', max: 9, primero: true })}
                  </>
                )}

                <button type="submit" className="pago-pagar" data-accion="confirmar-pago">Pagar {soles(monto)} con {etiquetaMedioPago(medio)}</button>
                <p className="pago-pie"><b>Pago simulado:</b> no se realiza ningún cargo real y no guardamos datos de tarjeta.</p>
                <button type="button" className="pago-despues" onClick={onCerrar}>Pagar después en recepción</button>
              </form>
            )}
          </>
        )}

        {fase === 'ok' && recibo && (
          <div className="pago-ok" role="status">
            <span className="pago-check" aria-hidden="true">✓</span>
            <h2 id="pago-titulo">¡Pago aprobado!</h2>
            <p>Tu reserva de sauna quedó pagada. Solo preséntate en la sede a la hora indicada.</p>
            <dl className="pago-recibo">
              <div><dt>Monto</dt><dd>{soles(recibo.monto)}</dd></div>
              <div><dt>Medio</dt><dd>{etiquetaMedioPago(recibo.medio)}{recibo.ultimos ? ` •••• ${recibo.ultimos}` : ''}</dd></div>
              <div><dt>N.º de operación</dt><dd data-operacion>{recibo.operacion}</dd></div>
              <div><dt>Fecha</dt><dd>{formatearFechaPe(recibo.pagado_en || new Date().toISOString())}</dd></div>
              <div><dt>Reserva</dt><dd>Sede {reserva.sede} · {formatearFechaPe(reserva.fecha_hora_cita)}</dd></div>
            </dl>
            <button type="button" className="pago-pagar" data-accion="cerrar-recibo" onClick={onCerrar}>Listo</button>
            <p className="pago-pie">Comprobante simulado, sin valor tributario.</p>
          </div>
        )}
      </div>
    </div>
  );
}
