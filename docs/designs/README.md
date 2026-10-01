# Design references

`mockups/` preserves the 15 full-screen PNG alternatives from commit `3bd9047` for design reference. The images contain rasterized Spanish copy and are not reusable interface assets.

`reference-assets/` preserves two unused in-home product renders that contain Spanish copy. The live site uses the English-ready Hub tablet and camera renders from `public/product-assets/` instead.

These files are documentation references and stay outside `public/`, so Vite does not copy them into the production build.
