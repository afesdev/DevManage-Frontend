# DevManage — Frontend

Aplicación **React + TypeScript + Vite** del tablero, GitHub, proyectos y demás vistas de DevManage.

## Documentación del producto

Ver el README del monorepo: [`../README.md`](../README.md).

## Requisitos

- Node.js 20+ o Bun

## Configuración

URL base del API: variable **`VITE_API_URL`** (por defecto `http://localhost:3000`). Ejemplo en `.env`:

```env
VITE_API_URL=http://localhost:3000
```

## Comandos

```bash
bun install
bun run dev      # desarrollo (HMR)
bun run build    # compilación para producción
bun run preview  # vista previa del build
```

## Diseño UI

Referencia de diseño interna: [`DESIGN.md`](./DESIGN.md).

## Dependencias destacadas

- **TanStack Query** — datos del servidor
- **Zustand** — estado global (auth, proyecto activo)
- **dnd-kit** — Kanban
- **Tailwind CSS** — estilos
- **Markdown** — descripciones de tarea (`@uiw/react-md-editor`, `react-markdown`, `remark-gfm`, `rehype-sanitize`)
