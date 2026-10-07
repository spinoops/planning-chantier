<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Planning v2 : heures travaillées, absences, imprévus signalés depuis le
     * chantier, photos, « passage » du patron sur une affectation, phase de
     * chantier, équipes temporaires.
     */
    public function up(): void
    {
        // Heures pointées par un employé (brouillon → soumis → validé).
        Schema::create('time_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('affectation_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('chantier_id')->nullable()->constrained()->nullOnDelete();
            $table->date('date');
            $table->time('start_time');
            $table->time('end_time');
            $table->unsignedSmallInteger('break_minutes')->default(0);
            $table->text('comment')->nullable();
            $table->string('status', 20)->default('draft')->index(); // draft | submitted | validated
            $table->foreignId('validated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('validated_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'date']);
            $table->index(['chantier_id', 'date']);
        });

        // Absences (vacances, maladie, école…) : la personne est grisée dans le planning.
        Schema::create('absences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('start_date');
            $table->date('end_date');
            $table->string('type', 20)->default('vacances'); // vacances | maladie | ecole | autre
            $table->string('note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['user_id', 'start_date', 'end_date']);
        });

        // Imprévus signalés depuis le chantier (absent demain, fini plus tôt, matériel manquant…).
        Schema::create('signalements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('affectation_id')->nullable()->constrained()->nullOnDelete();
            $table->date('date')->nullable();
            $table->string('type', 30)->default('autre'); // absence | fin_anticipee | materiel | autre
            $table->text('message');
            $table->timestamp('read_at')->nullable();
            $table->foreignId('read_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['read_at', 'created_at']);
        });

        // Photos de fin de journée attachées à une affectation.
        Schema::create('affectation_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('affectation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('path');
            $table->string('caption')->nullable();
            $table->timestamps();
        });

        // Rôle sur l'affectation : worker (équipe) ou visit (passage du patron / chef).
        Schema::table('affectation_user', function (Blueprint $table) {
            $table->string('role', 10)->default('worker')->after('user_id');
        });

        Schema::table('affectations', function (Blueprint $table) {
            $table->string('phase', 100)->nullable()->after('note');
        });

        // Équipe temporaire : masquée du planning après cette date.
        Schema::table('equipes', function (Blueprint $table) {
            $table->date('expires_at')->nullable()->after('sort_order');
        });
    }

    public function down(): void
    {
        Schema::table('equipes', fn (Blueprint $t) => $t->dropColumn('expires_at'));
        Schema::table('affectations', fn (Blueprint $t) => $t->dropColumn('phase'));
        Schema::table('affectation_user', fn (Blueprint $t) => $t->dropColumn('role'));
        Schema::dropIfExists('affectation_photos');
        Schema::dropIfExists('signalements');
        Schema::dropIfExists('absences');
        Schema::dropIfExists('time_entries');
    }
};
