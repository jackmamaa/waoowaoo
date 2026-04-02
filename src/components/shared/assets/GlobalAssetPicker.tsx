'use client'
import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import ImagePreviewModal from '@/components/ui/ImagePreviewModal'
import TaskStatusInline from '@/components/task/TaskStatusInline'
import { resolveTaskPresentationState } from '@/lib/task/presentation'
import { MediaImageWithLoading } from '@/components/media/MediaImageWithLoading'
import { AppIcon } from '@/components/ui/icons'
import { apiFetch } from '@/lib/api-fetch'

interface GlobalAssetPickerProps {
    isOpen: boolean
    onClose: () => void
    onSelect: (globalAssetId: string) => void
    type: 'character' | 'location' | 'prop' | 'voice'
    loading?: boolean
}

interface GlobalFolder {
    id: string
    name: string
}

interface GlobalPickerCharacter {
    id: string
    name: string
    folderId: string | null
    folderName: string | null
    previewUrl: string | null
    appearanceCount: number
    hasVoice: boolean
}

interface GlobalPickerLocation {
    id: string
    name: string
    summary: string | null
    folderId: string | null
    folderName: string | null
    previewUrl: string | null
    imageCount: number
}

type GlobalPickerProp = GlobalPickerLocation

interface GlobalPickerVoice {
    id: string
    name: string
    description: string | null
    folderId: string | null
    folderName: string | null
    previewUrl: string | null
    voiceId: string | null
    voiceType: string
    gender: string | null
    language: string
}

// 内联 SVG 图标组件
const XMarkIcon = ({ className }: { className?: string }) => (
    <AppIcon name="close" className={className} />
)

const MagnifyingGlassIcon = ({ className }: { className?: string }) => (
    <AppIcon name="search" className={className} />
)

const UserIcon = ({ className }: { className?: string }) => (
    <AppIcon name="userAlt" className={className} />
)

const PhotoIcon = ({ className }: { className?: string }) => (
    <AppIcon name="image" className={className} />
)

const CheckCircleIcon = ({ className }: { className?: string }) => (
    <AppIcon name="badgeCheck" className={className} />
)


const MicrophoneIcon = ({ className }: { className?: string }) => (
    <AppIcon name="mic" className={className} />
)

export default function GlobalAssetPicker({
    isOpen,
    onClose,
    onSelect,
    type,
    loading: externalLoading
}: GlobalAssetPickerProps) {
    const t = useTranslations('assetPicker')

    const [selectedFolderId, setSelectedFolderId] = useState<'all' | string>('all')

    const foldersQuery = useQuery({
        queryKey: ['asset-hub-folders', 'picker'],
        queryFn: async () => {
            const res = await apiFetch('/api/asset-hub/folders')
            if (!res.ok) throw new Error('Failed to fetch folders')
            const data = await res.json()
            return (data.folders || []) as GlobalFolder[]
        },
    })

    const pickerQuery = useQuery({
        queryKey: ['asset-hub-picker', type, selectedFolderId],
        queryFn: async () => {
            const params = new URLSearchParams({ type })
            if (selectedFolderId !== 'all') {
                params.set('folderId', selectedFolderId)
            }
            const res = await apiFetch(`/api/asset-hub/picker?${params.toString()}`)
            if (!res.ok) throw new Error('Failed to fetch picker assets')
            return res.json()
        },
        enabled: isOpen,
    })

    const characters = ((pickerQuery.data?.characters || []) as GlobalPickerCharacter[])
    const locations = ((pickerQuery.data?.locations || []) as GlobalPickerLocation[])
    const props = ((pickerQuery.data?.props || []) as GlobalPickerProp[])
    const voices = ((pickerQuery.data?.voices || []) as GlobalPickerVoice[])
    const folders = (foldersQuery.data || []) as GlobalFolder[]
    const isLoading = pickerQuery.isFetching
    const loadingState = isLoading
        ? resolveTaskPresentationState({
            phase: 'processing',
            intent: 'process',
            resource: type === 'voice' ? 'audio' : 'image',
            hasOutput: false,
        })
        : null
    const copyingState = externalLoading
        ? resolveTaskPresentationState({
            phase: 'processing',
            intent: 'process',
            resource: type === 'voice' ? 'audio' : 'image',
            hasOutput: false,
        })
        : null
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [previewImage, setPreviewImage] = useState<string | null>(null)
    const [previewAudio, setPreviewAudio] = useState<string | null>(null)
    const [isPlayingAudio, setIsPlayingAudio] = useState(false)
    const audioRef = useRef<HTMLAudioElement | null>(null)

    // 提取稳定的 refetch 引用，避免 useEffect 无限循环
    const refetchPicker = pickerQuery.refetch

    // 停止音频播放的辅助函数
    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current.currentTime = 0
            audioRef.current = null
        }
        setIsPlayingAudio(false)
        setPreviewAudio(null)
    }

    useEffect(() => {
        if (isOpen) {
            setSelectedId(null)
            setSearchQuery('')
            setSelectedFolderId('all')
            refetchPicker()
        } else {
            // 关闭对话框时停止播放
            stopAudio()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, type])

    const handleConfirm = () => {
        if (selectedId) {
            stopAudio()  // 确认复制时停止音频播放
            onSelect(selectedId)
        }
    }

    const filteredCharacters = characters.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.folderName && c.folderName.toLowerCase().includes(searchQuery.toLowerCase()))
    )

    const filteredLocations = locations.filter(l =>
        l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.folderName && l.folderName.toLowerCase().includes(searchQuery.toLowerCase()))
    )

    const filteredProps = props.filter(l =>
        l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.folderName && l.folderName.toLowerCase().includes(searchQuery.toLowerCase()))
    )

    const filteredVoices = voices.filter(v =>
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.description && v.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (v.folderName && v.folderName.toLowerCase().includes(searchQuery.toLowerCase()))
    )

    // 播放/暂停音频预览
    const handlePlayAudio = (audioUrl: string, e: React.MouseEvent) => {
        e.stopPropagation()

        // 如果点击的是当前正在播放的音频，则暂停
        if (previewAudio === audioUrl && isPlayingAudio) {
            stopAudio()
            return
        }

        // 停止之前的播放
        stopAudio()

        // 开始播放新音频
        setIsPlayingAudio(true)
        setPreviewAudio(audioUrl)
        const audio = new Audio(audioUrl)
        audioRef.current = audio
        audio.play()
        audio.onended = () => {
            setIsPlayingAudio(false)
            setPreviewAudio(null)
            audioRef.current = null
        }
        audio.onerror = () => {
            setIsPlayingAudio(false)
            setPreviewAudio(null)
            audioRef.current = null
        }
    }

    if (!isOpen) return null

    const items = type === 'character'
        ? filteredCharacters
        : type === 'location'
            ? filteredLocations
            : type === 'prop'
                ? filteredProps
                : filteredVoices
    const hasNoAssets = type === 'character'
        ? characters.length === 0
        : type === 'location'
            ? locations.length === 0
            : type === 'prop'
                ? props.length === 0
                : voices.length === 0

    return (
        <div className="fixed inset-0 glass-overlay flex items-center justify-center z-50">
            <div className="glass-surface-modal w-[600px] max-h-[80vh] flex flex-col">
                {/* 头部 */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--glass-stroke-base)]">
                    <h2 className="text-lg font-semibold text-[var(--glass-text-primary)]">
                        {type === 'character' ? t('selectCharacter') : type === 'location' ? t('selectLocation') : type === 'prop' ? t('selectProp') : t('selectVoice')}
                    </h2>
                    <button onClick={onClose} className="glass-btn-base glass-btn-soft text-[var(--glass-text-tertiary)]">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* 搜索栏 */}
                <div className="px-6 py-3 border-b border-[var(--glass-stroke-base)]">
                    <div className="flex gap-2">
                        <div className="relative flex-1 min-w-0">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--glass-text-tertiary)]" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t('searchPlaceholder')}
                                className="glass-input-base w-full pl-9 pr-4 py-2 text-sm"
                            />
                        </div>
                        <select
                            value={selectedFolderId}
                            onChange={(e) => setSelectedFolderId(e.target.value)}
                            className="glass-input-base shrink-0 !w-[220px] max-w-[38%] py-2 text-sm"
                        >
                            <option value="all">{t('allFolders')}</option>
                            {folders.map((folder) => (
                                <option key={folder.id} value={folder.id}>{folder.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* 资产列表 */}
                <div className="flex-1 overflow-y-auto p-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-40">
                            <TaskStatusInline state={loadingState} />
                        </div>
                    ) : hasNoAssets ? (
                        <div className="flex flex-col items-center justify-center h-40 text-[var(--glass-text-tertiary)]">
                            {type === 'character' ? (
                                <UserIcon className="w-12 h-12 mb-2" />
                            ) : type === 'location' || type === 'prop' ? (
                                <PhotoIcon className="w-12 h-12 mb-2" />
                            ) : (
                                <MicrophoneIcon className="w-12 h-12 mb-2" />
                            )}
                            <p>{t('noAssets')}</p>
                            <p className="text-sm mt-1">{t('createInAssetHub')}</p>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="flex items-center justify-center h-40 text-[var(--glass-text-tertiary)]">
                            <p>{t('noSearchResults')}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-3">
                            {type === 'character' ? (
                                filteredCharacters.map((char) => {
                                    const charPreview = char.previewUrl
                                    return (
                                        <div
                                            key={char.id}
                                            onClick={() => setSelectedId(char.id)}
                                            className={`relative cursor-pointer rounded-xl border-2 p-2 transition-all hover:shadow-md ${selectedId === char.id
                                                ? 'border-[var(--glass-stroke-focus)] bg-[var(--glass-tone-info-bg)]'
                                                : 'border-[var(--glass-stroke-base)] hover:border-[var(--glass-stroke-focus)]'
                                                }`}
                                        >
                                            {/* 选中标记 */}
                                            {selectedId === char.id && (
                                                <CheckCircleIcon className="absolute -top-2 -right-2 w-6 h-6 text-[var(--glass-tone-info-fg)] bg-[var(--glass-bg-surface)] rounded-full" />
                                            )}

                                            {/* 预览图 */}
                                            <div className="aspect-square rounded-lg overflow-hidden bg-[var(--glass-bg-muted)] mb-2 relative">
                                                {charPreview ? (
                                                    <MediaImageWithLoading
                                                        src={charPreview}
                                                        alt={char.name}
                                                        containerClassName="w-full h-full"
                                                        className="w-full h-full object-cover cursor-zoom-in"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setPreviewImage(charPreview)
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-[var(--glass-text-tertiary)]">
                                                        <UserIcon className="w-12 h-12" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* 名称 */}
                                            <div className="text-center">
                                                <p className="font-medium text-sm text-[var(--glass-text-primary)] truncate">{char.name}</p>
                                                <p className="text-xs text-[var(--glass-text-secondary)] mt-1">
                                                    {char.appearanceCount || 0} {t('appearances')}
                                                    {char.hasVoice && ` · ${t('voice')}`}
                                                </p>
                                                <p className="text-xs text-[var(--glass-text-tertiary)] mt-1 truncate">{char.folderName || t('noFolder')}</p>
                                            </div>
                                        </div>
                                    )
                                })
                            ) : type === 'location' ? (
                                filteredLocations.map((loc) => {
                                    const locPreview = loc.previewUrl
                                    return (
                                        <div
                                            key={loc.id}
                                            onClick={() => setSelectedId(loc.id)}
                                            className={`relative cursor-pointer rounded-xl border-2 p-2 transition-all hover:shadow-md ${selectedId === loc.id
                                                ? 'border-[var(--glass-stroke-focus)] bg-[var(--glass-tone-info-bg)]'
                                                : 'border-[var(--glass-stroke-base)] hover:border-[var(--glass-stroke-focus)]'
                                                }`}
                                        >
                                            {/* 选中标记 */}
                                            {selectedId === loc.id && (
                                                <CheckCircleIcon className="absolute -top-2 -right-2 w-6 h-6 text-[var(--glass-tone-info-fg)] bg-[var(--glass-bg-surface)] rounded-full" />
                                            )}

                                            {/* 预览图 */}
                                            <div className="aspect-video rounded-lg overflow-hidden bg-[var(--glass-bg-muted)] mb-2 relative">
                                                {locPreview ? (
                                                    <MediaImageWithLoading
                                                        src={locPreview}
                                                        alt={loc.name}
                                                        containerClassName="w-full h-full"
                                                        className="w-full h-full object-cover cursor-zoom-in"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setPreviewImage(locPreview)
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-[var(--glass-text-tertiary)]">
                                                        <PhotoIcon className="w-12 h-12" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* 名称 */}
                                            <div className="text-center">
                                                <p className="font-medium text-sm text-[var(--glass-text-primary)] truncate">{loc.name}</p>
                                                <p className="text-xs text-[var(--glass-text-secondary)] mt-1">
                                                    {loc.imageCount || 0} {t('images')}
                                                </p>
                                                <p className="text-xs text-[var(--glass-text-tertiary)] mt-1 truncate">{loc.folderName || t('noFolder')}</p>
                                            </div>
                                        </div>
                                    )
                                })
                            ) : type === 'prop' ? (
                                filteredProps.map((prop) => {
                                    const propPreview = prop.previewUrl
                                    return (
                                        <div
                                            key={prop.id}
                                            onClick={() => setSelectedId(prop.id)}
                                            className={`relative cursor-pointer rounded-xl border-2 p-2 transition-all hover:shadow-md ${selectedId === prop.id
                                                ? 'border-[var(--glass-stroke-focus)] bg-[var(--glass-tone-info-bg)]'
                                                : 'border-[var(--glass-stroke-base)] hover:border-[var(--glass-stroke-focus)]'
                                                }`}
                                        >
                                            {selectedId === prop.id && (
                                                <CheckCircleIcon className="absolute -top-2 -right-2 w-6 h-6 text-[var(--glass-tone-info-fg)] bg-[var(--glass-bg-surface)] rounded-full" />
                                            )}
                                            <div className="aspect-video rounded-lg overflow-hidden bg-[var(--glass-bg-muted)] mb-2 relative">
                                                {propPreview ? (
                                                    <MediaImageWithLoading
                                                        src={propPreview}
                                                        alt={prop.name}
                                                        containerClassName="w-full h-full"
                                                        className="w-full h-full object-cover cursor-zoom-in"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setPreviewImage(propPreview)
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-[var(--glass-text-tertiary)]">
                                                        <PhotoIcon className="w-12 h-12" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-center">
                                                <p className="font-medium text-sm text-[var(--glass-text-primary)] truncate">{prop.name}</p>
                                                <p className="text-xs text-[var(--glass-text-secondary)] mt-1">
                                                    {prop.imageCount || 0} {t('images')}
                                                </p>
                                                <p className="text-xs text-[var(--glass-text-tertiary)] mt-1 truncate">{prop.folderName || t('noFolder')}</p>
                                            </div>
                                        </div>
                                    )
                                })
                            ) : (
                                // 音色列表渲染 - 与资产中心 VoiceCard 风格统一
                                filteredVoices.map((voice) => {
                                    const genderIcon = voice.gender === 'male' ? 'M' : voice.gender === 'female' ? 'F' : ''
                                    const isVoicePlaying = previewAudio === voice.previewUrl && isPlayingAudio
                                    return (
                                        <div
                                            key={voice.id}
                                            onClick={() => setSelectedId(voice.id)}
                                            className={`relative cursor-pointer glass-surface overflow-hidden transition-all hover:shadow-md ${selectedId === voice.id
                                                ? 'ring-2 ring-[var(--glass-stroke-focus)]'
                                                : 'hover:ring-2 hover:ring-[var(--glass-focus-ring-strong)]'
                                                }`}
                                        >
                                            {/* 选中标记 */}
                                            {selectedId === voice.id && (
                                                <div className="absolute top-2 right-2 w-6 h-6 glass-chip glass-chip-info rounded-full flex items-center justify-center z-10 p-0">
                                                    <AppIcon name="checkSolid" className="w-4 h-4 text-white" />
                                                </div>
                                            )}

                                            {/* 音色图标区域 - 与 VoiceCard 统一 */}
                                            <div className="relative bg-[var(--glass-bg-muted)] p-6 flex items-center justify-center">
                                                <div className="w-16 h-16 rounded-full glass-surface-soft flex items-center justify-center">
                                                    <MicrophoneIcon className="w-8 h-8 text-[var(--glass-tone-info-fg)]" />
                                                </div>

                                                {/* 性别标签 */}
                                                {genderIcon && (
                                                    <div className="absolute top-2 left-2 glass-chip glass-chip-neutral text-xs px-2 py-0.5 rounded-full">
                                                        {genderIcon}
                                                    </div>
                                                )}

                                                {/* 试听按钮 - 圆形，与 VoiceCard 统一 */}
                                                {voice.previewUrl && (
                                                    <button
                                                        onClick={(e) => handlePlayAudio(voice.previewUrl!, e)}
                                                        className={`absolute bottom-2 right-2 w-10 h-10 rounded-full glass-btn-base flex items-center justify-center transition-all ${isVoicePlaying
                                                            ? 'glass-btn-tone-info animate-pulse'
                                                            : 'glass-btn-secondary text-[var(--glass-tone-info-fg)]'
                                                            }`}
                                                    >
                                                        {isVoicePlaying ? (
                                                            <AppIcon name="pause" className="w-5 h-5" />
                                                        ) : (
                                                            <AppIcon name="play" className="w-5 h-5" />
                                                        )}
                                                    </button>
                                                )}
                                            </div>

                                            {/* 信息区域 */}
                                            <div className="p-3">
                                                <h3 className="font-medium text-[var(--glass-text-primary)] text-sm truncate">{voice.name}</h3>
                                                {voice.description && (
                                                    <p className="mt-1 text-xs text-[var(--glass-text-secondary)] line-clamp-2">{voice.description}</p>
                                                )}
                                                <p className="mt-1 text-xs text-[var(--glass-text-tertiary)] truncate">{voice.folderName || t('noFolder')}</p>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    )}
                </div>

                {/* 底部按钮 */}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface-strong)]">
                    <button
                        onClick={onClose}
                        className="glass-btn-base glass-btn-secondary px-4 py-2 text-sm"
                    >
                        {t('cancel')}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedId || externalLoading}
                        className="glass-btn-base glass-btn-primary px-4 py-2 text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {externalLoading && <TaskStatusInline state={copyingState} className="text-white [&>span]:sr-only [&_svg]:text-white" />}
                        {t('confirmCopy')}
                    </button>
                </div>
            </div>

            {/* 图片放大预览弹窗 */}
            {
                previewImage && (
                    <ImagePreviewModal
                        imageUrl={previewImage}
                        onClose={() => setPreviewImage(null)}
                    />
                )
            }
        </div >
    )
}
