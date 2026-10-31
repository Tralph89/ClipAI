import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Send,
  CheckCircle2,
  Copy,
  Check,
  Download,
  Trash2,
  ExternalLink,
  Share2,
  Film,
  Sparkles,
} from 'lucide-react';
import {
  Project,
  ScheduledPost,
  SOCIAL_PLATFORMS,
  SocialChannel,
  SocialPlatformId,
} from '../types';
import { dispatchChannelWebhook } from '../services/geminiService';

interface CalendarHubViewProps {
  channels: SocialChannel[];
  activeChannel: SocialChannel;
  projects: Project[];
  scheduledPosts: ScheduledPost[];
  onUpdateScheduledPosts: (posts: ScheduledPost[]) => void;
  onOpenProjectInStudio: (project: Project) => void;
}

export const CalendarHubView: React.FC<CalendarHubViewProps> = ({
  channels,
  activeChannel,
  projects,
  scheduledPosts,
  onUpdateScheduledPosts,
  onOpenProjectInStudio,
}) => {
  const [selectedPlatformTab, setSelectedPlatformTab] = useState<SocialPlatformId>('tiktok');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [publishingPostId, setPublishingPostId] = useState<string | null>(null);
  const [filterChannelId, setFilterChannelId] = useState<string>('all');

  const handleCopyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handlePublishNowViaWebhook = async (post: ScheduledPost) => {
    const channel = channels.find((c) => c.id === post.channelId) || activeChannel;
    const project = projects.find((p) => p.id === post.projectId);

    setPublishingPostId(post.id);
    try {
      if (channel.webhookUrl && channel.webhookUrl.startsWith('http')) {
        const res = await dispatchChannelWebhook(channel.webhookUrl, {
          postId: post.id,
          projectTitle: post.projectTitle,
          channelName: channel.name,
          handle: channel.handle,
          platforms: post.platforms,
          aspectRatio: post.aspectRatio,
          scheduledAt: post.scheduledAt,
          marketingMetadata: project?.state.metadata || {},
          script: project?.state.script || '',
        });

        const updated = scheduledPosts.map((p) =>
          p.id === post.id
            ? {
                ...p,
                status: 'published' as const,
                webhookLog: `Publicado vía Webhook (HTTP ${res.status}) - ${new Date().toLocaleTimeString()}`,
              }
            : p
        );
        onUpdateScheduledPosts(updated);
      } else {
        // Mark as published locally with note that direct package is ready
        const updated = scheduledPosts.map((p) =>
          p.id === post.id
            ? {
                ...p,
                status: 'published' as const,
                webhookLog: `Marcado como publicado (${new Date().toLocaleTimeString()}). Paquete listo para redes.`,
              }
            : p
        );
        onUpdateScheduledPosts(updated);
      }
    } catch (err: any) {
      const updated = scheduledPosts.map((p) =>
        p.id === post.id
          ? {
              ...p,
              status: 'failed' as const,
              webhookLog: err.message || 'Error al despachar Webhook',
            }
          : p
      );
      onUpdateScheduledPosts(updated);
    } finally {
      setPublishingPostId(null);
    }
  };

  const handleDeletePost = (id: string) => {
    onUpdateScheduledPosts(scheduledPosts.filter((p) => p.id !== id));
  };

  const visiblePosts =
    filterChannelId === 'all'
      ? scheduledPosts
      : scheduledPosts.filter((p) => p.channelId === filterChannelId);

  return (
    <div className="space-y-6">
      {/* Header & Metrics */}
      <div className="bg-[#11131C] border border-white/10 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 block mb-1">
            Calendario Editorial & Despacho Multi-Red
          </span>
          <h1 className="text-2xl font-bold text-white">Centro de Publicación y Programación</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Gestiona la cola de videos generados, obtén el copy optimizado para cada red social y publica mediante Webhook o descarga directa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterChannelId}
            onChange={(e) => setFilterChannelId(e.target.value)}
            className="bg-[#090A0F] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white font-medium"
          >
            <option value="all">Todos los canales ({scheduledPosts.length})</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.handle})
              </option>
            ))}
          </select>

          <div className="flex items-center gap-4 bg-[#090A0F] border border-white/10 rounded-xl px-4 py-2 text-xs font-mono">
            <div>
              <span className="text-zinc-500">Programados: </span>
              <span className="text-amber-400 font-bold tabular-nums">
                {scheduledPosts.filter((p) => p.status === 'scheduled').length}
              </span>
            </div>
            <div className="h-3 w-[1px] bg-white/10" />
            <div>
              <span className="text-zinc-500">Publicados: </span>
              <span className="text-emerald-400 font-bold tabular-nums">
                {scheduledPosts.filter((p) => p.status === 'published').length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Platform Copy Inspector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs font-mono text-zinc-400 mr-1 shrink-0">
          Previsualizar Copy por Red:
        </span>
        {SOCIAL_PLATFORMS.map((plat) => (
          <button
            key={plat.id}
            onClick={() => setSelectedPlatformTab(plat.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0 ${
              selectedPlatformTab === plat.id
                ? 'bg-violet-600 text-white border-violet-500'
                : 'bg-[#11131C] text-zinc-400 border-white/10 hover:text-white'
            }`}
          >
            {plat.name}
          </button>
        ))}
      </div>

      {/* Scheduled Queue List */}
      {visiblePosts.length === 0 ? (
        <div className="bg-[#11131C] border border-white/10 rounded-2xl p-12 text-center space-y-3">
          <Calendar className="w-10 h-10 text-zinc-600 mx-auto" />
          <h3 className="text-base font-bold text-white">
            Aún no hay videos programados en el calendario
          </h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Genera un video desde el Radar de Tendencias o el Estudio IA y haz clic en «Programar en Calendario» en la sección 7 (Marketing & Publicación).
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visiblePosts.map((post) => {
            const channel = channels.find((c) => c.id === post.channelId) || activeChannel;
            const project = projects.find((p) => p.id === post.projectId);
            const platCopy = project?.state.metadata?.platformCopy?.[selectedPlatformTab];

            const statusColors = {
              draft: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
              scheduled: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
              published: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
              failed: 'bg-red-500/15 text-red-400 border-red-500/30',
            };

            const statusLabels = {
              draft: 'BORRADOR',
              scheduled: 'PROGRAMADO',
              published: 'PUBLICADO',
              failed: 'ERROR WEBHOOK',
            };

            return (
              <div
                key={post.id}
                className="bg-[#11131C] border border-white/10 rounded-2xl p-5 flex flex-col xl:flex-row gap-6 justify-between"
              >
                {/* Left Column: Video & Channel Info */}
                <div className="flex flex-col sm:flex-row gap-4 xl:w-2/5">
                  <div className="w-28 h-40 sm:w-28 sm:h-44 rounded-xl bg-[#090A0F] border border-white/10 overflow-hidden shrink-0 relative flex items-center justify-center">
                    {post.thumbnailUrl || project?.scenes?.[0]?.imageUrl ? (
                      <img
                        src={post.thumbnailUrl || project?.scenes?.[0]?.imageUrl}
                        alt={post.projectTitle}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Film className="w-7 h-7 text-zinc-600" />
                    )}
                    <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono font-bold text-white">
                      {post.aspectRatio}
                    </span>
                  </div>

                  <div className="space-y-2.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${statusColors[post.status]}`}
                      >
                        {statusLabels[post.status]}
                      </span>
                      <span className="text-xs font-mono text-zinc-400 flex items-center gap-1 tabular-nums">
                        <Clock className="w-3.5 h-3.5 text-violet-400" />
                        {new Date(post.scheduledAt).toLocaleString('es-ES', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white leading-snug">
                      {post.projectTitle}
                    </h3>

                    <div className="text-xs text-zinc-400">
                      Canal:{' '}
                      <span className="text-white font-semibold">{channel.name}</span>{' '}
                      <span className="font-mono text-zinc-500">({channel.handle})</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {post.platforms.map((pid) => {
                        const pInfo = SOCIAL_PLATFORMS.find((sp) => sp.id === pid);
                        if (!pInfo) return null;
                        return (
                          <span
                            key={pid}
                            className={`text-[10px] px-2 py-0.5 rounded border font-medium ${pInfo.badgeColor}`}
                          >
                            {pInfo.shortName}
                          </span>
                        );
                      })}
                    </div>

                    {post.webhookLog && (
                      <p className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1">
                        {post.webhookLog}
                      </p>
                    )}
                  </div>
                </div>

                {/* Middle Column: Platform-Tailored Copy Preview */}
                <div className="xl:w-2/5 bg-[#090A0F] border border-white/5 rounded-xl p-4 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-mono uppercase text-violet-400 font-semibold">
                        Copy Adaptado —{' '}
                        {SOCIAL_PLATFORMS.find((p) => p.id === selectedPlatformTab)?.name}
                      </span>
                      <button
                        onClick={() => {
                          const textToCopy = platCopy
                            ? `${platCopy.title}\n\n${platCopy.caption}\n\n${platCopy.hashtags
                                .map((h) => (h.startsWith('#') ? h : `#${h}`))
                                .join(' ')}`
                            : `${project?.state.metadata?.title || post.projectTitle}\n\n${
                                project?.state.metadata?.description || ''
                              }`;
                          handleCopyText(`${post.id}-${selectedPlatformTab}`, textToCopy);
                        }}
                        className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === `${post.id}-${selectedPlatformTab}` ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar Texto</span>
                          </>
                        )}
                      </button>
                    </div>

                    {platCopy ? (
                      <div className="space-y-1.5 text-xs">
                        <p className="font-bold text-white">{platCopy.title}</p>
                        <p className="text-zinc-300 line-clamp-3 leading-relaxed">
                          {platCopy.caption}
                        </p>
                        <p className="text-violet-400 font-mono text-[11px]">
                          {platCopy.hashtags
                            .map((h) => (h.startsWith('#') ? h : `#${h}`))
                            .join(' ')}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-400">
                        {project?.state.metadata?.description ||
                          'Abre el proyecto en la sección 7 para generar el copy específico por red social.'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Column: Actions */}
                <div className="flex xl:flex-col justify-end gap-2 shrink-0">
                  <button
                    onClick={() => handlePublishNowViaWebhook(post)}
                    disabled={publishingPostId === post.id}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {publishingPostId === post.id
                      ? 'Publicando...'
                      : channel.webhookUrl
                      ? 'Publicar vía Webhook'
                      : 'Marcar Publicado'}
                  </button>

                  {project && (
                    <button
                      onClick={() => onOpenProjectInStudio(project)}
                      className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Abrir en Estudio
                    </button>
                  )}

                  {(post.renderedVideoUrl || project?.state.renderedVideoUrl) && (
                    <a
                      href={post.renderedVideoUrl || project?.state.renderedVideoUrl}
                      download={`${post.projectTitle.replace(/\s+/g, '_')}.webm`}
                      className="px-4 py-2 rounded-xl bg-violet-600/20 border border-violet-500/40 text-violet-300 hover:bg-violet-600 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Descargar Video
                    </a>
                  )}

                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 flex items-center justify-center cursor-pointer"
                    title="Eliminar de la cola"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
