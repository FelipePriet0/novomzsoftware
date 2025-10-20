import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ExpandedFichaModal } from '@/components/ficha/ExpandedFichaModal';
import { ExpandedFichaPJModal } from '@/components/ficha/ExpandedFichaPJModal';

type PersonType = 'PF' | 'PJ' | null;

export default function FichaPrintPage() {
  const { cardId } = useParams<{ cardId: string }>();
  const navigate = useNavigate();
  const [personType, setPersonType] = useState<PersonType>(null);
  const [applicantId, setApplicantId] = useState<string | null>(null);
  const [basicInfo, setBasicInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'auto';
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!cardId) { setLoading(false); return; }
      try {
        const { data: card } = await (supabase as any)
          .from('kanban_cards')
          .select('id, person_type, applicant_id')
          .eq('id', cardId)
          .maybeSingle();
        if (!mounted) return;
        const ptype = (card as any)?.person_type || null;
        const aid = (card as any)?.applicant_id || null;
        setPersonType(ptype);
        setApplicantId(aid);
        if (ptype === 'PF' && aid) {
          const { data: a } = await (supabase as any)
            .from('applicants')
            .select('primary_name, cpf_cnpj, phone, email')
            .eq('id', aid)
            .maybeSingle();
          if (!mounted) return;
          setBasicInfo({
            nome: a?.primary_name || 'Cliente',
            cpf: a?.cpf_cnpj || '',
            telefone: a?.phone || '',
            whatsapp: a?.phone || '',
            nascimento: new Date().toISOString().slice(0,10),
            naturalidade: '',
            uf: '',
            email: a?.email || '',
          });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [cardId]);

  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
  }, [loading]);

  const handleClose = () => navigate('/inicio');
  const onRefetch = () => {};

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground print:hidden">
        Preparando visualização para impressão...
      </div>
    );
  }

  if (!cardId) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Ficha não encontrada
      </div>
    );
  }

  if (personType === 'PJ') {
    return (
      <div className="print-container">
        <ExpandedFichaPJModal
          open={true}
          onClose={handleClose}
          applicationId={cardId}
          onRefetch={onRefetch}
          applicantId={applicantId || undefined}
          asPage={true}
        />
      </div>
    );
  }

  return (
    <div className="print-container">
      <ExpandedFichaModal
        open={true}
        onClose={handleClose}
        onSubmit={async () => {}}
        basicInfo={basicInfo || { nome: 'Cliente', cpf: '', telefone: '', whatsapp: '', nascimento: new Date().toISOString().slice(0,10), naturalidade: '', uf: '', email: '' }}
        applicationId={cardId}
        applicantId={applicantId || undefined}
        onRefetch={onRefetch}
        asPage={true}
      />
    </div>
  );
}

