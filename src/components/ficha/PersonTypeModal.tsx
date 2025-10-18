import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { IdCard, Building2, ChevronRight } from "lucide-react";
import { useEffect } from "react";

interface PersonTypeModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (type: "pf" | "pj") => void;
}

export function PersonTypeModal({ open, onClose, onSelect }: PersonTypeModalProps) {
  // atalhos de teclado: P para PF, J para PJ
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'p') onSelect('pf');
      if (e.key.toLowerCase() === 'j') onSelect('pj');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onSelect]);

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-2xl p-0 overflow-hidden">
        {/* Header com gradiente moderno */}
        <DialogHeader className="bg-gradient-to-br from-[#018942] via-[#016b35] to-[#014d28] text-white p-6 relative overflow-hidden">
          <div className='absolute inset-0 bg-[url("data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.05%22%3E%3Ccircle cx=%2230%22 cy=%2230%22 r=%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")] opacity-20'></div>
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
              <span className="text-white text-lg font-bold">📋</span>
            </div>
            <div className="flex items-center gap-3">
              <img 
                src="/src/assets/Logo MZNET (1).png" 
                alt="MZNET Logo" 
                className="h-8 w-auto filter brightness-0 invert"
              />
              <div>
                <DialogTitle className="text-lg font-semibold text-white">
                  Qual tipo de ficha deseja criar?
                </DialogTitle>
                <p className="text-green-100 text-sm mt-1">
                  Escolha o tipo de pessoa para iniciarmos a criação
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Conteúdo principal */}
        <div className="p-6 space-y-6">
          {/* Seção: Tipos de Ficha */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              Selecione o Tipo de Cadastro
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Card Pessoa Física */}
              <button
                type="button"
                onClick={() => onSelect('pf')}
                className="group relative rounded-xl border-2 border-gray-200 bg-white p-6 text-left transition-all duration-300 hover:border-[#018942] hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#018942]/25"
              >
                {/* Ícone e título */}
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:bg-blue-100 group-hover:scale-110">
                    <IdCard className="h-7 w-7 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-[#018942] transition-colors">
                      Pessoa Física
                    </h3>
                    <p className="text-sm text-gray-600">
                      Para clientes individuais
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-[#018942] group-hover:translate-x-1 transition-all flex-shrink-0" />
                </div>

                {/* Detalhes */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    <span>Cadastro com CPF</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    <span>Dados pessoais e contato</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                    <span>Análise de crédito individual</span>
                  </div>
                </div>

                {/* Badge de atalho */}
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-500">Atalho do teclado:</span>
                  <div className="px-2 py-1 bg-gray-100 rounded text-xs font-mono font-semibold text-gray-700 group-hover:bg-[#018942] group-hover:text-white transition-colors">
                    P
                  </div>
                </div>
              </button>

              {/* Card Pessoa Jurídica */}
              <button
                type="button"
                onClick={() => onSelect('pj')}
                className="group relative rounded-xl border-2 border-gray-200 bg-white p-6 text-left transition-all duration-300 hover:border-[#018942] hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#018942]/25"
              >
                {/* Ícone e título */}
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-14 h-14 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:bg-orange-100 group-hover:scale-110">
                    <Building2 className="h-7 w-7 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-[#018942] transition-colors">
                      Pessoa Jurídica
                    </h3>
                    <p className="text-sm text-gray-600">
                      Para empresas e organizações
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-[#018942] group-hover:translate-x-1 transition-all flex-shrink-0" />
                </div>

                {/* Detalhes */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                    <span>Cadastro com CNPJ</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    <span>Dados corporativos</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                    <span>Análise empresarial</span>
                  </div>
                </div>

                {/* Badge de atalho */}
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-500">Atalho do teclado:</span>
                  <div className="px-2 py-1 bg-gray-100 rounded text-xs font-mono font-semibold text-gray-700 group-hover:bg-[#018942] group-hover:text-white transition-colors">
                    J
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Card Informativo */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-green-600">💡</span>
              </div>
              <div>
                <p className="text-sm font-medium text-green-900 mb-1">Dica!</p>
                <p className="text-xs text-green-700">
                  Use os atalhos do teclado <kbd className="px-1.5 py-0.5 bg-white border border-green-300 rounded text-green-800 font-mono">P</kbd> para Pessoa Física ou <kbd className="px-1.5 py-0.5 bg-white border border-green-300 rounded text-green-800 font-mono">J</kbd> para Pessoa Jurídica para criar uma ficha rapidamente.
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PersonTypeModal;
