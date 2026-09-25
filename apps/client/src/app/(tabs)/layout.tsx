import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";

// Equivalente a TabLayout.jsx de la demo: envuelve Hub/Explore/Perfil con
// Sidebar (desktop) + BottomNav (mobile). Las rutas de juego/mesa quedan
// fuera de este route group a propósito (pantalla completa).
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-app">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <div className="flex-1 min-h-0 w-full max-w-[480px] md:max-w-7xl mx-auto">{children}</div>
        <BottomNav />
      </div>
    </div>
  );
}
