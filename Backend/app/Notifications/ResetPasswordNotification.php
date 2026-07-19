<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ResetPasswordNotification extends Notification
{
    use Queueable;

    public function __construct(public string $token)
    {
    }

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = self::resetUrl($this->token, $notifiable->email);
        $menit = config('auth.passwords.users.expire', 60);

        return (new MailMessage)
            ->subject('Atur Ulang Kata Sandi — '.config('app.name'))
            ->greeting('Halo, '.$notifiable->name.'!')
            ->line('Kami menerima permintaan untuk mengatur ulang kata sandi akun Anda.')
            ->action('Atur Ulang Kata Sandi', $url)
            ->line("Tautan ini hanya berlaku selama {$menit} menit.")
            ->line('Jika Anda tidak meminta perubahan kata sandi, abaikan email ini — tidak ada perubahan yang terjadi pada akun Anda.')
            ->salutation('Salam, Tim '.config('app.name'));
    }

    /**
     * Tautan menuju halaman React, bukan rute Blade bawaan Laravel.
     */
    public static function resetUrl(string $token, string $email): string
    {
        return rtrim(config('app.frontend_url'), '/')
            .'/reset-password?token='.$token
            .'&email='.urlencode($email);
    }
}
