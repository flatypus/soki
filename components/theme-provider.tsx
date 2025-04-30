"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
// Removed incorrect type import: import { type ThemeProviderProps } from "next-themes/dist/types"

// Use React.ComponentProps to get the correct props type
type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>;

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}

