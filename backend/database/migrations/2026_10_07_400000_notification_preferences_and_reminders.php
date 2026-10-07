<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Notifications push : préférences par utilisateur (délai de rappel avant un chantier,
 * alerte quand son planning change) et journal des rappels envoyés (un seul rappel
 * par affectation et par personne, même si le cron passe plusieurs fois).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Minutes avant le début du chantier (0 = pas de rappel).
            $table->unsignedSmallInteger('notify_before_minutes')->default(60)->after('color');
            // Prévenir quand une affectation d'aujourd'hui / demain est créée, modifiée ou annulée.
            $table->boolean('notify_changes')->default(true)->after('notify_before_minutes');
        });

        Schema::create('affectation_reminders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('affectation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('sent_at');
            $table->unique(['affectation_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('affectation_reminders');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['notify_before_minutes', 'notify_changes']);
        });
    }
};
