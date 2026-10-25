import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * The single h1 of a page. Solid brand colour (not gradient-clipped text) so contrast is
 * measurable and the title stays visible in forced-colors / high-contrast mode.
 */
export function PageTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h1 className={cn('text-3xl font-bold tracking-tight text-primary md:text-4xl', className)} {...props} />
}
