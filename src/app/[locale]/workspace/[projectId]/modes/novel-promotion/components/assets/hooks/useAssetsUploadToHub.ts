'use client'

import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { isAbortError } from '@/lib/error-utils'
import { useUploadProjectAssetToGlobal } from '@/lib/query/hooks'

type ToastType = 'success' | 'warning' | 'error'

type ShowToast = (message: string, type?: ToastType, duration?: number) => void

interface UseAssetsUploadToHubParams {
  projectId: string
  onRefresh: () => void | Promise<void>
  showToast: ShowToast
}

type GlobalUploadTarget = {
  type: 'character' | 'location' | 'prop'
  targetId: string
}

type DuplicateStrategy = 'skip' | 'overwrite' | 'move'

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error)

export function useAssetsUploadToHub({ projectId, onRefresh, showToast }: UseAssetsUploadToHubParams) {
  const t = useTranslations('assets')
  const uploadToGlobalAsset = useUploadProjectAssetToGlobal(projectId)
  const [isGlobalUploadInFlight, setIsGlobalUploadInFlight] = useState(false)
  const [uploadToGlobalTarget, setUploadToGlobalTarget] = useState<GlobalUploadTarget | null>(null)

  const uploadByType = useCallback(async (
    type: 'character' | 'location' | 'prop',
    targetId: string,
    folderId: string | null,
    duplicateStrategy: DuplicateStrategy,
  ) => {
    setIsGlobalUploadInFlight(true)
    try {
      const response = await uploadToGlobalAsset.mutateAsync({ type, targetId, folderId, duplicateStrategy }) as {
        skipped?: boolean
        overwritten?: boolean
        moved?: boolean
      }
      if (response?.skipped) {
        showToast(t('assetLibrary.uploadSkippedDuplicate'), 'warning')
        return
      }
      if (response?.overwritten) {
        showToast(t('assetLibrary.uploadOverwrittenDuplicate'), 'success')
        await Promise.resolve(onRefresh())
        return
      }
      if (response?.moved) {
        showToast(t('assetLibrary.uploadMovedDuplicate'), 'success')
        await Promise.resolve(onRefresh())
        return
      }
      const successMsg = type === 'character'
        ? t('assetLibrary.uploadSuccessCharacter')
        : type === 'location'
          ? t('assetLibrary.uploadSuccessLocation')
          : t('assetLibrary.uploadSuccessProp')
      showToast(successMsg, 'success')
      await Promise.resolve(onRefresh())
    } catch (error: unknown) {
      if (!isAbortError(error)) {
        showToast(t('assetLibrary.uploadFailed', { error: getErrorMessage(error) }), 'error')
      }
    } finally {
      setIsGlobalUploadInFlight(false)
    }
  }, [onRefresh, showToast, t, uploadToGlobalAsset])

  const handleUploadCharacterToGlobal = useCallback((characterId: string) => {
    setUploadToGlobalTarget({ type: 'character', targetId: characterId })
  }, [uploadByType])

  const handleUploadLocationToGlobal = useCallback((locationId: string) => {
    setUploadToGlobalTarget({ type: 'location', targetId: locationId })
  }, [uploadByType])

  const handleUploadPropToGlobal = useCallback((propId: string) => {
    setUploadToGlobalTarget({ type: 'prop', targetId: propId })
  }, [uploadByType])

  const handleCloseUploadFolderPicker = useCallback(() => {
    setUploadToGlobalTarget(null)
  }, [])

  const handleConfirmUploadToGlobal = useCallback(async (folderId: string | null, duplicateStrategy: DuplicateStrategy) => {
    if (!uploadToGlobalTarget) return
    await uploadByType(uploadToGlobalTarget.type, uploadToGlobalTarget.targetId, folderId, duplicateStrategy)
    setUploadToGlobalTarget(null)
  }, [uploadByType, uploadToGlobalTarget])

  return {
    isGlobalUploadInFlight,
    uploadToGlobalTarget,
    handleUploadCharacterToGlobal,
    handleUploadLocationToGlobal,
    handleUploadPropToGlobal,
    handleCloseUploadFolderPicker,
    handleConfirmUploadToGlobal,
  }
}
