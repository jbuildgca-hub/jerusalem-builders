# ג׳רוזלם בילדרס פרויקטים בע״מ — מרכז פיקוד

## 📋 מה כלול בקוד זה

```
vision-pro/
├── src/
│   ├── types/index.ts          ← כל ה-TypeScript types
│   ├── lib/supabase.ts         ← חיבור למסד נתונים + כל פעולות ה-API
│   ├── store/index.ts          ← ניהול state גלובלי (Zustand)
│   ├── hooks/useAuth.ts        ← ניהול התחברות + real-time sync
│   ├── App.tsx                 ← ראוטינג + shell layout
│   └── components/
│       ├── auth/AuthPage.tsx       ← לוגין / הרשמה
│       ├── projects/               ← ניהול פרויקטים מלא
│       └── invoices/               ← סריקת חשבוניות AI
├── supabase/
│   └── migrations/001_initial_schema.sql  ← כל הטבלאות
└── .env.example                ← משתני סביבה
```

---

## 🚀 הגדרה ראשונה — 15 דקות

### שלב 1 — Supabase (מסד הנתונים)

1. עבור ל-[supabase.com](https://supabase.com) → **New project**
2. בחר שם ואזור (EU West מומלץ לישראל)
3. לאחר היצירה, עבור לـ **SQL Editor → New Query**
4. העתק את כל הקוד מ-`supabase/migrations/001_initial_schema.sql` והרץ
5. עבור לـ **Settings → API** והעתק:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` key → `VITE_SUPABASE_ANON_KEY`

### שלב 2 — הגדרת הפרויקט

```bash
# 1. התקן תלויות
npm install

# 2. צור קובץ .env
cp .env.example .env
# ערוך את .env והוסף את הערכים מ-Supabase

# 3. הרץ בסביבת פיתוח
npm run dev
```

הפרויקט יעלה על `http://localhost:5173`

### שלב 3 — בניה לייצור

```bash
npm run build
# קבצים מוכנים בתיקיית dist/
```

העלה את תיקיית `dist/` לכל שרת: **Vercel** (מומלץ), Netlify, או כל שרת אחר.

---

## 🌐 פריסה ל-Vercel (מומלץ)

```bash
npm i -g vercel
vercel --prod
```

ב-Vercel Dashboard → Settings → Environment Variables הוסף:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## 📱 מובייל (שלב הבא)

הקוד מוכן לעטיפה ב-**Capacitor** לאפליקציה ל-iOS/Android:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap init "Jerusalem Builders" "com.jerusalembuilders.app"
npm run build
npx cap add ios
npx cap add android
npx cap sync
npx cap open ios     # פותח Xcode
npx cap open android # פותח Android Studio
```

---

## 🏗️ מפת דרכים

| שלב | מה כלול | סטטוס |
|-----|---------|-------|
| 1 | לוגין, פרויקטים, חשבוניות AI, real-time | ✅ מוכן |
| 2 | צוות, תזרים, דוחות AI, הצעות מחיר | ✅ הושלם |
| 3 | סריקת תוכנית + כתב כמויות + תלת מימד | 🔨 בבנייה |
| 4 | דשבורד לקוח, API חשבוניות | 🗺️ מתוכנן |
| 5 | אפליקציה מובייל | 🗺️ מתוכנן |

---

## 🔐 אבטחה

- כל הטבלאות מוגנות עם **Row Level Security (RLS)**
- כל משתמש רואה רק את הנתונים שלו
- העלאות קבצים מוגנות לפי `user_id`
- מפתחות API לא נכנסים לקוד

---

## 🤖 AI — סריקת חשבוניות

פיצ'ר הסריקה משתמש ב-**Anthropic Claude API** ישירות מהדפדפן.
הקריאה ל-API מטופלת בקובץ `src/lib/supabase.ts` → `invoices.extractWithAI()`.

לשימוש ב-production מומלץ להעביר את הקריאה ל-API ל-**Supabase Edge Function**
כדי להגן על מפתח ה-API:

```typescript
// supabase/functions/extract-invoice/index.ts
import Anthropic from 'npm:@anthropic-ai/sdk'
// ...
```

---

## 📞 תמיכה

בניית המערכת: Claude (Anthropic) עבור ג׳רוזלם בילדרס פרויקטים בע״מ
