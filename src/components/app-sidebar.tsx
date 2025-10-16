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
  "--sidebar-width-icon": "5.5rem",
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

  const renderItem = (item: NavItem) => {
    const active = item.end ? currentPath === item.url : currentPath.startsWith(item.url);

    return (
      <SidebarMenuItem key={item.title} className="w-full">
        <SidebarMenuButton
          asChild
          isActive={active}
          tooltip={item.title}
          className={cn(
            "relative flex h-12 w-full items-center gap-3 rounded-xl border transition-all duration-300",
            "backdrop-blur-md group",
            // Estado normal
            "border-white/20 bg-white/10 text-white/80",
            // Hover
            "hover:border-white/40 hover:bg-white/20 hover:text-white hover:scale-[1.02] hover:shadow-lg",
            // Focus
            "focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-0",
            // Estado ativo
            active && "border-white/60 bg-white/25 text-white shadow-[0_8px_24px_rgba(0,0,0,0.2)]",
            // Indicador lateral para item ativo
            "after:absolute after:right-[-14px] after:h-8 after:w-1 after:rounded-full after:bg-white after:opacity-0 after:transition-all after:duration-300",
            active && "after:opacity-100 after:shadow-[0_0_12px_rgba(255,255,255,0.5)]",
            // Ícone collapse
            "group-data-[collapsible=icon]:!w-12 group-data-[collapsible=icon]:!px-0 group-data-[collapsible=icon]:justify-center",
            "group-data-[collapsible=icon]:rounded-xl group-data-[collapsible=icon]:after:hidden"
          )}
        >
          <NavLink
            to={item.url}
            end={item.end}
            aria-label={item.title}
            className="flex h-full w-full items-center justify-start gap-3 px-4 transition-all group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          >
            <div className={cn(
              "flex items-center justify-center transition-all duration-300",
              active && "scale-110"
            )}>
              <item.icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <span className={cn(
              "text-sm font-medium tracking-wide transition-all duration-300",
              "group-data-[collapsible=icon]:hidden",
              active ? "text-white font-semibold" : "text-white/90"
            )}>
              {item.title}
            </span>
            {active && (
              <div className="ml-auto">
                <ChevronRight className="h-4 w-4 text-white/60" />
              </div>
            )}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar
      collapsible="none"
      variant="sidebar"
      style={sidebarDimensions}
      className={cn(
        // Verde sólido diretamente no container quando collapsible="none"
        "bg-[hsl(var(--brand))] text-white",
        // E fallback para variantes que usam o wrapper interno
        "[&_[data-sidebar=sidebar]]:bg-[hsl(var(--brand))]",
        "[&_[data-sidebar=sidebar]]:text-[hsl(var(--neutral-white))]",
        "[&_[data-sidebar=content]]:px-0"
      )}
    >
      {/* Toggle button removido: sidebar permanece sempre aberta */}

      <SidebarContent className="flex h-full flex-col items-center justify-between gap-0 px-0 py-6">
        <div className="flex flex-col items-center gap-8">
          {/* Logo Section com design moderno */}
          <div className="flex flex-col items-center gap-3 relative">
            <div className="relative">
              <div className="absolute inset-0 bg-white/20 rounded-3xl blur-xl"></div>
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-white/30 to-white/10 backdrop-blur-md border border-white/40 text-lg font-bold uppercase tracking-[0.3em] text-white shadow-lg">
                MZ
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-semibold tracking-widest text-white">
                Net
              </span>
              <div className="h-px w-8 bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
            </div>
          </div>

          <SidebarGroup className="w-full p-0">
            <SidebarGroupContent className="flex w-full justify-center">
              <SidebarMenu className="flex w-full flex-col items-center gap-5">
                {navigationItems.map(renderItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>

        {utilityItems.length > 0 && (
          <SidebarGroup className="w-full p-0">
            <SidebarGroupContent className="flex w-full justify-center">
              <SidebarMenu className="flex w-full flex-col items-center gap-5">
                {utilityItems.map(renderItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}

export default AppSidebar;
