// Una operación que pasó del límite del rol (o necesita el visto bueno de un superior) responde
// 202 "pendiente de autorización": no se aplicó todavía. Se trata como un aviso y no como un
// éxito, para que ninguna pantalla diga "registrado" ni limpie el formulario.
import axios from "axios";

let instalado = false;
export const instalarAvisoAutorizacion = () => {
  if (instalado) return;
  instalado = true;
  axios.interceptors.response.use((resp) => {
    if (resp.status === 202 && resp.data?.pendiente_autorizacion) {
      const error = new Error(resp.data.message);
      error.response = resp;
      error.pendienteAutorizacion = true;
      return Promise.reject(error);
    }
    return resp;
  });
};
