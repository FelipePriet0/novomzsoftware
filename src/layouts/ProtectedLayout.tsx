import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Outlet } from "react-router-dom";
import { useState } from 'react';
import { InboxDrawer } from '@/components/inbox/InboxDrawer';
import { Bell } from 'lucide-react';

export default function ProtectedLayout() {
  const [inboxOpen, setInboxOpen] = useState(false);
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex min-h-screen w-full flex-col">
          <header className="relative z-20 h-12 flex items-center justify-between border-b border-[#018942]/30 text-[#018942] px-4">
            <div />
            <button aria-label="Abrir Caixa de Entrada" onClick={()=>setInboxOpen(true)} className="p-2 rounded-full hover:bg-[#018942]/10">
              <Bell className="h-5 w-5" />
            </button>
          </header>
          <main className="flex-1">
            <Outlet />
          </main>
          <InboxDrawer open={inboxOpen} onClose={()=>setInboxOpen(false)} />
        </div>
      </div>
    </SidebarProvider>
  );
}
