# VOID Skin Manager

![Lisans: MIT](https://img.shields.io/badge/lisans-MIT-blue)

League of Legends için özel kostüm (skin) ve mod yöneticisi. Topluluk arşivlerinden kostümleri tarar, önizler ve seçtiğin kostümü [LTK Manager](https://github.com/LeagueToolkit/ltk-manager) üzerinden oyuna aktarır.

Windows için Tauri 2 + React 18 + TypeScript ile geliştirildi. Arayüz dili Türkçe.

> **League of Legends'a uygulanan kostümler yalnızca senin ekranında görünür.** Sunucu tarafında hiçbir şey değişmez, diğer oyuncular senin kostümünü görmez.

---

## Nasıl çalışır

VOID tek başına oyuna dosya enjekte etmez. League dosyalarına kalıcı yazma, oyunun dosya doğrulaması ve anti-cheat (Vanguard) tarafından engellendiği için, kostümler ancak oyun açılırken bellek üzerinden bir overlay olarak yüklenebilir. Bu işi LTK Manager'ın patcher'ı yapar.

Akış:

1. **Tarama** — Yapılandırılmış GitHub arşivleri taranır, `.fantome` / `.zip` (fantome) paketleri şampiyon ve kostümlerle eşleştirilir.
2. **Önizleme** — Şampiyon ikonları ve splash art'ları CommunityDragon'dan (veya çalışan oyundan LCU üzerinden yerel olarak) çekilir.
3. **Gönderme** — "LTK'ya Gönder" dediğinde VOID, seçili paketin HTTPS adresini `ltk://` derin bağlantısıyla LTK Manager'a iletir:
   ```
   ltk://install?url=<https-url>&name=<kostüm-adı>&source=VOID
   ```
4. **Kurulum** — LTK Manager paketi indirir, kütüphanesine ekler ve **etkinleştirir**.
5. **Uygulama** — LTK patcher'ı oyun açılırken overlay'i enjekte eder. Oyunu normal şekilde (Riot Client üzerinden) başlatman yeterlidir.

---

## Özellikler

- Birden fazla topluluk kaynağından hibrit katalog taraması, çakışmalarda ağırlığa göre çözümleme.
- Şampiyon ve kostüm arama, favoriler, kaynak / hazır durumuna göre filtreleme.
- Çalışan oyundan yerel (LCU) veri kaynağı; LCU yoksa otomatik olarak çevrimiçi (CommunityDragon) kaynağa düşer.
- Görsel önbelleği (disk / bellek), TTL ayarı ve tek tuşla temizleme.
- LTK Manager durum takibi: kurulu mu, **patcher çalışıyor mu** (durum çubuğunda canlı rozet).
- Neon karanlık tema, çerçevesiz pencere.

---

## Gereksinimler

**Kullanım için**

- Windows 10 / 11 (x64)
- WebView2 Runtime (Windows 11'de hazır gelir; Windows 10'da gerekebilir)
- [LTK Manager](https://github.com/LeagueToolkit/ltk-manager) — kostümleri oyunda görmek için **zorunlu**

**Kaynaktan derlemek için**

- Node.js 18+ ve npm
- Rust (stable) — `x86_64-pc-windows-msvc`
- Visual Studio Build Tools (Desktop development with C++) + Windows SDK
- WebView2 Runtime

---

## Kurulum

[Releases](https://github.com/ItzJPPPMe/Void-Menager/releases/latest) sayfasından `VOID-Skin-Manager-Setup.exe` dosyasını indirip çalıştır. Alternatif olarak `.msi` paketi de yayınlanır.

### İlk kurulumdan sonra

Kostümlerin oyunda görünmesi için LTK Manager'ın patcher'ının çalışıyor olması gerekir. Bir kez ayarla, bir daha uğraşma:

**LTK Manager → Settings → Startup and tray**

| Ayar | Açıklama |
| --- | --- |
| **Auto run** | LTK bilgisayar açılışında kendiliğinden başlar. |
| **Start in tray** | Başlarken pencere açılmaz, tepside bekler. |
| **Always start the patcher** | Her açılışta son etkin profili ve patcher'ı başlatır. |

Bu üçü açıkken: bilgisayarı aç, LTK arka planda hazır olsun, oyunu Riot Client'ten başlat. VOID'un durum çubuğundaki `Patcher çalışıyor` rozeti bunu doğrular.

---

## Kaynaktan derleme

```bash
git clone https://github.com/ItzJPPPMe/Void-Menager.git
cd Void-Menager
npm install

# geliştirme (Vite dev sunucusu + Tauri penceresi)
npm run tauri dev

# üretim derlemesi (exe + NSIS + MSI)
npm run tauri build
```

Diğer komutlar:

```bash
npm run dev        # yalnızca arayüz (http://localhost:1420)
npm run build      # tsc && vite build
npm run typecheck  # tsc --noEmit
```

Derleme çıktıları:

- `src-tauri/target/release/void-skin-manager.exe`
- `src-tauri/target/release/bundle/nsis/*-setup.exe`
- `src-tauri/target/release/bundle/msi/*.msi`

---

## Katalog kaynakları

Varsayılan kaynaklar `src/types/settings.ts` içinde tanımlıdır ve Ayarlar ekranından açılıp kapatılabilir.

| Kaynak | Depo | Düzen |
| --- | --- | --- |
| Bettie9 / Sunshine | `bettie9/LeagueSkins` | `index.json` eşlemesi, ağırlık 1 |
| Alban1911 / Rose | `Alban1911/LeagueSkins` | `skins/{championId}/{skinId}/{skinId}.fantome`, ağırlık 2 |
| darkseal-org | `darkseal-org/lol-skins` | `skins/{Şampiyon}/{Kostüm}.zip`, ağırlık 3 |

Hibrit mod açıkken tüm etkin kaynaklar birleştirilir; aynı kostüm birden fazla kaynakta varsa ağırlığı düşük olan yok sayılır.

---

## Proje yapısı

```
.
├── src/                      # React arayüz
│   ├── components/
│   │   ├── champion/         # şampiyon listesi ve arama
│   │   ├── common/           # ortak (toast, ikon, modal) bileşenler
│   │   ├── layout/           # başlık, durum çubuğu
│   │   ├── panel/            # seçili kostüm paneli
│   │   ├── settings/         # ayarlar ekranı
│   │   └── skins/            # kostüm kartları
│   ├── hooks/                # veri kaynakları, senkronizasyon kancaları
│   ├── services/             # syncService, ltkManager, görsel yükleyici
│   ├── store/                # zustand store'ları
│   ├── types/                # tipler ve varsayılan kaynaklar
│   └── styles/               # Tailwind katmanları
└── src-tauri/                # Rust tarafı
    └── src/lib.rs            # tüm Tauri komutları
```

Rust tarafındaki ana komutlar (`src-tauri/src/lib.rs`):

| Komut | Görevi |
| --- | --- |
| `get_system_status`, `detect_league_path`, `detect_riot_client_path` | Ortam tespiti |
| `lcu_status`, `fetch_text`, `fetch_text_cached` | Ağ ve yerel oyun verisi |
| `download_to_cache`, `cache_resolve`, `clear_image_cache` | Görsel önbelleği |
| `ltk_manager_status`, `ltk_install`, `ltk_open`, `ltk_import_file` | LTK Manager entegrasyonu |
| `extract_mod_package`, `apply_mod`, `revert_last_patch` | Paket inceleme ve yedekleme |

---

## Teknolojiler

Tauri 2, React 18, TypeScript, Zustand, Tailwind CSS, Vite, Rust. İkonlar [Lucide](https://lucide.dev), animasyonlar Framer Motion.

---

## Bilinen sınırlamalar

- Yalnızca Windows x64 hedeflenir.
- Kostümleri oyunda görmek için LTK Manager'ın kurulu ve patcher'ının çalışıyor olması gerekir; VOID tek başına oyuna yama uygulamaz.
- Yerel (LCU) kaynak oyunun mevcut varlıklarını gösterir, dağıtılabilir `.fantome` paketi sunmaz; bu yüzden yerel kaynaktaki kostümler LTK'ya gönderilemez.
- İlk taramada çok sayıda görsel indirildiği için önbellek açıkken ilk açılış yavaş olabilir.

---

## Yasal uyarılar

- Bu proje Riot Games ile ilişkili değildir ve Riot Games tarafından desteklenmemektedir. League of Legends ve Riot Games, Riot Games, Inc.'in ticari markalarıdır.
- Proje, Riot Games'e ait hiçbir varlığı (görsel, ses, veri) barındırmaz ve dağıtmaz. Şampiyon görselleri çalışma zamanında CommunityDragon ve çalışan oyun istemcisi (LCU) gibi topluluk kaynaklarından çekilir.
- Kostüm paketleri üçüncü taraf topluluk arşivlerinden indirilir; bunların içeriğinden ilgili arşiv sahipleri sorumludur.
- Proje, LTK Manager'ın yama motorunu (patcher DLL'i) barındırmaz veya dağıtmaz. LTK Manager ayrı ve bağımsız bir açık kaynak projedir (GPL-3.0); VOID onunla yalnızca herkese açık `ltk://` derin bağlantı protokolü üzerinden, bağımsız olarak yeniden uygulanmış şekilde konuşur.
- Üçüncü taraf yazılımların kullanımı Riot Games Hizmet Şartları kapsamında değerlendirilebilir. Riski kabul ederek kullan.

---

## Katkı

Hata bildirimi ve öneriler için [Issues](https://github.com/ItzJPPPMe/Void-Menager/issues) bölümünü kullan. Katkı göndermeden önce lütfen şunları çalıştır:

```bash
npm run typecheck
npm run build
cd src-tauri && cargo test
```

Kod stili: mevcut yapıya ve isimlendirmeye uy; kaynak dosyalara yorum satırı ekleme.

---

## Lisans

[MIT](LICENSE) © 2026 VOID Skin Manager contributors

## Teşekkürler

- [LTK Manager / LeagueToolkit](https://github.com/LeagueToolkit/ltk-manager) — yama motoru ve `ltk://` protokolü
- [CommunityDragon](https://github.com/CommunityDragon) — şampiyon ve kostüm verisi
- Kostüm arşivlerini açık tutan topluluk geliştiricileri
