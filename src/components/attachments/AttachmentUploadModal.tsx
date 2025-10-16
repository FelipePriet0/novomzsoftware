import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, X, FileIcon } from 'lucide-react';
import { UploadAttachmentData } from '@/hooks/useAttachments';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface AttachmentUploadModalProps {
  open: boolean;
  onClose: () => void;
  onUpload: (data: UploadAttachmentData) => Promise<void>;
  isUploading: boolean;
  cardId: string;
}

export function AttachmentUploadModal({ 
  open, 
  onClose, 
  onUpload, 
  isUploading,
  cardId 
}: AttachmentUploadModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileNames, setFileNames] = useState<{[key: string]: string}>({});
  const [description, setDescription] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Arquivo muito grande. Tamanho máximo: 10MB');
      return;
    }

    // Validate file type
    const allowedTypes = [
      // Imagens comuns
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
      // PDF
      'application/pdf',
      // Documentos Office
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      // Texto e compactados
      'text/plain', 'application/zip', 'application/x-rar-compressed',
      // Fallback genérico (alguns navegadores reportam assim)
      'application/octet-stream'
    ];

    if (!allowedTypes.includes(file.type)) {
      alert('Tipo de arquivo não permitido. Tipos aceitos: imagens, PDF, documentos, planilhas, texto e arquivos compactados.');
      return;
    }

    // Check if file already exists
    const fileExists = selectedFiles.some(f => f.name === file.name && f.size === file.size);
    if (fileExists) {
      alert('Este arquivo já foi selecionado.');
      return;
    }

    setSelectedFiles(prev => [...prev, file]);
    
    // Gerar nome padrão baseado no nome do arquivo (sem extensão)
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    setFileNames(prev => ({ ...prev, [file.name]: baseName }));
    setHasChanges(true);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => handleFileSelect(file));
    // Clear the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => handleFileSelect(file));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    // Validar se todos os arquivos têm nomes
    const missingNames = selectedFiles.filter(file => !fileNames[file.name]?.trim());
    if (missingNames.length > 0) {
      alert('Por favor, dê um nome para todos os arquivos antes de enviar.');
      return;
    }

    try {
      // Upload each file
      for (const file of selectedFiles) {
        const customFileName = fileNames[file.name]?.trim() || file.name;
        await onUpload({
          file: file,
          description: description.trim() || undefined,
          customFileName: customFileName
        });
      }
      
      // Reset form
      setSelectedFiles([]);
      setFileNames({});
      setDescription('');
      setHasChanges(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // ⚠️ IMPORTANTE: Aguardar um pouco para garantir que o upload foi processado
      // antes de fechar o modal, para que o estado seja atualizado corretamente
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Fechar modal após upload bem-sucedido
      onClose();
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    const iconMap: Record<string, string> = {
      'pdf': '📄',
      'jpg': '🖼️',
      'jpeg': '🖼️',
      'png': '🖼️',
      'gif': '🖼️',
      'doc': '📝',
      'docx': '📝',
      'xls': '📊',
      'xlsx': '📊',
      'txt': '📄',
      'zip': '📦',
      'rar': '📦'
    };
    return iconMap[extension] || '📎';
  };

  const removeFile = (index: number) => {
    const fileToRemove = selectedFiles[index];
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    
    // Remover também o nome do arquivo
    if (fileToRemove) {
      setFileNames(prev => {
        const newNames = { ...prev };
        delete newNames[fileToRemove.name];
        return newNames;
      });
    }
    
    setHasChanges(true);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
    setHasChanges(true);
  };

  const handleFileNameChange = (fileName: string, newName: string) => {
    setFileNames(prev => ({ ...prev, [fileName]: newName }));
    setHasChanges(true);
  };

  const handleCloseRequest = () => {
    if (hasChanges) {
      setShowConfirmDialog(true);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    setSelectedFiles([]);
    setDescription('');
    setHasChanges(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const handleConfirmClose = () => {
    setShowConfirmDialog(false);
    handleClose();
  };

  const handleSaveAndClose = async () => {
    if (selectedFiles.length > 0) {
      await handleUpload();
    }
    setShowConfirmDialog(false);
    handleClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleCloseRequest}>
        <DialogContent aria-describedby={undefined} className="max-w-2xl p-0 overflow-hidden">
          {/* Header com gradiente moderno */}
          <DialogHeader className="bg-gradient-to-br from-[#018942] via-[#016b35] to-[#014d28] text-white p-6 relative overflow-hidden">
            <div className='absolute inset-0 bg-[url("data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.05%22%3E%3Ccircle cx=%2230%22 cy=%2230%22 r=%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")] opacity-20'></div>
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                  <Upload className="h-5 w-5 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-semibold text-white">
                    Anexar Arquivo
                  </DialogTitle>
                  <p className="text-green-100 text-sm mt-1">
                    Envie documentos e imagens para a ficha
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCloseRequest}
                className="h-8 w-8 p-0 text-white hover:bg-white/20 rounded-full"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

        <div className="p-6 space-y-6">
          {/* Seção: Upload de Arquivos */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              Arquivos
            </h3>
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
                dragOver 
                  ? 'border-[#018942] bg-green-50 scale-105' 
                  : 'border-gray-300 hover:border-[#018942] hover:bg-gray-50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {selectedFiles.length > 0 ? (
                <div className="space-y-3">
                  {/* Lista de arquivos selecionados */}
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                            <span className="text-xl">{getFileIcon(file.name)}</span>
                          </div>
                          <div>
                            <div className="font-medium text-sm text-gray-900">{file.name}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <span className="text-green-600">●</span>
                              {formatFileSize(file.size)}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="h-8 w-8 p-0 bg-red-50 hover:bg-red-100 text-red-600 border-red-200 hover:border-red-300 rounded-lg transition-all duration-200"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {/* Campo para nome personalizado */}
                      <div>
                        <Label htmlFor={`fileName-${index}`} className="text-sm font-medium text-gray-700">
                          Nome do documento (obrigatório):
                        </Label>
                        <Input
                          id={`fileName-${index}`}
                          value={fileNames[file.name] || ''}
                          onChange={(e) => handleFileNameChange(file.name, e.target.value)}
                          placeholder="Ex: CNH do titular, Comprovante de renda, etc."
                          className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
                          required
                        />
                      </div>
                    </div>
                  ))}
                  
                  {/* Botão para adicionar mais arquivos */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-dashed border-2 border-[#018942] text-[#018942] hover:bg-green-50 hover:border-[#016b35] rounded-lg transition-all duration-200"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Adicionar Outro Arquivo
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 py-4">
                  <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto">
                    <Upload className="h-8 w-8 text-[#018942]" />
                  </div>
                  <div className="text-sm text-gray-700">
                    Arraste um arquivo aqui ou{' '}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[#018942] hover:underline font-medium"
                    >
                      clique para selecionar
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <p className="flex items-center justify-center gap-1">
                      <span className="text-green-600">●</span>
                      Máximo: 10MB por arquivo
                    </p>
                    <p className="flex items-center justify-center gap-1">
                      <span className="text-blue-600">●</span>
                      Tipos: Imagens, PDF, Documentos, Planilhas
                    </p>
                  </div>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileInputChange}
              className="hidden"
              multiple
              accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
            />
          </div>

          {/* Seção: Descrição */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              Descrição
            </h3>
            <div>
              <Label htmlFor="description" className="text-sm font-medium text-gray-700">
                Observações (opcional):
              </Label>
              <Textarea
                id="description"
                placeholder="Ex: Enviou CNH consta CPF + Comprovante (Conta Cemig) no nome de XX: confere end Venc XX/XX, consta CPF: 000.000.000-00"
                value={description}
                onChange={handleDescriptionChange}
                rows={3}
                className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Adicione informações contextuais sobre os documentos enviados
              </p>
            </div>
          </div>

          {/* Validação de nomes */}
          {selectedFiles.length > 0 && (
            <div className="text-sm">
              {selectedFiles.some(file => !fileNames[file.name]?.trim()) ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                  <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-amber-600">⚠️</span>
                  </div>
                  <div>
                    <p className="font-medium text-amber-900">Atenção!</p>
                    <p className="text-amber-700 text-sm">Por favor, dê um nome para todos os arquivos antes de enviar.</p>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-green-600">✅</span>
                  </div>
                  <div>
                    <p className="font-medium text-green-900">Tudo pronto!</p>
                    <p className="text-green-700 text-sm">Todos os arquivos têm nomes definidos e podem ser enviados.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button 
              variant="outline" 
              onClick={handleCloseRequest} 
              disabled={isUploading}
              className="bg-white hover:bg-gray-50 text-gray-700 border-gray-300 hover:border-gray-400 rounded-lg transition-all duration-200"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleUpload} 
              disabled={selectedFiles.length === 0 || isUploading}
              className="bg-gradient-to-r from-[#018942] to-[#016b35] hover:from-[#016b35] hover:to-[#014d28] text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Anexar {selectedFiles.length > 1 ? `${selectedFiles.length} arquivos` : selectedFiles.length === 1 ? 'arquivo' : ''}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Confirmation Dialog */}
    <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
          <AlertDialogDescription>
            Você fez alterações neste formulário. Se fechar agora, as alterações serão perdidas.
            Deseja salvar antes de fechar?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            onClick={handleConfirmClose}
            className="bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700"
          >
            Descartar alterações
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleSaveAndClose}
            className="bg-[#018942] hover:bg-[#018942]/90 text-white border-[#018942] hover:border-[#018942]/90"
          >
            Salvar e fechar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
