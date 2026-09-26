# Invoice Scanner

AI-powered invoice data extractor → Excel export. Built with Next.js + Claude API.

---

## Deploy to Vercel (Step-by-step)

### Step 1 — Get your Anthropic API Key
1. Go to https://console.anthropic.com/
2. Sign up / log in
3. Click **API Keys** → **Create Key**
4. Copy the key (starts with `sk-ant-...`)

### Step 2 — Upload to GitHub
1. Go to https://github.com and sign up (free)
2. Click **New repository** → name it `invoice-scanner` → Create
3. Upload all these files into the repository (drag and drop on GitHub works)

### Step 3 — Deploy on Vercel
1. Go to https://vercel.com and sign up with your GitHub account
2. Click **Add New Project** → Import your `invoice-scanner` repo
3. Before clicking Deploy, go to **Environment Variables** and add:
   - Key: `ANTHROPIC_API_KEY`
   - Value: your key from Step 1
4. Click **Deploy** — done! Vercel gives you a free URL like `invoice-scanner.vercel.app`

---

## Run Locally (optional)

```bash
npm install
cp .env.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY
npm run dev
```
Open http://localhost:3000

---

## How to Use

1. Drag & drop invoice images (JPG/PNG) or PDFs onto the upload area
2. AI automatically extracts: Supplier Name, Invoice No., Date, Description, Unit Price, Qty, Amount, SST Amount, Total Amount
3. Review and edit any cells directly in the table
4. Click **Export Excel** to download `.xlsx` file

---

## Files

```
invoice-scanner/
├── pages/
│   ├── index.js        ← Main app UI
│   ├── _app.js         ← App wrapper
│   └── api/
│       └── scan.js     ← API route (keeps your API key safe)
├── styles/
│   └── globals.css
├── .env.example        ← Copy to .env.local and add your key
├── .gitignore
├── next.config.js
└── package.json
```
