import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-[14px] border border-input bg-card px-4 py-3 text-base text-foreground shadow-xs outline-none transition-[color,box-shadow,border-color] placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/25 aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-destructive/15 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70 sm:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
