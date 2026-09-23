<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Invitations nominatives : un utilisateur invite une adresse email précise,
     * le destinataire crée son compte via un lien à usage unique et expirable.
     */
    public function up(): void
    {
        Schema::create('invitations', function (Blueprint $table) {
            $table->id();
            $table->string('email')->index();

            // Jamais le token en clair : seul son SHA-256 est conservé.
            $table->string('token_hash', 64)->unique();

            // Rôle attribué au compte créé. Seul un admin peut inviter un admin.
            $table->string('role')->default('user');

            $table->foreignId('invited_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('accepted_by')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamp('expires_at');
            $table->timestamp('accepted_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invitations');
    }
};
