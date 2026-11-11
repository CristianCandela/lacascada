// Simulación de lo que Recepción necesita del servidor (solo `npm run dev:mock` y e2e).
// CONTRATO = ya está en docs/CONTRATO_DATOS.md | PROPUESTA = pendiente de PR a Cristian.
import { calcularTarifaSauna, esAfiliadoVigente, tipoBusqueda, PLANES, MOTIVOS_ANULACION, montoCobro, nuevoFin,
  clientesConPases, entradasPorHora } from './logica.js';

const SEDE = 'Santa Rosa';
const CAP_GIM = 40;
const CAP_SAUNA = 4; // igual que AFOROS['sauna|Santa Rosa'] en supabase-mock.js, para que `disponibilidad` coincida

const pad = (n) => String(n).padStart(2, '0');
const fecha = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const enDias = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return fecha(d); };
const haceMin = (m) => new Date(Date.now() - m * 60000).toISOString();
const horaIso = (iso) => new Date(iso).toISOString().slice(0, 13); // misma lógica que supabase-mock.js
const mismoDia = (iso) => new Date(iso).toDateString() === new Date().toDateString();
const sinTildes = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const etiquetaHora = (d) => `${d.getHours() % 12 || 12}:00 ${d.getHours() >= 12 ? 'pm' : 'am'}`;
const err = (m) => ({ data: null, error: new Error(m) });

const CLIENTES = [
  ['k101', 'Rodrigo Alva', '47829103', '987000101', 'C-1001'],
  ['k102', 'Fernanda Silva', '71209384', '987000102', 'C-1002'],
  ['k103', 'Mateo Castro', '09482716', '987000103', 'C-1003'],
  ['k104', 'Luciana Quispe', '44321098', '987000104', 'C-1004'],
  ['k105', 'Joaquín Paredes', '10293847', '987000105', 'C-1005'],
  ['k106', 'Raúl Palma', '45120398', '987000106', 'C-1006']
];
const FINES = { k101: 20, k102: null, k103: 2, k104: 5, k105: -2, k106: 12 }; // días hasta el fin (null = sin plan)

const soloPersonal = (ctx) => { const u = ctx.usuario && ctx.usuario(); if (!u) return true; return ['recepcionista', 'administrador'].includes(u.rol); };
const ultimaMembresia = (db, id) => db.membresias.filter((m) => m.id_cliente === id).sort((a, b) => (a.fin < b.fin ? 1 : -1))[0];
const citasEnHora = (db, sede, iso) => db.citas.filter((c) => c.servicio === 'sauna' && c.sede === sede
  && horaIso(c.fecha_hora_cita) === horaIso(iso) && c.estado_asistencia !== 'cancelo');

function ficha(db, c) {
  const m = ultimaMembresia(db, c.id_cliente);
  const entradas = db.checkins.filter((x) => x.id_cliente === c.id_cliente).sort((a, b) => (a.entrada_en < b.entrada_en ? 1 : -1));
  return {
    id_cliente: c.id_cliente, nombre: c.nombre, dni: c.dni, telefono: c.telefono, codigo_cliente: c.codigo_cliente || null,
    membresia_fin: m ? m.fin : null,
    ultima_entrada: entradas[0] ? entradas[0].entrada_en : null,
    pase_hoy: db.pagos.some((p) => p.id_cliente === c.id_cliente && p.concepto === 'pase_dia' && mismoDia(p.pagado_en)),
    citas_hoy: db.citas.filter((x) => x.id_cliente === c.id_cliente && x.servicio === 'sauna' && mismoDia(x.fecha_hora_cita) && x.estado_asistencia !== 'cancelo')
      .map((x) => ({ id_cita: x.id_cita, fecha_hora_cita: x.fecha_hora_cita, estado_pago: x.estado_pago || 'pagada', estado_asistencia: x.estado_asistencia }))
  };
}

export const mock = {
  usuarios: {}, // recepcion@demo.test ya existe en supabase-mock.js

  iniciar(db) {
    CLIENTES.forEach(([id, nombre, dni, telefono, codigo]) =>
      db.clientes.push({ id_cliente: id, nombre, dni, telefono, codigo_cliente: codigo }));
    db.membresias = CLIENTES.filter(([id]) => FINES[id] !== null).map(([id], i) => ({
      id_membresia: `m${i + 1}`, id_cliente: id, id_plan: 'p1', inicio: enDias(-30), fin: enDias(FINES[id]),
      estado: FINES[id] < 0 ? 'vencida' : 'activa'
    }));
    // 18 entradas de gimnasio en los últimos 90 minutos.
    db.checkins = Array.from({ length: 18 }, (_, i) => ({
      id_checkin: `ch${i + 1}`, id_cliente: CLIENTES[i % CLIENTES.length][0], id_cita: null,
      sede: SEDE, servicio: 'gimnasio', entrada_en: haceMin(i * 4 + 1), metodo: i % 3 === 0 ? 'manual' : 'codigo'
    }));
    db.pagos = [
      { id_pago: 'pg1', monto: 450, medio: 'efectivo', concepto: 'membresia', pagado_en: haceMin(120) },
      { id_pago: 'pg2', monto: 780, medio: 'yape', concepto: 'membresia', pagado_en: haceMin(90) },
      { id_pago: 'pg3', monto: 250, medio: 'plin', concepto: 'sauna', pagado_en: haceMin(40) },
      { id_pago: 'pg4', id_cliente: 'k102', monto: 20, medio: 'efectivo', concepto: 'pase_dia', pagado_en: haceMin(300) },
      { id_pago: 'pg5', id_cliente: 'k102', monto: 20, medio: 'yape', concepto: 'pase_dia', pagado_en: haceMin(200) },
      { id_pago: 'pg6', id_cliente: 'k102', monto: 20, medio: 'plin', concepto: 'pase_dia', pagado_en: haceMin(100) }
    ];
    // 3 reservas de sauna pagadas en la hora actual y 1 no-show de hoy.
    const h = new Date(); h.setMinutes(0, 0, 0);
    ['k101', 'k103', 'k104'].forEach((id, i) => db.citas.push({
      id_cita: `cr${i + 1}`, id_cliente: id, servicio: 'sauna', sede: SEDE, fecha_hora_cita: h.toISOString(),
      fecha_hora_registro: haceMin(200), estado_asistencia: 'pendiente', estado_pago: 'pagada', origen: 'recepcion', tarifa_aplicada: 15
    }));
    db.citas.push({
      id_cita: 'cr9', id_cliente: 'k105', servicio: 'sauna', sede: SEDE, fecha_hora_cita: haceMin(180),
      fecha_hora_registro: haceMin(400), estado_asistencia: 'no_asistio', estado_pago: 'pagada', origen: 'cliente', tarifa_aplicada: 20
    });
    db.citas.push({
      id_cita: 'cr8', id_cliente: 'k106', servicio: 'sauna', sede: SEDE, fecha_hora_cita: haceMin(150),
      fecha_hora_registro: haceMin(300), estado_asistencia: 'pendiente', estado_pago: 'pagada', origen: 'recepcion', tarifa_aplicada: 15
    });
  },

  rpc: {
    // CONTRATO: aforo_actual(p_sede) -> [{ servicio, ocupados, capacidad }]
    aforo_actual(args, ctx) {
      const desde = Date.now() - 90 * 60000; // ventana de 90 min
      const gim = ctx.db.checkins.filter((c) => c.servicio === 'gimnasio' && new Date(c.entrada_en).getTime() >= desde).length;
      const sauna = citasEnHora(ctx.db, SEDE, new Date().toISOString()).length;
      return { data: [{ servicio: 'gimnasio', ocupados: gim, capacidad: CAP_GIM }, { servicio: 'sauna', ocupados: sauna, capacidad: CAP_SAUNA }], error: null };
    },

    // CONTRATO: codigo_local_actual(p_sede) -> { codigo, vigente_hasta }
    codigo_local_actual() {
      const hasta = new Date(); hasta.setHours(23, 0, 0, 0);
      return { data: { codigo: 'CAS-7489', vigente_hasta: hasta.toISOString() }, error: null };
    },

    // CONTRATO: membresias_por_vencer(p_dias = 7) -> [{ id_cliente, nombre, fin }]
    membresias_por_vencer(args, ctx) {
      const limite = enDias((args && args.p_dias) || 7);
      const data = ctx.db.membresias.filter((m) => m.fin <= limite)
        .map((m) => ({ id_cliente: m.id_cliente, nombre: ctx.db.clientes.find((c) => c.id_cliente === m.id_cliente).nombre, fin: m.fin }))
        .sort((a, b) => (a.fin < b.fin ? -1 : 1));
      return { data, error: null };
    },

    // PROPUESTA: buscar_cliente(p_texto) -> lista de fichas (código, DNI o nombre)
    buscar_cliente(args, ctx) {
      if (!soloPersonal(ctx)) return err('Sin permiso');
      const t = String((args && args.p_texto) || '').trim();
      const tipo = tipoBusqueda(t);
      if (tipo === 'vacio') return { data: [], error: null };
      const lista = ctx.db.clientes.filter((c) => {
        if (tipo === 'dni') return c.dni === t;
        if (tipo === 'codigo') return (c.codigo_cliente || '').toUpperCase() === t.toUpperCase();
        return sinTildes(c.nombre).includes(sinTildes(t));
      });
      return { data: lista.slice(0, 8).map((c) => ficha(ctx.db, c)), error: null };
    },

    // CONTRATO (se amplía): checkin_manual(p_id_cliente, p_servicio = 'gimnasio', p_id_cita = null) -> id_checkin
    checkin_manual(args, ctx) {
      if (!soloPersonal(ctx)) return err('Sin permiso');
      const cli = ctx.db.clientes.find((c) => c.id_cliente === args.p_id_cliente);
      if (!cli) return err('Cliente no encontrado');
      const servicio = args.p_servicio || 'gimnasio';
      if (servicio === 'gimnasio') {
        const f = ficha(ctx.db, cli);
        if (!esAfiliadoVigente(f.membresia_fin) && !f.pase_hoy) return err('Sin membresía vigente ni pase del día pagado');
      }
      if (args.p_id_cita) {
        const cita = ctx.db.citas.find((c) => c.id_cita === args.p_id_cita);
        if (!cita) return err('La cita no existe');
        cita.estado_asistencia = 'asistio';
      }
      const id = ctx.nuevoId('ch');
      ctx.db.checkins.push({ id_checkin: id, id_cliente: cli.id_cliente, id_cita: args.p_id_cita || null, sede: SEDE,
        servicio, entrada_en: new Date().toISOString(), metodo: 'manual' });
      return { data: id, error: null };
    },

    // PROPUESTA: reservar_sauna_recepcion(p_id_cliente, p_sede, p_fecha_hora, p_medio) -> id_cita
    // Reserva y pago en UNA operación: la cita nace pagada. Si no hay cupo, no cobra.
    reservar_sauna_recepcion(args, ctx) {
      if (!soloPersonal(ctx)) return err('Sin permiso');
      if (!['efectivo', 'yape', 'plin'].includes(args.p_medio)) return err('Medio de pago no válido');
      const cli = ctx.db.clientes.find((c) => c.id_cliente === args.p_id_cliente);
      if (!cli) return err('Cliente no encontrado');
      const inicioHora = new Date(); inicioHora.setMinutes(0, 0, 0);
      if (new Date(args.p_fecha_hora) < inicioHora) return err('Ese turno ya pasó');
      if (citasEnHora(ctx.db, args.p_sede, args.p_fecha_hora).length >= CAP_SAUNA) return err('Aforo máximo completado para esta franja horaria');
      if (citasEnHora(ctx.db, args.p_sede, args.p_fecha_hora).some((c) => c.id_cliente === cli.id_cliente)) return err('El cliente ya tiene reserva en ese turno');
      const m = ultimaMembresia(ctx.db, cli.id_cliente);
      const tarifa = calcularTarifaSauna(esAfiliadoVigente(m && m.fin)); // el servidor calcula, no recibe monto
      const id = ctx.nuevoId('c');
      ctx.db.citas.push({ id_cita: id, id_cliente: cli.id_cliente, servicio: 'sauna', sede: args.p_sede, fecha_hora_cita: args.p_fecha_hora,
        fecha_hora_registro: new Date().toISOString(), estado_asistencia: 'pendiente', estado_pago: 'pagada', origen: 'recepcion', tarifa_aplicada: tarifa.monto });
      ctx.db.pagos.push({ id_pago: ctx.nuevoId('pg'), id_cliente: cli.id_cliente, id_cita: id, monto: tarifa.monto, medio: args.p_medio,
        concepto: 'sauna', pagado_en: new Date().toISOString() });
      return { data: id, error: null };
    },

    // PROPUESTA: resumen_dia(p_sede) -> entradas, cobros por medio, no-shows, turnos de sauna
    resumen_dia(args, ctx) {
      const cobros = { efectivo: 0, yape: 0, plin: 0 };
      ctx.db.pagos.filter((p) => mismoDia(p.pagado_en)).forEach((p) => { cobros[p.medio] += p.monto; });
      const turnos = [0, 1].map((i) => {
        const d = new Date(); d.setHours(d.getHours() + i, 0, 0, 0);
        return { hora: etiquetaHora(d), ocupados: citasEnHora(ctx.db, SEDE, d.toISOString()).length, capacidad: CAP_SAUNA };
      });
      return { data: {
        entradas: ctx.db.checkins.filter((c) => mismoDia(c.entrada_en)).length,
        cobros,
        no_shows: ctx.db.citas.filter((c) => c.servicio === 'sauna' && c.estado_asistencia === 'no_asistio' && mismoDia(c.fecha_hora_cita)).length,
        turnos
      }, error: null };
    },

   // PROPUESTA: entradas_recientes(p_limite)
    entradas_recientes(args, ctx) {
      const lim = (args && args.p_limite) || 5;
      const data = [...ctx.db.checkins].sort((a, b) => (a.entrada_en < b.entrada_en ? 1 : -1)).slice(0, lim).map((c) => {
        const cli = ctx.db.clientes.find((x) => x.id_cliente === c.id_cliente);
        const mem = ultimaMembresia(ctx.db, c.id_cliente);
        return { nombre: cli.nombre, dni: cli.dni, entrada_en: c.entrada_en, metodo: c.metodo, servicio: c.servicio, fin: mem ? mem.fin : null };
      });
      return { data, error: null };
    },

    // PROPUESTA: registrar_cliente_asistido(p_nombre, p_dni, p_telefono, p_consentimiento) -> { id_cliente, codigo_cliente }
    registrar_cliente_asistido(args, ctx) {
      if (!soloPersonal(ctx)) return err('Sin permiso');
      const dni = String(args.p_dni || '').trim();
      const tel = String(args.p_telefono || '').trim();
      if (!String(args.p_nombre || '').trim()) return err('Falta el nombre');
      if (!/^\d{8}$/.test(dni)) return err('El DNI debe tener 8 dígitos');
      if (tel && !/^\d{9}$/.test(tel)) return err('El teléfono debe tener 9 dígitos');
      if (!args.p_consentimiento) return err('Falta el consentimiento informado');
      if (ctx.db.clientes.some((c) => c.dni === dni)) return err('Ya existe un cliente con ese DNI');
      const codigo = `C-${1001 + ctx.db.clientes.filter((c) => c.codigo_cliente).length}`;
      const id = ctx.nuevoId('k');
      ctx.db.clientes.push({ id_cliente: id, nombre: String(args.p_nombre).trim(), dni, telefono: tel, codigo_cliente: codigo, asistido_en: new Date().toISOString() });
      return { data: { id_cliente: id, codigo_cliente: codigo }, error: null };
    },

    // PROPUESTA: reservas_recepcion_hoy(p_limite) -> últimas reservas de sauna hechas en recepción
    reservas_recepcion_hoy(args, ctx) {
      const lim = (args && args.p_limite) || 5;
      const data = ctx.db.citas.filter((c) => c.servicio === 'sauna' && c.origen === 'recepcion' && mismoDia(c.fecha_hora_registro))
        .sort((a, b) => (a.fecha_hora_registro < b.fecha_hora_registro ? 1 : -1)).slice(0, lim)
        .map((c) => ({ nombre: ctx.db.clientes.find((x) => x.id_cliente === c.id_cliente).nombre,
          fecha_hora_cita: c.fecha_hora_cita, tarifa: c.tarifa_aplicada, estado_pago: c.estado_pago }));
      return { data, error: null };
    },

        // CONTRATO (se amplía): registrar_pago(p_id_cliente, p_id_plan, p_medio, p_concepto) -> id_pago. El monto lo calcula el servidor.
    registrar_pago(args, ctx) {
      if (!soloPersonal(ctx)) return err('Sin permiso');
      if (!['efectivo', 'yape', 'plin'].includes(args.p_medio)) return err('Medio de pago no válido');
      const cli = ctx.db.clientes.find((c) => c.id_cliente === args.p_id_cliente);
      if (!cli) return err('Cliente no encontrado');
      const concepto = args.p_concepto || 'membresia';
      const plan = PLANES.find((p) => p.id_plan === args.p_id_plan);
      if (concepto === 'membresia' && !plan) return err('Plan no válido');
      const monto = montoCobro(concepto, plan);
      let idMem = null;
      if (concepto === 'membresia') {
        const m = ultimaMembresia(ctx.db, cli.id_cliente);
        const fin = nuevoFin(m && m.fin, plan.dias);
        idMem = ctx.nuevoId('m');
        ctx.db.membresias.push({ id_membresia: idMem, id_cliente: cli.id_cliente, id_plan: plan.id_plan, inicio: fecha(new Date()), fin, estado: 'activa' });
      }
      const id = ctx.nuevoId('pg');
      ctx.db.pagos.push({ id_pago: id, id_cliente: cli.id_cliente, id_membresia: idMem, monto, medio: args.p_medio, concepto,
        estado: 'registrado', registrado_por: 'recepcion', pagado_en: new Date().toISOString() });
      return { data: id, error: null };
    },

    // PROPUESTA: anular_pago(p_id_pago, p_motivo). No borra: marca como anulado y guarda el motivo.
    anular_pago(args, ctx) {
      if (!soloPersonal(ctx)) return err('Sin permiso');
      if (!MOTIVOS_ANULACION.includes(args.p_motivo)) return err('Falta el motivo de la anulación');
      const p = ctx.db.pagos.find((x) => x.id_pago === args.p_id_pago);
      if (!p) return err('Pago no encontrado');
      if (p.estado === 'anulado') return err('El pago ya estaba anulado');
      p.estado = 'anulado'; p.motivo_anulacion = args.p_motivo;
      return { data: true, error: null };
    },

    // PROPUESTA: pagos_hoy(p_limite) -> pagos del día con cliente
    pagos_hoy(args, ctx) {
      const data = ctx.db.pagos.filter((p) => mismoDia(p.pagado_en))
        .sort((a, b) => (a.pagado_en < b.pagado_en ? 1 : -1)).slice(0, (args && args.p_limite) || 30)
        .map((p) => {
          const c = ctx.db.clientes.find((x) => x.id_cliente === p.id_cliente);
          return { id_pago: p.id_pago, nombre: c ? c.nombre : 'Cliente', codigo: c ? c.codigo_cliente : '', concepto: p.concepto,
            medio: p.medio, monto: p.monto, estado: p.estado || 'registrado', pagado_en: p.pagado_en };
        });
      return { data, error: null };
    },

        // PROPUESTA: verificar_dni(p_dni) -> { existe, nombre? }
    verificar_dni(args, ctx) {
      if (!soloPersonal(ctx)) return err('Sin permiso');
      const c = ctx.db.clientes.find((x) => x.dni === String(args.p_dni || '').trim());
      return { data: c ? { existe: true, nombre: c.nombre, codigo_cliente: c.codigo_cliente } : { existe: false }, error: null };
    },

    // PROPUESTA: registros_asistidos_hoy(p_limite)
    registros_asistidos_hoy(args, ctx) {
      const data = ctx.db.clientes.filter((c) => c.asistido_en && mismoDia(c.asistido_en))
        .sort((a, b) => (a.asistido_en < b.asistido_en ? 1 : -1)).slice(0, (args && args.p_limite) || 5)
        .map((c) => ({ nombre: c.nombre, dni: c.dni, codigo_cliente: c.codigo_cliente, asistido_en: c.asistido_en }));
      return { data, error: null };
    },

        // PROPUESTA: renovaciones_lista(p_dias) -> membresías que vencen en p_dias o ya vencidas, con teléfono y última visita
    renovaciones_lista(args, ctx) {
      if (!soloPersonal(ctx)) return err('Sin permiso');
      const limite = enDias((args && args.p_dias) || 7);
      const data = ctx.db.membresias.filter((m) => m.fin <= limite)
        .map((m) => {
          const c = ctx.db.clientes.find((x) => x.id_cliente === m.id_cliente);
          const ent = ctx.db.checkins.filter((x) => x.id_cliente === m.id_cliente).sort((a, b) => (a.entrada_en < b.entrada_en ? 1 : -1))[0];
          return { id_cliente: m.id_cliente, nombre: c.nombre, dni: c.dni, codigo_cliente: c.codigo_cliente, telefono: c.telefono,
            fin: m.fin, ultima_visita: ent ? ent.entrada_en : null };
        }).sort((a, b) => (a.fin < b.fin ? -1 : 1));
      return { data, error: null };
    },

    // PROPUESTA: afiliados_ausentes(p_dias = 14) -> afiliados vigentes sin check-in en p_dias o más
    afiliados_ausentes(args, ctx) {
      if (!soloPersonal(ctx)) return err('Sin permiso');
      const dias = (args && args.p_dias) || 14;
      const corte = Date.now() - dias * 86400000;
      const hoyStr = fecha(new Date());
      const data = ctx.db.membresias.filter((m) => m.fin >= hoyStr).map((m) => {
      const c = ctx.db.clientes.find((x) => x.id_cliente === m.id_cliente);
      const ent = ctx.db.checkins.filter((x) => x.id_cliente === m.id_cliente).sort((a, b) => (a.entrada_en < b.entrada_en ? 1 : -1))[0];
        return { id_cliente: m.id_cliente, nombre: c.nombre, dni: c.dni, codigo_cliente: c.codigo_cliente, telefono: c.telefono,
          fin: m.fin, ultima_visita: ent ? ent.entrada_en : null };
      }).filter((x) => !x.ultima_visita || new Date(x.ultima_visita).getTime() < corte);
      return { data, error: null };
    },

        // PROPUESTA: oportunidades_conversion() -> clientes con 3+ pases del día
    oportunidades_conversion(args, ctx) {
      if (!soloPersonal(ctx)) return err('Sin permiso');
      return { data: clientesConPases(ctx.db.pagos, ctx.db.clientes), error: null };
    },

        // PROPUESTA: resumen_completo(p_sede) -> cuadre de caja, asistencia de sauna y entradas por hora
    resumen_completo(args, ctx) {
      if (!soloPersonal(ctx)) return err('Sin permiso');
      const sede = (args && args.p_sede) || SEDE;
      const pagos = ctx.db.pagos.filter((p) => mismoDia(p.pagado_en) && p.estado !== 'anulado');
      const suma = (f) => pagos.filter(f).reduce((a, p) => a + p.monto, 0);
      const cuenta = (f) => pagos.filter(f).length;
      const citasDia = ctx.db.citas.filter((c) => c.servicio === 'sauna' && c.sede === sede && mismoDia(c.fecha_hora_cita) && c.estado_asistencia !== 'cancelo');
      const checkins = ctx.db.checkins.filter((c) => c.sede === sede && c.servicio === 'gimnasio' && mismoDia(c.entrada_en));
      const ahora = Date.now();
      const sinCheckin = citasDia.filter((c) => c.estado_pago === 'pagada' && c.estado_asistencia === 'pendiente' && new Date(c.fecha_hora_cita).getTime() + 3600000 <= ahora)
        .map((c) => ({ id_cita: c.id_cita, id_cliente: c.id_cliente, nombre: ctx.db.clientes.find((x) => x.id_cliente === c.id_cliente).nombre, fecha_hora_cita: c.fecha_hora_cita }));
      return { data: {
        cobros: {
          efectivo: suma((p) => p.medio === 'efectivo'), yape: suma((p) => p.medio === 'yape'), plin: suma((p) => p.medio === 'plin'),
          n_efectivo: cuenta((p) => p.medio === 'efectivo'), n_yape: cuenta((p) => p.medio === 'yape'), n_plin: cuenta((p) => p.medio === 'plin'),
          membresia: suma((p) => p.concepto === 'membresia'), pase_dia: suma((p) => p.concepto === 'pase_dia'), sauna: suma((p) => p.concepto === 'sauna'),
          anulados: ctx.db.pagos.filter((p) => mismoDia(p.pagado_en) && p.estado === 'anulado').length
        },
        sauna: { asistio: citasDia.filter((c) => c.estado_asistencia === 'asistio').length, no_asistio: citasDia.filter((c) => c.estado_asistencia === 'no_asistio').length, pendientes: citasDia.filter((c) => c.estado_asistencia === 'pendiente').length },
        entradas: checkins.length,
        por_codigo: checkins.filter((c) => c.metodo === 'codigo').length,
        por_hora: entradasPorHora(checkins),
        sin_checkin: sinCheckin
      }, error: null };
    },
  }
};