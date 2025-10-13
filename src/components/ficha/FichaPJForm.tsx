import React, { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useApplicantsTestConnection } from '@/hooks/useApplicantsTestConnection';
import { toast } from '@/hooks/use-toast';
import { usePjFichasTestConnection } from '@/hooks/usePjFichasTestConnection';
import InputMask from 'react-input-mask';

const pjSchema = z.object({
  empresa: z.object({
    razao: z.string().min(1, 'Obrigatório'),
    cnpj: z.string().min(14, 'CNPJ inválido'),
    abertura: z.string().optional(),
    fantasia: z.string().optional(),
    fachada: z.string().optional(),
    area: z.string().optional(),
  }),
  endereco: z.object({
    end: z.string().optional(), n: z.string().optional(), compl: z.string().optional(),
    tipo: z.enum(['Comércio Térreo', 'Comercio Sala', 'Casa']).optional(), obsTipo: z.string().optional(),
    cep: z.string().optional(), bairro: z.string().optional(), tempo: z.string().optional(),
    estab: z.enum(['Própria', 'Alugada', 'Cecida', 'Outro']).optional(), obsEstab: z.string().optional(),
    endPs: z.string().optional(),
  }),
  contatos: z.object({
    tel: z.string().optional(), whats: z.string().optional(), fonesOs: z.string().optional(), email: z.string().email().optional().or(z.literal('')),
  }),
  docs: z.object({
    comprovante: z.enum(['Enviou', 'Não enviou']).optional(), tipo: z.enum(['Energia','Agua','Internet','Outro','XXX']).optional(), emNomeDe: z.string().optional(),
    possuiInternet: z.enum(['Sim','Não']).optional(), operadora: z.string().optional(), plano: z.string().optional(), valor: z.string().optional(),
    contratoSocial: z.enum(['Sim','Não']).optional(), obsContrato: z.string().optional(),
  }),
  socios: z.array(z.object({ nome: z.string().optional(), cpf: z.string().optional(), tel: z.string().optional() })).default([]),
  solicitacao: z.object({
    quem: z.string().optional(), meio: z.string().optional(), tel: z.string().optional(),
    // Permitir qualquer string para comportar a nova lista de planos
    planoAcesso: z.string().optional(), svaAvulso: z.string().optional(), venc: z.enum(['5','10','15','20','25']).optional(),
    protocolo: z.string().optional(), // Novo campo experimental
  }),
  info: z.object({
    relevantes: z.string().optional(), spc: z.string().optional(), outrasPs: z.string().optional(), mk: z.string().optional(), parecerAnalise: z.string().optional(),
  }),
});

export type PJFormValues = z.infer<typeof pjSchema>;

interface FichaPJFormProps {
  defaultValues?: Partial<PJFormValues>;
  onSubmit: (values: PJFormValues) => Promise<void> | void;
  onCancel?: () => void;
  afterMkSlot?: React.ReactNode;
  onFormChange?: (values: PJFormValues) => void;
  applicationId?: string;
}

export function FichaPJForm({ defaultValues, onSubmit, onCancel, afterMkSlot, onFormChange, applicationId }: FichaPJFormProps) {
  const form = useForm<PJFormValues>({ resolver: zodResolver(pjSchema), defaultValues });
  const changeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Plan selector state (PJ)
  const [pjPlanCTA, setPjPlanCTA] = React.useState<'CGNAT' | 'DIN' | 'FIXO'>('CGNAT');
  const pjPlans = React.useMemo(() => {
    const base = {
      CGNAT: [
        '100 Mega por R$59,90',
        '250 Mega por R$69,90',
        '500 Mega por R$79,90',
        '1000 Mega (1Gb) por R$99,90',
      ],
      DIN: [
        '100 Mega + IP Dinâmico por R$74,90',
        '250 Mega + IP Dinâmico por R$89,90',
        '500 Mega + IP Dinâmico por R$94,90',
        '1000 Mega (1Gb) + IP Dinâmico por R$114,90',
      ],
      FIXO: [
        '100 Mega + IP Fixo por R$259,90',
        '250 Mega + IP Fixo por R$269,90',
        '500 Mega + IP Fixo por R$279,90',
        '1000 Mega (1Gb) + IP Fixo por R$299,90',
      ],
    } as const;
    return base[pjPlanCTA];
  }, [pjPlanCTA]);
  
  // Hook para conectar com a tabela applicants_test
  const { saveSolicitacaoDataFor, saveAnaliseDataFor, ensureApplicantExists } = useApplicantsTestConnection();
  // Hook para conectar com a tabela pj_fichas_test
  const { saveCompanyData } = usePjFichasTestConnection();

  // Subscribe to form changes once and debounce notifications to the parent
  useEffect(() => {
    const subscription = form.watch((value) => {
      if (!onFormChange) return;
      if (changeTimer.current) clearTimeout(changeTimer.current);
      changeTimer.current = setTimeout(() => {
        onFormChange(value as PJFormValues);
      }, 250);
    });
    return () => {
      subscription.unsubscribe();
      if (changeTimer.current) {
        clearTimeout(changeTimer.current);
        changeTimer.current = null;
      }
    };
  }, [form, onFormChange]);
  const formatDateMaskAA = (value: string) => {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 6);
    const d = digits.slice(0, 2);
    const m = digits.slice(2, 4);
    const y = digits.slice(4, 6);
    let out = d;
    if (m) out += '/' + m;
    if (y) out += '/' + y;
    return out;
  };

  // Função wrapper para salvar dados na tabela teste
  const handleSubmit = async (values: PJFormValues) => {
    // Salvar dados na tabela applicants_test (experimental)
    if (applicationId) {
      try {
        // Buscar ou criar applicant na tabela teste
        const applicantTestId = await ensureApplicantExists({
          id: applicationId,
          cpf_cnpj: values.empresa.cnpj,
          person_type: 'PJ',
          nome: values.empresa.razao,
          telefone: values.contatos?.tel,
          email: values.contatos?.email,
        });
        if (!applicantTestId) {
          toast({ title: 'Erro ao garantir applicant de teste (PJ)', description: 'Não foi possível criar/obter applicants_test para esta ficha (PJ).', variant: 'destructive' });
          console.error('[PJ submit] ensureApplicantExists retornou null');
        }

        if (applicantTestId) {
          // Salvar dados de solicitação (via id explícito)
          try {
            await saveSolicitacaoDataFor(applicantTestId, {
              quem_solicitou: values.solicitacao?.quem,
              meio: values.solicitacao?.meio,
              protocolo_mk: values.solicitacao?.protocolo,
            });
          } catch (e: any) {
            toast({ title: 'Falha ao salvar Solicitação (PJ)', description: e?.message || String(e), variant: 'destructive' });
            console.error('[PJ submit] saveSolicitacaoDataFor erro:', e);
          }

          // Salvar dados de análise (via id explícito)
          try {
            await saveAnaliseDataFor(applicantTestId, {
              spc: values.info?.spc,
              pesquisador: values.info?.mk, // Usar mk como pesquisador
              plano_acesso: values.solicitacao?.planoAcesso,
              venc: values.solicitacao?.venc,
              sva_avulso: values.solicitacao?.svaAvulso,
            });
          } catch (e: any) {
            toast({ title: 'Falha ao salvar Análise (PJ)', description: e?.message || String(e), variant: 'destructive' });
            console.error('[PJ submit] saveAnaliseDataFor erro:', e);
          }

          // Salvar dados da empresa na tabela pj_fichas_test
          try {
            await saveCompanyData(applicantTestId, values as any);
          } catch (e: any) {
            toast({ title: 'Falha ao salvar PJ Ficha (teste)', description: e?.message || String(e), variant: 'destructive' });
            console.error('[PJ submit] saveCompanyData erro:', e);
          }
        }
      } catch (error) {
        console.error('❌ [PJ submit] Erro ao salvar dados experimentais PJ:', error);
        toast({ title: 'Erro ao salvar dados (teste)', description: (error as any)?.message || String(error), variant: 'destructive' });
        // Não bloquear o submit principal por erro experimental
      }
    }

    // Submeter formulário original
    await onSubmit(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="pj-form space-y-6 max-h-[70vh] overflow-y-auto pr-1">
        {/* Dados cadastrais básicos */}
        <section>
          <h3 className="text-base font-semibold mb-3">Dados cadastrais básicos</h3>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
            <FormField control={form.control} name="empresa.razao" render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Razão Social</FormLabel>
                <FormControl>
                  <Input 
                    {...field} 
                    placeholder="Nome completo da empresa"
                    className="placeholder:text-[#018942] placeholder:opacity-70"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="empresa.cnpj" render={({ field }) => (
              <FormItem>
                <FormLabel>CNPJ</FormLabel>
                <FormControl>
                  <InputMask
                    mask="99.999.999/9999-99"
                    value={field.value || ""}
                    onChange={field.onChange}
                    maskChar=" "
                  >
                    {(inputProps) => (
                      <Input
                        {...inputProps}
                        placeholder="00.000.000/0000-00"
                        className="placeholder:text-[#018942] placeholder:opacity-70"
                      />
                    )}
                  </InputMask>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="empresa.abertura" render={({ field }) => (
              <FormItem>
                <FormLabel>Abertura</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="dd/mm/aa"
                    value={field.value || ''}
                    onChange={(e) => field.onChange(formatDateMaskAA(e.target.value))}
                  />
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="empresa.fantasia" render={({ field }) => (
              <FormItem><FormLabel>Nome Fantasia</FormLabel><FormControl><Input {...field} placeholder="Digite aqui..." className="placeholder:text-[#018942] placeholder:opacity-70"/></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="empresa.fachada" render={({ field }) => (
              <FormItem><FormLabel>Nome na Fachada</FormLabel><FormControl><Input {...field} placeholder="Digite aqui..." className="placeholder:text-[#018942] placeholder:opacity-70"/></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="empresa.area" render={({ field }) => (
              <FormItem className="md:col-span-3"><FormLabel>Área de Atuação</FormLabel><FormControl><Input {...field} placeholder="Digite aqui..." className="placeholder:text-[#018942] placeholder:opacity-70"/></FormControl></FormItem>
            )} />
          </div>
        </section>

        {/* Endereço */}
        <section>
          <h3 className="text-base font-semibold mb-3">Endereço</h3>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
            <FormField control={form.control} name="endereco.end" render={({ field }) => (
              <FormItem className="md:col-span-2"><FormLabel>End</FormLabel><FormControl><Input {...field} placeholder="Ex: Rua das Flores" className="placeholder:text-[#018942] placeholder:opacity-70"/></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="endereco.n" render={({ field }) => (
              <FormItem><FormLabel>Nº</FormLabel><FormControl><Input {...field} placeholder="123" className="placeholder:text-[#018942] placeholder:opacity-70"/></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="endereco.compl" render={({ field }) => (
              <FormItem><FormLabel>Compl</FormLabel><FormControl><Input {...field} placeholder="Ex: Apt. 301" className="placeholder:text-[#018942] placeholder:opacity-70"/></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="endereco.tipo" render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Tipo</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="Comércio Térreo">Comércio Térreo</SelectItem>
                    <SelectItem value="Comercio Sala">Comercio Sala</SelectItem>
                    <SelectItem value="Casa">Casa</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="endereco.obsTipo" render={({ field }) => (
              <FormItem><FormLabel>Observações</FormLabel><FormControl><Input {...field} placeholder="Digite aqui..." className="placeholder:text-[#018942] placeholder:opacity-70"/></FormControl></FormItem>
            )} />

            <FormField control={form.control} name="endereco.cep" render={({ field }) => (
              <FormItem><FormLabel>CEP</FormLabel><FormControl><Input {...field} placeholder="Ex: 12345-678" className="placeholder:text-[#018942] placeholder:opacity-70"/></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="endereco.bairro" render={({ field }) => (
              <FormItem><FormLabel>Bairro</FormLabel><FormControl><Input {...field} placeholder="Bairro" className="placeholder:text-[#018942] placeholder:opacity-70"/></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="endereco.tempo" render={({ field }) => (
              <FormItem><FormLabel>Tempo</FormLabel><FormControl><Input {...field} placeholder="Ex: 2 anos" className="placeholder:text-[#018942] placeholder:opacity-70"/></FormControl></FormItem>
            )} />

            <FormField control={form.control} name="endereco.estab" render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Estabelecimento</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="Própria">Própria</SelectItem>
                    <SelectItem value="Alugada">Alugada</SelectItem>
                    <SelectItem value="Cecida">Cecida</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="endereco.obsEstab" render={({ field }) => (
              <FormItem><FormLabel>Observações</FormLabel><FormControl><Input {...field} placeholder="Digite aqui..." className="placeholder:text-[#018942] placeholder:opacity-70"/></FormControl></FormItem>
            )} />

            <FormField control={form.control} name="endereco.endPs" render={({ field }) => (
              <FormItem className="md:col-span-3">
                <FormLabel>End no PS</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Ex: Rua das Flores, 123 - Apt 301" className="bg-red-500/10 border border-red-500 placeholder:text-[#018942] placeholder:opacity-70" />
                </FormControl>
              </FormItem>
            )} />
          </div>
        </section>

        {/* Contatos e Documentos */}
        <section>
          <h3 className="text-base font-semibold mb-3">Contatos & Documentos</h3>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
            <FormField control={form.control} name="contatos.tel" render={({ field }) => (
              <FormItem>
                <FormLabel>Tel</FormLabel>
                <FormControl>
                  <InputMask
                    mask="(99) 99999-9999"
                    value={field.value || ""}
                    onChange={field.onChange}
                    maskChar=" "
                  >
                    {(inputProps) => (
                      <Input
                        {...inputProps}
                        placeholder="(11) 99999-9999"
                        className="placeholder:text-[#018942] placeholder:opacity-70"
                      />
                    )}
                  </InputMask>
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="contatos.whats" render={({ field }) => (
              <FormItem>
                <FormLabel>Whats</FormLabel>
                <FormControl>
                  <InputMask
                    mask="(99) 99999-9999"
                    value={field.value || ""}
                    onChange={field.onChange}
                    maskChar=" "
                  >
                    {(inputProps) => (
                      <Input
                        {...inputProps}
                        placeholder="(11) 99999-9999"
                        className="placeholder:text-[#018942] placeholder:opacity-70"
                      />
                    )}
                  </InputMask>
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="contatos.fonesOs" render={({ field }) => (
              <FormItem>
                <FormLabel>Fones no PS</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Ex: (11) 99999-0000"
                    className="bg-red-500/10 border border-red-500 placeholder:text-[#018942] placeholder:opacity-70"
                  />
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="contatos.email" render={({ field }) => (
              <FormItem className="md:col-span-3">
                <FormLabel>E-mail</FormLabel>
                <FormControl>
                  <Input 
                    type="email" 
                    {...field} 
                    placeholder="contato@empresa.com"
                    className="placeholder:text-[#018942] placeholder:opacity-70"
                  />
                </FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="docs.comprovante" render={({ field }) => (
              <FormItem><FormLabel>Comprovante</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Enviou">Enviou</SelectItem><SelectItem value="Não enviou">Não enviou</SelectItem></SelectContent></Select></FormItem>
            )} />
            <FormField control={form.control} name="docs.tipo" render={({ field }) => (
              <FormItem><FormLabel>Tipo</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Energia">Energia</SelectItem><SelectItem value="Agua">Água</SelectItem><SelectItem value="Internet">Internet</SelectItem><SelectItem value="Outro">Outro</SelectItem><SelectItem value="XXX">XXX</SelectItem></SelectContent></Select></FormItem>
            )} />
            <FormField control={form.control} name="docs.emNomeDe" render={({ field }) => (<FormItem><FormLabel>Em nome de</FormLabel><FormControl><Input {...field} placeholder="Digite aqui..." className="placeholder:text-[#018942] placeholder:opacity-70"/></FormControl></FormItem>)} />

            <FormField control={form.control} name="docs.possuiInternet" render={({ field }) => (
              <FormItem><FormLabel>Possui Internet</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Sim">Sim</SelectItem><SelectItem value="Não">Não</SelectItem></SelectContent></Select></FormItem>
            )} />
            <FormField control={form.control} name="docs.operadora" render={({ field }) => (<FormItem><FormLabel>Operadora</FormLabel><FormControl><Input {...field} placeholder="Ex: Vivo" className="placeholder:text-[#018942] placeholder:opacity-70"/></FormControl></FormItem>)} />
            <FormField control={form.control} name="docs.plano" render={({ field }) => (<FormItem><FormLabel>Plano</FormLabel><FormControl><Input {...field} placeholder="Ex: 300MB" className="placeholder:text-[#018942] placeholder:opacity-70"/></FormControl></FormItem>)} />
            <FormField control={form.control} name="docs.valor" render={({ field }) => (<FormItem><FormLabel>Valor</FormLabel><FormControl><Input {...field} placeholder="Ex: R$ 99,90" className="placeholder:text-[#018942] placeholder:opacity-70"/></FormControl></FormItem>)} />

            <FormField control={form.control} name="docs.contratoSocial" render={({ field }) => (
              <FormItem className="md:col-span-2"><FormLabel>Contrato Social</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Sim">Sim</SelectItem><SelectItem value="Não">Não</SelectItem></SelectContent></Select></FormItem>
            )} />
            <FormField control={form.control} name="docs.obsContrato" render={({ field }) => (<FormItem><FormLabel>Observações</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
          </div>
        </section>

        {/* Sócios */}
        <section>
          <h3 className="text-base font-semibold mb-3">Sócios</h3>
          {[0,1,2].map((idx) => (
            <div key={idx} className="grid gap-3 grid-cols-1 md:grid-cols-3 mb-2">
              <FormField control={form.control} name={`socios.${idx}.nome` as const} render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl><Input {...field} placeholder="Digite aqui..." className="placeholder:text-[#018942] placeholder:opacity-70"/></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name={`socios.${idx}.cpf` as const} render={({ field }) => (
                <FormItem>
                  <FormLabel>CPF</FormLabel>
                  <FormControl>
                    <InputMask
                      mask="999.999.999-99"
                      value={field.value || ""}
                      onChange={field.onChange}
                      maskChar=" "
                    >
                      {(inputProps) => (
                        <Input
                          {...inputProps}
                          placeholder="000.000.000-00"
                          className="placeholder:text-[#018942] placeholder:opacity-70"
                        />
                      )}
                    </InputMask>
                  </FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name={`socios.${idx}.tel` as const} render={({ field }) => (
                <FormItem>
                  <FormLabel>Tel</FormLabel>
                  <FormControl><Input {...field} placeholder="Ex: (11) 99999-0000" className="placeholder:text-[#018942] placeholder:opacity-70"/></FormControl>
                </FormItem>
              )} />
            </div>
          ))}
        </section>

        {/* Solicitação */}
        <section>
          <h3 className="text-base font-semibold mb-3">Solicitação</h3>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-4">
            <FormField control={form.control} name="solicitacao.quem" render={({ field }) => (
              <FormItem>
                <FormLabel>Quem solicitou</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Digite aqui..." className="placeholder:text-[#018942] placeholder:opacity-70"/>
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="solicitacao.meio" render={({ field }) => (
              <FormItem>
                <FormLabel>Meio</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Ligação">Ligação</SelectItem>
                    <SelectItem value="Presencial">Presencial</SelectItem>
                    <SelectItem value="Whatsapp">Whatsapp</SelectItem>
                    <SelectItem value="Whats - Uber">Whats - Uber</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="solicitacao.tel" render={({ field }) => (
              <FormItem>
                <FormLabel>Tel</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Ex: (11) 99999-0000" className="placeholder:text-[#018942] placeholder:opacity-70"/>
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="solicitacao.protocolo" render={({ field }) => (
              <FormItem>
                <FormLabel>Protocolo MK</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Número do protocolo" className="placeholder:text-[#018942] placeholder:opacity-70"/>
                </FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="solicitacao.planoAcesso" render={({ field }) => (
              <FormItem>
                <FormLabel>Plano de Acesso</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="text-[#018942] placeholder:text-[#018942]"><SelectValue placeholder="Selecionar plano" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {/* CTAs verdes dentro do dropdown */}
                    <div className="flex gap-2 px-2 py-1 sticky top-0 bg-white/95 border-b">
                      {([
                        { key: 'CGNAT', label: 'CGNAT' },
                        { key: 'DIN', label: 'DINÂMICO' },
                        { key: 'FIXO', label: 'FIXO' },
                      ] as const).map(({ key, label }) => {
                        const active = pjPlanCTA === key;
                        return (
                          <Button
                            key={key}
                            type="button"
                            variant="outline"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={(e) => { e.stopPropagation(); setPjPlanCTA(key); field.onChange(undefined); }}
                            className={
                              (active
                                ? 'bg-[#018942] text-white border-[#018942] hover:bg-[#018942]/90 '
                                : 'border-[#018942] text-[#018942] hover:bg-[#018942]/10 ') +
                              'h-7 px-2 text-xs rounded-[30px]'
                            }
                            size="sm"
                          >
                            {label}
                          </Button>
                        );
                      })}
                    </div>
                    {pjPlans.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="solicitacao.svaAvulso" render={({ field }) => (
              <FormItem>
                <FormLabel>SVA Avulso</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="A definir" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="A definir">A definir</SelectItem>
                    <SelectItem value="MZ TV+ (MZPLAY PLUS - ITTV): R$29,90 (01 TELA)">MZ TV+ (MZPLAY PLUS - ITTV): R$29,90 (01 TELA)</SelectItem>
                    <SelectItem value="DEZZER: R$15,00">DEZZER: R$15,00</SelectItem>
                    <SelectItem value="MZ CINE-PLAY: R$19,90">MZ CINE-PLAY: R$19,90</SelectItem>
                    <SelectItem value="SETUP BOX MZNET: R$100,00">SETUP BOX MZNET: R$100,00</SelectItem>
                    <SelectItem value="01 WI-FI EXTEND (SEM FIO): R$25,90">01 WI-FI EXTEND (SEM FIO): R$25,90</SelectItem>
                    <SelectItem value="02 WI-FI EXTEND (SEM FIO): R$49,90">02 WI-FI EXTEND (SEM FIO): R$49,90</SelectItem>
                    <SelectItem value="03 WI-FI EXTEND (SEM FIO): R$74,90">03 WI-FI EXTEND (SEM FIO): R$74,90</SelectItem>
                    <SelectItem value="01 WI-FI EXTEND (CABEADO): R$35,90">01 WI-FI EXTEND (CABEADO): R$35,90</SelectItem>
                    <SelectItem value="02 WI-FI EXTEND (CABEADO): R$69,90">02 WI-FI EXTEND (CABEADO): R$69,90</SelectItem>
                    <SelectItem value="03 WI-FI EXTEND (CABEADO): R$100,00">03 WI-FI EXTEND (CABEADO): R$100,00</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="solicitacao.venc" render={({ field }) => (
              <FormItem>
                <FormLabel>Venc</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="text-[#018942] placeholder:text-[#018942]"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {['5','10','15','20','25'].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
          </div>
        </section>

        {/* Text Areas equivalentes PF */}
        <section>
          <h3 className="text-base font-semibold mb-3">Informações relevantes da solicitação</h3>
          <FormField control={form.control} name="info.relevantes" render={({ field }) => (
            <FormItem>
              <FormControl><Textarea rows={4} {...field} placeholder="Digite aqui..." className="placeholder:text-[#018942] placeholder:opacity-70"/></FormControl>
            </FormItem>
          )} />
        </section>
        <section>
          <h3 className="text-base font-semibold mb-3">Consulta SPC/Serasa</h3>
          <FormField control={form.control} name="info.spc" render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea rows={4} {...field} placeholder="Digite aqui..." className="bg-red-500/10 border border-red-500 placeholder:text-[#018942] placeholder:opacity-70" />
              </FormControl>
            </FormItem>
          )} />
        </section>
        <section>
          <h3 className="text-base font-semibold mb-3">Outras informações relevantes do PS</h3>
          <FormField control={form.control} name="info.outrasPs" render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea rows={4} {...field} placeholder="Digite aqui..." className="bg-red-500/10 border border-red-500 placeholder:text-[#018942] placeholder:opacity-70" />
              </FormControl>
            </FormItem>
          )} />
        </section>
        <section>
          <h3 className="text-base font-semibold mb-3">Informações relevantes do MK</h3>
          <FormField control={form.control} name="info.mk" render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea rows={4} {...field} placeholder="Digite aqui..." className="bg-red-500/10 border border-red-500 placeholder:text-[#018942] placeholder:opacity-70" />
              </FormControl>
            </FormItem>
          )} />
        </section>

        {/* Campos duplicados de Solicitação removidos conforme solicitação */}

        {afterMkSlot}

        <div className="flex justify-end gap-2 pt-4">
          {onCancel && <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>}
          <Button type="submit" className="bg-[#018942] text-white">Salvar ficha PJ</Button>
        </div>
      </form>
    </Form>
  );
}
