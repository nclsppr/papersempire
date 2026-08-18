# Building miniatures V4

Production assets for the V4 **Production Twin** visual system.

- Generated with OpenAI ImageGen on 2026-08-18.
- Art direction: premium stylised isometric industrial miniature; navy enamelled
  steel, safety orange, warm brass, ivory paper, three-quarter top view.
- One subject per image, no card, copy, logo or baked UI.
- `sources/` contains the 512×512 alpha PNG masters retained in the repository.
- `../building-<id>-v4.webp` contains the 512×512 alpha WebP used by the site.
- The previous sticker family remains available as a runtime fallback.

The eleven subjects are: repro operator, repro workshop, digital press, offset
press, finishing workshop, inserting line, logistics cell, client portal
terminal, communications bridge, Industry 4.0 cell and Pampy AI production
core. A solid magenta generation matte was removed before export; all final
assets were visually checked on transparency.

Master prompt direction:

> Create one premium stylized isometric industrial miniature in a navy-steel,
> safety-orange, warm-brass and paper-ivory design language. Use believable
> construction, rounded bevels, PBR-like enamel and metal, a consistent warm
> studio light and generous clear space. Show only the requested machine. No
> text, logo, border, card, floor or cast shadow.

These images are interface illustrations, not the simulation model. The Three.js
recipes in `assets/js/scene/` independently implement the same material and
silhouette language so the DOM catalogue remains fast and accessible.
