import { useCallback, useEffect, useState } from 'react';
import { supabase, esFalloDeRed, MSG_RED } from '../lib/supabase';

// Maneja la sesión y el perfil (nombre y rol) del usuario conectado.
export function useSesion() {
  const [cargando, setCargando] = useState(true);
  const [perfil, setPerfil] = useState(null);
  const [error, setError] = useState('');

  const cargarPerfil = useCallback(async (user) => {
    const r = await supabase.from('perfiles').select('nombre, rol').eq('id', user.id).maybeSingle();
    if (r.error) throw r.error;
    if (!r.data) {
      await supabase.auth.signOut();
      throw new Error('Tu usuario no tiene un rol asignado. Contacta al administrador.');
    }
    setPerfil(r.data);
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const s = await supabase.auth.getSession();
        if (vivo && s.data && s.data.session) await cargarPerfil(s.data.session.user);
      } catch (e) {
        if (vivo) setError(esFalloDeRed(e) ? MSG_RED : e.message);
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => { vivo = false; };
  }, [cargarPerfil]);

  const entrar = useCallback(async (email, pass) => {
    setError('');
    try {
      const r = await supabase.auth.signInWithPassword({ email, password: pass });
      if (r.error) {
        setError(esFalloDeRed(r.error) ? MSG_RED : 'Correo o contraseña incorrectos.');
        return;
      }
      await cargarPerfil(r.data.user);
    } catch (e) {
      setError(esFalloDeRed(e) ? MSG_RED : e.message);
    }
  }, [cargarPerfil]);

  const salir = useCallback(async () => {
    try { await supabase.auth.signOut(); } catch { /* se ignora */ }
    setPerfil(null);
  }, []);

  return { cargando, perfil, error, entrar, salir };
}
