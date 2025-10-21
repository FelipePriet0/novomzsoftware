import React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { dbg } from "@/lib/debug";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

const maskCNPJ = (v: string) => {
  const d = v.replace(/\D+/g, "").slice(0, 14);
  const p = [
    d.substring(0, 2),
    d.substring(2, 5),
    d.substring(5, 8),
    d.substring(8, 12),
    d.substring(12, 14),
  ];
  return p[0] && p[1] && p[2] && p[3] && p[4]
    ? `${p[0]}.${p[1]}.${p[2]}/${p[3]}-${p[4]}`
    : d;
};

const maskCPF = (v: string) => {
  const d = v.replace(/\D+/g, "").slice(0, 11);
  const p = [d.substring(0,3), d.substring(3,6), d.substring(6,9), d.substring(9,11)];
  return p[0] && p[1] && p[2] && p[3] ? `${p[0]}.${p[1]}.${p[2]}-${p[3]}` : d;
}

const maskPhone = (v: string) => {
  const d = v.replace(/\D+/g, "").slice(0,11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
}

const maskCEP = (v: string) => v.replace(/\D+/g, "").slice(0,8).replace(/(\d{5})(\d{0,3})/, "$1-$2");

const schema = z.object({
  corporate_name: z.string().min(1, "Obrigatório"),
  trade_name: z.string().min(1, "Obrigatório"),
  cnpj: z.string().min(18, "CNPJ inválido"),
  email: z.string().email("E-mail inválido"),
  // Contatos da empresa (opcionais)
  contact_phone: z.string().optional(),
  contact_whatsapp: z.string().optional(),
  // Removidos: Nome do Solicitante e Tel do Solicitante (usar Modal PJ)
});

type PJForm = z.infer<typeof schema>;

interface NovaFichaPJFormProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (created: { id: string; title: string; cpf_cnpj?: string; phone?: string; email?: string; received_at?: string; applicant_id: string; }) => void;
  onBack?: () => void;
}

export default function NovaFichaPJForm({ open, onClose, onCreated, onBack }: NovaFichaPJFormProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const form = useForm<PJForm>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      corporate_name: "",
      trade_name: "",
      cnpj: "",
      email: "",
      contact_phone: "",
      contact_whatsapp: "",
    }
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      // 1) Garantir applicant PJ em PRODUÇÃO (kanban_cards exige FK não nulo)
      const cnpj = values.cnpj.replace(/\D+/g, '');
      dbg('pj', 'CNPJ normalizado');
      
      let applicantProd: { id: string } | null = null;
      const { data: existingProd } = await supabase
        .from('applicants')
        .select('id, primary_name, phone, email, created_at')
        .eq('cpf_cnpj', cnpj)
        .eq('person_type', 'PJ')
        .maybeSingle();
      
      if (existingProd?.id) {
        dbg('pj', 'CNPJ já cadastrado – bloqueando criação');
        
        // 🚫 BLOQUEAR criação e avisar usuário
        toast({
          title: '⚠️ CNPJ já cadastrado',
          description: `Já existe um cadastro para este CNPJ:\n\n` +
            `Razão Social: ${existingProd.primary_name}\n` +
            `Telefone: ${existingProd.phone || 'Não informado'}\n` +
            `Email: ${existingProd.email || 'Não informado'}\n` +
            `Cadastrado em: ${new Date(existingProd.created_at).toLocaleDateString('pt-BR')}\n\n` +
            `Não é possível criar nova ficha com CNPJ duplicado.`,
          variant: 'destructive',
          duration: 8000, // 8 segundos para ler
        });
        
        // ❌ ABORTAR criação
        return;
      } else {
        dbg('pj', 'Criando applicant PJ');
        const { data: createdProd, error: aErr1 } = await supabase
          .from('applicants')
          .insert({
            person_type: 'PJ',
            primary_name: values.corporate_name,
            cpf_cnpj: cnpj, // Usar CNPJ limpo (sem formatação)
            // Contatos principais da empresa
            phone: values.contact_phone || null,
            whatsapp: values.contact_whatsapp || null,
            email: values.email,
          })
          .select('id')
          .single();
        if (aErr1) throw aErr1;
        applicantProd = createdProd as any;
      }

      // Removido: espelho em applicants_test (legado)

      // 3) Card no Kanban (Comercial/feitas) com applicant_id de PRODUÇÃO
   dbg('pj', 'Criando card no Kanban');
      const now = new Date();
      const { data: createdCard, error: cErr } = await supabase
        .from('kanban_cards')
        .insert({
          applicant_id: applicantProd!.id,
          person_type: 'PJ',
          area: 'comercial',
          stage: 'feitas',
          created_by: profile?.id || null,
          assignee_id: null,
          received_at: now.toISOString(),
          // Campos removidos: title, cpf_cnpj, phone, email, source
          // Dados vêm de applicants via FK applicant_id
        })
        .select('id, applicant_id, received_at')
        .single();
      if (cErr) throw cErr;

      toast({ title: 'Ficha PJ criada' });
      onCreated?.({
        id: createdCard.id,
        title: values.corporate_name, // Dados vêm do form/applicants, não do card
        cpf_cnpj: cnpj,
        phone: values.contact_phone ?? undefined,
        email: values.email,
        received_at: createdCard.received_at ?? undefined,
        applicant_id: applicantProd!.id,
      });
      onClose();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message || String(e), variant: 'destructive' });
    }
  });

  // Drag support (grab anywhere except inputs)
  const [dx, setDx] = React.useState(0);
  const [dy, setDy] = React.useState(0);
  React.useEffect(() => { if (open) { setDx(0); setDy(0); } }, [open]);
  const onStart = (e: React.MouseEvent | React.TouchEvent) => {
    const target = (e as any).target as HTMLElement | null;
    if (target && target.closest('input, textarea, select, button, [contenteditable="true"], [data-ignore-drag]')) return;
    const cx = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const cy = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const baseX = dx; const baseY = dy;
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    const move = (ev: MouseEvent | TouchEvent) => {
      const mx = (ev as TouchEvent).touches ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX;
      const my = (ev as TouchEvent).touches ? (ev as TouchEvent).touches[0].clientY : (ev as MouseEvent).clientY;
      const ndx = baseX + (mx - cx);
      const ndy = baseY + (my - cy);
      setDx(ndx);
      setDy(ndy);
    };
    const stop = () => {
      window.removeEventListener('mousemove', move as any);
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('touchmove', move as any);
      window.removeEventListener('touchend', stop);
    };
    window.addEventListener('mousemove', move as any);
    window.addEventListener('mouseup', stop);
    window.addEventListener('touchmove', move as any, { passive: false });
    window.addEventListener('touchend', stop, { passive: true });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-2xl p-0 overflow-hidden cursor-grab"
        onMouseDown={onStart} onTouchStart={onStart}
        style={{ transform: `translate3d(${dx}px, ${dy}px, 0)` }}
      >
        {/* Header com gradiente moderno */}
        <DialogHeader className="bg-gradient-to-br from-[#018942] via-[#016b35] to-[#014d28] text-white p-6 relative overflow-hidden">
          <div className='absolute inset-0 bg-[url("data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.05%22%3E%3Ccircle cx=%2230%22 cy=%2230%22 r=%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")] opacity-20'></div>
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
              <span className="text-white text-lg font-bold">🏢</span>
            </div>
            <div className="flex items-center gap-3">
              <img 
                src="/src/assets/Logo MZNET (1).png" 
                alt="MZNET Logo" 
                className="h-8 w-auto"
              />
              <div>
                <DialogTitle className="text-lg font-semibold text-white">
                  Nova Ficha - Pessoa Jurídica
                </DialogTitle>
                <p className="text-green-100 text-sm mt-1">
                  Dados cadastrais básicos da empresa
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Seção: Dados da Empresa */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                Dados da Empresa
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="corporate_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">Razão Social</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Ex: Empresa LTDA"
                        className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="trade_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">Nome Fantasia</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Ex: Empresa Legal"
                        className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="cnpj" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">CNPJ</FormLabel>
                    <FormControl>
                      <Input 
                        value={field.value} 
                        onChange={(e)=> field.onChange(maskCNPJ(e.target.value))} 
                        placeholder="00.000.000/0000-00"
                        className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">E-mail</FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        {...field} 
                        placeholder="empresa@exemplo.com"
                        className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* Seção: Contatos */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Contatos
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="contact_phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">Telefone</FormLabel>
                    <FormControl>
                      <Input 
                        value={field.value || ''} 
                        onChange={(e)=> field.onChange(maskPhone(e.target.value))} 
                        placeholder="(11) 99999-9999"
                        className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="contact_whatsapp" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">WhatsApp</FormLabel>
                    <FormControl>
                      <Input 
                        value={field.value || ''} 
                        onChange={(e)=> field.onChange(maskPhone(e.target.value))} 
                        placeholder="(11) 99999-9999"
                        className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => (onBack ? onBack() : onClose())}
                className="flex-1 bg-white hover:bg-gray-50 text-gray-700 border-gray-300 hover:border-gray-400 rounded-lg transition-all duration-200"
              >
                Voltar
              </Button>
              <Button 
                type="submit" 
                className="flex-1 bg-gradient-to-r from-[#018942] to-[#016b35] hover:from-[#016b35] hover:to-[#014d28] text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
              >
                Criar Ficha PJ
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
