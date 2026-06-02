import { useCallback, useEffect, useRef, useState } from 'react'

export function useContainerWidth<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)

  const handleResize = useCallback(() => {
    if (ref.current) {
      setWidth(ref.current.offsetWidth)
    }
  }, [])

  useEffect(() => {
    if (!ref.current) return
    handleResize()
    const observer = new window.ResizeObserver(handleResize)
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [handleResize])

  return [ref, width] as const
}
