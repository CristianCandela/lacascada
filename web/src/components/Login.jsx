import { useState } from 'react';

export default function Login({ onEntrar, error }) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
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

  return (
    <section className="tarjeta estrecha">
      <h1>Iniciar sesión</h1>
      <p className="ayuda">Acceso solo para el personal (recepción y administración).</p>
      <form onSubmit={enviar} noValidate>
        <label htmlFor="login-email">Correo</label>
        <input id="login-email" type="email" autoComplete="username"
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="login-pass">Contraseña</label>
        <input id="login-pass" type="password" autoComplete="current-password"
          value={pass} onChange={(e) => setPass(e.target.value)} />
        <p id="login-error" className="error" role="alert">{local || error}</p>
        <button type="submit" id="btn-login" disabled={enviando}>Ingresar</button>
      </form>
    </section>
  );
}
