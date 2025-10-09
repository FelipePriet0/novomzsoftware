﻿# ðŸ“Ž **Sistema Completo de Anexos - Fluxo Frontend â†’ Backend**

## ðŸŽ¯ **VisÃ£o Geral**

Sistema completo de anexos integrado com conversas encadeadas, permitindo anexar arquivos tanto no campo principal quanto em respostas de conversas.

---

## ðŸ“Š **Estrutura no Supabase**

### **1. Tabela: `card_attachments`**

```sql
card_attachments
â”œâ”€â”€ id (uuid, PK)
â”œâ”€â”€ card_id (uuid, FK â†’ kanban_cards)
â”œâ”€â”€ comment_id (uuid, FK â†’ card_comments, nullable)
â”œâ”€â”€ author_id (uuid, FK â†’ profiles)
â”œâ”€â”€ author_name (text)
â”œâ”€â”€ author_role (text)
â”œâ”€â”€ file_name (text) -- Nome personalizado do arquivo
â”œâ”€â”€ file_path (text) -- Caminho no Storage
â”œâ”€â”€ file_size (bigint) -- Tamanho em bytes
â”œâ”€â”€ file_type (text) -- MIME type
â”œâ”€â”€ file_extension (text) -- ExtensÃ£o do arquivo
â”œâ”€â”€ description (text, nullable) -- DescriÃ§Ã£o opcional
â”œâ”€â”€ card_title (text) -- TÃ­tulo do card (preenchido automaticamente)
â”œâ”€â”€ created_at (timestamptz)
â””â”€â”€ updated_at (timestamptz)
```

**Ãndices:**
- `idx_card_attachments_card_id` â†’ Busca por card
- `idx_card_attachments_comment_id` â†’ Busca por comentÃ¡rio
- `idx_card_attachments_author_id` â†’ Busca por autor

---

### **2. Storage Bucket: `card-attachments`**

**Estrutura de Pastas:**
```
card-attachments/
â””â”€â”€ [CARD_TITLE]/
    â””â”€â”€ [CUSTOM_NAME]_[DATE]_[RANDOM].ext
```

**Exemplo Real:**
```
card-attachments/
â””â”€â”€ ANTONIO_BOZUTT/
    â”œâ”€â”€ CNH_Titular_2025-01-07_a3f2k1.pdf
    â”œâ”€â”€ Comprovante_Renda_2025-01-07_b7m9n2.pdf
    â””â”€â”€ Foto_Residencia_2025-01-08_c4p5q3.jpg
```

**ConfiguraÃ§Ã£o:**
- **Public:** `true` (acesso pÃºblico via URL)
- **File Size Limit:** 50MB por arquivo
- **Allowed MIME types:** `image/*`, `application/pdf`, `application/*`, `text/*`

---

### **3. Tabela: `card_comments`**

```sql
card_comments
â”œâ”€â”€ id (uuid, PK)
â”œâ”€â”€ card_id (uuid, FK â†’ kanban_cards)
â”œâ”€â”€ parent_id (uuid, FK â†’ card_comments, nullable)
â”œâ”€â”€ author_id (uuid, FK â†’ profiles)
â”œâ”€â”€ author_name (text)
â”œâ”€â”€ author_role (text)
â”œâ”€â”€ content (text)
â”œâ”€â”€ level (integer) -- NÃ­vel de profundidade (0-7)
â”œâ”€â”€ thread_id (text) -- ID Ãºnico da conversa
â”œâ”€â”€ is_thread_starter (boolean) -- Se inicia uma conversa
â”œâ”€â”€ card_title (text) -- TÃ­tulo do card (preenchido automaticamente)
â”œâ”€â”€ created_at (timestamptz)
â””â”€â”€ updated_at (timestamptz)
```

**Constraints:**
- `level` entre 0 e 7
- `thread_id` NOT NULL
- `card_title` preenchido automaticamente via trigger

---

## ðŸ”„ **Fluxo Completo de Upload**

### **Fluxo 1: Anexo via Campo Principal "ObservaÃ§Ãµes e Conversas"**

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 1. FRONTEND - UsuÃ¡rio clica "Anexo" (Paperclip)            â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                          â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 2. Modal: AttachmentUploadModal abre                        â”‚
â”‚    - UsuÃ¡rio seleciona arquivo(s)                           â”‚
â”‚    - Nomeia cada arquivo (OBRIGATÃ“RIO)                      â”‚
â”‚    - Adiciona descriÃ§Ã£o opcional                            â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                          â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 3. useAttachments.uploadAttachment()                        â”‚
â”‚    a) Busca tÃ­tulo do card                                  â”‚
â”‚    b) Gera nome sanitizado: [CUSTOM_NAME]_[DATE]_[RANDOM]  â”‚
â”‚    c) Cria estrutura: [CARD_TITLE]/[FILE_NAME]             â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                          â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 4. SUPABASE STORAGE - Upload do arquivo                     â”‚
â”‚    Bucket: card-attachments                                 â”‚
â”‚    Path: CARD_TITLE/CUSTOM_NAME_DATE_RANDOM.ext            â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                          â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 5. SUPABASE DB - Insert em card_attachments                â”‚
â”‚    - card_id, author_id, file_name, file_path, etc.        â”‚
â”‚    - comment_id = NULL (nÃ£o associado a comentÃ¡rio)        â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                          â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 6. TRIGGER: create_attachment_comment()                     â”‚
â”‚    - Gera novo thread_id Ãºnico                              â”‚
â”‚    - Cria comentÃ¡rio automÃ¡tico com:                        â”‚
â”‚      * Emoji ðŸ“Ž                                              â”‚
â”‚      * Nome do arquivo                                      â”‚
â”‚      * TÃ­tulo da ficha                                      â”‚
â”‚      * Detalhes (tipo, tamanho, autor)                     â”‚
â”‚    - parent_id = NULL (nova conversa)                       â”‚
â”‚    - level = 0 (conversa principal)                         â”‚
â”‚    - is_thread_starter = true                               â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                          â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 7. FRONTEND - AtualizaÃ§Ã£o InstantÃ¢nea                       â”‚
â”‚    - onRefetch() chamado                                    â”‚
â”‚    - loadAttachments() recarrega anexos                     â”‚
â”‚    - CommentsList atualiza e mostra nova conversa          â”‚
â”‚    - AttachmentCard exibe arquivo com botÃµes                â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

### **Fluxo 2: Anexo via Campo de Resposta (Conversas Encadeadas)**

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 1. FRONTEND - UsuÃ¡rio clica "Responder" em um comentÃ¡rio   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                          â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 2. Campo de resposta abre com CTA "Anexo" integrado        â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                          â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 3. UsuÃ¡rio clica "Anexo" â†’ Modal abre                       â”‚
â”‚    - Seleciona arquivo(s)                                   â”‚
â”‚    - Nomeia cada arquivo (OBRIGATÃ“RIO)                      â”‚
â”‚    - Adiciona descriÃ§Ã£o opcional                            â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                          â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 4. handleReplyAttachmentUpload()                            â”‚
â”‚    - Armazena anexo como PENDENTE                           â”‚
â”‚    - NÃƒO faz upload ainda                                   â”‚
â”‚    - Exibe preview: "Arquivos que serÃ£o anexados"          â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                          â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 5. UsuÃ¡rio digita resposta e clica "Responder"             â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                          â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 6. handleReplySubmit()                                      â”‚
â”‚    a) Cria comentÃ¡rio de resposta                           â”‚
â”‚    b) ObtÃ©m ID do comentÃ¡rio criado                         â”‚
â”‚    c) Loop pelos anexos pendentes                           â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                          â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 7. Para cada anexo pendente:                                â”‚
â”‚    uploadAttachment({ ...data, commentId: result.id })     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                          â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 8. SUPABASE STORAGE - Upload do arquivo                     â”‚
â”‚    Path: CARD_TITLE/CUSTOM_NAME_DATE_RANDOM.ext            â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                          â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 9. SUPABASE DB - Insert em card_attachments                â”‚
â”‚    - card_id, author_id, file_name, file_path              â”‚
â”‚    - comment_id = [ID do comentÃ¡rio de resposta]           â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                          â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 10. TRIGGER: create_attachment_comment() NÃƒO dispara       â”‚
â”‚     (porque comment_id nÃ£o Ã© NULL, anexo jÃ¡ estÃ¡ ligado)   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                          â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 11. FRONTEND - AtualizaÃ§Ã£o InstantÃ¢nea                      â”‚
â”‚     - onRefetch() chamado                                   â”‚
â”‚     - loadAttachments() recarrega anexos                    â”‚
â”‚     - CommentContentRenderer renderiza anexo na resposta    â”‚
â”‚     - AttachmentCard exibe arquivo com botÃµes               â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## ðŸ” **Row Level Security (RLS)**

### **Tabela: `card_attachments`**

**SELECT (Ver anexos):**
```sql
authenticated users only
```
âœ… **Vendedor**: VÃª todos os anexos  
âœ… **Analista**: VÃª todos os anexos  
âœ… **Gestor**: VÃª todos os anexos

**INSERT (Criar anexos):**
```sql
authenticated users only
```
âœ… **Vendedor**: Pode anexar  
âœ… **Analista**: Pode anexar  
âœ… **Gestor**: Pode anexar

**DELETE (Excluir anexos):**
```sql
authenticated users only
```
âœ… **Vendedor**: Pode excluir qualquer anexo  
âœ… **Analista**: Pode excluir qualquer anexo  
âœ… **Gestor**: Pode excluir qualquer anexo

---

### **Storage Bucket: `card-attachments`**

**SELECT (Download):**
```sql
authenticated users only
```
âœ… Todos os usuÃ¡rios autenticados podem fazer download

**INSERT (Upload):**
```sql
authenticated users only
```
âœ… Todos os usuÃ¡rios autenticados podem fazer upload

**DELETE (Remover do Storage):**
```sql
authenticated users only
```
âœ… Todos os usuÃ¡rios autenticados podem remover

---

## ðŸŽ¨ **Componentes Frontend**

### **1. AttachmentUploadModal**
- **LocalizaÃ§Ã£o:** `src/components/attachments/AttachmentUploadModal.tsx`
- **FunÃ§Ã£o:** Modal para upload de arquivos
- **Features:**
  - SeleÃ§Ã£o de mÃºltiplos arquivos
  - NomeaÃ§Ã£o obrigatÃ³ria por arquivo
  - DescriÃ§Ã£o opcional
  - Preview de arquivos selecionados
  - ValidaÃ§Ã£o antes de enviar
  - ConfirmaÃ§Ã£o ao fechar com mudanÃ§as nÃ£o salvas

### **2. AttachmentCard**
- **LocalizaÃ§Ã£o:** `src/components/comments/AttachmentCard.tsx`
- **FunÃ§Ã£o:** ExibiÃ§Ã£o visual do anexo
- **Features:**
  - Preview de PDF (modal com iframe)
  - Download direto no navegador
  - ExclusÃ£o com confirmaÃ§Ã£o
  - Ãcone por tipo de arquivo
  - InformaÃ§Ãµes (nome, tamanho, data, autor)
  - Dropdown com opÃ§Ãµes (Preview, Download, Delete)

### **3. CommentContentRenderer**
- **LocalizaÃ§Ã£o:** `src/components/comments/CommentContentRenderer.tsx`
- **FunÃ§Ã£o:** Renderiza conteÃºdo de comentÃ¡rio + anexos
- **Features:**
  - Detecta comentÃ¡rios de anexo (regex)
  - Renderiza AttachmentCard para anexos
  - Exibe texto normal para comentÃ¡rios sem anexo
  - Suporta mÃºltiplos anexos por comentÃ¡rio

### **4. CommentsList**
- **LocalizaÃ§Ã£o:** `src/components/comments/CommentsList.tsx`
- **FunÃ§Ã£o:** Lista de conversas encadeadas
- **Features:**
  - Agrupamento por thread_id
  - BotÃ£o "Responder" em cada comentÃ¡rio
  - Campo de resposta com CTA "Anexo" integrado
  - Preview de anexos pendentes
  - AtualizaÃ§Ã£o instantÃ¢nea com onRefetch

### **5. ObservationsWithComments**
- **LocalizaÃ§Ã£o:** `src/components/ui/ObservationsWithComments.tsx`
- **FunÃ§Ã£o:** Campo principal de observaÃ§Ãµes + conversas
- **Features:**
  - Textarea com CTA "Anexo" integrado
  - Enter para criar nova conversa
  - Lista de conversas abaixo
  - IntegraÃ§Ã£o com sistema de anexos

---

## ðŸ—„ï¸ **Hook: useAttachments**

**LocalizaÃ§Ã£o:** `src/hooks/useAttachments.ts`

**FunÃ§Ãµes Principais:**

### **uploadAttachment()**
```typescript
const uploadAttachment = async ({ 
  file, 
  description, 
  commentId, 
  customFileName 
}: UploadAttachmentData): Promise<CardAttachment | null>
```

**Etapas:**
1. Busca tÃ­tulo do card
2. Gera nome sanitizado: `[CUSTOM_NAME]_[DATE]_[RANDOM].ext`
3. Cria path: `[CARD_TITLE]/[FILE_NAME]`
4. Upload para Storage: `card-attachments` bucket
5. Insert no banco: `card_attachments` table
6. Retorna dados do anexo criado

---

### **loadAttachments()**
```typescript
const loadAttachments = async (): Promise<void>
```

**Etapas:**
1. Busca todos os anexos do card
2. Ordena por data de criaÃ§Ã£o
3. Atualiza estado local

---

### **deleteAttachment()**
```typescript
const deleteAttachment = async (attachmentId: string): Promise<void>
```

**Etapas:**
1. Busca dados do anexo
2. Remove arquivo do Storage
3. Remove registro do banco
4. Trigger cria comentÃ¡rio de remoÃ§Ã£o
5. Atualiza estado local

---

### **getDownloadUrl()**
```typescript
const getDownloadUrl = async (filePath: string): Promise<string | null>
```

**Etapas:**
1. Gera URL pÃºblica do arquivo
2. Retorna URL para download

---

## ðŸ“ **Triggers e Functions no Backend**

### **1. create_attachment_comment()**
**Trigger:** `AFTER INSERT ON card_attachments`

**LÃ³gica:**
```sql
QUANDO um anexo Ã© criado (comment_id = NULL):
  1. Buscar tÃ­tulo do card
  2. Gerar thread_id Ãºnico
  3. Criar comentÃ¡rio automÃ¡tico com:
     - Emoji ðŸ“Ž
     - Nome do arquivo
     - TÃ­tulo da ficha
     - Detalhes (tipo, tamanho, autor)
  4. Definir como nova conversa:
     - parent_id = NULL
     - level = 0
     - is_thread_starter = true
```

---

### **2. create_attachment_deletion_comment()**
**Trigger:** `AFTER DELETE ON card_attachments`

**LÃ³gica:**
```sql
QUANDO um anexo Ã© excluÃ­do:
  1. Buscar tÃ­tulo do card
  2. Gerar thread_id Ãºnico
  3. Criar comentÃ¡rio automÃ¡tico com:
     - Emoji ðŸ—‘ï¸
     - Nome do arquivo removido
     - TÃ­tulo da ficha
  4. Definir como nova conversa:
     - parent_id = NULL
     - level = 0
     - is_thread_starter = true
```

---

### **3. update_card_title_in_attachments()**
**Trigger:** `BEFORE INSERT ON card_attachments`

**LÃ³gica:**
```sql
QUANDO um anexo Ã© criado:
  1. Buscar tÃ­tulo do card
  2. Preencher campo card_title automaticamente
```

---

### **4. update_card_title_in_comments()**
**Trigger:** `BEFORE INSERT ON card_comments`

**LÃ³gica:**
```sql
QUANDO um comentÃ¡rio Ã© criado:
  1. Buscar tÃ­tulo do card
  2. Preencher campo card_title automaticamente
```

---

## ðŸŽ¯ **Casos de Uso**

### **Caso 1: Analista anexa CNH do titular**

**Frontend:**
1. Analista abre "Editar Ficha"
2. Clica no Ã­cone "Anexo" (Paperclip) no campo principal
3. Seleciona arquivo: `cnh_joao.pdf`
4. Renomeia para: `CNH Titular`
5. Clica "Anexar"

**Backend:**
1. Upload para: `card-attachments/JOAO_SILVA/CNH_Titular_2025-01-07_a3f2k1.pdf`
2. Insert em `card_attachments`:
   ```json
   {
     "file_name": "CNH Titular",
     "file_path": "JOAO_SILVA/CNH_Titular_2025-01-07_a3f2k1.pdf",
     "comment_id": null
   }
   ```
3. Trigger cria comentÃ¡rio automÃ¡tico:
   ```
   ðŸ“Ž Anexo adicionado: CNH Titular
   ðŸ“‹ Ficha: JOÃƒO SILVA
   ðŸ“ DescriÃ§Ã£o: -
   ðŸ“Š Detalhes do arquivo:
   â€¢ Tipo: application/pdf
   â€¢ Tamanho: 2.3 MB
   â€¢ ExtensÃ£o: pdf
   â€¢ Autor: Maria Analista (analista)
   ```

**Resultado:**
- Nova conversa criada com anexo
- AttachmentCard exibe PDF
- BotÃµes: Download, Preview, Delete

---

### **Caso 2: Gestor responde com comprovante**

**Frontend:**
1. Gestor vÃª conversa: "Falta comprovante de renda"
2. Clica "Responder" (seta)
3. Clica Ã­cone "Anexo" no campo de resposta
4. Seleciona: `comprovante.pdf`
5. Renomeia para: `Comprovante Renda Atualizado`
6. Digita resposta: "Segue comprovante atualizado"
7. Clica "Responder"

**Backend:**
1. Cria comentÃ¡rio de resposta:
   ```json
   {
     "content": "Segue comprovante atualizado",
     "parent_id": "[ID do comentÃ¡rio pai]",
     "level": 1,
     "thread_id": "[mesmo thread_id do pai]"
   }
   ```
2. Upload do anexo para: `card-attachments/JOAO_SILVA/Comprovante_Renda_Atualizado_2025-01-08_b7m9n2.pdf`
3. Insert em `card_attachments`:
   ```json
   {
     "file_name": "Comprovante Renda Atualizado",
     "file_path": "JOAO_SILVA/Comprovante_Renda_Atualizado_2025-01-08_b7m9n2.pdf",
     "comment_id": "[ID do comentÃ¡rio de resposta]"
   }
   ```
4. Trigger NÃƒO dispara (comment_id nÃ£o Ã© NULL)

**Resultado:**
- Resposta aparece na conversa encadeada
- AttachmentCard exibe PDF dentro da resposta
- AtualizaÃ§Ã£o instantÃ¢nea via onRefetch

---

## ðŸ” **Queries Ãšteis para Debug**

### **Ver todos os anexos de um card:**
```sql
SELECT 
  a.id,
  a.file_name,
  a.file_path,
  a.comment_id,
  a.author_name,
  a.created_at
FROM card_attachments a
WHERE a.card_id = '[CARD_ID]'
ORDER BY a.created_at DESC;
```

### **Ver estrutura de uma conversa:**
```sql
SELECT 
  c.id,
  c.content,
  c.level,
  c.thread_id,
  c.parent_id,
  c.author_name,
  c.created_at,
  a.file_name as attached_file
FROM card_comments c
LEFT JOIN card_attachments a ON a.comment_id = c.id
WHERE c.card_id = '[CARD_ID]'
ORDER BY c.thread_id, c.level, c.created_at;
```

### **Ver anexos sem comentÃ¡rio associado:**
```sql
SELECT 
  a.id,
  a.file_name,
  a.comment_id,
  a.created_at
FROM card_attachments a
WHERE a.card_id = '[CARD_ID]'
  AND a.comment_id IS NULL
ORDER BY a.created_at DESC;
```

### **Ver anexos dentro de conversas encadeadas:**
```sql
SELECT 
  a.id,
  a.file_name,
  c.content as comment_content,
  c.level as comment_level,
  c.thread_id,
  a.created_at
FROM card_attachments a
JOIN card_comments c ON c.id = a.comment_id
WHERE a.card_id = '[CARD_ID]'
  AND a.comment_id IS NOT NULL
ORDER BY c.thread_id, c.level, a.created_at;
```

---

## ðŸ“¦ **Arquivos SQL Importantes**

### **1. fix-attachment-conversation-flow-v2.sql**
- **FunÃ§Ã£o:** Configura triggers para integraÃ§Ã£o com conversas
- **Quando usar:** Sempre que resetar o banco
- **Local:** `supabase/fix-attachment-conversation-flow-v2.sql`

### **2. improve-attachments-system.sql**
- **FunÃ§Ã£o:** Adiciona `card_title` a anexos e comentÃ¡rios
- **Quando usar:** Para melhorar rastreabilidade
- **Local:** `supabase/improve-attachments-system.sql`

### **3. fix-attachment-comment-thread-id.sql**
- **FunÃ§Ã£o:** Corrige problema de `thread_id` null
- **Quando usar:** Se comentÃ¡rios nÃ£o aparecerem
- **Local:** `supabase/fix-attachment-comment-thread-id.sql`

---

## âœ… **Checklist de VerificaÃ§Ã£o**

### **Backend (Supabase):**
- [ ] Tabela `card_attachments` criada
- [ ] Tabela `card_comments` com `thread_id` NOT NULL
- [ ] Bucket `card-attachments` criado e pÃºblico
- [ ] RLS habilitado em `card_attachments`
- [ ] RLS habilitado em `card-attachments` bucket
- [ ] Trigger `create_attachment_comment` ativo
- [ ] Trigger `create_attachment_deletion_comment` ativo
- [ ] Trigger `update_card_title_in_attachments` ativo
- [ ] Trigger `update_card_title_in_comments` ativo

### **Frontend:**
- [ ] `useAttachments` hook configurado
- [ ] `AttachmentUploadModal` implementado
- [ ] `AttachmentCard` implementado
- [ ] `CommentContentRenderer` implementado
- [ ] CTA "Anexo" no campo principal
- [ ] CTA "Anexo" nos campos de resposta
- [ ] `onRefetch` passado pela cadeia de componentes
- [ ] Preview de anexos pendentes funcionando
- [ ] Download funcionando
- [ ] Preview de PDF funcionando
- [ ] ExclusÃ£o com confirmaÃ§Ã£o funcionando

---

## ðŸŽ‰ **Funcionalidades Completas**

âœ… **Upload de Arquivos:**
- MÃºltiplos arquivos simultaneamente
- NomeaÃ§Ã£o obrigatÃ³ria por arquivo
- DescriÃ§Ã£o opcional
- Preview antes de enviar

âœ… **OrganizaÃ§Ã£o no Storage:**
- Estrutura de pastas por card
- Nomes descritivos com timestamp
- Path: `CARD_TITLE/CUSTOM_NAME_DATE_RANDOM.ext`

âœ… **IntegraÃ§Ã£o com Conversas:**
- Anexos no campo principal criam nova conversa
- Anexos em respostas ficam dentro da conversa
- AtualizaÃ§Ã£o instantÃ¢nea apÃ³s anexar

âœ… **VisualizaÃ§Ã£o:**
- AttachmentCard com Ã­cone por tipo
- InformaÃ§Ãµes completas (nome, tamanho, data, autor)
- BotÃµes: Preview, Download, Delete

âœ… **SeguranÃ§a:**
- RLS por role (Vendedor, Analista, Gestor)
- AutenticaÃ§Ã£o obrigatÃ³ria
- Logs de auditoria (autor, data)

âœ… **UX/UI:**
- Modal intuitivo para upload
- Preview de PDF em modal
- Download direto no navegador
- ConfirmaÃ§Ã£o antes de excluir
- AtualizaÃ§Ã£o instantÃ¢nea (sem refresh)

---

## ðŸš€ **Performance**

**OtimizaÃ§Ãµes Implementadas:**
- Ãndices em `card_id`, `comment_id`, `author_id`
- Cache de 1 hora para arquivos no Storage
- Lazy loading de anexos (carrega sÃ³ quando necessÃ¡rio)
- AtualizaÃ§Ã£o local apÃ³s operaÃ§Ãµes (sem refetch completo)

---

## ðŸ“ž **Suporte e Debugging**

**Logs no Console:**
- `CommentContentRenderer`: Log quando processa anexo
- `AttachmentCard`: Log de file_path e permissÃµes
- `handleReplySubmit`: Log completo do fluxo de upload
- `uploadAttachment`: Log de cada etapa do upload

**Verificar se estÃ¡ funcionando:**
1. Abrir Console do Navegador (F12)
2. Buscar por: `CommentContentRenderer processing attachment`
3. Buscar por: `AttachmentCard received data`
4. Buscar por: `Fazendo upload de anexos pendentes`

---

## ðŸŽ¯ **ConclusÃ£o**

Sistema completo de anexos integrado com conversas encadeadas, com:
- âœ… Upload via campo principal ou respostas
- âœ… OrganizaÃ§Ã£o inteligente no Storage
- âœ… AtualizaÃ§Ã£o instantÃ¢nea (sem refresh)
- âœ… Preview, download e exclusÃ£o
- âœ… Auditoria completa
- âœ… RLS e seguranÃ§a implementados

**Tudo pronto para produÃ§Ã£o! ðŸš€**

