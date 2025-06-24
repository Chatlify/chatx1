// logger.js
// Küresel debug/log alma yönetimi. Üretimde gereksiz console.log çıktısını kapatmaya yarar.
// DEBUG = true ise tüm loglar aktif kalır, false ise log/info/debug çağrıları susturulur.

export const DEBUG = (function determineDebugMode() {
  // 1) URL'de ?debug=true parametresi  2) localStorage'da debug=true  3) localhost alan adı
  if (typeof window === 'undefined') return false;
  if (window.location.search.includes('debug=true')) return true;
  if (localStorage.getItem('debug') === 'true') return true;
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return true;
  return false;
})();

// Temel log işlevi — diğer dosyalarda opsiyonel olarak kullanmak için.
export function log(...args) {
  if (DEBUG) console.log(...args);
}

// DEBUG kapalı ise console.log/info/debug'i sustur.
if (!DEBUG && typeof console !== 'undefined') {
  ['log', 'info', 'debug'].forEach((method) => {
    if (console[method]) {
      console[method] = () => {};
    }
  });
}
