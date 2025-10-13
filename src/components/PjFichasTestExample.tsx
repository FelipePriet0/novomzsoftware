import React from 'react';
import { usePjFichasTest } from '@/hooks/usePjFichasTest';
import { usePjFichasTestConnection } from '@/hooks/usePjFichasTestConnection';

interface PjFichasTestExampleProps {
  applicantId?: string;
}

export default function PjFichasTestExample({ applicantId }: PjFichasTestExampleProps) {
  const { pjFicha, isLoading, error } = usePjFichasTest();
  const { saveCompanyData } = usePjFichasTestConnection();

  const handleTestSave = async () => {
    if (!applicantId) {
      console.error('❌ [PjFichasTestExample] applicantId é obrigatório para teste');
      return;
    }

    try {
      // Dados de teste
      const testData = {
        empresa: {
          razao: 'Empresa Teste LTDA',
          cnpj: '12.345.678/0001-90',
          abertura: '01/01/2020',
          fantasia: 'Teste Corp',
          fachada: 'Teste Corp',
          area: 'Tecnologia',
        },
        endereco: {
          tipo: 'Comércio Térreo',
          obsTipo: 'Loja comercial',
          tempo: '3 anos',
          estab: 'Própria',
          obsEstab: 'Imóvel próprio',
          endPs: 'Endereço pessoal do sócio',
        },
        contatos: {
          fonesOs: '(11) 99999-9999',
        },
        docs: {
          comprovante: 'Enviou',
          tipo: 'Energia',
          emNomeDe: 'Empresa Teste LTDA',
          possuiInternet: 'Sim',
          operadora: 'Vivo',
          plano: '300MB',
          valor: 'R$ 149,90',
          contratoSocial: 'Sim',
          obsContrato: 'Contrato atualizado',
        },
        socios: [
          {
            nome: 'João Silva',
            cpf: '123.456.789-00',
            tel: '(11) 99999-9999',
          },
          {
            nome: 'Maria Santos',
            cpf: '987.654.321-00',
            tel: '(11) 88888-8888',
          },
        ],
        solicitacao: {
          protocolo: 'PROT-2024-001',
        },
        info: {
          relevantes: 'Empresa em crescimento, boa situação financeira',
          outrasPs: 'Contador: Pedro Costa',
          parecerAnalise: 'Aprovado para plano premium',
        },
      };

      await saveCompanyData(applicantId, testData);
      console.log('✅ [PjFichasTestExample] Dados de teste salvos com sucesso!');
    } catch (error) {
      console.error('❌ [PjFichasTestExample] Erro ao salvar dados de teste:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 border rounded-lg">
        <h3 className="text-lg font-semibold mb-2">PJ Fichas Test</h3>
        <p>Carregando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border rounded-lg border-red-200 bg-red-50">
        <h3 className="text-lg font-semibold mb-2 text-red-800">PJ Fichas Test</h3>
        <p className="text-red-600">Erro: {error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">PJ Fichas Test</h3>
      
      {pjFicha ? (
        <div className="space-y-2">
          <p><strong>ID:</strong> {pjFicha.id}</p>
          <p><strong>Applicant ID:</strong> {pjFicha.applicant_id}</p>
          <p><strong>Razão Social:</strong> {pjFicha.razao_social || 'Não informado'}</p>
          <p><strong>CNPJ:</strong> {pjFicha.cnpj || 'Não informado'}</p>
          <p><strong>Nome Fantasia:</strong> {pjFicha.nome_fantasia || 'Não informado'}</p>
          <p><strong>Tipo Imóvel:</strong> {pjFicha.tipo_imovel || 'Não informado'}</p>
          <p><strong>Operadora Internet:</strong> {pjFicha.operadora_internet || 'Não informado'}</p>
          <p><strong>Protocolo MK:</strong> {pjFicha.protocolo_mk || 'Não informado'}</p>
          <p><strong>Sócios:</strong> {pjFicha.socios ? `${pjFicha.socios.length} sócios` : 'Não informado'}</p>
          <p><strong>Criado em:</strong> {new Date(pjFicha.created_at).toLocaleString()}</p>
          <p><strong>Atualizado em:</strong> {new Date(pjFicha.updated_at).toLocaleString()}</p>
        </div>
      ) : (
        <p>Nenhuma PJ Ficha carregada</p>
      )}

      <div className="mt-4">
        <button
          onClick={handleTestSave}
          disabled={!applicantId}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          {applicantId ? 'Testar Salvamento' : 'Applicant ID necessário'}
        </button>
      </div>
    </div>
  );
}
