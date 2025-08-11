import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-premium font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 relative overflow-hidden group",
  {
    variants: {
      variant: {
        default: "bg-brand-500 text-white hover:bg-brand-600 shadow-brand hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98]",
        
        premium: [
          "bg-gradient-to-r from-luxury-400 via-luxury-500 to-luxury-600",
          "text-white font-semibold shadow-luxury-glow",
          "hover:from-luxury-500 hover:via-luxury-600 hover:to-luxury-700",
          "hover:shadow-luxury hover:scale-105 active:scale-95",
          "focus-visible:ring-luxury-400/50",
          "before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent",
          "before:translate-x-[-100%] before:transition-transform before:duration-700",
          "hover:before:translate-x-[100%]"
        ],
        
        luxury: [
          "bg-gradient-to-r from-royal-600 via-royal-700 to-royal-800",
          "text-white font-luxury font-bold shadow-2xl border border-royal-500/50",
          "hover:from-luxury-500 hover:via-royal-600 hover:to-luxury-600",
          "hover:shadow-royal hover:scale-105 hover:border-luxury-400",
          "focus-visible:ring-royal-500/50",
          "text-shadow-lg backdrop-blur-sm"
        ],
        
        glass: [
          "backdrop-blur-xl bg-white/10 border border-white/20",
          "text-white font-medium shadow-glass",
          "hover:bg-white/20 hover:border-white/30 hover:shadow-xl",
          "hover:scale-105 active:scale-95",
          "focus-visible:ring-white/30"
        ],
        
        brazilian: [
          "bg-gradient-to-r from-forest-500 via-brand-500 to-coral-500",
          "text-white font-semibold shadow-forest-glow",
          "hover:from-forest-600 hover:via-brand-600 hover:to-coral-600",
          "hover:shadow-2xl hover:scale-105 active:scale-95",
          "focus-visible:ring-forest-400/50",
          "before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent",
          "before:translate-x-[-100%] before:skew-x-12 before:transition-transform before:duration-700",
          "hover:before:translate-x-[100%]"
        ],
        
        destructive: [
          "bg-gradient-to-r from-danger-500 to-danger-600",
          "text-white hover:from-danger-600 hover:to-danger-700",
          "shadow-lg hover:shadow-xl transform hover:scale-[1.02]",
          "focus-visible:ring-danger-400/50"
        ],
        
        outline: [
          "border-2 border-neutral-300 bg-background/80 backdrop-blur-sm",
          "hover:bg-neutral-50 hover:border-brand-400 hover:text-brand-700",
          "hover:shadow-md transform hover:scale-[1.02]",
          "focus-visible:ring-brand-400/30"
        ],
        
        secondary: [
          "bg-gradient-to-r from-neutral-100 to-neutral-200",
          "text-neutral-800 hover:from-neutral-200 hover:to-neutral-300",
          "shadow-sm hover:shadow-md transform hover:scale-[1.02]",
          "focus-visible:ring-neutral-400/30"
        ],
        
        ghost: [
          "hover:bg-neutral-100/80 hover:text-neutral-900",
          "hover:shadow-sm transform hover:scale-[1.02]",
          "focus-visible:ring-neutral-400/30"
        ],
        
        link: [
          "text-brand-600 underline-offset-4 hover:underline hover:text-brand-700",
          "hover:scale-[1.02] focus-visible:ring-brand-400/30"
        ],
      },
      size: {
        default: "h-12 px-6 py-3 text-base",
        sm: "h-9 rounded-lg px-4 py-2 text-sm",
        lg: "h-14 rounded-2xl px-8 py-4 text-lg font-semibold",
        xl: "h-16 rounded-2xl px-10 py-5 text-xl font-bold",
        icon: "h-12 w-12 rounded-xl",
        "icon-sm": "h-9 w-9 rounded-lg",
        "icon-lg": "h-14 w-14 rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    
    // Remove framer-motion props from DOM
    const { whileHover, whileTap, ...cleanProps } = props as any
    
    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size }),
          loading && "cursor-not-allowed",
          className
        )}
        ref={ref}
        disabled={disabled || loading}
        {...cleanProps}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-inherit rounded-inherit">
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin opacity-70" />
          </div>
        )}
        
        <div className={cn(
          "flex items-center gap-2",
          loading && "opacity-0"
        )}>
          {leftIcon && (
            <span className="flex items-center justify-center">
              {leftIcon}
            </span>
          )}
          
          {children && (
            <span className="font-inherit">{children}</span>
          )}
          
          {rightIcon && (
            <span className="flex items-center justify-center">
              {rightIcon}
            </span>
          )}
        </div>
        
        {/* Shine effect for premium variants */}
        {(variant === "premium" || variant === "brazilian") && (
          <div className="absolute inset-0 -top-2 -bottom-2 bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 transform -skew-x-12" />
        )}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }