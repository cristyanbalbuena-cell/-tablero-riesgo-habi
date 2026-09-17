// ============================================================
// CONFIGURACIÓN
// Los valores sensibles (SPREADSHEET_ID, CHAT_WEBHOOK_URL) NO se escriben aquí.
// Se guardan como "Propiedades del proyecto" dentro de Apps Script (Configuración
// del proyecto → Propiedades del script), así nunca aparecen en el código ni en Git/GitHub,
// aunque el repositorio sea público.
// ============================================================
var SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
var CHAT_WEBHOOK_URL = PropertiesService.getScriptProperties().getProperty('CHAT_WEBHOOK_URL');
var BIGQUERY_PROJECT_ID = "papyrus-master"; // no es sensible, puede quedar en el código

// ============================================================
// PUNTOS DE ENTRADA WEB (sirven el tablero y reciben/entregan datos)
// ============================================================
function doGet(e) {
  if (e.parameter.action === 'getTickets') {
    return leerTickets_();
  }
  if (e.parameter.action === 'getDict') {
    return leerDiccionario_();
  }
  if (e.parameter.action === 'getCorrections') {
    return leerCorrecciones_();
  }
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Tablero Operativo de Riesgo — Habi')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  var payload = JSON.parse(e.postData.contents);

  if (payload.action === 'saveTickets') {
    guardarTickets_(payload.tickets);
    return ContentService.createTextOutput(JSON.stringify({status: 'ok', total: payload.tickets.length}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (payload.action === 'saveDict') {
    guardarDiccionario_(payload.dict);
    return ContentService.createTextOutput(JSON.stringify({status: 'ok'}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (payload.action === 'saveCorrections') {
    guardarCorrecciones_(payload.corrections);
    return ContentService.createTextOutput(JSON.stringify({status: 'ok'}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Notificación a Google Chat (comportamiento por defecto)
  var mensaje = { text: payload.text || "Sin mensaje" };
  UrlFetchApp.fetch(CHAT_WEBHOOK_URL, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(mensaje)
  });
  return ContentService.createTextOutput(JSON.stringify({status: 'ok'}))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// ALMACENAMIENTO COMPARTIDO: TICKETS (Google Sheet como base de datos simple)
// ============================================================
function getSheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Tickets');
  if (!sheet) sheet = ss.insertSheet('Tickets');
  return sheet;
}

function guardarTickets_(tickets) {
  var sheet = getSheet_();
  sheet.clear();
  if (tickets.length > 0) {
    var filas = tickets.map(function(t){ return [JSON.stringify(t)]; });
    sheet.getRange(1, 1, filas.length, 1).setValues(filas);
  }
}

function leerTickets_() {
  var sheet = getSheet_();
  var lastRow = sheet.getLastRow();
  var tickets = [];
  if (lastRow > 0) {
    var valores = sheet.getRange(1, 1, lastRow, 1).getValues();
    tickets = valores.map(function(row){
      try { return JSON.parse(row[0]); } catch(err){ return null; }
    }).filter(Boolean);
  }
  return ContentService.createTextOutput(JSON.stringify(tickets))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// ALMACENAMIENTO COMPARTIDO: DICCIONARIO DE HOMOLOGACIÓN
// ============================================================
function getDictSheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Diccionario');
  if (!sheet) sheet = ss.insertSheet('Diccionario');
  return sheet;
}

function guardarDiccionario_(dict) {
  var sheet = getDictSheet_();
  sheet.clear();
  sheet.getRange(1, 1).setValue(JSON.stringify(dict));
}

function leerDiccionario_() {
  var sheet = getDictSheet_();
  var valor = sheet.getRange(1, 1).getValue();
  var dict = {};
  if (valor) {
    try { dict = JSON.parse(valor); } catch (e) { dict = {}; }
  }
  return ContentService.createTextOutput(JSON.stringify(dict))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// ALMACENAMIENTO COMPARTIDO: CORRECCIONES MANUALES POR TICKET
// (reasignar analista / corregir área — sobreviven a la resincronización
// automática de BigQuery cada 12 horas)
// ============================================================
function getCorreccionesSheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Correcciones');
  if (!sheet) sheet = ss.insertSheet('Correcciones');
  return sheet;
}

function guardarCorrecciones_(corrections) {
  var sheet = getCorreccionesSheet_();
  sheet.clear();
  sheet.getRange(1, 1).setValue(JSON.stringify(corrections));
}

function leerCorrecciones_() {
  var sheet = getCorreccionesSheet_();
  var valor = sheet.getRange(1, 1).getValue();
  var corrections = {};
  if (valor) {
    try { corrections = JSON.parse(valor); } catch (e) { corrections = {}; }
  }
  return ContentService.createTextOutput(JSON.stringify(corrections))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// AUTOMATIZACIÓN: trae los datos de BigQuery (se ejecuta sola, 2x al día)
// ============================================================
function actualizarDesdeBigQuery() {
  var query = `
WITH interacciones_unicas AS (
  SELECT
    interaccion_id,
    fecha_creacion,
    FORMAT_DATE('%B', fecha_creacion) AS mes,
    nid,
    categoria,
    subcategoria,
    empresa,
    infra,
    nombre_colaborador,
    equipo_solucion,
    area_responsable,
    primer_resumen_ia,
    segundo_resumen_ia,
    ROW_NUMBER() OVER (
      PARTITION BY interaccion_id
      ORDER BY fecha_creacion DESC
    ) AS fila
  FROM
    \`papyrus-master.sac_gold.mart_informacion_detallada_interacciones_global\`
  WHERE
    estado IN ('open', 'hold','closed', 'pending', 'resolved')
    AND motivo = 'Problema (queja / reclamo)'
    AND EXTRACT(YEAR FROM fecha_creacion) = 2026
    AND empresa IN ('Habi Colombia', 'Tuhabi México')
)
SELECT
  * EXCEPT(fila)
FROM
  interacciones_unicas
WHERE
  fila = 1
`;

  var request = {query: query, useLegacySql: false};
  var queryResults = BigQuery.Jobs.query(request, BIGQUERY_PROJECT_ID);
  var jobId = queryResults.jobReference.jobId;

  var espera = 500;
  while (!queryResults.jobComplete) {
    Utilities.sleep(espera);
    espera = Math.min(espera * 2, 5000);
    queryResults = BigQuery.Jobs.getQueryResults(BIGQUERY_PROJECT_ID, jobId);
  }

  var fields = queryResults.schema.fields;
  function filaAObjeto(row) {
    var obj = {};
    for (var i = 0; i < fields.length; i++) obj[fields[i].name] = row.f[i].v;
    return obj;
  }

  var registros = (queryResults.rows || []).map(filaAObjeto);

  while (queryResults.pageToken) {
    queryResults = BigQuery.Jobs.getQueryResults(BIGQUERY_PROJECT_ID, jobId, {pageToken: queryResults.pageToken});
    registros = registros.concat((queryResults.rows || []).map(filaAObjeto));
  }

  guardarTickets_(registros);
  Logger.log("Actualizados " + registros.length + " tickets desde BigQuery.");
}
