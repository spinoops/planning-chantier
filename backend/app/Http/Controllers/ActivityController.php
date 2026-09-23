<?php

namespace App\Http\Controllers;

use App\Http\Resources\ActivityResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Spatie\Activitylog\Models\Activity;

class ActivityController extends Controller
{
    /**
     * Journal d'activité (admin), paginé, du plus récent au plus ancien.
     *
     * Filtres : ?search= (description), ?event=created|updated|deleted|…,
     * ?subject_type=User (nom court du modèle), ?causer_id=, ?per_page=.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'event' => ['nullable', 'string', 'max:50'],
            'subject_type' => ['nullable', 'string', 'max:100'],
            'causer_id' => ['nullable', 'integer'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $activities = Activity::with(['causer', 'subject'])
            ->when($filters['search'] ?? null, fn ($q, $s) => $q->where('description', 'like', "%{$s}%"))
            ->when($filters['event'] ?? null, fn ($q, $e) => $q->where('event', $e))
            ->when($filters['subject_type'] ?? null, fn ($q, $t) => $q->where('subject_type', 'like', "%\\{$t}"))
            ->when($filters['causer_id'] ?? null, fn ($q, $id) => $q->where('causer_id', $id))
            ->orderByDesc('id')
            ->paginate((int) ($filters['per_page'] ?? 25))
            ->withQueryString();

        return ActivityResource::collection($activities);
    }
}
