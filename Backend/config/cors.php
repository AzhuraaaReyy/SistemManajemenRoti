<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS)
    |--------------------------------------------------------------------------
    |
    | Frontend React berjalan di port yang berbeda dari Laravel, sehingga
    | browser memperlakukannya sebagai origin lain. Daftar di bawah menyebutkan
    | origin mana saja yang boleh memanggil API ini.
    |
    | Karena autentikasi memakai JWT lewat header Authorization (bukan cookie),
    | 'supports_credentials' tidak perlu diaktifkan.
    |
    */

    'paths' => ['api/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [
        env('FRONTEND_URL', 'http://localhost:5180'),
        'http://localhost:5180',
        'http://127.0.0.1:5180',
    ],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
