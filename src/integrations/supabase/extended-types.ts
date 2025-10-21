import type { Database as BaseDatabase, Json } from './types';

// Extend the generated Supabase Database type with tables that are used
// in the codebase but not present in the generated types file.

type KCRow = {
  id: string;
  area?: string | null;
  stage?: string | null;
  person_type?: string | null;
  assignee_id?: string | null;
  created_by?: string | null;
  received_at?: string | null;
  due_at?: string | null;
  applicant_id?: string | null;
  // Legacy/comment fields used in UI
  comments?: string | null;
  comments_short?: string | null;
  // Reanalysis notes can be stored either as JSON or string (legacy)
  reanalysis_notes?: Json | string | null;
};

type InboxNotificationRow = {
  user_id: string;
  type: string;
  priority: string;
  title: string;
  body: string;
  applicant_id?: string | null;
  meta?: Json | null;
  transient?: boolean | null;
};

type ApplicantRow = {
  id: string;
  primary_name?: string | null;
  cpf_cnpj?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  uf?: string | null;
  address_line?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  bairro?: string | null;
  cep?: string | null;
  whatsapp?: string | null;
  plano_acesso?: string | null;
  venc?: number | null;
  carne_impresso?: boolean | null;
  sva_avulso?: string | null;
  info_spc?: string | null;
  info_pesquisador?: string | null;
  info_relevantes?: string | null;
  info_mk?: string | null;
  parecer_analise?: string | null;
};

export type ExtendedDatabase = BaseDatabase & {
  public: BaseDatabase['public'] & {
    Tables: BaseDatabase['public']['Tables'] & {
      kanban_cards: {
        Row: KCRow;
        Insert: Partial<KCRow> & { id?: string };
        Update: Partial<KCRow>;
        Relationships: [];
      };
      inbox_notifications: {
        Row: InboxNotificationRow;
        Insert: InboxNotificationRow;
        Update: Partial<InboxNotificationRow>;
        Relationships: [];
      };
      applicants: {
        Row: ApplicantRow;
        Insert: Partial<ApplicantRow> & { id?: string };
        Update: Partial<ApplicantRow>;
        Relationships: [];
      };
    };
  };
};

