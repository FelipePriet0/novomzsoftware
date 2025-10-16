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
      console.log('🔍 [NovaFichaPJ] CNPJ limpo:', cnpj);
      
      let applicantProd: { id: string } | null = null;
      const { data: existingProd } = await supabase
        .from('applicants')
        .select('id, primary_name, phone, email, created_at')
        .eq('cpf_cnpj', cnpj)
        .eq('person_type', 'PJ')
        .maybeSingle();
      
      if (existingProd?.id) {
        console.log('⚠️ [NovaFichaPJ] CNPJ já cadastrado! Bloqueando criação.', existingProd);
        
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
        console.log('📝 [NovaFichaPJ] Criando novo applicant PJ');
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
      console.log('📋 [NovaFichaPJ] Criando card no Kanban para applicant:', applicantProd!.id);
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

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Dados Cadastrais Básicos</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-6 mz-form">
            <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField control={form.control} name="corporate_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Razão Social</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="trade_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Fantasia</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="cnpj" render={({ field }) => (
                <FormItem>
                  <FormLabel>CNPJ</FormLabel>
                  <FormControl><Input value={field.value} onChange={(e)=> field.onChange(maskCNPJ(e.target.value))} placeholder="00.000.000/0000-00" className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl><Input type="email" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              {/* Ordem desejada: Telefone | Whatsapp (Solicitante removidos desta etapa) */}
              <FormField control={form.control} name="contact_phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl>
                    <Input value={field.value || ''} onChange={(e)=> field.onChange(maskPhone(e.target.value))} placeholder="(00) 00000-0000" className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="contact_whatsapp" render={({ field }) => (
                <FormItem>
                  <FormLabel>WhatsApp</FormLabel>
                  <FormControl><Input value={field.value || ''} onChange={(e)=> field.onChange(maskPhone(e.target.value))} placeholder="(00) 00000-0000" className="flex h-12 w-full items-center justify-between rounded-[30px] border border-white bg-[rgba(217,217,217,0.20)] px-5 py-3 text-sm text-white placeholder-white/70 shadow-[0_5.447px_5.447px_rgba(0,0,0,0.25)] focus:outline-none focus:ring-4 focus:ring-[rgba(1,137,66,0.25)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              </section>
            

            <div className="flex justify-between pt-2">
              <Button type="button" variant="secondary" onClick={() => (onBack ? onBack() : onClose())}>Voltar</Button>
              <Button type="submit" className="bg-[#018942] text-white hover:-translate-y-0.5 hover:shadow-[0_10px_18px_rgba(0,0,0,0.25)]">Criar Ficha PJ</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
