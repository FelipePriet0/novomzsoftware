import { type CSSProperties } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  ChevronRight,
  History,
  KanbanSquare,
  Route,
  User,
  ListTodo,
  Megaphone,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  end?: boolean;
};

const sidebarDimensions: CSSProperties = {
  "--sidebar-width": "14rem",
  "--sidebar-width-icon": "4rem", // Largura quando oculto
  "--sidebar-width-expanded": "14rem", // Largura quando expandido
};

const navigationItems: NavItem[] = [
  { title: "Tarefas", url: "/tarefas", icon: ListTodo },
  { title: "Kanban", url: "/", icon: KanbanSquare, end: true },
  { title: "Agendamento", url: "/agendamento", icon: Route },
  { title: "Histórico", url: "/historico", icon: History },
  { title: "Avisos", url: "/avisos", icon: Megaphone },
  { title: "Perfil", url: "/perfil", icon: User },
];

const utilityItems: NavItem[] = [];

export function AppSidebar() {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <>
      {/* Trigger invisível para detectar hover */}
      <div className="fixed left-0 top-0 z-40 h-full w-4 hover:w-16 transition-all duration-300 group">
        {/* Sidebar flutuante que aparece no hover */}
        <div className={cn(
          "fixed left-2 top-6 bottom-6 z-50 transition-all duration-300 ease-out",
          "bg-gradient-to-b from-[#018942] via-[#016b35] to-[#014d28] text-white",
          "rounded-2xl shadow-2xl backdrop-blur-xl border border-white/20",
          "w-0 opacity-0 overflow-hidden",
          "group-hover:w-64 group-hover:opacity-100",
          "flex flex-col items-center justify-between py-6"
        )}>
          {/* Conteúdo do sidebar */}
          <div className="flex flex-col items-center gap-8 w-full px-4">
            {/* Logo Section */}
            <div className="flex flex-col items-center gap-3 relative">
              <div className="relative">
                <div className="absolute inset-0 bg-white/20 rounded-3xl blur-xl"></div>
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-white/30 to-white/10 backdrop-blur-md border border-white/40 text-lg font-bold uppercase tracking-[0.3em] text-white shadow-lg">
                  MZ
                </div>
              </div>
              <div className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
                <span className="text-xs font-semibold tracking-widest text-white">
                  Net
                </span>
                <div className="h-px w-8 bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
              </div>
            </div>

            {/* Navigation Items */}
            <div className="flex flex-col items-center gap-3 w-full">
              {navigationItems.map((item) => {
                const active = item.end ? currentPath === item.url : currentPath.startsWith(item.url);
                
                return (
                  <div key={item.title} className="w-full">
                    <NavLink
                      to={item.url}
                      end={item.end}
                      aria-label={item.title}
                      className={cn(
                        "relative flex h-12 w-full items-center gap-3 rounded-xl border transition-all duration-300 group/item",
                        "backdrop-blur-md px-4",
                        // Estado normal
                        "border-white/20 bg-white/10 text-white/80",
                        // Hover
                        "hover:border-white/40 hover:bg-white/20 hover:text-white hover:scale-[1.02] hover:shadow-lg",
                        // Estado ativo
                        active && "border-white/60 bg-white/25 text-white shadow-[0_8px_24px_rgba(0,0,0,0.2)]",
                        // Indicador lateral
                        "after:absolute after:right-2 after:h-8 after:w-1 after:rounded-full after:bg-white after:opacity-0 after:transition-all after:duration-300",
                        active && "after:opacity-100 after:shadow-[0_0_12px_rgba(255,255,255,0.5)]"
                      )}
                    >
                      <div className={cn(
                        "flex items-center justify-center transition-all duration-300",
                        active && "scale-110"
                      )}>
                        <item.icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <span className={cn(
                        "text-sm font-medium tracking-wide transition-all duration-300",
                        active ? "text-white font-semibold" : "text-white/90",
                        "opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0"
                      )}>
                        {item.title}
                      </span>
                      {active && (
                        <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-75">
                          <ChevronRight className="h-4 w-4 text-white/60" />
                        </div>
                      )}
                    </NavLink>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default AppSidebar;
