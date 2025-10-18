import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const basicInfoSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  cpf: z.string().min(11, "CPF é obrigatório").max(14, "CPF inválido"),
  telefone: z.string().min(1, "Telefone é obrigatório"),
  whatsapp: z.string().optional(),
  nascimento: z.string()
    .min(10, "Data de nascimento é obrigatória")
    .refine((v) => /^(\d{2})\/(\d{2})\/(\d{4})$/.test(v), "Data inválida (dd/mm/aaaa)"),
  naturalidade: z.string().min(1, "Naturalidade é obrigatória"),
  uf: z.string().min(2, "UF é obrigatória").max(2, "UF deve ter 2 caracteres"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
});

export type BasicInfoData = z.infer<typeof basicInfoSchema>;

interface BasicInfoModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: BasicInfoData, applicationId?: string) => void;
  initialData?: Partial<BasicInfoData>;
  onBack?: () => void;
}

export function BasicInfoModal({ open, onClose, onSubmit, initialData, onBack }: BasicInfoModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<BasicInfoData>({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: {
      nome: initialData?.nome || "",
      cpf: initialData?.cpf || "",
      telefone: initialData?.telefone || "",
      whatsapp: initialData?.whatsapp || "",
      nascimento: ((): string => {
        const n = initialData?.nascimento as unknown as any;
        if (!n) return "";
        if (typeof n === 'string') return n;
        if (n instanceof Date && !isNaN(n.getTime())) {
          const d = n.getDate().toString().padStart(2,'0');
          const m = (n.getMonth()+1).toString().padStart(2,'0');
          const y = n.getFullYear();
          return `${d}/${m}/${y}`;
        }
        return "";
      })(),
      naturalidade: initialData?.naturalidade || "",
      uf: initialData?.uf || "",
      email: initialData?.email || "",
    },
  });

  // Resetar o formulário sempre que abrir sem dados iniciais
  // ou quando initialData mudar (evita valores "antigos" aparecerem)
  useEffect(() => {
    if (open) {
      const defaults = {
        nome: initialData?.nome || "",
        cpf: initialData?.cpf || "",
        telefone: initialData?.telefone || "",
        whatsapp: initialData?.whatsapp || "",
        nascimento: ((): string => {
          const n = initialData?.nascimento as unknown as any;
          if (!n) return "";
          if (typeof n === 'string') return n;
          if (n instanceof Date && !isNaN(n.getTime())) {
            const d = n.getDate().toString().padStart(2,'0');
            const m = (n.getMonth()+1).toString().padStart(2,'0');
            const y = n.getFullYear();
            return `${d}/${m}/${y}`;
          }
          return "";
        })(),
        naturalidade: initialData?.naturalidade || "",
        uf: initialData?.uf || "",
        email: initialData?.email || "",
      } as BasicInfoData;
      form.reset(defaults, { keepDirty: false });
    }
  }, [open, initialData]);

  const handleSubmit = async (data: BasicInfoData) => {
    setIsSubmitting(true);
    try {
      // MVP novo backend: criar direto no caller (KanbanBoard)
      onSubmit(data);
    } catch (error) {
      console.error('Error saving draft:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar os dados. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCPF = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const formatDateMask = (value: string) => {
    const digits = value.replace(/\D/g, '');
    const p1 = digits.slice(0,2);
    const p2 = digits.slice(2,4);
    const p3 = digits.slice(4,8);
    let out = p1;
    if (p2) out += '/' + p2;
    if (p3) out += '/' + p3;
    return out;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent aria-describedby={undefined} className="max-w-2xl p-0 overflow-hidden max-h-[95vh]">
        {/* Header com gradiente moderno */}
        <DialogHeader className="bg-gradient-to-br from-[#018942] via-[#016b35] to-[#014d28] text-white p-6 relative overflow-hidden">
          <div className='absolute inset-0 bg-[url("data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.05%22%3E%3Ccircle cx=%2230%22 cy=%2230%22 r=%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")] opacity-20'></div>
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
              <span className="text-white text-lg font-bold">👤</span>
            </div>
            <div className="flex items-center gap-3">
              <img 
                src="/src/assets/Logo MZNET (1).png" 
                alt="MZNET Logo" 
                className="h-8 w-auto"
              />
              <div>
                <DialogTitle className="text-lg font-semibold text-white">
                  Dados Pessoais Básicos
                </DialogTitle>
                <p className="text-green-100 text-sm mt-1">
                  Preencha as informações fundamentais do cliente
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="p-6 space-y-6 max-h-[calc(95vh-120px)] overflow-y-auto mz-form">
            {/* Seção: Identificação */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                Identificação
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel className="text-sm font-medium text-gray-700">Nome Completo *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Nome completo do cliente" 
                          {...field}
                          className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cpf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">CPF *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="000.000.000-00"
                          {...field}
                          onChange={(e) => field.onChange(formatCPF(e.target.value))}
                          maxLength={14}
                          className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nascimento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">Data de Nascimento *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="dd/mm/aaaa"
                          maxLength={10}
                          value={field.value}
                          onChange={(e)=> field.onChange(formatDateMask(e.target.value))}
                          className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Seção: Contatos */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Contatos
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="telefone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">Telefone *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="(11) 99999-9999"
                          {...field}
                          onChange={(e) => field.onChange(formatPhone(e.target.value))}
                          maxLength={15}
                          className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="whatsapp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">WhatsApp</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="(11) 99999-9999"
                          {...field}
                          onChange={(e) => field.onChange(formatPhone(e.target.value))}
                          maxLength={15}
                          className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel className="text-sm font-medium text-gray-700">E-mail</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="cliente@exemplo.com"
                          {...field}
                          className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Seção: Naturalidade */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                Naturalidade
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="naturalidade"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel className="text-sm font-medium text-gray-700">Cidade de Nascimento *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ex: São Paulo" 
                          {...field}
                          className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="uf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">UF *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="SP"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          maxLength={2}
                          className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              {onBack && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onBack} 
                  disabled={isSubmitting}
                  className="bg-white hover:bg-gray-50 text-gray-700 border-gray-300 hover:border-gray-400 rounded-lg transition-all duration-200"
                >
                  Voltar
                </Button>
              )}
              <div className="flex-1"></div>
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose} 
                disabled={isSubmitting}
                className="bg-white hover:bg-gray-50 text-gray-700 border-gray-300 hover:border-gray-400 rounded-lg transition-all duration-200"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="bg-gradient-to-r from-[#018942] to-[#016b35] hover:from-[#016b35] hover:to-[#014d28] text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? "Salvando..." : "Continuar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
