import { prisma } from '@/lib/prisma'
import { collectPanelReferenceImages, resolveNovelData } from '@/lib/workers/handlers/image-task-handler-shared'

async function main() {
  const panelId = 'efc88afc-cd19-4893-b75a-53f9c0da47e0'
  const panel = await prisma.novelPromotionPanel.findUnique({ where: { id: panelId } })
  if (!panel) {
    console.log('panel_not_found')
    return
  }

  const storyboard = await prisma.novelPromotionStoryboard.findUnique({
    where: { id: panel.storyboardId },
    select: {
      episode: {
        select: {
          novelPromotionProjectId: true,
        },
      },
    },
  })
  if (!storyboard?.episode?.novelPromotionProjectId) {
    console.log('storyboard_not_found')
    return
  }

  const data = await resolveNovelData(storyboard.episode.novelPromotionProjectId)
  const refs = await collectPanelReferenceImages(data as never, panel as never)

  console.log(JSON.stringify({
    panel: {
      id: panel.id,
      sketchImageUrl: panel.sketchImageUrl,
      characters: panel.characters,
      location: panel.location,
    },
    refs,
  }, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
