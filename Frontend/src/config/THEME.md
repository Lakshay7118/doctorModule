# Shared application theme

`APP_THEME` in `theme.ts` is the application-wide theme configuration. It currently selects the billing staff palette, IBM Plex fonts, and shared corner radius.

To change the theme, edit `APP_THEME.colors` or assign another palette with the same keys. Set `fontSans`, `fontMono`, and `radius` in that same object. No module-specific theme selection is needed.

The root layout renders `getThemeStyle()` on `<html>`, making the variables available on the first render and to dialogs rendered in portals. Tailwind's lab (`app`, `text`, `brand-blue`), billing (`paper`, `ink`, `brand`), and hospital (`primary`, `background`, `sidebar`) names all resolve to that configuration. Receptionist styles use the same variables.

Use semantic Tailwind classes for new UI. For SVG charts and inline styles, use CSS values such as `rgb(var(--qlyno-brand-500))`. Keep clinical status colors semantic (success, warning, alert). Diagnostic imagery and printed barcodes have their own content colors and should not be recolored as interface accents.
