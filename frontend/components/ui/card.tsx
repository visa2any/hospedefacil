import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"

const cardVariants = cva(
  "relative overflow-hidden transition-all duration-500 ease-luxury",
  {
    variants: {
      variant: {
        default: [
          "rounded-2xl border border-neutral-200 bg-white/95 backdrop-blur-sm",
          "shadow-premium text-card-foreground",
          "hover:shadow-luxury hover:scale-[1.02] hover:border-brand-300"
        ],
        
        premium: [
          "rounded-3xl bg-gradient-to-br from-white via-white to-neutral-50/50",
          "border border-luxury-200/50 shadow-luxury text-card-foreground",
          "hover:shadow-royal hover:scale-[1.02] hover:border-luxury-300",
          "before:absolute before:inset-0 before:bg-gradient-to-r before:from-luxury-50/20 before:via-transparent before:to-luxury-50/20",
          "before:opacity-0 before:transition-opacity before:duration-500 hover:before:opacity-100"
        ],
        
        glass: [
          "rounded-3xl backdrop-blur-2xl bg-white/20 border border-white/30",
          "shadow-glass text-white",
          "hover:bg-white/30 hover:border-white/40 hover:shadow-2xl hover:scale-[1.02]",
          "before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent"
        ],
        
        floating: [
          "rounded-3xl bg-white border border-neutral-100 shadow-lg",
          "text-card-foreground transform-gpu",
          "hover:shadow-2xl hover:scale-[1.03] hover:-translate-y-2 hover:border-brand-200",
          "transition-all duration-700 ease-luxury",
          "before:absolute before:inset-0 before:rounded-3xl before:bg-gradient-to-br before:from-brand-50/30 before:via-transparent before:to-luxury-50/30",
          "before:opacity-0 before:transition-opacity before:duration-500 hover:before:opacity-100"
        ],
        
        luxury: [
          "rounded-3xl bg-gradient-to-br from-white via-neutral-50/80 to-white",
          "border-2 border-luxury-200/60 shadow-royal text-card-foreground",
          "hover:shadow-luxury hover:scale-[1.02] hover:border-luxury-400",
          "before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-gradient-premium before:rounded-t-3xl",
          "after:absolute after:inset-0 after:rounded-3xl after:bg-gradient-to-br after:from-luxury-50/10 after:via-transparent after:to-royal-50/10",
          "after:opacity-0 after:transition-opacity after:duration-500 hover:after:opacity-100"
        ],
        
        brazilian: [
          "rounded-3xl bg-gradient-to-br from-white via-forest-50/30 to-brand-50/30",
          "border-2 border-forest-200/60 shadow-forest-glow text-card-foreground",
          "hover:shadow-luxury hover:scale-[1.02] hover:border-forest-400",
          "before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-gradient-brazilian before:rounded-t-3xl",
          "after:absolute after:inset-0 after:rounded-3xl after:bg-gradient-to-br after:from-forest-50/10 after:via-brand-50/10 after:to-coral-50/10",
          "after:opacity-0 after:transition-opacity after:duration-500 hover:after:opacity-100"
        ],
        
        minimal: [
          "rounded-2xl bg-white/60 backdrop-blur-sm border border-neutral-100",
          "shadow-sm text-card-foreground",
          "hover:bg-white/80 hover:shadow-md hover:scale-[1.01] hover:border-neutral-200"
        ],
      },
      padding: {
        none: "p-0",
        sm: "p-4",
        default: "p-6",
        lg: "p-8",
        xl: "p-10",
      },
    },
    defaultVariants: {
      variant: "default",
      padding: "default",
    },
  }
)

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  hover?: boolean
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, hover = true, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        cardVariants({ variant, padding }),
        !hover && "hover:scale-100 hover:shadow-premium",
        className
      )}
      {...props}
    />
  )
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div 
    ref={ref} 
    className={cn(
      "relative flex flex-col space-y-2 p-6 pb-4",
      "after:absolute after:bottom-0 after:left-6 after:right-6 after:h-px after:bg-gradient-to-r after:from-transparent after:via-neutral-200 after:to-transparent",
      className
    )} 
    {...props} 
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-luxury font-semibold leading-tight tracking-tight text-neutral-900",
      "bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 bg-clip-text text-transparent",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      "text-base text-neutral-600 font-premium leading-relaxed",
      className
    )}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div 
    ref={ref} 
    className={cn(
      "relative p-6 pt-4 font-premium text-neutral-700 leading-relaxed",
      className
    )} 
    {...props} 
  />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div 
    ref={ref} 
    className={cn(
      "relative flex items-center justify-between p-6 pt-4 gap-4",
      "before:absolute before:top-0 before:left-6 before:right-6 before:h-px before:bg-gradient-to-r before:from-transparent before:via-neutral-200 before:to-transparent",
      className
    )} 
    {...props} 
  />
))
CardFooter.displayName = "CardFooter"

// Premium Card Sub-components
const CardBadge = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: "default" | "premium" | "success" | "warning" | "danger"
  }
>(({ className, variant = "default", ...props }, ref) => {
  const badgeVariants = {
    default: "bg-neutral-100 text-neutral-700 border-neutral-200",
    premium: "bg-gradient-to-r from-luxury-100 to-luxury-200 text-luxury-800 border-luxury-300",
    success: "bg-gradient-to-r from-forest-100 to-forest-200 text-forest-800 border-forest-300",
    warning: "bg-gradient-to-r from-warning-100 to-warning-200 text-warning-800 border-warning-300",
    danger: "bg-gradient-to-r from-danger-100 to-danger-200 text-danger-800 border-danger-300",
  }
  
  return (
    <div
      ref={ref}
      className={cn(
        "absolute top-4 right-4 px-3 py-1.5 rounded-full border text-xs font-premium font-medium shadow-sm",
        "backdrop-blur-sm z-10",
        badgeVariants[variant],
        className
      )}
      {...props}
    />
  )
})
CardBadge.displayName = "CardBadge"

const CardImage = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    src?: string
    alt?: string
    aspectRatio?: "square" | "video" | "wide"
  }
>(({ className, src, alt, aspectRatio = "video", ...props }, ref) => {
  const aspectRatios = {
    square: "aspect-square",
    video: "aspect-video",
    wide: "aspect-[21/9]",
  }
  
  return (
    <div
      ref={ref}
      className={cn(
        "relative overflow-hidden rounded-t-3xl bg-gradient-to-br from-neutral-100 to-neutral-200",
        aspectRatios[aspectRatio],
        className
      )}
      {...props}
    >
      {src && (
        <img
          src={src}
          alt={alt || "Card image"}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
    </div>
  )
})
CardImage.displayName = "CardImage"

export { 
  Card, 
  CardHeader, 
  CardFooter, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  CardBadge, 
  CardImage,
  cardVariants 
}