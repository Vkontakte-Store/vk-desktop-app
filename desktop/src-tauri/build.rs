//! Прокидывает адрес сайта в сборку. По умолчанию — dev-стенд:
//! прод-домен ещё не выбран, localhost VK ID не принимает.

fn main() {
    let url =
        std::env::var("VKS_SITE_URL").unwrap_or_else(|_| "https://dev.vkontakte.store".to_string());
    if url.chars().any(char::is_control) {
        panic!("VKS_SITE_URL не должен содержать управляющие символы");
    }
    println!("cargo:rustc-env=VKS_SITE_URL={url}");
    println!("cargo:rerun-if-env-changed=VKS_SITE_URL");
    tauri_build::build()
}
