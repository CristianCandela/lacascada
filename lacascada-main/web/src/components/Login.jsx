import { useState } from 'react';
import Icono, { Logo, Logof } from './Iconos';

export default function Login({ onEntrar, error }) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [ver, setVer] = useState(false);
  const [local, setLocal] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(ev) {
    ev.preventDefault();
    setLocal('');
    if (!email.trim() || !pass) { setLocal('Ingresa tu correo y tu contraseña.'); return; }
    setEnviando(true);
    await onEntrar(email.trim(), pass);
    setPass('');
    setEnviando(false);
  }

  const msg = local || error;

  return (
    <div className="login">
      <aside className="login-hero" aria-hidden="true">
        <div className="login-hero-texto">
          <Logof tam={650} />
          <p className="login-lema">Menos citas perdidas, más tiempo para tus socios.</p>
          <p className="login-sub">Reservas y control de asistencia para el sauna y gimnasio.</p>
        </div>
      </aside>
      <section className="login-panel">
        <div className="login-tarjeta">
          <Logo tam={350} align="center" />
          <h1>Iniciar sesión</h1>
          <p className="ayuda">Acceso solo para el personal de recepcsión y administración.</p>
          <form onSubmit={enviar} noValidate>
            {msg && (
              <div id="login-error" className="alerta-form" role="alert">
                <Icono n="alerta" tam={18} /><span>{msg}</span>
              </div>
            )}
            {!msg && <p id="login-error" className="sr" role="alert"></p>}
            <label htmlFor="login-email">Correo electrónico</label>
            <div className="entrada">
              <Icono n="correo" tam={18} />
              <input id="login-email" type="email" autoComplete="username" placeholder="nombre@cascadagym.pe"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <label htmlFor="login-pass">Contraseña</label>
            <div className="entrada">
              <Icono n="candado" tam={18} />
              <input id="login-pass" type={ver ? 'text' : 'password'} autoComplete="current-password"
                value={pass} onChange={(e) => setPass(e.target.value)} />
              <button type="button" className="ojo" onClick={() => setVer(!ver)}
                aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={ver}>
                <Icono n={ver ? 'ojoNo' : 'ojo'} tam={18} />
              </button>
            </div>
            <button type="submit" id="btn-login" className="ancho" disabled={enviando}>
              {enviando ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
          <p className="ayuda centrado"><a href="#/reservar">¿Eres cliente? Solicita tu reserva aquí</a></p>
        </div>
      </section>
    </div>
  );
}
