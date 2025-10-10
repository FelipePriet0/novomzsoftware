import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/context/AuthContext';
import { useCurrentUser } from '@/hooks/use-current-user';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Megaphone, Paperclip, ThumbsUp, Eye, AlertCircle, Users, CheckCircle2 } from 'lucide-react';

type ReactionKey = 'like' | 'seen' | 'important';

type ChannelMessage = {
  id: string;
  title: string;
  body: string;
  createdAt: string; // ISO
  authorId: string;
  authorName: string;
  attachments?: { id: string; name: string; url?: string }[];
  reactions: Record<ReactionKey, string[]>; // arrays de userId
  links?: { label: string; href: string }[];
};

// Canal fixo #Avisos
export default function AvisosPage() {
  const { profile } = useAuth();
  const { name: currentUserName } = useCurrentUser();
  const isGestor = profile?.role === 'gestor';

  // Estado local (placeholder). TODO: integrar com Supabase (channels/channel_messages/reactions)
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkHref, setLinkHref] = useState('');

  const stats = useMemo(() => {
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthMsgs = messages.filter(m => new Date(m.createdAt) >= startMonth);
    const total = monthMsgs.length;
    const reacted = monthMsgs.reduce((acc, m) => acc + (m.reactions.like?.length || 0), 0);
    const audience = 1; // TODO: substituir por total de colaboradores
    const confirmationPct = audience > 0 ? Math.round((reacted / (total || 1)) * 100) : 0;
    const last = messages[0];
    return {
      total,
      confirmationPct,
      lastInfo: last ? `${last.authorName} — ${format(new Date(last.createdAt), "dd/MM HH:mm", { locale: ptBR })}` : '—',
    };
  }, [messages]);

  const publish = () => {
    if (!isGestor) return;
    const t = title.trim();
    const b = body.trim();
    if (!t || !b) {
      toast({ title: 'Preencha título e descrição', variant: 'destructive' });
      return;
    }
    const msg: ChannelMessage = {
      id: crypto.randomUUID(),
      title: t,
      body: b,
      createdAt: new Date().toISOString(),
      authorId: profile?.id || 'user',
      authorName: currentUserName || profile?.full_name || 'Gestor',
      attachments: [],
      reactions: { like: [], seen: [], important: [] },
      links: linkHref && linkLabel ? [{ label: linkLabel, href: linkHref }] : undefined,
    };
    setMessages(prev => [msg, ...prev]);
    setTitle('');
    setBody('');
    setLinkHref('');
    setLinkLabel('');
    toast({ title: 'Aviso publicado' });
  };

  const react = (id: string, key: ReactionKey) => {
    if (!profile?.id) return;
    if (isGestor) {
      // Gestor pode reagir também, mas regra é focar colaboradores — manter simples
    }
    setMessages(prev => prev.map(m => {
      if (m.id !== id) return m;
      const set = new Set(m.reactions[key] || []);
      if (set.has(profile.id)) set.delete(profile.id); else set.add(profile.id);
      return { ...m, reactions: { ...m.reactions, [key]: Array.from(set) } };
    }));
  };

  const allAttachments = useMemo(() => (
    messages.flatMap(m => (m.attachments || []).map(a => ({ ...a, messageId: m.id, messageTitle: m.title })))
  ), [messages]);

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Megaphone className="h-6 w-6 text-[#018942]" />
          <h1 className="text-xl font-semibold">#Avisos — Comunicados Globais</h1>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="secondary" className="flex items-center gap-1"><AlertCircle className="h-4 w-4" /> {stats.total} no mês</Badge>
          <Badge variant="secondary" className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> {stats.confirmationPct}% confirmações</Badge>
          <Badge variant="outline" className="flex items-center gap-1"><Users className="h-4 w-4" /> Último: {stats.lastInfo}</Badge>
        </div>
      </div>

      <Tabs defaultValue="feed" className="">
        <TabsList className="mb-4">
          <TabsTrigger value="feed">Feed de Avisos</TabsTrigger>
          <TabsTrigger value="attachments">Anexos</TabsTrigger>
        </TabsList>

        <TabsContent value="feed">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {isGestor && (
                <Card>
                  <CardHeader>
                    <CardTitle>Publicar novo aviso</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Input
                      placeholder="Título (ex.: 🆕 Atualização do Processo de Instalação)"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="placeholder:text-[#018942] text-[#018942]"
                    />
                    <Textarea
                      rows={4}
                      placeholder="Descrição clara e objetiva"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      className="placeholder:text-[#018942] text-[#018942]"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <Input
                        placeholder="Rótulo do link (opcional)"
                        value={linkLabel}
                        onChange={(e)=> setLinkLabel(e.target.value)}
                        className="placeholder:text-[#018942] text-[#018942]"
                      />
                      <Input
                        placeholder="https://link-opcional"
                        value={linkHref}
                        onChange={(e)=> setLinkHref(e.target.value)}
                        className="placeholder:text-[#018942] text-[#018942]"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Button
                        variant="secondary"
                        className="gap-2 bg-gray-200 text-gray-700 hover:bg-gray-200 border-gray-300"
                        type="button"
                      >
                        <Paperclip className="h-4 w-4" /> Anexar (em breve)
                      </Button>
                      <Button onClick={publish} className="bg-[#018942] text-white hover:bg-[#018942]/90">Publicar aviso</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {messages.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-sm text-[#018942]">Nenhum aviso publicado ainda.</CardContent>
                </Card>
              )}

              {messages.map((m) => (
                <Card key={m.id}>
                  <CardHeader className="flex flex-row items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8"><AvatarFallback>{m.authorName?.slice(0,2)?.toUpperCase()}</AvatarFallback></Avatar>
                      <div>
                        <div className="text-sm font-semibold">{m.title}</div>
                        <div className="text-xs text-muted-foreground">{m.authorName} • {format(new Date(m.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.body}</div>
                    {!!m.links?.length && (
                      <div className="flex flex-wrap gap-2 text-sm">
                        {m.links.map((l, idx) => (
                          <a key={idx} href={l.href} target="_blank" rel="noreferrer" className="underline text-[#018942] hover:opacity-80">{l.label}</a>
                        ))}
                      </div>
                    )}
                    {!!m.attachments?.length && (
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {m.attachments.map(a => (
                          <span key={a.id} className="inline-flex items-center gap-1 rounded-md border px-2 py-1"><Paperclip className="h-3 w-3" /> {a.name}</span>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => react(m.id, 'like')} disabled={!profile || isGestor && false}><ThumbsUp className="h-4 w-4" /> {m.reactions.like?.length || 0}</Button>
                      <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => react(m.id, 'seen')} disabled={!profile}><Eye className="h-4 w-4" /> {m.reactions.seen?.length || 0}</Button>
                      <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => react(m.id, 'important')} disabled={!profile}><AlertCircle className="h-4 w-4" /> {m.reactions.important?.length || 0}</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Anexos do Canal</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {allAttachments.length === 0 && (
                    <div className="text-[#018942]">Nenhum anexo publicado.</div>
                  )}
                  {allAttachments.map(att => (
                    <div key={att.id} className="flex items-center justify-between gap-3 rounded-md border p-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                        <div className="min-w-0">
                          <div className="truncate">{att.name}</div>
                          <div className="truncate text-xs text-muted-foreground">em: {att.messageTitle}</div>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 px-2" disabled>Baixar</Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="attachments">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Todos os Anexos</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {allAttachments.length === 0 && (
                <div className="text-sm text-[#018942]">Nenhum anexo publicado.</div>
              )}
              {allAttachments.map(att => (
                <div key={att.id} className="flex items-center justify-between gap-3 rounded-md border p-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="truncate">{att.name}</div>
                      <div className="truncate text-xs text-muted-foreground">em: {att.messageTitle}</div>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 px-2" disabled>Baixar</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
