export default function Aviso({ mensaje }) {
  if (!mensaje) return null;
  return <div id="aviso" className="aviso" role="alert">{mensaje}</div>;
}
