<?php

use App\Http\Middleware\EnsureModuleEnabled;
use App\Http\Middleware\EnsureUserIsAdmin;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleMiddleware;
use Spatie\Permission\Middleware\RoleOrPermissionMiddleware;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Alias de middleware :
        //   admin              → réservé au rôle admin (403 JSON sinon)
        //   module:<clé>       → route d'un module optionnel (404 JSON si désactivé)
        //   role / permission  → contrôle fin spatie/laravel-permission
        $middleware->alias([
            'admin' => EnsureUserIsAdmin::class,
            'module' => EnsureModuleEnabled::class,
            'role' => RoleMiddleware::class,
            'permission' => PermissionMiddleware::class,
            'role_or_permission' => RoleOrPermissionMiddleware::class,
        ]);

        // API stateless : ne pas rediriger les invités vers une route "login" inexistante.
        $middleware->redirectGuestsTo(
            fn (Request $request) => $request->is('api/*') ? null : '/login'
        );
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Toute erreur sous /api/* est rendue en JSON (même sans en-tête Accept).
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request, Throwable $e) => $request->is('api/*') || $request->expectsJson()
        );

        // 401 : token absent ou invalide.
        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['message' => 'Non authentifié.'], 401);
            }
        });

        // 403 : policy / Gate refusé.
        $exceptions->render(function (AuthorizationException|AccessDeniedHttpException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['message' => 'Action non autorisée.'], 403);
            }
        });

        // 404 : route ou modèle introuvable. Les messages techniques du framework
        // ("No query results…", "The route…") sont remplacés par un libellé neutre ;
        // un abort(404, 'Mon message') personnalisé est conservé.
        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if ($request->is('api/*')) {
                $message = $e->getMessage();
                $technical = $message === '' || str_starts_with($message, 'No query results') || str_starts_with($message, 'The route');

                return response()->json(['message' => $technical ? 'Ressource introuvable.' : $message], 404);
            }
        });
    })->create();
