
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
export default function Profile() {
  const { user, profile, signOut } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("-");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const email = user?.email ?? "-";
  const role = profile?.role ?? "-";
  const navigate = useNavigate();

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
  }, [profile?.full_name]);

  useEffect(() => {
    // Opcional: se seu perfil já armazena avatar_url (não tipado no Profile local),
    // tentamos ler direto para iniciar o estado do campo.
    // Se não existir a coluna, nada acontece.
    (async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.avatar_url) setAvatarUrl(data.avatar_url as string);
    })();
  }, [user?.id]);

  useEffect(() => {
    // Empresa não é mais exibida por ausência do relacionamento no schema atual
    setCompanyName("-");
  }, [profile?.full_name]);

  const roleLabel = useMemo(() => {
    if (role === "analista") return "Analista";
    if (role === "vendedor") return "Vendedor";
    if (role === "gestor") return "Gestor";
    return "-";
  }, [role]);

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!user?.id) {
        toast({ title: "Você precisa estar autenticado." });
        return;
      }
      setUploading(true);
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext ?? "png"}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, {
          upsert: true,
          contentType: file.type || "image/*",
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      if (data?.publicUrl) {
        setAvatarUrl(data.publicUrl);
        toast({ title: "Avatar enviado com sucesso." });
      }
    } catch (e: any) {
      toast({ title: "Falha no upload do avatar", description: e?.message ?? "Tente novamente." });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSave() {
    if (!user?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("update_profile", {
        p_full_name: fullName,
        p_avatar_url: avatarUrl,
      });

      if (error) throw error;
      toast({ title: "Perfil atualizado com sucesso." });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e?.message ?? "Tente novamente." });
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoutConfirm() {
    setLoggingOut(true);
    try {
      await signOut();
      toast({ title: "Você saiu com sucesso." });
      navigate("/auth", { replace: true });
    } catch (e: any) {
      toast({ title: "Falha ao sair", description: e?.message ?? "Tente novamente." });
    } finally {
      setLoggingOut(false);
    }
  }

  if (!user) {
    return (
      <main className="p-6">
        <Card className="bg-white text-[#018942]">
          <CardHeader>
            <CardTitle>Perfil</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Você precisa estar autenticado para ver seu perfil.</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Header com gradiente moderno */}
      <div className="bg-gradient-to-br from-[#018942] via-[#016b35] to-[#014d28] text-white shadow-xl">
        <div className="relative overflow-hidden">
          <div className='absolute inset-0 bg-[url("data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.05%22%3E%3Ccircle cx=%2230%22 cy=%2230%22 r=%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")] opacity-20'></div>
          <div className="relative px-6 py-8">
            <div className="mx-auto max-w-4xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                  <Avatar className="h-12 w-12 border-2 border-white/30">
                    <AvatarImage src={avatarUrl} alt={`Avatar de ${fullName || email}`} />
                    <AvatarFallback className="bg-white/20 text-white font-semibold">
                      {(fullName || email || "-").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Seu Perfil</h1>
                  <p className="text-green-100 text-sm">
                    Gerencie suas informações pessoais e configurações
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="px-6 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Seção: Informações do Avatar */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              Foto do Perfil
            </h2>
            <div className="flex items-center gap-6">
              <div className="relative">
                <Avatar className="h-20 w-20 border-4 border-gray-200 shadow-lg">
                  <AvatarImage src={avatarUrl} alt={`Avatar de ${fullName || email}`} />
                  <AvatarFallback className="bg-gradient-to-br from-[#018942] to-[#016b35] text-white text-xl font-bold">
                    {(fullName || email || "-").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {avatarUrl && (
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <div className="w-3 h-3 bg-white rounded-full"></div>
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={triggerFileSelect} 
                    disabled={uploading}
                    className="bg-white hover:bg-gray-50 text-gray-700 border-gray-300 hover:border-gray-400 rounded-lg transition-all duration-200"
                  >
                    {uploading ? "Enviando..." : "Alterar Foto"}
                  </Button>
                  {avatarUrl && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setAvatarUrl("")} 
                      disabled={uploading}
                      className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200 hover:border-red-300 rounded-lg transition-all duration-200"
                    >
                      Remover
                    </Button>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  Imagem pública. Recomendado 256x256px. Formatos: JPG, PNG, GIF.
                </p>
              </div>
            </div>
          </div>

          {/* Seção: Informações Pessoais */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Informações Pessoais
            </h2>
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="full_name" className="text-sm font-medium text-gray-700">Nome completo</Label>
                  <Input
                    id="full_name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome completo"
                    className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
                  />
                </div>
                <div>
                  <Label htmlFor="avatar_url" className="text-sm font-medium text-gray-700">URL do Avatar (opcional)</Label>
                  <Input
                    id="avatar_url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://exemplo.com/avatar.jpg"
                    className="mt-1 rounded-lg border-gray-300 focus:border-[#018942] focus:ring-[#018942] text-gray-900 placeholder-gray-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Seção: Informações da Conta */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              Informações da Conta
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">E-mail</Label>
                <Input 
                  id="email" 
                  value={email} 
                  readOnly 
                  className="mt-1 rounded-lg border-gray-300 bg-gray-100 text-gray-700 cursor-not-allowed"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">Função</Label>
                <Input 
                  value={roleLabel} 
                  readOnly 
                  className="mt-1 rounded-lg border-gray-300 bg-gray-100 text-gray-700 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Seção: Ações */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              Ações
            </h2>
            <div className="flex gap-4 pt-4 border-t border-gray-200">
              <Button 
                onClick={handleSave} 
                disabled={saving || uploading} 
                className="bg-gradient-to-r from-[#018942] to-[#016b35] hover:from-[#016b35] hover:to-[#014d28] text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar Alterações"}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    disabled={loggingOut}
                    className="bg-white hover:bg-gray-50 text-gray-700 border-gray-300 hover:border-gray-400 rounded-lg transition-all duration-200"
                  >
                    {loggingOut ? "Saindo..." : "Sair da Conta"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Deseja sair da sua conta?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Você precisará fazer login novamente para acessar o sistema.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel 
                      disabled={loggingOut} 
                      className="bg-gray-500 hover:bg-gray-600 text-white border-gray-500 hover:border-gray-600"
                    >
                      Cancelar
                    </AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleLogoutConfirm} 
                      disabled={loggingOut}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      {loggingOut ? "Saindo..." : "Sim, Sair"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <p className="text-sm text-gray-500 mt-4 p-3 bg-gray-50 rounded-lg">
              <strong>Observação:</strong> O avatar enviado é público no bucket "avatars". Mantenha suas informações sempre atualizadas.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
