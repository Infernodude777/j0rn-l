---
name: J0rn@l
colors:
  surface: '#fff8f5'
  surface-dim: '#e1d8d4'
  surface-bright: '#fff8f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fbf2ed'
  surface-container: '#f5ece7'
  surface-container-high: '#efe6e2'
  surface-container-highest: '#e9e1dc'
  on-surface: '#1e1b18'
  on-surface-variant: '#52443d'
  inverse-surface: '#34302c'
  inverse-on-surface: '#f8efea'
  outline: '#84746c'
  outline-variant: '#d7c2ba'
  surface-tint: '#875136'
  primary: '#875136'
  on-primary: '#ffffff'
  primary-container: '#c9896a'
  on-primary-container: '#4f240d'
  inverse-primary: '#fdb695'
  secondary: '#7f5608'
  on-secondary: '#ffffff'
  secondary-container: '#fdc571'
  on-secondary-container: '#785000'
  tertiary: '#4d6544'
  on-tertiary: '#ffffff'
  tertiary-container: '#859f7a'
  on-tertiary-container: '#20351a'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbcb'
  primary-fixed-dim: '#fdb695'
  on-primary-fixed: '#351000'
  on-primary-fixed-variant: '#6b3a21'
  secondary-fixed: '#ffddb0'
  secondary-fixed-dim: '#f4bd6a'
  on-secondary-fixed: '#281800'
  on-secondary-fixed-variant: '#614000'
  tertiary-fixed: '#cfebc2'
  tertiary-fixed-dim: '#b3cea7'
  on-tertiary-fixed: '#0b2007'
  on-tertiary-fixed-variant: '#364d2e'
  background: '#fff8f5'
  on-background: '#1e1b18'
  surface-variant: '#e9e1dc'
typography:
  display-logo:
    fontFamily: Anton
    fontSize: 48px
    fontWeight: '400'
    lineHeight: '1.1'
    letterSpacing: 0.02em
  headline-xl:
    fontFamily: Literata
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-lg:
    fontFamily: Literata
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-md:
    fontFamily: Literata
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Lexend
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Lexend
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-sm:
    fontFamily: Lexend
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: 0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  margin-sm: 16px
  margin-md: 32px
  margin-lg: 64px
  gutter: 24px
  max-width: 1200px
---

## Brand & Style
This design system transforms a digital journal into a tangible, premium keepsake. The brand personality is warm, nostalgic, and deeply personal—blending the structured elegance of a high-end physical notebook with the imaginative charm of a classic children’s storybook. It targets users seeking an emotional, slow-tech experience that encourages reflection and "good vibes."

The design style is **Whimsical Organic**. It rejects the sterile precision of modern SaaS in favor of a "human-made" aesthetic. Key visual drivers include:
- **Tactile Materiality:** Every surface feels like physical paper or parchment.
- **Organic Imperfection:** Borders, dividers, and icons feature subtle "hand-drawn" inconsistencies.
- **Narrative Warmth:** A saturated pastel palette that evokes a sunrise in a storybook forest.

## Colors
The palette is built on a foundation of **Creamy Parchment**, moving away from pure whites to reduce eye strain and increase the "analog" feel.
- **Primary (Terracotta):** Used for primary actions and brand emphasis.
- **Secondary (Muted Sun):** Used for highlights, stars, and celebratory states.
- **Accents (Sage, Rose, Sky):** Used for categorization, mood tagging, and decorative flourishes.
- **Text (Deep Charcoal/Brown):** Used for all legibility to maintain high contrast without the harshness of pure black.

## Typography
The typography balances character with readability.
- **The Logo (Anton):** Should be rendered with a very slight organic "wiggle" or filter to soften its industrial roots, making it feel stamped rather than pixel-perfect.
- **Headlines (Literata):** A warm, bookish serif that provides the "Storybook" authority. It features slightly exaggerated descenders and a friendly rhythm.
- **Body & Labels (Lexend):** Chosen for its exceptional legibility and open apertures. It maintains a friendly, modern clarity that contrasts beautifully with the serif headers.

## Layout & Spacing
The layout follows a **Fixed-Content Centered** philosophy, mimicking the margins of a printed book. 
- **The Golden Margin:** Use generous horizontal margins (64px+ on desktop) to create a focused reading column.
- **Rhythm:** Spacing should feel intentional and roomy. Avoid dense clusters of information.
- **Responsive Behavior:** On mobile, margins reduce to 20px, but the "paper" container should maintain a subtle 4px offset from the screen edge to reinforce the object-like quality of the interface.

## Elevation & Depth
Depth is created through **Physical Stacking** rather than digital light sources.
- **The Base:** The lowest layer is a textured parchment background.
- **Surface Layers:** Elevated elements (cards, modals) use a very soft, multi-layered shadow tinted with the primary terracotta color (#C9896A) at low opacity (8-12%). This makes the "paper" feel like it is floating slightly above the desk.
- **Texture:** All elevated surfaces must have a subtle noise or "grain" texture overlay to prevent them from looking like flat hex codes.

## Shapes
Sharp corners are strictly prohibited. The shape language is defined by "The Hand-Drawn Edge."
- **Standard Radius:** 0.5rem (8px) for most interactive elements.
- **The Stroke:** Borders should not be a consistent 1px solid line. Instead, use a variable-width SVG stroke that mimics a fine-liner pen, with slight wobbles and tapered ends.
- **Deckled Edges:** Large cards and section dividers should feature a subtle "torn paper" or deckled edge effect on the horizontal axis.

## Components
- **Buttons:** Use a "pill-ish" shape but with slightly irregular curvature. The primary button uses a solid Terracotta fill with a hand-drawn charcoal outline.
- **Cards:** Defined by a 2px hand-sketched border. The background should be a slightly lighter shade of the parchment base to create a subtle "layering" effect.
- **Icons:** Must be "doodle-style" outlines. Lines should not perfectly meet at corners, and circles should not be mathematically perfect.
- **Inputs:** Underlined rather than boxed, mimicking a lined notebook. The focus state turns the line into a Sage Green "highlight" stroke.
- **Chips/Tags:** Styled like small pieces of washi tape—semi-transparent with slightly jagged vertical edges.
- **Dividers:** Use a "sketchy" horizontal line that tapers off at the ends, never touching the full width of the container.