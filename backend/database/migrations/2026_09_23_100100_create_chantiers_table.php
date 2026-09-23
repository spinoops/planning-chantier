<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chantiers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('client')->nullable();
            $table->string('address')->nullable();
            $table->string('city', 120)->nullable();
            // Couleur d'affichage dans le calendrier (hex #rrggbb).
            $table->string('color', 7)->default('#2563eb');
            // planned : à venir · active : en cours · paused : suspendu · done : terminé
            $table->string('status', 20)->default('active')->index();
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chantiers');
    }
};
