<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Préparation d'un chantier (étapes 1 à 4 du déroulé) : client sélectionnable,
     * sous-traitants prévus, matériel, mesures, estimation de temps, suivi du devis,
     * reprise des mesures après acceptation, estimation pour le planning.
     */
    public function up(): void
    {
        Schema::create('clients', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('contact_name')->nullable();
            $table->string('phone', 40)->nullable();
            $table->string('email')->nullable();
            $table->string('address')->nullable();
            $table->string('city', 120)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('sous_traitants', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('trade', 100)->nullable(); // électricien, sanitaire, grutier…
            $table->string('contact_name')->nullable();
            $table->string('phone', 40)->nullable();
            $table->string('email')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('chantier_sous_traitant', function (Blueprint $table) {
            $table->foreignId('chantier_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sous_traitant_id')->constrained()->cascadeOnDelete();
            $table->string('note')->nullable();   // « 2 jours, semaine 42 »
            $table->date('planned_date')->nullable();
            $table->primary(['chantier_id', 'sous_traitant_id']);
        });

        Schema::table('chantiers', function (Blueprint $table) {
            $table->foreignId('client_id')->nullable()->after('client')->constrained()->nullOnDelete();
            // Étape 1 : estimation initiale (heures), mesures, matériel prévu.
            $table->decimal('estimated_hours', 8, 2)->nullable()->after('notes');
            $table->text('mesures')->nullable()->after('estimated_hours');
            $table->json('materiel')->nullable()->after('mesures'); // [{label, qty, done}]
            // Étape 2 : devis (à prévoir : suivi seulement, pas d'édition).
            $table->string('quote_status', 20)->default('none')->after('materiel'); // none | to_prepare | sent | accepted | refused
            $table->decimal('quote_amount', 12, 2)->nullable()->after('quote_status');
            $table->date('quote_sent_at')->nullable()->after('quote_amount');
            $table->date('quote_accepted_at')->nullable()->after('quote_sent_at');
            // Étape 3 : reprise des mesures sur place après acceptation.
            $table->boolean('remeasure_needed')->default(false)->after('quote_accepted_at');
            $table->date('remeasured_at')->nullable()->after('remeasure_needed');
            // Étape 4 : estimation de temps pour construire le planning.
            $table->decimal('planning_hours', 8, 2)->nullable()->after('remeasured_at');
        });
    }

    public function down(): void
    {
        Schema::table('chantiers', function (Blueprint $table) {
            $table->dropConstrainedForeignId('client_id');
            $table->dropColumn(['estimated_hours', 'mesures', 'materiel', 'quote_status', 'quote_amount', 'quote_sent_at', 'quote_accepted_at', 'remeasure_needed', 'remeasured_at', 'planning_hours']);
        });
        Schema::dropIfExists('chantier_sous_traitant');
        Schema::dropIfExists('sous_traitants');
        Schema::dropIfExists('clients');
    }
};
