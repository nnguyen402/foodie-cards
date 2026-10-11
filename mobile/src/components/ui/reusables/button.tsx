/*
 * Adapted from the React Native Reusables NativeWind button registry.
 * Copyright (c) 2025 Founded Labs. MIT License; see LICENSE in this directory.
 * Registry source: https://github.com/founded-labs/react-native-reusables
 */
import { cva, type VariantProps } from 'class-variance-authority';
import { ActivityIndicator, Platform, Pressable } from 'react-native';
import { cn } from '@/lib/utils';
import { TextClassContext } from './text';
import { THEME } from '@/lib/theme';
import { useColorScheme } from 'nativewind';

const buttonVariants = cva(
  cn(
    'group shrink-0 flex-row items-center justify-center gap-2 rounded-md',
    'min-h-12 px-4 py-3 active:opacity-80',
    Platform.select({ web: 'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none transition-all disabled:pointer-events-none' }),
  ),
  {
    variants: {
      variant: {
        default: cn('bg-primary shadow-sm shadow-black/5', Platform.select({ web: 'hover:bg-primary/90' })),
        destructive: cn('bg-destructive shadow-sm shadow-black/5', Platform.select({ web: 'hover:bg-destructive/90' })),
        outline: cn('border border-border bg-background shadow-sm shadow-black/5 active:bg-accent', Platform.select({ web: 'hover:bg-accent' })),
        secondary: cn('bg-secondary shadow-sm shadow-black/5', Platform.select({ web: 'hover:bg-secondary/80' })),
        ghost: cn('bg-transparent active:bg-accent', Platform.select({ web: 'hover:bg-accent' })),
        link: '',
      },
      size: {
        default: 'min-h-12 px-4 py-3',
        sm: 'min-h-11 gap-1.5 rounded-md px-3 py-2',
        lg: 'min-h-14 rounded-md px-6 py-4',
        icon: 'min-h-12 w-12 px-0 py-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

const buttonTextVariants = cva('shrink text-center text-foreground text-base font-medium', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      destructive: 'text-destructive-foreground',
      outline: 'text-foreground',
      secondary: 'text-secondary-foreground',
      ghost: 'text-foreground',
      link: 'text-primary underline',
    },
    size: { default: '', sm: '', lg: '', icon: '' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

export type ButtonProps = React.ComponentProps<typeof Pressable> &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean;
  };

function Button({
  className,
  variant = 'default',
  size = 'default',
  loading = false,
  children,
  disabled,
  accessibilityState,
  ...props
}: ButtonProps) {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? THEME.dark : THEME.light;
  const spinnerColor = variant === 'destructive'
    ? theme.destructiveForeground
    : variant === 'default'
      ? theme.primaryForeground
      : variant === 'link'
        ? theme.primary
      : theme.foreground;

  return (
    <TextClassContext.Provider value={buttonTextVariants({ variant, size })}>
      <Pressable
        className={cn((disabled || loading) && 'opacity-50', buttonVariants({ variant, size }), className)}
        accessibilityRole="button"
        accessibilityState={{ ...accessibilityState, disabled: !!(disabled || loading), busy: loading }}
        disabled={disabled || loading}
        {...props}
      >
        {(state) => (
          <>
            {loading ? <ActivityIndicator color={spinnerColor} /> : null}
            {typeof children === 'function' ? children(state) : children}
          </>
        )}
      </Pressable>
    </TextClassContext.Provider>
  );
}

export { Button, buttonTextVariants, buttonVariants };
