<?php

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

it('téléverse une image et renvoie son URL (admin)', function () {
    Storage::fake('public');
    actingAsAdmin();

    $response = $this->postJson('/api/uploads', [
        'file' => UploadedFile::fake()->image('logo.png', 200, 200),
    ])->assertCreated()->assertJsonStructure(['url']);

    $files = Storage::disk('public')->files('uploads');
    expect($files)->toHaveCount(1)
        ->and($response->json('url'))->toContain('/storage/uploads/');
});

it('refuse un fichier qui n\'est pas une image (422)', function () {
    Storage::fake('public');
    actingAsAdmin();

    $this->postJson('/api/uploads', [
        'file' => UploadedFile::fake()->create('document.pdf', 100, 'application/pdf'),
    ])->assertStatus(422)->assertJsonValidationErrors('file');
});

it('interdit le téléversement à un non-admin', function () {
    Storage::fake('public');
    actingAsUser();

    $this->postJson('/api/uploads', [
        'file' => UploadedFile::fake()->image('logo.png'),
    ])->assertForbidden();
});
