/*
 * Adapted from the React Native Reusables NativeWind input registry.
 * Original project: https://github.com/founded-labs/react-native-reusables
 * Licensed under MIT; see LICENSE in this directory.
 */
import { forwardRef } from 'react';
import { Platform, TextInput } from 'react-native';
import { cn } from '@/lib/utils';

export type InputProps = React.ComponentProps<typeof TextInput> & React.RefAttributes<TextInput> & { className?: string };

export const Input = forwardRef<TextInput, InputProps>(function Input({ className, ...props }, ref) {
  return (
    <TextInput
      ref={ref}
      allowFontScaling
      className={cn('min-h-12 w-full min-w-0 flex-row items-center rounded-md border border-input bg-background px-3 py-2 text-base leading-5 text-foreground shadow-sm shadow-black/5',
        props.editable === false && 'opacity-50',
        Platform.select({
          web: 'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:border-destructive',
          native: 'placeholder:text-muted-foreground/50',
        }),
        className)}
      {...props}
    />
  );
});
