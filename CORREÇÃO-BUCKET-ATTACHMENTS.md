# ðŸ“Ž CORREÃ‡ÃƒO - Erro "Bucket not found" no Upload de Anexos

## ðŸ“‹ PROBLEMA RESOLVIDO

**Erro:**
```
POST .../attachments/...pdf 400 (Bad Request)
Upload error: StorageApiError: Bucket not found
```

**Causa:** O cÃ³digo estava tentando usar o bucket `'attachments'`, mas no Supabase Storage o bucket que **existe** Ã© `'card_attachments'`.

---

## ðŸ” DIAGNÃ“STICO

### **Frontend (useAttachments.ts):**
```typescript
// âŒ ANTES (ERRADO):
await supabase.storage
  .from('attachments')  // â† Bucket nÃ£o existe!
  .upload(storagePath, file, {...});
```

### **Supabase Storage:**
```
Buckets existentes:
  âœ… card_attachments  â† EXISTE!
  âŒ attachments       â† NÃƒO EXISTE!
```

### **Resultado:**
```
400 Bad Request - Bucket not found
```

---

## âœ… SOLUÃ‡ÃƒO APLICADA

### **Arquivo Corrigido:** `src/hooks/useAttachments.ts`

**MudanÃ§a:** SubstituÃ­das todas as **6 ocorrÃªncias** de `'attachments'` por `'card_attachments'`

| Linha | FunÃ§Ã£o | MudanÃ§a |
|-------|--------|---------|
| **140** | `uploadAttachment` | `.from('attachments')` â†’ `.from('card_attachments')` |
| **153** | `uploadAttachment` (getPublicUrl) | `.from('attachments')` â†’ `.from('card_attachments')` |
| **182** | `uploadAttachment` (cleanup) | `.from('attachments')` â†’ `.from('card_attachments')` |
| **291** | `listAllFiles` | `.from('attachments')` â†’ `.from('card_attachments')` |
| **313** | `getDownloadUrl` | `.from('attachments')` â†’ `.from('card_attachments')` |
| **332** | `getDownloadUrlStandalone` | `.from('attachments')` â†’ `.from('card_attachments')` |

---

## ðŸ”§ CÃ“DIGO ANTES vs DEPOIS

### **Antes (ERRADO):**

```typescript
// Upload
await supabase.storage.from('attachments').upload(...)

// Get URL
supabase.storage.from('attachments').getPublicUrl(...)

// Remove (rollback)
await supabase.storage.from('attachments').remove([...])

// List files
await supabase.storage.from('attachments').list(...)

// Download URL
await supabase.storage.from('attachments').createSignedUrl(...)
```

### **Depois (CORRETO):**

```typescript
// Upload
await supabase.storage.from('card_attachments').upload(...)

// Get URL
supabase.storage.from('card_attachments').getPublicUrl(...)

// Remove (rollback)
await supabase.storage.from('card_attachments').remove([...])

// List files
await supabase.storage.from('card_attachments').list(...)

// Download URL
await supabase.storage.from('card_attachments').createSignedUrl(...)
```

---

## ðŸ“Š PADRONIZAÃ‡ÃƒO COMPLETA

Agora o sistema estÃ¡ **100% consistente**:

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚           BANCO DE DADOS (PostgreSQL)       â”‚
â”‚  Tabela: card_attachments                   â”‚
â”‚  - id, card_id, file_name, file_path, etc.  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                    â†•
              (vinculados)
                    â†•
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚         STORAGE (Arquivos Reais)            â”‚
â”‚  Bucket: card_attachments                   â”‚
â”‚  - PDFs, imagens, documentos, etc.          â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**Nomes consistentes:**
- âœ… Tabela: `card_attachments`
- âœ… Bucket: `card_attachments`
- âœ… Hook: `useAttachments`

---

## ðŸ§ª COMO TESTAR

### **Teste 1: Upload de Anexo**

1. Abra uma ficha em "Editar Ficha"
2. Clique em "Anexar Arquivo"
3. Selecione um PDF
4. Clique em "Enviar"
5. âœ… **Verifique no console:**
   ```
   ðŸ“Ž [ModalEditarFicha] Iniciando upload de anexo...
   ðŸ“¤ DEBUG uploadAttachment: {fileName: '...', fileSize: ..., fileType: 'application/pdf'}
   ðŸ“¤ DEBUG Storage Path: {storagePath: '...', cardId: '...'}
   ðŸ“¤ Upload successful: {...}  â† SUCESSO!
   ```
6. âœ… **Verifique:** Anexo deve aparecer na lista instantaneamente

### **Teste 2: Download de Anexo**

1. Clique em um anexo existente
2. âœ… **Verifique:** Download deve iniciar sem erros

### **Teste 3: Excluir Anexo**

1. Clique no Ã­cone de lixeira de um anexo
2. Confirme a exclusÃ£o
3. âœ… **Verifique:** Anexo deve sumir da lista instantaneamente

---

## ðŸ“‹ LOGS ESPERADOS NO CONSOLE

### **Upload com Sucesso:**

```
ðŸ“Ž [ModalEditarFicha] Iniciando upload de anexo...
ðŸ“¤ DEBUG uploadAttachment: {
  fileName: 'documento',
  fileSize: 1470380,
  fileType: 'application/pdf',
  commentId: undefined,
  description: undefined
}
ðŸ“¤ DEBUG Storage Path: {
  originalName: 'documento.pdf',
  newName: 'documento_2025-10-09_abc123.pdf',
  storagePath: '4f27f130-.../documento_2025-10-09_abc123.pdf',
  cardId: '4f27f130-...'
}
ðŸ“¤ Saving attachment metadata: {...}
ðŸ“¤ Upload successful: {...}
âœ… Toast: "Arquivo anexado - documento.pdf foi anexado ao card"
ðŸ“Ž [ModalEditarFicha] Upload concluÃ­do, recarregando anexos...
ðŸ“¥ [loadAttachments] âœ… Atualizando estado com 4 anexos
```

---

## âš ï¸ O QUE NÃƒO FOI ALTERADO (Garantia de SeguranÃ§a)

âœ… **Tabela `card_attachments`:** NÃ£o foi tocada (continua igual)  
âœ… **LÃ³gica de upload:** Apenas mudou o nome do bucket  
âœ… **Metadata no banco:** Continua salvando normalmente  
âœ… **Soft delete:** Funciona exatamente igual  
âœ… **Realtime:** SincronizaÃ§Ã£o continua funcionando  
âœ… **ComentÃ¡rios/Tarefas/Pareceres:** NÃ£o foram afetados  

---

## ðŸŽ¯ BENEFÃCIOS

âœ… **PadronizaÃ§Ã£o:** Nome consistente (tabela E bucket = `card_attachments`)  
âœ… **OrganizaÃ§Ã£o:** FÃ¡cil entender que ambos sÃ£o relacionados  
âœ… **ManutenÃ§Ã£o:** CÃ³digo mais claro para futuros desenvolvedores  
âœ… **Sem duplicaÃ§Ã£o:** Apenas 1 bucket para gerenciar  
âœ… **Zero risco:** MudanÃ§a isolada, sem efeito cascata  

---

## âœ… STATUS

**CORREÃ‡ÃƒO APLICADA COM SUCESSO!** ðŸŽ‰

- âœ… 6 ocorrÃªncias corrigidas em `useAttachments.ts`
- âœ… Nenhum erro de linting
- âœ… Nenhuma outra funcionalidade afetada

**Teste agora o upload de anexos!** Deve funcionar perfeitamente! ðŸ“Žâœ¨

