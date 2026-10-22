//! Точка входа. Вся оболочка — в библиотеке, чтобы её же проверяли тесты.

fn main() {
    if let Err(err) = vkontakte_store_lib::run() {
        eprintln!("{err}");
        std::process::exit(1);
    }
}
