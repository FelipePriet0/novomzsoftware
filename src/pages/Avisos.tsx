import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/context/AuthContext';
import { useCurrentUser } from '@/hooks/use-current-user';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Megaphone, Paperclip, ThumbsUp, Eye, AlertCircle, Users, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type ReactionKey = 'like' | 'seen' | 'important';

type ChannelAttachment = { id: string; name: string; url?: string; size?: number; type?: string; storagePath?: string; file?: File };

type ChannelMessage = {
  id: string;
  title: string;
  body: string;
  createdAt: string; // ISO
  authorId: string;
  authorName: string;
  attachments?: ChannelAttachment[];
  reactions: Record<ReactionKey, string[]>; // arrays de userId
  links?: { label: string; href: string }[];
};

// Canal fixo #Avisos
export default function AvisosPage() {
  const { profile } = useAuth();
  const { name: currentUserName } = useCurrentUser();
  const isGestor = profile?.role === 'gestor';
  const [channelId, setChannelId] = useState<string | null>(null);
  const [audienceCount, setAudienceCount] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  // Estado local + integração
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkHref, setLinkHref] = useState('');
  const [composerAttachments, setComposerAttachments] = useState<ChannelAttachment[]>([]);
  const [dragActive, setDragActive] = useState(false);

  const stats = useMemo(() => {
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthMsgs = messages.filter(m => new Date(m.createdAt) >= startMonth);
    const total = monthMsgs.length;
    const reacted = monthMsgs.reduce((acc, m) => acc + (m.reactions.like?.length || 0), 0);
    const audience = audienceCount || 1;
    const confirmationPct = audience > 0 ? Math.round((reacted / (total || 1)) * 100) : 0;
    const last = messages[0];
    return {
      total,
      confirmationPct,
      lastInfo: last ? `${last.authorName} — ${format(new Date(last.createdAt), "dd/MM HH:mm", { locale: ptBR })}` : '—',
    };
  }, [messages, audienceCount]);

  // Carregar channelId, audience e feed inicial
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const { data: ch } = await supabase
          .from('channels')
          .select('id')
          .eq('slug', 'avisos')
          .maybeSingle();
        if (ch?.id) setChannelId(ch.id);

        // Audience ~ total profiles (ajuste conforme política)
        const { count } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true });
        if (typeof count === 'number' && count > 0) setAudienceCount(count);

        if (ch?.id) await loadMessages(ch.id);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Realtime para mensagens e reações
  useEffect(() => {
    if (!channelId) return;
    const channel = supabase
      .channel(`avisos-feed-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'channel_messages' }, (payload) => {
        // Filtrar por canal
        const row: any = payload.new || payload.old;
        if (row?.channel_id === channelId) loadMessages(channelId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'channel_reactions' }, () => {
        loadMessages(channelId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'channel_attachments' }, () => {
        loadMessages(channelId);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [channelId]);

  const loadMessages = async (chId: string) => {
    try {
      const { data: msgs } = await supabase
        .from('channel_messages')
        .select('id, title, body, links, created_at, author:author_id ( id, full_name )')
        .eq('channel_id', chId)
        .order('created_at', { ascending: false });
      const ids = (msgs || []).map((m: any) => m.id);
      const [attRes, reactRes] = await Promise.all([
        ids.length ? supabase.from('channel_attachments').select('id, message_id, file_name, storage_path, mime_type, file_size').in('message_id', ids) : Promise.resolve({ data: [] as any[] }),
        ids.length ? supabase.from('channel_reactions').select('message_id, user_id, reaction') : Promise.resolve({ data: [] as any[] }),
      ]);

      const attachmentsByMsg = new Map<string, ChannelAttachment[]>();
      (attRes.data || []).forEach((a: any) => {
        const list = attachmentsByMsg.get(a.message_id) || [];
        list.push({ id: a.id, name: a.file_name, storagePath: a.storage_path, size: a.file_size, type: a.mime_type });
        attachmentsByMsg.set(a.message_id, list);
      });

      const reactionsByMsg = new Map<string, Record<ReactionKey, string[]>>();
      (reactRes.data || []).forEach((r: any) => {
        const map = reactionsByMsg.get(r.message_id) || { like: [], seen: [], important: [] };
        (map as any)[r.reaction] = [ ...(map as any)[r.reaction] || [], r.user_id ];
        reactionsByMsg.set(r.message_id, map);
      });

      const normalized: ChannelMessage[] = (msgs || []).map((m: any) => ({
        id: m.id,
        title: m.title,
        body: m.body,
        createdAt: m.created_at,
        authorId: m.author?.id || '',
        authorName: m.author?.full_name || 'Usuário',
        attachments: attachmentsByMsg.get(m.id) || [],
        reactions: reactionsByMsg.get(m.id) || { like: [], seen: [], important: [] },
        links: Array.isArray(m.links) ? m.links : [],
      }));
      setMessages(normalized);
    } catch (e) {
      // silent
    }
  };

  const publish = async () => {
    if (!isGestor) return;
    const t = title.trim();
    const b = body.trim();
    if (!t || !b) {
      toast({ title: 'Preencha título e descrição', variant: 'destructive' });
      return;
    }
    if (!channelId || !profile?.id) {
      toast({ title: 'Canal não inicializado', variant: 'destructive' });
      return;
    }
    try {
      const links = (linkLabel && linkHref) ? [{ label: linkLabel, href: linkHref }] : [];
      const { data: created, error } = await supabase
        .from('channel_messages')
        .insert({ channel_id: channelId, author_id: profile.id, title: t, body: b, links })
        .select('id')
        .single();
      if (error) throw error;
      const messageId = created.id as string;

      // Upload anexos
      for (const att of composerAttachments) {
        if (!att.file) continue;
        const path = `avisos/${messageId}/${encodeURIComponent(att.file.name)}`;
        const up = await supabase.storage.from('channel-attachments').upload(path, att.file, { upsert: true });
        if (!up.error) {
          await supabase.from('channel_attachments').insert({
            message_id: messageId,
            file_name: att.file.name,
            storage_path: path,
            mime_type: att.file.type,
            file_size: att.file.size,
          });
        }
      }
      setTitle(''); setBody(''); setLinkHref(''); setLinkLabel(''); setComposerAttachments([]);
      await loadMessages(channelId);
      toast({ title: 'Aviso publicado' });
    } catch (e: any) {
      toast({ title: 'Erro ao publicar', description: e?.message || String(e), variant: 'destructive' });
    }
  };

  const react = async (id: string, key: ReactionKey) => {
    if (!profile?.id) return;
    try {
      // toggle: tenta excluir; se não excluiu, insere
      const del = await supabase
        .from('channel_reactions')
        .delete()
        .eq('message_id', id)
        .eq('user_id', profile.id)
        .eq('reaction', key);
      const deleted = (del?.count || 0) > 0;
      if (!deleted) {
        await supabase.from('channel_reactions').insert({ message_id: id, user_id: profile.id, reaction: key });
      }
      if (channelId) await loadMessages(channelId);
    } catch (e) {
      // ignore
    }
  };

  const allAttachments = useMemo(() => (
    messages.flatMap(m => (m.attachments || []).map(a => ({ ...a, messageId: m.id, messageTitle: m.title })))
  ), [messages]);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next: ChannelAttachment[] = [];
    Array.from(files).forEach(f => {
      const url = URL.createObjectURL(f);
      next.push({ id: crypto.randomUUID(), name: f.name, url, size: f.size, type: f.type, file: f });
    });
    setComposerAttachments(prev => [...prev, ...next]);
  }, []);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

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

      <div>
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
                    <div
                      onDragOver={onDragOver}
                      onDragLeave={onDragLeave}
                      onDrop={onDrop}
                      className={`rounded-md border ${dragActive ? 'border-[#018942] bg-[#018942]/5' : 'border-input'} transition-colors`}
                    >
                      <Textarea
                        rows={4}
                        placeholder="Descrição clara e objetiva — arraste anexos aqui"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        className="placeholder:text-[#018942] text-[#018942] border-0 focus-visible:ring-0"
                      />
                      {composerAttachments.length > 0 && (
                        <div className="px-3 pb-3">
                          <div className="text-xs text-muted-foreground mb-1">Anexos:</div>
                          <div className="flex flex-col gap-2">
                            {composerAttachments.map(att => (
                              <div key={att.id} className="flex items-center justify-between gap-3 rounded-md border px-2 py-1">
                                <div className="flex min-w-0 items-center gap-2">
                                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                                  <div className="min-w-0">
                                    <div className="truncate text-sm">{att.name}</div>
                                    <div className="truncate text-xs text-muted-foreground">{att.size ? (Math.round(att.size/1024))+' KB' : ''}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  {att.url && (
                                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => window.open(att.url, '_blank')}>Pré-visualizar</Button>
                                  )}
                                  {att.url && (
                                    <a href={att.url} download className="text-sm px-2 py-1 rounded-md hover:underline">Baixar</a>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
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
                    <div className="flex items-center justify-end">
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
                      <div className="flex flex-col gap-2 text-xs text-muted-foreground">
                        {m.attachments.map(a => (
                          <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1">
                            <span className="inline-flex items-center gap-1"><Paperclip className="h-3 w-3" /> {a.name}</span>
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={async () => {
                                if (a.url) { window.open(a.url, '_blank'); return; }
                                if (a.storagePath) {
                                  const { data } = await supabase.storage.from('channel-attachments').createSignedUrl(a.storagePath, 60);
                                  if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                                }
                              }}>Pré-visualizar</Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={async () => {
                                if (a.storagePath) {
                                  const { data } = await supabase.storage.from('channel-attachments').createSignedUrl(a.storagePath, 60);
                                  if (data?.signedUrl) {
                                    const link = document.createElement('a');
                                    link.href = data.signedUrl;
                                    link.download = a.name;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                  }
                                }
                              }}>Baixar</Button>
                            </div>
                          </div>
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
      </div>
    </div>
  );
}
