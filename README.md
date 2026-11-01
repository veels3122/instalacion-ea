# Wave · Mudanza de puestos (14–16 nov 2026)

App web para registrar cada puesto provisional (componentes, consolas con tag, puertos de monitores y torre, fotos)
y luego, del 14 al 16, instalarlo igual en el puesto nuevo.

## Publicar en Render

1. **Base de datos** → en Render: `New +` → `Postgres` → Name `wave-db`, Region la misma del servicio web, Plan **Free** → Create.
   Cuando quede *Available*, copia el **Internal Database URL**.
2. **Web Service** → `New +` → `Web Service` → elige este repositorio.
   - Language: **Node**
   - Branch: `main`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: **Free**
   - Environment Variables → `DATABASE_URL` = el Internal Database URL del paso 1
3. **Deploy**. Cuando diga *Live*, abre el link `https://<nombre>.onrender.com`.

Si en el menú (☰) aparece "Modo prueba", falta la variable `DATABASE_URL`.

## Notas
- Plan gratis: si nadie la usa por 15 min se "duerme" y el primer ingreso tarda ~1 minuto.
- La base gratis de Render vence a los 30 días: exporta el Excel, las fotos (ZIP) y el respaldo antes de eso.
- Probar en el computador: `npm install` y `npm start` → http://localhost:3000 (guarda en `local-data/`).
