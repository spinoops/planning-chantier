<?php

namespace App\Models;

use Database\Factories\ChantierFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/**
 * Chantier : créé au bureau (client, sous-traitants, matériel, mesures,
 * estimation, remarques), suivi du devis, reprise des mesures, estimation
 * pour le planning, puis planifié, pointé et récapitulé pour la facturation.
 */
class Chantier extends Model
{
    /** @use HasFactory<ChantierFactory> */
    use HasFactory, LogsActivity, SoftDeletes;

    /** Statuts possibles (clé => libellé). */
    public const STATUSES = [
        'planned' => 'À venir',
        'active' => 'En cours',
        'paused' => 'Suspendu',
        'done' => 'Terminé',
    ];

    /** Suivi du devis (étape 2 : prévu, pas encore d'édition de devis). */
    public const QUOTE_STATUSES = [
        'none' => 'Pas de devis',
        'to_prepare' => 'À établir',
        'sent' => 'Envoyé',
        'accepted' => 'Accepté',
        'refused' => 'Refusé',
    ];

    protected $fillable = [
        'name',
        'client',
        'client_id',
        'address',
        'city',
        'color',
        'status',
        'start_date',
        'end_date',
        'notes',
        'estimated_hours',
        'mesures',
        'materiel',
        'quote_status',
        'quote_amount',
        'quote_sent_at',
        'quote_accepted_at',
        'remeasure_needed',
        'remeasured_at',
        'planning_hours',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date:Y-m-d',
            'end_date' => 'date:Y-m-d',
            'quote_sent_at' => 'date:Y-m-d',
            'quote_accepted_at' => 'date:Y-m-d',
            'remeasured_at' => 'date:Y-m-d',
            'remeasure_needed' => 'boolean',
            'materiel' => 'array',
            'estimated_hours' => 'float',
            'planning_hours' => 'float',
            'quote_amount' => 'float',
        ];
    }

    /** @return BelongsTo<Client, $this> */
    public function clientRecord(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    /** @return BelongsToMany<SousTraitant, $this> */
    public function sousTraitants(): BelongsToMany
    {
        return $this->belongsToMany(SousTraitant::class, 'chantier_sous_traitant')->withPivot(['note', 'planned_date'])->orderBy('name');
    }

    /** @return HasMany<Affectation, $this> */
    public function affectations(): HasMany
    {
        return $this->hasMany(Affectation::class);
    }

    /** @return HasMany<TimeEntry, $this> */
    public function timeEntries(): HasMany
    {
        return $this->hasMany(TimeEntry::class);
    }

    /**
     * Recherche sur le nom, le client, l'adresse et la ville (?search=).
     *
     * @param  Builder<Chantier>  $query
     */
    public function scopeSearch(Builder $query, ?string $term): void
    {
        $term = trim((string) $term);
        if ($term === '') {
            return;
        }

        $query->where(function (Builder $q) use ($term) {
            $q->where('name', 'like', "%{$term}%")
                ->orWhere('client', 'like', "%{$term}%")
                ->orWhere('address', 'like', "%{$term}%")
                ->orWhere('city', 'like', "%{$term}%");
        });
    }

    /**
     * Chantiers planifiables (ni terminés, ni suspendus).
     *
     * @param  Builder<Chantier>  $query
     */
    public function scopeOpen(Builder $query): void
    {
        $query->whereIn('status', ['planned', 'active']);
    }

    /**
     * Avancement dans le déroulé (7 étapes), dérivé des données : rien à saisir à part.
     *
     * @return list<array{key: string, label: string, state: 'done'|'todo'|'pending'|'skipped'|'refused', hint: string|null}>
     */
    public function steps(): array
    {
        $affectations = (int) ($this->affectations_count ?? $this->affectations()->count());
        $entries = (int) ($this->time_entries_count ?? $this->timeEntries()->count());

        $quote = match ($this->quote_status) {
            'accepted' => ['done', 'Devis accepté'.($this->quote_accepted_at ? ' le '.$this->quote_accepted_at->format('d.m.Y') : '')],
            'sent' => ['pending', 'Devis envoyé'.($this->quote_sent_at ? ' le '.$this->quote_sent_at->format('d.m.Y') : '').', en attente'],
            'refused' => ['refused', 'Devis refusé'],
            'to_prepare' => ['todo', 'Devis à établir'],
            default => ['skipped', 'Sans devis'],
        };
        $remeasure = $this->remeasure_needed
            ? ($this->remeasured_at ? ['done', 'Mesures reprises le '.$this->remeasured_at->format('d.m.Y')] : ['todo', 'Mesures à reprendre sur place'])
            : ['skipped', 'Pas de reprise prévue'];

        return [
            ['key' => 'creation', 'label' => 'Création du chantier', 'state' => $this->client_id || $this->estimated_hours || $this->mesures ? 'done' : 'todo', 'hint' => $this->client_id ? null : 'Client et estimation à renseigner'],
            ['key' => 'devis', 'label' => 'Devis', 'state' => $quote[0], 'hint' => $quote[1]],
            ['key' => 'mesures', 'label' => 'Reprise des mesures', 'state' => $remeasure[0], 'hint' => $remeasure[1]],
            ['key' => 'estimation', 'label' => 'Estimation pour le planning', 'state' => $this->planning_hours ? 'done' : 'todo', 'hint' => $this->planning_hours ? number_format($this->planning_hours, 1, '.', ' ').' h prévues' : 'Heures à prévoir'],
            ['key' => 'planning', 'label' => 'Planning et équipes', 'state' => $affectations > 0 ? 'done' : 'todo', 'hint' => $affectations > 0 ? "{$affectations} jour(s) planifié(s)" : 'Aucune affectation'],
            ['key' => 'heures', 'label' => 'Heures des employés', 'state' => $entries > 0 ? ($this->status === 'done' ? 'done' : 'pending') : 'todo', 'hint' => $entries > 0 ? "{$entries} pointage(s)" : 'Aucun pointage'],
            ['key' => 'facturation', 'label' => 'Récapitulatif pour facturation', 'state' => $this->status === 'done' ? 'done' : 'todo', 'hint' => $this->status === 'done' ? 'Chantier terminé : récapitulatif disponible' : 'À la fin du chantier'],
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['name', 'client_id', 'status', 'quote_status', 'estimated_hours', 'planning_hours', 'start_date', 'end_date'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs();
    }
}
