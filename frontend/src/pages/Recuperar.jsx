import { useState } from "react";
import axios from "axios";

export default function Recuperar() {
  const [correo, setCorreo] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");
    try {
      const res = await axios.post(`${API_URL}/recuperar`, { correo });
      setMsg(res.data.message);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Error al enviar el correo. Intenta de nuevo."
      );
    }
  };

  return (
    <div className="container" style={{ maxWidth: 400 }}>
      <h4 className="mb-3 mt-5">Recuperar Contraseña</h4>
      <form onSubmit={handleSubmit}>
        <input
          className="form-control mb-2"
          type="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          placeholder="Tu correo"
          required
        />
        <button className="btn btn-primary w-100">Enviar correo</button>
      </form>
      {msg && <div className="alert alert-success mt-3">{msg}</div>}
      {error && <div className="alert alert-danger mt-3">{error}</div>}
    </div>
  );
}
