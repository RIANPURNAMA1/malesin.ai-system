# Token Efficient Development Rules

## Focused Code Analysis

Analisis hanya file yang berkaitan langsung dengan fitur yang akan dikerjakan.

Jangan membaca seluruh repository.

Ikuti alur:

1. Identifikasi modul terkait.
2. Cari file entry point dan service yang relevan.
3. Baca dependency yang benar-benar diperlukan.
4. Implementasikan perubahan secara terfokus.
5. Jalankan test yang berkaitan dengan perubahan.

Jangan membuka file yang tidak relevan dan jangan mengulang pembacaan file yang sudah dipahami dalam context.

## Additional Rules

- Hindari refactoring yang tidak diminta.
- Gunakan kembali komponen dan service yang tersedia.
- Jangan membaca node_modules, dist, build, atau .next.
- Batasi output terminal.
- Jangan membuat dokumentasi berlebihan.
- Prioritaskan implementasi yang efisien dan maintainable.