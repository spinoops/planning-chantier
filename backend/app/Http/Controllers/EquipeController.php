<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreEquipeRequest;
use App\Http\Requests\UpdateEquipeRequest;
use App\Http\Resources\EquipeResource;
use App\Models\Equipe;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class EquipeController extends Controller
{
    /**
     * Toutes les équipes avec leurs membres (liste courte, non paginée : elle
     * alimente la colonne de gauche du planning et les sélecteurs).
     */
    public function index(): AnonymousResourceCollection
    {
        $equipes = Equipe::query()
            ->with('members')
            ->withCount('affectations')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return EquipeResource::collection($equipes);
    }

    public function store(StoreEquipeRequest $request): JsonResponse
    {
        $data = $request->validated();

        $equipe = DB::transaction(function () use ($data) {
            $equipe = Equipe::create([
                'name' => $data['name'],
                'color' => $data['color'],
                'sort_order' => $data['sort_order'] ?? (Equipe::max('sort_order') + 1),
            ]);
            if (array_key_exists('member_ids', $data)) {
                $this->syncMembers($equipe, $data['member_ids']);
            }

            return $equipe;
        });

        return EquipeResource::make($equipe->load('members'))
            ->response()
            ->setStatusCode(201);
    }

    public function update(UpdateEquipeRequest $request, Equipe $equipe): EquipeResource
    {
        $data = $request->validated();

        DB::transaction(function () use ($data, $equipe) {
            $equipe->fill(collect($data)->only(['name', 'color', 'sort_order'])->all())->save();
            if (array_key_exists('member_ids', $data)) {
                $this->syncMembers($equipe, $data['member_ids']);
            }
        });

        return EquipeResource::make($equipe->fresh(['members'])->loadCount('affectations'));
    }

    /**
     * Supprime une équipe : ses membres deviennent « sans équipe », ses
     * affectations passées restent (equipe_id à null, ouvriers conservés).
     */
    public function destroy(Equipe $equipe): JsonResponse
    {
        $equipe->delete();

        return response()->json(['message' => 'Équipe supprimée.']);
    }

    /**
     * Rattache exactement ces employés à l'équipe (ils quittent leur équipe
     * précédente ; ceux qui ne sont plus listés deviennent sans équipe).
     *
     * @param  list<int>  $memberIds
     */
    private function syncMembers(Equipe $equipe, array $memberIds): void
    {
        User::where('equipe_id', $equipe->id)->whereNotIn('id', $memberIds)->update(['equipe_id' => null]);
        if ($memberIds !== []) {
            User::whereIn('id', $memberIds)->update(['equipe_id' => $equipe->id]);
        }
    }
}
