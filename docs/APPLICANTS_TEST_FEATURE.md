# 🚀 Funcionalidade Experimental: Padronização de Dados (Applicants Test)

## 📋 Visão Geral

Esta funcionalidade experimental implementa a **padronização e centralização** de informações comuns aos cadastros PF e PJ em uma tabela unificada (`applicants_test`), garantindo consistência no banco de dados e melhor organização do fluxo de análise.

## 🎯 Objetivos

- ✅ Centralizar dados comuns entre PF e PJ
- ✅ Garantir consistência no banco de dados
- ✅ Simplificar futuras integrações entre sistemas
- ✅ Manter informações específicas nas tabelas `pf_fichas` e `pj_fichas`

## 🗄️ Estrutura do Banco de Dados

### Tabela `applicants_test`

```sql
-- Campos existentes (da tabela applicants original)
id, person_type, primary_name, cpf_cnpj, phone, email, street, number, 
district, city, cep, complement, uf, created_at, updated_at

-- NOVOS CAMPOS ADICIONADOS
quem_solicitou      text  -- Nome do colaborador que iniciou a solicitação
meio                text  -- Meio de origem (Ligação, Whatsapp, Presencial)
protocolo_mk        text  -- Número do protocolo do MK Solutions

-- CAMPOS CONECTADOS COM FRONTEND
spc                 text  -- Informações SPC
pesquisador         text  -- Informações do Pesquisador
plano_acesso        text  -- Plano escolhido
venc                text  -- Dia de vencimento
sva_avulso          text  -- SVA Avulso
```

## 🎨 Interface do Usuário

### Novos Campos Adicionados

Os **3 novos campos** foram adicionados nos formulários PF e PJ, logo após os campos "SVA Avulso" e "Carnê impresso":

#### 📍 Localização no Frontend:
- **PF**: `NovaFichaComercialForm.tsx` - Seção "10. Outras informações"
- **PJ**: `FichaPJForm.tsx` - Seção "Solicitação"

#### 🔧 Campos Implementados:
1. **Quem Solicitou** (Input text) → Coluna: `quem_solicitou`
2. **Protocolo MK** (Input text) → Coluna: `protocolo_mk`  
3. **Meio** (Dropdown) → Coluna: `meio`
   - Opções: Ligação, Whatsapp, Presencial

### Campos Existentes Conectados

Os seguintes campos já existentes no frontend foram mapeados para as colunas do banco:

| Campo Frontend | Coluna Banco | Localização |
|---|---|---|
| Informações SPC | `spc` | PF: Seção SPC, PJ: Seção SPC |
| Informações do Pesquisador | `pesquisador` | PF: Seção Pesquisador |
| Plano escolhido | `plano_acesso` | PF: Seção Outras, PJ: Plano de Acesso |
| Dia de vencimento | `venc` | PF: Seção Outras, PJ: Seção Solicitação |
| SVA Avulso | `sva_avulso` | PF: Seção Outras, PJ: Seção Solicitação |

## 🛠️ Implementação Técnica

### Hook Experimental: `useApplicantsTest`

```typescript
import { useApplicantsTest } from '@/hooks/useApplicantsTest';

const { 
  applicant, 
  isLoading, 
  error, 
  updateApplicant,
  updateSolicitacaoFields,
  updateAnaliseFields 
} = useApplicantsTest(applicantId);
```

#### Funcionalidades:
- ✅ Carregar dados do applicant
- ✅ Atualizar campos de solicitação
- ✅ Atualizar campos de análise
- ✅ Atualização otimista (UI instantânea)
- ✅ Tratamento de erros

### Componente de Exemplo

O arquivo `src/components/ApplicantsTestExample.tsx` demonstra como usar a funcionalidade:

```typescript
<ApplicantsTestExample applicantId="uuid-do-applicant" />
```

## 🔄 Fluxo de Dados

### 1. Criação de Applicant
```typescript
const newApplicant = await createApplicant({
  person_type: 'PF',
  primary_name: 'João Silva',
  cpf_cnpj: '12345678901',
  quem_solicitou: 'Felipe Gonçalves',
  meio: 'Whatsapp',
  protocolo_mk: 'MK2025001'
});
```

### 2. Atualização de Campos
```typescript
// Campos de solicitação
await updateSolicitacaoFields({
  quem_solicitou: 'Maria Santos',
  meio: 'Presencial',
  protocolo_mk: 'MK2025002'
});

// Campos de análise
await updateAnaliseFields({
  spc: 'SPC Limpo',
  pesquisador: 'Analista XPTO',
  plano_acesso: 'Plano 100MB',
  venc: '15',
  sva_avulso: 'Sim'
});
```

## 🧪 Como Testar

### 1. Verificar Tabela Teste
```sql
SELECT * FROM applicants_test;
```

### 2. Usar Componente de Exemplo
```typescript
// Em qualquer página/componente
import { ApplicantsTestExample } from '@/components/ApplicantsTestExample';

// Usar com um ID existente
<ApplicantsTestExample applicantId="50858c90-1eec-4c55-9895-781eba1c6657" />
```

### 3. Testar nos Formulários
- Abrir modal de ficha PF ou PJ
- Preencher os novos campos
- Verificar se os dados são salvos na tabela `applicants_test`

## 🚀 Próximos Passos

### Etapa 3: Hook Experimental ✅
- [x] Criado `useApplicantsTest` hook
- [x] Implementadas funções CRUD
- [x] Atualização otimista
- [x] Tratamento de erros

### Etapa 4: UI Experimental ✅  
- [x] Adicionados 3 novos campos nos formulários PF e PJ
- [x] Conectados campos existentes com colunas do banco
- [x] Criado componente de exemplo

### Etapa 5: Teste Completo 🔄
- [ ] Testar fluxo completo de criação/edição
- [ ] Validar sincronização de dados
- [ ] Testar performance
- [ ] Validar RLS policies

### Etapa 6: Migração para Produção 📋
- [ ] Backup da tabela `applicants` real
- [ ] Adicionar colunas na tabela real
- [ ] Migrar dados existentes
- [ ] Atualizar hooks para usar tabela real
- [ ] Remover tabela teste

## 🔒 Segurança

### RLS Policies Implementadas
```sql
-- Mesmas políticas da tabela applicants original
applicants_test_select_all
applicants_test_insert_vendedor_gestor  
applicants_test_update_vendedor_gestor
applicants_test_delete_gestor
```

### Validações
- ✅ Autenticação obrigatória
- ✅ Permissões por role (vendedor/gestor)
- ✅ Validação de tipos (Zod schemas)
- ✅ Tratamento de erros robusto

## 📊 Benefícios

### Para o Sistema
- 🎯 **Consistência**: Dados padronizados entre PF e PJ
- 🔄 **Integração**: Facilita futuras integrações
- 📈 **Escalabilidade**: Estrutura preparada para crescimento
- 🛡️ **Manutenibilidade**: Código organizado e bem estruturado

### Para o Usuário
- ⚡ **Performance**: UI responsiva com atualização otimista
- 🎨 **UX**: Interface intuitiva e familiar
- 🔒 **Segurança**: Dados protegidos por RLS
- 📱 **Compatibilidade**: Funciona em todos os dispositivos

---

## 🎉 Status Atual

**✅ FUNCIONALIDADE EXPERIMENTAL COMPLETA!**

A funcionalidade está 100% implementada e pronta para testes. Todos os componentes foram criados seguindo as melhores práticas e padrões do projeto.

**Próximo passo**: Testar a funcionalidade e validar se atende aos requisitos antes da migração para produção.
