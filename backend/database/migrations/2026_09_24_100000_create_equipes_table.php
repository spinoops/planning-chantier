<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Équipes : groupe d'employés (souvent une seule personne) planifié d'un bloc.
     * Un employé appartient à une équipe au plus ; une affectation peut viser
     * une équipe (son équipe est alors recopiée dans les ouvriers de l'affectation).
     */
    public function up(): void
    {
        Schema::create('equipes', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            // Couleur de l'équipe dans le calendrier (#rrggbb).
            $table->string('color', 7)->default('#2563eb');
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('equipe_id')->nullable()->after('color')->constrained()->nullOnDelete();
        });

        Schema::table('affectations', function (Blueprint $table) {
            $table->foreignId('equipe_id')->nullable()->after('chantier_id')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('affectations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('equipe_id');
        });
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('equipe_id');
        });
        Schema::dropIfExists('equipes');
    }
};
