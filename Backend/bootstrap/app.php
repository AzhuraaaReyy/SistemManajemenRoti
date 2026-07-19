<?php

use App\Http\Middleware\EnsureUserIsActive;
use App\Http\Middleware\RoleMiddleware;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        apiPrefix: 'api/v1',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'role' => RoleMiddleware::class,
            'active' => EnsureUserIsActive::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Seluruh error pada rute API dikembalikan sebagai JSON dengan bentuk
        // yang konsisten: { success, message, errors? }. Frontend cukup membaca
        // satu format ini untuk semua jenis kegagalan.
        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            [$status, $message, $errors] = match (true) {
                $e instanceof ValidationException => [
                    422, 'Data yang dikirim tidak valid.', $e->errors(),
                ],
                $e instanceof AuthenticationException => [
                    401, 'Anda belum masuk atau sesi telah berakhir.', null,
                ],
                $e instanceof AuthorizationException => [
                    403, 'Anda tidak memiliki hak akses untuk tindakan ini.', null,
                ],
                $e instanceof ModelNotFoundException => [
                    404, 'Data yang diminta tidak ditemukan.', null,
                ],
                $e instanceof NotFoundHttpException => [
                    404, 'Endpoint tidak ditemukan.', null,
                ],
                $e instanceof HttpExceptionInterface => [
                    $e->getStatusCode(), $e->getMessage() ?: 'Permintaan gagal diproses.', null,
                ],
                default => [
                    500,
                    config('app.debug') ? $e->getMessage() : 'Terjadi kesalahan pada server.',
                    null,
                ],
            };

            return response()->json(array_filter([
                'success' => false,
                'message' => $message,
                'errors' => $errors,
            ], fn ($value) => $value !== null), $status);
        });
    })->create();
