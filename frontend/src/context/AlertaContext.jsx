// src/context/AlertaContext.jsx
import { createContext, useContext, useState } from "react";
import AlertaModal from "../components/AlertaModal"; // Asegúrate de la ruta

const AlertaContext = createContext();

export function useAlerta() {
  return useContext(AlertaContext);
}

export function AlertaProvider({ children }) {
  const [alerta, setAlerta] = useState({
    show: false,
    tipo: "success",
    mensaje: "",
  });

  const mostrarAlerta = (mensaje, tipo = "success") => {
    setAlerta({ show: true, tipo, mensaje });
  };

  const ocultarAlerta = () =>
    setAlerta({ show: false, tipo: "success", mensaje: "" });

  return (
    <AlertaContext.Provider value={{ mostrarAlerta, ocultarAlerta }}>
      {children}
      <AlertaModal
        show={alerta.show}
        tipo={alerta.tipo}
        mensaje={alerta.mensaje}
        onClose={ocultarAlerta}
      />
    </AlertaContext.Provider>
  );
}
