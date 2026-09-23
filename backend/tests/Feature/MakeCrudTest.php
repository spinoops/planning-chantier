<?php

use Illuminate\Filesystem\Filesystem;

/**
 * La commande écrit dans base_path() : on la fait travailler dans un dossier
 * temporaire qui reproduit la structure backend/ + frontend/ du dépôt.
 */
beforeEach(function () {
    $this->files = new Filesystem;
    $this->root = sys_get_temp_dir().'/make-crud-'.uniqid();
    $backend = $this->root.'/backend';
    $front = $this->root.'/frontend/src';

    foreach (['app/Models', 'database/migrations', 'routes', 'tests/Feature'] as $dir) {
        $this->files->ensureDirectoryExists("{$backend}/{$dir}");
    }
    foreach (['hooks', 'pages', 'types', 'lib'] as $dir) {
        $this->files->ensureDirectoryExists("{$front}/{$dir}");
    }

    $this->files->put("{$backend}/routes/api.php", <<<'PHP'
<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function () {
    // make:crud (auth) — routes accessibles à tout utilisateur connecté.

    Route::middleware('admin')->group(function () {
        // make:crud (admin) — routes réservées aux administrateurs.
    });
});
PHP);

    $this->files->put("{$front}/App.tsx", <<<'TSX'
import DashboardPage from '@/pages/DashboardPage'
import UsersPage from '@/pages/UsersPage'
import AppLayout from '@/components/AppLayout'

export default function App() {
  return (
    <Routes>
      <Route path="/dashboard" element={<DashboardPage />} />
      {/* make:crud (auth) */}
      <Route element={<AdminRoute />}>
        <Route path="/users" element={<UsersPage />} />
        {/* make:crud (admin) */}
      </Route>
    </Routes>
  )
}
TSX);
    $this->files->put("{$front}/lib/navigation.ts", "export const NAV_ITEMS = [\n  { to: '/dashboard', label: 'Tableau de bord' },\n  // make:crud\n]\n");
    $this->files->put("{$front}/types/index.ts", "export interface User {\n  id: number\n}\n");

    $this->app->setBasePath($backend);
});

afterEach(function () {
    $this->files->deleteDirectory($this->root);
});

it('génère une entité complète (backend + front) et branche routes et menu', function () {
    $this->artisan('make:crud', [
        'name' => 'Facture',
        '--fields' => 'numero:string,montant:decimal,echeance:date?,payee:boolean,notes:text?,client_id:foreign',
        '--admin' => true,
        '--front' => true,
    ])->assertSuccessful();

    $backend = $this->root.'/backend';
    $front = $this->root.'/frontend/src';

    // Backend : fichiers attendus.
    expect($this->files->exists("{$backend}/app/Models/Facture.php"))->toBeTrue()
        ->and($this->files->exists("{$backend}/app/Http/Controllers/FactureController.php"))->toBeTrue()
        ->and($this->files->exists("{$backend}/app/Http/Resources/FactureResource.php"))->toBeTrue()
        ->and($this->files->exists("{$backend}/app/Http/Requests/StoreFactureRequest.php"))->toBeTrue()
        ->and($this->files->exists("{$backend}/app/Http/Requests/UpdateFactureRequest.php"))->toBeTrue()
        ->and($this->files->exists("{$backend}/database/factories/FactureFactory.php"))->toBeTrue()
        ->and($this->files->exists("{$backend}/tests/Feature/FactureTest.php"))->toBeTrue()
        ->and($this->files->glob("{$backend}/database/migrations/*_create_factures_table.php"))->toHaveCount(1);

    $model = $this->files->get("{$backend}/app/Models/Facture.php");
    expect($model)->toContain("'numero',", "'montant' => 'decimal:2',", "'payee' => 'boolean',", 'use HasFactory, LogsActivity, SoftDeletes;');

    $migration = $this->files->get($this->files->glob("{$backend}/database/migrations/*_create_factures_table.php")[0]);
    expect($migration)->toContain("Schema::create('factures'", "\$table->date('echeance')->nullable();", "\$table->foreignId('client_id')->constrained()->cascadeOnDelete();", '$table->softDeletes();');

    $store = $this->files->get("{$backend}/app/Http/Requests/StoreFactureRequest.php");
    expect($store)->toContain("'numero' => ['required', 'string', 'max:255'],", "'notes' => ['nullable', 'string'],", "'client_id' => ['required', 'integer', 'exists:clients,id'],");

    // Routes : apiResource inséré avant le repère admin + import trié.
    $routes = $this->files->get("{$backend}/routes/api.php");
    expect($routes)->toContain("Route::apiResource('factures', FactureController::class);\n        // make:crud (admin)")
        ->and($routes)->toContain("use App\\Http\\Controllers\\AuthController;\nuse App\\Http\\Controllers\\FactureController;\nuse App\\Http\\Controllers\\UserController;");

    // Syntaxe PHP valide pour tout ce qui a été généré.
    foreach ($this->files->allFiles($backend) as $file) {
        if ($file->getExtension() === 'php') {
            exec(escapeshellarg(PHP_BINARY).' -l '.escapeshellarg($file->getPathname()).' 2>&1', $output, $code);
            expect($code)->toBe(0, "Erreur de syntaxe dans {$file->getFilename()} : ".implode("\n", $output));
        }
    }

    // Front : hook + page + type + route + menu.
    expect($this->files->exists("{$front}/hooks/useFactures.ts"))->toBeTrue()
        ->and($this->files->exists("{$front}/pages/FacturesPage.tsx"))->toBeTrue();

    $page = $this->files->get("{$front}/pages/FacturesPage.tsx");
    expect($page)->toContain('export default function FacturesPage()', "import Checkbox from '@/components/ui/Checkbox'", "import Textarea from '@/components/ui/Textarea'", "import { formatDate, formatNumber } from '@/lib/format'", "<Checkbox label=\"Payee\" {...register('payee')} />");

    expect($this->files->get("{$front}/types/index.ts"))->toContain("export interface Facture {\n  id: number\n  numero: string\n  montant: string\n  echeance: string | null\n  payee: boolean\n  notes: string | null\n  client_id: number\n  created_at: string");

    $app = $this->files->get("{$front}/App.tsx");
    expect($app)->toContain("<Route path=\"/factures\" element={<FacturesPage />} />\n        {/* make:crud (admin) */}")
        ->and($app)->toContain("import UsersPage from '@/pages/UsersPage'\nimport FacturesPage from '@/pages/FacturesPage'\n");

    expect($this->files->get("{$front}/lib/navigation.ts"))->toContain("{ to: '/factures', label: 'Factures', admin: true },\n  // make:crud");
});

it('refuse d\'écraser un fichier existant sans --force', function () {
    $backend = $this->root.'/backend';
    $this->files->put("{$backend}/app/Models/Note.php", 'ORIGINAL');

    $this->artisan('make:crud', ['name' => 'Note', '--fields' => 'title:string'])->assertSuccessful();
    expect($this->files->get("{$backend}/app/Models/Note.php"))->toBe('ORIGINAL');

    $this->artisan('make:crud', ['name' => 'Note', '--fields' => 'title:string', '--force' => true])->assertSuccessful();
    expect($this->files->get("{$backend}/app/Models/Note.php"))->toContain('class Note extends Model');
});

it('signale un type de champ inconnu', function () {
    $this->artisan('make:crud', ['name' => 'Note', '--fields' => 'title:blob'])
        ->expectsOutputToContain('Type inconnu')
        ->assertFailed();
});
