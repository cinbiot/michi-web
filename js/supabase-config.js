// ══════════════════════════════════════════
//  CONFIGURACIÓN SUPABASE
//  Cambia estos 2 valores después de crear
//  tu proyecto en supabase.com
// ══════════════════════════════════════════
const SUPABASE_URL = 'https://pnjxhzuayhsqvlitfaak.supabase.co';
const SUPABASE_KEY = 'sb_publishable_GFbMfDmyqfpxa21DOp8kyQ_-rYlTNY4';

// Contraseña del panel admin
const ADMIN_PASSWORD = '69770128Pp$';

// Cliente Supabase
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
