# 🌼 Página de amor para Michi — Instrucciones

## PASO 1 — Crear cuenta en Supabase (gratis)

1. Ve a **https://supabase.com** → "Start for free"
2. Regístrate con Google o email
3. Haz clic en **"New Project"**
4. Ponle un nombre (ej: `michi-love`) y elige una contraseña
5. Espera 1-2 minutos mientras se crea

---

## PASO 2 — Crear las tablas en Supabase

En tu proyecto de Supabase, ve a **SQL Editor** y pega este código:

```sql
-- Tabla para la carta
CREATE TABLE carta (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text,
  contenido text,
  firma text,
  created_at timestamptz DEFAULT now()
);

-- Tabla para fotos
CREATE TABLE fotos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  url text NOT NULL,
  storage_path text,
  descripcion text,
  created_at timestamptz DEFAULT now()
);

-- Tabla para videos
CREATE TABLE videos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  url text NOT NULL,
  descripcion text,
  created_at timestamptz DEFAULT now()
);

-- Permitir lectura pública
ALTER TABLE carta  ENABLE ROW LEVEL SECURITY;
ALTER TABLE fotos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read carta"  ON carta  FOR SELECT USING (true);
CREATE POLICY "public read fotos"  ON fotos  FOR SELECT USING (true);
CREATE POLICY "public read videos" ON videos FOR SELECT USING (true);
CREATE POLICY "public write carta"  ON carta  FOR ALL USING (true);
CREATE POLICY "public write fotos"  ON fotos  FOR ALL USING (true);
CREATE POLICY "public write videos" ON videos FOR ALL USING (true);
```

Haz clic en **"Run"** ✅

---

## PASO 3 — Crear el bucket de fotos

1. En Supabase, ve a **Storage** → "New bucket"
2. Nombre: `media`
3. Marca **"Public bucket"** ✅
4. Haz clic en "Create bucket"

---

## PASO 4 — Copiar tus claves de Supabase

1. En Supabase ve a **Settings → API**
2. Copia la **URL del proyecto** (algo como `https://abcdef.supabase.co`)
3. Copia la **anon public key** (la clave larga)
4. Abre el archivo `js/supabase-config.js`
5. Reemplaza los valores:
   ```js
   const SUPABASE_URL = 'https://TU_PROYECTO.supabase.co';  ← pega tu URL aquí
   const SUPABASE_KEY = 'TU_ANON_KEY';                       ← pega tu clave aquí
   ```
6. También puedes cambiar la contraseña del admin:
   ```js
   const ADMIN_PASSWORD = 'michi2024';  ← cambia esto por tu contraseña
   ```

---

## PASO 5 — Subir a Vercel

1. Ve a **https://vercel.com** → crea cuenta gratis con Google
2. Haz clic en **"Add New → Project"**
3. Elige **"Upload"** y arrastra toda la carpeta `michi-web`
4. Haz clic en **"Deploy"**
5. En ~1 minuto tienes tu link 🎉

---

## USO DEL PANEL ADMIN

- Accede a: `https://tu-pagina.vercel.app/admin`
- Ingresa tu contraseña (por defecto: `michi2024`)
- Desde ahí puedes:
  - ✏️ **Editar la carta** de amor cuando quieras
  - 📸 **Subir fotos** directamente desde tu celular
  - 🎬 **Agregar videos** de YouTube
  - 🗑️ **Eliminar** lo que ya no quieras

---

## LINKS FINALES

- **Página de Michi:** `https://tu-pagina.vercel.app`
- **Panel admin:** `https://tu-pagina.vercel.app/admin`
