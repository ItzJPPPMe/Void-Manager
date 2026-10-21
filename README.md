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
4. **Kurulum** — LTK Manager paketi indirir ve kütüphanesine ekler. Modun oyunda görünmesi için LTK profilinde etkin olması gerekir; etkin/pasif durumunu VOID'un **Modlar** ekranından izleyebilirsin.
5. **Uygulama** — LTK patcher'ı oyun açılırken overlay'i enjekte eder. Oyunu normal şekilde (Riot Client üzerinden) başlatman yeterlidir.

---

## Özellikler

### Katalog ve senkronizasyon

- **Türkçe kostüm adları**: senkronizasyon sonunda isimler Data Dragon `tr_TR` verisiyle yerelleştirilir; LTK'ya gönderilen mod adı da Türkçe kaydedilir.
- Birden fazla topluluk kaynağından hibrit katalog taraması, çakışmalarda ağırlığa göre çözümleme.
- **Akıllı senkronizasyon (Smart Sync)**: her kaynağın içerik parmak izi hesaplanır; değişmeyen kaynaklar yeniden işlenmek yerine önbellekten yeniden kullanılır. Senkronizasyon sonunda hangi kaynağın değiştiği, hangisinin önbellekten geldiği bildirilir.
- **Bulanık arama (Fuzzy)**: yazarken harf hatası yapsan bile sonuç bulunur; Türkçe karakterler (ı/İ, ş/ş, ğ/ğ, ü/ü, ö/ö, ç/ç) normalize edilir. `Gelişmiş` ayarlarından kapatılabilir.

### Koleksiyon deneyimi

- İki ayrı menü: **Kostümler** (katalogdan kostüm seç ve gönder) ve **Modlar** (LTK kütüphanesini yönet).
- **Açılış ekranı (Boot Screen)**: uygulama açılışında logo animasyonu ve ilerleme göstergesi.
- **Komut paleti** (`Ctrl+K`): şampiyon, kostüm ve eylemleri tek yerden arayıp çalıştır. Pano, Skin Roulette, tema editörü ve bildirim merkezi de paletten açılır.
- **Sana öneriler**: son bakılanlara, favorilere ve nadirliğe göre kişiselleştirilmiş kostüm şeridi.
- **Koleksiyon panosu** (`B`): toplam kostüm, favori, hazır, chroma oranı, nadirlik dağılımı ve şampiyon sıralaması.
- **Skin Roulette** (`L`): çarkı çevirip rastgele kostüm seç; seçilen kostümün sinematik önizlemesini aç.
- **Sinematik önizleme**: tam ekran splash, chroma galerisi ve kaynak bilgisi.
- **Çoklu seçim**: birden fazla kostüm seçip toplu favori işlemi uygula.
- **Sanal kaydırma**: yüzlerce kostümde performanslı ızgara.
- **Kostüm detay modalı**: büyük splash, tüm chroma galerisi, kaynaklar, favori ve LTK'ya gönderme; `←` / `→` ile kostümler arasında gezinme.
- **Görsel ve paket araçları**: detaydan splash görselini diske kaydet, paket bağlantısını kopyala veya paketi indirip doğrudan LTK kütüphanesine aktar (çevrimdışı kurulum için).
- **Şampiyon galerisi**: seçili şampiyonun tüm kostümlerini görsel ızgarada gez (`G`).
- **Kalıcı favoriler ve son bakılanlar**: favoriler yeniden başlatmada korunur, komut paletinde son bakılanlara hızlı erişim ve favori sayacı.
- **Gelişmiş filtreler**: nadirlik, kaynak, "yalnızca paketli", hazır/chroma filtreleri ve isim / nadirlik / şampiyon / ID sıralaması.
- **Kart yoğunluğu**: kompakt / normal / büyük ızgara arasında geçiş.
- **Kostüm adı dili**: Türkçe veya İngilizce adlar arasında seçim; değişiklik otomatik senkronla uygulanır.
- **Koleksiyon yedeği**: favorileri ve son görüntülenenleri JSON olarak dışa/içe aktarma.
- **Sürpriz kostüm**: filtrelenen havuzdan rastgele seçim (`R` kısayolu).

### Tema ve arayüz

- **Tema editörü** (`Ctrl+Shift+T`): hazır vurgu renkleri (cyan, violet, magenta, lime) veya özel hex renk, parlama yoğunluğu, köşe yuvarlaklığı (keskin / yumuşak / yuvarlak) ve animasyon hızı ayarı.
- **Bildirim merkezi** (`N`): uygulama içi bildirim geçmişi, okunmamış sayacı ve zil rozeti.
- **Gelişmiş animasyonlar**: açılış, geçiş, shimmer ve açığa çıkma efektleri; tamamen kapatılabilir ve hızı ayarlanabilir.
- Neon karanlık tema, çerçevesiz pencere.

### Mod yönetimi

- **Modlar** ekranı: LTK kütüphanesindeki yüklü modları ad, sürüm, yazar ve şampiyon bilgisiyle listeler; yerel `.fantome` / `.modpkg` / `.zip` paketlerini tek tuşla veya **sürükle-bırak** ile LTK'ya aktarır.
- **Mod yönetimi**: modları doğrudan etkinleştir / devre dışı bırak (LTK `library.json` yedeklenerek yazılır), mod detay çekmecesinden klasörü aç.
- **Toplu işlemler**: tüm modları tek tıkla etkinleştir veya kapat.
- **Kütüphane yedekleme**: `library.json` dosyasını istediğin konuma yedekle, listelenen yedeklerden geri yükle.
- **Mod sağlık kontrolü**: eksik klasör, boş klasör, okunamayan `mod.config.json`, yinelenen kimlik ve eksik biçim bilgisi gibi sorunları tespit eder.
- **Kütüphane gezgini**: LTK klasörünü dosya dosya gez, dosyaları doğrudan aç.
- **Patcher yönetimi**: VOID üzerinden LTK'yı Windows açılışında başlatma ve sessiz mod (tepside çalış + patcher'ı otomatik başlat) tek anahtarla ayarlanır.

### VOID Yama Motoru

LTK Manager'a ihtiyaç duymadan çalışan, VOID'un kendi yama motoru. Rust tarafında
Apache-2.0 lisanslı [`ltk_overlay`](https://crates.io/crates/ltk_overlay),
[`ltk_modpkg`](https://crates.io/crates/ltk_modpkg),
[`ltk_fantome`](https://crates.io/crates/ltk_fantome) ve
[`ltk_mod_project`](https://crates.io/crates/ltk_mod_project) crate'leri
kullanılır; GPL-3.0 kod kopyalanmaz.

- **Kendi kütüphane**: paketler `%APPDATA%\VOID\mods` altına açılır, etkin/pasif
  durumu `%APPDATA%\VOID\library.json` dosyasında tutulur.
- **Paket içe aktarma**: `.modpkg` ve `.fantome` dosyaları açılır; sürükle-bırak
  veya dosya seçici ile eklenir.
- **Overlay derleme**: etkin modlardan yamalanmış WAD dosyaları
  `%APPDATA%\VOID\profiles\default\overlay` altına üretilir. İnşaiye göre
  değişmeyen WAD'lar yeniden kullanılır, ilerleme arayüze canlı akar.
- **Oyun bağlantısı**: resmi `ltk_patcher_host.exe` ile satır tabanlı bir protokol
  üzerinden konuşulur (`config loglevel`, `config flags`, `config prefix`,
  `start scan`, `stop`). Host'un ürettiği olaylar arayüze aktarılır.
- **Patcher binary'leri**: `ltk_patcher_host.exe` ve `ltk_patcher_dll.dll`
  VOID tarafından dağıtılmaz. Uygulamanın yanındaki `patcher` klasörüne ya da
  `%LOCALAPPDATA%\VOID\patcher` içine kopyalanır. Overlay derlemesi bu
  dosyalar olmadan da çalışır.

### Sistem

- **Özel başlık çubuğu**: sürüklenebilir pencere, küçült / büyüt / kapat düğmeleri; pencere boyutu ve konumu hatırlanır.
- **Güncelleme denetimi** (açılışta denetim anahtarı dahil) ve **istatistik paneli** (koleksiyon, kaynak ve nadirlik dağılımı, mod özeti, önbellek boyutu).
- **Klavye kısayolları**: `Ctrl+K` palet, `Ctrl+,` ayarlar, `Ctrl+Shift+T` tema, `Ctrl+1/2` görünüm, `F` favori, `R` rastgele, `G` galeri, `B` pano, `L` çark, `N` bildirimler, `/` arama, `?` yardım.
- Şampiyon ve kostüm arama, favoriler, kaynak / hazır durumuna göre filtreleme.
- Çalışan oyundan yerel (LCU) veri kaynağı; LCU yoksa otomatik olarak çevrimiçi (CommunityDragon) kaynağa düşer.
- Görsel önbelleği (disk / bellek), TTL ayarı ve tek tuşla temizleme.
- LTK Manager durum takibi: kurulu mu, **patcher çalışıyor mu** (durum çubuğunda canlı rozet).

---

## Gereksinimler

**Kullanım için**

- Windows 10 / 11 (x64)
- WebView2 Runtime (Windows 11'de hazır gelir; Windows 10'da gerekebilir)
- [LTK Manager](https://github.com/LeagueToolkit/ltk-manager) — LTK kütüphanesi yoluyla çalışmak için; VOID'un kendi yama motoru bu zorunluluğu kaldırır, ancak oyun bağlantısı için `ltk_patcher_host.exe` ve `ltk_patcher_dll.dll` dosyaları gerekir

**Kaynaktan derlemek için**

- Node.js 18+ ve npm
- Rust (stable) — `x86_64-pc-windows-msvc`
- Visual Studio Build Tools (Desktop development with C++) + Windows SDK
- WebView2 Runtime

---

## Kurulum

[Releases](https://github.com/ItzJPPPMe/Void-Manager/releases/latest) sayfasından `VOID-Skin-Manager-Setup.exe` dosyasını indirip çalıştır. Alternatif olarak `.msi` paketi de yayınlanır.

### İlk kurulumdan sonra

Kostümlerin oyunda görünmesi için LTK Manager'ın patcher'ının çalışıyor olması gerekir. VOID bunu senin yerine ayarlayabilir: **Modlar** ekranındaki *Patcher Kontrolü* kartından iki anahtarı aç.

| Anahtar | Ne yapar |
| --- | --- |
| **Windows açılışında başlat** | LTK'yı Windows başlangıcına kaydeder (kullanıcı `Run` anahtarı), bilgisayar açıldığında patcher hazır olur. |
| **Sessiz mod** | LTK ayarlarında *Start in tray* + *Always start the patcher* seçeneklerini açar; pencere açılmadan tepside çalışır. |

Bu ikisi açıkken: bilgisayarı aç, LTK arka planda hazır olsun, oyunu Riot Client'ten başlat. VOID'un durum çubuğundaki `Patcher çalışıyor` rozeti bunu doğrular.

Aynı ayarları LTK Manager içinden de yapabilirsin: **LTK Manager → Settings → Startup and tray** (Auto run / Start in tray / Always start the patcher).

---

## Kaynaktan derleme

```bash
git clone https://github.com/ItzJPPPMe/Void-Manager.git
cd Void-Manager
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
│   │   ├── layout/           # başlık, durum çubuğu, boot ekranı, bildirim merkezi
│   │   ├── modals/           # pano, roulette, tema editörü, sinematik, gezgin
│   │   ├── mods/             # Modlar ekranı (LTK kütüphanesi + patcher kontrolü)
│   │   │                     # ve VOID'un kendi yama motoru paneli
│   │   ├── panel/            # seçili kostüm paneli
│   │   ├── settings/         # ayarlar ekranı
│   │   └── skins/            # kostüm kartları, sanal ızgara, öneriler
│   ├── hooks/                # veri kaynakları, senkronizasyon kancaları
│   ├── lib/                  # tema, fuzzy arama, öneriler, senkronizasyon önbelleği
│   ├── services/             # syncService, ltkManager, voidEngine, görsel yükleyici
│   ├── store/                # zustand store'ları
│   ├── types/                # tipler ve varsayılan kaynaklar
│   └── styles/               # Tailwind katmanları
└── src-tauri/                # Rust tarafı
    └── src/
        ├── lib.rs            # Tauri komutları
        ├── voidmods.rs       # kendi kütüphane, paket içe aktarma, overlay derleme
        └── voidpatcher.rs    # patcher host protokol istemcisi
```

Rust tarafındaki ana komutlar (`src-tauri/src/lib.rs`):

| Komut | Görevi |
| --- | --- |
| `get_system_status`, `detect_league_path`, `detect_riot_client_path` | Ortam tespiti |
| `lcu_status`, `fetch_text`, `fetch_text_cached` | Ağ ve yerel oyun verisi |
| `download_to_cache`, `cache_resolve`, `clear_image_cache` | Görsel önbelleği |
| `ltk_manager_status`, `ltk_install`, `ltk_open`, `ltk_import_file` | LTK Manager entegrasyonu |
| `ltk_library`, `ltk_patcher_config`, `ltk_set_autostart`, `ltk_set_patcher_flags`, `ltk_launch` | LTK kütüphanesi ve patcher yönetimi |
| `ltk_set_mod_enabled`, `ltk_set_mods_bulk` | Mod etkin/pasif yönetimi (toplu) |
| `ltk_list_backups`, `ltk_backup_library`, `ltk_restore_library` | Kütüphane yedekleme ve geri yükleme |
| `ltk_mod_health` | Mod sağlık kontrolü (eksik klasör, boş klasör, okunamayan config) |
| `list_dir_entries`, `open_folder` | Kütüphane gezgini |
| `app_info` | Uygulama sürümü / platform bilgisi |
| `extract_mod_package`, `apply_mod`, `revert_last_patch` | Paket inceleme ve yedekleme |
| `void_mods_paths`, `void_mods_list`, `void_mods_import`, `void_mods_set_enabled`, `void_mods_remove` | VOID'un kendi mod kütüphanesi (paket açma, etkin/pasif) |
| `void_mods_build_overlay` | Etkin modlardan yamalanmış WAD overlay'i üretir |
| `void_patcher_status`, `void_patcher_config`, `void_patcher_start`, `void_patcher_stop`, `void_patcher_logs` | Patcher host protokolü ve durum takibi |

---

## Teknolojiler

Tauri 2, React 18, TypeScript, Zustand, Tailwind CSS, Vite, Rust. İkonlar [Lucide](https://lucide.dev), animasyonlar Framer Motion.

---

## Bilinen sınırlamalar

- Yalnızca Windows x64 hedeflenir.
- Kostümleri oyunda görmek için LTK Manager'ın kurulu ve patcher'ının çalışıyor olması gerekir; LTK kurulu değilse VOID'un kendi yama motoru kullanılabilir, ancak bu durumda `ltk_patcher_host.exe` ve `ltk_patcher_dll.dll` dosyalarının kendiniz sağlanması gerekir.
- Yerel (LCU) kaynak oyunun mevcut varlıklarını gösterir, dağıtılabilir `.fantome` paketi sunmaz; bu yüzden yerel kaynaktaki kostümler LTK'ya gönderilemez.
- İlk taramada çok sayıda görsel indirildiği için önbellek açıkken ilk açılış yavaş olabilir.

---

## Yasal uyarılar

- Bu proje Riot Games ile ilişkili değildir ve Riot Games tarafından desteklenmemektedir. League of Legends ve Riot Games, Riot Games, Inc.'in ticari markalarıdır.
- Proje, Riot Games'e ait hiçbir varlığı (görsel, ses, veri) barındırmaz ve dağıtmaz. Şampiyon görselleri çalışma zamanında CommunityDragon ve çalışan oyun istemcisi (LCU) gibi topluluk kaynaklarından çekilir.
- Kostüm paketleri üçüncü taraf topluluk arşivlerinden indirilir; bunların içeriğinden ilgili arşiv sahipleri sorumludur.
- Proje, LTK Manager'ın yama motorunu (patcher DLL'i) barındırmaz veya dağıtmaz. LTK Manager ayrı ve bağımsız bir açık kaynak projedir (GPL-3.0); VOID onunla yalnızca herkese açık `ltk://` derin bağlantı protokolü üzerinden, bağımsız olarak yeniden uygulanmış şekilde konuşur.
- VOID'un kendi yama motoru, LeagueToolkit'in Apache-2.0 lisanslı `ltk_overlay`, `ltk_modpkg`, `ltk_fantome` ve `ltk_mod_project` crate'lerini kütüphane olarak kullanır; bu crate'ler bağımsız olarak geliştirilip crates.io'da yayımlanmıştır. GPL-3.0 lisanslı `ltk-manager-runtime` kodu kopyalanmamıştır.
- `ltk_patcher_host.exe` ve `ltk_patcher_dll.dll` dosyaları VOID tarafından paketlenmez ve dağıtılmaz; kullanıcı tarafından sağlanır.
- Üçüncü taraf yazılımların kullanımı Riot Games Hizmet Şartları kapsamında değerlendirilebilir. Riski kabul ederek kullan.

---

## Katkı

Hata bildirimi ve öneriler için [Issues](https://github.com/ItzJPPPMe/Void-Manager/issues) bölümünü kullan. Katkı göndermeden önce lütfen şunları çalıştır:

```bash
npm run typecheck
npm run build
cd src-tauri && cargo test
```


---

## Lisans

[MIT](LICENSE) © 2026 VOID Skin Manager contributors

## Teşekkürler

- [LTK Manager / LeagueToolkit](https://github.com/LeagueToolkit/ltk-manager) — yama motoru ve `ltk://` protokolü
- [LeagueToolkit / league-mod](https://github.com/LeagueToolkit/league-mod) — Apache-2.0 `ltk_overlay`, `ltk_modpkg`, `ltk_fantome`, `ltk_mod_project` crate'leri
- [CommunityDragon](https://github.com/CommunityDragon) — şampiyon ve kostüm verisi
- Kostüm arşivlerini açık tutan topluluk geliştiricileri
