# Десктоп ВКонтакте Store

Окно на Tauri 2. Своего сервера нет: окно открывает сайт, вход VK ID и сессия — те же, что в браузере. Токенов VK в приложении нет.

Иконка собрана из `public/meta/apple-touch-icon-1024x1024.png`. Название окна и пункта в меню системы — «ВКонтакте Store». Имя пакета deb — `vkontakte-store`: в поле Package кириллицу dpkg не принимает.

## Адрес сайта

Зашивается при сборке переменной `VKS_SITE_URL`. Без неё окно открывает `https://dev.vkontakte.store`.

| Сборка | `VKS_SITE_URL` |
|---|---|
| dev-стенд (по умолчанию) | `https://dev.vkontakte.store` |
| прод, когда домен выберут | `https://app.vkontakte.store` |
| старый хост, если сайт переедет туда | `https://vkontakte.store` |
| вёрстка на своей машине | `http://localhost:3000` или `http://127.0.0.1:3000` |

Другой адрес программа не откроет. Путь, параметры и логин в адресе тоже нельзя: окно всегда открывает корень сайта.

Локальный адрес нужен, чтобы смотреть кабинет с `bun run dev`. Войти через VK с него нельзя: VK ID принимает только https-редиректы трёх хостов выше, `localhost` в кабинет приложения не добавлен. Вход проверяется сборкой на `https://dev.vkontakte.store`.

## Вход

Кнопка «Войти» на сайте делает обычный переход на `id.vk.ru` и обратно на `/auth/vk/callback` того хоста, который открыт в окне. Отдельной схемы входа и нового redirect URL нет.

Cookie сессии хранит профиль окна на диске (не в режиме без сохранения). После перезапуска человек остаётся в кабинете, несколько аккаунтов переключаются как на сайте. Выход из аккаунта — кнопки сайта, не отдельное меню оболочки.

В окне остаются хост сборки, вход VK ID (`id.vk.ru`, `id.vk.com`, `login.vk.com`) и страница оплаты ЮKassa (`yoomoney.ru`, `yookassa.ru` и их поддомены) — чтобы возврат на `/app/billing?payment=` не ушёл из приложения. `http` пускается только на `localhost` и `127.0.0.1`, и только у локальной сборки. Остальные ссылки и `window.open` открываются в системном браузере.

Если страница VK ID в окне перестанет открываться, запасной путь — системный браузер и одноразовый код. Он потребует серверный эндпоинт, но не новый redirect URL.

## Что нужно для сборки

- Rust 1.90 или новее (`rust-version` в `src-tauri/Cargo.toml`).
- Зависимости Tauri под свою ОС: <https://v2.tauri.app/start/prerequisites/>.
- На Linux: `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `patchelf`, `libssl-dev`, `libxdo-dev`.

Команды из `desktop/src-tauri`:

```bash
cargo test
cargo build
VKS_SITE_URL=https://dev.vkontakte.store cargo tauri build
```

`cargo tauri` — это пакет `tauri-cli` той же ветки 2.x, что и `tauri` в `Cargo.toml` (сейчас CLI 2.12). Установка один раз, не в репозиторий:

```bash
cargo install tauri-cli --version 2.12.4 --locked
```

Готовые файлы:

- Linux: `src-tauri/target/release/bundle/deb/` и `.../appimage/`
- Windows: `.../bundle/nsis/`
- macOS: `.../bundle/dmg/` и `.../bundle/macos/`

На Linux пакет deb использует системный WebKit (`libwebkit2gtk-4.1-0`, `libgtk-3-0`), свой Chromium в него не вложен. Сборка 0.1.0 на x86_64: deb 3,41 МиБ (3 574 994 байт), AppImage 78,46 МиБ (82 270 712 байт). Старый Electron, релиз v1.3.3: `vkontaktestore-linux.deb` 66,57 МиБ (69 802 602 байт). Deb меньше примерно в 20 раз. AppImage больше старого deb: в него вложен WebKit, которого в deb нет — его ставит система. AppImage запускается и без FUSE: `APPIMAGE_EXTRACT_AND_RUN=1 ./файл.AppImage`.

## Сборка в GitHub Actions

`.github/workflows/build.yml` собирает macOS (Apple Silicon и Intel), Windows и Linux на каждый пуш в ветку `tauri`, по тегу `v*` (черновик релиза) и вручную. Файлы лежат в артефактах запуска. Обычной сборке секреты не нужны.

Ручная сборка на своей машине — следующие разделы. Команды из `desktop/src-tauri`.

## Linux, вручную

На Ubuntu 24.04:

```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev \
  librsvg2-dev patchelf libssl-dev libxdo-dev build-essential file
cd desktop/src-tauri
cargo install tauri-cli --version 2.12.4 --locked
VKS_SITE_URL=https://dev.vkontakte.store cargo tauri build
```

## Windows, вручную

Нужны Rust (цепочка `stable-msvc`), Visual Studio Build Tools с компонентом C++ и WebView2 (на Windows 10/11 он уже есть). Из `desktop/src-tauri` в PowerShell:

```powershell
$env:VKS_SITE_URL = "https://dev.vkontakte.store"
cargo install tauri-cli --version 2.12.4 --locked
cargo tauri build
```

Установщик — NSIS (`vkontakte-store_0.1.0_x64-setup.exe`).

## macOS, вручную

Нужны Xcode Command Line Tools и Rust. Универсальную сборку делают двумя целями:

```bash
rustup target add aarch64-apple-darwin x86_64-apple-darwin
cd desktop/src-tauri
export VKS_SITE_URL=https://dev.vkontakte.store
cargo tauri build --target aarch64-apple-darwin
cargo tauri build --target x86_64-apple-darwin
```

Подпись и нотаризация Apple в эту задачу не входят: без сертификата разработчика dmg откроется только после разрешения в настройках системы.

## Обновления

Плагин `tauri-plugin-updater` подключён, но молчит, пока в `src-tauri/tauri.conf.json` пустые `plugins.updater.pubkey` и `endpoints`. Так сборка не требует ключ, а приложение никуда не стучится.

Ключ генерируют у себя (в репозиторий не попадает):

```bash
cargo install tauri-cli --version 2.12.4 --locked
mkdir -p ~/.tauri
cargo tauri signer generate -w ~/.tauri/vkontakte-store.key
```

Команда спросит пароль и напечатает открытый ключ. Дальше:

1. Открытый ключ вставить в `plugins.updater.pubkey`.
2. В `endpoints` указать адрес JSON обновления. Tauri подставляет `{{target}}`, `{{arch}}` и `{{current_version}}`, например `https://github.com/<орг>/<репозиторий>/releases/latest/download/latest.json`.
3. Сборку, которая публикует обновление, запускать так:

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/vkontakte-store.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD='пароль-из-шага-генерации'
cargo tauri build --config '{"bundle":{"createUpdaterArtifacts":true}}'
```

Закрытый ключ и пароль — только в окружении машины, которая выпускает сборку. Если пароль пустой, переменную всё равно задают пустой строкой: без неё сборщик подписи останавливается. Файл `~/.tauri/vkontakte-store.key` не коммитить.

Пока ключа нет, `createUpdaterArtifacts` остаётся `false`: иначе `cargo tauri build` потребует закрытый ключ и упадёт.

Когда ключ и адрес заданы, окно при старте само проверяет обновление и скачивает его. Перезапуск сразу не делается: в таблице могут быть несохранённые правки. Новая версия подхватывается со следующего запуска.

## Проверка без упаковки

```bash
cd desktop/src-tauri
VKS_SITE_URL=https://dev.vkontakte.store cargo run --release
```

Окно должно показать сайт. Кнопка «Войти» открывает VK ID в этом же окне.
