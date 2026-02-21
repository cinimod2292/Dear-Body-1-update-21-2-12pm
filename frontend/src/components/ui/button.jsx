import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 font-body",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors duration-200",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 transition-colors duration-200",
        outline:
          "border border-input bg-card text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors duration-200",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 transition-colors duration-200",
        ghost:
          "text-foreground hover:bg-accent/10 hover:text-accent transition-colors duration-200",
        link:
          "text-primary underline-offset-4 hover:underline transition-colors duration-200",
        premium:
          "bg-accent text-accent-foreground shadow-md hover:bg-accent/90 transition-colors duration-200 tracking-wide uppercase text-xs font-semibold",
        beauty:
          "bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground transition-colors duration-300",
        elegant:
          "bg-foreground text-background hover:bg-foreground/90 transition-colors duration-200 tracking-widest uppercase text-xs font-semibold",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 rounded-md px-8 text-base",
        xl: "h-14 rounded-lg px-10 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props} />
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
