export const THEME_STORAGE_KEY = "bk_theme";

/**
 * Skrip kecil yang dijalankan sebelum halaman tampil: pasang class `dark` sesuai pilihan
 * tersimpan agar tidak ada kedipan tema terang. Default: terang.
 */
export const THEME_INIT_SCRIPT = `try{var d=localStorage.getItem("${THEME_STORAGE_KEY}")==="dark";var e=document.documentElement;e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light"}catch(_){}`;
