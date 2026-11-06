# Pruebas de API (E11)

Colección de Postman con 29 solicitudes y 90 aserciones automáticas sobre código de respuesta, esquema JSON y contenido.

| Carpeta | Qué cubre |
| --- | --- |
| 01 Salud y catálogo | Disponibilidad de la API y datos del catálogo |
| 02 Registro, sesión y acceso | RF-01 a RF-03, RNF-04 (sin contraseña en respuestas) y RNF-06 (403 en administración) |
| 03 Administración con segundo factor | RF-04: enrolamiento 2FA con un código TOTP calculado en el script previo |
| 04 Flujo de compra completo | Flujo de negocio encadenado: carrito → cupón → pedido → pending/confirmed/shipped/delivered → bitácora → devolución → aprobación |

Las solicitudes se encadenan con variables de colección (`compradorToken`, `adminToken`, `orderId`, `returnId`), por lo que deben ejecutarse en orden.

## Ejecución local

Requiere una base limpia y recién sembrada: durante la corrida el admin del seed se enrola en 2FA y se crea el cupón MIN2100.

```bash
cd backend
MONGO_URI=mongodb://127.0.0.1:27017/luxora npm run seed
npm start                        # con RL_DISABLED=true en backend/.env
cd ..
npx newman run qa/postman/luxora-api.postman_collection.json \
  -e qa/postman/local.postman_environment.json \
  -r cli,htmlextra --reporter-htmlextra-export reports/api/newman.html
```

También se puede importar la colección y el ambiente en Postman y usar **Run collection**.

## En el pipeline

El job `api-tests` del workflow `CI-CD` levanta MongoDB como servicio, siembra la base, inicia el backend y ejecuta la colección con Newman. El reporte HTML queda como artefacto de la ejecución.
