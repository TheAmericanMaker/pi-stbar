// pi-stbar desktop — binary entry point.
// Thin wrapper so the app logic lives in the library (mobile-target friendly).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    pi_stbar_desktop_lib::run()
}
