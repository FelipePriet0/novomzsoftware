# ðŸ› CORREÃ‡ÃƒO - Pareceres Deletados Reaparecendo

## ðŸ“‹ PROBLEMA IDENTIFICADO

**Sintoma:** Quando vocÃª excluÃ­a um parecer e depois criava um novo, os pareceres **antigos excluÃ­dos voltavam a aparecer** junto com o novo.

## ðŸ” CAUSA RAIZ

### O que estava acontecendo:

1. UsuÃ¡rio **exclui** um parecer (soft delete - marca como `deleted: true`)
2. Parecer Ã© **salvo no banco** com `deleted: true`
3. A **UI remove** o parecer da lista local (`setPareceres(prev => prev.filter(...))`)
4. UsuÃ¡rio **adiciona** um novo parecer
5. O cÃ³digo **busca TODOS os pareceres** do banco (incluindo deletados)
6. CÃ³digo faz: `const next = [...currentNotes, newParecer]` âŒ
7. O `currentNotes` **contÃ©m pareceres deletados**!
8. A UI **mostra os deletados** novamente ðŸ˜±

### CÃ³digo problemÃ¡tico:

```typescript
// âŒ ANTES (ERRADO):
const { data } = await supabase
  .from('kanban_cards')
  .select('reanalysis_notes')
  .eq('id', cardId)
  .maybeSingle();

let currentNotes: any[] = [];
if (Array.isArray(raw)) currentNotes = raw;

const next = [...currentNotes, newParecer];  // â† Inclui deletados!
setPareceres(next);  // â† UI mostra deletados de novo! âŒ
```

## âœ… SOLUÃ‡ÃƒO IMPLEMENTADA

### EstratÃ©gia:

1. **Banco de dados**: Manter **TODOS** os pareceres (incluindo deletados) para histÃ³rico
2. **UI**: Mostrar **APENAS** pareceres ativos (filtrar `deleted: true`)

### CÃ³digo corrigido:

```typescript
// âœ… DEPOIS (CORRETO):
const { data } = await supabase
  .from('kanban_cards')
  .select('reanalysis_notes')
  .eq('id', cardId)
  .maybeSingle();

let currentNotes: any[] = [];
if (Array.isArray(raw)) currentNotes = raw;

// âœ… IMPORTANTE: Manter pareceres deletados no banco (soft delete) para histÃ³rico
// mas adicionar o novo parecer Ã  lista completa
const next = [...currentNotes, newParecer];

// âœ… Para a UI, mostrar apenas pareceres ativos (sem deleted)
const activePareceres = next.filter((p: any) => !p.deleted);
setPareceres(activePareceres);  // â† UI mostra sÃ³ ativos! âœ…

// âœ… Salvar lista COMPLETA (incluindo deletados para histÃ³rico)
const serialized = JSON.stringify(next);  // â† Banco mantÃ©m histÃ³rico! âœ…
await supabase.update({ reanalysis_notes: serialized });
```

## ðŸ”§ ARQUIVOS CORRIGIDOS

### 1. `src/components/ui/ModalEditarFicha.tsx`

**FunÃ§Ãµes corrigidas:**
- âœ… `handleCreateParecer` - Adicionar novo parecer
- âœ… `saveReplyToParecer` - Responder parecer
- âœ… `saveEditParecer` - Editar parecer

### 2. `src/components/NovaFichaComercialForm.tsx`

**FunÃ§Ãµes corrigidas:**
- âœ… `addNovoParecer` - Adicionar novo parecer
- âœ… `saveReplyToParecer` - Responder parecer
- âœ… `saveEditParecer` - Editar parecer

### 3. `src/components/ficha/ExpandedFichaPJModal.tsx`

**FunÃ§Ãµes corrigidas:**
- âœ… `appendParecer` - Adicionar novo parecer
- âœ… `saveReplyToParecer` - Responder parecer
- âœ… `saveEdit` - Editar parecer

## ðŸ“Š DIAGRAMA DO FLUXO

### ANTES (âŒ ProblemÃ¡tico):

```
BANCO DE DADOS                    ESTADO LOCAL (UI)
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Parecer 1       â”‚              â”‚ Parecer 1       â”‚
â”‚ Parecer 2       â”‚              â”‚ Parecer 2       â”‚
â”‚ Parecer 3       â”‚              â”‚ Parecer 3       â”‚
â”‚ (deleted: true) â”‚              â”‚                 â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜              â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                  â†‘ Filtrado ao CARREGAR

        [UsuÃ¡rio adiciona Parecer 4]
                 â†“
                 
BANCO DE DADOS                    ESTADO LOCAL (UI)
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Parecer 1       â”‚              â”‚ Parecer 1       â”‚
â”‚ Parecer 2       â”‚              â”‚ Parecer 2       â”‚
â”‚ Parecer 3       â”‚              â”‚ Parecer 3 âŒ    â”‚ â† VOLTOU!
â”‚ (deleted: true) â”‚              â”‚ (deleted: true) â”‚
â”‚ Parecer 4 (NEW) â”‚              â”‚ Parecer 4       â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜              â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                  â†‘ NÃƒO FILTROU ao ADICIONAR! âŒ
```

### DEPOIS (âœ… Corrigido):

```
BANCO DE DADOS                    ESTADO LOCAL (UI)
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Parecer 1       â”‚              â”‚ Parecer 1       â”‚
â”‚ Parecer 2       â”‚              â”‚ Parecer 2       â”‚
â”‚ Parecer 3       â”‚              â”‚                 â”‚
â”‚ (deleted: true) â”‚              â”‚ (filtrado)      â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜              â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                  â†‘ Filtrado ao CARREGAR

        [UsuÃ¡rio adiciona Parecer 4]
                 â†“
                 
BANCO DE DADOS                    ESTADO LOCAL (UI)
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Parecer 1       â”‚              â”‚ Parecer 1       â”‚
â”‚ Parecer 2       â”‚              â”‚ Parecer 2       â”‚
â”‚ Parecer 3       â”‚  .filter()   â”‚                 â”‚ â† Continua oculto! âœ…
â”‚ (deleted: true) â”‚  â”€â”€â”€â”€â”€â”€â”€â”€>   â”‚ (filtrado)      â”‚
â”‚ Parecer 4 (NEW) â”‚              â”‚ Parecer 4       â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜              â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                  â†‘ FILTRADO ao ADICIONAR! âœ…
```

## ðŸ§ª COMO TESTAR

### Teste Completo:

1. **Abra uma ficha** (PF ou PJ)
2. **Adicione 3 pareceres** (Parecer A, B, C)
3. **Exclua** o Parecer B
4. âœ… Verifique que **sumiu da tela**
5. **Adicione um novo parecer** (Parecer D)
6. âœ… Verifique que **APENAS** A, C e D aparecem
7. âœ… **Parecer B NÃƒO deve reaparecer**

### Verificar no Console:

```
ðŸ—‘ï¸ [ModalEditar] Excluindo parecer: B...
âœ… [ModalEditar] Parecer marcado como deletado (soft delete): B
ðŸ“Š [ModalEditar] Pareceres ativos restantes: 2

âž• [ModalEditar] Adicionando novo parecer ao banco: D...
âœ… [ModalEditar] Parecer adicionado com sucesso!
ðŸ“Š [ModalEditar] Pareceres carregados: 4 Ativos: 3  â† 4 no banco, 3 na UI
```

### Verificar no Banco (Supabase Dashboard):

Se vocÃª consultar `kanban_cards.reanalysis_notes`, verÃ¡:

```json
[
  { "id": "A", "text": "Parecer A" },
  { "id": "B", "text": "Parecer B", "deleted": true, "deleted_at": "..." },
  { "id": "C", "text": "Parecer C" },
  { "id": "D", "text": "Parecer D" }
]
```

**Nota:** O Parecer B estÃ¡ lÃ¡ (histÃ³rico), mas com `deleted: true`, entÃ£o **NÃƒO aparece na UI**.

## ðŸŽ¯ RESUMO DA CORREÃ‡ÃƒO

### O que mudou:

1. **Ao ADICIONAR** parecer:
   - Banco: Salva lista completa (incluindo deletados)
   - UI: Mostra apenas ativos (`filter(!deleted)`)

2. **Ao EDITAR** parecer:
   - Banco: Edita na lista completa (incluindo deletados)
   - UI: Mostra apenas ativos apÃ³s ediÃ§Ã£o

3. **Ao RESPONDER** parecer:
   - Banco: Adiciona resposta Ã  lista completa
   - UI: Mostra apenas ativos

4. **Ao EXCLUIR** parecer:
   - Banco: Marca como `deleted: true` (soft delete)
   - UI: Remove da lista local

### BenefÃ­cios:

âœ… **HistÃ³rico preservado** - Pareceres deletados ficam no banco
âœ… **UI limpa** - Apenas pareceres ativos sÃ£o exibidos
âœ… **Nunca mais ressuscitam** - Deletados nunca voltam a aparecer
âœ… **Auditoria** - PossÃ­vel recuperar pareceres deletados se necessÃ¡rio

---

**Data:** 09/10/2025  
**Status:** âœ… CORREÃ‡ÃƒO APLICADA  
**Componentes:** ModalEditarFicha, NovaFichaComercialForm, ExpandedFichaPJModal

