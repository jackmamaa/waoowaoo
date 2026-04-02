import { NextRequest, NextResponse } from 'next/server'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { isErrorResponse, requireProjectAuthLight } from '@/lib/api-auth'
import { uploadAssetToGlobal } from '@/lib/assets/services/asset-actions'
import type { AssetKind } from '@/lib/assets/contracts'

type UploadToGlobalBody = {
  kind?: AssetKind
  projectId?: string
  folderId?: string | null
  duplicateStrategy?: 'skip' | 'overwrite' | 'move'
}

export const POST = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ assetId: string }> },
) => {
  const { assetId } = await context.params
  const body = await request.json() as UploadToGlobalBody

  if (!body.projectId || (body.kind !== 'character' && body.kind !== 'location' && body.kind !== 'prop')) {
    throw new ApiError('INVALID_PARAMS')
  }

  const authResult = await requireProjectAuthLight(body.projectId)
  if (isErrorResponse(authResult)) return authResult

  const result = await uploadAssetToGlobal({
    kind: body.kind,
    targetId: assetId,
    folderId: typeof body.folderId === 'string' ? body.folderId : null,
    duplicateStrategy: body.duplicateStrategy,
    access: {
      userId: authResult.session.user.id,
      projectId: body.projectId,
    },
  })

  return NextResponse.json(result)
})
