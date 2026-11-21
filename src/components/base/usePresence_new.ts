import { useEffect, useState } from 'react'

/** 与 CSS 中的退场动画时长保持一致 */
const DEFAULT_DURATION = 200

/**
 * 关闭时先保留挂载，等退场动画播完再卸载；返回的 closing 用于触发退场样式。
 * 首次打开时 mounted 从 false 开始，进场动画照常播放。
 */
export const usePresence = (open: boolean, duration = DEFAULT_DURATION) => {
  const [mounted, setMounted] = useState(open)

  useEffect(() => {
    if (open) {
      setMounted(true)
      return
    }
    if (!mounted) {
      return
    }
    const timer = setTimeout(() => setMounted(false), duration)
    return () => clearTimeout(timer)
  }, [open, mounted, duration])

  return { mounted: open || mounted, closing: !open && mounted }
}
