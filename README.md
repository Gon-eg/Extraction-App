# Bath Research & Analytics System

An advanced, high-performance analytics dashboard and multi-source reporting data extractor designed for facility-level health and nutrition indicators. Built with **React 19**, **Vite**, **TypeScript**, and styled with a customized **Professional Polish** theme using Tailwind CSS.

---

## 🚀 Key Achievements & Features

### 🎨 Professional Polish Theme
The system has been meticulously customized to offer a clean, high-contrast, professional visual identity:
- **Consistent Color Palette**: Employs Slate/Slate-900 for dark texts, soft slate whites (`#F8FAFC`) for page backgrounds, and a primary Royal Blue accent (`#2563EB`) to drive attention.
- **Modern Bento Grid Layout**: Organized into responsive widget areas, clean flex-containers, and visual cards with crisp borders and subtle shadows.
- **Enhanced Data Visualizations**: Outfitted with a professional color scheme for charts, including clear legends and responsive high-contrast tooltip overlays.

### 🛡️ Automated Data & SKBA Restoration System
The application features a robust parsing engine built in `src/extractor.ts` to restore critical health records from raw spreadsheet and word formats:
1. **Dynamic Sheet Discovery**: Updated the OPD parser to check sheets matching `health data`, `health`, `opd`, or `new hfs` dynamically, avoiding failures due to sheet title variations.
2. **Multi-Source Birth Attendance (SKBA)**: Implemented dual-indicator extraction for skilled birth attendants. Supports both ANC-tracked skilled deliveries and OPD-restored facility skilled births using highly resilient aliases (e.g., `deliveries by skilled attendant`, `skilled birth`, `skba`, or `facility skilled birth attended`).
3. **Flexible Table Extraction**: Extends Word-based table extraction (e.g., for Dhornor Lab reports) to scan for multi-column indices, ensuring robust alignment with adjacent gendered columns.
4. **Intelligent Filename Routing**: Automatic pattern detection dynamically matches files like "Keew EPI" or "Dhornor Lab" to their designated Facility and Report Type, bypassing manual dropdown menus.

---

## 📁 Technical Architecture

- **`src/types.ts`**: Defines strict type contracts for facilities, report types, structured indicators, and extracted results.
- **`src/indicators.ts`**: Houses configuration schemas for Output 1.1, Output 1.2 (Health Service Delivery), and Output 1.3 (Nutrition) with specific baseline targets and mapping logic.
- **`src/extractor.ts`**: The core spreadsheet/document parsing engine utilizing `xlsx` and `mammoth` for asynchronous data restoration.
- **`src/App.tsx`**: The orchestrating single-screen dashboard handling drag-and-drop actions, local persistence, file staging, and telemetry widgets.

---

## 🛠️ Getting Started

### Installation
Ensure that the Node.js dependencies are successfully installed:
```bash
npm install
```

### Run in Development
Start the application locally on the standard port `3000`:
```bash
npm run dev
```

### Production Build
Compile and bundle the production applet:
```bash
npm run build
```

### Static File Integrity Verification
Check syntax and TypeScript types:
```bash
npm run lint
```

---

## 🌐 GitHub Pages Deployment Guide

We configured `vite.config.ts` to use relative asset referencing (`base: './'`). This ensures the compiled output can be served from any directory or subpath (such as a GitHub repository folder).

### Step 1: Run the Production Build
Run the following command to generate the static files:
```bash
npm run build
```
This produces a `dist/` folder containing the compiled `index.html` and optimized asset files (JavaScript/CSS).

### Step 2: Deploying to GitHub Pages
You can deploy your built `dist/` directory using any of the following standard methods:

#### Method A: Using `gh-pages` helper package (Recommended)
1. Install the deployment helper package:
   ```bash
   npm install --save-dev gh-pages
   ```
2. Add deployment scripts to your `package.json`:
   ```json
   "scripts": {
     "predeploy": "npm run build",
     "deploy": "gh-pages -d dist"
   }
   ```
3. Run the deploy script to build and push automatically:
   ```bash
   npm run deploy
   ```

#### Method B: GitHub Actions (Automated CI/CD)
Configure a GitHub workflow in `.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [ main ]
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 18
      - name: Install dependencies
        run: npm ci
      - name: Build
        run: npm run build
      - name: Deploy
        uses: JamesIves/github-pages-deploy-action@v4
        with:
          folder: dist
          branch: gh-pages
```

Once configured, go to **Settings > Pages** in your GitHub repository, choose **Deploy from a branch**, and select the **gh-pages** branch. Your app will live at `https://<your-username>.github.io/<your-repo-name>/`.

