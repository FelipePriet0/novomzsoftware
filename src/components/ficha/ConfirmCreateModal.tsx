import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ConfirmCreateModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmCreateModal({ open, onClose, onConfirm }: ConfirmCreateModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent aria-describedby={undefined} className="max-w-lg p-0 overflow-hidden">
        {/* Header com gradiente moderno */}
        <DialogHeader className="bg-gradient-to-br from-[#018942] via-[#016b35] to-[#014d28] text-white p-6 relative overflow-hidden">
          <div className='absolute inset-0 bg-[url("data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.05%22%3E%3Ccircle cx=%2230%22 cy=%2230%22 r=%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")] opacity-20'></div>
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <div className="flex items-center gap-3">
              <img 
                src="/src/assets/Logo MZNET (1).png" 
                alt="MZNET Logo" 
                className="h-8 w-auto filter brightness-0 invert"
              />
              <div>
                <DialogTitle className="text-lg font-semibold text-white">
                  Criar Nova Ficha
                </DialogTitle>
                <p className="text-green-100 text-sm mt-1">
                  Inicie o processo de criação de uma nova ficha comercial
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Conteúdo principal */}
        <div className="p-6 space-y-6">
          {/* Seção: Processo de Criação */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              Processo de Criação
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-semibold text-blue-600">1</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Dados Básicos</p>
                  <p className="text-xs text-gray-600">Preencha os dados pessoais fundamentais</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-semibold text-green-600">2</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Informações Completas</p>
                  <p className="text-xs text-gray-600">Complete todas as demais informações</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-semibold text-purple-600">3</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Salvamento Automático</p>
                  <p className="text-xs text-gray-600">Suas informações são salvas automaticamente</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-semibold text-orange-600">4</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Segurança</p>
                  <p className="text-xs text-gray-600">Ficha preservada no status "Recebido" se fechar acidentalmente</p>
                </div>
              </div>
            </div>
          </div>

          {/* Seção: Informações Importantes */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600">ℹ️</span>
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900 mb-1">Importante!</p>
                <p className="text-xs text-blue-700">
                  Todas as informações inseridas serão automaticamente salvas. Você pode fechar e reabrir a ficha a qualquer momento sem perder o progresso.
                </p>
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="flex-1 bg-white hover:bg-gray-50 text-gray-700 border-gray-300 hover:border-gray-400 rounded-lg transition-all duration-200"
            >
              Cancelar
            </Button>
            <Button 
              onClick={onConfirm} 
              className="flex-1 bg-gradient-to-r from-[#018942] to-[#016b35] hover:from-[#016b35] hover:to-[#014d28] text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
            >
              Sim, Criar Ficha
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
