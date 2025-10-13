import React from 'react';
import { usePfFichasTest } from '@/hooks/usePfFichasTest';
import { usePfFichasTestConnection } from '@/hooks/usePfFichasTestConnection';

interface PfFichasTestExampleProps {
  applicantId?: string;
}

export default function PfFichasTestExample({ applicantId }: PfFichasTestExampleProps) {
  const { pfFicha, isLoading, error } = usePfFichasTest();
  const { savePersonalData } = usePfFichasTestConnection();

  const handleTestSave = async () => {
    if (!applicantId) {
      console.error('❌ [PfFichasTestExample] applicantId é obrigatório para teste');
      return;
    }

    try {
      // Dados de teste
      const testData = {
        cliente: {
          nome: 'João Silva Teste',
          cpf: '123.456.789-00',
          nasc: '15/05/1990',
          tel: '(11) 99999-9999',
          whats: '(11) 99999-9999',
          naturalidade: 'São Paulo',
          uf: 'SP',
          email: 'joao@teste.com',
        },
        endereco: {
          end: 'Rua das Flores, 123',
          n: '123',
          bairro: 'Centro',
          cond: 'Não',
          tempo: '5 anos',
          tipoMoradia: 'Casa própria',
        },
        relacoes: {
          temInternetFixa: 'Sim',
          empresaInternet: 'Vivo',
          planoInternet: '300MB',
          valorInternet: 'R$ 99,90',
        },
        empregoRenda: {
          profissao: 'Desenvolvedor',
          empresa: 'Tech Corp',
          vinculo: 'CLT',
        },
        filiacao: {
          pai: {
            nome: 'José Silva',
            telefone: '(11) 88888-8888',
          },
          mae: {
            nome: 'Maria Silva',
            telefone: '(11) 77777-7777',
          },
        },
        referencias: {
          ref1: {
            nome: 'Pedro Santos',
            parentesco: 'Amigo',
            telefone: '(11) 66666-6666',
          },
          ref2: {
            nome: 'Ana Costa',
            parentesco: 'Colega',
            telefone: '(11) 55555-5555',
          },
        },
        outras: {
          planoEscolhido: 'Plano Premium',
          diaVencimento: '15',
        },
        infoRelevantes: {
          info: 'Cliente interessado em plano completo',
          infoMk: 'Bom pagador',
        },
      };

      await savePersonalData(applicantId, testData);
      console.log('✅ [PfFichasTestExample] Dados de teste salvos com sucesso!');
    } catch (error) {
      console.error('❌ [PfFichasTestExample] Erro ao salvar dados de teste:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 border rounded-lg">
        <h3 className="text-lg font-semibold mb-2">PF Fichas Test</h3>
        <p>Carregando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border rounded-lg border-red-200 bg-red-50">
        <h3 className="text-lg font-semibold mb-2 text-red-800">PF Fichas Test</h3>
        <p className="text-red-600">Erro: {error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">PF Fichas Test</h3>
      
      {pfFicha ? (
        <div className="space-y-2">
          <p><strong>ID:</strong> {pfFicha.id}</p>
          <p><strong>Applicant ID:</strong> {pfFicha.applicant_id}</p>
          <p><strong>Data de Nascimento:</strong> {pfFicha.birth_date || 'Não informado'}</p>
          <p><strong>Naturalidade:</strong> {pfFicha.naturalidade || 'Não informado'}</p>
          <p><strong>Profissão:</strong> {pfFicha.profissao || 'Não informado'}</p>
          <p><strong>Empresa Internet:</strong> {pfFicha.empresa_internet || 'Não informado'}</p>
          <p><strong>Pai:</strong> {pfFicha.pai_nome || 'Não informado'}</p>
          <p><strong>Mãe:</strong> {pfFicha.mae_nome || 'Não informado'}</p>
          <p><strong>Criado em:</strong> {new Date(pfFicha.created_at).toLocaleString()}</p>
          <p><strong>Atualizado em:</strong> {new Date(pfFicha.updated_at).toLocaleString()}</p>
        </div>
      ) : (
        <p>Nenhuma PF Ficha carregada</p>
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
