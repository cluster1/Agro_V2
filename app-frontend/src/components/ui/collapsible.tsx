"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface CollapsibleProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
  className?: string
}

const Collapsible = React.forwardRef<HTMLDivElement, CollapsibleProps>(
  ({ open, onOpenChange, children, className }, ref) => {
    const [isOpen, setIsOpen] = React.useState(open ?? false)

    React.useEffect(() => {
      if (open !== undefined) {
        setIsOpen(open)
      }
    }, [open])

    const handleOpenChange = (newOpen: boolean) => {
      setIsOpen(newOpen)
      onOpenChange?.(newOpen)
    }

    return (
      <div ref={ref} className={cn(className)} data-state={isOpen ? "open" : "closed"}>
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child as React.ReactElement<any>, {
              isOpen,
              onOpenChange: handleOpenChange,
            })
          }
          return child
        })}
      </div>
    )
  }
)
Collapsible.displayName = "Collapsible"

interface CollapsibleTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

const CollapsibleTrigger = React.forwardRef<HTMLDivElement, CollapsibleTriggerProps>(
  ({ asChild, isOpen, onOpenChange, children, ...props }, ref) => {
    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation()
      onOpenChange?.(!isOpen)
    }

    if (asChild && React.isValidElement(children)) {
      const childProps = (children as React.ReactElement<any>).props
      return React.cloneElement(children as React.ReactElement<any>, {
        ...childProps,
        onClick: (e: React.MouseEvent) => {
          handleClick(e)
          childProps.onClick?.(e)
        },
        ref,
      })
    }

    return (
      <div ref={ref} onClick={handleClick} {...props}>
        {children}
      </div>
    )
  }
)
CollapsibleTrigger.displayName = "CollapsibleTrigger"

interface CollapsibleContentProps extends React.HTMLAttributes<HTMLDivElement> {
  isOpen?: boolean
}

const CollapsibleContent = React.forwardRef<HTMLDivElement, CollapsibleContentProps>(
  ({ isOpen, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "overflow-hidden transition-all duration-300",
          isOpen ? "animate-in slide-in-from-top-2" : "hidden",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
CollapsibleContent.displayName = "CollapsibleContent"

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
