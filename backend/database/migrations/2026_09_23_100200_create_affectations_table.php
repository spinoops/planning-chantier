<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Une affectation = un chantier placé sur un jour du calendrier, avec
     * un créneau optionnel et la liste des ouvriers qui y sont envoyés.
     */
    public function up(): void
    {
        Schema::create('affectations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('chantier_id')->constrained()->cascadeOnDelete();
            $table->date('date')->index();
            $table->time('start_time')->nullable();
            $table->time('end_time')->nullable();
            $table->text('note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['date', 'chantier_id']);
        });

        Schema::create('affectation_user', function (Blueprint $table) {
            $table->foreignId('affectation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->primary(['affectation_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('affectation_user');
        Schema::dropIfExists('affectations');
    }
};
