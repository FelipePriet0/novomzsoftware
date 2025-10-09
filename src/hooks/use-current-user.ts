import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";

export function useCurrentUser() {
  const { profile } = useAuth();
  
  const [name] = useState<string>(() => {
    try {
      const stored = localStorage.getItem("currentUserName");
      return stored && stored.trim() ? stored : "Felipe";
    } catch {
      return "Felipe";
    }
  });

  // Priorizar o full_name do profile do AuthContext se disponível
  const currentName = profile?.full_name || name || "Usuário";

  // In a real app, you could also expose id, role, etc.
  return useMemo(() => ({ name: currentName }), [currentName]);
}
