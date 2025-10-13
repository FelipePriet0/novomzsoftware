import React, { useState, useEffect } from 'react';
import { useApplicantsTest } from '@/hooks/useApplicantsTest';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ApplicantsTestExampleProps {
  applicantId?: string;
}

export function ApplicantsTestExample({ applicantId }: ApplicantsTestExampleProps) {
  const { 
    applicant, 
    isLoading, 
    error, 
    updateApplicant,
    updateSolicitacaoFields,
    updateAnaliseFields 
  } = useApplicantsTest(applicantId);

  // Estados locais para os campos
  const [quemSolicitou, setQuemSolicitou] = useState('');
  const [meio, setMeio] = useState('');
  const [protocoloMk, setProtocoloMk] = useState('');
  const [spc, setSpc] = useState('');
  const [pesquisador, setPesquisador] = useState('');
  const [planoAcesso, setPlanoAcesso] = useState('');
  const [venc, setVenc] = useState('');
  const [svaAvulso, setSvaAvulso] = useState('');

  // Carregar dados quando applicant mudar
  useEffect(() => {
    if (applicant) {
      setQuemSolicitou(applicant.quem_solicitou || '');
      setMeio(applicant.meio || '');
      setProtocoloMk(applicant.protocolo_mk || '');
      setSpc(applicant.spc || '');
      setPesquisador(applicant.pesquisador || '');
      setPlanoAcesso(applicant.plano_acesso || '');
      setVenc(applicant.venc || '');
      setSvaAvulso(applicant.sva_avulso || '');
    }
  }, [applicant]);

  // Função para salvar campos de solicitação
  const handleSaveSolicitacao = async () => {
    const success = await updateSolicitacaoFields({
      quem_solicitou: quemSolicitou,
      meio: meio,
      protocolo_mk: protocoloMk,
    });
    
    if (success) {
      console.log('✅ Campos de solicitação salvos com sucesso!');
    }
  };

  // Função para salvar campos de análise
  const handleSaveAnalise = async () => {
    const success = await updateAnaliseFields({
      spc: spc,
      pesquisador: pesquisador,
      plano_acesso: planoAcesso,
      venc: venc,
      sva_avulso: svaAvulso,
    });
    
    if (success) {
      console.log('✅ Campos de análise salvos com sucesso!');
    }
  };

  if (isLoading) {
    return <div className="p-4">Carregando dados do applicant...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Erro: {error}</div>;
  }

  if (!applicant) {
    return <div className="p-4">Nenhum applicant encontrado.</div>;
  }

  return (
    <div className="space-y-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Applicant Test - {applicant.primary_name}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Tipo: {applicant.person_type} | CPF/CNPJ: {applicant.cpf_cnpj}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Campos de Solicitação */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">📋 Campos de Solicitação</h3>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="quem-solicitou">Quem Solicitou</Label>
                <Input
                  id="quem-solicitou"
                  value={quemSolicitou}
                  onChange={(e) => setQuemSolicitou(e.target.value)}
                  placeholder="Nome do colaborador"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meio">Meio</Label>
                <Select value={meio} onValueChange={setMeio}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ligação">Ligação</SelectItem>
                    <SelectItem value="Whatsapp">Whatsapp</SelectItem>
                    <SelectItem value="Presencial">Presencial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="protocolo">Protocolo MK</Label>
                <Input
                  id="protocolo"
                  value={protocoloMk}
                  onChange={(e) => setProtocoloMk(e.target.value)}
                  placeholder="Número do protocolo"
                />
              </div>
            </div>
            <Button onClick={handleSaveSolicitacao} className="bg-blue-600 hover:bg-blue-700">
              Salvar Campos de Solicitação
            </Button>
          </div>

          {/* Campos de Análise */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">🔍 Campos de Análise</h3>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="plano-acesso">Plano de Acesso</Label>
                <Input
                  id="plano-acesso"
                  value={planoAcesso}
                  onChange={(e) => setPlanoAcesso(e.target.value)}
                  placeholder="Plano escolhido"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="venc">Dia de Vencimento</Label>
                <Select value={venc} onValueChange={setVenc}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="15">15</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sva-avulso">SVA Avulso</Label>
                <Select value={svaAvulso} onValueChange={setSvaAvulso}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sim">Sim</SelectItem>
                    <SelectItem value="Não">Não</SelectItem>
                    <SelectItem value="A definir">A definir</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="spc">Informações SPC</Label>
                <Textarea
                  id="spc"
                  value={spc}
                  onChange={(e) => setSpc(e.target.value)}
                  placeholder="Informações do SPC"
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pesquisador">Informações do Pesquisador</Label>
                <Textarea
                  id="pesquisador"
                  value={pesquisador}
                  onChange={(e) => setPesquisador(e.target.value)}
                  placeholder="Informações do pesquisador"
                  rows={4}
                />
              </div>
            </div>
            <Button onClick={handleSaveAnalise} className="bg-green-600 hover:bg-green-700">
              Salvar Campos de Análise
            </Button>
          </div>

          {/* Dados Atuais */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">📊 Dados Atuais</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <pre className="text-sm">
                {JSON.stringify(applicant, null, 2)}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
