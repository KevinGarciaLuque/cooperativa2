import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

export default function Restablecer() {
  const { token } = useParams();
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [msg, setMsg] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    if (password !== confirmar) {
      setMsg("Las contraseñas no coinciden.");
      return;
    }
    try {
      const res = await axios.post(
        `${
          import.meta.env.VITE_API_URL || "http://localhost:5000/api"
        }/recuperar/${token}`,
        { password }
      );
      setMsg(
        res.data.message || "Contraseña actualizada. Ahora inicia sesión."
      );
      setTimeout(() => navigate("/login"), 2000); // Redirige después de 2s
    } catch (error) {
      setMsg(error.response?.data?.message || "Enlace inválido o expirado.");
    }
  };

  return (
    <div className="container py-5" style={{ maxWidth: 400 }}>
      <h4>Restablecer contraseña</h4>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label>Nueva contraseña</label>
          <input
            type="password"
            className="form-control"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        <div className="mb-3">
          <label>Confirmar contraseña</label>
          <input
            type="password"
            className="form-control"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            required
            minLength={6}
          />
        </div>
        <button className="btn btn-success w-100" type="submit">
          Actualizar
        </button>
        {msg && <div className="alert alert-info mt-3">{msg}</div>}
      </form>
    </div>
  );
}
