import { Font } from "@react-pdf/renderer";

// Register Cairo font for Arabic text rendering in PDFs
// These are stable Google Fonts gstatic.com CDN URLs, fetched only at PDF generation time
Font.register({
  family: "Cairo",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hOA-W1Q.ttf",
      fontWeight: 400,
    },
    {
      src: "https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hD45W1Q.ttf",
      fontWeight: 600,
    },
    {
      src: "https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hAc5W1Q.ttf",
      fontWeight: 700,
    },
  ],
});

// Disable hyphenation for Arabic text — prevents word breaks mid-glyph
Font.registerHyphenationCallback((word: string) => [word]);
