import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"

const inputVariants = cva(
  "flex w-full font-premium transition-all duration-300 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: [
          "h-12 rounded-xl border-2 border-neutral-300 bg-white/95 backdrop-blur-sm",
          "px-4 py-3 text-base text-neutral-900 placeholder:text-neutral-500",
          "shadow-sm hover:border-neutral-400 hover:shadow-md",
          "focus:border-brand-400 focus:ring-4 focus:ring-brand-400/20 focus:outline-none focus:shadow-premium",
          "focus:bg-white focus:transform focus:scale-[1.01]"
        ],
        
        premium: [
          "h-14 rounded-2xl border-2 border-luxury-300/60 bg-gradient-to-br from-white via-luxury-50/20 to-white",
          "px-6 py-4 text-lg text-neutral-900 placeholder:text-neutral-400",
          "shadow-luxury hover:border-luxury-400 hover:shadow-royal",
          "focus:border-luxury-500 focus:ring-4 focus:ring-luxury-400/30 focus:outline-none",
          "focus:bg-gradient-to-br focus:from-white focus:via-luxury-50/30 focus:to-white",
          "focus:transform focus:scale-[1.02] focus:shadow-luxury"
        ],
        
        floating: [
          "h-14 rounded-xl border-2 border-neutral-300 bg-transparent",
          "px-4 pt-6 pb-2 text-base text-neutral-900 placeholder:text-transparent",
          "peer shadow-sm hover:border-neutral-400 hover:shadow-md",
          "focus:border-brand-400 focus:ring-4 focus:ring-brand-400/20 focus:outline-none",
          "focus:bg-white/80 focus:shadow-premium"
        ],
        
        glass: [
          "h-12 rounded-xl border border-white/30 bg-white/20 backdrop-blur-xl",
          "px-4 py-3 text-base text-white placeholder:text-white/70",
          "shadow-glass hover:bg-white/30 hover:border-white/40",
          "focus:border-white/50 focus:ring-4 focus:ring-white/20 focus:outline-none",
          "focus:bg-white/30 focus:shadow-2xl"
        ],
        
        brazilian: [
          "h-12 rounded-xl border-2 border-forest-300/60 bg-gradient-to-br from-white via-forest-50/20 to-brand-50/20",
          "px-4 py-3 text-base text-neutral-900 placeholder:text-neutral-500",
          "shadow-forest-glow hover:border-forest-400 hover:shadow-premium",
          "focus:border-forest-500 focus:ring-4 focus:ring-forest-400/30 focus:outline-none",
          "focus:bg-gradient-to-br focus:from-white focus:via-forest-50/30 focus:to-brand-50/30",
          "focus:shadow-luxury"
        ],
        
        minimal: [
          "h-10 rounded-lg border border-neutral-200 bg-white/80",
          "px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-500",
          "hover:border-neutral-300 focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 focus:outline-none"
        ],
      },
      inputSize: {
        sm: "h-9 px-3 py-2 text-sm",
        default: "h-12 px-4 py-3 text-base",
        lg: "h-14 px-6 py-4 text-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      inputSize: "default",
    },
  }
)

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {
  label?: string
  error?: string
  helperText?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  loading?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ 
    className, 
    variant, 
    inputSize, 
    type, 
    label, 
    error, 
    helperText, 
    leftIcon, 
    rightIcon, 
    loading,
    id,
    ...props 
  }, ref) => {
    const inputId = id || React.useId()
    const isFloating = variant === "floating"
    
    return (
      <div className="w-full space-y-2">
        {/* Standard Label (non-floating) */}
        {label && !isFloating && (
          <label 
            htmlFor={inputId}
            className="block text-sm font-premium font-medium text-neutral-700 mb-2"
          >
            {label}
          </label>
        )}
        
        {/* Input Container */}
        <div className="relative">
          {/* Left Icon */}
          {leftIcon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500 z-10">
              {leftIcon}
            </div>
          )}
          
          {/* Input Field */}
          <input
            id={inputId}
            type={type}
            className={cn(
              inputVariants({ variant, inputSize }),
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              error && "border-danger-400 focus:border-danger-500 focus:ring-danger-400/20",
              loading && "cursor-wait",
              className
            )}
            ref={ref}
            {...props}
          />
          
          {/* Floating Label */}
          {isFloating && label && (
            <label
              htmlFor={inputId}
              className={cn(
                "absolute left-4 transition-all duration-200 pointer-events-none",
                "text-neutral-600 font-premium font-medium",
                "peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base",
                "peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:text-brand-600",
                "top-2 translate-y-0 text-xs text-brand-600",
                error && "peer-focus:text-danger-600"
              )}
            >
              {label}
            </label>
          )}
          
          {/* Right Icon / Loading */}
          {(rightIcon || loading) && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-500">
              {loading ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin opacity-60" />
              ) : (
                rightIcon
              )}
            </div>
          )}
        </div>
        
        {/* Helper Text / Error */}
        {(error || helperText) && (
          <div className="flex items-start gap-1 text-sm">
            {error ? (
              <>
                <span className="text-danger-600 font-premium font-medium flex items-center gap-1">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </span>
              </>
            ) : (
              <span className="text-neutral-600 font-premium">{helperText}</span>
            )}
          </div>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

// Premium Input Group Component
const InputGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    label?: string
    description?: string
    error?: string
    required?: boolean
  }
>(({ className, label, description, error, required, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("space-y-2", className)}
      {...props}
    >
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-sm font-premium font-medium text-neutral-900">
            {label}
            {required && <span className="text-danger-500 ml-1">*</span>}
          </label>
        </div>
      )}
      
      {description && (
        <p className="text-sm text-neutral-600 font-premium">{description}</p>
      )}
      
      {children}
      
      {error && (
        <p className="text-sm text-danger-600 font-premium font-medium flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
})
InputGroup.displayName = "InputGroup"

export { Input, InputGroup, inputVariants }