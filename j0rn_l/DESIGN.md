---
name: J0rn@l
colors:
  surface: '#fff8f3'
  surface-dim: '#efd7b1'
  surface-bright: '#fff8f3'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff2e1'
  surface-container: '#ffebce'
  surface-container-high: '#fee5be'
  surface-container-highest: '#f8dfb9'
  on-surface: '#261a03'
  on-surface-variant: '#434846'
  inverse-surface: '#3c2e14'
  inverse-on-surface: '#ffeed7'
  outline: '#747876'
  outline-variant: '#c4c7c5'
  surface-tint: '#5c5f5e'
  primary: '#050807'
  on-primary: '#ffffff'
  primary-container: '#1d201f'
  on-primary-container: '#858786'
  inverse-primary: '#c5c7c5'
  secondary: '#546161'
  on-secondary: '#ffffff'
  secondary-container: '#d5e2e2'
  on-secondary-container: '#596565'
  tertiary: '#1a0001'
  on-tertiary: '#ffffff'
  tertiary-container: '#3e0f0f'
  on-tertiary-container: '#bb7470'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e1e3e1'
  primary-fixed-dim: '#c5c7c5'
  on-primary-fixed: '#191c1b'
  on-primary-fixed-variant: '#444746'
  secondary-fixed: '#d8e5e5'
  secondary-fixed-dim: '#bcc9c9'
  on-secondary-fixed: '#121e1e'
  on-secondary-fixed-variant: '#3d4949'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3af'
  on-tertiary-fixed: '#390b0c'
  on-tertiary-fixed-variant: '#6f3634'
  background: '#fff8f3'
  on-background: '#261a03'
  surface-variant: '#f8dfb9'
typography:
  logo:
    fontFamily: Anton
    fontSize: 24px
    fontWeight: '400'
    lineHeight: 32px
    letterSpacing: 0.15em
  h1:
    fontFamily: Changa One
    fontSize: 32px
    fontWeight: '400'
    lineHeight: 40px
  h1-mobile:
    fontFamily: Changa One
    fontSize: 28px
    fontWeight: '400'
    lineHeight: 36px
  h2:
    fontFamily: Changa One
    fontSize: 24px
    fontWeight: '400'
    lineHeight: 32px
  body-lg:
    fontFamily: Lexend
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Lexend
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  button:
    fontFamily: Lexend
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 20px
  label-md:
    fontFamily: Nanum Gothic
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Nanum Gothic
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  metric:
    fontFamily: Nanum Gothic
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 24px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  gutter: 16px
  margin-mobile: 20px
  margin-desktop: 40px
---

## Brand & Style
The design system for this mental wellness platform is built on the intersection of **High-End Editorial** and **Analog Tactility**. It functions as a digital "check engine light" for the psyche, prioritizing a calm, intelligent, and deeply reflective user experience.

The aesthetic blends the authoritative clarity of a premium health magazine with the intimate, grounded feel of a leather-bound journal. The design avoids the "gamified" or overly "clinical" tropes of typical health apps, opting instead for a mature, analytical, and supportive interface.

**Visual Pillars:**
- **Analytical Warmth:** Data and metrics are presented with scientific precision but wrapped in a soft, organic palette.
- **Structured Solitude:** Generous whitespace and a rigid 8pt grid create a sense of organized, private mental space.
- **Tactile Minimalism:** Subtle paper textures and flat, layered surfaces replace modern trends like glassmorphism to emphasize stability and permanence.

## Colors
The palette is deeply rooted in natural, "heritage" tones that evoke expensive stationary and calm environments. There are no neon or high-vibrancy accents; instead, the system utilizes a sophisticated range of muted earth tones to signal different mental states.

- **Foundational Surfaces:** The Primary Background (#EAD2AC) provides a warm, parchment-like base. Card Backgrounds (#F6EFE3) offer enough contrast to differentiate content without the harshness of pure white.
- **Typography:** Primary text is a deep, near-black charcoal (#1D201F) for high legibility, while secondary text uses a muted moss-grey (#5F665F) for meta-information and labels.
- **Functional Accents:** The accent colors (Sage, Gold, Clay) are used strictly for categorization and status indications, ensuring the user is never visually overwhelmed by "alert" colors.

## Typography
The typographic system utilizes four distinct families to separate brand identity, narrative content, and data analytics. **Italics are strictly forbidden** to maintain the sturdy, grounded feel of the design system.

- **Brandmark:** The J0rn@l logo uses Anton in uppercase with wide tracking. The "0" character is manually scaled to be 10% larger than the surrounding letters to create a subtle "lens" or "eye" effect.
- **Headlines:** Changa One provides a bold, friendly, and authoritative voice for page titles and section headers.
- **Interface & Narrative:** Lexend is used for all primary reading, body text, and button labels due to its high readability and approachable geometry.
- **Data & Analytics:** Nanum Gothic is reserved for technical roles—metrics, charts, and labels—providing a neutral, modern, and precise feel that contrasts with the softer body text.

## Layout & Spacing
The layout follows a strict **8pt grid system**, emphasizing high-end editorial density and generous whitespace.

- **Grid:** A 12-column grid is used for desktop, scaling to 4 columns for mobile. 
- **Alignment:** Strong vertical and horizontal alignment is mandatory. All cards and content blocks must snap to the grid.
- **Content Density:** Use `lg` (24px) spacing for internal card padding and `xxl` (48px) for separating major vertical sections. This "breathable" layout ensures the user does not feel crowded during reflection.
- **Responsiveness:** On mobile, margins should be kept at 20px to maximize the "journal page" feel, with cards typically spanning the full width minus margins.

## Elevation & Depth
This design system avoids traditional "floating" depth in favor of **Layered Surfaces**. 

- **Tonal Layering:** Depth is primarily communicated through color shifts (e.g., a Card Background #F6EFE3 sitting on the Primary Background #EAD2AC).
- **Shadows:** Use only one level of shadow for cards and interactive elements. Shadows should be very subtle: `box-shadow: 0px 4px 12px rgba(29, 32, 31, 0.05);`.
- **Texture:** A very low-opacity noise overlay (2-3%) should be applied to card backgrounds to simulate high-quality paper stock, enhancing the tactile journal aesthetic.
- **Borders:** Use 1px solid borders (#CDBFA9) to define shapes when contrast between surfaces is low.

## Shapes
The shape language is defined by **Structured Rectilinearism**. While elements are not sharp-edged, they are strictly rectangular to maintain an organized, "ledger" feel.

- **Pill shapes, circles, and blobs are prohibited.**
- **Cards & Primary Actions:** Utilize a 12px corner radius.
- **Input Fields:** Utilize a slightly tighter 10px corner radius to differentiate them from larger containers.
- **Iconography:** Icons should be simple, rounded-outline styles with a 1.5px or 2px stroke weight to match the weight of the Nanum Gothic labels.

## Components
Consistent component styling reinforces the "Health Analytics meets Leather Journal" narrative.

- **Cards:** The primary container. Always rectangular, 12px radius, 24px internal padding. Card backgrounds feature the subtle paper texture.
- **Buttons:** Full-width by default in mobile views (56px height). Use the Primary Text color (#1D201F) for the background with parchment-colored text for primary actions.
- **Status Badges:** Small, rectangular tags with 4px radius. 
    - *Connected/Stable:* Muted Sage (#8FA68E) background, dark text.
    - *Watch:* Muted Gold (#D8B66A) background, dark text.
    - *Strained:* Warm Clay (#C9896A) background, light text.
- **Input Fields:** 10px radius, 1px border (#CDBFA9). Background should be slightly lighter than the page background to indicate interactivity.
- **Charts:** Minimalist line or bar charts using Dusty Blue and Soft Olive. Avoid heavy grids; use Nanum Gothic for all axes and legends.
- **Lists:** Clean, horizontal dividers (1px, #CDBFA9) with generous vertical padding (16px) between items.