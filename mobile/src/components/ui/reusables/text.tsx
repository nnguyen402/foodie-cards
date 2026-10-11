/*
 * Adapted from the React Native Reusables NativeWind text registry.
 * Copyright (c) 2025 Founded Labs. MIT License; see LICENSE in this directory.
 * Registry source: https://github.com/founded-labs/react-native-reusables
 */
import { Slot } from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Platform, Text as RNText, type Role } from 'react-native';
import { cn } from '@/lib/utils';

const textVariants = cva(
  cn('text-foreground text-base', Platform.select({ web: 'select-text' })),
  {
    variants: {
      variant: {
        default: '',
        h1: cn('text-4xl font-extrabold tracking-tight', Platform.select({ web: 'text-balance' })),
        h2: 'text-3xl font-semibold tracking-tight',
        h3: 'text-2xl font-semibold tracking-tight',
        h4: 'text-xl font-semibold tracking-tight',
        p: 'leading-7',
        blockquote: 'border-l-2 pl-3 italic',
        code: 'relative rounded bg-muted px-1 py-0.5 font-mono text-sm font-semibold',
        lead: 'text-xl text-muted-foreground',
        large: 'text-lg font-semibold',
        small: 'text-sm font-medium leading-none',
        muted: 'text-sm text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

type TextVariantProps = VariantProps<typeof textVariants>;
type TextVariant = NonNullable<TextVariantProps['variant']>;

const ROLE: Partial<Record<TextVariant, Role>> = {
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  blockquote: Platform.select({ web: 'blockquote' as Role }),
  code: Platform.select({ web: 'code' as Role }),
};

const ARIA_LEVEL: Partial<Record<TextVariant, string>> = { h1: '1', h2: '2', h3: '3', h4: '4' };

const TextClassContext = React.createContext<string | undefined>(undefined);

export type TextProps = React.ComponentProps<typeof RNText> & TextVariantProps & { asChild?: boolean };

function Text({
  className,
  asChild = false,
  variant = 'default',
  ...props
}: TextProps) {
  const textClass = React.useContext(TextClassContext);
  const Component = asChild ? Slot : RNText;

  return (
    <Component
      allowFontScaling
      className={cn(textVariants({ variant }), textClass, className)}
      role={variant ? ROLE[variant] : undefined}
      aria-level={variant ? ARIA_LEVEL[variant] : undefined}
      {...props}
    />
  );
}

export { Text, TextClassContext, textVariants };
