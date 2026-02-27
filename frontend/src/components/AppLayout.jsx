import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 992);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 992);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isDesktop) setSidebarCollapsed(false); // Siempre expandida en mobile
  }, [isDesktop]);

  return (
    <div style={{ minHeight: "100vh", background: "#f9f7ef" }}>
      <Navbar user={user} onLogout={logout} />
      {user && (
        <Sidebar
          collapsed={sidebarCollapsed}
          onCollapseChange={setSidebarCollapsed}
        />
      )}
      <main
        style={{
          marginLeft: user && isDesktop ? (sidebarCollapsed ? 70 : 240) : 0,
          paddingTop: 62,
          transition: "margin 0.25s cubic-bezier(.39,1,.32,1)",
          minHeight: "100vh",
        }}
      >
        <div className="container-fluid py-3">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
