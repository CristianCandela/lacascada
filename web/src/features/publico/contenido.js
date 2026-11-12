// Textos y datos de contacto de la página pública. Edita aquí, no en Landing.jsx.
// Fuentes: informes APF1/APF2 (razón social, RUC, sedes) y perfil público de Facebook de la empresa
// (descripción de servicios, teléfono y correo). Verifica el teléfono y el correo antes de publicar.
// La misión y la visión son un borrador del equipo: la empresa debe validarlas.

export const EMPRESA = {
  marca: 'Cascada Gym',
  razonSocial: 'Sauna y Gimnasio La Cascada E.I.R.L.',
  ruc: '20551515398',
  telefono: '913023155',
  correo: 'gimnasiocascada@hotmail.com'
};

// Clave = nombre de la sede en la base de datos (tabla sedes / aforos).
export const SEDES = {
  'Túpac Amaru': { titulo: 'Sede Principal', direccion: 'Av. Túpac Amaru N.° 6912, Año Nuevo, Comas' },
  'Santa Rosa': { titulo: 'Sucursal Santa Rosa', direccion: 'Av. Túpac Amaru N.° 1857, Comas' }
};

export const MISION = 'Ofrecer un servicio de gimnasio y sauna cercano y confiable, dedicado a la satisfacción diaria de cada cliente, con instalaciones cuidadas, trato respetuoso y procesos simples que cuidan su tiempo.';
export const VISION = 'Ser el centro de bienestar de referencia en Comas, reconocido por su trato humano y por usar la tecnología para que entrenar y relajarse sea cada día más fácil.';

export const SERVICIOS = {
  gimnasio: {
    titulo: 'Gimnasio',
    descripcion: 'Equipos de cardio y fuerza para entrenar a tu ritmo, con atención cercana del equipo de la sede.',
    datos: [
      ['Acceso', 'Con tu membresía vigente'],
      ['Reserva', 'No necesitas reservar'],
      ['Entrada', 'Con el código del local desde tu celular']
    ]
  },
  sauna: {
    titulo: 'Sauna',
    descripcion: 'Cámara de vapor, cámara seca y piscina pequeña para recuperarte después de entrenar o simplemente descansar.',
    datos: [
      ['Acceso', 'Con tu membresía vigente'],
      ['Reserva', 'Por turno de una hora, según los cupos libres'],
      ['Cupos', 'El aforo limitado asegura un ambiente tranquilo']
    ]
  }
};

export const PASOS = [
  ['Crea tu cuenta', 'Pide el código del local en recepción y regístrate con tu DNI. Es la única vez que llenas tus datos.'],
  ['Activa tu plan', 'Paga tu Plan general en recepción. Tu membresía queda registrada y puedes ver cuándo vence.'],
  ['Entra con tu código', 'Ingresa el código del local desde tu celular para marcar tu entrada y reserva tu turno de sauna.']
];
