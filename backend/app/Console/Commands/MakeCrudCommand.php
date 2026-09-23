<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Filesystem\Filesystem;
use Illuminate\Support\Str;
use InvalidArgumentException;

/**
 * Génère une entité métier complète (API + éventuellement front) à partir
 * d'un nom et d'une liste de champs, à la manière d'un générateur CRUD.
 *
 *   php artisan make:crud Facture --fields="numero:string,montant:decimal,echeance:date,payee:boolean,notes:text?" --admin --front
 *
 * Backend : modèle (soft deletes + journal d'activité), migration, factory,
 * Resource, Store/Update Requests, contrôleur paginé (recherche, tri), test Pest,
 * et insertion de la route apiResource dans routes/api.php (repères make:crud).
 * Front (--front) : type TS, hook TanStack Query, page CRUD (liste + modale),
 * route dans App.tsx et entrée de menu dans lib/navigation.ts.
 */
class MakeCrudCommand extends Command
{
    protected $signature = 'make:crud
        {name : Nom du modèle au singulier, en StudlyCase (ex. Facture)}
        {--fields= : Champs "nom:type[?]" séparés par des virgules. Types : string, text, integer, decimal, boolean, date, datetime, foreign. "?" = nullable}
        {--plural= : Pluriel du nom (défaut : pluriel anglais, ex. Factures)}
        {--label= : Libellé singulier affiché (défaut : nom)}
        {--label-plural= : Libellé pluriel affiché (défaut : pluriel)}
        {--admin : Réserver les routes aux administrateurs}
        {--front : Générer aussi le hook, la page React, la route et le menu}
        {--force : Écraser les fichiers existants}';

    protected $description = 'Génère une entité CRUD complète (modèle, migration, API, test, et front optionnel).';

    /** Types de champs pris en charge. */
    private const TYPES = ['string', 'text', 'integer', 'decimal', 'boolean', 'date', 'datetime', 'foreign'];

    /** @var list<array{name: string, type: string, nullable: bool, label: string}> */
    private array $fields = [];

    /** @var array<string, string> */
    private array $vars = [];

    public function __construct(private readonly Filesystem $files)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        try {
            $this->fields = $this->parseFields((string) $this->option('fields'));
        } catch (InvalidArgumentException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        if ($this->fields === []) {
            $this->error('Indique au moins un champ avec --fields="titre:string,…".');

            return self::FAILURE;
        }

        $this->vars = $this->buildVariables();
        $v = $this->vars;

        $written = [];
        $written[] = $this->render('model', app_path("Models/{$v['class']}.php"));
        $written[] = $this->render('migration', database_path("migrations/{$v['timestamp']}_create_{$v['table']}_table.php"));
        $written[] = $this->render('factory', database_path("factories/{$v['class']}Factory.php"));
        $written[] = $this->render('resource', app_path("Http/Resources/{$v['class']}Resource.php"));
        $written[] = $this->render('request.store', app_path("Http/Requests/Store{$v['class']}Request.php"));
        $written[] = $this->render('request.update', app_path("Http/Requests/Update{$v['class']}Request.php"));
        $written[] = $this->render('controller', app_path("Http/Controllers/{$v['class']}Controller.php"));
        $written[] = $this->render('test', base_path("tests/Feature/{$v['class']}Test.php"));
        $this->insertApiRoute();

        if ($this->option('front')) {
            $front = base_path('../frontend/src');
            if (! $this->files->isDirectory($front)) {
                $this->warn("Dossier front introuvable ({$front}) : partie React ignorée.");
            } else {
                $written[] = $this->render('front.hook', "{$front}/hooks/use{$v['classPlural']}.ts");
                $written[] = $this->render('front.page', "{$front}/pages/{$v['classPlural']}Page.tsx");
                $this->appendFrontType($front);
                $this->insertFrontRoute($front);
                $this->insertNavItem($front);
            }
        }

        $this->newLine();
        $this->info("Entité {$v['class']} générée :");
        foreach (array_filter($written) as $file) {
            $this->line('  - '.$this->relative($file));
        }
        $this->newLine();
        $this->line('Étapes suivantes :');
        $this->line('  1. Vérifie la migration puis lance :  artisan migrate');
        $this->line('  2. Adapte les règles de validation et le Resource si besoin.');
        $this->line('  3. Lance les tests :  artisan test --filter='.$v['class']);
        if ($this->option('front')) {
            $this->line("  4. Front : la page {$v['classPlural']}Page est routée sur /{$v['slug']} et ajoutée au menu.");
        } else {
            $this->line('  4. Relance avec --front pour générer aussi le hook et la page React.');
        }

        return self::SUCCESS;
    }

    // ------------------------------------------------------------ Champs

    /**
     * "titre:string,montant:decimal,notes:text?" → liste de champs typés.
     *
     * @return list<array{name: string, type: string, nullable: bool, label: string}>
     */
    private function parseFields(string $spec): array
    {
        $fields = [];
        foreach (array_filter(array_map('trim', explode(',', $spec))) as $item) {
            [$name, $type] = array_pad(explode(':', $item, 2), 2, 'string');
            $nullable = str_ends_with($type, '?');
            $type = rtrim($type, '?') ?: 'string';
            $name = Str::snake(trim($name));

            if ($name === '' || ! preg_match('/^[a-z][a-z0-9_]*$/', $name)) {
                throw new InvalidArgumentException("Nom de champ invalide : « {$item} ».");
            }
            if (! in_array($type, self::TYPES, true)) {
                throw new InvalidArgumentException("Type inconnu « {$type} » pour le champ {$name}. Types : ".implode(', ', self::TYPES).'.');
            }
            if ($type === 'foreign' && ! str_ends_with($name, '_id')) {
                throw new InvalidArgumentException("Un champ foreign doit se terminer par _id (ex. client_id), reçu « {$name} ».");
            }

            $fields[] = [
                'name' => $name,
                'type' => $type,
                'nullable' => $nullable,
                'label' => Str::ucfirst(str_replace('_', ' ', preg_replace('/_id$/', '', $name))),
            ];
        }

        return $fields;
    }

    /**
     * @return array<string, string>
     */
    private function buildVariables(): array
    {
        $class = Str::studly((string) $this->argument('name'));
        $classPlural = Str::studly((string) ($this->option('plural') ?: Str::plural($class)));
        $label = (string) ($this->option('label') ?: $class);
        $labelPlural = (string) ($this->option('label-plural') ?: ($this->option('plural') ?: Str::plural($label)));
        $slug = Str::kebab($classPlural);

        $searchable = array_values(array_filter($this->fields, fn ($f) => $f['type'] === 'string'));
        $sortable = array_values(array_filter($this->fields, fn ($f) => $f['type'] !== 'text'));
        $labelField = $searchable[0]['name'] ?? $this->fields[0]['name'];

        return [
            'class' => $class,
            'classPlural' => $classPlural,
            'variable' => Str::camel($class),
            'variablePlural' => Str::camel($classPlural),
            'table' => Str::snake($classPlural),
            'slug' => $slug,
            'label' => $label,
            'labelPlural' => $labelPlural,
            'labelField' => $labelField,
            'timestamp' => now()->format('Y_m_d_His'),
            'middleware' => $this->option('admin') ? 'admin' : 'auth',
            'fillable' => $this->lines(fn ($f) => "'{$f['name']}',", 8),
            'casts' => $this->lines(fn ($f) => $this->castFor($f), 12),
            'logOnly' => implode(', ', array_map(fn ($f) => "'{$f['name']}'", $this->fields)),
            'migrationColumns' => $this->lines(fn ($f) => $this->migrationColumn($f), 12),
            'factoryFields' => $this->lines(fn ($f) => "'{$f['name']}' => {$this->factoryValue($f)},", 12),
            'resourceFields' => $this->lines(fn ($f) => "'{$f['name']}' => \$this->{$f['name']},", 12),
            'storeRules' => $this->lines(fn ($f) => "'{$f['name']}' => [{$this->rulesFor($f, 'required')}],", 12),
            'updateRules' => $this->lines(fn ($f) => "'{$f['name']}' => [{$this->rulesFor($f, 'sometimes')}],", 12),
            'searchColumns' => implode(', ', array_map(fn ($f) => "'{$f['name']}'", $searchable)),
            'sortable' => implode(', ', array_map(fn ($f) => "'{$f['name']}'", array_merge($sortable, [['name' => 'created_at']]))),
            'testUpdatePayload' => $this->testUpdatePayload(),
            'testUpdateAssert' => $this->testUpdateAssert(),
            // Front
            'tsFields' => $this->lines(fn ($f) => "{$f['name']}: {$this->tsType($f)}", 2),
            'zodFields' => $this->lines(fn ($f) => "{$f['name']}: {$this->zodType($f)},", 2),
            'formDefaults' => implode(', ', array_map(fn ($f) => "{$f['name']}: {$this->formDefault($f)}", $this->fields)),
            'formFromRow' => implode(', ', array_map(fn ($f) => "{$f['name']}: {$this->formFromRow($f)}", $this->fields)),
            'payloadFields' => $this->lines(fn ($f) => "{$f['name']}: {$this->payloadValue($f)},", 4),
            'formInputs' => $this->lines(fn ($f) => $this->formInput($f), 10),
            'tableColumns' => $this->lines(fn ($f) => $this->tableColumn($f), 12, $sortable),
            'frontFormatImport' => $this->frontFormatImport($sortable),
            'frontFieldImports' => $this->frontFieldImports(),
        ];
    }

    /**
     * Import des helpers de formatage réellement utilisés par les colonnes
     * (un import inutilisé ferait échouer `tsc` / ESLint).
     *
     * @param  list<array{name: string, type: string, nullable: bool, label: string}>  $columns
     */
    private function frontFormatImport(array $columns): string
    {
        $map = ['date' => 'formatDate', 'datetime' => 'formatDateTime', 'decimal' => 'formatNumber'];
        $used = [];
        foreach ($columns as $f) {
            if (isset($map[$f['type']])) {
                $used[$map[$f['type']]] = true;
            }
        }
        if ($used === []) {
            return '';
        }
        ksort($used);

        return 'import { '.implode(', ', array_keys($used))." } from '@/lib/format'\n";
    }

    /** Import des composants de champ utilisés par le formulaire (Checkbox, Textarea). */
    private function frontFieldImports(): string
    {
        $types = array_column($this->fields, 'type');
        $out = '';
        if (in_array('boolean', $types, true)) {
            $out .= "import Checkbox from '@/components/ui/Checkbox'\n";
        }
        if (in_array('text', $types, true)) {
            $out .= "import Textarea from '@/components/ui/Textarea'\n";
        }

        return $out;
    }

    /**
     * @param  callable(array{name: string, type: string, nullable: bool, label: string}): string  $render
     * @param  list<array{name: string, type: string, nullable: bool, label: string}>|null  $fields
     */
    private function lines(callable $render, int $indent, ?array $fields = null): string
    {
        $pad = str_repeat(' ', $indent);
        $out = [];
        foreach ($fields ?? $this->fields as $field) {
            $rendered = $render($field);
            if ($rendered !== '') {
                $out[] = $pad.str_replace("\n", "\n".$pad, $rendered);
            }
        }

        return implode("\n", $out);
    }

    /**
     * @param  array{name: string, type: string, nullable: bool, label: string}  $f
     */
    private function migrationColumn(array $f): string
    {
        $col = match ($f['type']) {
            'string' => "\$table->string('{$f['name']}')",
            'text' => "\$table->text('{$f['name']}')",
            'integer' => "\$table->integer('{$f['name']}')",
            'decimal' => "\$table->decimal('{$f['name']}', 12, 2)",
            'boolean' => "\$table->boolean('{$f['name']}')->default(false)",
            'date' => "\$table->date('{$f['name']}')",
            'datetime' => "\$table->dateTime('{$f['name']}')",
            'foreign' => "\$table->foreignId('{$f['name']}')->constrained()->cascadeOnDelete()",
        };

        return $col.($f['nullable'] && $f['type'] !== 'boolean' ? '->nullable()' : '').';';
    }

    /**
     * @param  array{name: string, type: string, nullable: bool, label: string}  $f
     */
    private function castFor(array $f): string
    {
        return match ($f['type']) {
            'integer' => "'{$f['name']}' => 'integer',",
            'decimal' => "'{$f['name']}' => 'decimal:2',",
            'boolean' => "'{$f['name']}' => 'boolean',",
            'date' => "'{$f['name']}' => 'date:Y-m-d',",
            'datetime' => "'{$f['name']}' => 'datetime',",
            default => '',
        };
    }

    /**
     * @param  array{name: string, type: string, nullable: bool, label: string}  $f
     */
    private function factoryValue(array $f): string
    {
        return match ($f['type']) {
            'string' => 'fake()->words(3, true)',
            'text' => 'fake()->paragraph()',
            'integer' => 'fake()->numberBetween(1, 100)',
            'decimal' => 'fake()->randomFloat(2, 1, 1000)',
            'boolean' => 'fake()->boolean()',
            'date' => 'fake()->date()',
            'datetime' => 'fake()->dateTime()->format(\'Y-m-d H:i:s\')',
            'foreign' => '\\App\\Models\\'.Str::studly(Str::singular(preg_replace('/_id$/', '', $f['name']))).'::factory()',
        };
    }

    /**
     * @param  array{name: string, type: string, nullable: bool, label: string}  $f
     */
    private function rulesFor(array $f, string $presence): string
    {
        $rules = [$f['nullable'] ? 'nullable' : $presence];
        if ($f['nullable'] && $presence === 'sometimes') {
            $rules = ['sometimes', 'nullable'];
        }
        $rules = array_merge($rules, match ($f['type']) {
            'string' => ['string', 'max:255'],
            'text' => ['string'],
            'integer' => ['integer'],
            'decimal' => ['numeric', 'min:0'],
            'boolean' => ['boolean'],
            'date' => ['date'],
            'datetime' => ['date'],
            'foreign' => ['integer', 'exists:'.Str::snake(Str::pluralStudly(Str::studly(preg_replace('/_id$/', '', $f['name'])))).',id'],
        });

        return implode(', ', array_map(fn ($r) => "'{$r}'", $rules));
    }

    private function testUpdatePayload(): string
    {
        $f = $this->fields[0];

        return "'{$f['name']}' => {$this->sampleValue($f)}";
    }

    private function testUpdateAssert(): string
    {
        $f = $this->fields[0];
        $value = $this->sampleValue($f);

        return $f['type'] === 'decimal'
            ? "->assertJsonPath('data.{$f['name']}', '{$value}')"
            : "->assertJsonPath('data.{$f['name']}', {$value})";
    }

    /**
     * @param  array{name: string, type: string, nullable: bool, label: string}  $f
     */
    private function sampleValue(array $f): string
    {
        return match ($f['type']) {
            'string' => "'Valeur modifiée'",
            'text' => "'Texte modifié'",
            'integer', 'foreign' => '42',
            'decimal' => '99.50',
            'boolean' => 'true',
            'date' => "'2030-01-15'",
            'datetime' => "'2030-01-15 10:30:00'",
        };
    }

    // ------------------------------------------------------------ Front

    /**
     * @param  array{name: string, type: string, nullable: bool, label: string}  $f
     */
    private function tsType(array $f): string
    {
        $type = match ($f['type']) {
            'integer', 'foreign' => 'number',
            'decimal' => 'string',
            'boolean' => 'boolean',
            default => 'string',
        };

        return $f['nullable'] ? "{$type} | null" : $type;
    }

    /**
     * @param  array{name: string, type: string, nullable: bool, label: string}  $f
     */
    private function zodType(array $f): string
    {
        if ($f['type'] === 'boolean') {
            return 'z.boolean()';
        }
        $base = match ($f['type']) {
            'integer', 'foreign' => "z.string().regex(/^-?\\d*$/, 'Nombre entier attendu.')",
            'decimal' => "z.string().regex(/^-?\\d*([.,]\\d+)?$/, 'Nombre attendu.')",
            default => 'z.string()',
        };

        return $f['nullable'] ? $base : "{$base}.min(1, 'Champ requis.')";
    }

    /**
     * @param  array{name: string, type: string, nullable: bool, label: string}  $f
     */
    private function formDefault(array $f): string
    {
        return $f['type'] === 'boolean' ? 'false' : "''";
    }

    /**
     * @param  array{name: string, type: string, nullable: bool, label: string}  $f
     */
    private function formFromRow(array $f): string
    {
        return match ($f['type']) {
            'boolean' => "row.{$f['name']}",
            'datetime' => "(row.{$f['name']} ?? '').slice(0, 16)",
            'date' => "(row.{$f['name']} ?? '').slice(0, 10)",
            default => "String(row.{$f['name']} ?? '')",
        };
    }

    /**
     * @param  array{name: string, type: string, nullable: bool, label: string}  $f
     */
    private function payloadValue(array $f): string
    {
        $n = $f['name'];

        return match ($f['type']) {
            'boolean' => "values.{$n}",
            'integer', 'foreign' => $f['nullable'] ? "values.{$n} === '' ? null : Number(values.{$n})" : "Number(values.{$n})",
            'decimal' => $f['nullable'] ? "values.{$n} === '' ? null : Number(values.{$n}.replace(',', '.'))" : "Number(values.{$n}.replace(',', '.'))",
            default => $f['nullable'] ? "values.{$n} || null" : "values.{$n}",
        };
    }

    /**
     * @param  array{name: string, type: string, nullable: bool, label: string}  $f
     */
    private function formInput(array $f): string
    {
        $n = $f['name'];
        $label = $f['label'].($f['nullable'] ? ' (optionnel)' : '');

        return match ($f['type']) {
            'text' => "<Textarea label=\"{$label}\" error={errors.{$n}?.message} {...register('{$n}')} />",
            'boolean' => "<Checkbox label=\"{$label}\" {...register('{$n}')} />",
            'integer', 'foreign' => "<Input label=\"{$label}\" type=\"number\" step=\"1\" error={errors.{$n}?.message} {...register('{$n}')} />",
            'decimal' => "<Input label=\"{$label}\" type=\"number\" step=\"0.01\" error={errors.{$n}?.message} {...register('{$n}')} />",
            'date' => "<Input label=\"{$label}\" type=\"date\" error={errors.{$n}?.message} {...register('{$n}')} />",
            'datetime' => "<Input label=\"{$label}\" type=\"datetime-local\" error={errors.{$n}?.message} {...register('{$n}')} />",
            default => "<Input label=\"{$label}\" error={errors.{$n}?.message} {...register('{$n}')} />",
        };
    }

    /**
     * @param  array{name: string, type: string, nullable: bool, label: string}  $f
     */
    private function tableColumn(array $f): string
    {
        $n = $f['name'];
        $render = match ($f['type']) {
            'boolean' => "render: (row) => (row.{$n} ? 'Oui' : 'Non')",
            'decimal' => "render: (row) => formatNumber(row.{$n})",
            'date' => "render: (row) => formatDate(row.{$n})",
            'datetime' => "render: (row) => formatDateTime(row.{$n})",
            default => "render: (row) => row.{$n} ?? '—'",
        };

        return "{ key: '{$n}', header: '{$f['label']}', sortable: true, {$render} },";
    }

    // ------------------------------------------------------------ Écriture

    private function render(string $stub, string $target): ?string
    {
        $stubPath = __DIR__."/../../../stubs/crud/{$stub}.stub";
        $content = $this->files->get($stubPath);

        foreach ($this->vars as $key => $value) {
            $content = str_replace('{{ '.$key.' }}', $value, $content);
        }

        if ($this->files->exists($target) && ! $this->option('force')) {
            $this->warn('  Existe déjà (utilise --force) : '.$this->relative($target));

            return null;
        }

        $this->files->ensureDirectoryExists(dirname($target));
        $this->files->put($target, $content);

        return $target;
    }

    private function insertApiRoute(): void
    {
        $v = $this->vars;
        $routes = base_path('routes/api.php');
        $content = $this->files->get($routes);
        $line = "Route::apiResource('{$v['slug']}', {$v['class']}Controller::class);";

        if (str_contains($content, $line)) {
            return;
        }

        $marker = $this->option('admin') ? '// make:crud (admin)' : '// make:crud (auth)';
        if (! str_contains($content, $marker)) {
            $this->warn("Repère « {$marker} » absent de routes/api.php : ajoute la route à la main :\n  {$line}");

            return;
        }

        $indent = $this->option('admin') ? '        ' : '    ';
        $content = str_replace($indent.$marker, $indent.$line."\n".$indent.$marker, $content);
        $content = $this->insertUse($content, "use App\\Http\\Controllers\\{$v['class']}Controller;");
        $this->files->put($routes, $content);
        $this->line('  - routes/api.php (route ajoutée)');
    }

    /** Insère une ligne `use` en gardant l'ordre alphabétique du bloc existant. */
    private function insertUse(string $content, string $useLine): string
    {
        if (str_contains($content, $useLine)) {
            return $content;
        }
        preg_match_all('/^use [^;]+;$/m', $content, $matches, PREG_OFFSET_CAPTURE);
        $uses = $matches[0];
        if ($uses === []) {
            return preg_replace('/^<\?php\s*\n/', "<?php\n\n{$useLine}\n", $content, 1);
        }
        foreach ($uses as [$existing, $offset]) {
            if (strcmp($existing, $useLine) > 0) {
                return substr($content, 0, $offset).$useLine."\n".substr($content, $offset);
            }
        }
        [$last, $offset] = end($uses);

        return substr($content, 0, $offset + strlen($last))."\n".$useLine.substr($content, $offset + strlen($last));
    }

    private function appendFrontType(string $front): void
    {
        $v = $this->vars;
        $file = "{$front}/types/index.ts";
        $content = $this->files->get($file);
        if (str_contains($content, "export interface {$v['class']} ")) {
            return;
        }
        $block = "\n/** {$v['label']} (GET /api/{$v['slug']}). Généré par make:crud. */\nexport interface {$v['class']} {\n  id: number\n{$v['tsFields']}\n  created_at: string\n  updated_at: string\n}\n";
        $this->files->put($file, rtrim($content)."\n".$block);
        $this->line('  - frontend/src/types/index.ts (type ajouté)');
    }

    private function insertFrontRoute(string $front): void
    {
        $v = $this->vars;
        $file = "{$front}/App.tsx";
        $content = $this->files->get($file);
        $marker = $this->option('admin') ? '{/* make:crud (admin) */}' : '{/* make:crud (auth) */}';
        $route = "<Route path=\"/{$v['slug']}\" element={<{$v['classPlural']}Page />} />";

        if (str_contains($content, $route)) {
            return;
        }
        if (! str_contains($content, $marker)) {
            $this->warn("Repère « {$marker} » absent de App.tsx : ajoute la route à la main :\n  {$route}");

            return;
        }
        $content = preg_replace_callback(
            '/^([ \t]*)'.preg_quote($marker, '/').'/m',
            fn ($m) => $m[1].$route."\n".$m[1].$marker,
            $content,
            1,
        );
        $import = "import {$v['classPlural']}Page from '@/pages/{$v['classPlural']}Page'";
        if (! str_contains($content, $import)) {
            // Après le dernier import de page.
            $content = preg_replace('/^(import \w+Page from \'@\/pages\/\w+\'\n)(?!import \w+Page)/m', "$1{$import}\n", $content, 1);
        }
        $this->files->put($file, $content);
        $this->line('  - frontend/src/App.tsx (route ajoutée)');
    }

    private function insertNavItem(string $front): void
    {
        $v = $this->vars;
        $file = "{$front}/lib/navigation.ts";
        $content = $this->files->get($file);
        $marker = '// make:crud';
        $admin = $this->option('admin') ? ', admin: true' : '';
        $item = "{ to: '/{$v['slug']}', label: '{$v['labelPlural']}'{$admin} },";

        if (str_contains($content, "to: '/{$v['slug']}'")) {
            return;
        }
        if (! str_contains($content, $marker)) {
            $this->warn("Repère « {$marker} » absent de lib/navigation.ts : ajoute l'entrée à la main :\n  {$item}");

            return;
        }
        $content = preg_replace_callback(
            '/^([ \t]*)'.preg_quote($marker, '/').'/m',
            fn ($m) => $m[1].$item."\n".$m[1].$marker,
            $content,
            1,
        );
        $this->files->put($file, $content);
        $this->line('  - frontend/src/lib/navigation.ts (menu ajouté)');
    }

    /** Chemin affiché relativement à la racine du dépôt (backend/…, frontend/…). */
    private function relative(string $path): string
    {
        $root = str_replace('\\', '/', dirname(base_path()));
        $path = str_replace('\\', '/', realpath($path) ?: $path);

        return ltrim(Str::after($path, $root), '/');
    }
}
