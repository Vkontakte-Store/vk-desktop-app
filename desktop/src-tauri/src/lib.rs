//! Окно десктопа: открывает сайт ВКонтакте Store и больше ничего не делает.
//! Своего сервера и токенов VK здесь нет. Вход — обычный переход VK ID
//! в этом же окне, cookie сессии лежит в профиле окна и переживает запуск.
//! Проверка обновлений включается, только когда в конфиге есть открытый ключ.

use tauri::menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu};
use tauri::webview::{NewWindowResponse, WebviewWindowBuilder};
use tauri::{AppHandle, Manager, WebviewUrl};
use url::Url;

/// Адрес по умолчанию. Прод-домен ещё не выбран, поэтому сборка без переменной
/// смотрит на dev-стенд, а не на localhost: VK ID localhost не принимает.
pub const DEFAULT_SITE_URL: &str = "https://dev.vkontakte.store";

const WINDOW_TITLE: &str = "ВКонтакте Store";

/// Хосты, на которые VK ID реально умеет вернуть код. Другой https-адрес
/// в сборку не пускаем: человек ввёл бы пароль VK на чужой странице.
const ALLOWED_HTTPS_HOSTS: &[&str] = &[
    "dev.vkontakte.store",
    "app.vkontakte.store",
    "vkontakte.store",
];

pub fn run() -> Result<(), String> {
    let site = configured_site_url()?;
    let site_for_window = site.clone();

    let mut builder =
        tauri::Builder::default().plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Второй запуск не плодит окно: сессия одна, фокус возвращаем в неё.
            focus_main(&app);
        }));
    if updater_configured() {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .menu(|app| build_menu(app))
        .on_menu_event(|app, event| on_menu(app, &event))
        .setup(move |app| {
            let handle = app.handle().clone();
            let site_for_nav = site_for_window.clone();
            let window =
                WebviewWindowBuilder::new(app, "main", WebviewUrl::External(site_for_window))
                    .title(WINDOW_TITLE)
                    .inner_size(1100.0, 720.0)
                    .min_inner_size(800.0, 480.0)
                    .center()
                    .focused(true)
                    // Пока сайт грузится, фон как у шапки кабинета, а не белая вспышка.
                    .background_color(tauri::window::Color(0x51, 0x81, 0xb8, 255))
                    // Профиль на диске. incognito стёр бы cookie сессии при выходе.
                    .incognito(false)
                    // На Linux и Windows буфер обмена из коробки выключен, вставка в таблице молчала бы.
                    .enable_clipboard_access()
                    .on_document_title_changed(|window, _title| {
                        let _ = window.set_title(WINDOW_TITLE);
                    })
                    .on_navigation(move |url| {
                        if navigation_allowed(url, &site_for_nav) {
                            return true;
                        }
                        // Чужой адрес не оставляем под заголовком «ВКонтакте Store».
                        open_external(url);
                        false
                    })
                    .on_new_window(|url, _features| {
                        // window.open (помощь, группа VK) всегда уходит в системный браузер.
                        open_external(&url);
                        NewWindowResponse::Deny
                    })
                    .build()?;
            let _ = window;

            if updater_configured() {
                let app = handle.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(err) = install_update_if_any(&app).await {
                        eprintln!("updater check failed: {err}");
                    }
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .map_err(|err| err.to_string())
}

fn focus_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn build_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<Menu<R>> {
    // На macOS вставка в поле работает только если в меню есть штатные пункты правки.
    let file = Submenu::with_items(
        app,
        "Файл",
        true,
        &[&PredefinedMenuItem::quit(app, Some("Выход"))?],
    )?;
    let edit = Submenu::with_items(
        app,
        "Правка",
        true,
        &[
            &PredefinedMenuItem::undo(app, Some("Отменить"))?,
            &PredefinedMenuItem::redo(app, Some("Повторить"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, Some("Вырезать"))?,
            &PredefinedMenuItem::copy(app, Some("Копировать"))?,
            &PredefinedMenuItem::paste(app, Some("Вставить"))?,
            &PredefinedMenuItem::select_all(app, Some("Выделить всё"))?,
        ],
    )?;
    let view = Submenu::with_items(
        app,
        "Вид",
        true,
        &[&MenuItem::with_id(
            app,
            "reload",
            "Обновить",
            true,
            Some("CmdOrCtrl+R"),
        )?],
    )?;
    Menu::with_items(app, &[&file, &edit, &view])
}

fn on_menu(app: &AppHandle, event: &MenuEvent) {
    if event.id() == "reload" {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.eval("location.reload()");
        }
    }
}

/// Адрес, зашитый при сборке (`VKS_SITE_URL` или dev-стенд).
pub fn configured_site_url() -> Result<Url, String> {
    parse_site_url(env!("VKS_SITE_URL")).map_err(|err| format!("Не открываю окно: {err}"))
}

/// Пускаем только известные адреса сайта и локальную разработку.
/// Путь, параметры и логин в адресе запрещены: сборка открывает корень сайта.
pub fn parse_site_url(raw: &str) -> Result<Url, &'static str> {
    let url = Url::parse(raw.trim()).map_err(|_| "адрес сайта не разбирается")?;
    if !url.username().is_empty() || url.password().is_some() {
        return Err("в адресе сайта не должно быть логина и пароля");
    }
    if url.query().is_some() || url.fragment().is_some() {
        return Err("адрес сайта задаётся без параметров и якоря");
    }
    if url.path() != "/" && !url.path().is_empty() {
        return Err("адрес сайта — это только хост, без пути");
    }
    let host = url.host_str().ok_or("в адресе сайта нет хоста")?;
    match url.scheme() {
        "https" => {
            if !ALLOWED_HTTPS_HOSTS.contains(&host) {
                return Err(
                    "для https разрешены только dev.vkontakte.store, app.vkontakte.store и vkontakte.store",
                );
            }
            if url.port().is_some() {
                return Err("у адреса сайта порт не указывается");
            }
        }
        "http" => {
            if host != "localhost" && host != "127.0.0.1" {
                return Err("по http можно открыть только localhost");
            }
        }
        _ => return Err("нужен http для localhost или https для сайта"),
    }
    Ok(url)
}

/// Куда браузер реально уходит при входе. Стартуем на id.vk.ru/authorize,
/// VK может перекинуть на id.vk.com или login.vk.com. vk.com не входит:
/// ссылка на группу должна открыться снаружи, а не подменить кабинет.
const VK_ID_HOSTS: &[&str] = &["id.vk.ru", "id.vk.com", "login.vk.com"];

/// confirmation_url редиректа ЮKassa — страница на yoomoney.ru.
/// yookassa.ru — тот же платёж, если касса откроет свой поддомен.
/// Чужой банк 3-D Secure сюда не входит: это уже не касса.
const PAYMENT_HOSTS: &[&str] = &["yoomoney.ru", "yookassa.ru"];

/// В окне остаются хост сборки, вход VK ID и страница оплаты.
/// http — только localhost и 127.0.0.1, и только если сама сборка локальная.
/// Иначе человек ушёл бы с dev-стенда на чужой http под нашим заголовком.
pub fn navigation_allowed(url: &Url, site: &Url) -> bool {
    let Some(host) = url.host_str() else {
        return false;
    };
    if url.port().is_some() && url.scheme() != "http" {
        return false;
    }
    match url.scheme() {
        "https" => {
            host_eq(host, site.host_str().unwrap_or(""))
                || host_in(host, VK_ID_HOSTS)
                || host_in(host, PAYMENT_HOSTS)
        }
        "http" => local_host(host) && local_host(site.host_str().unwrap_or("")),
        _ => false,
    }
}

fn open_external(url: &Url) {
    if matches!(url.scheme(), "http" | "https") {
        let _ = open::that(url.as_str());
    }
}

fn local_host(host: &str) -> bool {
    host.eq_ignore_ascii_case("localhost") || host == "127.0.0.1"
}

fn host_eq(host: &str, expected: &str) -> bool {
    host.eq_ignore_ascii_case(expected)
}

/// Точное имя или поддомен. «notyoomoney.ru» и «yoomoney.ru.evil.test» не проходят.
fn host_in(host: &str, parents: &[&str]) -> bool {
    let host = host.to_ascii_lowercase();
    parents.iter().any(|parent| {
        let parent = parent.to_ascii_lowercase();
        host == parent || host.ends_with(&format!(".{parent}"))
    })
}

/// Пустой ключ в репозитории — это выключенные обновления, а не ошибка сборки.
/// Закрытый ключ подписи в репозиторий не кладётся.
fn updater_configured() -> bool {
    let Ok(conf) = serde_json::from_str::<serde_json::Value>(include_str!("../tauri.conf.json"))
    else {
        return false;
    };
    let Some(updater) = conf.pointer("/plugins/updater") else {
        return false;
    };
    let pubkey = updater
        .get("pubkey")
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .trim();
    if pubkey.is_empty() {
        return false;
    }
    updater
        .get("endpoints")
        .and_then(|value| value.as_array())
        .is_some_and(|items| {
            items
                .iter()
                .any(|item| item.as_str().is_some_and(|url| !url.is_empty()))
        })
}

/// Качаем обновление и ставим его на диск. Окно само не перезапускаем:
/// в таблице могут быть несохранённые правки, новая версия подхватится со следующего запуска.
async fn install_update_if_any(app: &AppHandle) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;
    let updater = app.updater().map_err(|err| err.to_string())?;
    let Some(update) = updater.check().await.map_err(|err| err.to_string())? else {
        return Ok(());
    };
    update
        .download_and_install(|_chunk, _total| {}, || {})
        .await
        .map_err(|err| err.to_string())
}

#[cfg(test)]
mod tests {
    use super::{navigation_allowed, parse_site_url, DEFAULT_SITE_URL};
    use url::Url;

    fn parsed(raw: &str) -> Url {
        Url::parse(raw).unwrap_or_else(|_| panic!("адрес {raw}"))
    }

    #[test]
    fn site_url_allowlist() {
        let dev = parse_site_url(DEFAULT_SITE_URL).expect("dev");
        assert_eq!(dev.scheme(), "https");
        assert_eq!(dev.host_str(), Some("dev.vkontakte.store"));

        assert!(parse_site_url("https://app.vkontakte.store").is_ok());
        assert!(parse_site_url("https://vkontakte.store/").is_ok());
        assert!(parse_site_url("http://localhost:3000").is_ok());
        assert!(parse_site_url("http://127.0.0.1:3000/").is_ok());

        assert!(parse_site_url("http://dev.vkontakte.store").is_err());
        assert!(parse_site_url("https://localhost:3000").is_err());
        assert!(parse_site_url("https://evil.example").is_err());
        assert!(parse_site_url("https://dev.vkontakte.store/login").is_err());
        assert!(parse_site_url("https://dev.vkontakte.store/?next=1").is_err());
        assert!(parse_site_url("https://user:pass@dev.vkontakte.store").is_err());
        assert!(parse_site_url("file:///etc/passwd").is_err());
        assert!(parse_site_url("javascript:alert(1)").is_err());
    }

    #[test]
    fn window_keeps_only_site_login_and_payment() {
        let dev = parsed(DEFAULT_SITE_URL);
        let local = parsed("http://localhost:3000");

        assert!(navigation_allowed(
            &parsed("https://dev.vkontakte.store/app/billing?payment=pay-1"),
            &dev
        ));
        assert!(navigation_allowed(
            &parsed("https://id.vk.ru/authorize?response_type=code"),
            &dev
        ));
        assert!(navigation_allowed(&parsed("https://id.vk.com/auth"), &dev));
        assert!(navigation_allowed(&parsed("https://login.vk.com/"), &dev));
        assert!(navigation_allowed(
            &parsed("https://yoomoney.ru/checkout/payments/v2/contract?orderId=1"),
            &dev
        ));
        assert!(navigation_allowed(
            &parsed("https://checkout.yoomoney.ru/pay"),
            &dev
        ));
        assert!(navigation_allowed(
            &parsed("https://yookassa.ru/checkout"),
            &dev
        ));

        assert!(!navigation_allowed(
            &parsed("https://vk.com/vkstorevk"),
            &dev
        ));
        assert!(!navigation_allowed(
            &parsed("https://evil.example/phish"),
            &dev
        ));
        assert!(!navigation_allowed(
            &parsed("https://app.vkontakte.store/"),
            &dev
        ));
        assert!(!navigation_allowed(
            &parsed("https://dev.vkontakte.store.evil.test/"),
            &dev
        ));
        assert!(!navigation_allowed(
            &parsed("https://notyoomoney.ru/checkout"),
            &dev
        ));
        assert!(!navigation_allowed(
            &parsed("https://yoomoney.ru.evil.test/"),
            &dev
        ));
        assert!(!navigation_allowed(
            &parsed("http://dev.vkontakte.store/"),
            &dev
        ));
        assert!(!navigation_allowed(&parsed("http://localhost:3000/"), &dev));
        assert!(!navigation_allowed(&parsed("http://evil.example/"), &dev));
        assert!(!navigation_allowed(
            &parsed("https://dev.vkontakte.store:8443/"),
            &dev
        ));
        assert!(!navigation_allowed(&parsed("file:///tmp/x"), &dev));
        assert!(!navigation_allowed(&parsed("javascript:alert(1)"), &dev));
        assert!(!navigation_allowed(&parsed("about:blank"), &dev));

        assert!(navigation_allowed(
            &parsed("http://localhost:3000/app/groups"),
            &local
        ));
        assert!(navigation_allowed(
            &parsed("http://127.0.0.1:3000/login"),
            &local
        ));
        assert!(navigation_allowed(
            &parsed("https://id.vk.ru/authorize"),
            &local
        ));
        assert!(!navigation_allowed(
            &parsed("https://dev.vkontakte.store/"),
            &local
        ));
        assert!(!navigation_allowed(&parsed("http://192.168.0.1/"), &local));
    }
}
