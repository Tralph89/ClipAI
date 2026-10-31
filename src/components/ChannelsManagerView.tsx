import React, { useState } from 'react';
import {
  Radio,
  Plus,
  Check,
  Webhook,
  Send,
  Trash2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Globe,
  Tv,
} from 'lucide-react';
import {
  AspectRatioType,
  SOCIAL_PLATFORMS,
  SocialChannel,
  SocialPlatformId,
} from '../types';
import { dispatchChannelWebhook } from '../services/geminiService';

interface ChannelsManagerViewProps {
  channels: SocialChannel[];
  activeChannelId: string;
  onSelectChannel: (id: string) => void;
  onSaveChannels: (channels: SocialChannel[]) => void;
}

export const ChannelsManagerView: React.FC<ChannelsManagerViewProps> = ({
  channels,
  activeChannelId,
  onSelectChannel,
  onSaveChannels,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [niche, setNiche] = useState('');
  const [tone, setTone] = useState('Dinámico, directo y con alto impacto visual');
  const [defaultAspectRatio, setDefaultAspectRatio] = useState<AspectRatioType>('9:16');
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatformId[]>([
    'tiktok',
    'youtube_shorts',
    'instagram_reels',
  ]);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [testingChannelId, setTestingChannelId] = useState<string | null>(null);
  const [webhookStatus, setWebhookStatus] = useState<Record<string, { ok: boolean; msg: string }>>(
    {}
  );

  const togglePlatform = (id: SocialPlatformId) => {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleCreateChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const colors = ['#7C3AED', '#10B981', '#F59E0B', '#EC4899', '#3B82F6'];
    const newChan: SocialChannel = {
      id: `channel-${Date.now()}`,
      name: name.trim(),
      handle: handle.trim().startsWith('@') ? handle.trim() : `@${handle.trim() || name.toLowerCase().replace(/\s+/g, '')}`,
      niche: niche.trim() || 'Tendencias y Contenido Viral',
      tone: tone.trim(),
      defaultAspectRatio,
      platforms: selectedPlatforms.length ? selectedPlatforms : ['tiktok', 'youtube_shorts'],
      webhookUrl: webhookUrl.trim(),
      accentColor: colors[channels.length % colors.length],
      subscribersCount: 'Nuevo Canal',
    };

    const updated = [...channels, newChan];
    onSaveChannels(updated);
    onSelectChannel(newChan.id);
    setIsCreating(false);
    setName('');
    setHandle('');
    setNiche('');
    setWebhookUrl('');
  };

  const handleUpdateWebhook = (channelId: string, url: string) => {
    const updated = channels.map((c) => (c.id === channelId ? { ...c, webhookUrl: url } : c));
    onSaveChannels(updated);
  };

  const handleToggleChannelPlatform = (channelId: string, platId: SocialPlatformId) => {
    const updated = channels.map((c) => {
      if (c.id !== channelId) return c;
      const exists = c.platforms.includes(platId);
      const nextPlats = exists
        ? c.platforms.filter((p) => p !== platId)
        : [...c.platforms, platId];
      return { ...c, platforms: nextPlats.length ? nextPlats : [platId] };
    });
    onSaveChannels(updated);
  };

  const handleTestWebhook = async (channel: SocialChannel) => {
    if (!channel.webhookUrl) {
      setWebhookStatus((prev) => ({
        ...prev,
        [channel.id]: {
          ok: false,
          msg: 'Ingresa una URL https:// de Make, Zapier, n8n o tu servidor para probar el envío.',
        },
      }));
      return;
    }

    setTestingChannelId(channel.id);
    try {
      const res = await dispatchChannelWebhook(channel.webhookUrl, {
        channelId: channel.id,
        channelName: channel.name,
        handle: channel.handle,
        platforms: channel.platforms,
        testMode: true,
        message: 'Prueba de conexión multi-canal desde ClipAI Studio',
      });
      setWebhookStatus((prev) => ({
        ...prev,
        [channel.id]: {
          ok: res.success,
          msg: `Conectado (HTTP ${res.status}). El endpoint recibió el payload correctamente.`,
        },
      }));
    } catch (err: any) {
      setWebhookStatus((prev) => ({
        ...prev,
        [channel.id]: {
          ok: false,
          msg: err.message || 'Fallo al conectar con el Webhook.',
        },
      }));
    } finally {
      setTestingChannelId(null);
    }
  };

  const handleDeleteChannel = (id: string) => {
    if (channels.length <= 1) return;
    const updated = channels.filter((c) => c.id !== id);
    onSaveChannels(updated);
    if (activeChannelId === id && updated[0]) {
      onSelectChannel(updated[0].id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#11131C] border border-white/10 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-violet-400 block mb-1">
            Centro Multi-Canal & Automatización API
          </span>
          <h1 className="text-2xl font-bold text-white">Mis Canales de Redes Sociales</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Configura el nicho, formato predeterminado, redes conectadas y Webhooks de publicación automática por cada canal.
          </p>
        </div>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-2 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Nuevo Canal Social
        </button>
      </div>

      {isCreating && (
        <form
          onSubmit={handleCreateChannel}
          className="bg-[#11131C] border border-violet-500/40 rounded-2xl p-6 space-y-5"
        >
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" /> Configurar Nuevo Canal
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-zinc-400 block mb-1.5">Nombre del Canal</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Mente Millonaria IA"
                className="w-full bg-[#090A0F] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1.5">Usuario / Handle</label>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="@mentemillonaria"
                className="w-full bg-[#090A0F] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1.5">Formato Principal</label>
              <select
                value={defaultAspectRatio}
                onChange={(e) => setDefaultAspectRatio(e.target.value as AspectRatioType)}
                className="w-full bg-[#090A0F] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono"
              >
                <option value="9:16">9:16 Vertical (TikTok / Shorts / Reels)</option>
                <option value="16:9">16:9 Horizontal (YouTube Largo)</option>
                <option value="1:1">1:1 Cuadrado (LinkedIn / Feed)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-400 block mb-1.5">
                Nicho Temático (Usado por el Radar de Tendencias)
              </label>
              <input
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="Ej. Inteligencia Artificial, Productividad y Negocios Digitales"
                className="w-full bg-[#090A0F] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1.5">Tono Editorial de Voz y Guion</label>
              <input
                type="text"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                placeholder="Ej. Directo, provocador, educativo con datos"
                className="w-full bg-[#090A0F] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-400 block mb-2">Redes Sociales Destino</label>
            <div className="flex flex-wrap gap-2">
              {SOCIAL_PLATFORMS.map((plat) => {
                const active = selectedPlatforms.includes(plat.id);
                return (
                  <button
                    type="button"
                    key={plat.id}
                    onClick={() => togglePlatform(plat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                      active
                        ? 'bg-violet-600/20 border-violet-500 text-white'
                        : 'bg-[#090A0F] border-white/10 text-zinc-400'
                    }`}
                  >
                    {active && <Check className="w-3.5 h-3.5 text-violet-400" />}
                    {plat.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-400 block mb-1.5">
              Webhook URL de Publicación (Make / Zapier / n8n / API propia - Opcional)
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hook.us1.make.com/tu-webhook-multicanal"
              className="w-full bg-[#090A0F] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold cursor-pointer"
            >
              Guardar Canal
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {channels.map((channel) => {
          const isCurrent = channel.id === activeChannelId;
          const status = webhookStatus[channel.id];
          return (
            <div
              key={channel.id}
              className={`bg-[#11131C] rounded-2xl p-6 border transition-all space-y-5 ${
                isCurrent ? 'border-violet-500 shadow-lg shadow-violet-950/20' : 'border-white/10'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shrink-0"
                    style={{ backgroundColor: channel.accentColor }}
                  >
                    {channel.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-white">{channel.name}</h3>
                      {isCurrent && (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold">
                          CANAL ACTIVO
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono text-zinc-400">
                      {channel.handle} • Formato base: {channel.defaultAspectRatio}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!isCurrent && (
                    <button
                      onClick={() => onSelectChannel(channel.id)}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-violet-600 text-zinc-200 hover:text-white text-xs font-semibold transition-all cursor-pointer"
                    >
                      Activar Canal
                    </button>
                  )}
                  {channels.length > 1 && (
                    <button
                      onClick={() => handleDeleteChannel(channel.id)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-all cursor-pointer"
                      title="Eliminar canal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-[#090A0F] border border-white/5 rounded-xl p-3.5 space-y-2 text-xs">
                <div>
                  <span className="text-zinc-500 font-mono uppercase text-[10px] block">
                    Nicho de Búsqueda de Tendencias:
                  </span>
                  <span className="text-zinc-200 font-medium">{channel.niche}</span>
                </div>
                <div>
                  <span className="text-zinc-500 font-mono uppercase text-[10px] block">
                    Tono Editorial IA:
                  </span>
                  <span className="text-zinc-300">{channel.tone}</span>
                </div>
              </div>

              {/* Connected Platforms */}
              <div>
                <span className="text-[11px] font-mono uppercase text-zinc-400 block mb-2">
                  Redes Conectadas (Click para activar/desactivar):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {SOCIAL_PLATFORMS.map((plat) => {
                    const active = channel.platforms.includes(plat.id);
                    return (
                      <button
                        key={plat.id}
                        onClick={() => handleToggleChannelPlatform(channel.id, plat.id)}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer ${
                          active
                            ? plat.badgeColor
                            : 'bg-[#090A0F] border-white/5 text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {plat.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Webhook Endpoint Config */}
              <div className="pt-3 border-t border-white/10 space-y-2">
                <label className="text-[11px] font-mono uppercase text-zinc-400 flex items-center gap-1.5">
                  <Webhook className="w-3.5 h-3.5 text-violet-400" /> Endpoint de Publicación Automática (Webhook / API):
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={channel.webhookUrl || ''}
                    onChange={(e) => handleUpdateWebhook(channel.id, e.target.value)}
                    placeholder="https://hook.make.com/... o endpoint de tu automatización"
                    className="flex-1 bg-[#090A0F] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-violet-500"
                  />
                  <button
                    onClick={() => handleTestWebhook(channel)}
                    disabled={testingChannelId === channel.id}
                    className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {testingChannelId === channel.id ? 'Probando...' : 'Probar API'}
                  </button>
                </div>
                {status && (
                  <p
                    className={`text-xs flex items-center gap-1.5 mt-1 ${
                      status.ok ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {status.ok ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>{status.msg}</span>
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
