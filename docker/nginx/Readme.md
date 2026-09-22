# Fibrasan — Frontend (Angular)

Frontend del sistema Fibrasan, construido con Angular 19 y dockerizado como una imagen servida por Nginx.

## Stack

- Angular 19.2
- zone.js 0.15.0
- Servido en producción/Docker vía Nginx (build estático)

## Cómo correr el frontend con Docker

El front ya está integrado al `docker-compose.yml` del proyecto **Back** como el servicio `front` — se levanta junto con todo lo demás (Laravel, MySQL, Redis, Reverb, queue) con un solo comando, **corrido desde la carpeta Back**, no desde Front:

```bash
# Desde Proyectos/Back (no desde Front)
docker compose up -d --build
```

El `docker-compose.yml` espera que este proyecto viva en una carpeta hermana de Back (`../Front` relativo a Back), con estructura:

```
Proyectos/
├── Back/     ← docker-compose.yml vive aquí
└── Front/    ← este proyecto, con su propio Dockerfile
```

Abre **http://localhost:4200** en el navegador.

## Comandos del día a día

Todos se corren **desde la carpeta Back**:

```bash
# Ver logs del contenedor del front
docker compose logs -f front

# Reconstruir solo el front después de cambios en el código Angular
docker compose up -d --build front

# Reiniciar solo el front (sin reconstruir)
docker compose restart front

# Apagar/prender todo (back + front juntos)
docker compose down
docker compose up -d
```

### Correr el front suelto (sin el resto del stack)

Si por alguna razón necesitas levantar solo el front, sin tocar Back, todavía puedes hacerlo manualmente desde la carpeta Front:

```bash
docker build -t fibrasan_front .
docker run -d --name fibrasan_front_test -p 4200:80 fibrasan_front
```

Pero para el día a día, usa `docker compose` desde Back — así todo queda conectado en la misma red de Docker.

## Variables de entorno / configuración relevante

El frontend apunta al backend y a Reverb usando (definido en el `.env` del backend, consumido vía Vite):

```
FRONTEND_URL=http://localhost:4200   # (del lado del backend, para CORS)
VITE_REVERB_HOST=localhost
VITE_REVERB_PORT=8080
VITE_REVERB_SCHEME=http
```

Asegúrate de que la URL del backend que consume Angular (normalmente en `environment.ts` / `environment.prod.ts`) apunte a `http://localhost:8000` cuando ambos corren en Docker local.

## Pendiente / próximos pasos

- [ ] Preparar variante de build para producción en IONOS (build con `environment.prod.ts`, dominio real en vez de localhost)