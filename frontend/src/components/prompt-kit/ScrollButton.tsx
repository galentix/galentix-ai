import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ScrollButtonProps {
  onClick: () => void
  className?: string
  isVisible?: boolean
}

export function ScrollButton({ onClick, className, isVisible = true }: ScrollButtonProps) {
  const [isNearBottom, setIsNearBottom] = useState(true)

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY
      const windowHeight = window.innerHeight
      const docHeight = document.documentElement.scrollHeight
      setIsNearBottom(scrollTop + windowHeight >= docHeight - 100)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  if (!isVisible || isNearBottom) return null

  return (
    <button
      onClick={onClick}
      className={cn(
        'fixed bottom-24 right-8 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background shadow-md hover:bg-muted transition-colors',
        className
      )}
    >
      <ChevronDown className="h-4 w-4" />
    </button>
  )
}
